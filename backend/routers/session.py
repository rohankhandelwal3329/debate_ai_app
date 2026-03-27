"""
Session, health, stats, and WebSocket routes.
Handles session lookup/deletion, server health checks, and the live STT WebSocket proxy.
"""

import logging

from fastapi import APIRouter, HTTPException, Request, WebSocket
from config import get_settings
from session_manager import get_session_manager
from models import SessionResponse, StatsResponse
from limiter import limiter
from live_stt import deepgram_live_proxy

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/api/session/{session_id}", response_model=SessionResponse)
@limiter.limit("60/minute")
async def get_session(request: Request, session_id: str):
    """Get session details and conversation history."""
    session_mgr = get_session_manager()
    session = session_mgr.get_session(session_id)

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    return SessionResponse(
        session_id=session["id"],
        user_name=session["user_name"],
        topic=session.get("topic"),
        user_side=session.get("user_side"),
        phase=session.get("phase", "topic"),
        conversation=session.get("conversation", []),
        is_complete=session.get("is_complete", False),
        point_index=session.get("point_index"),
        total_points=session.get("total_points"),
    )


@router.delete("/api/session/{session_id}")
@limiter.limit("20/minute")
async def end_session(request: Request, session_id: str):
    """End and delete a session."""
    session_mgr = get_session_manager()

    if not session_mgr.delete_session(session_id):
        raise HTTPException(status_code=404, detail="Session not found")

    return {"status": "ok", "message": "Session deleted"}


@router.get("/api/health")
async def health_check():
    """Health check endpoint."""
    settings = get_settings()
    session_mgr = get_session_manager()

    return {
        "status": "ok",
        "deepgram_configured": bool(settings.deepgram_api_key),
        "gemini_configured": bool(settings.gemini_api_key),
        "active_sessions": session_mgr.get_active_sessions_count(),
        "total_sessions": session_mgr.get_total_sessions_count(),
    }


@router.get("/api/stats", response_model=StatsResponse)
async def get_stats():
    """Get server statistics."""
    session_mgr = get_session_manager()

    return StatsResponse(
        active_sessions=session_mgr.get_active_sessions_count(),
        total_sessions=session_mgr.get_total_sessions_count(),
        status="healthy",
    )


@router.websocket("/ws/live-stt")
async def websocket_live_stt(websocket: WebSocket):
    """Live Deepgram STT: browser sends linear16 PCM; server forwards transcripts as JSON."""
    settings = get_settings()
    await deepgram_live_proxy(websocket, settings.deepgram_api_key)
