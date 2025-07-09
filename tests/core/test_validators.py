"""
Tests for the comprehensive validation service.
"""

import pytest
from decimal import Decimal
from uuid import uuid4, UUID
from pathlib import Path
from unittest.mock import Mock, patch
from PIL import Image
import io

from jidelnicek.core.validators import (
    JidelnicekValidator, RecipeValidator, IngredientValidator,
    NutritionalValidator, QuantityValidator, ImageValidator, PermissionValidator,
    ValidationHelpers, ValidationConstants,
    RecipeValidationError, IngredientValidationError, NutritionalValidationError,
    QuantityValidationError, ImageValidationError, PermissionValidationError,
    UnitValidationError, ValidationException
)


class TestValidationHelpers:
    """Test validation helper functions."""
    
    def test_is_valid_uuid(self):
        """Test UUID validation."""
        valid_uuid = str(uuid4())
        assert ValidationHelpers.is_valid_uuid(valid_uuid) is True
        assert ValidationHelpers.is_valid_uuid(UUID(valid_uuid)) is True
        assert ValidationHelpers.is_valid_uuid("invalid-uuid") is False
        assert ValidationHelpers.is_valid_uuid(None) is False
        assert ValidationHelpers.is_valid_uuid(123) is False
    
    def test_is_valid_email(self):
        """Test email validation."""
        assert ValidationHelpers.is_valid_email("test@example.com") is True
        assert ValidationHelpers.is_valid_email("user.name+tag@domain.co.uk") is True
        assert ValidationHelpers.is_valid_email("invalid-email") is False
        assert ValidationHelpers.is_valid_email("@domain.com") is False
        assert ValidationHelpers.is_valid_email("user@") is False
        assert ValidationHelpers.is_valid_email(None) is False
        assert ValidationHelpers.is_valid_email("") is False
    
    def test_sanitize_string(self):
        """Test string sanitization."""
        assert ValidationHelpers.sanitize_string("  hello  ") == "hello"
        assert ValidationHelpers.sanitize_string("long text", 4) == "long"
        assert ValidationHelpers.sanitize_string(123) == "123"
        assert ValidationHelpers.sanitize_string("") == ""
    
    def test_is_positive_number(self):
        """Test positive number validation."""
        assert ValidationHelpers.is_positive_number(1) is True
        assert ValidationHelpers.is_positive_number(1.5) is True
        assert ValidationHelpers.is_positive_number("1.5") is True
        assert ValidationHelpers.is_positive_number(0) is False
        assert ValidationHelpers.is_positive_number(-1) is False
        assert ValidationHelpers.is_positive_number("invalid") is False
        assert ValidationHelpers.is_positive_number(None) is False
    
    def test_is_non_negative_number(self):
        """Test non-negative number validation."""
        assert ValidationHelpers.is_non_negative_number(0) is True
        assert ValidationHelpers.is_non_negative_number(1) is True
        assert ValidationHelpers.is_non_negative_number(1.5) is True
        assert ValidationHelpers.is_non_negative_number(-1) is False
        assert ValidationHelpers.is_non_negative_number("invalid") is False
        assert ValidationHelpers.is_non_negative_number(None) is False
    
    def test_validate_decimal_precision(self):
        """Test decimal precision validation."""
        assert ValidationHelpers.validate_decimal_precision(Decimal('1.23'), 2) is True
        assert ValidationHelpers.validate_decimal_precision(Decimal('1.234'), 2) is False
        assert ValidationHelpers.validate_decimal_precision(Decimal('1'), 2) is True
        assert ValidationHelpers.validate_decimal_precision("not_decimal", 2) is False
    
    def test_normalize_unit(self):
        """Test unit normalization."""
        assert ValidationHelpers.normalize_unit("g") == "g"
        assert ValidationHelpers.normalize_unit("G") == "g"
        assert ValidationHelpers.normalize_unit("gram") == "g"
        assert ValidationHelpers.normalize_unit("grams") == "g"
        assert ValidationHelpers.normalize_unit("kilogram") == "kg"
        assert ValidationHelpers.normalize_unit("  ml  ") == "ml"
        assert ValidationHelpers.normalize_unit("") == "g"
        assert ValidationHelpers.normalize_unit(None) == "g"
    
    def test_convert_to_base_unit(self):
        """Test unit conversion to base units."""
        assert ValidationHelpers.convert_to_base_unit(1, "g") == (1, "g")
        assert ValidationHelpers.convert_to_base_unit(1, "kg") == (1000, "g")
        assert ValidationHelpers.convert_to_base_unit(1, "ml") == (1, "ml")
        assert ValidationHelpers.convert_to_base_unit(1, "l") == (1000, "ml")
        assert ValidationHelpers.convert_to_base_unit(1, "cup") == (240, "ml")
        assert ValidationHelpers.convert_to_base_unit(1, "piece") == (1, "piece")
    
    def test_is_realistic_nutritional_value(self):
        """Test nutritional value realism check."""
        assert ValidationHelpers.is_realistic_nutritional_value("calories", 300) is True
        assert ValidationHelpers.is_realistic_nutritional_value("calories", 1000) is False
        assert ValidationHelpers.is_realistic_nutritional_value("proteins", 50) is True
        assert ValidationHelpers.is_realistic_nutritional_value("proteins", 150) is False
        assert ValidationHelpers.is_realistic_nutritional_value("unknown_nutrient", 999) is True


