"""
Comprehensive validation service for recipes and ingredients.

This module provides extensive validation for all aspects of recipe and ingredient
data including nutritional values, file uploads, permissions, and business rules.
"""

import re
import uuid
from datetime import datetime
from decimal import Decimal, InvalidOperation
from typing import Any, Dict, List, Optional, Union, Tuple, Set
from pathlib import Path
from uuid import UUID

from pydantic import BaseModel, Field, validator, ValidationError
from sqlalchemy.orm import Session

# Optional PIL import for image validation
try:
    from PIL import Image
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False

from jidelnicek.core.config import settings


# =============================================================================
# VALIDATION CONSTANTS
# =============================================================================

class ValidationConstants:
    """Constants for validation limits and ranges."""
    
    # Recipe field limits
    RECIPE_NAME_MIN_LENGTH = 3
    RECIPE_NAME_MAX_LENGTH = 100
    RECIPE_DESCRIPTION_MAX_LENGTH = 1000
    RECIPE_INSTRUCTIONS_MAX_LENGTH = 2000
    RECIPE_SERVINGS_MIN = 1
    RECIPE_SERVINGS_MAX = 50
    RECIPE_WATER_MIN = 0
    RECIPE_WATER_MAX = 10000  # 10 liters max
    RECIPE_PREP_TIME_MIN = 0
    RECIPE_PREP_TIME_MAX = 1440  # 24 hours max
    RECIPE_COOK_TIME_MIN = 0
    RECIPE_COOK_TIME_MAX = 1440  # 24 hours max
    RECIPE_TOTAL_TIME_MAX = 2160  # 36 hours max
    RECIPE_RATING_MIN = 0.0
    RECIPE_RATING_MAX = 5.0
    RECIPE_VERSION_MIN = 1
    
    # Ingredient field limits
    INGREDIENT_NAME_MIN_LENGTH = 2
    INGREDIENT_NAME_MAX_LENGTH = 100
    INGREDIENT_BRAND_MAX_LENGTH = 100
    INGREDIENT_CATEGORY_MAX_LENGTH = 50
    INGREDIENT_BARCODE_MAX_LENGTH = 50
    INGREDIENT_PREPARATION_NOTES_MAX_LENGTH = 200
    
    # Nutritional value ranges (per 100g)
    NUTRITION_CALORIES_MIN = 0
    NUTRITION_CALORIES_MAX = 900  # Pure fats are ~900 kcal/100g
    NUTRITION_PROTEIN_MIN = 0
    NUTRITION_PROTEIN_MAX = 100
    NUTRITION_CARBS_MIN = 0
    NUTRITION_CARBS_MAX = 100
    NUTRITION_FATS_MIN = 0
    NUTRITION_FATS_MAX = 100
    NUTRITION_FIBER_MIN = 0
    NUTRITION_FIBER_MAX = 100
    NUTRITION_SUGARS_MIN = 0
    NUTRITION_SUGARS_MAX = 100
    NUTRITION_SALT_MIN = 0
    NUTRITION_SALT_MAX = 100
    NUTRITION_SODIUM_MIN = 0
    NUTRITION_SODIUM_MAX = 50000  # mg per 100g
    NUTRITION_CHOLESTEROL_MIN = 0
    NUTRITION_CHOLESTEROL_MAX = 5000  # mg per 100g
    NUTRITION_WATER_MIN = 0
    NUTRITION_WATER_MAX = 100
    NUTRITION_PHE_MIN = 0
    NUTRITION_PHE_MAX = 10000  # mg per 100g (for PKU)
    
    # Vitamin ranges (per 100g)
    VITAMIN_A_MIN = 0
    VITAMIN_A_MAX = 30000  # µg
    VITAMIN_B1_MIN = 0
    VITAMIN_B1_MAX = 100   # mg
    VITAMIN_B2_MIN = 0
    VITAMIN_B2_MAX = 100   # mg
    VITAMIN_B3_MIN = 0
    VITAMIN_B3_MAX = 100   # mg
    VITAMIN_B5_MIN = 0
    VITAMIN_B5_MAX = 100   # mg
    VITAMIN_B6_MIN = 0
    VITAMIN_B6_MAX = 100   # mg
    VITAMIN_B7_MIN = 0
    VITAMIN_B7_MAX = 1000  # µg
    VITAMIN_B9_MIN = 0
    VITAMIN_B9_MAX = 1000  # µg
    VITAMIN_B12_MIN = 0
    VITAMIN_B12_MAX = 1000 # µg
    VITAMIN_C_MIN = 0
    VITAMIN_C_MAX = 2000   # mg
    VITAMIN_D_MIN = 0
    VITAMIN_D_MAX = 250    # µg
    VITAMIN_E_MIN = 0
    VITAMIN_E_MAX = 1000   # mg
    VITAMIN_K_MIN = 0
    VITAMIN_K_MAX = 1000   # µg
    
    # Mineral ranges (per 100g)
    CALCIUM_MIN = 0
    CALCIUM_MAX = 5000     # mg
    IRON_MIN = 0
    IRON_MAX = 100         # mg
    MAGNESIUM_MIN = 0
    MAGNESIUM_MAX = 1000   # mg
    PHOSPHORUS_MIN = 0
    PHOSPHORUS_MAX = 2000  # mg
    POTASSIUM_MIN = 0
    POTASSIUM_MAX = 10000  # mg
    ZINC_MIN = 0
    ZINC_MAX = 100         # mg
    
    # Quantity limits
    QUANTITY_MIN = 0.001
    QUANTITY_MAX = 10000
    
    # File upload limits
    IMAGE_MAX_SIZE = 10 * 1024 * 1024  # 10MB
    IMAGE_MAX_WIDTH = 4096
    IMAGE_MAX_HEIGHT = 4096
    IMAGE_MIN_WIDTH = 100
    IMAGE_MIN_HEIGHT = 100
    
    # Valid units and their types
    VALID_UNITS = {
        'g': 'weight',
        'kg': 'weight',
        'mg': 'weight',
        'ml': 'volume',
        'l': 'volume',
        'dl': 'volume',
        'cl': 'volume',
        'cup': 'volume',
        'tbsp': 'volume',
        'tsp': 'volume',
        'piece': 'count',
        'pcs': 'count',
        'slice': 'count',
        'clove': 'count',
        'can': 'count',
        'package': 'count',
        'bottle': 'count'
    }
    
    # Unit conversion factors to grams/ml
    UNIT_CONVERSIONS = {
        # Weight conversions to grams
        'g': 1,
        'kg': 1000,
        'mg': 0.001,
        # Volume conversions to ml
        'ml': 1,
        'l': 1000,
        'dl': 100,
        'cl': 10,
        'cup': 240,
        'tbsp': 15,
        'tsp': 5,
        # Count units (no conversion)
        'piece': None,
        'pcs': None,
        'slice': None,
        'clove': None,
        'can': None,
        'package': None,
        'bottle': None
    }
    
    # Allowed image formats
    ALLOWED_IMAGE_FORMATS = {'JPEG', 'PNG', 'WebP', 'GIF'}
    ALLOWED_IMAGE_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.webp', '.gif'}
    
    # Recipe difficulty levels
    DIFFICULTY_LEVELS = {'easy', 'medium', 'hard'}
    
    # Recipe categories
    RECIPE_CATEGORIES = {
        'breakfast', 'lunch', 'dinner', 'snack', 'dessert', 'appetizer',
        'main_course', 'side_dish', 'soup', 'salad', 'beverage', 'sauce',
        'bread', 'pasta', 'rice', 'vegetarian', 'vegan', 'gluten_free',
        'low_carb', 'high_protein', 'quick', 'slow_cook', 'one_pot',
        'grilled', 'baked', 'fried', 'steamed', 'raw', 'fermented'
    }
    
    # Allergen types
    ALLERGEN_TYPES = {
        'gluten', 'dairy', 'eggs', 'fish', 'shellfish', 'tree_nuts',
        'peanuts', 'soy', 'sesame', 'sulfites', 'mustard', 'celery',
        'lupin', 'mollusks'
    }
    
    # Dietary flags
    DIETARY_FLAGS = {
        'vegetarian', 'vegan', 'gluten_free', 'dairy_free', 'egg_free',
        'nut_free', 'soy_free', 'kosher', 'halal', 'low_sodium',
        'low_fat', 'low_carb', 'high_protein', 'keto', 'paleo',
        'raw', 'organic', 'non_gmo', 'sugar_free', 'lactose_free'
    }


