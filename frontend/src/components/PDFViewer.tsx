'use client';

import React, { useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import { useAdobePDF } from '@/hooks/useAdobePDF';
import { PDFDocument, PDFViewerRef } from '@/lib/types';

interface PDFViewerProps {
  document: PDFDocument | null;
  onTextSelection?: (selectedText: string, coordinates?: any) => void;
  className?: string;
}

// Helper function for visual highlighting (client-side only)
const showVisualHighlight = (quadPoints: number[], pageNumber: number) => {
  try {
    if (typeof window === 'undefined') return; // Prevent SSR document error
    const container = document.getElementById('adobe-dc-view');
    if (container && quadPoints && quadPoints.length === 8) {
      const highlight = document.createElement('div');
      highlight.style.position = 'absolute';
      highlight.style.backgroundColor = '#FFD700';
      highlight.style.opacity = '0.3';
      highlight.style.border = '2px solid #FFA500';
      highlight.style.borderRadius = '2px';
      highlight.style.pointerEvents = 'none';
      highlight.style.zIndex = '999';
      highlight.className = 'pdf-highlight-overlay';

      const x = Math.min(quadPoints[0], quadPoints[2], quadPoints[4], quadPoints[6]);
      const y = Math.min(quadPoints[1], quadPoints[3], quadPoints[5], quadPoints[7]);
      const width = Math.max(quadPoints[0], quadPoints[2], quadPoints[4], quadPoints[6]) - x;
      const height = Math.max(quadPoints[1], quadPoints[3], quadPoints[5], quadPoints[7]) - y;

      highlight.style.left = `${x}px`;
      highlight.style.top = `${y}px`;
      highlight.style.width = `${width}px`;
      highlight.style.height = `${height}px`;

      container.appendChild(highlight);

      setTimeout(() => {
        if (highlight.parentNode) {
          highlight.parentNode.removeChild(highlight);
        }
      }, 3000);

      console.log('✅ Visual highlight overlay added for page', pageNumber);
    }
  } catch (error) {
    console.warn('⚠️ Visual highlight fallback failed:', error);
  }
};

// Normalize various quad points formats to an array of 8-point quads
// Supported inputs:
// - number[] of length 8 (single quad)
// - Array<number[]> where each item is length 4 (rect) or 8 (quad)
// - { heading: Array<number[]>, content: Array<number[]> } with items as rects (len 4) or quads (len 8)
const normalizeQuadInputs = (input: any): number[][] => {
  const toQuad8 = (arr: any): number[] | null => {
    if (!Array.isArray(arr)) return null;
    if (arr.length === 8 && arr.every(n => typeof n === 'number')) {
      return arr as number[];
    }
    if (arr.length === 4 && arr.every(n => typeof n === 'number')) {
      const [x1, y1, x2, y2] = arr as number[];
      return [x1, y1, x2, y1, x2, y2, x1, y2];
    }
    return null;
  };

  const quads: number[][] = [];

  if (!input) return quads;

  // Single quad array
  if (Array.isArray(input) && input.length && typeof input[0] === 'number') {
    const q = toQuad8(input);
    if (q) quads.push(q);
    return quads;
  }

  // Array of rects/quads
  if (Array.isArray(input) && input.length && Array.isArray(input[0])) {
    for (const item of input as any[]) {
      const q = toQuad8(item);
      if (q) quads.push(q);
    }
    return quads;
  }

  // Object with heading/content arrays
  if (typeof input === 'object') {
    const buckets: any[] = [];
    if (Array.isArray(input.heading)) buckets.push(...input.heading);
    if (Array.isArray(input.content)) buckets.push(...input.content);
    for (const item of buckets) {
      const q = toQuad8(item);
      if (q) quads.push(q);
    }
  }

  return quads;
};

const clearAdobeContainer = () => {
  if (typeof window === 'undefined') return;
  const container = document.getElementById('adobe-dc-view');
  if (container) container.innerHTML = '';
};

const PDFViewer = forwardRef<PDFViewerRef, PDFViewerProps>(({
  document,
  onTextSelection,
  className = ''
}, ref) => {
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [currentFilename, setCurrentFilename] = useState<string | null>(null);
  const [pdfLoadAttempts, setPdfLoadAttempts] = useState(0);

  const {
    isLoaded: isAdobeLoaded,
    error: adobeError,
    loadPDF,
    viewer
  } = useAdobePDF({ onTextSelection });

  // Ref API
  useImperativeHandle(ref, () => ({
    gotoLocation: (pageNumber: number, x = 0, y = 0) => {
      // Convert 1-based page number to 0-based page index for Adobe API
      const pageIndex = pageNumber - 1;
      console.log('🧭 gotoLocation called:', { pageNumber, pageIndex, x, y });
      
      // Check if PDF is loaded and ready
      if (!currentFilename) {
        console.error('❌ PDF not loaded yet');
        return;
      }
      
      if (viewer?.gotoLocation) {
        console.log('🎯 Calling viewer.gotoLocation with page index:', pageIndex);
        viewer.gotoLocation(pageIndex, x, y);
      }
    },

    getSelectedText: () => {
      if (viewer?.getAPIs) {
        const apis = viewer.getAPIs();
        if (apis && apis.getSelectedContent) {
          apis.getSelectedContent().then((content: any) => {
            if (content && content.data && onTextSelection) {
              let selectedText = '';
              if (Array.isArray(content.data)) {
                selectedText = content.data
                  .map((item: any) => item.text || item || '')
                  .join(' ')
                  .trim();
              } else if (typeof content.data === 'string') {
                selectedText = content.data.trim();
              } else if (content.data.text) {
                selectedText = content.data.text.trim();
              }
              if (selectedText && selectedText.length > 0) {
                onTextSelection(selectedText, content);
              } else {
                alert('No text selected. Please highlight some text in the PDF first.');
              }
            }
          }).catch(() =>
            alert('Failed to get selected text. Please try selecting text again.'));
        }
      } else if (typeof window !== 'undefined') {
        const browserSelection = window.getSelection();
        if (browserSelection && browserSelection.toString().trim()) {
          const text = browserSelection.toString().trim();
          if (onTextSelection) onTextSelection(text);
        } else {
          alert('No text selected. Please highlight some text in the PDF first.');
        }
      }
    },

    getAPIs: () => {
      if (viewer?.getAPIs) return viewer.getAPIs();
      return null;
    },

    highlightText: (quadPoints: number[], pageNumber: number) => {
      if (viewer?.getAPIs) {
        const apis = viewer.getAPIs();
        if (apis) {
          try {
            // Convert 1-based page number to 0-based page index for Adobe API
            const pageIndex = pageNumber - 1;
            if (apis.addAnnotation) {
              const annotation = {
                type: 'highlight',
                page: pageIndex,
                quadPoints,
                color: '#FFD700',
                opacity: 0.4
              };
              apis.addAnnotation(annotation);
              return;
            }
            if (apis.highlightText) {
              apis.highlightText({
                page: pageIndex,
                quadPoints,
                color: '#FFD700',
                opacity: 0.4
              });
              return;
            }
          } catch (error) {
            //
          }
        }
      }
    },

    gotoLocationAndHighlight: (pageNumber: number, quadPoints?: any) => {
      // Convert 1-based page number to 0-based page index for Adobe API
      const pageIndex = pageNumber - 1;
      console.log('🧭 gotoLocationAndHighlight called:', { pageNumber, pageIndex, quadPoints });
      
      // Check if PDF is loaded and ready
      if (!currentFilename) {
        console.error('❌ PDF not loaded yet');
        return;
      }
      
      if (viewer?.gotoLocation) {
        try {
          console.log('🎯 Calling gotoLocation with page index:', pageIndex);
          const result = (viewer as any).gotoLocation(pageIndex, 0, 0);
          if (result && typeof result.then === 'function') {
            // Await async navigation if supported
            (async () => {
              try {
                await result;
                console.log('✅ Navigation promise resolved');
              } catch (e) {
                console.warn('⚠️ Navigation promise rejected', e);
              }
            })();
          }
        } catch (e) {
          console.warn('⚠️ gotoLocation call failed', e);
        }
      }
      
      // Normalize and apply one or many highlight quads
      if (viewer?.getAPIs && quadPoints) {
        const quads = normalizeQuadInputs(quadPoints);
        if (quads.length > 0) {
          console.log('🖍️ Setting up', quads.length, 'highlight quad(s) for page:', pageIndex);
          setTimeout(() => {
            const apis = viewer?.getAPIs?.();
            if (apis?.addAnnotation) {
              // Avoid overloading the viewer with too many highlights
              const MAX_HIGHLIGHTS = 200;
              let count = 0;
              for (const q of quads) {
                if (count >= MAX_HIGHLIGHTS) break;
                const annotation = {
                  type: 'highlight',
                  page: pageIndex,
                  quadPoints: q,
                  color: '#FFD700',
                  opacity: 0.4
                } as any;
                try {
                  apis.addAnnotation(annotation);
                  count += 1;
                } catch (e) {
                  console.warn('⚠️ Failed to add highlight annotation:', e);
                }
              }
              console.log(`📝 Added ${count} highlight annotation(s)`);
            }
          }, 1200);
        }
      }
    },

    showVisualHighlight: (quadPoints: number[], pageNumber: number) => {
      showVisualHighlight(quadPoints, pageNumber);
    },

    clearHighlights: () => {
      if (viewer?.getAPIs) {
        const apis = viewer.getAPIs();
        if (apis && apis.removeAnnotations) {
          try {
            apis.removeAnnotations();
          } catch (error) {}
        }
      }
      if (typeof window !== 'undefined') {
        const container = window.document.getElementById('adobe-dc-view');
        if (container) {
          const overlays = container.querySelectorAll('.pdf-highlight-overlay');
          overlays.forEach(overlay => overlay.remove());
        }
      }
    },

    viewer: viewer
  }), [viewer, onTextSelection]);

  useEffect(() => {
    if (
      !document ||
      !isAdobeLoaded ||
      (currentFilename === document.filename && !loadError)
    ) {
      return;
    }

    if (pdfLoadAttempts >= 3) {
      setLoadError('Failed to load PDF after multiple attempts');
      return;
    }

    setIsLoading(true);
    setLoadError(null);
    clearAdobeContainer();

    const timer = setTimeout(async () => {
      try {
        if (typeof window === 'undefined') return;
        const pdfUrl = `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/get-pdf/${encodeURIComponent(document.filename)}`;
        const response = await fetch(pdfUrl, { method: 'HEAD' });
        if (!response.ok) throw new Error(response.statusText);
        await loadPDF(pdfUrl, document.filename, 'adobe-dc-view');
        setCurrentFilename(document.filename);
        setPdfLoadAttempts(0);
      } catch (e) {
        setPdfLoadAttempts(prev => prev + 1);
        if (pdfLoadAttempts < 2) {
          setTimeout(() => setCurrentFilename(null), 2000);
        } else {
          setLoadError(e instanceof Error ? e.message : 'Failed to load PDF');
        }
      } finally {
        setIsLoading(false);
      }
    }, 100);

    return () => clearTimeout(timer);
    // eslint-disable-next-line
  }, [document?.filename, isAdobeLoaded, loadPDF, currentFilename, loadError, pdfLoadAttempts]);

  if (!isAdobeLoaded) {
    return (
      <div className={`flex items-center justify-center h-full bg-gray-50 ${className}`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading Adobe PDF API...</p>
          {adobeError && (
            <p className="text-red-500 text-sm mt-2">{adobeError}</p>
          )}
        </div>
      </div>
    );
  }

  if (!document) {
    return (
      <div className={`flex items-center justify-center h-full bg-gray-50 ${className}`}>
        <div className="text-center">
          <div className="text-6xl mb-4">📄</div>
          <p className="text-gray-600">No PDF selected</p>
          <p className="text-sm text-gray-500 mt-2">Upload or select a PDF to view</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`w-full h-full relative ${className}`}>
      {isLoading && (
        <div className="flex items-center justify-center h-full bg-gray-50 absolute inset-0 z-20">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading PDF: {document.filename}</p>
            {pdfLoadAttempts > 0 && <p className="text-sm text-gray-500">Attempt {pdfLoadAttempts + 1} of 3</p>}
            <p className="text-sm text-gray-500 mt-2">Please wait...</p>
          </div>
        </div>
      )}

      {loadError && (
        <div className="flex items-center justify-center h-full bg-red-50 absolute inset-0 z-20">
          <div className="text-center">
            <div className="text-6xl mb-4">❌</div>
            <p className="text-red-600 font-medium">Failed to load PDF</p>
            <p className="text-sm text-red-500 mt-2">{loadError}</p>
            <div className="mt-4 space-x-2">
              <button 
                onClick={() => {
                  setLoadError(null);
                  setCurrentFilename(null);
                  setPdfLoadAttempts(0);
                }}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                Retry
              </button>
              <button 
                onClick={() => {
                  window.open(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/get-pdf/${encodeURIComponent(document.filename)}`, '_blank');
                }}
                className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
              >
                Open Direct
              </button>
            </div>
          </div>
        </div>
      )}

      <div 
        id="adobe-dc-view"
        className="w-full h-full"
        style={{
          minHeight: '600px',
          height: '100%',
          width: '100%',
          position: 'relative',
          zIndex: 1
        }}
      />
    </div>
  );
});

PDFViewer.displayName = 'PDFViewer';

export default PDFViewer;