class TestRecipeValidator:
    """Test recipe validation."""
    
    def test_validate_recipe_name_valid(self):
        """Test valid recipe name validation."""
        assert RecipeValidator.validate_recipe_name("Chocolate Cake") == "Chocolate Cake"
        assert RecipeValidator.validate_recipe_name("  Pasta  ") == "Pasta"
        assert RecipeValidator.validate_recipe_name("A" * 100) == "A" * 100
    
    def test_validate_recipe_name_invalid(self):
        """Test invalid recipe name validation."""
        with pytest.raises(RecipeValidationError) as exc_info:
            RecipeValidator.validate_recipe_name("")
        assert exc_info.value.code == "required"
        
        with pytest.raises(RecipeValidationError) as exc_info:
            RecipeValidator.validate_recipe_name("AB")
        assert exc_info.value.code == "min_length"
        
        with pytest.raises(RecipeValidationError) as exc_info:
            RecipeValidator.validate_recipe_name("A" * 101)
        assert exc_info.value.code == "max_length"
        
        with pytest.raises(RecipeValidationError) as exc_info:
            RecipeValidator.validate_recipe_name("test")
        assert exc_info.value.code == "descriptive"
    
    def test_validate_recipe_description(self):
        """Test recipe description validation."""
        assert RecipeValidator.validate_recipe_description("") is None
        assert RecipeValidator.validate_recipe_description(None) is None
        assert RecipeValidator.validate_recipe_description("Good cake") == "Good cake"
        
        with pytest.raises(RecipeValidationError) as exc_info:
            RecipeValidator.validate_recipe_description("A" * 1001)
        assert exc_info.value.code == "max_length"
    
    def test_validate_recipe_instructions(self):
        """Test recipe instructions validation."""
        assert RecipeValidator.validate_recipe_instructions("") is None
        assert RecipeValidator.validate_recipe_instructions(None) is None
        assert RecipeValidator.validate_recipe_instructions("Mix ingredients well") == "Mix ingredients well"
        
        with pytest.raises(RecipeValidationError) as exc_info:
            RecipeValidator.validate_recipe_instructions("Short")
        assert exc_info.value.code == "min_length"
        
        with pytest.raises(RecipeValidationError) as exc_info:
            RecipeValidator.validate_recipe_instructions("A" * 2001)
        assert exc_info.value.code == "max_length"
    
    def test_validate_recipe_times(self):
        """Test recipe time validation."""
        assert RecipeValidator.validate_recipe_times(30, 60) == (30, 60)
        assert RecipeValidator.validate_recipe_times(None, 60) == (None, 60)
        assert RecipeValidator.validate_recipe_times(30, None) == (30, None)
        
        with pytest.raises(RecipeValidationError) as exc_info:
            RecipeValidator.validate_recipe_times(-1, 60)
        assert exc_info.value.code == "min_value"
        
        with pytest.raises(RecipeValidationError) as exc_info:
            RecipeValidator.validate_recipe_times(30, 1500)
        assert exc_info.value.code == "max_value"
        
        with pytest.raises(RecipeValidationError) as exc_info:
            RecipeValidator.validate_recipe_times(1200, 1200)
        assert exc_info.value.code == "max_value"
    
    def test_validate_recipe_servings(self):
        """Test recipe servings validation."""
        assert RecipeValidator.validate_recipe_servings(4) == 4
        assert RecipeValidator.validate_recipe_servings(1) == 1
        assert RecipeValidator.validate_recipe_servings(50) == 50
        
        with pytest.raises(RecipeValidationError) as exc_info:
            RecipeValidator.validate_recipe_servings(0)
        assert exc_info.value.code == "min_value"
        
        with pytest.raises(RecipeValidationError) as exc_info:
            RecipeValidator.validate_recipe_servings(51)
        assert exc_info.value.code == "max_value"
    
    def test_validate_recipe_water(self):
        """Test recipe water validation."""
        assert RecipeValidator.validate_recipe_water(500) == 500
        assert RecipeValidator.validate_recipe_water(0) == 0
        assert RecipeValidator.validate_recipe_water(10000) == 10000
        
        with pytest.raises(RecipeValidationError) as exc_info:
            RecipeValidator.validate_recipe_water(-1)
        assert exc_info.value.code == "min_value"
        
        with pytest.raises(RecipeValidationError) as exc_info:
            RecipeValidator.validate_recipe_water(10001)
        assert exc_info.value.code == "max_value"
    
    def test_validate_difficulty_level(self):
        """Test recipe difficulty validation."""
        assert RecipeValidator.validate_difficulty_level("easy") == "easy"
        assert RecipeValidator.validate_difficulty_level("MEDIUM") == "medium"
        assert RecipeValidator.validate_difficulty_level("  hard  ") == "hard"
        assert RecipeValidator.validate_difficulty_level("") is None
        
        with pytest.raises(RecipeValidationError) as exc_info:
            RecipeValidator.validate_difficulty_level("impossible")
        assert exc_info.value.code == "invalid_choice"
    
    def test_validate_recipe_rating(self):
        """Test recipe rating validation."""
        assert RecipeValidator.validate_recipe_rating(4.5, 10) == (4.5, 10)
        assert RecipeValidator.validate_recipe_rating(None, 0) == (None, 0)
        
        with pytest.raises(RecipeValidationError) as exc_info:
            RecipeValidator.validate_recipe_rating(-1, 5)
        assert exc_info.value.code == "min_value"
        
        with pytest.raises(RecipeValidationError) as exc_info:
            RecipeValidator.validate_recipe_rating(6, 5)
        assert exc_info.value.code == "max_value"
        
        with pytest.raises(RecipeValidationError) as exc_info:
            RecipeValidator.validate_recipe_rating(4.5, 0)
        assert exc_info.value.code == "consistency"
    
    def test_validate_recipe_categories(self):
        """Test recipe categories validation."""
        assert RecipeValidator.validate_recipe_categories([]) == []
        assert RecipeValidator.validate_recipe_categories(["breakfast", "easy"]) == ["breakfast", "easy"]
        assert RecipeValidator.validate_recipe_categories(["BREAKFAST", "  easy  "]) == ["breakfast", "easy"]
        assert RecipeValidator.validate_recipe_categories(["breakfast", "breakfast"]) == ["breakfast"]
        
        with pytest.raises(RecipeValidationError) as exc_info:
            RecipeValidator.validate_recipe_categories(["invalid_category"])
        assert exc_info.value.code == "invalid_choice"


