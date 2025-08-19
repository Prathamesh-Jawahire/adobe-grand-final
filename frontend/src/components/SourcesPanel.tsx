'use client';

import React, { useState } from 'react';
import { FileText, Trash2 } from 'lucide-react';
import { PDFDocument } from '@/lib/types';
import UploadArea from './UploadArea';

interface SourcesPanelProps {
  documents: PDFDocument[];
  selectedDocument: PDFDocument | null;
  onDocumentSelect: (document: PDFDocument) => void;
  onDocumentsUploaded: (documents: PDFDocument[]) => void;
  isLoading: boolean;
  onDeleteDocument: (filename: string) => Promise<void>;
}

const SourcesPanel: React.FC<SourcesPanelProps> = ({
  documents,
  selectedDocument,
  onDocumentSelect,
  onDocumentsUploaded,
  isLoading,
  onDeleteDocument
}) => {
  const [deletingFile, setDeletingFile] = useState<string | null>(null);

  const handleDelete = async (filename: string, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent document selection
    
    setDeletingFile(filename);
    try {
      await onDeleteDocument(filename);
    } catch (error) {
      console.error('Delete failed:', error);
    } finally {
      setDeletingFile(null);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-shrink-0 mb-4">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Documents</h2>
        <p className="text-sm text-gray-500">Upload and manage your PDF files</p>
      </div>

      {/* Upload Section */}
      <div className="flex-shrink-0 mb-4">
        <UploadArea
          onUploadComplete={onDocumentsUploaded}
          maxFiles={10}
          maxSize={50 * 1024 * 1024} // 50MB
        />
      </div>

      {/* Documents List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            <span className="ml-2 text-gray-600">Loading documents...</span>
          </div>
        ) : documents.length === 0 ? (
          <div className="text-center py-8">
            <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No documents uploaded</p>
            <p className="text-sm text-gray-400 mt-1">Upload PDF files to get started</p>
          </div>
        ) : (
          <div className="space-y-2">
            {documents.map((doc) => (
              <div
                key={doc.filename}
                className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                  selectedDocument?.filename === doc.filename
                    ? 'bg-blue-50 border-blue-200'
                    : 'bg-white border-gray-200 hover:bg-gray-50'
                }`}
                onClick={() => onDocumentSelect(doc)}
              >
                <div className="flex items-center space-x-3 flex-1 min-w-0">
                  <FileText className="h-5 w-5 text-gray-400 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {doc.filename}
                    </p>
                    <p className="text-xs text-gray-500">
                      {(doc.size / 1024 / 1024).toFixed(1)} MB
                    </p>
                  </div>
                </div>
                
                <button
                  onClick={(e) => handleDelete(doc.filename, e)}
                  disabled={deletingFile === doc.filename}
                  className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors disabled:opacity-50"
                  title="Delete PDF"
                >
                  {deletingFile === doc.filename ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-500"></div>
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SourcesPanel;