# =============================================================================
# CUSTOM VALIDATION EXCEPTIONS
# =============================================================================

class ValidationException(Exception):
    """Base exception for validation errors."""
    
    def __init__(self, message: str, field: str = None, code: str = None):
        super().__init__(message)
        self.message = message
        self.field = field
        self.code = code
        

class RecipeValidationError(ValidationException):
    """Exception for recipe validation errors."""
    pass


class IngredientValidationError(ValidationException):
    """Exception for ingredient validation errors."""
    pass


class NutritionalValidationError(ValidationException):
    """Exception for nutritional data validation errors."""
    pass


class QuantityValidationError(ValidationException):
    """Exception for quantity validation errors."""
    pass


class ImageValidationError(ValidationException):
    """Exception for image validation errors."""
    pass


class PermissionValidationError(ValidationException):
    """Exception for permission validation errors."""
    pass


class UnitValidationError(ValidationException):
    """Exception for unit validation errors."""
    pass


# =============================================================================
# VALIDATION HELPERS
# =============================================================================

class ValidationHelpers:
    """Helper functions for common validation patterns."""
    
    @staticmethod
    def is_valid_uuid(value: Any) -> bool:
        """Check if value is a valid UUID."""
        try:
            UUID(str(value))
            return True
        except (ValueError, TypeError):
            return False
    
    @staticmethod
    def is_valid_email(email: str) -> bool:
        """Check if email format is valid."""
        if not email or not isinstance(email, str):
            return False
        
        email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        return re.match(email_pattern, email.lower()) is not None
    
    @staticmethod
    def sanitize_string(value: str, max_length: int = None) -> str:
        """Sanitize string input by trimming and limiting length."""
        if not isinstance(value, str):
            return str(value)
        
        # Trim whitespace
        value = value.strip()
        
        # Limit length if specified
        if max_length and len(value) > max_length:
            value = value[:max_length]
        
        return value
    
    @staticmethod
    def is_positive_number(value: Any) -> bool:
        """Check if value is a positive number."""
        try:
            num = float(value)
            return num > 0
        except (ValueError, TypeError):
            return False
    
    @staticmethod
    def is_non_negative_number(value: Any) -> bool:
        """Check if value is a non-negative number."""
        try:
            num = float(value)
            return num >= 0
        except (ValueError, TypeError):
            return False
    
    @staticmethod
    def validate_decimal_precision(value: Decimal, max_places: int = 2) -> bool:
        """Check if decimal has acceptable precision."""
        if not isinstance(value, Decimal):
            return False
        
        # Get the number of decimal places
        return value.as_tuple().exponent >= -max_places
    
    @staticmethod
    def normalize_unit(unit: str) -> str:
        """Normalize unit string to lowercase and handle aliases."""
        if not unit:
            return 'g'  # Default unit
        
        unit = unit.lower().strip()
        
        # Handle common aliases
        unit_aliases = {
            'gram': 'g',
            'grams': 'g',
            'kilogram': 'kg',
            'kilograms': 'kg',
            'milliliter': 'ml',
            'milliliters': 'ml',
            'liter': 'l',
            'liters': 'l',
            'tablespoon': 'tbsp',
            'tablespoons': 'tbsp',
            'teaspoon': 'tsp',
            'teaspoons': 'tsp',
            'pieces': 'piece',
            'pc': 'piece',
            'pcs': 'piece'
        }
        
        return unit_aliases.get(unit, unit)
    
    @staticmethod
    def convert_to_base_unit(quantity: float, unit: str) -> Tuple[float, str]:
        """Convert quantity to base unit (g for weight, ml for volume)."""
        unit = ValidationHelpers.normalize_unit(unit)
        
        if unit in ValidationConstants.UNIT_CONVERSIONS:
            factor = ValidationConstants.UNIT_CONVERSIONS[unit]
            if factor is not None:
                unit_type = ValidationConstants.VALID_UNITS.get(unit, 'weight')
                base_unit = 'g' if unit_type == 'weight' else 'ml'
                return quantity * factor, base_unit
        
        # Return as-is if no conversion available
        return quantity, unit
    
    @staticmethod
    def is_realistic_nutritional_value(nutrient: str, value: float) -> bool:
        """Check if nutritional value is realistic."""
        ranges = {
            'calories': (ValidationConstants.NUTRITION_CALORIES_MIN, ValidationConstants.NUTRITION_CALORIES_MAX),
            'proteins': (ValidationConstants.NUTRITION_PROTEIN_MIN, ValidationConstants.NUTRITION_PROTEIN_MAX),
            'carbs': (ValidationConstants.NUTRITION_CARBS_MIN, ValidationConstants.NUTRITION_CARBS_MAX),
            'fats': (ValidationConstants.NUTRITION_FATS_MIN, ValidationConstants.NUTRITION_FATS_MAX),
            'fiber': (ValidationConstants.NUTRITION_FIBER_MIN, ValidationConstants.NUTRITION_FIBER_MAX),
            'sugars': (ValidationConstants.NUTRITION_SUGARS_MIN, ValidationConstants.NUTRITION_SUGARS_MAX),
            'salt': (ValidationConstants.NUTRITION_SALT_MIN, ValidationConstants.NUTRITION_SALT_MAX),
            'sodium': (ValidationConstants.NUTRITION_SODIUM_MIN, ValidationConstants.NUTRITION_SODIUM_MAX),
            'cholesterol': (ValidationConstants.NUTRITION_CHOLESTEROL_MIN, ValidationConstants.NUTRITION_CHOLESTEROL_MAX),
            'water': (ValidationConstants.NUTRITION_WATER_MIN, ValidationConstants.NUTRITION_WATER_MAX),
            'phe': (ValidationConstants.NUTRITION_PHE_MIN, ValidationConstants.NUTRITION_PHE_MAX),
        }
        
        if nutrient not in ranges:
            return True  # Unknown nutrient, assume valid
        
        min_val, max_val = ranges[nutrient]
        return min_val <= value <= max_val


# =============================================================================
# RECIPE VALIDATORS
# =============================================================================

