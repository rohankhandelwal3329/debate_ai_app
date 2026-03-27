# AI Debate Partner

An AI-powered voice debate practice application using Deepgram for speech-to-text/text-to-speech and Google Gemini for intelligent debate responses.

**Production-ready for 400+ concurrent students.**

## Architecture

This application uses a "stitched APIs" approach for cost-efficiency:

- **Speech-to-Text**: Deepgram Nova API
- **LLM**: Google Gemini 2.0 Flash
- **Text-to-Speech**: Deepgram Aura API
- **Backend**: Python FastAPI with Gunicorn (4 workers)
- **Frontend**: Next.js 15 (React 19) static export in `frontend/`; FastAPI serves `frontend/out`

## Features

- Voice-based debate interaction (hold-to-speak)
- Student login with name, Panther ID, and email
- AI takes opposing position in debates
- Detailed feedback on debate performance
- Turn-based conversation flow
- Session management with automatic cleanup
- Rate limiting (prevents abuse)
- Thread-safe session handling for concurrent users

## Project Structure

```
debate_ai_app/
├── backend/                 # FastAPI API + serves static UI
├── frontend/                # Next.js App Router (npm run build → frontend/out)
├── .env.example
└── README.md
```

## Setup

### Prerequisites

- Python 3.11+
- Node.js 20+ and npm (used automatically by `run.py` to build `frontend/out`)
- Deepgram API key
- Google Gemini API key

### Quick Start (Local Development)

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd debate_ai_app
   ```

2. Create `.env` in the **project root** (same folder as `run.py`, not inside `backend/`):
   ```env
   DEEPGRAM_API_KEY=your_deepgram_api_key
   GEMINI_API_KEY=your_gemini_api_key
   ```
   The app loads this file by absolute path so keys work even when the server runs from the `backend/` directory.

3. Run the app:
   ```bash
   python run.py
   ```

   This will:
   - Install Python dependencies automatically (if missing)
   - Install frontend npm dependencies and **build** the Next.js app when `frontend/out` is missing, or when `package.json` / `package-lock.json` is newer than the last build (requires **Node.js 20+** and **npm** on your PATH)
   - Start the FastAPI server (API + static UI on the same port)
   - Open the app in your browser

   Flags: `--skip-frontend-build` (only start the server; use if you already ran `npm run build`), `--force-frontend-build` (always rebuild the UI).

   To build the frontend only by hand: `cd frontend && npm install && npm run build`

### Next.js dev server (optional)

For hot reload on port 3000 while the API runs on 8000:

```bash
cd frontend
cp .env.example .env.local
# Set NEXT_PUBLIC_API_BASE=http://127.0.0.1:8000 and NEXT_PUBLIC_WS_ORIGIN=ws://127.0.0.1:8000
npm run dev
```

### Manual Setup (Alternative)

1. Create a virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

2. Install dependencies:
   ```bash
   pip install -r backend/requirements.txt
   ```

3. Run the server:
   ```bash
   cd backend
   uvicorn main:app --reload
   ```

4. Open http://localhost:8000 in your browser

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/start` | POST | Start a new debate session |
| `/api/turn` | POST | Process a debate turn (audio/text) |
| `/api/session/{id}` | GET | Get session details |
| `/api/session/{id}` | DELETE | End and delete session |
| `/api/health` | GET | Health check |

## How It Works

1. **Login**: Student enters name, Panther ID, and email
2. **Start Debate**: Click "Start Debate" to begin
3. **AI Greeting**: AI introduces itself and asks for a topic
4. **Topic Selection**: Student tells AI what they want to debate
5. **Side Selection**: Student chooses their position
6. **Debate**: Hold the record button to speak, release to send
7. **Feedback**: Say "done" or click "End Debate" for coaching feedback

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DEEPGRAM_API_KEY` | Yes | - | Deepgram API key for STT/TTS |
| `GEMINI_API_KEY` | Yes | - | Google Gemini API key |
| `GEMINI_MODEL` | No | `gemini-2.5-flash` | Model id (e.g. `gemini-1.5-flash` if you hit quota limits) |
| `PORT` | No | 8000 | Server port |
| `DEBUG` | No | false | Enable debug mode |
| `MAX_SESSIONS` | No | 1000 | Max concurrent debate sessions |
| `SESSION_TIMEOUT_HOURS` | No | 2 | Session expiry time |

## Production Features

- **Multi-worker**: Gunicorn with 4 Uvicorn workers for handling concurrent requests
- **Rate Limiting**: 10 debate starts/min, 30 turns/min per IP
- **Session Management**: Thread-safe with automatic cleanup every 5 minutes
- **Logging**: Structured logging for monitoring and debugging
- **Health Checks**: `/api/health` and `/api/stats` endpoints for monitoring
- **Resource Limits**: Tune process and host limits to prevent resource exhaustion

## Technology Stack

- **Backend**: FastAPI, Uvicorn, httpx
- **LLM**: Google Generative AI (Gemini)
- **Speech**: Deepgram Nova (STT) + Aura (TTS)
- **Frontend**: Next.js 15, React 19, TypeScript (static export)
- **Deployment**: Python + Next.js static export (Kubernetes-ready path can be added later)

## Troubleshooting

### Gemini 429 / quota / “limit: 0” (free tier)

- Default is **`gemini-2.5-flash`**. If your project hits **limit: 0** or heavy 429s on the free tier, set `GEMINI_MODEL=gemini-1.5-flash` or enable billing.
- After many requests, wait ~1 minute (per-minute limits). See [Gemini rate limits](https://ai.google.dev/gemini-api/docs/rate-limits).

## Planned Features

- **User Authentication**: Login system for students
- **Database Storage**: Store conversations for review and analytics
- **Admin Dashboard**: View student progress and debate history

## License

MIT License

## Credits

Made with care by CETLOE
