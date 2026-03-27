"""
Deepgram service for Speech-to-Text (STT) and Text-to-Speech (TTS).
"""

import base64
import re
import logging
import httpx
from config import get_settings

logger = logging.getLogger(__name__)


def sanitize_text_for_tts(text: str) -> str:
    """
    Strip markdown / emphasis characters so TTS does not read "asterisk" aloud.
    Keeps the sentence readable when spoken.
    """
    if not text:
        return text
    s = text
    # Bold / italic markers
    s = re.sub(r"\*\*([^*]+)\*\*", r"\1", s)
    s = re.sub(r"\*([^*]+)\*", r"\1", s)
    s = re.sub(r"__([^_]+)__", r"\1", s)
    s = re.sub(r"_([^_]+)_", r"\1", s)
    # Stray emphasis characters
    s = s.replace("*", "").replace("_", "")
    # Bullet-like lines
    s = re.sub(r"^\s*[-•]\s*", "", s, flags=re.MULTILINE)
    return re.sub(r"\s+", " ", s).strip()


class DeepgramService:
    """Handles Deepgram STT and TTS API calls."""
    
    MAX_TTS_CHARS = 2000  # Deepgram TTS character limit
    
    def __init__(self, api_key: str = None):
        settings = get_settings()
        self.api_key = api_key or settings.deepgram_api_key
        if not self.api_key:
            raise ValueError("DEEPGRAM_API_KEY not set. Please add it in .env file.")
        
        self.stt_model = settings.stt_model
        self.tts_model = settings.tts_model
        self.sample_rate = settings.sample_rate
        
        self.headers = {
            "Authorization": f"Token {self.api_key}",
        }
    
    def _split_text_into_chunks(self, text: str, max_chars: int = MAX_TTS_CHARS) -> list:
        """
        Split text into chunks that don't exceed max_chars.
        Splits by sentence boundaries to maintain naturalness.
        
        Args:
            text: Text to split
            max_chars: Maximum characters per chunk
        
        Returns:
            List of text chunks
        """
        if len(text) <= max_chars:
            return [text]
        
        chunks = []
        current_chunk = ""
        
        # Split by sentence boundaries (. ! ?)
        sentences = re.split(r'(?<=[.!?])\s+', text)
        
        for sentence in sentences:
            # If single sentence exceeds max_chars, we still need to include it
            if len(sentence) > max_chars:
                if current_chunk:
                    chunks.append(current_chunk.strip())
                    current_chunk = ""
                chunks.append(sentence.strip())
            elif len(current_chunk) + len(sentence) + 1 <= max_chars:
                if current_chunk:
                    current_chunk += " " + sentence
                else:
                    current_chunk = sentence
            else:
                if current_chunk:
                    chunks.append(current_chunk.strip())
                current_chunk = sentence
        
        if current_chunk:
            chunks.append(current_chunk.strip())
        
        return chunks
    
    async def transcribe(self, audio_data: bytes, mime_type: str = "audio/webm") -> str:
        """
        Transcribe audio to text using Deepgram Nova API.
        
        Args:
            audio_data: Raw audio bytes
            mime_type: Audio MIME type (audio/webm, audio/wav, etc.)
        
        Returns:
            Transcribed text string
        """
        logger.info(f"[Deepgram STT] Starting transcription - audio size: {len(audio_data)} bytes, model: {self.stt_model}")
        url = f"https://api.deepgram.com/v1/listen"
        
        params = {
            "model": self.stt_model,
            "language": "en",
            "smart_format": "true",
            "punctuate": "true",
        }
        
        headers = {
            **self.headers,
            "Content-Type": mime_type,
        }
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                url,
                params=params,
                headers=headers,
                content=audio_data,
            )
            
            if response.status_code != 200:
                raise Exception(f"Deepgram STT error: {response.status_code} - {response.text}")
            
            logger.info(f"[Deepgram STT] HTTP {response.status_code} OK - Transcription completed")
            
            result = response.json()
            
            # Extract transcript from response
            try:
                transcript = result["results"]["channels"][0]["alternatives"][0]["transcript"]
                logger.info(f"[Deepgram STT] Transcript result: {transcript[:80]}...")
                return transcript.strip()
            except (KeyError, IndexError):
                logger.warning("[Deepgram STT] Could not extract transcript from response")
                return ""
    
    async def transcribe_base64(self, audio_base64: str, mime_type: str = "audio/webm") -> str:
        """
        Transcribe base64-encoded audio to text.
        
        Args:
            audio_base64: Base64-encoded audio string
            mime_type: Audio MIME type
        
        Returns:
            Transcribed text string
        """
        audio_data = base64.b64decode(audio_base64)
        return await self.transcribe(audio_data, mime_type)
    
    async def text_to_speech(self, text: str, tts_model: str = None) -> bytes:
        """
        Convert text to speech using Deepgram Aura API.
        Automatically splits long text into chunks and merges audio.
        
        Args:
            text: Text to convert to speech
            tts_model: TTS model to use (defaults to self.tts_model)
        
        Returns:
            Raw audio bytes (MP3 format)
        """
        logger.info(f"[Deepgram TTS] Starting - text length: {len(text)} chars, model: {tts_model or self.tts_model}")
        text = sanitize_text_for_tts(text)
        
        # Split text into chunks if needed
        chunks = self._split_text_into_chunks(text, self.MAX_TTS_CHARS)
        
        if len(chunks) > 1:
            logger.info(f"Text exceeds {self.MAX_TTS_CHARS} chars, splitting into {len(chunks)} chunks for TTS")
        
        audio_parts = []
        
        for chunk in chunks:
            url = f"https://api.deepgram.com/v1/speak"
            
            params = {
                "model": tts_model or self.tts_model,
            }
            
            logger.info(f"[Deepgram TTS] Generating audio - model: {params['model']}, text length: {len(chunk)} chars")
            
            headers = {
                **self.headers,
                "Content-Type": "application/json",
            }
            
            payload = {
                "text": chunk
            }
            
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    url,
                    params=params,
                    headers=headers,
                    json=payload,
                )
                
                if response.status_code != 200:
                    raise Exception(f"Deepgram TTS error: {response.status_code} - {response.text}")
                
                logger.info(f"[Deepgram TTS] HTTP {response.status_code} OK - Audio generated: {len(response.content)} bytes")
                audio_parts.append(response.content)
        
        # Merge all audio chunks
        merged_audio = b"".join(audio_parts)
        logger.info(f"[Deepgram TTS] Completed - Total audio size: {len(merged_audio)} bytes")
        return merged_audio
    
    async def text_to_speech_base64(self, text: str, tts_model: str = None) -> str:
        """
        Convert text to speech and return as base64-encoded string.
        
        Args:
            text: Text to convert to speech
            tts_model: TTS model to use (defaults to self.tts_model)
        
        Returns:
            Base64-encoded audio string (MP3 format)
        """
        audio_data = await self.text_to_speech(text, tts_model=tts_model)
        return base64.b64encode(audio_data).decode("utf-8")


# Convenience functions for direct use
async def transcribe_audio(audio_data: bytes, mime_type: str = "audio/webm", api_key: str = None) -> str:
    """Transcribe audio to text."""
    service = DeepgramService(api_key=api_key)
    return await service.transcribe(audio_data, mime_type)


async def transcribe_audio_base64(audio_base64: str, mime_type: str = "audio/webm", api_key: str = None) -> str:
    """Transcribe base64-encoded audio to text."""
    service = DeepgramService(api_key=api_key)
    return await service.transcribe_base64(audio_base64, mime_type)


async def text_to_speech(text: str, api_key: str = None) -> bytes:
    """Convert text to speech."""
    service = DeepgramService(api_key=api_key)
    return await service.text_to_speech(text)


async def text_to_speech_base64(text: str, api_key: str = None) -> str:
    """Convert text to speech and return as base64."""
    service = DeepgramService(api_key=api_key)
    return await service.text_to_speech_base64(text)