class RecipeValidator:
    """Comprehensive recipe validation."""
    
    @staticmethod
    def validate_recipe_name(name: str) -> str:
        """Validate recipe name/title."""
        if not name or not isinstance(name, str):
            raise RecipeValidationError("Recipe name is required", "name", "required")
        
        name = ValidationHelpers.sanitize_string(name, ValidationConstants.RECIPE_NAME_MAX_LENGTH)
        
        if len(name) < ValidationConstants.RECIPE_NAME_MIN_LENGTH:
            raise RecipeValidationError(
                f"Recipe name must be at least {ValidationConstants.RECIPE_NAME_MIN_LENGTH} characters long",
                "name", "min_length"
            )
        
        if len(name) > ValidationConstants.RECIPE_NAME_MAX_LENGTH:
            raise RecipeValidationError(
                f"Recipe name cannot exceed {ValidationConstants.RECIPE_NAME_MAX_LENGTH} characters",
                "name", "max_length"
            )
        
        # Check for inappropriate content (basic check)
        if name.lower().strip() in ['test', 'untitled', 'recipe', '']:
            raise RecipeValidationError(
                "Recipe name must be descriptive", "name", "descriptive"
            )
        
        return name
    
    @staticmethod
    def validate_recipe_description(description: str) -> Optional[str]:
        """Validate recipe description."""
        if not description:
            return None
        
        if not isinstance(description, str):
            raise RecipeValidationError("Description must be a string", "description", "type")
        
        description = ValidationHelpers.sanitize_string(description, ValidationConstants.RECIPE_DESCRIPTION_MAX_LENGTH)
        
        if len(description) > ValidationConstants.RECIPE_DESCRIPTION_MAX_LENGTH:
            raise RecipeValidationError(
                f"Description cannot exceed {ValidationConstants.RECIPE_DESCRIPTION_MAX_LENGTH} characters",
                "description", "max_length"
            )
        
        return description
    
    @staticmethod
    def validate_recipe_instructions(instructions: str) -> Optional[str]:
        """Validate recipe instructions."""
        if not instructions:
            return None
        
        if not isinstance(instructions, str):
            raise RecipeValidationError("Instructions must be a string", "instructions", "type")
        
        instructions = ValidationHelpers.sanitize_string(instructions, ValidationConstants.RECIPE_INSTRUCTIONS_MAX_LENGTH)
        
        if len(instructions) > ValidationConstants.RECIPE_INSTRUCTIONS_MAX_LENGTH:
            raise RecipeValidationError(
                f"Instructions cannot exceed {ValidationConstants.RECIPE_INSTRUCTIONS_MAX_LENGTH} characters",
                "instructions", "max_length"
            )
        
        # Check for minimum content
        if len(instructions.strip()) < 10:
            raise RecipeValidationError(
                "Instructions must be at least 10 characters long", "instructions", "min_length"
            )
        
        return instructions
    
    @staticmethod
    def validate_recipe_times(prep_time: int = None, cook_time: int = None) -> Tuple[Optional[int], Optional[int]]:
        """Validate recipe preparation and cooking times."""
        if prep_time is not None:
            if not isinstance(prep_time, int) or prep_time < ValidationConstants.RECIPE_PREP_TIME_MIN:
                raise RecipeValidationError(
                    f"Preparation time must be at least {ValidationConstants.RECIPE_PREP_TIME_MIN} minutes",
                    "prep_time", "min_value"
                )
            
            if prep_time > ValidationConstants.RECIPE_PREP_TIME_MAX:
                raise RecipeValidationError(
                    f"Preparation time cannot exceed {ValidationConstants.RECIPE_PREP_TIME_MAX} minutes",
                    "prep_time", "max_value"
                )
        
        if cook_time is not None:
            if not isinstance(cook_time, int) or cook_time < ValidationConstants.RECIPE_COOK_TIME_MIN:
                raise RecipeValidationError(
                    f"Cooking time must be at least {ValidationConstants.RECIPE_COOK_TIME_MIN} minutes",
                    "cook_time", "min_value"
                )
            
            if cook_time > ValidationConstants.RECIPE_COOK_TIME_MAX:
                raise RecipeValidationError(
                    f"Cooking time cannot exceed {ValidationConstants.RECIPE_COOK_TIME_MAX} minutes",
                    "cook_time", "max_value"
                )
        
        # Validate total time
        if prep_time is not None and cook_time is not None:
            total_time = prep_time + cook_time
            if total_time > ValidationConstants.RECIPE_TOTAL_TIME_MAX:
                raise RecipeValidationError(
                    f"Total time cannot exceed {ValidationConstants.RECIPE_TOTAL_TIME_MAX} minutes",
                    "total_time", "max_value"
                )
        
        return prep_time, cook_time
    
    @staticmethod
    def validate_recipe_servings(servings: int) -> int:
        """Validate recipe servings."""
        if not isinstance(servings, int):
            raise RecipeValidationError("Servings must be an integer", "servings", "type")
        
        if servings < ValidationConstants.RECIPE_SERVINGS_MIN:
            raise RecipeValidationError(
                f"Servings must be at least {ValidationConstants.RECIPE_SERVINGS_MIN}",
                "servings", "min_value"
            )
        
        if servings > ValidationConstants.RECIPE_SERVINGS_MAX:
            raise RecipeValidationError(
                f"Servings cannot exceed {ValidationConstants.RECIPE_SERVINGS_MAX}",
                "servings", "max_value"
            )
        
        return servings
    
    @staticmethod
    def validate_recipe_water(water_ml: int) -> int:
        """Validate recipe water requirement."""
        if not isinstance(water_ml, int):
            raise RecipeValidationError("Water amount must be an integer", "water_ml", "type")
        
        if water_ml < ValidationConstants.RECIPE_WATER_MIN:
            raise RecipeValidationError(
                f"Water amount must be at least {ValidationConstants.RECIPE_WATER_MIN} ml",
                "water_ml", "min_value"
            )
        
        if water_ml > ValidationConstants.RECIPE_WATER_MAX:
            raise RecipeValidationError(
                f"Water amount cannot exceed {ValidationConstants.RECIPE_WATER_MAX} ml",
                "water_ml", "max_value"
            )
        
        return water_ml
    
    @staticmethod
    def validate_difficulty_level(difficulty: str) -> Optional[str]:
        """Validate recipe difficulty level."""
        if not difficulty:
            return None
        
        if not isinstance(difficulty, str):
            raise RecipeValidationError("Difficulty must be a string", "difficulty", "type")
        
        difficulty = difficulty.lower().strip()
        
        if difficulty not in ValidationConstants.DIFFICULTY_LEVELS:
            raise RecipeValidationError(
                f"Difficulty must be one of: {', '.join(ValidationConstants.DIFFICULTY_LEVELS)}",
                "difficulty", "invalid_choice"
            )
        
        return difficulty
    
    @staticmethod
    def validate_recipe_rating(rating: float, count: int = 0) -> Tuple[Optional[float], int]:
        """Validate recipe rating and count."""
        if rating is not None:
            if not isinstance(rating, (int, float, Decimal)):
                raise RecipeValidationError("Rating must be a number", "rating", "type")
            
            rating = float(rating)
            
            if rating < ValidationConstants.RECIPE_RATING_MIN:
                raise RecipeValidationError(
                    f"Rating must be at least {ValidationConstants.RECIPE_RATING_MIN}",
                    "rating", "min_value"
                )
            
            if rating > ValidationConstants.RECIPE_RATING_MAX:
                raise RecipeValidationError(
                    f"Rating cannot exceed {ValidationConstants.RECIPE_RATING_MAX}",
                    "rating", "max_value"
                )
        
        if not isinstance(count, int) or count < 0:
            raise RecipeValidationError("Rating count must be a non-negative integer", "rating_count", "type")
        
        # If there's a rating, there must be at least one count
        if rating is not None and count == 0:
            raise RecipeValidationError(
                "Rating count must be at least 1 when rating is provided", "rating_count", "consistency"
            )
        
        return rating, count
    
    @staticmethod
    def validate_recipe_categories(categories: List[str]) -> List[str]:
        """Validate recipe categories."""
        if not categories:
            return []
        
        if not isinstance(categories, list):
            raise RecipeValidationError("Categories must be a list", "categories", "type")
        
        validated_categories = []
        for category in categories:
            if not isinstance(category, str):
                raise RecipeValidationError("Each category must be a string", "categories", "type")
            
            category = category.lower().strip()
            
            if category not in ValidationConstants.RECIPE_CATEGORIES:
                raise RecipeValidationError(
                    f"Invalid category: {category}. Must be one of: {', '.join(sorted(ValidationConstants.RECIPE_CATEGORIES))}",
                    "categories", "invalid_choice"
                )
            
            if category not in validated_categories:
                validated_categories.append(category)
        
        return validated_categories


