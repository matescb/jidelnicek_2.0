"""
Ingredients module for Jídelníček 2.0.

This module provides comprehensive ingredient management functionality including:
- CRUD operations for ingredients
- Nutritional data management
- Unit conversions
- Allergen tracking
- Dietary flags management
"""

from .routers.ingredients import router as ingredients_router

__all__ = ["ingredients_router"]