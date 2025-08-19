'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { PDFViewerRef } from '@/lib/types';

interface UseAdobePDFProps {
  onTextSelection?: (selectedText: string, coordinates?: any) => void;
}

declare global {
  interface Window {
    AdobeDC?: any;
  }
}

export const useAdobePDF = ({ onTextSelection }: UseAdobePDFProps) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const viewerRef = useRef<PDFViewerRef | null>(null);
  const adobeViewRef = useRef<any>(null);
  const scriptLoadedRef = useRef(false);

  useEffect(() => {
    const loadAdobeAPI = async () => {
      try {
        if (window.AdobeDC) {
          console.log('✅ Adobe PDF Embed API already loaded');
          setIsLoaded(true);
          return;
        }

        if (scriptLoadedRef.current) {
          console.log('⏳ Adobe script loading in progress...');
          return;
        }

        console.log('🔄 Loading Adobe PDF Embed API from CDN...');
        scriptLoadedRef.current = true;

        const script = document.createElement('script');
        script.src = 'https://documentservices.adobe.com/view-sdk/viewer.js';
        script.async = true;
        script.type = 'text/javascript';

        const scriptPromise = new Promise<void>((resolve, reject) => {
          script.onload = () => {
            console.log('📦 Adobe script loaded from CDN');
            setTimeout(() => {
              if (window.AdobeDC) {
                console.log('✅ Adobe PDF Embed API ready');
                setIsLoaded(true);
                setError(null);
                resolve();
              } else {
                console.error('❌ Adobe DC not available after script load');
                setError('Adobe DC not available after script load');
                reject(new Error('Adobe DC not available'));
              }
            }, 1000);
          };

          script.onerror = (e) => {
            console.error('❌ Failed to load Adobe PDF Embed API from CDN:', e);
            setError('Failed to load Adobe PDF Embed API from CDN');
            scriptLoadedRef.current = false;
            reject(e);
          };
        });

        document.head.appendChild(script);
        await scriptPromise;

      } catch (err) {
        console.error('❌ Error loading Adobe API:', err);
        setError('Error loading Adobe API');
        scriptLoadedRef.current = false;
      }
    };

    loadAdobeAPI();
  }, []);

  // ENHANCED: Proper text selection handling
  const loadPDF = useCallback(async (pdfUrl: string, fileName: string, containerId: string = 'adobe-dc-view') => {
    const clientId = process.env.NEXT_PUBLIC_ADOBE_CLIENT_ID;
    
    console.log('🔄 Starting PDF load process...');
    
    if (!clientId) {
      const errorMsg = 'Adobe Client ID not found in environment variables';
      console.error('❌', errorMsg);
      throw new Error(errorMsg);
    }

    if (!isLoaded || !window.AdobeDC) {
      const errorMsg = 'Adobe PDF API not loaded yet';
      console.error('❌', errorMsg);
      throw new Error(errorMsg);
    }

    try {
      console.log('🔄 Loading PDF with Adobe Embed API:', fileName);
      
      const container = document.getElementById(containerId);
      if (container) {
        container.innerHTML = '';
        console.log('🧹 Cleared previous PDF viewer');
      } else {
        throw new Error(`Container ${containerId} not found`);
      }

      const adobeDCView = new window.AdobeDC.View({
        clientId: clientId,
        divId: containerId,
      });

      adobeViewRef.current = adobeDCView;

      // ENHANCED: Viewer configuration to disable default text actions
      const viewerConfig = {
        embedMode: 'SIZED_CONTAINER',
        showAnnotationTools: false,
        showLeftHandPanel: false,
        showDownloadPDF: false,
        showPrintPDF: false,
        showZoomControl: true,
        defaultViewMode: 'FIT_WIDTH',
        enableFormFilling: false,
        showPageControls: true,
        dockPageControls: false,
        // DISABLE default text selection menu
        enableLinearization: false,
        includePDFAnnotations: false
      };

      console.log('⚙️ PDF Viewer Config:', viewerConfig);

      const previewFilePromise = adobeDCView.previewFile(
        {
          content: { location: { url: pdfUrl } },
          metaData: { fileName: fileName, id: `pdf-${Date.now()}` }
        },
        viewerConfig
      );

      console.log('📄 Starting PDF preview...');

      previewFilePromise.then((adobeViewer: any) => {
        console.log('✅ PDF loaded successfully in Adobe viewer');

        adobeViewer.getAPIs().then((apis: any) => {
          console.log('🔌 Adobe APIs retrieved successfully');

          // ENHANCED: Multiple callback registrations for better text selection detection
          try {
            // Register text selection end callback
            apis.registerCallback(
              window.AdobeDC.View.Enum.CallbackType.SELECTION_END,
              (event: any) => {
                console.log('📝 SELECTION_END detected:', event);
                handleTextSelectionEvent(apis);
              },
              {}
            );

            // Also register for text selection change
            apis.registerCallback(
              window.AdobeDC.View.Enum.CallbackType.SELECTION_CHANGE,
              (event: any) => {
                console.log('📝 SELECTION_CHANGE detected:', event);
                // Delay to ensure selection is complete
                setTimeout(() => {
                  handleTextSelectionEvent(apis);
                }, 100);
              },
              {}
            );

            console.log('🎯 Text selection callbacks registered');
          } catch (callbackError) {
            console.warn('⚠️ Could not register selection callback:', callbackError);
          }

          // Store APIs reference
          viewerRef.current = {
            gotoLocation: async (pageNumber: number, x = 0, y = 0) => {
              try {
                console.log(`🧭 Navigating to page ${pageNumber} (0-based index)`);
                if (!apis || !apis.gotoLocation) {
                  console.error('❌ Adobe APIs not ready or gotoLocation not available');
                  return;
                }
                await apis.gotoLocation(pageNumber, x, y);
                console.log(`✅ Successfully navigated to page ${pageNumber}`);
              } catch (err) {
                console.error('❌ Navigation failed:', err);
                throw err;
              }
            },
            getAPIs: () => apis,
            // getSelectedText: () => handleTextSelectionEvent(apis), // NEW: Manual selection getter
            highlightText: (quadPoints: number[], pageNumber: number) => {
              console.log('🖍️ Highlighting text:', { quadPoints, pageNumber });
            }
          };

          console.log('🎉 Adobe PDF viewer setup completed successfully');
        }).catch((apiError: any) => {
          console.error('❌ Failed to get Adobe APIs:', apiError);
          throw apiError;
        });
      }).catch((previewError: any) => {
        console.error('❌ Failed to preview PDF:', previewError);
        throw previewError;
      });

      // ENHANCED: Helper function to handle text selection
      const handleTextSelectionEvent = async (apis: any) => {
        try {
          console.log('🔍 Getting selected content...');
          const content = await apis.getSelectedContent();
          console.log('📋 Raw selected content:', content);

          if (content && content.data && onTextSelection) {
            let selectedText = '';
            
            // Handle different content formats
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

            console.log('✂️ Extracted selected text:', selectedText);

            if (selectedText && selectedText.length > 0) {
              onTextSelection(selectedText, content);
            } else {
              console.log('⚠️ No text content found in selection');
            }
          } else {
            console.log('⚠️ No selection data available');
          }
        } catch (err) {
          console.warn('⚠️ Failed to get selected content:', err);
        }
      };

      return previewFilePromise;
    } catch (err) {
      console.error('❌ Error in loadPDF function:', err);
      throw err;
    }
  }, [isLoaded, onTextSelection]);

  return {
    isLoaded,
    error,
    loadPDF,
    viewer: viewerRef.current,
    adobeView: adobeViewRef.current,
  };
};