# =============================================================================
# INGREDIENT VALIDATORS
# =============================================================================

class IngredientValidator:
    """Comprehensive ingredient validation."""
    
    @staticmethod
    def validate_ingredient_name(name: str) -> str:
        """Validate ingredient name."""
        if not name or not isinstance(name, str):
            raise IngredientValidationError("Ingredient name is required", "name", "required")
        
        name = ValidationHelpers.sanitize_string(name, ValidationConstants.INGREDIENT_NAME_MAX_LENGTH)
        
        if len(name) < ValidationConstants.INGREDIENT_NAME_MIN_LENGTH:
            raise IngredientValidationError(
                f"Ingredient name must be at least {ValidationConstants.INGREDIENT_NAME_MIN_LENGTH} characters long",
                "name", "min_length"
            )
        
        if len(name) > ValidationConstants.INGREDIENT_NAME_MAX_LENGTH:
            raise IngredientValidationError(
                f"Ingredient name cannot exceed {ValidationConstants.INGREDIENT_NAME_MAX_LENGTH} characters",
                "name", "max_length"
            )
        
        return name
    
    @staticmethod
    def validate_ingredient_brand(brand: str) -> Optional[str]:
        """Validate ingredient brand."""
        if not brand:
            return None
        
        if not isinstance(brand, str):
            raise IngredientValidationError("Brand must be a string", "brand", "type")
        
        brand = ValidationHelpers.sanitize_string(brand, ValidationConstants.INGREDIENT_BRAND_MAX_LENGTH)
        
        if len(brand) > ValidationConstants.INGREDIENT_BRAND_MAX_LENGTH:
            raise IngredientValidationError(
                f"Brand cannot exceed {ValidationConstants.INGREDIENT_BRAND_MAX_LENGTH} characters",
                "brand", "max_length"
            )
        
        return brand
    
    @staticmethod
    def validate_ingredient_category(category: str) -> Optional[str]:
        """Validate ingredient category."""
        if not category:
            return None
        
        if not isinstance(category, str):
            raise IngredientValidationError("Category must be a string", "category", "type")
        
        category = ValidationHelpers.sanitize_string(category, ValidationConstants.INGREDIENT_CATEGORY_MAX_LENGTH)
        
        if len(category) > ValidationConstants.INGREDIENT_CATEGORY_MAX_LENGTH:
            raise IngredientValidationError(
                f"Category cannot exceed {ValidationConstants.INGREDIENT_CATEGORY_MAX_LENGTH} characters",
                "category", "max_length"
            )
        
        return category.lower()
    
    @staticmethod
    def validate_ingredient_barcode(barcode: str) -> Optional[str]:
        """Validate ingredient barcode."""
        if not barcode:
            return None
        
        if not isinstance(barcode, str):
            raise IngredientValidationError("Barcode must be a string", "barcode", "type")
        
        barcode = barcode.strip()
        
        if len(barcode) > ValidationConstants.INGREDIENT_BARCODE_MAX_LENGTH:
            raise IngredientValidationError(
                f"Barcode cannot exceed {ValidationConstants.INGREDIENT_BARCODE_MAX_LENGTH} characters",
                "barcode", "max_length"
            )
        
        # Basic barcode format validation (digits only)
        if not barcode.isdigit():
            raise IngredientValidationError(
                "Barcode must contain only digits", "barcode", "format"
            )
        
        # Common barcode lengths
        valid_lengths = [8, 12, 13, 14]  # UPC-A, EAN-13, etc.
        if len(barcode) not in valid_lengths:
            raise IngredientValidationError(
                f"Barcode must be {', '.join(map(str, valid_lengths))} digits long",
                "barcode", "length"
            )
        
        return barcode
    
    @staticmethod
    def validate_allergens(allergens: List[str]) -> List[str]:
        """Validate ingredient allergens."""
        if not allergens:
            return []
        
        if not isinstance(allergens, list):
            raise IngredientValidationError("Allergens must be a list", "allergens", "type")
        
        validated_allergens = []
        for allergen in allergens:
            if not isinstance(allergen, str):
                raise IngredientValidationError("Each allergen must be a string", "allergens", "type")
            
            allergen = allergen.lower().strip()
            
            if allergen not in ValidationConstants.ALLERGEN_TYPES:
                raise IngredientValidationError(
                    f"Invalid allergen: {allergen}. Must be one of: {', '.join(sorted(ValidationConstants.ALLERGEN_TYPES))}",
                    "allergens", "invalid_choice"
                )
            
            if allergen not in validated_allergens:
                validated_allergens.append(allergen)
        
        return validated_allergens
    
    @staticmethod
    def validate_dietary_flags(flags: Dict[str, bool]) -> Dict[str, bool]:
        """Validate ingredient dietary flags."""
        if not flags:
            return {}
        
        if not isinstance(flags, dict):
            raise IngredientValidationError("Dietary flags must be a dictionary", "dietary_flags", "type")
        
        validated_flags = {}
        for flag, value in flags.items():
            if not isinstance(flag, str):
                raise IngredientValidationError("Dietary flag names must be strings", "dietary_flags", "type")
            
            flag = flag.lower().strip()
            
            if flag not in ValidationConstants.DIETARY_FLAGS:
                raise IngredientValidationError(
                    f"Invalid dietary flag: {flag}. Must be one of: {', '.join(sorted(ValidationConstants.DIETARY_FLAGS))}",
                    "dietary_flags", "invalid_choice"
                )
            
            if not isinstance(value, bool):
                raise IngredientValidationError(
                    f"Dietary flag '{flag}' must be a boolean", "dietary_flags", "type"
                )
            
            validated_flags[flag] = value
        
        return validated_flags
    
    @staticmethod
    def validate_unit_conversions(conversions: Dict[str, float]) -> Dict[str, float]:
        """Validate ingredient unit conversions."""
        if not conversions:
            return {}
        
        if not isinstance(conversions, dict):
            raise IngredientValidationError("Unit conversions must be a dictionary", "unit_conversions", "type")
        
        validated_conversions = {}
        for unit, factor in conversions.items():
            if not isinstance(unit, str):
                raise IngredientValidationError("Unit names must be strings", "unit_conversions", "type")
            
            unit = ValidationHelpers.normalize_unit(unit)
            
            if unit not in ValidationConstants.VALID_UNITS:
                raise IngredientValidationError(
                    f"Invalid unit: {unit}. Must be one of: {', '.join(sorted(ValidationConstants.VALID_UNITS.keys()))}",
                    "unit_conversions", "invalid_choice"
                )
            
            if not isinstance(factor, (int, float)):
                raise IngredientValidationError(
                    f"Conversion factor for '{unit}' must be a number", "unit_conversions", "type"
                )
            
            if factor <= 0:
                raise IngredientValidationError(
                    f"Conversion factor for '{unit}' must be positive", "unit_conversions", "value"
                )
            
            validated_conversions[unit] = float(factor)
        
        return validated_conversions


# =============================================================================
# NUTRITIONAL VALIDATORS
# =============================================================================