class TestIngredientValidator:
    """Test ingredient validation."""
    
    def test_validate_ingredient_name(self):
        """Test ingredient name validation."""
        assert IngredientValidator.validate_ingredient_name("Flour") == "Flour"
        assert IngredientValidator.validate_ingredient_name("  Sugar  ") == "Sugar"
        
        with pytest.raises(IngredientValidationError) as exc_info:
            IngredientValidator.validate_ingredient_name("")
        assert exc_info.value.code == "required"
        
        with pytest.raises(IngredientValidationError) as exc_info:
            IngredientValidator.validate_ingredient_name("A")
        assert exc_info.value.code == "min_length"
        
        with pytest.raises(IngredientValidationError) as exc_info:
            IngredientValidator.validate_ingredient_name("A" * 101)
        assert exc_info.value.code == "max_length"
    
    def test_validate_ingredient_brand(self):
        """Test ingredient brand validation."""
        assert IngredientValidator.validate_ingredient_brand("") is None
        assert IngredientValidator.validate_ingredient_brand(None) is None
        assert IngredientValidator.validate_ingredient_brand("Organic Co.") == "Organic Co."
        
        with pytest.raises(IngredientValidationError) as exc_info:
            IngredientValidator.validate_ingredient_brand("A" * 101)
        assert exc_info.value.code == "max_length"
    
    def test_validate_ingredient_category(self):
        """Test ingredient category validation."""
        assert IngredientValidator.validate_ingredient_category("") is None
        assert IngredientValidator.validate_ingredient_category("Dairy") == "dairy"
        assert IngredientValidator.validate_ingredient_category("  GRAINS  ") == "grains"
        
        with pytest.raises(IngredientValidationError) as exc_info:
            IngredientValidator.validate_ingredient_category("A" * 51)
        assert exc_info.value.code == "max_length"
    
    def test_validate_ingredient_barcode(self):
        """Test ingredient barcode validation."""
        assert IngredientValidator.validate_ingredient_barcode("") is None
        assert IngredientValidator.validate_ingredient_barcode("1234567890123") == "1234567890123"
        
        with pytest.raises(IngredientValidationError) as exc_info:
            IngredientValidator.validate_ingredient_barcode("12345")
        assert exc_info.value.code == "length"
        
        with pytest.raises(IngredientValidationError) as exc_info:
            IngredientValidator.validate_ingredient_barcode("123456789012A")
        assert exc_info.value.code == "format"
    
    def test_validate_allergens(self):
        """Test allergen validation."""
        assert IngredientValidator.validate_allergens([]) == []
        assert IngredientValidator.validate_allergens(["gluten", "dairy"]) == ["gluten", "dairy"]
        assert IngredientValidator.validate_allergens(["GLUTEN", "  dairy  "]) == ["gluten", "dairy"]
        assert IngredientValidator.validate_allergens(["gluten", "gluten"]) == ["gluten"]
        
        with pytest.raises(IngredientValidationError) as exc_info:
            IngredientValidator.validate_allergens(["invalid_allergen"])
        assert exc_info.value.code == "invalid_choice"
    
    def test_validate_dietary_flags(self):
        """Test dietary flags validation."""
        assert IngredientValidator.validate_dietary_flags({}) == {}
        assert IngredientValidator.validate_dietary_flags({"vegan": True, "gluten_free": False}) == {"vegan": True, "gluten_free": False}
        
        with pytest.raises(IngredientValidationError) as exc_info:
            IngredientValidator.validate_dietary_flags({"invalid_flag": True})
        assert exc_info.value.code == "invalid_choice"
        
        with pytest.raises(IngredientValidationError) as exc_info:
            IngredientValidator.validate_dietary_flags({"vegan": "yes"})
        assert exc_info.value.code == "type"
    
    def test_validate_unit_conversions(self):
        """Test unit conversions validation."""
        assert IngredientValidator.validate_unit_conversions({}) == {}
        assert IngredientValidator.validate_unit_conversions({"ml": 1.0, "cup": 240.0}) == {"ml": 1.0, "cup": 240.0}
        
        with pytest.raises(IngredientValidationError) as exc_info:
            IngredientValidator.validate_unit_conversions({"invalid_unit": 1.0})
        assert exc_info.value.code == "invalid_choice"
        
        with pytest.raises(IngredientValidationError) as exc_info:
            IngredientValidator.validate_unit_conversions({"ml": 0})
        assert exc_info.value.code == "value"


