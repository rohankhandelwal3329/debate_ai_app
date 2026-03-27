# AI Debate Partner

An AI-powered voice debate practice application using Deepgram for speech-to-text/text-to-speech and Google Gemini for intelligent debate responses.

**Production-ready for 400+ concurrent students.**

## Architecture

This application uses a "stitched APIs" approach for cost-efficiency:

- **Speech-to-Text**: Deepgram Nova API (live WebSocket streaming + blob fallback)
- **LLM**: Google Gemini 2.5 Flash
- **Text-to-Speech**: Deepgram Aura API
- **Backend**: Python FastAPI with Gunicorn (4 workers) + modular routers
- **Frontend**: Next.js 15 (React 19) with custom hooks + component composition; static export in `frontend/out`; FastAPI serves static files

### Backend Architecture
- **Route Modularization**: API endpoints split across `routers/debate.py` (start/turn) and `routers/session.py` (session/health/stats/WebSocket)
- **Separation of Concerns**: Pydantic models (`models.py`), Gemini prompts (`prompts.py`), rate limiter (`limiter.py`)
- **Dependency Injection**: Shared `limiter` instance and service classes

### Frontend Architecture
- **Custom Hooks**: `useDebateSession` hook encapsulates all state, refs, effects, and event handlers
- **Component Composition**: `StudioPage` (85 lines) delegates to sub-components (`ChatPanel`, `ControlDock`, `HelpModal`, `StatusBadge`)
- **Type Safety**: Shared types in `lib/types.ts` (`Conn`, `VizState`, `ChatMsg`)

## Features

- **Voice-based Debate**: Hold-to-speak interaction with auto-listen (AI speaks → app listens automatically)
- **Live STT Streaming**: Deepgram WebSocket with 5-second silence detection; blob fallback if WebSocket unavailable
- **Auto-Turn Submission**: Debate turns auto-submit after 5 seconds of silence (no manual button clicks needed after initial "Start")
- **Student Login**: Name, Panther ID, and email authentication
- **AI Opposition**: AI takes the opposite position in debates with intelligent responses
- **Debate Coaching**: Detailed feedback on debate performance after completion
- **Turn-based Conversation**: Structured debate flow with alternating speakers
- **Session Persistence**: Refreshing the page restores an in-progress debate automatically
- **Rate Limiting**: 10 debate starts/min, 30 turns/min per IP (prevents abuse)
- **Thread-safe Sessions**: Concurrent user handling with automatic cleanup every 5 minutes

## Project Structure