class NutritionalValidator:
    """Comprehensive nutritional data validation."""
    
    @staticmethod
    def validate_nutritional_data(data: Dict[str, Any]) -> Dict[str, Any]:
        """Validate complete nutritional data."""
        if not data or not isinstance(data, dict):
            raise NutritionalValidationError("Nutritional data must be a dictionary", "nutritional_data", "type")
        
        validated_data = {}
        
        # Required fields
        required_fields = ['calories', 'proteins', 'carbs', 'fats']
        for field in required_fields:
            if field not in data:
                raise NutritionalValidationError(
                    f"Required nutritional field '{field}' is missing", field, "required"
                )
            
            value = NutritionalValidator.validate_nutrient_value(field, data[field])
            validated_data[field] = value
        
        # Optional fields
        optional_fields = [
            'fiber', 'sugars', 'salt', 'sodium', 'cholesterol', 'water', 'phe',
            'saturated_fats', 'trans_fats', 'monounsaturated_fats', 'polyunsaturated_fats',
            'calcium', 'iron', 'magnesium', 'phosphorus', 'potassium', 'zinc'
        ]
        
        for field in optional_fields:
            if field in data:
                value = NutritionalValidator.validate_nutrient_value(field, data[field])
                validated_data[field] = value
        
        # Validate vitamins
        vitamin_fields = [
            'vitamin_a', 'vitamin_b1', 'vitamin_b2', 'vitamin_b3', 'vitamin_b5',
            'vitamin_b6', 'vitamin_b7', 'vitamin_b9', 'vitamin_b12', 'vitamin_c',
            'vitamin_d', 'vitamin_e', 'vitamin_k'
        ]
        
        for field in vitamin_fields:
            if field in data:
                value = NutritionalValidator.validate_vitamin_value(field, data[field])
                validated_data[field] = value
        
        # Validate consistency
        NutritionalValidator.validate_nutritional_consistency(validated_data)
        
        return validated_data
    
    @staticmethod
    def validate_nutrient_value(nutrient: str, value: Any) -> float:
        """Validate individual nutrient value."""
        if value is None:
            return 0.0
        
        try:
            value = float(value)
        except (ValueError, TypeError):
            raise NutritionalValidationError(
                f"Nutrient '{nutrient}' must be a number", nutrient, "type"
            )
        
        if value < 0:
            raise NutritionalValidationError(
                f"Nutrient '{nutrient}' cannot be negative", nutrient, "negative"
            )
        
        if not ValidationHelpers.is_realistic_nutritional_value(nutrient, value):
            raise NutritionalValidationError(
                f"Nutrient '{nutrient}' value {value} is unrealistic", nutrient, "unrealistic"
            )
        
        return value
    
    @staticmethod
    def validate_vitamin_value(vitamin: str, value: Any) -> float:
        """Validate vitamin value with specific ranges."""
        if value is None:
            return 0.0
        
        try:
            value = float(value)
        except (ValueError, TypeError):
            raise NutritionalValidationError(
                f"Vitamin '{vitamin}' must be a number", vitamin, "type"
            )
        
        if value < 0:
            raise NutritionalValidationError(
                f"Vitamin '{vitamin}' cannot be negative", vitamin, "negative"
            )
        
        # Vitamin-specific ranges
        ranges = {
            'vitamin_a': (ValidationConstants.VITAMIN_A_MIN, ValidationConstants.VITAMIN_A_MAX),
            'vitamin_b1': (ValidationConstants.VITAMIN_B1_MIN, ValidationConstants.VITAMIN_B1_MAX),
            'vitamin_b2': (ValidationConstants.VITAMIN_B2_MIN, ValidationConstants.VITAMIN_B2_MAX),
            'vitamin_b3': (ValidationConstants.VITAMIN_B3_MIN, ValidationConstants.VITAMIN_B3_MAX),
            'vitamin_b5': (ValidationConstants.VITAMIN_B5_MIN, ValidationConstants.VITAMIN_B5_MAX),
            'vitamin_b6': (ValidationConstants.VITAMIN_B6_MIN, ValidationConstants.VITAMIN_B6_MAX),
            'vitamin_b7': (ValidationConstants.VITAMIN_B7_MIN, ValidationConstants.VITAMIN_B7_MAX),
            'vitamin_b9': (ValidationConstants.VITAMIN_B9_MIN, ValidationConstants.VITAMIN_B9_MAX),
            'vitamin_b12': (ValidationConstants.VITAMIN_B12_MIN, ValidationConstants.VITAMIN_B12_MAX),
            'vitamin_c': (ValidationConstants.VITAMIN_C_MIN, ValidationConstants.VITAMIN_C_MAX),
            'vitamin_d': (ValidationConstants.VITAMIN_D_MIN, ValidationConstants.VITAMIN_D_MAX),
            'vitamin_e': (ValidationConstants.VITAMIN_E_MIN, ValidationConstants.VITAMIN_E_MAX),
            'vitamin_k': (ValidationConstants.VITAMIN_K_MIN, ValidationConstants.VITAMIN_K_MAX),
        }
        
        if vitamin in ranges:
            min_val, max_val = ranges[vitamin]
            if not (min_val <= value <= max_val):
                raise NutritionalValidationError(
                    f"Vitamin '{vitamin}' value {value} is outside valid range ({min_val}-{max_val})",
                    vitamin, "range"
                )
        
        return value
    
    @staticmethod
    def validate_nutritional_consistency(data: Dict[str, float]) -> None:
        """Validate nutritional data consistency."""
        # Check if macronutrient totals make sense
        proteins = data.get('proteins', 0)
        carbs = data.get('carbs', 0)
        fats = data.get('fats', 0)
        calories = data.get('calories', 0)
        
        # Calculate theoretical calories (4 kcal/g protein, 4 kcal/g carbs, 9 kcal/g fats)
        theoretical_calories = (proteins * 4) + (carbs * 4) + (fats * 9)
        
        # Allow 20% tolerance for rounding and other factors
        if abs(calories - theoretical_calories) > theoretical_calories * 0.2:
            raise NutritionalValidationError(
                f"Calorie count ({calories}) doesn't match macronutrient composition (expected ~{theoretical_calories:.1f})",
                "calories", "consistency"
            )
        
        # Check if fiber is not more than total carbs
        fiber = data.get('fiber', 0)
        if fiber > carbs:
            raise NutritionalValidationError(
                f"Fiber ({fiber}g) cannot exceed total carbohydrates ({carbs}g)",
                "fiber", "consistency"
            )
        
        # Check if sugars are not more than total carbs
        sugars = data.get('sugars', 0)
        if sugars > carbs:
            raise NutritionalValidationError(
                f"Sugars ({sugars}g) cannot exceed total carbohydrates ({carbs}g)",
                "sugars", "consistency"
            )
        
        # Check if saturated fats are not more than total fats
        saturated_fats = data.get('saturated_fats', 0)
        if saturated_fats > fats:
            raise NutritionalValidationError(
                f"Saturated fats ({saturated_fats}g) cannot exceed total fats ({fats}g)",
                "saturated_fats", "consistency"
            )
        
        # Check if sum of fat types doesn't exceed total fats
        trans_fats = data.get('trans_fats', 0)
        mono_fats = data.get('monounsaturated_fats', 0)
        poly_fats = data.get('polyunsaturated_fats', 0)
        
        total_fat_types = saturated_fats + trans_fats + mono_fats + poly_fats
        if total_fat_types > fats * 1.1:  # 10% tolerance
            raise NutritionalValidationError(
                f"Sum of fat types ({total_fat_types:.1f}g) exceeds total fats ({fats}g)",
                "fats", "consistency"
            )


# =============================================================================
# QUANTITY VALIDATORS
# =============================================================================