class TestNutritionalValidator:
    """Test nutritional validation."""
    
    def test_validate_nutritional_data_valid(self):
        """Test valid nutritional data validation."""
        data = {
            "calories": 200,
            "proteins": 10,
            "carbs": 30,
            "fats": 5,
            "fiber": 5,
            "vitamin_c": 20
        }
        validated = NutritionalValidator.validate_nutritional_data(data)
        assert validated["calories"] == 200
        assert validated["proteins"] == 10
        assert validated["carbs"] == 30
        assert validated["fats"] == 5
        assert validated["fiber"] == 5
        assert validated["vitamin_c"] == 20
    
    def test_validate_nutritional_data_missing_required(self):
        """Test nutritional data with missing required fields."""
        data = {"calories": 200, "proteins": 10}  # Missing carbs and fats
        
        with pytest.raises(NutritionalValidationError) as exc_info:
            NutritionalValidator.validate_nutritional_data(data)
        assert exc_info.value.code == "required"
    
    def test_validate_nutrient_value(self):
        """Test individual nutrient value validation."""
        assert NutritionalValidator.validate_nutrient_value("calories", 200) == 200
        assert NutritionalValidator.validate_nutrient_value("proteins", "10") == 10
        assert NutritionalValidator.validate_nutrient_value("carbs", None) == 0
        
        with pytest.raises(NutritionalValidationError) as exc_info:
            NutritionalValidator.validate_nutrient_value("calories", -1)
        assert exc_info.value.code == "negative"
        
        with pytest.raises(NutritionalValidationError) as exc_info:
            NutritionalValidator.validate_nutrient_value("calories", 1000)
        assert exc_info.value.code == "unrealistic"
    
    def test_validate_vitamin_value(self):
        """Test vitamin value validation."""
        assert NutritionalValidator.validate_vitamin_value("vitamin_c", 50) == 50
        assert NutritionalValidator.validate_vitamin_value("vitamin_d", None) == 0
        
        with pytest.raises(NutritionalValidationError) as exc_info:
            NutritionalValidator.validate_vitamin_value("vitamin_c", -1)
        assert exc_info.value.code == "negative"
        
        with pytest.raises(NutritionalValidationError) as exc_info:
            NutritionalValidator.validate_vitamin_value("vitamin_c", 3000)
        assert exc_info.value.code == "range"
    
    def test_validate_nutritional_consistency(self):
        """Test nutritional consistency validation."""
        # Valid data (roughly matches calorie calculation)
        data = {"calories": 200, "proteins": 10, "carbs": 30, "fats": 5}
        NutritionalValidator.validate_nutritional_consistency(data)  # Should not raise
        
        # Invalid calories vs macronutrients
        data = {"calories": 500, "proteins": 10, "carbs": 30, "fats": 5}
        with pytest.raises(NutritionalValidationError) as exc_info:
            NutritionalValidator.validate_nutritional_consistency(data)
        assert exc_info.value.code == "consistency"
        
        # Fiber exceeds carbs
        data = {"calories": 200, "proteins": 10, "carbs": 30, "fats": 5, "fiber": 40}
        with pytest.raises(NutritionalValidationError) as exc_info:
            NutritionalValidator.validate_nutritional_consistency(data)
        assert exc_info.value.code == "consistency"


