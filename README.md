# Adobe PDF Intel

Adobe PDF Intel is a full‑stack web application for rapid, AI‑assisted document intelligence. It lets you upload PDFs, select text in‑document, and instantly obtain insights, summaries, podcasts (TTS), and cross‑document “relevant sections” — all via a modern, responsive UI.

Backend: FastAPI (port 8000)
Frontend: Next.js (port 3000)

ADOBE PDF EMBED API KEY= f496296468fe4368a82ff414dac3c85f
## Key Features

- Relevant Sections (under ~15 seconds)
  - Click‑and‑select any text in the PDF viewer; the app finds top matching sections across loaded PDFs.
  - Includes page number and jump‑to‑section navigation, with highlighting based on quad points when available.

- AI Insights
  - Structured, multi‑section insights generated via the configured LLM provider.
  - Output includes “Do you know?”, “Contradictory viewpoints”, “Examples”, and “Other insights”.

- Summary
  - Concise summary with extracted key points.

- Podcast Mode (Text‑to‑Speech)
  - Generates a brief two‑host conversation script from the selected text and related context.
  - Produces an audio file (stored in `backend/output/`) and a compact player in the UI (Play/Pause).

Additional UX
- Jump to section & highlight in PDF viewer
- Upload & manage PDFs in the left panel
- Clean, three‑panel layout: Sources (left), PDF viewer (center), Features (right)

## Quick Start (Local)

1) Backend (FastAPI on 8000)
```bash
cd backend
python run_server.py
```
Open API docs: http://localhost:8000/docs

2) Frontend (Next.js on 3000)
```bash
cd frontend
npm install
npm run dev
```
Open app: http://localhost:3000

## Environment Variables & API Keys

Never hardcode API keys. Place them in environment files and/or pass via environment variables at runtime.

- Frontend `.env.local` (optional)
  - `NEXT_PUBLIC_ADOBE_CLIENT_ID` (Adobe PDF Embed API client ID)
  - `NEXT_PUBLIC_API_BASE_URL` (usually omit; the app uses same‑origin /api by default)

- Backend `.env` (optional)
  - `GEMINI_API_KEY` (for Gemini LLM)
  - `GEMINI_MODEL` (e.g., `gemini-2.5-flash`)
  - `TTS_PROVIDER` (e.g., `azure`)
  - `AZURE_TTS_KEY` / `AZURE_TTS_REGION` or `AZURE_TTS_ENDPOINT` (Azure TTS)

Example: backend/.env
```
GEMINI_API_KEY=your_gemini_key
GEMINI_MODEL=gemini-2.5-flash
TTS_PROVIDER=azure
AZURE_TTS_KEY=your_azure_tts_key
AZURE_TTS_REGION=eastus
# or
# AZURE_TTS_ENDPOINT=https://<your-endpoint>.cognitiveservices.azure.com/sts/v1.0/issuetoken
```

## Performance Notes

- Relevant section extraction is optimized and typically returns under ~15 seconds for standard PDFs (assuming reasonable file sizes and host performance).
- The PDF viewer loads via Adobe Embed API; jumping and highlighting leverage quad‑point data when emitted by the backend.

## Project Structure

- `backend/` — FastAPI server and routes (uploads, listing, processing, insights, summary, TTS/podcast, health)
- `backend/output/` — Generated outputs (e.g., podcast audio)
- `frontend/` — Next.js application
- `frontend/src/components/` — UI components (PDF viewer, Sources panel, Features panel, etc.)

## Docker
Docker build command
```bash
docker build -t ph-final .
```
Docker run command:
```bash
docker run -d -p 8000:8000 -p 3000:3000 ph-final

```

Simple setup (frontend on 3000, backend on 8000) 
Build & run (example) as docker image is uploaded on dockerhub for convenience:
```bash
docker pull prathameshjawahire/ph-final

```
```bash
docker run -p 8000:8000 -p 3000:3000 --name document-intel-api prathameshjawahire/ph-final


```
Then visit http://localhost:3000

## Troubleshooting

- If the frontend can’t reach the backend, ensure the backend is running on 8000 and the frontend proxies (or `NEXT_PUBLIC_API_BASE_URL`) are configured appropriately.
- Check browser Network tab and backend logs for detailed errors.