class QuantityValidator:
    """Comprehensive quantity validation."""
    
    @staticmethod
    def validate_quantity_value(quantity: Any) -> Decimal:
        """Validate quantity value."""
        if quantity is None:
            raise QuantityValidationError("Quantity is required", "quantity", "required")
        
        try:
            if isinstance(quantity, str):
                quantity = Decimal(quantity)
            elif isinstance(quantity, (int, float)):
                quantity = Decimal(str(quantity))
            elif not isinstance(quantity, Decimal):
                raise ValueError()
        except (ValueError, InvalidOperation):
            raise QuantityValidationError("Quantity must be a valid number", "quantity", "type")
        
        if quantity <= 0:
            raise QuantityValidationError("Quantity must be positive", "quantity", "positive")
        
        if quantity < Decimal(str(ValidationConstants.QUANTITY_MIN)):
            raise QuantityValidationError(
                f"Quantity must be at least {ValidationConstants.QUANTITY_MIN}",
                "quantity", "min_value"
            )
        
        if quantity > Decimal(str(ValidationConstants.QUANTITY_MAX)):
            raise QuantityValidationError(
                f"Quantity cannot exceed {ValidationConstants.QUANTITY_MAX}",
                "quantity", "max_value"
            )
        
        # Check decimal precision (max 3 decimal places)
        if not ValidationHelpers.validate_decimal_precision(quantity, 3):
            raise QuantityValidationError(
                "Quantity cannot have more than 3 decimal places", "quantity", "precision"
            )
        
        return quantity
    
    @staticmethod
    def validate_unit(unit: str) -> str:
        """Validate measurement unit."""
        if not unit or not isinstance(unit, str):
            raise UnitValidationError("Unit is required", "unit", "required")
        
        unit = ValidationHelpers.normalize_unit(unit)
        
        if unit not in ValidationConstants.VALID_UNITS:
            raise UnitValidationError(
                f"Invalid unit: {unit}. Must be one of: {', '.join(sorted(ValidationConstants.VALID_UNITS.keys()))}",
                "unit", "invalid_choice"
            )
        
        return unit
    
    @staticmethod
    def validate_quantity_unit_combination(quantity: Decimal, unit: str) -> Tuple[Decimal, str]:
        """Validate quantity and unit combination."""
        quantity = QuantityValidator.validate_quantity_value(quantity)
        unit = QuantityValidator.validate_unit(unit)
        
        # Check for unrealistic combinations
        if unit == 'kg' and quantity > 10:
            raise QuantityValidationError(
                f"Quantity {quantity} kg seems unrealistic for a single ingredient",
                "quantity", "unrealistic"
            )
        
        if unit == 'l' and quantity > 10:
            raise QuantityValidationError(
                f"Quantity {quantity} l seems unrealistic for a single ingredient",
                "quantity", "unrealistic"
            )
        
        if unit in ['cup', 'tbsp', 'tsp'] and quantity > 100:
            raise QuantityValidationError(
                f"Quantity {quantity} {unit} seems unrealistic",
                "quantity", "unrealistic"
            )
        
        return quantity, unit
    
    @staticmethod
    def validate_preparation_notes(notes: str) -> Optional[str]:
        """Validate preparation notes."""
        if not notes:
            return None
        
        if not isinstance(notes, str):
            raise QuantityValidationError("Preparation notes must be a string", "preparation_notes", "type")
        
        notes = ValidationHelpers.sanitize_string(notes, ValidationConstants.INGREDIENT_PREPARATION_NOTES_MAX_LENGTH)
        
        if len(notes) > ValidationConstants.INGREDIENT_PREPARATION_NOTES_MAX_LENGTH:
            raise QuantityValidationError(
                f"Preparation notes cannot exceed {ValidationConstants.INGREDIENT_PREPARATION_NOTES_MAX_LENGTH} characters",
                "preparation_notes", "max_length"
            )
        
        return notes


# =============================================================================
# IMAGE VALIDATORS
# =============================================================================

class ImageValidator:
    """Comprehensive image file validation."""
    
    @staticmethod
    def validate_image_file(file_path: str, check_content: bool = True) -> Dict[str, Any]:
        """Validate image file."""
        if not file_path:
            raise ImageValidationError("File path is required", "file_path", "required")
        
        file_path = Path(file_path)
        
        # Check if file exists
        if not file_path.exists():
            raise ImageValidationError("File does not exist", "file_path", "not_found")
        
        # Check file extension
        if file_path.suffix.lower() not in ValidationConstants.ALLOWED_IMAGE_EXTENSIONS:
            raise ImageValidationError(
                f"Invalid file extension. Allowed: {', '.join(ValidationConstants.ALLOWED_IMAGE_EXTENSIONS)}",
                "file_path", "invalid_extension"
            )
        
        # Check file size
        file_size = file_path.stat().st_size
        if file_size > ValidationConstants.IMAGE_MAX_SIZE:
            raise ImageValidationError(
                f"File size ({file_size} bytes) exceeds maximum allowed size ({ValidationConstants.IMAGE_MAX_SIZE} bytes)",
                "file_path", "file_too_large"
            )
        
        if file_size == 0:
            raise ImageValidationError("File is empty", "file_path", "empty_file")
        
        result = {
            'file_path': str(file_path),
            'file_size': file_size,
            'extension': file_path.suffix.lower()
        }
        
        # Check file content if requested
        if check_content:
            if not PIL_AVAILABLE:
                raise ImageValidationError(
                    "PIL (Pillow) is required for image content validation", "file_path", "missing_dependency"
                )
            
            try:
                with Image.open(file_path) as img:
                    # Verify it's a valid image
                    img.verify()
                    
                    # Reopen for getting info (verify() closes the file)
                    with Image.open(file_path) as img:
                        width, height = img.size
                        format_name = img.format
                        
                        # Check format
                        if format_name not in ValidationConstants.ALLOWED_IMAGE_FORMATS:
                            raise ImageValidationError(
                                f"Invalid image format: {format_name}. Allowed: {', '.join(ValidationConstants.ALLOWED_IMAGE_FORMATS)}",
                                "file_path", "invalid_format"
                            )
                        
                        # Check dimensions
                        if width < ValidationConstants.IMAGE_MIN_WIDTH or height < ValidationConstants.IMAGE_MIN_HEIGHT:
                            raise ImageValidationError(
                                f"Image dimensions ({width}x{height}) are too small. Minimum: {ValidationConstants.IMAGE_MIN_WIDTH}x{ValidationConstants.IMAGE_MIN_HEIGHT}",
                                "file_path", "dimensions_too_small"
                            )
                        
                        if width > ValidationConstants.IMAGE_MAX_WIDTH or height > ValidationConstants.IMAGE_MAX_HEIGHT:
                            raise ImageValidationError(
                                f"Image dimensions ({width}x{height}) are too large. Maximum: {ValidationConstants.IMAGE_MAX_WIDTH}x{ValidationConstants.IMAGE_MAX_HEIGHT}",
                                "file_path", "dimensions_too_large"
                            )
                        
                        # Check aspect ratio (prevent extremely wide or tall images)
                        aspect_ratio = width / height
                        if aspect_ratio > 10 or aspect_ratio < 0.1:
                            raise ImageValidationError(
                                f"Image aspect ratio ({aspect_ratio:.2f}) is too extreme",
                                "file_path", "invalid_aspect_ratio"
                            )
                        
                        result.update({
                            'width': width,
                            'height': height,
                            'format': format_name,
                            'aspect_ratio': aspect_ratio
                        })
                        
            except Exception as e:
                if isinstance(e, ImageValidationError):
                    raise
                raise ImageValidationError(
                    f"Invalid image file: {str(e)}", "file_path", "invalid_image"
                )
        
        return result
    
    @staticmethod
    def validate_image_upload(file_content: bytes, filename: str) -> Dict[str, Any]:
        """Validate image upload from bytes."""
        if not file_content:
            raise ImageValidationError("File content is required", "file_content", "required")
        
        if not filename:
            raise ImageValidationError("Filename is required", "filename", "required")
        
        # Check file size
        file_size = len(file_content)
        if file_size > ValidationConstants.IMAGE_MAX_SIZE:
            raise ImageValidationError(
                f"File size ({file_size} bytes) exceeds maximum allowed size ({ValidationConstants.IMAGE_MAX_SIZE} bytes)",
                "file_content", "file_too_large"
            )
        
        # Check file extension
        file_path = Path(filename)
        if file_path.suffix.lower() not in ValidationConstants.ALLOWED_IMAGE_EXTENSIONS:
            raise ImageValidationError(
                f"Invalid file extension. Allowed: {', '.join(ValidationConstants.ALLOWED_IMAGE_EXTENSIONS)}",
                "filename", "invalid_extension"
            )
        
        # Validate image content
        if not PIL_AVAILABLE:
            raise ImageValidationError(
                "PIL (Pillow) is required for image content validation", "file_content", "missing_dependency"
            )
        
        try:
            from io import BytesIO
            with Image.open(BytesIO(file_content)) as img:
                img.verify()
                
                # Reopen for getting info
                with Image.open(BytesIO(file_content)) as img:
                    width, height = img.size
                    format_name = img.format
                    
                    # Check format
                    if format_name not in ValidationConstants.ALLOWED_IMAGE_FORMATS:
                        raise ImageValidationError(
                            f"Invalid image format: {format_name}. Allowed: {', '.join(ValidationConstants.ALLOWED_IMAGE_FORMATS)}",
                            "file_content", "invalid_format"
                        )
                    
                    # Check dimensions
                    if width < ValidationConstants.IMAGE_MIN_WIDTH or height < ValidationConstants.IMAGE_MIN_HEIGHT:
                        raise ImageValidationError(
                            f"Image dimensions ({width}x{height}) are too small. Minimum: {ValidationConstants.IMAGE_MIN_WIDTH}x{ValidationConstants.IMAGE_MIN_HEIGHT}",
                            "file_content", "dimensions_too_small"
                        )
                    
                    if width > ValidationConstants.IMAGE_MAX_WIDTH or height > ValidationConstants.IMAGE_MAX_HEIGHT:
                        raise ImageValidationError(
                            f"Image dimensions ({width}x{height}) are too large. Maximum: {ValidationConstants.IMAGE_MAX_WIDTH}x{ValidationConstants.IMAGE_MAX_HEIGHT}",
                            "file_content", "dimensions_too_large"
                        )
                    
                    aspect_ratio = width / height
                    if aspect_ratio > 10 or aspect_ratio < 0.1:
                        raise ImageValidationError(
                            f"Image aspect ratio ({aspect_ratio:.2f}) is too extreme",
                            "file_content", "invalid_aspect_ratio"
                        )
                    
                    return {
                        'filename': filename,
                        'file_size': file_size,
                        'width': width,
                        'height': height,
                        'format': format_name,
                        'aspect_ratio': aspect_ratio,
                        'extension': file_path.suffix.lower()
                    }
                    
        except Exception as e:
            if isinstance(e, ImageValidationError):
                raise
            raise ImageValidationError(
                f"Invalid image file: {str(e)}", "file_content", "invalid_image"
            )


