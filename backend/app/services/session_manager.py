import asyncio
import secrets
import string
from typing import Dict, Set, Optional, Callable, Any
from dataclasses import dataclass, field
from datetime import datetime
import logging

from fastapi import WebSocket

logger = logging.getLogger(__name__)


@dataclass
class Participant:
    """Represents a connected participant"""
    websocket: WebSocket
    target_language: str
    connection_id: str
    joined_at: datetime = field(default_factory=datetime.utcnow)


@dataclass
class ActiveSession:
    """Represents an active translation session"""
    session_id: str
    session_code: str
    leader_ws: Optional[WebSocket] = None
    participants: Dict[str, Participant] = field(default_factory=dict)
    is_active: bool = True
    mic_enabled: bool = False
    created_at: datetime = field(default_factory=datetime.utcnow)


class SessionManager:
    """
    Manages active translation sessions and WebSocket connections.
    Handles broadcasting messages to participants.
    """

    def __init__(self):
        self._sessions: Dict[str, ActiveSession] = {}  # session_id -> ActiveSession
        self._code_to_session: Dict[str, str] = {}  # session_code -> session_id
        self._lock = asyncio.Lock()

    @staticmethod
    def generate_session_code(length: int = 12) -> str:
        """Generate a random session code (12 chars = ~4.7 * 10^18 combinations)"""
        # Use uppercase letters and digits, exclude confusing characters
        alphabet = string.ascii_uppercase + string.digits
        alphabet = alphabet.replace('O', '').replace('0', '').replace('I', '').replace('1', '')
        return ''.join(secrets.choice(alphabet) for _ in range(length))

    async def create_session(self, session_id: str) -> str:
        """
        Create a new active session.
        Returns the generated session code.
        """
        async with self._lock:
            # Generate unique code
            while True:
                code = self.generate_session_code()
                if code not in self._code_to_session:
                    break

            session = ActiveSession(
                session_id=session_id,
                session_code=code
            )
            self._sessions[session_id] = session
            self._code_to_session[code] = session_id

            logger.info(f"Session created: {session_id} with code {code}")
            return code

    async def end_session(self, session_id: str):
        """End an active session and disconnect all participants"""
        async with self._lock:
            if session_id not in self._sessions:
                return

            session = self._sessions[session_id]
            session.is_active = False

            # Notify participants
            await self._broadcast_to_session(
                session_id,
                {"type": "session_ended"}
            )

            # Close all participant connections
            for participant in list(session.participants.values()):
                try:
                    await participant.websocket.close(code=1000)
                except Exception:
                    pass

            # Close leader connection
            if session.leader_ws:
                try:
                    await session.leader_ws.close(code=1000)
                except Exception:
                    pass

            # Remove session
            del self._code_to_session[session.session_code]
            del self._sessions[session_id]

            logger.info(f"Session ended: {session_id}")

    async def connect_leader(self, session_id: str, websocket: WebSocket):
        """Connect the session leader"""
        async with self._lock:
            if session_id not in self._sessions:
                raise ValueError(f"Session {session_id} not found")

            session = self._sessions[session_id]
            if session.leader_ws:
                # Disconnect existing leader
                try:
                    await session.leader_ws.close(code=1000)
                except Exception:
                    pass

            session.leader_ws = websocket
            logger.info(f"Leader connected to session: {session_id}")

    async def disconnect_leader(self, session_id: str):
        """Disconnect the session leader"""
        async with self._lock:
            if session_id in self._sessions:
                self._sessions[session_id].leader_ws = None
                logger.info(f"Leader disconnected from session: {session_id}")

    async def connect_participant(
        self,
        session_code: str,
        websocket: WebSocket,
        target_language: str
    ) -> str:
        """
        Connect a participant to a session by code.
        Returns the connection ID.
        """
        async with self._lock:
            if session_code not in self._code_to_session:
                raise ValueError(f"Session code {session_code} not found")

            session_id = self._code_to_session[session_code]
            session = self._sessions[session_id]

            if not session.is_active:
                raise ValueError("Session is not active")

            # Generate connection ID
            connection_id = secrets.token_hex(16)

            participant = Participant(
                websocket=websocket,
                target_language=target_language,
                connection_id=connection_id
            )
            session.participants[connection_id] = participant

            # Notify about participant count
            await self._notify_participant_count(session_id)

            logger.info(f"Participant {connection_id} joined session {session_code} for language {target_language}")
            return connection_id

    async def disconnect_participant(self, session_code: str, connection_id: str):
        """Disconnect a participant"""
        async with self._lock:
            if session_code not in self._code_to_session:
                return

            session_id = self._code_to_session[session_code]
            session = self._sessions[session_id]

            if connection_id in session.participants:
                del session.participants[connection_id]
                await self._notify_participant_count(session_id)
                logger.info(f"Participant {connection_id} left session {session_code}")

    async def set_mic_state(self, session_id: str, enabled: bool):
        """Set the microphone state for a session"""
        async with self._lock:
            if session_id in self._sessions:
                self._sessions[session_id].mic_enabled = enabled

                # Notify participants
                await self._broadcast_to_session(
                    session_id,
                    {"type": "mic_state", "enabled": enabled}
                )

    async def broadcast_transcript(
        self,
        session_id: str,
        original_text: str,
        translations: Dict[str, str],
        is_final: bool = False
    ):
        """Broadcast transcript to all participants"""
        message = {
            "type": "transcript",
            "original": original_text,
            "translations": translations,
            "is_final": is_final,
            "timestamp": datetime.utcnow().isoformat()
        }
        await self._broadcast_to_session(session_id, message)

    async def broadcast_transcript_update(
        self,
        session_id: str,
        original_text: str,
        translations: Dict[str, str]
    ):
        """Broadcast transcript UPDATE to all participants (replaces last entry)"""
        message = {
            "type": "transcript_update",
            "original": original_text,
            "translations": translations,
            "is_final": True,
            "timestamp": datetime.utcnow().isoformat()
        }
        await self._broadcast_to_session(session_id, message)

    async def broadcast_audio(
        self,
        session_id: str,
        language: str,
        audio_data: bytes
    ):
        """Broadcast audio to participants with matching language"""
        if session_id not in self._sessions:
            return

        session = self._sessions[session_id]

        for participant in session.participants.values():
            if participant.target_language == language:
                try:
                    await participant.websocket.send_bytes(audio_data)
                except Exception as e:
                    logger.error(f"Failed to send audio to participant: {e}")

    async def send_to_leader(self, session_id: str, message: Dict[str, Any]):
        """Send a message to the session leader"""
        if session_id not in self._sessions:
            return

        session = self._sessions[session_id]
        if session.leader_ws:
            try:
                await session.leader_ws.send_json(message)
            except Exception as e:
                logger.error(f"Failed to send to leader: {e}")

    async def _broadcast_to_session(self, session_id: str, message: Dict[str, Any]):
        """Broadcast a JSON message to all participants in a session"""
        if session_id not in self._sessions:
            return

        session = self._sessions[session_id]

        # Send to all participants
        for participant in list(session.participants.values()):
            try:
                await participant.websocket.send_json(message)
            except Exception as e:
                logger.error(f"Failed to send to participant: {e}")

    async def _notify_participant_count(self, session_id: str):
        """Notify leader about participant count"""
        if session_id not in self._sessions:
            return

        session = self._sessions[session_id]
        count = len(session.participants)

        # Count by language
        language_counts = {}
        for p in session.participants.values():
            lang = p.target_language
            language_counts[lang] = language_counts.get(lang, 0) + 1

        if session.leader_ws:
            try:
                await session.leader_ws.send_json({
                    "type": "participant_count",
                    "total": count,
                    "by_language": language_counts
                })
            except Exception:
                pass

    def get_session_by_code(self, code: str) -> Optional[ActiveSession]:
        """Get session by code"""
        if code in self._code_to_session:
            session_id = self._code_to_session[code]
            return self._sessions.get(session_id)
        return None

    def get_session(self, session_id: str) -> Optional[ActiveSession]:
        """Get session by ID"""
        return self._sessions.get(session_id)

    def get_active_languages(self, session_id: str) -> Set[str]:
        """Get set of languages with active participants"""
        if session_id not in self._sessions:
            return set()

        session = self._sessions[session_id]
        languages = set()
        for p in session.participants.values():
            languages.add(p.target_language)
        return languages


# Singleton instance
_session_manager: Optional[SessionManager] = None


def get_session_manager() -> SessionManager:
    """Get or create session manager singleton"""
    global _session_manager
    if _session_manager is None:
        _session_manager = SessionManager()
    return _session_manager