```
debate_ai_app/
├── run.py                            # One-command launcher (builds + starts server)
├── backend/
│   ├── main.py                       # FastAPI app setup, CORS, lifespan, static file serving
│   ├── config.py                     # Settings (env vars)
│   ├── models.py                     # Pydantic request/response models
│   ├── prompts.py                    # Gemini system prompt + debate constants
│   ├── limiter.py                    # Shared slowapi rate-limiter instance
│   ├── gemini_service.py             # GeminiService class (chat, phase logic)
│   ├── deepgram_service.py           # DeepgramService (STT + TTS)
│   ├── session_manager.py            # Thread-safe in-memory session store
│   ├── live_stt.py                   # Live STT WebSocket proxy helper
│   ├── requirements.txt
│   └── routers/
│       ├── __init__.py               # Router package marker
│       ├── debate.py                 # POST /api/start, POST /api/turn
│       └── session.py                # GET/DELETE /api/session, /api/health, /api/stats, WS /ws/stt
├── frontend/
│   ├── app/
│   │   ├── page.tsx                  # Landing page route
│   │   └── studio/page.tsx           # Debate studio route
│   ├── components/
│   │   ├── LandingPage.tsx           # Student login UI
│   │   ├── StudioPage.tsx            # Top-level studio shell (~85 lines)
│   │   ├── Aurora.tsx / Orb.tsx      # Background visual effects
│   │   └── studio/
│   │       ├── ChatPanel.tsx         # Conversation history + streaming text
│   │       ├── ControlDock.tsx       # Orb visualizer + Start/Record/End buttons
│   │       ├── HelpModal.tsx         # "How it works" dialog
│   │       └── StatusBadge.tsx       # Connection state pill
│   ├── hooks/
│   │   └── useDebateSession.ts       # All debate state, refs, effects & handlers
│   ├── lib/
│   │   ├── api.ts                    # Typed API client
│   │   ├── audioPlayer.ts            # Base64 audio playback with streaming text
│   │   ├── audioRecorder.ts          # MediaRecorder wrapper
│   │   ├── liveSttSession.ts         # Deepgram live STT WebSocket session
│   │   ├── sessionStorage.ts         # User + debate session persistence
│   │   └── types.ts                  # Shared TypeScript types (Conn, VizState, ChatMsg)
│   ├── package.json
│   └── tsconfig.json
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
| `/api/start` | POST | Start a new debate session; returns greeting audio + text |
| `/api/turn` | POST | Process a debate turn (audio base64 or plain text); returns AI response + audio |
| `/api/session/{id}` | GET | Get session details and conversation history |
| `/api/session/{id}` | DELETE | End and delete a session |
| `/api/health` | GET | Health check |
| `/api/stats` | GET | Active session count and server stats |
| `/ws/stt` | WebSocket | Live speech-to-text proxy (Deepgram live streaming) |

## How It Works

1. **Login**: Student enters name, Panther ID, and email
2. **Start Debate**: Click "Start Debate" → FastAPI creates a session ID (persisted in sessionStorage)
3. **AI Greeting**: AI greets and asks for a debate topic + student position (audio streamed + played with visual Orb feedback)
4. **Auto-listen**: After AI finishes speaking, app automatically starts listening (orb changes color)
5. **Speak & Submit**: Student speaks naturally; 5 seconds of silence auto-submits their turn without needing to press a button
6. **Live Transcription**: Student's words appear in real-time via Deepgram WebSocket; if WebSocket fails, falls back to blob recording
7. **AI Response**: Gemini generates debate response; text streams into UI while audio plays
8. **Loop Repeats**: Unless debate is complete, auto-listen triggers again
9. **Feedback**: Student says "done" or clicks "End Debate" button; AI provides detailed coaching feedback
10. **Session Persistence**: Refreshing the page restores the debate automatically using saved session ID

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

- **Backend**: FastAPI, Uvicorn/Gunicorn, httpx, slowapi, Pydantic v2
- **LLM**: Google Generative AI (Gemini 2.5 Flash)
- **Speech**: Deepgram Nova-3 (STT, live WebSocket) + Aura (TTS)
- **Frontend**: Next.js 15, React 19, TypeScript (static export)
- **Architecture**: Single-port deployment (FastAPI serves static + API), Kubernetes-ready
- **Concurrency**: Thread-safe session management, multi-worker Gunicorn setup

## Troubleshooting

### Gemini 429 / quota / “limit: 0” (free tier)

- Default is **`gemini-2.5-flash`**. If your project hits **limit: 0** or heavy 429s on the free tier, set `GEMINI_MODEL=gemini-1.5-flash` or enable billing.
- After many requests, wait ~1 minute (per-minute limits). See [Gemini rate limits](https://ai.google.dev/gemini-api/docs/rate-limits).
### Live STT not working

- The browser must be served over **HTTPS** (or `localhost`) for microphone access.
- If the WebSocket connection to `/ws/stt` fails, the app silently falls back to blob-based audio recording and transcribes on the server side — debate functionality is unaffected.
## Planned Features

- **User Authentication**: Login system for students
- **Database Storage**: Store conversations for review and analytics
- **Admin Dashboard**: View student progress and debate history

## License

MIT License

## Credits

Made with care by CETLOE
