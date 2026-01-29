from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List
import uuid
import logging

from ..database import get_db
from ..models.user import User
from ..models.session import Session, SessionStatus
from ..services.session_manager import get_session_manager
from .auth import get_current_user
from slowapi import Limiter
from slowapi.util import get_remote_address

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/sessions", tags=["sessions"])
limiter = Limiter(key_func=get_remote_address)


# Pydantic Models
class SessionCreate(BaseModel):
    title: Optional[str] = None


class SessionResponse(BaseModel):
    id: str
    title: Optional[str]
    session_code: str
    status: str
    source_language: str
    created_at: datetime
    ended_at: Optional[datetime]
    participant_count: int = 0

    class Config:
        from_attributes = True


class SessionListResponse(BaseModel):
    sessions: List[SessionResponse]


# Routes
@router.post("", response_model=SessionResponse)
async def create_session(
    session_data: SessionCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    session_manager = get_session_manager()

    # Generate session code
    session_code = await session_manager.create_session(str(uuid.uuid4()))

    # Create DB record
    session = Session(
        user_id=current_user.id,
        title=session_data.title or f"Session {datetime.now().strftime('%d.%m.%Y %H:%M')}",
        session_code=session_code
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)

    # Update session manager with real ID
    await session_manager.end_session(session_code)  # Remove temp session
    session_code = await session_manager.create_session(str(session.id))

    # Update code in DB if different
    if session.session_code != session_code:
        session.session_code = session_code
        await db.commit()

    return SessionResponse(
        id=str(session.id),
        title=session.title,
        session_code=session.session_code,
        status=session.status.value,
        source_language=session.source_language,
        created_at=session.created_at,
        ended_at=session.ended_at,
        participant_count=0
    )


@router.get("", response_model=SessionListResponse)
async def list_sessions(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Session)
        .where(Session.user_id == current_user.id)
        .order_by(Session.created_at.desc())
    )
    sessions = result.scalars().all()

    session_manager = get_session_manager()
    
    response_sessions = []
    for s in sessions:
        active_session = session_manager.get_session(str(s.id))
        participant_count = len(active_session.participants) if active_session else 0

        response_sessions.append(SessionResponse(
            id=str(s.id),
            title=s.title,
            session_code=s.session_code,
            status=s.status.value,
            source_language=s.source_language,
            created_at=s.created_at,
            ended_at=s.ended_at,
            participant_count=participant_count
        ))

    return SessionListResponse(sessions=response_sessions)


@router.get("/join/{session_code}")
@limiter.limit("30/minute")  # Limit brute force attempts on session codes
async def get_session_for_join(
    request: Request,
    session_code: str,
    db: AsyncSession = Depends(get_db)
):
    """Public endpoint for participants to join"""
    logger.info(f"Session join attempt for code: {session_code[:4]}*** from IP: {request.client.host}")

    result = await db.execute(
        select(Session).where(Session.session_code == session_code)
    )
    session = result.scalar_one_or_none()

    if not session:
        logger.warning(f"Invalid session code attempt: {session_code[:4]}*** from IP: {request.client.host}")
        raise HTTPException(status_code=404, detail="Session nicht gefunden")

    if session.status != SessionStatus.ACTIVE:
        raise HTTPException(status_code=400, detail="Session ist nicht aktiv")

    return {
        "session_code": session.session_code,
        "title": session.title,
        "source_language": session.source_language
    }


@router.get("/{session_id}", response_model=SessionResponse)
async def get_session(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Session).where(
            Session.id == session_id,
            Session.user_id == current_user.id
        )
    )
    session = result.scalar_one_or_none()

    if not session:
        raise HTTPException(status_code=404, detail="Session nicht gefunden")

    session_manager = get_session_manager()
    active_session = session_manager.get_session(str(session.id))
    participant_count = len(active_session.participants) if active_session else 0

    return SessionResponse(
        id=str(session.id),
        title=session.title,
        session_code=session.session_code,
        status=session.status.value,
        source_language=session.source_language,
        created_at=session.created_at,
        ended_at=session.ended_at,
        participant_count=participant_count
    )


@router.delete("/{session_id}")
async def end_session(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Session).where(
            Session.id == session_id,
            Session.user_id == current_user.id
        )
    )
    session = result.scalar_one_or_none()

    if not session:
        raise HTTPException(status_code=404, detail="Session nicht gefunden")

    # End in session manager
    session_manager = get_session_manager()
    await session_manager.end_session(str(session.id))

    # Update DB
    session.status = SessionStatus.ENDED
    session.ended_at = datetime.utcnow()
    await db.commit()

    return {"message": "Session beendet"}