# =============================================================================
# PERMISSION VALIDATORS
# =============================================================================

class PermissionValidator:
    """User permission validation."""
    
    @staticmethod
    def validate_user_id(user_id: Any) -> UUID:
        """Validate user ID."""
        if not user_id:
            raise PermissionValidationError("User ID is required", "user_id", "required")
        
        if not ValidationHelpers.is_valid_uuid(user_id):
            raise PermissionValidationError("Invalid user ID format", "user_id", "invalid_format")
        
        return UUID(str(user_id))
    
    @staticmethod
    def validate_recipe_ownership(user_id: UUID, recipe_user_id: UUID) -> bool:
        """Validate if user owns the recipe."""
        if user_id != recipe_user_id:
            raise PermissionValidationError(
                "User does not have permission to modify this recipe",
                "user_id", "insufficient_permission"
            )
        return True
    
    @staticmethod
    def validate_recipe_access(user_id: UUID, recipe_user_id: UUID, is_public: bool) -> bool:
        """Validate if user can access the recipe."""
        if user_id == recipe_user_id:
            return True  # Owner can always access
        
        if not is_public:
            raise PermissionValidationError(
                "User does not have permission to access this recipe",
                "user_id", "insufficient_permission"
            )
        
        return True
    
    @staticmethod
    def validate_admin_permission(user_role: str) -> bool:
        """Validate if user has admin permissions."""
        if user_role != 'admin':
            raise PermissionValidationError(
                "Admin permissions required", "user_role", "insufficient_permission"
            )
        return True
    
    @staticmethod
    def validate_ingredient_ownership(user_id: UUID, ingredient_user_id: Optional[UUID], is_global: bool) -> bool:
        """Validate if user can modify the ingredient."""
        if is_global:
            raise PermissionValidationError(
                "Cannot modify global ingredients", "user_id", "insufficient_permission"
            )
        
        if ingredient_user_id and user_id != ingredient_user_id:
            raise PermissionValidationError(
                "User does not have permission to modify this ingredient",
                "user_id", "insufficient_permission"
            )
        
        return True
    
    @staticmethod
    def validate_recipe_limits(user_recipe_count: int, max_recipes: int = 100) -> bool:
        """Validate if user can create more recipes."""
        if user_recipe_count >= max_recipes:
            raise PermissionValidationError(
                f"User has reached the maximum number of recipes ({max_recipes})",
                "recipe_count", "limit_exceeded"
            )
        return True
    
    @staticmethod
    def validate_user_active(is_active: bool, is_archived: bool) -> bool:
        """Validate if user account is active."""
        if not is_active:
            raise PermissionValidationError(
                "User account is not active", "is_active", "account_inactive"
            )
        
        if is_archived:
            raise PermissionValidationError(
                "User account is archived", "is_archived", "account_archived"
            )
        
        return True
    
    @staticmethod
    def validate_email_verified(email_verified: bool) -> bool:
        """Validate if user email is verified."""
        if not email_verified:
            raise PermissionValidationError(
                "Email verification required", "email_verified", "email_not_verified"
            )
        return True


# =============================================================================
# COMPREHENSIVE VALIDATOR CLASS
# =============================================================================

