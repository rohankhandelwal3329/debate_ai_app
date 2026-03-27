"""
Configuration settings for the Debate App backend.
Production-ready settings for 400+ concurrent users.

Loads .env from the project root (parent of backend/) so API keys work when
run.py changes cwd to backend/ or when uvicorn is started from any directory.
"""

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# backend/ is this file's directory; project root is one level up
_BACKEND_DIR = Path(__file__).resolve().parent
_PROJECT_ROOT = _BACKEND_DIR.parent

# Prefer root .env (where users usually put keys), then backend/.env
_ENV_FILES = tuple(
    str(p)
    for p in (_PROJECT_ROOT / ".env", _BACKEND_DIR / ".env")
    if p.is_file()
)


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=_ENV_FILES if _ENV_FILES else None,
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # API Keys
    deepgram_api_key: str = ""
    gemini_api_key: str = ""
    # Default: Gemini 2.5 Flash (override via GEMINI_MODEL if needed)
    gemini_model: str = "gemini-2.5-flash"

    # Server settings
    port: int = 8000
    debug: bool = False
    workers: int = 4  # Number of worker processes

    # Audio settings
    stt_model: str = "nova-2"  # Deepgram STT model
    tts_model: str = "aura-asteria-en"  # Deepgram TTS model (debater voice)
    tts_advisor_model: str = "aura-orion-en"  # Deepgram TTS model (advisor voice)
    sample_rate: int = 16000  # Audio sample rate

    # Session settings (for 400+ users)
    max_sessions: int = 1000  # Maximum concurrent sessions
    session_timeout_hours: int = 2  # Session expiry time

    # Rate limiting
    rate_limit_per_minute: int = 30  # Requests per minute per IP


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
