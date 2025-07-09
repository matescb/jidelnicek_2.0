"""
Database configuration and base classes for Jidelnicek 2.0.
"""

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from sqlalchemy.pool import NullPool


class Base(DeclarativeBase):
    """
    Base class for all SQLAlchemy models.
    
    Provides common functionality and configuration for all database models.
    """
    pass


def get_engine():
    """Get database engine with lazy configuration loading."""
    from jidelnicek.common.config import settings
    return create_engine(
        settings.DATABASE_URL,
        poolclass=NullPool,  # Use NullPool for development
        echo=settings.DEBUG
    )


# Create SessionLocal class with lazy binding
SessionLocal = sessionmaker(autocommit=False, autoflush=False)


def init_db():
    """Initialize database connection."""
    engine = get_engine()
    SessionLocal.configure(bind=engine)
    return engine


# For backward compatibility
engine = None