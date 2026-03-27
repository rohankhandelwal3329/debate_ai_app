"""
Pydantic request / response models for the Debate AI API.
Kept separate from routing logic so models can be imported by routers
without pulling in FastAPI application state.
"""

from pydantic import BaseModel
from typing import Optional


class StartDebateRequest(BaseModel):
    user_name: str
    panther_id: Optional[str] = ""
    email: Optional[str] = ""


class StartDebateResponse(BaseModel):
    session_id: str
    text: str
    audio_base64: str
    phase: str
    speaker_role: str  # "greeting"


class TurnRequest(BaseModel):
    session_id: str
    audio_base64: Optional[str] = None
    text: Optional[str] = None


class TurnResponse(BaseModel):
    text: str
    audio_base64: str
    phase: str
    speaker_role: str  # "greeting" | "debater" | "advisor"
    is_complete: bool
    topic: Optional[str] = None
    user_side: Optional[str] = None
    user_text: Optional[str] = None


class SessionResponse(BaseModel):
    session_id: str
    user_name: str
    topic: Optional[str]
    user_side: Optional[str]
    phase: str
    conversation: list
    is_complete: bool
    point_index: Optional[int] = None
    total_points: Optional[int] = None


class StatsResponse(BaseModel):
    active_sessions: int
    total_sessions: int
    status: str
