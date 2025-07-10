"""
Common module for shared models and utilities.

This module contains:
- Ingredient model for food ingredients
- NutritionalValue model for nutritional data (temporarily disabled)
- Snack model for quick snacks
"""

# Temporarily disabled - NutritionalValue table not in current schema
from .models import Ingredient, Snack

__all__ = ["Ingredient", "Snack"]