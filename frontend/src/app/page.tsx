'use client';

import React, { useState, useEffect, useRef } from 'react';
import SourcesPanel from '@/components/SourcesPanel';
import PDFViewer from '@/components/PDFViewer';
import FeaturesPanel from '@/components/FeaturesPanel';
import TextSelectionPopup from '@/components/TextSelectionPopup';
import TextSelectionHelper from '@/components/TextSelectionHelper';
import SelectedTextPanel from '@/components/SelectedTextPanel';
import { PDFDocument, FeatureType, PDFViewerRef } from '@/lib/types';
import { apiService } from '@/lib/api';

// NEW: Caching types
type CachedResults = {
  insights?: any;
  summary?: any;
  podcast?: any;
  relevant?: any;
};

type FeatureCache = {
  [selectedTextHash: string]: CachedResults;
};

export default function HomePage() {
  // State management
  const [documents, setDocuments] = useState<PDFDocument[]>([]);
  const [selectedDocument, setSelectedDocument] = useState<PDFDocument | null>(null);
  const [selectedText, setSelectedText] = useState<string>('');
  const [selectedCoords, setSelectedCoords] = useState<any>(null);
  const [selectionPosition, setSelectionPosition] = useState<{ x: number; y: number } | null>(null);
  const [showSelectionPopup, setShowSelectionPopup] = useState(false);
  const [activeFeature, setActiveFeature] = useState<FeatureType>('relevant');
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingResults, setProcessingResults] = useState<any>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  // PHASE 4 ADDITION: Store last relevant extraction & matching helper
  const [relevantResults, setRelevantResults] = useState<any>(null);
  const [lastRelevantSelection, setLastRelevantSelection] = useState<{ text: string; doc: string; } | null>(null);

  // NEW: Feature results cache
  const [featureCache, setFeatureCache] = useState<FeatureCache>({});
  const [currentTextHash, setCurrentTextHash] = useState<string>('');

  const pdfViewerRef = useRef<PDFViewerRef>(null);

  // Helper function to create unique hash for selected text + document
function safeBase64Encode(str: string): string {
  // Handles any Unicode and emoji. Works in all browsers.
  return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, p1) =>
    String.fromCharCode(parseInt(p1, 16))
  ));
}

