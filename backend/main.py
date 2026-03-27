"""
FastAPI application entry point for CETLOE Debate AI.
Responsible for: app creation, middleware, lifespan, static file serving.
All API route handlers live in routers/debate.py and routers/session.py.
"""

import os
import sys
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
import asyncio

from session_manager import get_session_manager
from limiter import limiter
from routers import debate as debate_router
from routers import session as session_router

# ---------------------------------------------------------------------------
# Logging — unbuffered stdout so container logs appear immediately
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    force=True,
    stream=sys.stdout,
)

logger = logging.getLogger(__name__)

# Enable HTTP-level debug logging from httpx/httpcore
logging.getLogger("httpx").setLevel(logging.DEBUG)
logging.getLogger("httpcore").setLevel(logging.DEBUG)

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(line_buffering=True)


# ---------------------------------------------------------------------------
# Background tasks
# ---------------------------------------------------------------------------

async def _cleanup_sessions_task() -> None:
    """Periodically remove expired sessions from memory."""
async def _cleanup_sessions_task() -> None:
    """Periodically remove expired sessions from memory."""
    while True:
        try:
            await asyncio.sleep(300)  # every 5 minutes
            cleaned = get_session_manager().cleanup_old_sessions()
            if cleaned > 0:
                logger.info(f"Cleanup task removed {cleaned} expired sessions")
        except Exception as e:
            logger.error(f"Session cleanup error: {e}")


# ---------------------------------------------------------------------------
# Application factory
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    cleanup_task = asyncio.create_task(_cleanup_sessions_task())
    logger.info("Started session cleanup background task")
    yield
    cleanup_task.cancel()
    logger.info("Stopped session cleanup background task")


app = FastAPI(
    title="CETLOE Debate AI API",
    description="Backend API for voice-based AI debate practice",
    version="2.0.0",
    lifespan=lifespan,
)

# Rate limiter
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled error: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "An internal error occurred. Please try again."},
    )


# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------

app.include_router(debate_router.router)
app.include_router(session_router.router)


# ---------------------------------------------------------------------------
# Static file serving — Next.js export in frontend/out/
# ---------------------------------------------------------------------------

_root = os.path.join(os.path.dirname(__file__), "..")
_ui_out = os.path.join(_root, "frontend", "out")

if os.path.exists(os.path.join(_ui_out, "index.html")):
    _next_dir = os.path.join(_ui_out, "_next")
    if os.path.isdir(_next_dir):
        app.mount("/_next", StaticFiles(directory=_next_dir), name="next_static")

    _assets_out = os.path.join(_ui_out, "assets")
    if os.path.isdir(_assets_out):
        app.mount("/assets", StaticFiles(directory=_assets_out), name="ui_assets")

    @app.get("/")
    async def serve_frontend():
        return FileResponse(os.path.join(_ui_out, "index.html"))

    _studio_html = os.path.join(_ui_out, "studio.html")

    @app.get("/studio")
    async def serve_studio():
        """Next.js static export emits studio.html for the debate UI route."""
        if os.path.isfile(_studio_html):
            return FileResponse(_studio_html)
        return FileResponse(os.path.join(_ui_out, "index.html"))


# ---------------------------------------------------------------------------
# Dev entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn
    from config import get_settings

    settings = get_settings()
    logger.info(f"Starting server on port {settings.port}")
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=settings.port,
        workers=4,
        log_level="info",
    )
