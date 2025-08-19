'use client';

import React from 'react';
import { MousePointer2, Lightbulb } from 'lucide-react';
import Card from './ui/Card';

interface TextSelectionGuideProps {
  hasSelectedText: boolean;
  selectedTextLength?: number;
}

const TextSelectionGuide: React.FC<TextSelectionGuideProps> = ({ 
  hasSelectedText, 
  selectedTextLength = 0 
}) => {
  if (hasSelectedText) {
    return (
      <Card className="bg-green-50 border-green-200 mb-4">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
            <Lightbulb className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-green-800 font-medium">Text Selected!</p>
            <p className="text-green-600 text-sm">
              {selectedTextLength} characters selected. Click any feature button to analyze.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="bg-blue-50 border-blue-200 mb-4">
      <div className="flex items-center space-x-3">
        <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
          <MousePointer2 className="w-4 h-4 text-white" />
        </div>
        <div>
          <p className="text-blue-800 font-medium">How to select text:</p>
          <p className="text-blue-600 text-sm">
            Click and drag across any text in the PDF to select it
          </p>
        </div>
      </div>
    </Card>
  );
};

export default TextSelectionGuide;
