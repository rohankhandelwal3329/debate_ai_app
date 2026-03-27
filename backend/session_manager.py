"""
Session manager for conversation state.
Thread-safe implementation for handling 400+ concurrent users.
"""

import uuid
import threading
import logging
from datetime import datetime
from typing import Optional, Dict, Any

logger = logging.getLogger(__name__)


class SessionManager:
    """
    Manages debate sessions in memory with thread safety.
    For production with high concurrency, consider using Redis.
    """
    
    def __init__(self, max_sessions: int = 1000, session_timeout_hours: int = 2):
        self.sessions: Dict[str, Dict[str, Any]] = {}
        self._lock = threading.RLock()  # Reentrant lock for thread safety
        self.max_sessions = max_sessions
        self.session_timeout_hours = session_timeout_hours
    
    def create_session(self, user_name: str, panther_id: str = "", email: str = "") -> str:
        """
        Create a new debate session.
        
        Args:
            user_name: Student's name
            panther_id: Student's ID (optional)
            email: Student's email (optional)
        
        Returns:
            Session ID (UUID string)
        """
        with self._lock:
            # Cleanup old sessions if approaching limit
            if len(self.sessions) >= self.max_sessions * 0.9:
                self._cleanup_expired_sessions()
            
            # If still at limit, reject new sessions
            if len(self.sessions) >= self.max_sessions:
                logger.warning(f"Session limit reached: {self.max_sessions}")
                raise RuntimeError("Server is at capacity. Please try again later.")
            
            session_id = str(uuid.uuid4())
            
            self.sessions[session_id] = {
                "id": session_id,
                "user_name": user_name,
                "panther_id": panther_id,
                "email": email,
                "topic": None,
                "user_side": None,
                "ai_side": None,
                "phase": "greeting",
                # Point-by-point coaching loop state
                "point_index": 1,
                "total_points": 2,
                "conversation": [],
                "created_at": datetime.utcnow().isoformat(),
                "accessed_at": datetime.utcnow().isoformat(),
                "updated_at": datetime.utcnow().isoformat(),
                "is_complete": False,
            }
            
            logger.info(f"Session created: {session_id[:8]}... for {user_name}")
            return session_id
    
    def get_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        """
        Get a session by ID.
        
        Args:
            session_id: Session ID
        
        Returns:
            Session data or None if not found
        """
        with self._lock:
            session = self.sessions.get(session_id)
            if session:
                # Update accessed_at timestamp to keep session alive
                session["accessed_at"] = datetime.utcnow().isoformat()
                return session.copy()  # Return copy to prevent race conditions
            return None
    
    def update_session(self, session_id: str, updates: Dict[str, Any]) -> bool:
        """
        Update session data.
        
        Args:
            session_id: Session ID
            updates: Dictionary of fields to update
        
        Returns:
            True if successful, False if session not found
        """
        with self._lock:
            session = self.sessions.get(session_id)
            if not session:
                return False
            
            for key, value in updates.items():
                if key in session:
                    session[key] = value
            
            session["updated_at"] = datetime.utcnow().isoformat()
            return True
    
    def add_message(self, session_id: str, role: str, text: str) -> bool:
        """
        Add a message to the conversation history.
        
        Args:
            session_id: Session ID
            role: "user" or "ai"
            text: Message content
        
        Returns:
            True if successful, False if session not found
        """
        with self._lock:
            session = self.sessions.get(session_id)
            if not session:
                return False
            
            session["conversation"].append({
                "role": role,
                "text": text,
                "timestamp": datetime.utcnow().isoformat()
            })
            session["updated_at"] = datetime.utcnow().isoformat()
            return True
    
    def get_conversation(self, session_id: str) -> list:
        """
        Get the conversation history for a session.
        
        Args:
            session_id: Session ID
        
        Returns:
            List of messages or empty list if session not found
        """
        with self._lock:
            session = self.sessions.get(session_id)
            if not session:
                return []
            return session["conversation"].copy()
    
    def complete_session(self, session_id: str) -> bool:
        """
        Mark a session as complete.
        
        Args:
            session_id: Session ID
        
        Returns:
            True if successful, False if session not found
        """
        result = self.update_session(session_id, {
            "phase": "complete",
            "is_complete": True
        })
        if result:
            logger.info(f"Session completed: {session_id[:8]}...")
        return result
    
    def delete_session(self, session_id: str) -> bool:
        """
        Delete a session.
        
        Args:
            session_id: Session ID
        
        Returns:
            True if deleted, False if not found
        """
        with self._lock:
            if session_id in self.sessions:
                del self.sessions[session_id]
                logger.info(f"Session deleted: {session_id[:8]}...")
                return True
            return False
    
    def get_active_sessions_count(self) -> int:
        """Get count of active (incomplete) sessions."""
        with self._lock:
            return sum(1 for s in self.sessions.values() if not s["is_complete"])
    
    def get_total_sessions_count(self) -> int:
        """Get total count of all sessions."""
        with self._lock:
            return len(self.sessions)
    
    def _cleanup_expired_sessions(self):
        """Internal method to cleanup expired sessions (must hold lock)."""
        now = datetime.utcnow()
        to_delete = []
        
        for session_id, session in self.sessions.items():
            # Use accessed_at if available, otherwise fall back to created_at
            last_active = session.get("accessed_at") or session.get("created_at")
            accessed = datetime.fromisoformat(last_active)
            age_hours = (now - accessed).total_seconds() / 3600
            
            if age_hours > self.session_timeout_hours:
                to_delete.append(session_id)
        
        for session_id in to_delete:
            user_name = self.sessions[session_id].get("user_name", "Unknown")
            del self.sessions[session_id]
            logger.info(f"Cleaned up expired session: {session_id[:8]}... (user: {user_name})")
        
        return len(to_delete)
    
    def cleanup_old_sessions(self, max_age_hours: int = None):
        """
        Remove sessions older than max_age_hours.
        
        Args:
            max_age_hours: Maximum session age in hours (defaults to session_timeout_hours)
        """
        with self._lock:
            if max_age_hours is not None:
                old_timeout = self.session_timeout_hours
                self.session_timeout_hours = max_age_hours
                result = self._cleanup_expired_sessions()
                self.session_timeout_hours = old_timeout
                return result
            return self._cleanup_expired_sessions()


# Global session manager instance
session_manager = SessionManager()


def get_session_manager() -> SessionManager:
    """Get the global session manager instance."""
    return session_manager