class TestQuantityValidator:
    """Test quantity validation."""
    
    def test_validate_quantity_value(self):
        """Test quantity value validation."""
        assert QuantityValidator.validate_quantity_value(1) == Decimal('1')
        assert QuantityValidator.validate_quantity_value(1.5) == Decimal('1.5')
        assert QuantityValidator.validate_quantity_value("2.5") == Decimal('2.5')
        assert QuantityValidator.validate_quantity_value(Decimal('3.333')) == Decimal('3.333')
        
        with pytest.raises(QuantityValidationError) as exc_info:
            QuantityValidator.validate_quantity_value(None)
        assert exc_info.value.code == "required"
        
        with pytest.raises(QuantityValidationError) as exc_info:
            QuantityValidator.validate_quantity_value(0)
        assert exc_info.value.code == "positive"
        
        with pytest.raises(QuantityValidationError) as exc_info:
            QuantityValidator.validate_quantity_value(-1)
        assert exc_info.value.code == "positive"
        
        with pytest.raises(QuantityValidationError) as exc_info:
            QuantityValidator.validate_quantity_value("invalid")
        assert exc_info.value.code == "type"
        
        with pytest.raises(QuantityValidationError) as exc_info:
            QuantityValidator.validate_quantity_value(Decimal('1.1234'))
        assert exc_info.value.code == "precision"
    
    def test_validate_unit(self):
        """Test unit validation."""
        assert QuantityValidator.validate_unit("g") == "g"
        assert QuantityValidator.validate_unit("gram") == "g"
        assert QuantityValidator.validate_unit("  ML  ") == "ml"
        
        with pytest.raises(UnitValidationError) as exc_info:
            QuantityValidator.validate_unit("")
        assert exc_info.value.code == "required"
        
        with pytest.raises(UnitValidationError) as exc_info:
            QuantityValidator.validate_unit("invalid_unit")
        assert exc_info.value.code == "invalid_choice"
    
    def test_validate_quantity_unit_combination(self):
        """Test quantity and unit combination validation."""
        assert QuantityValidator.validate_quantity_unit_combination(1.5, "g") == (Decimal('1.5'), "g")
        assert QuantityValidator.validate_quantity_unit_combination(2, "cup") == (Decimal('2'), "cup")
        
        with pytest.raises(QuantityValidationError) as exc_info:
            QuantityValidator.validate_quantity_unit_combination(15, "kg")
        assert exc_info.value.code == "unrealistic"
        
        with pytest.raises(QuantityValidationError) as exc_info:
            QuantityValidator.validate_quantity_unit_combination(200, "cup")
        assert exc_info.value.code == "unrealistic"
    
    def test_validate_preparation_notes(self):
        """Test preparation notes validation."""
        assert QuantityValidator.validate_preparation_notes("") is None
        assert QuantityValidator.validate_preparation_notes(None) is None
        assert QuantityValidator.validate_preparation_notes("diced") == "diced"
        assert QuantityValidator.validate_preparation_notes("  chopped  ") == "chopped"
        
        with pytest.raises(QuantityValidationError) as exc_info:
            QuantityValidator.validate_preparation_notes("A" * 201)
        assert exc_info.value.code == "max_length"


class TestImageValidator:
    """Test image validation."""
    
    def create_test_image(self, width=200, height=200, format='JPEG'):
        """Create a test image."""
        image = Image.new('RGB', (width, height), color='red')
        buffer = io.BytesIO()
        image.save(buffer, format=format)
        buffer.seek(0)
        return buffer.getvalue()
    
    def test_validate_image_upload_valid(self):
        """Test valid image upload validation."""
        image_data = self.create_test_image()
        result = ImageValidator.validate_image_upload(image_data, "test.jpg")
        
        assert result['filename'] == "test.jpg"
        assert result['width'] == 200
        assert result['height'] == 200
        assert result['format'] == 'JPEG'
        assert result['extension'] == '.jpg'
        assert 'file_size' in result
        assert 'aspect_ratio' in result
    
    def test_validate_image_upload_invalid_format(self):
        """Test image upload with invalid format."""
        image_data = self.create_test_image()
        
        with pytest.raises(ImageValidationError) as exc_info:
            ImageValidator.validate_image_upload(image_data, "test.bmp")
        assert exc_info.value.code == "invalid_extension"
    
    def test_validate_image_upload_too_large(self):
        """Test image upload that's too large."""
        with pytest.raises(ImageValidationError) as exc_info:
            ImageValidator.validate_image_upload(b"x" * (ValidationConstants.IMAGE_MAX_SIZE + 1), "test.jpg")
        assert exc_info.value.code == "file_too_large"
    
    def test_validate_image_upload_empty(self):
        """Test empty image upload."""
        with pytest.raises(ImageValidationError) as exc_info:
            ImageValidator.validate_image_upload(b"", "test.jpg")
        assert exc_info.value.code == "required"
    
    def test_validate_image_upload_dimensions_too_small(self):
        """Test image with dimensions too small."""
        image_data = self.create_test_image(50, 50)
        
        with pytest.raises(ImageValidationError) as exc_info:
            ImageValidator.validate_image_upload(image_data, "test.jpg")
        assert exc_info.value.code == "dimensions_too_small"
    
    def test_validate_image_upload_dimensions_too_large(self):
        """Test image with dimensions too large."""
        image_data = self.create_test_image(5000, 5000)
        
        with pytest.raises(ImageValidationError) as exc_info:
            ImageValidator.validate_image_upload(image_data, "test.jpg")
        assert exc_info.value.code == "dimensions_too_large"
    
    def test_validate_image_upload_extreme_aspect_ratio(self):
        """Test image with extreme aspect ratio."""
        image_data = self.create_test_image(2000, 100)
        
        with pytest.raises(ImageValidationError) as exc_info:
            ImageValidator.validate_image_upload(image_data, "test.jpg")
        assert exc_info.value.code == "invalid_aspect_ratio"
    
    def test_validate_image_upload_invalid_image_data(self):
        """Test invalid image data."""
        with pytest.raises(ImageValidationError) as exc_info:
            ImageValidator.validate_image_upload(b"not an image", "test.jpg")
        assert exc_info.value.code == "invalid_image"