const createTextHash = (text: string, document: string): string => {
  const toHash = `${text.slice(0, 100)}_${document}`;
  return safeBase64Encode(toHash).replace(/[^a-zA-Z0-9]/g, '');
};

  // Load existing documents on component mount
  useEffect(() => { loadDocuments(); }, []);
  const loadDocuments = async () => {
    try {
      setIsLoading(true);
      setApiError(null);
      const response = await apiService.listPDFs();
      if (response.success) {
        setDocuments(response.pdfs);
        if (response.pdfs.length > 0 && !selectedDocument) {
          setSelectedDocument(response.pdfs[0]);
        }
      }
    } catch (error) {
      setApiError(`Failed to load documents: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDocumentsUploaded = (newDocuments: PDFDocument[]) => {
    setDocuments(prev => [...prev, ...newDocuments]);
    if (newDocuments.length > 0) setSelectedDocument(newDocuments[0]);
    setApiError(null);
    setTimeout(loadDocuments, 1000);
  };

  const handleDocumentSelect = (document: PDFDocument) => {
    setSelectedDocument(document);
    clearSelection();
    setActiveFeature('relevant');
    setProcessingResults(null);

    // PHASE 4 ADDITION: Clear relevant results when switching docs
    setRelevantResults(null);
    setLastRelevantSelection(null);

    // NEW: Clear cache when switching documents
    setFeatureCache({});
    setCurrentTextHash('');
  };
  

  const handleTextSelection = (text: string, coordinates?: any) => {
    setSelectedText(text);
    setSelectedCoords(coordinates);

    // NEW: Create hash for this selection and check cache
    const textHash = createTextHash(text, selectedDocument?.filename || '');
    setCurrentTextHash(textHash);
    
    // Check if we have cached results for this exact selection
    const cached = featureCache[textHash];
    if (cached && cached[activeFeature]) {
      setProcessingResults(cached[activeFeature]);
    } else {
      setProcessingResults(null);
    }

    // PHASE 4 ADDITION: Clear relevant results when changing selection
    setRelevantResults(null);
    setLastRelevantSelection(null);
  };

  const handleGetSelection = () => {
    if (pdfViewerRef.current?.getSelectedText) {
      pdfViewerRef.current.getSelectedText();
    } else {
      const browserSelection = window.getSelection();
      if (browserSelection && browserSelection.toString().trim()) {
        const text = browserSelection.toString().trim();
        handleTextSelection(text);
      } else {
        alert('Please select some text in the PDF first, then click "Get Selection"');
      }
    }
  };

  const handleConfirmSelection = () => {
    if (!selectedText) {
      alert('No text selected. Please select text first.');
      return;
    }

    console.log('✅ Confirming selection and resetting session');
    
    // Reset previous results for clean session
    setProcessingResults(null);
    setRelevantResults(null);
    setLastRelevantSelection(null);
    
    // Show feature selection popup
    const position = {
      x: window.innerWidth / 2,
      y: window.innerHeight / 3
    };
    setSelectionPosition(position);
    setShowSelectionPopup(true);
  };

  const clearSelection = () => {
    setSelectedText('');
    setSelectedCoords(null);
    setShowSelectionPopup(false);
    setSelectionPosition(null);

    // PHASE 4 ADDITION
    setRelevantResults(null);
    setLastRelevantSelection(null);

    // NEW: Clear current text hash but keep cache for other selections
    setCurrentTextHash('');
    setProcessingResults(null);
  };

  const handleFeatureSelectFromPopup = async (feature: FeatureType) => {
    setShowSelectionPopup(false);
    setActiveFeature(feature);
    await processFeatureWithRelevantSection(feature);
  };

  // PHASE 4 ADDITION: helper to check if relevant output matches current selection
  function isRelevantSectionCurrent() {
    return (
      relevantResults &&
      lastRelevantSelection &&
      selectedText === lastRelevantSelection.text &&
      selectedDocument?.filename === lastRelevantSelection.doc
    );
  }

  // PHASE 4: Universal feature handler with NEW caching
  const handleFeatureSelect = async (feature: FeatureType) => {
    setActiveFeature(feature);
    
    if (selectedText) {
      const textHash = createTextHash(selectedText, selectedDocument?.filename || '');
      const cached = featureCache[textHash];
      
      // NEW: Use cached result if available
      if (cached && cached[feature]) {
        console.log(`✅ Loading cached ${feature} result`);
        setProcessingResults(cached[feature]);
        return;
      }
      
      // Otherwise generate it
      await processFeatureWithRelevantSection(feature);
    }
  };

  // PHASE 4: One feature-processing pipeline for all 4 with NEW caching
  const processFeatureWithRelevantSection = async (feature: FeatureType) => {
    if (!selectedText || !selectedDocument) {
      alert('Please select text in a PDF before running this feature.');
      return;
    }

    const textHash = createTextHash(selectedText, selectedDocument.filename);
    
    // NEW: Check if we already have this feature cached
    const cached = featureCache[textHash];
    if (cached && cached[feature]) {
      console.log(`✅ Using cached ${feature} result`);
      setProcessingResults(cached[feature]);
      return;
    }

    setIsProcessing(true);
    setApiError(null);

    let relevantSections = relevantResults;
    if (!isRelevantSectionCurrent()) {
      // Always ensure relevant extraction for current selection
      try {
        const relevantResp = await apiService.processSelection({
          text: selectedText,
          sourceDocument: selectedDocument.filename,
          pageNumber: 1 // Change as needed if you add page handling
        });
        relevantSections = relevantResp.results?.extracted_sections || [];
        setRelevantResults(relevantSections);
        setLastRelevantSelection({ text: selectedText, doc: selectedDocument.filename });

        // NEW: Cache relevant sections too
        setFeatureCache(prev => ({
          ...prev,
          [textHash]: {
            ...prev[textHash],
            relevant: { extracted_sections: relevantSections }
          }
        }));
      } catch (error) {
        setApiError(`Failed to extract relevant sections: ${error instanceof Error ? error.message : error}`);
        setIsProcessing(false);
        return;
      }
    }

    // Run other AI features if requested (always after relevant extraction)
    let response: any = null;
    try {
      if (feature === 'insights') {
        response = await apiService.generateInsights({
          text: selectedText,
          sections: relevantSections,
          doc: selectedDocument.filename,
          page: 1 // update if needed
        });
      } else if (feature === 'summary') {
        response = await apiService.generateSummary({
          text: selectedText,
          sections: relevantSections,
          doc: selectedDocument.filename,
          page: 1 // update if needed
        });
      } else if (feature === 'podcast') {
        response = await apiService.generatePodcast({
          text: selectedText,
          sections: relevantSections,
          doc: selectedDocument.filename,
          page: 1 // update if needed
        });
      } else if (feature === 'relevant') {
        response = { extracted_sections: relevantSections };
      }

      // NEW: Cache the result
      setFeatureCache(prev => ({
        ...prev,
        [textHash]: {
          ...prev[textHash],
          [feature]: response
        }
      }));

      setProcessingResults(response);
      console.log(`✅ Cached ${feature} result for future use`);

    } catch (error) {
      setApiError(`Feature failed: ${error instanceof Error ? error.message : error}`);
    }
    setIsProcessing(false);
  };
  const handleDeleteDocument = async (filename: string) => {
  try {
    const response = await apiService.deletePDF(filename);
    
    if (response.success) {
      // Remove from documents list
      setDocuments(prev => prev.filter(doc => doc.filename !== filename));
      
      // Clear selection if deleted file was selected
      if (selectedDocument?.filename === filename) {
        setSelectedDocument(documents.length > 1 ? documents.find(d => d.filename !== filename) || null : null);
        clearSelection();
        setFeatureCache({}); // Clear cache
        setCurrentTextHash('');
      }
      
      console.log(`✅ ${response.message}`);
    }
  } catch (error) {
    console.error('Delete failed:', error);
    alert(`Failed to delete ${filename}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

  const handleJumpToSection = async ({ document: targetDoc, pageNumber, quadPoints }: { document?: string; pageNumber: number; quadPoints?: number[] }) => {
    console.log('🔗 Jump to section requested:', { targetDoc, pageNumber, quadPoints });

    // Switch document if needed
    if (targetDoc && targetDoc !== selectedDocument?.filename) {
      // Normalize and try multiple matching strategies
      const normalize = (s: string) => s.replace(/\\/g, '/');
      const baseName = (s: string) => {
        const norm = normalize(s);
        const last = norm.split('/').pop() || norm;
        return last.toLowerCase();
      };
      const want = baseName(targetDoc);

      let match = documents.find(d => d.filename === targetDoc)
        || documents.find(d => d.filename.toLowerCase() === targetDoc.toLowerCase())
        || documents.find(d => baseName(d.filename) === want);
      if (match) {
        console.log('📄 Switching document before jump:', { from: selectedDocument?.filename, to: match.filename });
        setSelectedDocument(match);
        await new Promise(res => setTimeout(res, 900));
      } else {
        console.warn('⚠️ Target document not found:', targetDoc);
      }
    }

    const tryNavigate = async (attempt = 0): Promise<void> => {
      if (!pdfViewerRef.current) {
        console.error('❌ PDF viewer ref is not available');
        return;
      }
      try {
        if (pdfViewerRef.current.gotoLocationAndHighlight) {
          console.log('🎯 Using gotoLocationAndHighlight method');
          pdfViewerRef.current.gotoLocationAndHighlight(pageNumber, quadPoints);
        } else if (pdfViewerRef.current.gotoLocation) {
          console.log('🎯 Using gotoLocation method as fallback');
          pdfViewerRef.current.gotoLocation(pageNumber, 0, 0);
        } else {
          console.warn('⚠️ No PDF viewer methods available');
        }
      } catch (e) {
        if (attempt < 3) {
          console.log('⏳ Viewer not ready, retrying jump...', { attempt: attempt + 1 });
          await new Promise(res => setTimeout(res, 400));
          return tryNavigate(attempt + 1);
        }
        console.error('❌ Failed to navigate to target after retries:', e);
      }
    };

    await tryNavigate(0);
  };

  const handleCloseSelectionPopup = () => setShowSelectionPopup(false);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header and Status: unchanged */}
      <header className="px-8 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="/Adobe.png"
              alt="Adobe"
              className="h-7 w-7 select-none"
              draggable={false}
            />
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Adobe PDF Intel</h1>
          </div>
        </div>
      </header>

      {/* Main Layout - full viewport height below header */}
      <div className="flex-1 px-6 pb-0">
        <div className="grid grid-cols-12 gap-4 h-[calc(100vh-64px)] min-h-0">
          {/* Sources Panel (Left) */}
          <div className="col-span-3 h-full min-h-0">
            <div className="bg-white rounded-xl shadow-sm ring-1 ring-slate-200 p-4 h-full overflow-hidden min-h-0">
              <SourcesPanel
                documents={documents}
                selectedDocument={selectedDocument}
                onDocumentSelect={handleDocumentSelect}
                onDocumentsUploaded={handleDocumentsUploaded}
                isLoading={isLoading}
                onDeleteDocument={handleDeleteDocument}
              />
            </div>
          </div>

          {/* PDF Viewer (Center) */}
          <div className="col-span-6 h-full min-h-0 min-w-0">
            <div className="bg-white rounded-xl shadow-sm ring-1 ring-slate-200 h-full flex flex-col min-h-0 min-w-0">
              <div className="px-4 py-3 border-b border-slate-200">
                <h2 className="text-base font-medium text-slate-900">PDF Viewer</h2>
                {selectedDocument && (
                  <p className="text-xs text-slate-500 mt-1 truncate">{selectedDocument.filename}</p>
                )}
              </div>
              <div className="px-4 py-2 border-b border-slate-200">
                <TextSelectionHelper
                  onGetSelection={handleGetSelection}
                  hasSelectedText={!!selectedText}
                  selectedTextLength={selectedText.length}
                  onClearSelection={clearSelection}
                />
              </div>
              <div className="flex-1 relative overflow-hidden min-h-0 min-w-0">
                <PDFViewer
                  ref={pdfViewerRef}
                  document={selectedDocument}
                  onTextSelection={handleTextSelection}
                  className="h-full"
                />
                {showSelectionPopup && selectionPosition && (
                  <TextSelectionPopup
                    selectedText={selectedText}
                    position={selectionPosition}
                    onClose={handleCloseSelectionPopup}
                    onFeatureSelect={handleFeatureSelectFromPopup}
                    isProcessing={isProcessing}
                  />
                )}
              </div>
              {selectedText && !showSelectionPopup && (
                <div className="border-t border-slate-200 p-4">
                  <SelectedTextPanel
                    selectedText={selectedText}
                    sourceDocument={selectedDocument?.filename}
                    onClear={clearSelection}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Features Panel (Right) */}
          <div className="col-span-3 h-full min-h-0">
            <div className="bg-white rounded-xl shadow-sm ring-1 ring-slate-200 p-4 h-full overflow-hidden min-h-0">
              <FeaturesPanel
                activeFeature={activeFeature}
                onFeatureSelect={handleFeatureSelect}
                hasSelectedText={!!selectedText}
                isProcessing={isProcessing}
                processingResults={processingResults}
                onJumpToSection={handleJumpToSection}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
