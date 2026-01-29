from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, EmailStr, field_serializer, field_validator
from datetime import datetime, timedelta
from typing import Optional
from uuid import UUID
import logging

from ..database import get_db
from ..models.user import User
from ..utils.auth import (
    verify_password,
    get_password_hash,
    create_access_token,
    verify_token
)
from ..utils.totp import generate_totp_secret, verify_totp, get_totp_uri, generate_qr_code_base64
from ..config import get_settings
from slowapi import Limiter
from slowapi.util import get_remote_address

logger = logging.getLogger(__name__)
settings = get_settings()
router = APIRouter(prefix="/api/auth", tags=["auth"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")
limiter = Limiter(key_func=get_remote_address)


# Pydantic Models
class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str
    invite_code: str

    @field_validator('password')
    @classmethod
    def validate_password(cls, v):
        if len(v) < 8:
            raise ValueError('Passwort muss mindestens 8 Zeichen haben')
        if not any(c.isupper() for c in v):
            raise ValueError('Passwort muss mindestens einen Großbuchstaben enthalten')
        if not any(c.islower() for c in v):
            raise ValueError('Passwort muss mindestens einen Kleinbuchstaben enthalten')
        if not any(c.isdigit() for c in v):
            raise ValueError('Passwort muss mindestens eine Zahl enthalten')
        return v

    @field_validator('username')
    @classmethod
    def validate_username(cls, v):
        if len(v) < 3:
            raise ValueError('Username muss mindestens 3 Zeichen haben')
        if len(v) > 50:
            raise ValueError('Username darf maximal 50 Zeichen haben')
        return v


class UserLogin(BaseModel):
    username: str
    password: str
    totp_code: Optional[str] = None


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    id: UUID
    username: str
    email: str
    totp_enabled: bool
    created_at: datetime

    class Config:
        from_attributes = True

    @field_serializer('id')
    def serialize_id(self, id: UUID) -> str:
        return str(id)


# Dependencies
async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db)
) -> User:
    payload = verify_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token"
        )
    
    user_id = payload.get("sub")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )
    return user


# Routes
@router.post("/register", response_model=UserResponse)
@limiter.limit("3/hour")  # Max 3 registrations per IP per hour
async def register(request: Request, user_data: UserCreate, db: AsyncSession = Depends(get_db)):
    logger.info(f"Registration attempt for username: {user_data.username} from IP: {request.client.host}")

    # Validate invite code
    if user_data.invite_code != settings.invite_code:
        raise HTTPException(status_code=403, detail="Ungültiger Einladungscode")

    # Check if username exists
    result = await db.execute(select(User).where(User.username == user_data.username))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Username bereits vergeben")

    # Check if email exists
    result = await db.execute(select(User).where(User.email == user_data.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="E-Mail bereits registriert")

    # Create user
    user = User(
        username=user_data.username,
        email=user_data.email,
        password_hash=get_password_hash(user_data.password)
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    return user


@router.post("/login")
@limiter.limit("5/minute")  # Max 5 login attempts per IP per minute
async def login(request: Request, user_data: UserLogin, db: AsyncSession = Depends(get_db)):
    logger.info(f"Login attempt for username: {user_data.username} from IP: {request.client.host}")

    # Find user
    result = await db.execute(select(User).where(User.username == user_data.username))
    user = result.scalar_one_or_none()

    if not user or not verify_password(user_data.password, user.password_hash):
        logger.warning(f"Failed login attempt for username: {user_data.username} from IP: {request.client.host}")
        raise HTTPException(status_code=401, detail="Ungültige Anmeldedaten")

    # Check 2FA if enabled
    if user.totp_enabled:
        if not user_data.totp_code:
            return {"requires_2fa": True, "message": "2FA Code erforderlich"}
        
        if not verify_totp(user.totp_secret, user_data.totp_code):
            raise HTTPException(status_code=401, detail="Ungültiger 2FA Code")

    # Create token
    access_token = create_access_token(
        data={"sub": str(user.id)},
        expires_delta=timedelta(minutes=settings.access_token_expire_minutes)
    )

    return Token(access_token=access_token)


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.post("/setup-totp")
async def setup_totp(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if current_user.totp_enabled:
        raise HTTPException(status_code=400, detail="2FA bereits aktiviert")

    # Generate new secret
    secret = generate_totp_secret()
    current_user.totp_secret = secret
    await db.commit()

    # Generate QR code
    uri = get_totp_uri(secret, current_user.username)
    qr_code = generate_qr_code_base64(uri)

    return {
        "secret": secret,
        "qr_code": qr_code,
        "uri": uri
    }


@router.post("/verify-totp")
async def verify_totp_setup(
    code: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if not current_user.totp_secret:
        raise HTTPException(status_code=400, detail="TOTP nicht eingerichtet")

    if not verify_totp(current_user.totp_secret, code):
        raise HTTPException(status_code=400, detail="Ungültiger Code")

    current_user.totp_enabled = True
    await db.commit()

    return {"message": "2FA erfolgreich aktiviert"}
