'use client';

import React from 'react';
import { FileText, X } from 'lucide-react';
import Button from './ui/Button';

interface TextSelectionHelperProps {
  onGetSelection: () => void;
  hasSelectedText: boolean;
  selectedTextLength: number;
  onClearSelection: () => void;
  // Remove onConfirmSelection - not needed anymore
}

const TextSelectionHelper: React.FC<TextSelectionHelperProps> = ({
  onGetSelection,
  hasSelectedText,
  selectedTextLength,
  onClearSelection
}) => {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center space-x-3">
          <Button
            onClick={onGetSelection}
            variant="primary" // or remove if your default is blue
            size="sm"
            className="flex items-center space-x-2 bg-blue-600 text-white hover:bg-blue-700 transition"
          >
            <FileText className="h-4 w-4" />
            <span>Get Selection</span>
          </Button>

        
        {hasSelectedText && (
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
            <span>{selectedTextLength} characters selected</span>
          </div>
        )}
      </div>

      {hasSelectedText && (
        <Button
          onClick={onClearSelection}
          variant="ghost"
          size="sm"
          className="text-gray-500 hover:text-gray-700"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
};

export default TextSelectionHelper;