class JidelnicekValidator:
    """Main validator class that combines all validation functionality."""
    
    def __init__(self, db_session: Session = None):
        """Initialize validator with optional database session."""
        self.db_session = db_session
        self.recipe_validator = RecipeValidator()
        self.ingredient_validator = IngredientValidator()
        self.nutritional_validator = NutritionalValidator()
        self.quantity_validator = QuantityValidator()
        self.image_validator = ImageValidator()
        self.permission_validator = PermissionValidator()
    
    def validate_recipe_data(self, data: Dict[str, Any], user_id: UUID = None) -> Dict[str, Any]:
        """Validate complete recipe data."""
        validated_data = {}
        
        # Basic recipe fields
        if 'name' in data:
            validated_data['name'] = self.recipe_validator.validate_recipe_name(data['name'])
        
        if 'description' in data:
            validated_data['description'] = self.recipe_validator.validate_recipe_description(data['description'])
        
        if 'instructions' in data:
            validated_data['instructions'] = self.recipe_validator.validate_recipe_instructions(data['instructions'])
        
        if 'prep_time_minutes' in data or 'cook_time_minutes' in data:
            prep_time, cook_time = self.recipe_validator.validate_recipe_times(
                data.get('prep_time_minutes'),
                data.get('cook_time_minutes')
            )
            if prep_time is not None:
                validated_data['prep_time_minutes'] = prep_time
            if cook_time is not None:
                validated_data['cook_time_minutes'] = cook_time
        
        if 'servings' in data:
            validated_data['servings'] = self.recipe_validator.validate_recipe_servings(data['servings'])
        
        if 'water_ml' in data:
            validated_data['water_ml'] = self.recipe_validator.validate_recipe_water(data['water_ml'])
        
        if 'difficulty_level' in data:
            validated_data['difficulty_level'] = self.recipe_validator.validate_difficulty_level(data['difficulty_level'])
        
        if 'rating_average' in data or 'rating_count' in data:
            rating, count = self.recipe_validator.validate_recipe_rating(
                data.get('rating_average'),
                data.get('rating_count', 0)
            )
            if rating is not None:
                validated_data['rating_average'] = rating
            validated_data['rating_count'] = count
        
        if 'categories' in data:
            validated_data['categories'] = self.recipe_validator.validate_recipe_categories(data['categories'])
        
        # Validate user permissions if provided
        if user_id:
            self.permission_validator.validate_user_id(user_id)
        
        return validated_data
    
    def validate_ingredient_data(self, data: Dict[str, Any], user_id: UUID = None) -> Dict[str, Any]:
        """Validate complete ingredient data."""
        validated_data = {}
        
        # Basic ingredient fields
        if 'name' in data:
            validated_data['name'] = self.ingredient_validator.validate_ingredient_name(data['name'])
        
        if 'brand' in data:
            validated_data['brand'] = self.ingredient_validator.validate_ingredient_brand(data['brand'])
        
        if 'category' in data:
            validated_data['category'] = self.ingredient_validator.validate_ingredient_category(data['category'])
        
        if 'barcode' in data:
            validated_data['barcode'] = self.ingredient_validator.validate_ingredient_barcode(data['barcode'])
        
        if 'allergens' in data:
            validated_data['allergens'] = self.ingredient_validator.validate_allergens(data['allergens'])
        
        if 'dietary_flags' in data:
            validated_data['dietary_flags'] = self.ingredient_validator.validate_dietary_flags(data['dietary_flags'])
        
        if 'unit_conversions' in data:
            validated_data['unit_conversions'] = self.ingredient_validator.validate_unit_conversions(data['unit_conversions'])
        
        if 'nutritional_data' in data:
            validated_data['nutritional_data'] = self.nutritional_validator.validate_nutritional_data(data['nutritional_data'])
        
        # Validate user permissions if provided
        if user_id:
            self.permission_validator.validate_user_id(user_id)
        
        return validated_data
    
    def validate_recipe_ingredient_data(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Validate recipe ingredient relationship data."""
        validated_data = {}
        
        if 'quantity' in data and 'unit' in data:
            quantity, unit = self.quantity_validator.validate_quantity_unit_combination(
                data['quantity'], data['unit']
            )
            validated_data['quantity'] = quantity
            validated_data['unit'] = unit
        
        if 'preparation_notes' in data:
            validated_data['preparation_notes'] = self.quantity_validator.validate_preparation_notes(
                data['preparation_notes']
            )
        
        if 'is_optional' in data:
            validated_data['is_optional'] = bool(data['is_optional'])
        
        if 'display_order' in data:
            order = data['display_order']
            if not isinstance(order, int) or order < 0:
                raise ValidationException("Display order must be a non-negative integer", "display_order", "type")
            validated_data['display_order'] = order
        
        return validated_data
    
    def validate_user_permissions(self, user_id: UUID, target_user_id: UUID = None, 
                                 is_public: bool = False, user_role: str = 'user',
                                 is_active: bool = True, is_archived: bool = False,
                                 email_verified: bool = True) -> bool:
        """Validate comprehensive user permissions."""
        # Validate user is active
        self.permission_validator.validate_user_active(is_active, is_archived)
        
        # Validate email is verified
        self.permission_validator.validate_email_verified(email_verified)
        
        # Validate access permissions
        if target_user_id:
            self.permission_validator.validate_recipe_access(user_id, target_user_id, is_public)
        
        return True
    
    def get_validation_summary(self) -> Dict[str, Any]:
        """Get a summary of validation rules and constants."""
        return {
            'recipe_limits': {
                'name_length': f"{ValidationConstants.RECIPE_NAME_MIN_LENGTH}-{ValidationConstants.RECIPE_NAME_MAX_LENGTH}",
                'description_length': f"0-{ValidationConstants.RECIPE_DESCRIPTION_MAX_LENGTH}",
                'instructions_length': f"10-{ValidationConstants.RECIPE_INSTRUCTIONS_MAX_LENGTH}",
                'servings_range': f"{ValidationConstants.RECIPE_SERVINGS_MIN}-{ValidationConstants.RECIPE_SERVINGS_MAX}",
                'time_range': f"{ValidationConstants.RECIPE_PREP_TIME_MIN}-{ValidationConstants.RECIPE_PREP_TIME_MAX} minutes",
                'water_range': f"{ValidationConstants.RECIPE_WATER_MIN}-{ValidationConstants.RECIPE_WATER_MAX} ml",
                'rating_range': f"{ValidationConstants.RECIPE_RATING_MIN}-{ValidationConstants.RECIPE_RATING_MAX}",
                'difficulty_levels': list(ValidationConstants.DIFFICULTY_LEVELS),
                'categories': list(ValidationConstants.RECIPE_CATEGORIES)
            },
            'ingredient_limits': {
                'name_length': f"{ValidationConstants.INGREDIENT_NAME_MIN_LENGTH}-{ValidationConstants.INGREDIENT_NAME_MAX_LENGTH}",
                'brand_length': f"0-{ValidationConstants.INGREDIENT_BRAND_MAX_LENGTH}",
                'category_length': f"0-{ValidationConstants.INGREDIENT_CATEGORY_MAX_LENGTH}",
                'barcode_length': f"0-{ValidationConstants.INGREDIENT_BARCODE_MAX_LENGTH}",
                'allergens': list(ValidationConstants.ALLERGEN_TYPES),
                'dietary_flags': list(ValidationConstants.DIETARY_FLAGS)
            },
            'quantity_limits': {
                'range': f"{ValidationConstants.QUANTITY_MIN}-{ValidationConstants.QUANTITY_MAX}",
                'precision': "3 decimal places",
                'valid_units': list(ValidationConstants.VALID_UNITS.keys())
            },
            'image_limits': {
                'max_size': f"{ValidationConstants.IMAGE_MAX_SIZE} bytes",
                'dimensions': f"{ValidationConstants.IMAGE_MIN_WIDTH}x{ValidationConstants.IMAGE_MIN_HEIGHT} to {ValidationConstants.IMAGE_MAX_WIDTH}x{ValidationConstants.IMAGE_MAX_HEIGHT}",
                'formats': list(ValidationConstants.ALLOWED_IMAGE_FORMATS),
                'extensions': list(ValidationConstants.ALLOWED_IMAGE_EXTENSIONS)
            },
            'nutritional_ranges': {
                'calories': f"{ValidationConstants.NUTRITION_CALORIES_MIN}-{ValidationConstants.NUTRITION_CALORIES_MAX}",
                'macronutrients': f"{ValidationConstants.NUTRITION_PROTEIN_MIN}-{ValidationConstants.NUTRITION_PROTEIN_MAX}g",
                'required_fields': ['calories', 'proteins', 'carbs', 'fats']
            }
        }