class TestPermissionValidator:
    """Test permission validation."""
    
    def test_validate_user_id(self):
        """Test user ID validation."""
        valid_uuid = uuid4()
        assert PermissionValidator.validate_user_id(valid_uuid) == valid_uuid
        assert PermissionValidator.validate_user_id(str(valid_uuid)) == valid_uuid
        
        with pytest.raises(PermissionValidationError) as exc_info:
            PermissionValidator.validate_user_id("")
        assert exc_info.value.code == "required"
        
        with pytest.raises(PermissionValidationError) as exc_info:
            PermissionValidator.validate_user_id("invalid-uuid")
        assert exc_info.value.code == "invalid_format"
    
    def test_validate_recipe_ownership(self):
        """Test recipe ownership validation."""
        user_id = uuid4()
        recipe_user_id = uuid4()
        
        assert PermissionValidator.validate_recipe_ownership(user_id, user_id) is True
        
        with pytest.raises(PermissionValidationError) as exc_info:
            PermissionValidator.validate_recipe_ownership(user_id, recipe_user_id)
        assert exc_info.value.code == "insufficient_permission"
    
    def test_validate_recipe_access(self):
        """Test recipe access validation."""
        user_id = uuid4()
        recipe_user_id = uuid4()
        
        assert PermissionValidator.validate_recipe_access(user_id, user_id, False) is True
        assert PermissionValidator.validate_recipe_access(user_id, recipe_user_id, True) is True
        
        with pytest.raises(PermissionValidationError) as exc_info:
            PermissionValidator.validate_recipe_access(user_id, recipe_user_id, False)
        assert exc_info.value.code == "insufficient_permission"
    
    def test_validate_admin_permission(self):
        """Test admin permission validation."""
        assert PermissionValidator.validate_admin_permission("admin") is True
        
        with pytest.raises(PermissionValidationError) as exc_info:
            PermissionValidator.validate_admin_permission("user")
        assert exc_info.value.code == "insufficient_permission"
    
    def test_validate_ingredient_ownership(self):
        """Test ingredient ownership validation."""
        user_id = uuid4()
        ingredient_user_id = uuid4()
        
        assert PermissionValidator.validate_ingredient_ownership(user_id, user_id, False) is True
        assert PermissionValidator.validate_ingredient_ownership(user_id, None, False) is True
        
        with pytest.raises(PermissionValidationError) as exc_info:
            PermissionValidator.validate_ingredient_ownership(user_id, ingredient_user_id, True)
        assert exc_info.value.code == "insufficient_permission"
        
        with pytest.raises(PermissionValidationError) as exc_info:
            PermissionValidator.validate_ingredient_ownership(user_id, ingredient_user_id, False)
        assert exc_info.value.code == "insufficient_permission"
    
    def test_validate_recipe_limits(self):
        """Test recipe limits validation."""
        assert PermissionValidator.validate_recipe_limits(50, 100) is True
        
        with pytest.raises(PermissionValidationError) as exc_info:
            PermissionValidator.validate_recipe_limits(100, 100)
        assert exc_info.value.code == "limit_exceeded"
    
    def test_validate_user_active(self):
        """Test user active validation."""
        assert PermissionValidator.validate_user_active(True, False) is True
        
        with pytest.raises(PermissionValidationError) as exc_info:
            PermissionValidator.validate_user_active(False, False)
        assert exc_info.value.code == "account_inactive"
        
        with pytest.raises(PermissionValidationError) as exc_info:
            PermissionValidator.validate_user_active(True, True)
        assert exc_info.value.code == "account_archived"
    
    def test_validate_email_verified(self):
        """Test email verification validation."""
        assert PermissionValidator.validate_email_verified(True) is True
        
        with pytest.raises(PermissionValidationError) as exc_info:
            PermissionValidator.validate_email_verified(False)
        assert exc_info.value.code == "email_not_verified"


