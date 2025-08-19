from fileinput import filename
from fastapi import FastAPI, UploadFile, File, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
from pathlib import Path
load_dotenv(dotenv_path=Path('.') / '.env')
from PyPDF2 import PdfReader, PdfWriter
import io
import os
import shutil
import json
import subprocess
import asyncio
from pathlib import Path
from typing import List
import uuid
from datetime import datetime
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Document Intelligence API", version="1.0.0")

# Enhanced CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://0.0.0.0:3000"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD"],  # Added HEAD
    allow_headers=["*"],
)

# Directory paths
BASE_DIR = Path(__file__).parent
PDF_DIR = BASE_DIR / "data" / "pdfs"
JSON_DIR = BASE_DIR / "data" / "json" 
SELECTED_TEXT_DIR = BASE_DIR / "data" / "selected_text"
OUTPUT_DIR = BASE_DIR / "output"

# Ensure directories exist
for directory in [PDF_DIR, JSON_DIR, SELECTED_TEXT_DIR, OUTPUT_DIR]:
    directory.mkdir(parents=True, exist_ok=True)
    logger.info(f" Directory ensured: {directory}")

# Add preflight OPTIONS handler
@app.options("/{full_path:path}")
async def options_handler(request: Request, full_path: str):
    return JSONResponse(
        content="OK",
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS, HEAD",
            "Access-Control-Allow-Headers": "*",
        }
    )

@app.get("/")
async def root():
    return {
        "message": "Document Intelligence API is running",
        "timestamp": datetime.now().isoformat(),
        "directories": {
            "pdfs": str(PDF_DIR),
            "jsons": str(JSON_DIR),
            "selected_text": str(SELECTED_TEXT_DIR),
            "output": str(OUTPUT_DIR)
        }
    }

@app.post("/api/upload-pdfs")
async def upload_pdfs(files: List[UploadFile] = File(...)):
    """Upload PDFs and store them in backend/data/pdfs/"""
    logger.info(f" Received {len(files)} files for upload")
    uploaded_files = []
    
    try:
        for file in files:
            logger.info(f"Processing file: {file.filename}")
            
            if not file.filename or not file.filename.endswith('.pdf'):
                raise HTTPException(
                    status_code=400, 
                    detail=f"Only PDF files are allowed. Got: {file.filename}"
                )
            
            # Create safe filename
            safe_filename = file.filename.replace(" ", "_")
            file_path = PDF_DIR / safe_filename
            
            # Read file content
            content = await file.read()
            logger.info(f"Read {len(content)} bytes from {file.filename}")
            
            # Save file to PDF directory
            with open(file_path, "wb") as buffer:
                buffer.write(content)
            
            uploaded_files.append({
                "filename": safe_filename,
                "original_name": file.filename,
                "size": len(content),
                "path": str(file_path),
                "uploaded": datetime.now().isoformat()
            })
            
            logger.info(f" Saved: {safe_filename} ({len(content)} bytes)")
        
        logger.info(f" Successfully uploaded {len(uploaded_files)} files")
        return {
            "success": True,
            "message": f"Successfully uploaded {len(uploaded_files)} PDF(s)",
            "files": uploaded_files
        }
    
    except Exception as e:
        logger.error(f" Upload failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")
    

@app.get("/api/list-pdfs")
async def list_pdfs():
    """List all PDFs in the storage directory"""
    try:
        logger.info(f" Listing PDFs from: {PDF_DIR}")
        pdf_files = []
        
        if not PDF_DIR.exists():
            PDF_DIR.mkdir(parents=True, exist_ok=True)
            
        for pdf_file in PDF_DIR.glob("*.pdf"):
            try:
                stat = pdf_file.stat()
                pdf_files.append({
                    "filename": pdf_file.name,
                    "size": stat.st_size,
                    "uploaded": datetime.fromtimestamp(stat.st_mtime).isoformat()
                })
            except Exception as e:
                logger.warning(f" Could not process {pdf_file.name}: {e}")
        
        logger.info(f" Found {len(pdf_files)} PDF files")
        return {
            "success": True,
            "pdfs": pdf_files,
            "total_count": len(pdf_files)
        }
    
    except Exception as e:
        logger.error(f" Failed to list PDFs: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to list PDFs: {str(e)}")

