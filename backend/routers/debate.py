"""
Debate routes: /api/start and /api/turn.
Handles session creation, greeting generation, and per-turn AI processing.
"""

import logging

from fastapi import APIRouter, HTTPException, Request
from google.api_core import exceptions as google_exceptions

from config import get_settings
from session_manager import get_session_manager
from gemini_service import GeminiService
from deepgram_service import DeepgramService
from models import StartDebateRequest, StartDebateResponse, TurnRequest, TurnResponse
from limiter import limiter

logger = logging.getLogger(__name__)

# User-facing hint when Gemini returns 429 (quota / free-tier model limits)
GEMINI_429_HINT = (
    "Gemini API quota or rate limit reached. Wait a minute and try again. "
    "If you use the free tier, try GEMINI_MODEL=gemini-1.5-flash in .env as a fallback. "
    "See https://ai.google.dev/gemini-api/docs/rate-limits"
)

router = APIRouter()


@router.post("/api/start", response_model=StartDebateResponse)
@limiter.limit("10/minute")
async def start_debate(request: Request, body: StartDebateRequest):
    """
    Start a new debate session.
    Returns greeting message with audio.
    """
    try:
        logger.info(f"Starting debate for: {body.user_name}")

        # Create session
        session_mgr = get_session_manager()
        try:
            session_id = session_mgr.create_session(
                user_name=body.user_name,
                panther_id=body.panther_id,
                email=body.email,
            )
        except RuntimeError as e:
            raise HTTPException(status_code=503, detail=str(e))

        # Generate greeting
        try:
            gemini = GeminiService()
            greeting_text = gemini.generate_greeting(body.user_name)
        except google_exceptions.ResourceExhausted as e:
            session_mgr.delete_session(session_id)
            logger.warning("Gemini quota/rate limit on start: %s", e)
            raise HTTPException(status_code=429, detail=GEMINI_429_HINT)

        # Convert to speech
        deepgram = DeepgramService()
        audio_base64 = await deepgram.text_to_speech_base64(greeting_text)

        # Store greeting in conversation
        session_mgr.add_message(session_id, "ai", greeting_text)
        session_mgr.update_session(session_id, {"phase": "topic_gathering"})

        logger.info(f"Debate started successfully: {session_id[:8]}...")

        return StartDebateResponse(
            session_id=session_id,
            text=greeting_text,
            audio_base64=audio_base64,
            phase="topic_gathering",
            speaker_role="greeting",
        )

    except HTTPException:
        raise
    except ValueError as e:
        logger.warning(f"Validation error starting debate: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error starting debate: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to start debate. Please try again.")


@router.post("/api/turn", response_model=TurnResponse)
@limiter.limit("30/minute")
async def process_turn(request: Request, body: TurnRequest):
    """
    Process a turn in the debate.
    Accepts audio (base64) or text, returns AI response with audio.
    """
    try:
        session_mgr = get_session_manager()
        logger.info(f"Processing turn - Session ID: {body.session_id[:8]}...")
        session = session_mgr.get_session(body.session_id)

        if not session:
            logger.error(f"Session not found: {body.session_id[:8]}...")
            raise HTTPException(status_code=404, detail="Session not found or expired")

        logger.info(
            f"Session found - User: {session.get('user_name')}, "
            f"Phase: {session.get('phase')}, is_complete: {session.get('is_complete')}"
        )

        if session["is_complete"]:
            logger.warning(f"Debate already completed for session: {body.session_id[:8]}...")
            raise HTTPException(status_code=400, detail="Debate already completed")

        # Get user text (from audio or direct text)
        deepgram = DeepgramService()

        if body.audio_base64:
            user_text = await deepgram.transcribe_base64(body.audio_base64)
            if not user_text:
                raise HTTPException(
                    status_code=400,
                    detail="Could not transcribe audio. Please speak clearly and try again.",
                )
            logger.info(f"STT transcription completed: {user_text[:60]}...")
        elif body.text:
            user_text = body.text
            logger.info(f"Using text input: {user_text[:60]}...")
        else:
            raise HTTPException(status_code=400, detail="No audio or text provided")

        # Process with Gemini (do not persist messages until success — avoids orphan rows on 429)
        gemini = GeminiService()
        try:
            result = gemini.process_turn(
                conversation_history=session["conversation"],
                user_message=user_text,
                topic=session.get("topic"),
                user_side=session.get("user_side"),
                phase=session.get("phase", "topic"),
                point_index=int(session.get("point_index", 1)),
                total_points=int(session.get("total_points", 2)),
            )
        except google_exceptions.ResourceExhausted as e:
            logger.warning("Gemini quota/rate limit on turn: %s", e)
            raise HTTPException(status_code=429, detail=GEMINI_429_HINT)

        ai_text = result["text"]
        logger.info("=== GEMINI AI RESPONSE (COMPLETE) ===")
        logger.info(f"Phase: {result['phase']}, Speaker: {result.get('speaker_role')}")
        logger.info(f"Response length: {len(ai_text)} chars")
        logger.info(f"FULL TEXT: {ai_text}")
        logger.info("=== END RESPONSE ===")

        # Persist both messages after successful generation
        session_mgr.add_message(body.session_id, "user", user_text)
        session_mgr.add_message(body.session_id, "ai", ai_text)

        # Build session state updates
        updates = {"phase": result["phase"]}
        if result.get("topic"):
            updates["topic"] = result["topic"]
        if result.get("user_side"):
            updates["user_side"] = result["user_side"]
            us = str(result["user_side"]).lower()
            if us in ("for", "against"):
                updates["ai_side"] = "against" if result["user_side"] == "for" else "for"
            elif any(k in us for k in ("republican", "conservative", "gop")):
                updates["ai_side"] = "Liberal"
            elif any(k in us for k in ("liberal", "democrat")):
                updates["ai_side"] = "Republican"
            else:
                updates["ai_side"] = "opposing side"
        if result.get("point_index") is not None:
            updates["point_index"] = int(result["point_index"])
        if result.get("total_points") is not None:
            updates["total_points"] = int(result["total_points"])
        if result["is_complete"]:
            updates["is_complete"] = True

        session_mgr.update_session(body.session_id, updates)
        logger.info(
            f"Session updated - Phase: {result['phase']}, "
            f"Topic: {result.get('topic')}, Complete: {result['is_complete']}"
        )

        # Select TTS voice based on speaker role
        settings = get_settings()
        tts_model = None
        if result.get("speaker_role") == "advisor":
            tts_model = settings.tts_advisor_model
            logger.info("Using advisor voice for TTS")

        logger.info(f"Generating audio - Speaker: {result.get('speaker_role', 'debater')}, Text length: {len(ai_text)}")
        audio_base64 = await deepgram.text_to_speech_base64(ai_text, tts_model=tts_model)
        logger.info(f"Audio generation completed for session {body.session_id[:8]}... - Audio size: {len(audio_base64)} bytes")

        return TurnResponse(
            text=ai_text,
            audio_base64=audio_base64,
            phase=result["phase"],
            speaker_role=result.get("speaker_role", "advisor"),
            is_complete=result["is_complete"],
            topic=result.get("topic"),
            user_side=result.get("user_side"),
            user_text=user_text,
        )

    except HTTPException:
        raise
    except ValueError as e:
        logger.warning(f"Validation error in turn: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error processing turn: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to process response. Please try again.")
