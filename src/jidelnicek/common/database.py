"""
Common database utilities.

This module provides database session management and
other database-related utilities.
"""

from typing import Generator
from sqlalchemy.orm import Session
from redis import Redis

from jidelnicek.core.database import SessionLocal, init_db
from jidelnicek.common.config import settings


# Initialize database on first import
_initialized = False


def _ensure_initialized():
    """Ensure database is initialized."""
    global _initialized
    if not _initialized:
        init_db()
        _initialized = True


def get_db() -> Generator[Session, None, None]:
    """
    Get database session.
    
    Yields:
        Database session
    """
    _ensure_initialized()
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_redis() -> Redis:
    """
    Get Redis client instance.
    
    Returns:
        Redis client
    """
    # In production, this would use connection pooling
    return Redis(
        host=settings.REDIS_HOST,
        port=settings.REDIS_PORT,
        db=settings.REDIS_DB,
        decode_responses=True
    )