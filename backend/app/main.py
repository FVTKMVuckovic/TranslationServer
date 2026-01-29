from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from starlette.middleware.base import BaseHTTPMiddleware
import logging

from .config import get_settings
from .database import init_db
from .routers import auth_router, sessions_router, websocket_router

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

settings = get_settings()

# Rate limiter - global instance
limiter = Limiter(key_func=get_remote_address)


# Security Headers Middleware
class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        return response


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifecycle manager"""
    logger.info("Starting Translation Session Server...")

    # Initialize database
    await init_db()
    logger.info("Database initialized")

    yield

    logger.info("Shutting down...")


# Create FastAPI app
app = FastAPI(
    title="Translation Session Server",
    description="Real-time translation system for training sessions",
    version="1.0.0",
    lifespan=lifespan
)

# Add rate limiter
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Add security headers
app.add_middleware(SecurityHeadersMiddleware)

# Configure CORS (stricter in production)
allowed_origins = [settings.frontend_url]
if "localhost" in settings.frontend_url or "127.0.0.1" in settings.frontend_url:
    # Only allow localhost in development
    allowed_origins.extend(["http://localhost:3000", "http://127.0.0.1:3000"])

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

# Include routers
app.include_router(auth_router)
app.include_router(sessions_router)
app.include_router(websocket_router)


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "translation-server"
    }


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "Translation Session Server",
        "docs": "/docs",
        "health": "/health"
    }
