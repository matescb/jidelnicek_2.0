"""Users module for Jidelnicek application.

This module handles user-related functionality including:
- User profile management
- User preferences
- User-specific settings
"""

from .routers.users import router as users_router

__all__ = ["users_router"]