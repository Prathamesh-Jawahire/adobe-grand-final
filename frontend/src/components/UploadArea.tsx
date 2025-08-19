'use client';

import React, { useState } from 'react';
import { Upload, FileText, X, AlertCircle } from 'lucide-react';
import Button from './ui/Button';
import Card from './ui/Card';
import { apiService } from '@/lib/api';
import { PDFDocument } from '@/lib/types';

interface UploadAreaProps {
  onUploadComplete: (files: PDFDocument[]) => void;
  onUploadStart?: () => void;
  maxFiles?: number;
  maxSize?: number; // in bytes
}

const UploadArea: React.FC<UploadAreaProps> = ({
  onUploadComplete,
  onUploadStart,
  maxFiles = 10,
  maxSize = 50 * 1024 * 1024 // 50MB default
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);

  // Simple file input handler
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    console.log('🔄 Files selected:', Array.from(files).map(f => f.name));
    
    setError(null);
    setUploadedFiles(Array.from(files));
    setIsUploading(true);
    onUploadStart?.();

    try {
      setUploadProgress('Preparing files for upload...');
      console.log('📤 Starting upload for files:', Array.from(files).map(f => f.name));
      
      // Upload files to backend
      const result = await apiService.uploadPDFs(Array.from(files));
      
      setUploadProgress('Upload complete! Processing files...');
      console.log('✅ Upload result:', result);
      
      if (result.success) {
        console.log('✅ Files uploaded successfully:', result.files);
        onUploadComplete(result.files);
        setUploadProgress(`Successfully uploaded ${result.files.length} file(s)`);
        
        // Clear progress after 3 seconds
        setTimeout(() => {
          setUploadProgress('');
          setUploadedFiles([]);
        }, 3000);
      } else {
        throw new Error('Upload failed');
      }
    } catch (error) {
      console.error('❌ Upload error:', error);
      setError(error instanceof Error ? error.message : 'Upload failed');
      setUploadedFiles([]);
    } finally {
      setIsUploading(false);
      // Reset file input
      event.target.value = '';
    }
  };

  const removeFile = (fileToRemove: File) => {
    setUploadedFiles(prev => prev.filter(file => file !== fileToRemove));
  };

  return (
    <div className="space-y-4">
      {/* Simple Upload Button */}
      <Card className="border-dashed border-2 border-gray-300 hover:border-gray-400 transition-all duration-200">
        <label className="block text-center py-8 cursor-pointer">
          <input
            type="file"
            multiple
            accept=".pdf"
            onChange={handleFileSelect}
            className="hidden"
            disabled={isUploading}
          />
          
          <div className="flex flex-col items-center space-y-3">
            {isUploading ? (
              <>
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500"></div>
                <p className="text-green-700 font-medium">Uploading PDFs...</p>
                <p className="text-sm text-green-600">{uploadProgress}</p>
              </>
            ) : (
              <>
                <Upload className="h-12 w-12 text-gray-400" />
                <p className="text-gray-700 font-medium">Add PDFs</p>
                <p className="text-sm text-gray-500">
                  Click to select PDF files
                </p>
                <p className="text-xs text-gray-400">
                  Maximum {maxFiles} files, {Math.round(maxSize / (1024 * 1024))}MB each
                </p>
              </>
            )}
          </div>
        </label>
      </Card>

      {/* Error Display */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <div className="flex items-start space-x-3">
            <AlertCircle className="h-5 w-5 text-red-500 mt-0.5" />
            <div className="flex-1">
              <p className="text-red-700 font-medium">Upload Error</p>
              <p className="text-sm text-red-600 whitespace-pre-line">{error}</p>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setError(null)}
              className="text-red-500 hover:text-red-700"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </Card>
      )}

      {/* File List (while uploading) */}
      {uploadedFiles.length > 0 && (
        <Card>
          <h4 className="font-medium text-gray-700 mb-3">Uploading Files:</h4>
          <div className="space-y-2">
            {uploadedFiles.map((file, index) => (
              <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                <div className="flex items-center space-x-2">
                  <FileText className="h-4 w-4 text-gray-500" />
                  <span className="text-sm text-gray-700">{file.name}</span>
                  <span className="text-xs text-gray-500">
                    ({(file.size / (1024 * 1024)).toFixed(1)} MB)
                  </span>
                </div>
                {!isUploading && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeFile(file)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};

export default UploadArea;
