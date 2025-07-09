"""
Recipe API routers for Jidelnicek 2.0.

This package contains all API routers for the recipe module:
- categories: Category management endpoints
- tags: Tag management endpoints
- recipes: Recipe endpoints with categorization
- search: Advanced search endpoints
- scaling: Recipe scaling preview endpoints
"""

from .categories import router as categories_router
from .tags import router as tags_router
from .recipes import router as recipes_router
from .search import router as search_router
from .scaling import router as scaling_router

__all__ = ["categories_router", "tags_router", "recipes_router", "search_router", "scaling_router"]