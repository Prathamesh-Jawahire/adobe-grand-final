'use client';

import React from 'react';
import { Copy, X } from 'lucide-react';
import Button from './ui/Button';
import Card from './ui/Card';

interface SelectedTextPanelProps {
  selectedText: string;
  sourceDocument?: string;
  onClear: () => void;
}

const SelectedTextPanel: React.FC<SelectedTextPanelProps> = ({
  selectedText,
  sourceDocument,
  onClear
}) => {
  const copyToClipboard = () => {
    navigator.clipboard.writeText(selectedText);
    // You could add a toast notification here
    console.log('Text copied to clipboard');
  };

  if (!selectedText) return null;

  return (
    <Card className="bg-blue-50 border-l-4 border-blue-500">
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="text-blue-900 font-medium">Selected Text</h3>
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={copyToClipboard}
              className="h-8 w-8 p-0 text-blue-600 hover:text-blue-800"
            >
              <Copy className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClear}
              className="h-8 w-8 p-0 text-blue-600 hover:text-blue-800"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Selected text content */}
        <div className="bg-white p-3 rounded border border-blue-200">
          <p className="text-gray-700 text-sm italic leading-relaxed">
            "{selectedText}"
          </p>
        </div>

        {/* Metadata */}
        <div className="flex items-center justify-between text-xs text-blue-600">
          <span>{selectedText.length} characters selected</span>
          {sourceDocument && (
            <span>From: {sourceDocument.replace('.pdf', '')}</span>
          )}
        </div>
      </div>
    </Card>
  );
};

export default SelectedTextPanel;
