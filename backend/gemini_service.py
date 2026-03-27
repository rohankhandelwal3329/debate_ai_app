"""
Gemini service for AI debate logic.
Prompt constants live in prompts.py; this module owns only service logic.
"""

import re
import time
import logging
from typing import Optional

import google.generativeai as genai
from google.api_core import exceptions as google_exceptions

from config import get_settings
from deepgram_service import sanitize_text_for_tts
from prompts import DEBATE_SYSTEM_PROMPT, END_PHRASES, END_PATTERNS, CLOSING_PHRASES

logger = logging.getLogger(__name__)



class GeminiService:
    """Handles Gemini AI for debate conversation."""
    
    def __init__(self, api_key: str = None):
        settings = get_settings()
        key = api_key or settings.gemini_api_key
        if not key:
            raise ValueError("GEMINI_API_KEY not set. Please add it in .env file.")
        
        genai.configure(api_key=key)
        model_name = settings.gemini_model.strip() or "gemini-2.5-flash"
        self.model = genai.GenerativeModel(
            model_name,
            generation_config=genai.GenerationConfig(
                max_output_tokens=450,
                temperature=0.85,
            ),
        )
        # No token limit constraints - rely on word limits in prompts instead
        # This ensures complete responses without artificial truncation
        self._default_max_tokens = 4000  # Very high limit, controlled by prompt instructions
        self._feedback_max_tokens = 4000  # Very high limit, controlled by prompt instructions

    def _generate_content(self, prompt: str, max_output_tokens: int = 450):
        """
        Call generate_content with one retry on transient 429 (rate limit).
        Re-raises ResourceExhausted if still failing (caller maps to HTTP 429).
        """
        gen_cfg = genai.GenerationConfig(
            max_output_tokens=max_output_tokens,
            temperature=0.85,
        )
        for attempt in range(2):
            try:
                logger.info(f"Calling Gemini with max_tokens={max_output_tokens}")
                response = self.model.generate_content(prompt, generation_config=gen_cfg)
                logger.info(f"Gemini response received - Length: {len(response.text)} chars, Text: {response.text[:200]}")
                return response
            except google_exceptions.ResourceExhausted as e:
                msg = str(e)
                m = re.search(r"retry in ([\d.]+)\s*s", msg, re.I)
                wait = float(m.group(1)) + 1.0 if m else 5.0 * (attempt + 1)
                wait = min(wait, 90.0)
                if attempt == 0:
                    logger.warning(
                        "Gemini rate limit (429), retrying once after %.1fs: %s",
                        wait,
                        msg[:200],
                    )
                    time.sleep(wait)
                    continue
                raise
    
    def _log_response(self, text: str, phase: str, speaker_role: str):
        """Log the complete response for debugging."""
        logger.info(f"=== GEMINI RESPONSE ({phase}, {speaker_role}) ===")
        logger.info(f"Length: {len(text)} chars")
        logger.info(f"TEXT: {text}")
        logger.info(f"=== END RESPONSE ===")

    def generate_greeting(self, user_name: str) -> str:
        """
        Generate the initial greeting for the debate.
        
        Args:
            user_name: Name of the user
        
        Returns:
            Greeting message
        """
        logger.info(f"[Gemini] Generating greeting for user: {user_name}")
        prompt = f"""{DEBATE_SYSTEM_PROMPT}

---
Generate ONLY the greeting message for a student named {user_name}.
Ask them what topic they would like to debate today.
Keep it warm, brief, and conversational.
Do not include any system instructions in your response - just the greeting."""

        response = self._generate_content(prompt, max_output_tokens=400)
        greeting_text = sanitize_text_for_tts(response.text.strip())
        logger.info(f"[Gemini] Greeting generated: {greeting_text[:80]}...")
        return greeting_text
    
    def process_turn(
        self,
        conversation_history: list,
        user_message: str,
        topic: Optional[str] = None,
        user_side: Optional[str] = None,
        phase: str = "greeting",
        point_index: int = 1,
        total_points: int = 2,
    ) -> dict:
        """
        Process a user's turn and generate AI response.
        
        Args:
            conversation_history: List of {"role": "user"|"ai", "text": str}
            user_message: The user's latest message
            topic: The debate topic (if known)
            user_side: The user's chosen side (if known)
            phase: Current phase (greeting, topic, side, debate, feedback)
        
        Returns:
            {
                "text": AI response text,
                "phase": Updated phase,
                "topic": Detected topic (if any),
                "user_side": Detected side (if any),
                "is_complete": Whether debate is finished,
                "speaker_role": "debater" | "advisor"
            }
        """
        # Helper to determine speaker role based on phase
        def get_speaker_role(phase: str) -> str:
            if phase in ("coach_decision", "complete"):
                return "advisor"  # Coaching/feedback voice
            return "debater"  # Default for all other phases
        
        logger.info(f"process_turn: phase={phase}, topic={topic}, user_side={user_side}, user_msg={user_message[:50]}...")
        
        user_lower = user_message.lower()
        should_give_feedback = self._is_end_intent(user_message)

        # If user ends the session at any point, return final wrap-up coaching.
        if should_give_feedback:
            history_text = self._format_history(conversation_history, limit=24)
            final_prompt = f"""{DEBATE_SYSTEM_PROMPT}

---
CONVERSATION SO FAR:
{history_text}

USER'S LATEST MESSAGE: "{user_message}"
TOPIC: {topic or "Not yet determined"}
USER'S SIDE: {user_side or "Not yet determined"}

The student wants to END now.
Give ONE final coaching message in plain speech.
WORD LIMIT: Keep it to approximately 150 words (this is a guideline, not a hard limit).
IMPORTANT: Your response MUST be complete and include ALL of these parts:
1. Brief summary of their debate performance
2. Key strengths they demonstrated
3. 2-3 specific improvements with concrete examples
4. Actionable practice tips for future debates
5. Warm, encouraging closing statement
Do not ask another question. Be direct, concise, and complete. Ensure every part is included.
"""
            response = self._generate_content(final_prompt, max_output_tokens=self._feedback_max_tokens)
            ai_text = sanitize_text_for_tts(response.text.strip())
            logger.info(f"Final response generated - Complete length: {len(ai_text)} chars")
            logger.info(f"Final response text: {ai_text}")
            return {
                "text": ai_text,
                "phase": "complete",
                "topic": topic,
                "user_side": user_side,
                "is_complete": True,
                "speaker_role": get_speaker_role("complete"),
                "point_index": point_index,
                "total_points": total_points,
            }

        # Enrich topic/side from this message (session may not yet include this turn)
        inferred_topic = self._infer_topic_from_message(user_message)
        inferred_side = self._infer_side_from_message(user_message)
        effective_topic = topic or inferred_topic
        effective_side = user_side or inferred_side

        # 1) Setup flow: gather topic + side
        if not effective_topic:
            prompt = f"""{DEBATE_SYSTEM_PROMPT}
Ask what topic they want to debate in one short, warm sentence (20-30 words max).
Student message: "{user_message}" """
            response = self._generate_content(prompt, max_output_tokens=self._default_max_tokens)
            ai_text = sanitize_text_for_tts(response.text.strip())
            return {
                "text": ai_text,
                "phase": "topic",
                "topic": None,
                "user_side": effective_side,
                "is_complete": False,
                "speaker_role": get_speaker_role("topic"),
                "point_index": point_index,
                "total_points": total_points,
            }

        if effective_topic and not effective_side:
            prompt = f"""{DEBATE_SYSTEM_PROMPT}
The topic is: "{effective_topic}".
Ask the student which side they take in one short sentence (20-30 words max).
Student message: "{user_message}" """
            response = self._generate_content(prompt, max_output_tokens=self._default_max_tokens)
            ai_text = sanitize_text_for_tts(response.text.strip())
            return {
                "text": ai_text,
                "phase": "side",
                "topic": effective_topic,
                "user_side": None,
                "is_complete": False,
                "speaker_role": get_speaker_role("side"),
                "point_index": point_index,
                "total_points": total_points,
            }

        # 2) Coaching loop control from student choice after advice.
        decision = self._parse_retry_decision(user_message) if phase == "coach_decision" else "none"
        if phase == "coach_decision" and decision == "retry":
            return {
                "text": "Great choice. Retry this same point now. Give your strongest version, and I will coach it again.",
                "phase": "retry_attempt",
                "topic": effective_topic,
                "user_side": effective_side,
                "is_complete": False,
                "speaker_role": get_speaker_role("retry_attempt"),
                "point_index": point_index,
                "total_points": total_points,
            }

        if phase == "coach_decision" and decision == "move":
            next_point_index = point_index + 1
            prompt = f"""{DEBATE_SYSTEM_PROMPT}
Topic: "{effective_topic}"
Student side: "{effective_side}"
You are on the opposing side.

Give the next opposing point (point number {next_point_index}).
WORD LIMIT: Keep to 50-100 words (2-4 sentences). End with one clear question.
Do not acknowledge what the student chose. Do not restate the topic or side again. Start immediately with the opposing point.
Do not give coaching yet."""
            response = self._generate_content(prompt, max_output_tokens=self._default_max_tokens)
            ai_text = sanitize_text_for_tts(response.text.strip())
            return {
                "text": ai_text,
                "phase": "await_student_point",
                "topic": effective_topic,
                "user_side": effective_side,
                "is_complete": False,
                "speaker_role": get_speaker_role("await_student_point"),
                "point_index": next_point_index,
                "total_points": total_points,
            }

        if phase == "coach_decision" and decision == "none":
            text = (
                "Would you like to retry this same point, or move ahead to the next point? "
                "Say retry or move ahead."
            )
            return {
                "text": text,
                "phase": "coach_decision",
                "topic": effective_topic,
                "user_side": effective_side,
                "is_complete": False,
                "speaker_role": get_speaker_role("coach_decision"),
                "point_index": point_index,
                "total_points": total_points,
            }

        # 3) Start or continue point debate
        if phase in ("side", "debate", "await_student_point", "retry_attempt", "topic", "greeting", "topic_gathering"):
            if phase in ("side", "topic", "greeting", "debate", "topic_gathering"):
                # First opposing point after topic+side are both known
                prompt = f"""{DEBATE_SYSTEM_PROMPT}
Topic: "{effective_topic}"
Student side: "{effective_side}"
You are on the opposing side.

Give opposing point number {point_index}.
WORD LIMIT: Keep to 50-100 words (2-4 sentences). End with one clear question.
Do not acknowledge what the student chose or restate the topic or side again. Start immediately with the opposing point."""
                response = self._generate_content(prompt, max_output_tokens=self._default_max_tokens)
                ai_text = sanitize_text_for_tts(response.text.strip())
                return {
                    "text": ai_text,
                    "phase": "await_student_point",
                    "topic": effective_topic,
                    "user_side": effective_side,
                    "is_complete": False,
                    "speaker_role": get_speaker_role("await_student_point"),
                    "point_index": point_index,
                    "total_points": total_points,
                }

            # Student responded to a point (or retry) -> coaching + choice
            history_text = self._format_history(conversation_history, limit=14)
            coach_prompt = f"""{DEBATE_SYSTEM_PROMPT}
Topic: "{effective_topic}"
Student side: "{effective_side}"
Current point number: {point_index} of {total_points}

Conversation so far:
{history_text}

Student latest argument:
"{user_message}"

Give coaching on this argument only, in plain speech.
WORD LIMIT: Keep response to 50-100 words (guideline, not hard limit).
IMPORTANT: Your response MUST be complete with ALL these parts:
1. One short sentence complimenting what they did well
2. One or two specific, actionable improvement suggestions in plain sentences
3. End with: "Do you want to retry this point or move ahead?" (This must be the very last sentence.)
Do not end the debate unless the student explicitly asks to end. Be conversational and complete."""
            response = self._generate_content(coach_prompt, max_output_tokens=self._default_max_tokens)
            ai_text = sanitize_text_for_tts(response.text.strip())
            logger.info(f"Coach response generated - Length: {len(ai_text)} chars")
            logger.info(f"Coach response text: {ai_text}")
            return {
                "text": ai_text,
                "phase": "coach_decision",
                "topic": effective_topic,
                "user_side": effective_side,
                "is_complete": False,
                "speaker_role": get_speaker_role("coach_decision"),
                "point_index": point_index,
                "total_points": total_points,
            }
        fallback_text = "Do you want to retry this point or move ahead?"
        detected_topic = effective_topic if effective_topic else topic
        detected_side = effective_side if effective_side else user_side

        return {
            "text": sanitize_text_for_tts(fallback_text),
            "phase": "coach_decision",
            "topic": detected_topic,
            "user_side": detected_side,
            "is_complete": False,
            "speaker_role": get_speaker_role("coach_decision"),
            "point_index": point_index,
            "total_points": total_points,
        }

    def _infer_topic_from_message(self, text: str) -> Optional[str]:
        """Detect a debate topic from a substantive user message."""
        t = text.strip()
        if len(t.split()) < 3:
            return None
        low = t.lower()
        keys = (
            "debate", "versus", " vs ", "vs.", "topic", "argue", "republican", "liberal",
            "conservative", "democrat", "side", "perspective", "position", "viewpoint",
        )
        if any(k in low for k in keys):
            return t[:400]
        return None

    def _infer_side_from_message(self, text: str) -> Optional[str]:
        """Detect which side the student takes (short label for prompts)."""
        u = text.lower()
        rep = any(k in u for k in ("republican", "republicans", "gop", "conservative"))
        lib = any(k in u for k in ("liberal", "democrats", "democrat", "democratic"))
        intent = any(
            p in u
            for p in (
                "side",
                "taking",
                "take the",
                "argue",
                "i'll",
                "i will",
                "from the",
                "perspective",
                "viewpoint",
            )
        )
        if rep and intent:
            return "Republican"
        if lib and intent:
            return "Liberal"
        if "against" in u:
            return "against"
        if any(w in u for w in ("support ", "pro ", "favor ", "agree ")):
            return "for"
        return None

    def _parse_retry_decision(self, text: str) -> str:
        """
        Parse student's choice after coaching.
        Returns: "retry" | "move" | "none"
        """
        t = text.lower()
        retry_hits = ("retry", "try again", "again", "redo", "repeat")
        move_hits = ("move ahead", "move on", "next point", "go ahead", "continue", "next")
        if any(k in t for k in retry_hits):
            return "retry"
        if any(k in t for k in move_hits):
            return "move"
        return "none"

    def _format_history(self, history: list, limit: int = 10) -> str:
        """Format conversation history as text."""
        if not history:
            return "(No conversation yet)"

        lines = []
        for msg in history[-limit:]:
            role = "Student" if msg["role"] == "user" else "AI Coach"
            lines.append(f"{role}: {msg['text']}")

        return "\n".join(lines)

    def _is_end_intent(self, text: str) -> bool:
        """Detect whether the student intends to end the debate, with broad phrasing support."""
        low = text.lower().strip()
        if not low:
            return False

        # First: exact phrase list (fast path)
        if any(phrase in low for phrase in END_PHRASES):
            return True

        # Second: regex patterns for natural variants
        for pat in END_PATTERNS:
            if re.search(pat, low):
                return True

        # Third: token-combo fallback for unseen phrasings
        end_verbs = {"end", "stop", "finish", "done", "finished", "wrap"}
        debate_nouns = {"debate", "discussion", "session", "conversation", "arguing", "argument"}
        tokens = re.findall(r"[a-z']+", low)
        tset = set(tokens)
        if tset & end_verbs and tset & debate_nouns:
            return True

        return False


def check_end_trigger(text: str) -> bool:
    """Check if user message contains end intent using broad phrasing detection."""
    low = text.lower().strip()
    if not low:
        return False
    if any(phrase in low for phrase in END_PHRASES):
        return True
    if any(re.search(pat, low) for pat in END_PATTERNS):
        return True
    tokens = re.findall(r"[a-z']+", low)
    tset = set(tokens)
    end_verbs = {"end", "stop", "finish", "done", "finished", "wrap"}
    debate_nouns = {"debate", "discussion", "session", "conversation", "arguing", "argument"}
    return bool(tset & end_verbs and tset & debate_nouns)


def check_closing_phrase(text: str) -> bool:
    """Check if AI message contains closing phrases."""
    text_lower = text.lower()
    return any(phrase in text_lower for phrase in CLOSING_PHRASES)
