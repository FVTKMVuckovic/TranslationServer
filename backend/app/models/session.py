from sqlalchemy import Column, String, DateTime, ForeignKey, Text, Enum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
import enum

from ..database import Base


class SessionStatus(str, enum.Enum):
    ACTIVE = "active"
    PAUSED = "paused"
    ENDED = "ended"


class Session(Base):
    __tablename__ = "sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)

    title = Column(String(255), nullable=True)
    session_code = Column(String(16), unique=True, nullable=False, index=True)
    status = Column(Enum(SessionStatus), default=SessionStatus.ACTIVE)
    source_language = Column(String(10), default="de-DE")

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    ended_at = Column(DateTime, nullable=True)

    # Relationships
    user = relationship("User", back_populates="sessions")
    participants = relationship("SessionParticipant", back_populates="session", lazy="dynamic")

    def __repr__(self):
        return f"<Session {self.session_code}>"


class SessionParticipant(Base):
    __tablename__ = "session_participants"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(UUID(as_uuid=True), ForeignKey("sessions.id"), nullable=False)

    target_language = Column(String(10), nullable=False)
    connection_id = Column(String(64), nullable=True)  # WebSocket connection ID

    # Timestamps
    joined_at = Column(DateTime, default=datetime.utcnow)
    left_at = Column(DateTime, nullable=True)

    # Relationships
    session = relationship("Session", back_populates="participants")

    def __repr__(self):
        return f"<Participant {self.id} in {self.session_id}>"
