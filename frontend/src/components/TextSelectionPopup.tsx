'use client';

import React from 'react';
import { X, Lightbulb, Sparkles, Mic, FileText } from 'lucide-react';
import Button from './ui/Button';
import Card from './ui/Card';

interface TextSelectionPopupProps {
  selectedText: string;
  position: { x: number; y: number };
  onClose: () => void;
  onFeatureSelect: (feature: 'relevant' | 'insights' | 'podcast' | 'summary') => void;
  isProcessing: boolean;
}

const TextSelectionPopup: React.FC<TextSelectionPopupProps> = ({
  selectedText,
  position,
  onClose,
  onFeatureSelect,
  isProcessing
}) => {
  const features = [
    {
      id: 'relevant' as const,
      name: 'Relevant Section',
      icon: Lightbulb,
      color: 'bg-blue-500 hover:bg-blue-600'
    },
    {
      id: 'insights' as const,
      name: 'Insights',
      icon: Sparkles,
      color: 'bg-purple-500 hover:bg-purple-600'
    },
    {
      id: 'podcast' as const,
      name: 'Podcast Mode',
      icon: Mic,
      color: 'bg-green-500 hover:bg-green-600'
    },
    {
      id: 'summary' as const,
      name: 'Summary',
      icon: FileText,
      color: 'bg-orange-500 hover:bg-orange-600'
    }
  ];

  return (
    <div
      className="fixed z-50 pointer-events-none"
      style={{
        left: position.x,
        top: position.y,
        transform: 'translateX(-50%)'
      }}
    >
      <Card className="pointer-events-auto shadow-2xl border-2 border-blue-200 max-w-sm">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-gray-900">Text Selected</h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-6 w-6 p-0"
            disabled={isProcessing}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Selected text preview */}
        <div className="mb-4 p-2 bg-gray-50 rounded text-xs">
          <p className="text-gray-700 line-clamp-2">
            "{selectedText.length > 100 ? selectedText.substring(0, 100) + '...' : selectedText}"
          </p>
          <p className="text-gray-500 mt-1">{selectedText.length} characters</p>
        </div>

        {/* Feature buttons */}
        <div className="grid grid-cols-2 gap-2">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <Button
                key={feature.id}
                variant="outline"
                onClick={() => onFeatureSelect(feature.id)}
                disabled={isProcessing}
                className={`h-16 flex-col space-y-1 text-xs relative ${
                  isProcessing ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                <Icon className="h-4 w-4" />
                <span className="font-medium">{feature.name}</span>
                
                {/* Processing indicator */}
                {isProcessing && (
                  <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-90 rounded-lg">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                  </div>
                )}
              </Button>
            );
          })}
        </div>

        {/* Processing status */}
        {isProcessing && (
          <div className="mt-3 text-center">
            <p className="text-xs text-gray-600">Processing your selection...</p>
          </div>
        )}
      </Card>
    </div>
  );
};

export default TextSelectionPopup;
