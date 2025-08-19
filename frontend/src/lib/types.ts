// PDF and Document Types
export interface PDFDocument {
  filename: string;
  size: number;
  uploaded?: string;
  path?: string;
}

export interface SelectedText {
  text: string;
  sourceDocument: string;
  pageNumber: number;
  coordinates?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

// Relevant Section Types (from your backend output)
export interface RelevantSection {
  document: string;
  section_title: string;
  importance_rank: number;
  summary_of_paragraph_under_section: string;
  quad_points: number[]; // [x1,y1,x2,y1,x2,y2,x1,y2]
  page_number: number;
}

export interface ProcessingResult {
  success: boolean;
  message: string;
  results: {
    extracted_sections: RelevantSection[];
    highlighting_metadata: {
      highlighting_enabled: boolean;
      coordinate_system: string;
      quad_points_format: string;
    };
  };
  output_file: string;
  selection_data: SelectedText;
}

// Feature Types
export type FeatureType = 'relevant' | 'insights' | 'podcast' | 'summary';

export interface Feature {
  id: FeatureType;
  name: string;
  icon: string;
  description: string;
  active: boolean;
}

// Adobe PDF Embed API Types
export interface AdobePDFConfig {
  clientId: string;
  divId: string;
  url: string;
  fileName: string;
}

export interface PDFViewerRef {
  gotoLocation: (pageNumber: number, x?: number, y?: number) => void;
  getSelectedText?: () => void;
  getAPIs?: () => any;
  highlightText?: (quadPoints: number[], pageNumber: number) => void;
  gotoLocationAndHighlight?: (pageNumber: number, quadPoints?: number[]) => void; // NEW
  showVisualHighlight?: (quadPoints: number[], pageNumber: number) => void; // NEW
  clearHighlights?: () => void; // NEW
  viewer?: any;
}

export interface ProcessSelectionRequest {
  text: string;
  sourceDocument: string;
  pageNumber: number;
}

export interface ProcessSelectionResponse {
  success: boolean;
  message: string;
  results: any;
  output_file: string;
  selection_data: any;
  processing_time: string;
}
