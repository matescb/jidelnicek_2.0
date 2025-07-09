"""
Common module for shared models and utilities.

This module contains:
- Ingredient model for food ingredients
- NutritionalValue model for nutritional data
- Snack model for quick snacks
"""

from .models import Ingredient, NutritionalValue, Snack

__all__ = ["Ingredient", "NutritionalValue", "Snack"]