# FIXED: Handle both GET and HEAD methods for PDF serving
@app.api_route("/api/get-pdf/{filename}", methods=["GET", "HEAD"])
async def get_pdf(request: Request, filename: str):
    """Serve PDF files for Adobe PDF Embed API - Supports both GET and HEAD"""
    try:
        file_path = PDF_DIR / filename
        logger.info(f" {request.method} request for PDF: {filename}")
        
        if not file_path.exists():
            logger.error(f" PDF not found: {filename}")
            raise HTTPException(status_code=404, detail="PDF file not found")
        
        # Get file info
        file_size = file_path.stat().st_size
        
        # Handle HEAD request (for accessibility check)
        if request.method == "HEAD":
            logger.info(f" HEAD response for {filename} - Size: {file_size}")
            return Response(
                status_code=200,
                headers={
                    "Content-Type": "application/pdf",
                    "Content-Length": str(file_size),
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
                    "Cache-Control": "no-cache"
                }
            )
        
        # Handle GET request (actual file download)
        logger.info(f" Serving PDF file: {filename} ({file_size} bytes)")
        return FileResponse(
            path=file_path,
            media_type="application/pdf",
            filename=filename,
            headers={
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
                "Cache-Control": "no-cache",
                "Content-Length": str(file_size)
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f" Error serving PDF {filename}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error serving PDF: {str(e)}")

@app.post("/api/process-selection")
async def process_selection(request: dict):
    """
    Process selected text through test_automatic.py
    This is the core functionality that connects to your existing Python system
    """
    try:
        selected_text = request.get("selected_text")
        source_document = request.get("source_document")
        page_number = request.get("page_number", 1)
        
        logger.info(f" Processing selection: {len(selected_text) if selected_text else 0} characters")
        logger.info(f" Source document: {source_document}")
        
        if not selected_text:
            raise HTTPException(status_code=400, detail="selected_text is required")
        
        # Save selected text to backend/data/selected_text/selected_text.json
        selection_data = {
            "selected_text": selected_text,
            "source_document": source_document,
            "page_number": page_number,
            "timestamp": datetime.now().isoformat(),
            "selection_id": str(uuid.uuid4())
        }
        
        selection_file = SELECTED_TEXT_DIR / "selected_text.json"
        with open(selection_file, "w", encoding="utf-8") as f:
            json.dump(selection_data, f, indent=2, ensure_ascii=False)
        
        logger.info(f" Saved selection to: {selection_file}")
        
        # Run test_automatic.py
        script_path = BASE_DIR / "test_automatic.py"
        logger.info(f" Running script: {script_path}")
        
        if not script_path.exists():
            logger.error(f" Script not found: {script_path}")
            raise HTTPException(status_code=500, detail="test_automatic.py not found")
        
        # Execute the script with proper error handling
        try:
            result = subprocess.run(
                ["python", str(script_path)],
                cwd=BASE_DIR,
                capture_output=True,
                text=True,
                timeout=520  # 8 minute timeout
            )
            
            logger.info(f"Script exit code: {result.returncode}")
            if result.stdout:
                logger.info(f" Script stdout: {result.stdout}")
            if result.stderr:
                logger.warning(f" Script stderr: {result.stderr}")
            
            if result.returncode != 0:
                raise HTTPException(
                    status_code=500, 
                    detail=f"Script execution failed (exit {result.returncode}): {result.stderr}"
                )
        
        except subprocess.TimeoutExpired:
            logger.error(" Script execution timed out")
            raise HTTPException(status_code=500, detail="Processing timed out after 2 minutes")
        
        # Find the latest output JSON file
        output_files = list(OUTPUT_DIR.glob("extracted_sections_*.json"))
        if not output_files:
            logger.error(" No output file generated")
            raise HTTPException(status_code=500, detail="No output file generated")
        
        # Get the most recent output file
        latest_output = max(output_files, key=lambda x: x.stat().st_mtime)
        logger.info(f" Latest output file: {latest_output.name}")
        
        # Read and return the results
        try:
            with open(latest_output, "r", encoding="utf-8") as f:
                results = json.load(f)
        except Exception as e:
            logger.error(f" Failed to read output file: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to read results: {str(e)}")
        
        logger.info(f" Processing completed successfully")
        return {
            "success": True,
            "message": "Selection processed successfully",
            "results": results,
            "output_file": latest_output.name,
            "selection_data": selection_data,
            "processing_time": datetime.now().isoformat()
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f" Processing failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Processing failed: {str(e)}")

# Health check endpoint with detailed status
@app.get("/api/health")
async def health_check():
    """Comprehensive health check"""
    try:
        # Check directories
        dirs_status = {}
        for name, path in [
            ("pdfs", PDF_DIR), 
            ("jsons", JSON_DIR),
            ("selected_text", SELECTED_TEXT_DIR), 
            ("output", OUTPUT_DIR)
        ]:
            dirs_status[name] = {
                "exists": path.exists(),
                "path": str(path),
                "files": len(list(path.glob("*"))) if path.exists() else 0
            }
        
        # Check script availability
        script_exists = (BASE_DIR / "test_automatic.py").exists()
        
        return {
            "status": "healthy",
            "timestamp": datetime.now().isoformat(),
            "pdf_count": len(list(PDF_DIR.glob("*.pdf"))) if PDF_DIR.exists() else 0,
            "directories": dirs_status,
            "script_available": script_exists,
            "version": "1.0.0"
        }
    except Exception as e:
        logger.error(f" Health check failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Health check failed: {str(e)}")
# --- Gemini AI Integration (PHASE 4) ---


try:
    import google.generativeai as genai
    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
    if GEMINI_API_KEY:
        genai.configure(api_key=GEMINI_API_KEY)
        gemini_model = genai.GenerativeModel('gemini-1.5-flash')
        logger.info(f"✅ Gemini API configured successfully")
    else:
        gemini_model = None
        logger.warning("⚠️ GEMINI_API_KEY not found in environment")
except ImportError:
    GEMINI_API_KEY = None
    gemini_model = None
    logger.warning("⚠️ google-generativeai not installed")

@app.post("/api/insights/generate")
async def generate_insights(request: dict):
    try:
        selected_text = request.get("selected_text", "")
        relevant_sections = request.get("relevant_sections", [])
        
        if not GEMINI_API_KEY or not gemini_model:
            logger.error("❌ Gemini API key is not configured")
            return {
                "success": False, 
                "insights": "Gemini API key not configured. Please set GEMINI_API_KEY in your .env.local file."
            }

        # Create context from relevant sections
        context = "\n".join([
            f"- {section.get('summary_of_paragraph_under_section', '')}" 
            for section in relevant_sections[:5] if section.get('summary_of_paragraph_under_section')
        ])

        # IMPROVED: More specific prompt with examples and strict formatting
        prompt = f"""Analyze the selected text and provide insights in EXACTLY this format. You MUST include all four sections:

Do you know?:
[Provide interesting facts, background information, or lesser-known details related to the text]

Contradictory viewpoints:
[Identify different perspectives, conflicting opinions, or alternative interpretations mentioned or implied in the text]

Examples:
[Give specific examples, case studies, or illustrations that relate to the main concepts in the text]

Other insights:
[Additional analysis, connections to broader topics, implications, or deeper understanding]

Selected Text:
{selected_text}

Relevant Context from Documents:
{context}

Remember: You MUST provide content for ALL four sections. If a section seems not applicable, still provide related information that could be valuable. Each section should have at least 2-3 sentences."""

        response = gemini_model.generate_content(prompt)
        
        # Safe text extraction
        insights_text = getattr(response, 'text', None)
        if insights_text is None and hasattr(response, 'candidates') and response.candidates:
            insights_text = response.candidates[0].content.parts.text if response.candidates.content.parts else ""
        
        # Handle tuple/list responses
        if isinstance(insights_text, (tuple, list)):
            insights_text = insights_text if insights_text else ""
            
        insights_text = str(insights_text).strip()
        
        logger.info(f"✅ Insights generated successfully: {len(insights_text)} characters")
        return {
            "success": True,
            "insights": insights_text,
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"❌ Gemini Insights error: {e}")
        return {
            "success": False, 
            "insights": f"Error generating insights: {str(e)}"
        }


@app.post("/api/summary/generate")
async def generate_summary(request: dict):
    """
    Generate structured summary using Gemini AI
    """
    try:
        selected_text = request.get("selected_text", "")
        relevant_sections = request.get("relevant_sections", [])
        
        if not GEMINI_API_KEY or not gemini_model:
            logger.error("❌ Gemini API key is not configured")
            return {
                "success": False, 
                "summary": "Gemini API key not configured. Please set GEMINI_API_KEY in your .env.local file.",
                "key_points": []
            }

        # Create context from relevant sections
        context = "\n".join([
            f"- {section.get('summary_of_paragraph_under_section', '')}" 
            for section in relevant_sections[:3] if section.get('summary_of_paragraph_under_section')
        ])

        prompt = f"""Provide a concise summary of the following content and extract key points:

Selected Text:
{selected_text}

Additional Context from Documents:
{context}

Format your response as:
SUMMARY: [Your comprehensive summary here]
KEY_POINTS:
- [First key point]
- [Second key point]
- [Third key point]
"""

        response = gemini_model.generate_content(prompt)
        
        # Safe text extraction
        raw_text = getattr(response, 'text', None)
        if raw_text is None and hasattr(response, 'candidates') and response.candidates:
            raw_text = response.candidates[0].content.parts.text if response.candidates.content.parts else ""
        
        # Handle tuple/list responses
        if isinstance(raw_text, (tuple, list)):
            raw_text = raw_text[0] if raw_text else ""
            
        text = str(raw_text).strip()
        
        # Parse response
        summary = ""
        key_points = []
        lines = text.split('\n')
        current_section = None
        
        for line in lines:
            line = line.strip()
            if line.upper().startswith('SUMMARY:'):
                current_section = 'summary'
                summary = line.split(':', 1)[1].strip() if ':' in line else ""
            elif line.upper().startswith('KEY_POINTS:'):
                current_section = 'key_points'
            elif current_section == 'summary' and line:
                summary += " " + line
            elif current_section == 'key_points' and line.startswith('-'):
                key_points.append(line[1:].strip())
        
        # Fallback if parsing fails
        if not summary:
            summary = text[:500] + "..." if len(text) > 500 else text
            
        logger.info(f"✅ Summary generated successfully")
        return {
            "success": True,
            "summary": summary,
            "key_points": key_points,
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"❌ Gemini Summary error: {e}")
        return {
            "success": False, 
            "summary": f"Error generating summary: {str(e)}", 
            "key_points": []
        }
    # Azure TTS Integration
try:
    import azure.cognitiveservices.speech as speechsdk
    AZURE_TTS_KEY = os.getenv("AZURE_TTS_KEY")
    AZURE_TTS_REGION = os.getenv("AZURE_TTS_REGION", "eastus")
    
    if AZURE_TTS_KEY:
        speech_config = speechsdk.SpeechConfig(subscription=AZURE_TTS_KEY, region=AZURE_TTS_REGION)
        logger.info("✅ Azure TTS configured successfully")
    else:
        speech_config = None
        logger.warning("⚠️ AZURE_TTS_KEY not found in environment")
except ImportError:
    AZURE_TTS_KEY = None
    speech_config = None
    logger.warning("⚠️ azure-cognitiveservices-speech not installed")

class PodcastGenerator:
    def __init__(self):
        self.speech_config = speech_config
        
    def generate_podcast_script(self, selected_text: str, relevant_sections: list) -> str:
        """Generate conversational podcast script using Gemini"""
        if not gemini_model:
            return "AI podcast generation not available. Please configure Gemini API."
        
        # Create context from relevant sections
        context = "\n".join([
            f"- {section.get('summary_of_paragraph_under_section', '')}" 
            for section in relevant_sections[:5] if section.get('summary_of_paragraph_under_section')
        ])
        
        prompt = f"""Create a natural, engaging podcast conversation between two hosts about the following content. 

Host 1 (Alex): Curious interviewer who asks thoughtful questions
Host 2 (Sam): Knowledgeable expert who explains concepts clearly

Make it conversational, informative, and engaging. Keep each turn 1-2 sentences.

Selected Text:
{selected_text}

Related Context:
{context}

Format as:
Alex: [Question or observation]
Sam: [Explanation or insight]
Alex: [Follow-up question]
Sam: [Detailed response]

Create 6-8 exchanges that thoroughly explore the topic."""

        try:
            response = gemini_model.generate_content(prompt)
            script_text = getattr(response, 'text', None)
            if script_text is None and hasattr(response, 'candidates') and response.candidates:
                script_text = response.candidates[0].content.parts.text if response.candidates.content.parts else ""
            
            if isinstance(script_text, (tuple, list)):
                script_text = script_text if script_text else ""
                
            return str(script_text).strip()
        except Exception as e:
            return f"Error generating podcast script: {str(e)}"
    
    def convert_to_ssml(self, script: str) -> str:
        """Convert script to SSML format for Azure TTS"""
        # Parse the script and create SSML with two different voices
        ssml_parts = []
        lines = script.split('\n')
        
        for line in lines:
            line = line.strip()
            if line.startswith('Alex:'):
                text = line.replace('Alex:', '').strip()
                ssml_parts.append(f'<voice name="en-US-AriaNeural">{text}</voice>')
            elif line.startswith('Sam:'):
                text = line.replace('Sam:', '').strip()
                ssml_parts.append(f'<voice name="en-US-GuyNeural">{text}</voice>')
        
        # Combine into full SSML
        ssml = f"""<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xmlns:mstts='https://www.w3.org/2001/mstts' xml:lang='en-US'>
            <mstts:express-as style="newscast">
                {' '.join(ssml_parts)}
            </mstts:express-as>
        </speak>"""
        
        return ssml
    
    async def generate_audio(self, ssml_text: str, filename: str) -> str:
        """Generate audio file using Azure TTS"""
        if not self.speech_config:
            raise Exception("Azure TTS not configured")
        
        try:
            # Set up audio output
            audio_filename = f"{filename}.wav"
            audio_path = OUTPUT_DIR / audio_filename
            audio_config = speechsdk.audio.AudioOutputConfig(filename=str(audio_path))
            
            # Create synthesizer
            synthesizer = speechsdk.SpeechSynthesizer(
                speech_config=self.speech_config, 
                audio_config=audio_config
            )
            
            # Synthesize speech
            result = synthesizer.speak_ssml_async(ssml_text).get()
            
            if result.reason == speechsdk.ResultReason.SynthesizingAudioCompleted:
                logger.info(f"✅ Audio synthesized successfully: {audio_filename}")
                return f"/api/get-audio/{audio_filename}"
            elif result.reason == speechsdk.ResultReason.Canceled:
                cancellation_details = result.cancellation_details
                logger.error(f"Speech synthesis canceled: {cancellation_details.reason}")
                if cancellation_details.reason == speechsdk.CancellationReason.Error:
                    logger.error(f"Error details: {cancellation_details.error_details}")
                raise Exception(f"Speech synthesis failed: {cancellation_details.error_details}")
            else:
                raise Exception("Speech synthesis failed with unknown reason")
                
        except Exception as e:
            logger.error(f"❌ Audio generation failed: {str(e)}")
            raise

podcast_generator = PodcastGenerator()

@app.post("/api/podcast/generate")
async def generate_podcast(request: dict):
    """Generate podcast audio from selected text and relevant sections"""
    try:
        selected_text = request.get("selected_text", "")
        relevant_sections = request.get("relevant_sections", [])
        
        if not selected_text:
            return {"success": False, "error": "No text provided"}
        
        if not AZURE_TTS_KEY or not speech_config:
            return {
                "success": False, 
                "error": "Azure TTS not configured. Please set AZURE_TTS_KEY and AZURE_TTS_REGION in your .env.local file."
            }
        
        logger.info("🎙️ Generating podcast script...")
        
        # Step 1: Generate conversational script
        script = podcast_generator.generate_podcast_script(selected_text, relevant_sections)
        
        # Step 2: Convert to SSML
        ssml = podcast_generator.convert_to_ssml(script)
        
        # Step 3: Generate audio
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        audio_url = await podcast_generator.generate_audio(ssml, f"podcast_{timestamp}")
        
        logger.info("✅ Podcast generated successfully")
        
        return {
            "success": True,
            "audio_url": audio_url,
            "script": script,
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"❌ Podcast generation error: {e}")
        return {
            "success": False,
            "error": f"Podcast generation failed: {str(e)}"
        }

@app.get("/api/get-audio/{filename}")
async def get_audio(filename: str):
    """Serve generated audio files"""
    try:
        audio_path = OUTPUT_DIR / filename
        if not audio_path.exists():
            raise HTTPException(status_code=404, detail="Audio file not found")
        
        return FileResponse(
            path=audio_path,
            media_type="audio/wav",
            filename=filename,
            headers={
                "Access-Control-Allow-Origin": "*",
                "Cache-Control": "public, max-age=3600"
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error serving audio: {str(e)}")
    
@app.delete("/api/delete-pdf/{filename}")
async def delete_pdf(filename: str):
    """Delete PDF file and its corresponding JSON"""
    try:
        pdf_path = PDF_DIR / filename
        json_filename = filename.replace('.pdf', '.json')
        json_path = JSON_DIR / json_filename
            
        deleted_files = []
            
        # Delete PDF file
        if pdf_path.exists():
            os.remove(pdf_path)
            deleted_files.append(filename)
            logger.info(f"✅ Deleted PDF: {filename}")
            
        # Delete corresponding JSON file
        if json_path.exists():
            os.remove(json_path)
            deleted_files.append(json_filename)
            logger.info(f"✅ Deleted JSON: {json_filename}")
            
        if not deleted_files:
            raise HTTPException(status_code=404, detail="File not found")
            
        return {
            "success": True,
            "message": f"Successfully deleted {filename} and related files",
            "deleted_files": deleted_files
        }
            
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="File not found")
    except Exception as e:
        logger.error(f"❌ Error deleting {filename}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error deleting file: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    logger.info(" Starting Document Intelligence API Server...")
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