class TestJidelnicekValidator:
    """Test main validator class."""
    
    def setup_method(self):
        """Set up test fixtures."""
        self.validator = JidelnicekValidator()
        self.user_id = uuid4()
    
    def test_validate_recipe_data(self):
        """Test complete recipe data validation."""
        data = {
            "name": "Test Recipe",
            "description": "A test recipe",
            "instructions": "Mix ingredients and cook",
            "prep_time_minutes": 30,
            "cook_time_minutes": 60,
            "servings": 4,
            "water_ml": 500,
            "difficulty_level": "medium",
            "rating_average": 4.5,
            "rating_count": 10,
            "categories": ["dinner", "main_course"]
        }
        
        validated = self.validator.validate_recipe_data(data, self.user_id)
        
        assert validated["name"] == "Test Recipe"
        assert validated["description"] == "A test recipe"
        assert validated["instructions"] == "Mix ingredients and cook"
        assert validated["prep_time_minutes"] == 30
        assert validated["cook_time_minutes"] == 60
        assert validated["servings"] == 4
        assert validated["water_ml"] == 500
        assert validated["difficulty_level"] == "medium"
        assert validated["rating_average"] == 4.5
        assert validated["rating_count"] == 10
        assert validated["categories"] == ["dinner", "main_course"]
    
    def test_validate_ingredient_data(self):
        """Test complete ingredient data validation."""
        data = {
            "name": "Test Ingredient",
            "brand": "Test Brand",
            "category": "test_category",
            "barcode": "1234567890123",
            "allergens": ["gluten", "dairy"],
            "dietary_flags": {"vegan": False, "gluten_free": False},
            "unit_conversions": {"ml": 1.0, "cup": 240.0},
            "nutritional_data": {
                "calories": 200,
                "proteins": 10,
                "carbs": 30,
                "fats": 5,
                "fiber": 3,
                "vitamin_c": 20
            }
        }
        
        validated = self.validator.validate_ingredient_data(data, self.user_id)
        
        assert validated["name"] == "Test Ingredient"
        assert validated["brand"] == "Test Brand"
        assert validated["category"] == "test_category"
        assert validated["barcode"] == "1234567890123"
        assert validated["allergens"] == ["gluten", "dairy"]
        assert validated["dietary_flags"] == {"vegan": False, "gluten_free": False}
        assert validated["unit_conversions"] == {"ml": 1.0, "cup": 240.0}
        assert validated["nutritional_data"]["calories"] == 200
    
    def test_validate_recipe_ingredient_data(self):
        """Test recipe ingredient relationship data validation."""
        data = {
            "quantity": 2.5,
            "unit": "cup",
            "preparation_notes": "diced",
            "is_optional": False,
            "display_order": 1
        }
        
        validated = self.validator.validate_recipe_ingredient_data(data)
        
        assert validated["quantity"] == Decimal('2.5')
        assert validated["unit"] == "cup"
        assert validated["preparation_notes"] == "diced"
        assert validated["is_optional"] is False
        assert validated["display_order"] == 1
    
    def test_validate_user_permissions(self):
        """Test comprehensive user permissions validation."""
        target_user_id = uuid4()
        
        # Should pass with active, verified user accessing public content
        assert self.validator.validate_user_permissions(
            self.user_id, target_user_id, is_public=True,
            is_active=True, is_archived=False, email_verified=True
        ) is True
        
        # Should fail with inactive user
        with pytest.raises(PermissionValidationError):
            self.validator.validate_user_permissions(
                self.user_id, target_user_id, is_public=True,
                is_active=False, is_archived=False, email_verified=True
            )
    
    def test_get_validation_summary(self):
        """Test validation summary."""
        summary = self.validator.get_validation_summary()
        
        assert "recipe_limits" in summary
        assert "ingredient_limits" in summary
        assert "quantity_limits" in summary
        assert "image_limits" in summary
        assert "nutritional_ranges" in summary
        
        assert "name_length" in summary["recipe_limits"]
        assert "valid_units" in summary["quantity_limits"]
        assert "required_fields" in summary["nutritional_ranges"]


class TestValidationExceptions:
    """Test custom validation exceptions."""
    
    def test_validation_exception_basic(self):
        """Test basic validation exception."""
        exc = ValidationException("Test message")
        assert str(exc) == "Test message"
        assert exc.message == "Test message"
        assert exc.field is None
        assert exc.code is None
    
    def test_validation_exception_with_details(self):
        """Test validation exception with field and code."""
        exc = ValidationException("Test message", "test_field", "test_code")
        assert exc.message == "Test message"
        assert exc.field == "test_field"
        assert exc.code == "test_code"
    
    def test_specific_validation_exceptions(self):
        """Test specific validation exception types."""
        recipe_exc = RecipeValidationError("Recipe error", "name", "invalid")
        assert isinstance(recipe_exc, ValidationException)
        assert recipe_exc.message == "Recipe error"
        
        ingredient_exc = IngredientValidationError("Ingredient error")
        assert isinstance(ingredient_exc, ValidationException)
        
        nutritional_exc = NutritionalValidationError("Nutrition error")
        assert isinstance(nutritional_exc, ValidationException)
        
        quantity_exc = QuantityValidationError("Quantity error")
        assert isinstance(quantity_exc, ValidationException)
        
        image_exc = ImageValidationError("Image error")
        assert isinstance(image_exc, ValidationException)
        
        permission_exc = PermissionValidationError("Permission error")
        assert isinstance(permission_exc, ValidationException)
        
        unit_exc = UnitValidationError("Unit error")
        assert isinstance(unit_exc, ValidationException)


