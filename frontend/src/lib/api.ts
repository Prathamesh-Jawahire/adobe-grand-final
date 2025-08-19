import { PDFDocument, SelectedText, ProcessingResult } from './types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';

class ApiService {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  // Upload PDFs to backend
  async uploadPDFs(files: File[]): Promise<{ success: boolean; files: PDFDocument[] }> {
    const formData = new FormData();
    files.forEach(file => formData.append('files', file));

    const response = await fetch(`${this.baseUrl}/api/upload-pdfs`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.statusText}`);
    }

    return response.json();
  }

  // List all PDFs
  async listPDFs(): Promise<{ success: boolean; pdfs: PDFDocument[] }> {
    const response = await fetch(`${this.baseUrl}/api/list-pdfs`);
    
    if (!response.ok) {
      throw new Error(`Failed to list PDFs: ${response.statusText}`);
    }

    return response.json();
  }

  // Get PDF file URL for Adobe Embed API
  getPDFUrl(filename: string): string {
    return `${this.baseUrl}/api/get-pdf/${encodeURIComponent(filename)}`;
  }

  // Process selected text through test_automatic.py
  async processSelection(selection: SelectedText): Promise<ProcessingResult> {
    const response = await fetch(`${this.baseUrl}/api/process-selection`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        selected_text: selection.text,
        source_document: selection.sourceDocument,
        page_number: selection.pageNumber,
      }),
    });

    if (!response.ok) {
      throw new Error(`Processing failed: ${response.statusText}`);
    }

    return response.json();
  }

  // Health check
  async healthCheck(): Promise<{ status: string }> {
    const response = await fetch(`${this.baseUrl}/api/health`);
    return response.json();
  }

  // PHASE 4 ADDITION: Generate AI insights from selected text and relevant sections
  async generateInsights(data: { 
    text: string; 
    sections: any; 
    doc: string; 
    page: number 
  }): Promise<{ success: boolean; insights: string; timestamp: string }> {
    const response = await fetch(`${this.baseUrl}/api/insights/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        selected_text: data.text,
        relevant_sections: data.sections,
        source_document: data.doc,
        page_number: data.page,
      }),
    });

    if (!response.ok) {
      throw new Error(`Insights generation failed: ${response.statusText}`);
    }

    return response.json();
  }

  // PHASE 4 ADDITION: Generate AI summary from selected text and relevant sections
  async generateSummary(data: { 
    text: string; 
    sections: any; 
    doc: string; 
    page: number 
  }): Promise<{ success: boolean; summary: string; key_points: string[]; timestamp: string }> {
    const response = await fetch(`${this.baseUrl}/api/summary/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        selected_text: data.text,
        relevant_sections: data.sections,
        source_document: data.doc,
        page_number: data.page,
      }),
    });

    if (!response.ok) {
      throw new Error(`Summary generation failed: ${response.statusText}`);
    }

    return response.json();
  }

  // PHASE 4 ADDITION: Generate podcast/audio from selected text and relevant sections
  async generatePodcast(data: { 
    text: string; 
    sections: any; 
    doc: string; 
    page: number 
  }): Promise<{ 
    success: boolean; 
    audio_url: string; 
    script: string; 
    timestamp: string;
    error?: string;
  }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/podcast/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          selected_text: data.text,
          relevant_sections: data.sections,
          source_document: data.doc,
          page_number: data.page,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(errorData.error || `Podcast generation failed: ${response.statusText}`);
      }

      return response.json();
    } catch (error) {
      console.error('Podcast generation error:', error);
      throw error;
    }
  }

  // PHASE 4 ADDITION: Get generated audio file URL
  getAudioUrl(filename: string): string {
    return `${this.baseUrl}/api/get-audio/${encodeURIComponent(filename)}`;
  }

  // PHASE 4 ADDITION: Stream audio file for download
  async downloadAudio(filename: string): Promise<Blob> {
    const response = await fetch(`${this.baseUrl}/api/get-audio/${encodeURIComponent(filename)}`);
    
    if (!response.ok) {
      throw new Error(`Audio download failed: ${response.statusText}`);
    }

    return response.blob();
  }

  // PHASE 4 ADDITION: Check podcast generation status
  async checkPodcastStatus(taskId: string): Promise<{ 
    status: 'processing' | 'completed' | 'failed'; 
    audio_url?: string; 
    script?: string; 
    error?: string 
  }> {
    const response = await fetch(`${this.baseUrl}/api/podcast/status/${taskId}`);
    
    if (!response.ok) {
      throw new Error(`Status check failed: ${response.statusText}`);
    }

    return response.json();
  }

  // PHASE 4 ADDITION: Health check for AI services
  async checkAIServices(): Promise<{ 
    llm_available: boolean; 
    tts_available: boolean; 
    azure_tts_available: boolean;
    gemini_available: boolean;
    status: string 
  }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/ai/health`);
      
      if (!response.ok) {
        throw new Error(`AI services check failed: ${response.statusText}`);
      }

      return response.json();
    } catch (error) {
      console.error('AI services check error:', error);
      return {
        llm_available: false,
        tts_available: false,
        azure_tts_available: false,
        gemini_available: false,
        status: 'error'
      };
    }
  }

  // PHASE 4 ADDITION: Get available TTS voices
  async getAvailableVoices(): Promise<{ 
    success: boolean; 
    voices: Array<{ name: string; gender: string; locale: string; }> 
  }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tts/voices`);
      
      if (!response.ok) {
        throw new Error(`Voices fetch failed: ${response.statusText}`);
      }

      return response.json();
    } catch (error) {
      console.error('Voice fetch error:', error);
      return { success: false, voices: [] };
    }
  }

  // PHASE 4 ADDITION: Test TTS with sample text
  async testTTS(text: string = "Hello, this is a test of the text-to-speech service."): Promise<{
    success: boolean;
    audio_url?: string;
    error?: string;
  }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tts/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ test_text: text }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(errorData.error || `TTS test failed: ${response.statusText}`);
      }

      return response.json();
    } catch (error) {
      console.error('TTS test error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  // PHASE 4 ADDITION: Delete generated audio files
  async deleteAudio(filename: string): Promise<{ success: boolean; message: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/delete-audio/${encodeURIComponent(filename)}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error(`Audio deletion failed: ${response.statusText}`);
      }

      return response.json();
    } catch (error) {
      console.error('Audio deletion error:', error);
      return { success: false, message: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  // PHASE 4 ADDITION: Get podcast generation analytics
  async getPodcastAnalytics(): Promise<{
    total_generated: number;
    total_duration: number;
    most_common_topics: string[];
    success_rate: number;
  }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/podcast/analytics`);
      
      if (!response.ok) {
        throw new Error(`Analytics fetch failed: ${response.statusText}`);
      }

      return response.json();
    } catch (error) {
      console.error('Analytics fetch error:', error);
      return {
        total_generated: 0,
        total_duration: 0,
        most_common_topics: [],
        success_rate: 0
      };
    }
  }
  async deletePDF(filename: string): Promise<{ success: boolean; message: string; deleted_files: string[] }> {
  try {
    const response = await fetch(`${this.baseUrl}/api/delete-pdf/${encodeURIComponent(filename)}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: response.statusText }));
      throw new Error(errorData.error || `Deletion failed: ${response.statusText}`);
    }

    return response.json();
  } catch (error) {
    console.error('PDF deletion error:', error);
    throw error;
  }
}
}

export const apiService = new ApiService();
export default ApiService;
