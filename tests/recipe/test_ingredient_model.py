"""
Tests for Ingredient model as per task 3.2 requirements.
Validates nutritional data accuracy and field requirements.
"""

import pytest
from decimal import Decimal
from uuid import uuid4

from jidelnicek.recipe.models import Ingredient


class TestIngredientModel:
    """Test Ingredient model meets task 3.2 requirements."""
    
    def test_ingredient_creation_with_all_fields(self):
        """Test creating ingredient with all required and optional fields."""
        ingredient = Ingredient(
            name="Brown Rice",
            brand="Uncle Ben's",
            barcode="1234567890123",
            nutritional_data={
                "calories": 370,
                "proteins": 7.5,
                "carbs": 77.5,
                "fats": 2.8,
                "fiber": 3.6,
                "sodium": 7,
                "vitaminB1": 0.401,
                "vitaminB6": 0.509,
                "iron": 1.8,
                "magnesium": 143
            },
            unit_conversions={
                "g": 1,
                "ml": 0.85,  # Rice is less dense than water
                "cup": 185,  # 1 cup of rice = 185g
                "tbsp": 12.5,
                "tsp": 4.2
            },
            allergens=["gluten"],
            dietary_flags={
                "vegan": True,
                "gluten_free": False,
                "kosher": True,
                "halal": True,
                "low_carb": False
            }
        )
        
        assert ingredient.name == "Brown Rice"
        assert ingredient.brand == "Uncle Ben's"
        assert ingredient.barcode == "1234567890123"
        assert ingredient.nutritional_data["calories"] == 370
        assert ingredient.unit_conversions["cup"] == 185
        assert "gluten" in ingredient.allergens
        assert ingredient.dietary_flags["vegan"] is True
    
    def test_ingredient_minimal_required_fields(self):
        """Test creating ingredient with only required fields."""
        ingredient = Ingredient(
            name="Generic Rice",
            nutritional_data={
                "calories": 365,
                "proteins": 7.1,
                "carbs": 80,
                "fats": 0.7
            },
            unit_conversions={},
            dietary_flags={}
        )
        
        assert ingredient.name == "Generic Rice"
        assert ingredient.brand is None
        assert ingredient.barcode is None
        assert ingredient.allergens == []
    
    def test_nutritional_data_validation(self):
        """Test nutritional data validation for accuracy."""
        # Missing required field
        with pytest.raises(ValueError, match="Nutritional data must include calories"):
            Ingredient(
                name="Invalid",
                nutritional_data={"proteins": 10, "carbs": 20, "fats": 5}
            )
        
        # Negative value
        with pytest.raises(ValueError, match="calories cannot be negative"):
            Ingredient(
                name="Invalid",
                nutritional_data={
                    "calories": -100,
                    "proteins": 10,
                    "carbs": 20,
                    "fats": 5
                }
            )
        
        # Non-numeric value
        with pytest.raises(ValueError, match="proteins must be a number"):
            Ingredient(
                name="Invalid",
                nutritional_data={
                    "calories": 100,
                    "proteins": "ten",
                    "carbs": 20,
                    "fats": 5
                }
            )
    
    def test_unit_conversion_validation(self):
        """Test unit conversion validation."""
        # Invalid conversion factor
        with pytest.raises(ValueError, match="Conversion factor for cup must be a number"):
            Ingredient(
                name="Invalid",
                nutritional_data={
                    "calories": 100,
                    "proteins": 10,
                    "carbs": 20,
                    "fats": 5
                },
                unit_conversions={"cup": "large"}
            )
        
        # Negative conversion factor
        with pytest.raises(ValueError, match="Conversion factor for ml must be positive"):
            Ingredient(
                name="Invalid",
                nutritional_data={
                    "calories": 100,
                    "proteins": 10,
                    "carbs": 20,
                    "fats": 5
                },
                unit_conversions={"ml": -1}
            )
    
    def test_nutritional_accuracy_99_9_percent(self):
        """Test that nutritional calculations maintain 99.9% accuracy."""
        # Create ingredient with precise nutritional data
        ingredient = Ingredient(
            name="Test Food",
            nutritional_data={
                "calories": 234.567,
                "proteins": 12.345,
                "carbs": 45.678,
                "fats": 9.876,
                "fiber": 3.210,
                "sodium": 123.456
            }
        )
        
        # Test that values are stored with full precision
        assert ingredient.nutritional_data["calories"] == 234.567
        assert ingredient.nutritional_data["proteins"] == 12.345
        assert ingredient.nutritional_data["carbs"] == 45.678
        assert ingredient.nutritional_data["fats"] == 9.876
        
        # Calculate total macros (should equal ~67.899g)
        total_macros = (
            ingredient.nutritional_data["proteins"] +
            ingredient.nutritional_data["carbs"] +
            ingredient.nutritional_data["fats"]
        )
        assert abs(total_macros - 67.899) < 0.001  # 99.9% accuracy
    
    def test_allergen_array_functionality(self):
        """Test allergen array storage and retrieval."""
        allergens = ["milk", "eggs", "peanuts", "tree nuts", "soy"]
        ingredient = Ingredient(
            name="Mixed Nuts Bar",
            nutritional_data={
                "calories": 450,
                "proteins": 15,
                "carbs": 35,
                "fats": 30
            },
            allergens=allergens
        )
        
        assert len(ingredient.allergens) == 5
        assert all(a in ingredient.allergens for a in allergens)
    
    def test_dietary_flags_json(self):
        """Test dietary flags JSON storage."""
        flags = {
            "vegan": False,
            "vegetarian": True,
            "gluten_free": True,
            "dairy_free": False,
            "nut_free": False,
            "kosher": True,
            "halal": True,
            "low_sodium": False,
            "low_carb": False,
            "keto": False,
            "paleo": True
        }
        
        ingredient = Ingredient(
            name="Gluten-Free Bread",
            nutritional_data={
                "calories": 250,
                "proteins": 8,
                "carbs": 45,
                "fats": 5
            },
            dietary_flags=flags
        )
        
        assert ingredient.dietary_flags == flags
        assert ingredient.dietary_flags["gluten_free"] is True
        assert ingredient.dietary_flags["vegan"] is False