class TestValidationConstants:
    """Test validation constants."""
    
    def test_validation_constants_existence(self):
        """Test that all required constants exist."""
        assert hasattr(ValidationConstants, 'RECIPE_NAME_MIN_LENGTH')
        assert hasattr(ValidationConstants, 'RECIPE_NAME_MAX_LENGTH')
        assert hasattr(ValidationConstants, 'VALID_UNITS')
        assert hasattr(ValidationConstants, 'UNIT_CONVERSIONS')
        assert hasattr(ValidationConstants, 'ALLOWED_IMAGE_FORMATS')
        assert hasattr(ValidationConstants, 'ALLERGEN_TYPES')
        assert hasattr(ValidationConstants, 'DIETARY_FLAGS')
        assert hasattr(ValidationConstants, 'DIFFICULTY_LEVELS')
        assert hasattr(ValidationConstants, 'RECIPE_CATEGORIES')
    
    def test_validation_constants_values(self):
        """Test validation constants have reasonable values."""
        assert ValidationConstants.RECIPE_NAME_MIN_LENGTH > 0
        assert ValidationConstants.RECIPE_NAME_MAX_LENGTH > ValidationConstants.RECIPE_NAME_MIN_LENGTH
        assert ValidationConstants.RECIPE_SERVINGS_MIN > 0
        assert ValidationConstants.RECIPE_SERVINGS_MAX > ValidationConstants.RECIPE_SERVINGS_MIN
        assert ValidationConstants.QUANTITY_MIN > 0
        assert ValidationConstants.QUANTITY_MAX > ValidationConstants.QUANTITY_MIN
        assert ValidationConstants.IMAGE_MAX_SIZE > 0
        assert ValidationConstants.IMAGE_MAX_WIDTH > ValidationConstants.IMAGE_MIN_WIDTH
        assert ValidationConstants.IMAGE_MAX_HEIGHT > ValidationConstants.IMAGE_MIN_HEIGHT
    
    def test_unit_conversions_consistency(self):
        """Test unit conversions are consistent."""
        # All units in VALID_UNITS should have conversion factors or be None
        for unit in ValidationConstants.VALID_UNITS:
            assert unit in ValidationConstants.UNIT_CONVERSIONS
        
        # All weight units should have numeric factors
        weight_units = [unit for unit, unit_type in ValidationConstants.VALID_UNITS.items() if unit_type == 'weight']
        for unit in weight_units:
            factor = ValidationConstants.UNIT_CONVERSIONS[unit]
            assert factor is not None and isinstance(factor, (int, float))
        
        # All volume units should have numeric factors
        volume_units = [unit for unit, unit_type in ValidationConstants.VALID_UNITS.items() if unit_type == 'volume']
        for unit in volume_units:
            factor = ValidationConstants.UNIT_CONVERSIONS[unit]
            assert factor is not None and isinstance(factor, (int, float))
    
    def test_allergen_types_valid(self):
        """Test allergen types are valid."""
        assert len(ValidationConstants.ALLERGEN_TYPES) > 0
        assert 'gluten' in ValidationConstants.ALLERGEN_TYPES
        assert 'dairy' in ValidationConstants.ALLERGEN_TYPES
        assert 'nuts' in ValidationConstants.ALLERGEN_TYPES or 'tree_nuts' in ValidationConstants.ALLERGEN_TYPES
    
    def test_dietary_flags_valid(self):
        """Test dietary flags are valid."""
        assert len(ValidationConstants.DIETARY_FLAGS) > 0
        assert 'vegetarian' in ValidationConstants.DIETARY_FLAGS
        assert 'vegan' in ValidationConstants.DIETARY_FLAGS
        assert 'gluten_free' in ValidationConstants.DIETARY_FLAGS
    
    def test_difficulty_levels_valid(self):
        """Test difficulty levels are valid."""
        assert len(ValidationConstants.DIFFICULTY_LEVELS) > 0
        assert 'easy' in ValidationConstants.DIFFICULTY_LEVELS
        assert 'medium' in ValidationConstants.DIFFICULTY_LEVELS
        assert 'hard' in ValidationConstants.DIFFICULTY_LEVELS
    
    def test_recipe_categories_valid(self):
        """Test recipe categories are valid."""
        assert len(ValidationConstants.RECIPE_CATEGORIES) > 0
        assert 'breakfast' in ValidationConstants.RECIPE_CATEGORIES
        assert 'lunch' in ValidationConstants.RECIPE_CATEGORIES
        assert 'dinner' in ValidationConstants.RECIPE_CATEGORIES
        assert 'dessert' in ValidationConstants.RECIPE_CATEGORIES
    
    def test_nutritional_ranges_logical(self):
        """Test nutritional ranges are logical."""
        # Calories should be reasonable
        assert ValidationConstants.NUTRITION_CALORIES_MIN >= 0
        assert ValidationConstants.NUTRITION_CALORIES_MAX <= 1000
        
        # Macronutrients should be 0-100g per 100g
        assert ValidationConstants.NUTRITION_PROTEIN_MIN >= 0
        assert ValidationConstants.NUTRITION_PROTEIN_MAX <= 100
        assert ValidationConstants.NUTRITION_CARBS_MIN >= 0
        assert ValidationConstants.NUTRITION_CARBS_MAX <= 100
        assert ValidationConstants.NUTRITION_FATS_MIN >= 0
        assert ValidationConstants.NUTRITION_FATS_MAX <= 100
        
        # Fiber should be reasonable
        assert ValidationConstants.NUTRITION_FIBER_MIN >= 0
        assert ValidationConstants.NUTRITION_FIBER_MAX <= 100
        
        # Vitamins should have reasonable ranges
        assert ValidationConstants.VITAMIN_C_MIN >= 0
        assert ValidationConstants.VITAMIN_C_MAX > 0
        assert ValidationConstants.VITAMIN_D_MIN >= 0
        assert ValidationConstants.VITAMIN_D_MAX > 0