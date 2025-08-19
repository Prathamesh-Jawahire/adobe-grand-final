'use client';

import React from 'react';
import { Lightbulb, Mic, FileText, Sparkles, ExternalLink, BookOpen, Play, Pause } from 'lucide-react';
import Button from './ui/Button';
import Card from './ui/Card';
import { FeatureType } from '@/lib/types';

interface FeaturesPanelProps {
  activeFeature: FeatureType;
  onFeatureSelect: (feature: FeatureType) => Promise<void> | void;
  hasSelectedText: boolean;
  isProcessing: boolean;
  processingResults?: any;
  onJumpToSection?: (args: { document?: string; pageNumber: number; quadPoints?: number[] }) => void;
}

const FeaturesPanel: React.FC<FeaturesPanelProps> = ({
  activeFeature,
  onFeatureSelect,
  hasSelectedText,
  isProcessing,
  processingResults,
  onJumpToSection
}) => {

  // Podcast player state (kept outside conditional rendering to respect hook rules)
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = React.useState(false);
  const audioUrl: string | undefined = processingResults?.audio_url
    ? `${process.env.NEXT_PUBLIC_API_BASE_URL}${processingResults.audio_url}`
    : undefined;

  React.useEffect(() => {
    // Reset player when new audio is generated or cleared
    setIsPlaying(false);
    if (audioRef.current) {
      try {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      } catch {}
    }
  }, [audioUrl]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    }
  };

  const features = [
    {
      id: 'relevant' as FeatureType,
      name: 'Relevant Section',
      icon: Lightbulb,
      description: 'Find related sections across documents',
      disabled: !hasSelectedText
    },
    {
      id: 'insights' as FeatureType,
      name: 'Insights',
      icon: Sparkles,
      description: 'AI-powered analysis and insights',
      disabled: !hasSelectedText
    },
    {
      id: 'podcast' as FeatureType,
      name: 'Podcast Mode',
      icon: Mic,
      description: 'Generate audio summary',
      disabled: !hasSelectedText
    },
    {
      id: 'summary' as FeatureType,
      name: 'Summary',
      icon: FileText,
      description: 'Concise text summary',
      disabled: !hasSelectedText
    }
  ];

  const handleFeatureClick = async (feature: FeatureType) => {
    if (features.find(f => f.id === feature)?.disabled) return;
    await onFeatureSelect(feature);
  };

  const handleJumpToSection = (section: any) => {
    const pageNumber = (section.page_number ?? 0) + 2; // +1 to correct off-by-one
    console.log('🔍 Section data for jump:', {
      original_page: section.page_number,
      calculated_page: pageNumber,
      quad_points: section.quad_points,
      section_title: section.section_title || section.title,
      document: section.document
    });
    if (onJumpToSection) {
      onJumpToSection({
        document: section.document,
        pageNumber,
        quadPoints: section.quad_points
      });
    }
  };

  const renderInsightCards = (insightText: string) => {
    if (!insightText || insightText.trim() === '') {
      return (
        <div className="text-center py-8">
          <Sparkles className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No insights available.</p>
        </div>
      );
    }
    
    const allParagraphs: string[] = insightText.split('\n\n').filter(p => p.trim().length > 20);
  
    const getContent = (index: number): string => {
      return allParagraphs[index] || '';
    };
    
    const getExtraContent = (): string => {
      if (allParagraphs.length > 3) {
        return allParagraphs.slice(3).join('\n\n');
      }
      return '';
    };

const cards: Array<{title: string; content: string; color: 'blue' | 'red' | 'green' | 'purple'; icon: string}> = [
  {
    title: 'Do you know?',
    content: getContent(0) || 'No specific facts available.',
    color: 'blue',
    icon: '💡'
  },
  {
    title: 'Contradictory viewpoints',
    content: getContent(1) || 'No contradictory viewpoints identified.',
    color: 'red',
    icon: '⚖️'
  },
  {
    title: 'Examples',
    content: getContent(2) || 'No specific examples provided.',
    color: 'green',
    icon: '📝'
  },
  {
    title: 'Other insights',
    content: getContent(3) || getExtraContent() || 'Additional analysis pending.',
    color: 'purple',
    icon: '🔍'
  }
];
    const colorClasses = {
      blue: 'border-blue-500 bg-blue-50 text-blue-700',
      red: 'border-red-500 bg-red-50 text-red-700',
      green: 'border-green-500 bg-green-50 text-green-700',
      purple: 'border-purple-500 bg-purple-50 text-purple-700'
    };

    return (
      <div className="space-y-4">
        <div className="flex items-center space-x-2 mb-4">
          <Sparkles className="h-5 w-5 text-purple-500" />
          <h3 className="font-semibold text-gray-900">AI Insights</h3>
        </div>
        {cards.map((card, idx) => (
          <Card key={idx} className={`border-l-4 ${colorClasses[card.color]} p-4`}>  
            <div className="flex items-center space-x-2 mb-3">
              <span className="text-lg">{card.icon}</span>
              <h4 className="font-semibold">{card.title}</h4>
            </div>
            <p className="text-gray-800 whitespace-pre-line leading-relaxed">
              {card.content}
            </p>
          </Card>
        ))}
      </div>
    );
  };

  // Compact podcast control card below the feature buttons
  const renderPodcastTopCard = () => {
    const isGenerating = !audioUrl || isProcessing;
    return (
      <Card className="p-3 mb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="h-9 w-9 rounded-md bg-green-50 flex items-center justify-center">
              <Mic className="h-4 w-4 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-900">Podcast</p>
              <p className="text-xs text-slate-500">AI generated conversation</p>
            </div>
          </div>

          {isGenerating ? (
            <button
              type="button"
              disabled
              className="inline-flex items-center px-3 py-1.5 rounded-md bg-slate-200 text-slate-600 text-xs"
              title="Generating..."
            >
              <span className="animate-spin rounded-full h-3 w-3 border-b-2 border-slate-600 mr-2" />
              Generating
            </button>
          ) : (
            <button
              type="button"
              onClick={togglePlay}
              className="inline-flex items-center px-3 py-1.5 rounded-md bg-green-600 hover:bg-green-700 text-white text-xs"
            >
              {isPlaying ? (
                <>
                  <Pause className="h-3 w-3 mr-2" />
                  Pause
                </>
              ) : (
                <>
                  <Play className="h-3 w-3 mr-2" />
                  Play
                </>
              )}
            </button>
          )}
        </div>
        <audio ref={audioRef} src={audioUrl} onEnded={() => setIsPlaying(false)} className="hidden" />
      </Card>
    );
  };

  const renderSummary = (summaryData: any) => {
    const summaryText = typeof summaryData.summary === 'string' ? summaryData.summary : String(summaryData.summary);
    const keyPoints = Array.isArray(summaryData.key_points) ? summaryData.key_points : [];
    return (
      <div className="space-y-4">
        <div className="flex items-center space-x-2 mb-4">
          <FileText className="h-5 w-5 text-orange-500" />
          <h3 className="font-semibold text-gray-900">Summary</h3>
        </div>
        <Card className="border-l-4 border-orange-500 bg-orange-50 p-4">
          <p className="text-gray-800 whitespace-pre-line leading-relaxed mb-4">{summaryText}</p>
          {keyPoints.length > 0 && (
            <div>
              <h4 className="font-semibold text-orange-700 mb-2">Key Points:</h4>
              <ul className="space-y-2 ml-5 text-gray-700 list-disc"> 
                {keyPoints.map((point: string, i: number) => (
                  <li key={i}>{point}</li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      </div>
    );
  };

  const renderRelevantSections = (sections: any[]) => {
    return (
      <div className="flex flex-col h-full">
        <div className="flex-shrink-0 pb-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Lightbulb className="h-5 w-5 text-blue-500" />
              <h3 className="font-semibold text-gray-900">Relevant Sections</h3>
            </div>
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
              {sections.length} found
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1">Click any card to jump and highlight in PDF</p>
        </div>
        <div className="flex-1 overflow-y-auto mt-4 pr-2 space-y-3" style={{ minHeight: 0 }}>
          {sections.map((section: any, index: number) => {
            const displayPageNumber = (section.page_number ?? 0) + 1;
            const documentName = (section.document || 'Unknown Document').replace('.pdf', '');
            const sectionTitle = section.section_title || section.title || 'Untitled Section';
            const summary = section.summary_of_paragraph_under_section || section.summary || 'No summary available';
            const rank = section.importance_rank || index + 1;

            return (
              <Card 
                key={index} 
                className="border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all duration-200 cursor-pointer group"
                onClick={() => {
                  console.log('🖱️ Card clicked for section:', {
                    index,
                    section_title: section.section_title || section.title,
                    page_number: section.page_number,
                    document: section.document
                  });
                  handleJumpToSection(section);
                }}
              >
                <div className="p-3 space-y-3">
                  <div className="space-y-2">
                    <div className="flex items-start justify-between">
                      <h4 className="font-semibold text-gray-900 text-sm leading-tight group-hover:text-blue-700 transition-colors flex-1 pr-2">
                        {sectionTitle}
                      </h4>
                      <span className="text-xs bg-gradient-to-r from-blue-500 to-blue-600 text-white px-2 py-1 rounded-full font-medium flex-shrink-0">
                        #{rank}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2 text-xs text-gray-600">
                      <BookOpen className="h-3 w-3 text-gray-400 flex-shrink-0" />
                      <span className="font-medium truncate">{documentName}</span>
                      <span className="text-gray-400">•</span>
                      <span className="flex-shrink-0">Page {displayPageNumber}</span>
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-sm text-gray-700 leading-relaxed">
                      {summary.length > 200 ? `${summary.substring(0, 200)}...` : summary}
                    </p>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center space-x-2 text-gray-500">
                      {section.quad_points && section.quad_points.length === 8 ? (
                        <>
                          <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                          <span>Will highlight</span>
                        </>
                      ) : (
                        <>
                          <div className="w-2 h-2 bg-yellow-400 rounded-full"></div>
                          <span>Jump only</span>
                        </>
                      )}
                    </div>
                    <button
                      type="button"
                      className="flex items-center px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleJumpToSection(section);
                      }}
                      aria-label="Click to view section"
                    >
                      <ExternalLink className="h-3 w-3 mr-1" />
                      Click to view
                    </button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    );
  };

  const renderResults = () => {
  if (!processingResults) return null;

  if (activeFeature === 'relevant') {
    let sections = [];
    if (processingResults.results?.extracted_sections) {
      sections = processingResults.results.extracted_sections;
    } else if (processingResults.extracted_sections) {
      sections = processingResults.extracted_sections;
    } else if (Array.isArray(processingResults)) {
      sections = processingResults;
    }

    if (sections && sections.length > 0) {
      return renderRelevantSections(sections);
    }

    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Lightbulb className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 font-medium">No relevant sections found</p>
        </div>
      </div>
    );
  }

  if (activeFeature === 'insights') {
    return (
      <div className="flex flex-col h-full">
        {/* <div className="flex-shrink-0 pb-2 border-b border-gray-200">
          <div className="flex items-center space-x-2">
            <Sparkles className="h-5 w-5 text-purple-500" />
            <h3 className="font-semibold text-gray-900">AI Insights</h3>
          </div>
        </div> */}
        <div className="flex-1 overflow-y-auto py-4 space-y-4 min-h-0">
          {renderInsightCards(processingResults.insights || '')}
        </div>
      </div>
    );
  }

  if (activeFeature === 'summary') {
    return (
      <div className="flex flex-col h-full">
        {/* <div className="flex-shrink-0 pb-2 border-b border-gray-200">
          <div className="flex items-center space-x-2">
            <FileText className="h-5 w-5 text-orange-500" />
            <h3 className="font-semibold text-gray-900">Summary</h3>
          </div>
        </div> */}
        <div className="flex-1 overflow-y-auto py-4 min-h-0">
          {renderSummary(processingResults)}
        </div>
      </div>
    );
  }

  if (activeFeature === 'podcast') {
    // Do not render large body content; the compact card will be shown below the feature grid.
    return null;
  }

    return null;
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex-shrink-0 mb-4">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Features</h2>
        <p className="text-sm text-gray-500">
          {hasSelectedText ? 'Processing available' : 'Select text in PDF to enable features'}
        </p>
      </div>

      <div className="flex-shrink-0 grid grid-cols-2 gap-3 mb-4">
        {features.map((feature) => {
          const Icon = feature.icon;
          const isActive = activeFeature === feature.id;
          const isDisabled = feature.disabled;

          return (
            <Button
              key={feature.id}
              variant={isActive ? 'primary' : 'outline'}
              className={`h-16 flex-col space-y-1 text-xs relative ${
                isDisabled ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              onClick={() => handleFeatureClick(feature.id)}
              disabled={isDisabled}
            >
              <Icon className="h-4 w-4" />
              <span className="font-medium">{feature.name}</span>

              {isProcessing && isActive && (
                <div className="absolute inset-0 flex items-center justify-center bg-blue-600 bg-opacity-90 rounded-lg">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                </div>
              )}
            </Button>
          );
        })}
      </div>

      {activeFeature === 'podcast' && (
        <div className="flex-shrink-0">
          {renderPodcastTopCard()}
        </div>
      )}

      <div className="flex-1 min-h-0">
        <Card className="h-full">
          <div className="h-full p-4">
            {!hasSelectedText ? (
              <div className="flex items-center justify-center h-full text-center">
                <div>
                  <div className="text-6xl mb-4">📄</div>
                  <p className="text-gray-600 font-medium">No text selected</p>
                  <p className="text-sm text-gray-500 mt-2">
                    Select text in the PDF viewer to see relevant sections and analysis
                  </p>
                </div>
              </div>
            ) : isProcessing && !processingResults ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-3"></div>
                  <p className="text-gray-600">
                    {activeFeature === 'relevant' && 'Finding relevant sections...'}
                    {activeFeature === 'insights' && 'Generating AI insights...'}
                    {activeFeature === 'podcast' && 'Creating podcast...'}
                    {activeFeature === 'summary' && 'Generating summary...'}
                  </p>
                </div>
              </div>
            ) : processingResults ? (
              renderResults()
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center text-gray-500">
                  <p>Click "{features.find(f => f.id === activeFeature)?.name}" to start</p>
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default FeaturesPanel;
