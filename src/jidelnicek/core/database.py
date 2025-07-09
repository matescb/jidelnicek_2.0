"""
Database configuration and base classes for Jidelnicek 2.0.
"""

from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """
    Base class for all SQLAlchemy models.
    
    Provides common functionality and configuration for all database models.
    """
    pass