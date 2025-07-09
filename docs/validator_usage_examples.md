# Validator Usage Examples

This document provides examples of how to use the comprehensive validation service in the Jidelnicek 2.0 application.

## Basic Usage

### Using the Main Validator Class

```python
from jidelnicek.core.validators import JidelnicekValidator
from uuid import uuid4

# Initialize the validator
validator = JidelnicekValidator()

# Example user ID
user_id = uuid4()

# Validate recipe data
recipe_data = {
    "name": "Chocolate Chip Cookies",
    "description": "Delicious homemade cookies",
    "instructions": "Mix ingredients, form cookies, and bake at 350°F for 12 minutes",
    "prep_time_minutes": 15,
    "cook_time_minutes": 12,
    "servings": 24,
    "difficulty_level": "easy",
    "categories": ["dessert", "baked"]
}

try:
    validated_recipe = validator.validate_recipe_data(recipe_data, user_id)
    print("Recipe validation successful!")
    print(f"Validated recipe: {validated_recipe}")
except Exception as e:
    print(f"Recipe validation failed: {e}")
```

### Using Individual Validators

```python
from jidelnicek.core.validators import RecipeValidator, IngredientValidator, NutritionalValidator

# Recipe validation
try:
    name = RecipeValidator.validate_recipe_name("Pasta Carbonara")
    servings = RecipeValidator.validate_recipe_servings(4)
    prep_time, cook_time = RecipeValidator.validate_recipe_times(10, 20)
    print(f"Recipe validated: {name}, {servings} servings, {prep_time + cook_time} minutes total")
except Exception as e:
    print(f"Recipe validation error: {e}")

# Ingredient validation
try:
    ingredient_name = IngredientValidator.validate_ingredient_name("Organic Flour")
    allergens = IngredientValidator.validate_allergens(["gluten"])
    dietary_flags = IngredientValidator.validate_dietary_flags({"organic": True, "vegan": True})
    print(f"Ingredient validated: {ingredient_name}")
    print(f"Allergens: {allergens}")
    print(f"Dietary flags: {dietary_flags}")
except Exception as e:
    print(f"Ingredient validation error: {e}")

# Nutritional validation
nutrition_data = {
    "calories": 350,
    "proteins": 12,
    "carbs": 70,
    "fats": 2,
    "fiber": 5,
    "vitamin_c": 0
}

try:
    validated_nutrition = NutritionalValidator.validate_nutritional_data(nutrition_data)
    print(f"Nutrition validated: {validated_nutrition}")
except Exception as e:
    print(f"Nutrition validation error: {e}")
```

## Advanced Usage Examples

### Complete Recipe with Ingredients

```python
from jidelnicek.core.validators import JidelnicekValidator
from decimal import Decimal
from uuid import uuid4

validator = JidelnicekValidator()
user_id = uuid4()

# Complete recipe data
recipe_data = {
    "name": "Vegetable Stir Fry",
    "description": "Quick and healthy vegetable stir fry with soy sauce",
    "instructions": """
    1. Heat oil in a large wok or skillet over high heat
    2. Add garlic and ginger, stir-fry for 30 seconds
    3. Add vegetables in order of cooking time needed
    4. Stir-fry for 3-4 minutes until vegetables are crisp-tender
    5. Add soy sauce mixture and toss to combine
    6. Serve immediately over rice
    """,
    "prep_time_minutes": 15,
    "cook_time_minutes": 8,
    "servings": 4,
    "water_ml": 0,
    "difficulty_level": "easy",
    "categories": ["dinner", "vegetarian", "quick"]
}

# Ingredient data
ingredients = [
    {
        "name": "Broccoli",
        "category": "vegetables",
        "allergens": [],
        "dietary_flags": {"vegetarian": True, "vegan": True},
        "nutritional_data": {
            "calories": 34,
            "proteins": 2.8,
            "carbs": 7,
            "fats": 0.4,
            "fiber": 2.6,
            "vitamin_c": 89
        }
    },
    {
        "name": "Soy Sauce",
        "category": "condiments",
        "allergens": ["soy", "gluten"],
        "dietary_flags": {"vegetarian": True, "vegan": True},
        "nutritional_data": {
            "calories": 8,
            "proteins": 1.3,
            "carbs": 0.8,
            "fats": 0,
            "fiber": 0.1,
            "sodium": 879
        }
    }
]

# Recipe ingredient relationships
recipe_ingredients = [
    {
        "quantity": Decimal("2"),
        "unit": "cup",
        "preparation_notes": "cut into florets",
        "is_optional": False,
        "display_order": 1
    },
    {
        "quantity": Decimal("2"),
        "unit": "tbsp",
        "preparation_notes": "low sodium",
        "is_optional": False,
        "display_order": 2
    }
]

try:
    # Validate recipe
    validated_recipe = validator.validate_recipe_data(recipe_data, user_id)
    print("Recipe validation successful!")
    
    # Validate ingredients
    validated_ingredients = []
    for ingredient in ingredients:
        validated_ingredient = validator.validate_ingredient_data(ingredient, user_id)
        validated_ingredients.append(validated_ingredient)
    print(f"Validated {len(validated_ingredients)} ingredients!")
    
    # Validate recipe-ingredient relationships
    validated_recipe_ingredients = []
    for recipe_ingredient in recipe_ingredients:
        validated_rel = validator.validate_recipe_ingredient_data(recipe_ingredient)
        validated_recipe_ingredients.append(validated_rel)
    print(f"Validated {len(validated_recipe_ingredients)} recipe-ingredient relationships!")
    
    print("All validation successful!")
    
except Exception as e:
    print(f"Validation failed: {e}")
    print(f"Error type: {type(e).__name__}")
    if hasattr(e, 'field'):
        print(f"Field: {e.field}")
    if hasattr(e, 'code'):
        print(f"Code: {e.code}")
```

### Image Validation

```python
from jidelnicek.core.validators import ImageValidator
from pathlib import Path

# Validate image file
image_path = "path/to/recipe/image.jpg"

try:
    if Path(image_path).exists():
        image_info = ImageValidator.validate_image_file(image_path)
        print(f"Image validation successful!")
        print(f"Dimensions: {image_info['width']}x{image_info['height']}")
        print(f"Format: {image_info['format']}")
        print(f"File size: {image_info['file_size']} bytes")
    else:
        print("Image file not found")
except Exception as e:
    print(f"Image validation failed: {e}")

# Validate image upload
def validate_uploaded_image(file_content, filename):
    try:
        image_info = ImageValidator.validate_image_upload(file_content, filename)
        return {
            "valid": True,
            "info": image_info
        }
    except Exception as e:
        return {
            "valid": False,
            "error": str(e),
            "error_code": getattr(e, 'code', 'unknown')
        }

# Example usage in a file upload handler
# file_content = request.files['image'].read()
# filename = request.files['image'].filename
# result = validate_uploaded_image(file_content, filename)
```

### Permission Validation

```python
from jidelnicek.core.validators import PermissionValidator
from uuid import uuid4

# User IDs
user_id = uuid4()
recipe_owner_id = uuid4()
admin_user_id = uuid4()

# Recipe ownership validation
try:
    # User trying to edit their own recipe
    PermissionValidator.validate_recipe_ownership(user_id, user_id)
    print("User can edit their own recipe")
    
    # User trying to edit someone else's recipe
    PermissionValidator.validate_recipe_ownership(user_id, recipe_owner_id)
    print("This should not print")
    
except Exception as e:
    print(f"Permission denied: {e}")

# Recipe access validation
try:
    # User accessing public recipe
    PermissionValidator.validate_recipe_access(user_id, recipe_owner_id, is_public=True)
    print("User can access public recipe")
    
    # User accessing private recipe
    PermissionValidator.validate_recipe_access(user_id, recipe_owner_id, is_public=False)
    print("This should not print")
    
except Exception as e:
    print(f"Access denied: {e}")

# Admin permission validation
try:
    PermissionValidator.validate_admin_permission("admin")
    print("Admin access granted")
    
    PermissionValidator.validate_admin_permission("user")
    print("This should not print")
    
except Exception as e:
    print(f"Admin access denied: {e}")
```

### Quantity and Unit Validation

```python
from jidelnicek.core.validators import QuantityValidator
from decimal import Decimal

# Quantity validation examples
test_quantities = [
    {"quantity": "2.5", "unit": "cup"},
    {"quantity": 1.5, "unit": "kg"},
    {"quantity": Decimal("0.5"), "unit": "l"},
    {"quantity": 3, "unit": "piece"},
    {"quantity": "1/2", "unit": "tsp"},  # This will fail - fractions not supported
    {"quantity": 0, "unit": "g"},       # This will fail - zero not allowed
    {"quantity": 15, "unit": "kg"},     # This will fail - unrealistic
]

for test in test_quantities:
    try:
        quantity, unit = QuantityValidator.validate_quantity_unit_combination(
            test["quantity"], test["unit"]
        )
        print(f"✓ {quantity} {unit} - Valid")
    except Exception as e:
        print(f"✗ {test['quantity']} {test['unit']} - Error: {e}")

# Preparation notes validation
prep_notes = [
    "diced",
    "finely chopped",
    "  minced  ",
    "sliced thin",
    "A" * 200,  # This will fail - too long
    ""          # This will return None
]

for note in prep_notes:
    try:
        validated_note = QuantityValidator.validate_preparation_notes(note)
        print(f"✓ '{note}' -> '{validated_note}'")
    except Exception as e:
        print(f"✗ '{note}' - Error: {e}")
```

### Nutritional Data Validation

```python
from jidelnicek.core.validators import NutritionalValidator

# Test various nutritional data scenarios
nutrition_samples = [
    # Valid basic nutrition
    {
        "name": "White Rice",
        "data": {
            "calories": 130,
            "proteins": 2.7,
            "carbs": 28,
            "fats": 0.3,
            "fiber": 0.4
        }
    },
    
    # Valid nutrition with vitamins
    {
        "name": "Orange",
        "data": {
            "calories": 47,
            "proteins": 0.9,
            "carbs": 12,
            "fats": 0.1,
            "fiber": 2.4,
            "vitamin_c": 53,
            "vitamin_a": 225
        }
    },
    
    # Invalid - missing required field
    {
        "name": "Incomplete Food",
        "data": {
            "calories": 100,
            "proteins": 5,
            "carbs": 20
            # Missing fats
        }
    },
    
    # Invalid - unrealistic values
    {
        "name": "Impossible Food",
        "data": {
            "calories": 1000,  # Too high
            "proteins": 50,
            "carbs": 50,
            "fats": 50
        }
    },
    
    # Invalid - inconsistent calories
    {
        "name": "Inconsistent Food",
        "data": {
            "calories": 100,
            "proteins": 20,    # 20*4 = 80 kcal
            "carbs": 20,       # 20*4 = 80 kcal  
            "fats": 20         # 20*9 = 180 kcal
            # Total: 340 kcal, but calories says 100
        }
    }
]

for sample in nutrition_samples:
    try:
        validated = NutritionalValidator.validate_nutritional_data(sample["data"])
        print(f"✓ {sample['name']} - Valid nutrition data")
        print(f"  Calories: {validated['calories']}")
        print(f"  Proteins: {validated['proteins']}g")
        print(f"  Carbs: {validated['carbs']}g")
        print(f"  Fats: {validated['fats']}g")
    except Exception as e:
        print(f"✗ {sample['name']} - Error: {e}")
        if hasattr(e, 'field'):
            print(f"  Field: {e.field}")
        if hasattr(e, 'code'):
            print(f"  Code: {e.code}")
    print()
```

### Error Handling and User Feedback

```python
from jidelnicek.core.validators import (
    JidelnicekValidator, RecipeValidationError, IngredientValidationError,
    NutritionalValidationError, QuantityValidationError, ImageValidationError,
    PermissionValidationError, UnitValidationError
)

def handle_validation_error(error):
    """Convert validation errors to user-friendly messages."""
    error_messages = {
        # Recipe errors
        "recipe_name_required": "Recipe name is required",
        "recipe_name_min_length": "Recipe name must be at least 3 characters",
        "recipe_name_max_length": "Recipe name cannot exceed 100 characters",
        "recipe_name_descriptive": "Please provide a more descriptive recipe name",
        
        # Ingredient errors
        "ingredient_name_required": "Ingredient name is required",
        "ingredient_allergen_invalid": "Invalid allergen type",
        
        # Nutritional errors
        "nutrition_required": "Required nutritional field is missing",
        "nutrition_negative": "Nutritional values cannot be negative",
        "nutrition_unrealistic": "Nutritional value seems unrealistic",
        "nutrition_consistency": "Nutritional values are inconsistent",
        
        # Quantity errors
        "quantity_required": "Quantity is required",
        "quantity_positive": "Quantity must be positive",
        "quantity_unrealistic": "Quantity seems unrealistic",
        
        # Unit errors
        "unit_required": "Unit is required",
        "unit_invalid": "Invalid unit type",
        
        # Image errors
        "image_too_large": "Image file is too large",
        "image_invalid_format": "Invalid image format",
        "image_dimensions_small": "Image dimensions are too small",
        "image_dimensions_large": "Image dimensions are too large",
        
        # Permission errors
        "permission_denied": "You don't have permission to perform this action",
        "account_inactive": "Your account is not active",
        "email_not_verified": "Please verify your email address",
    }
    
    # Map error codes to user messages
    error_code = getattr(error, 'code', 'unknown')
    field = getattr(error, 'field', None)
    
    if hasattr(error, 'code'):
        key = f"{field}_{error_code}" if field else error_code
        message = error_messages.get(key, str(error))
    else:
        message = str(error)
    
    return {
        "field": field,
        "code": error_code,
        "message": message,
        "original_error": str(error)
    }

# Example usage in API endpoint
def create_recipe_endpoint(request_data):
    validator = JidelnicekValidator()
    
    try:
        validated_data = validator.validate_recipe_data(request_data)
        # Process validated data...
        return {"success": True, "data": validated_data}
        
    except (RecipeValidationError, IngredientValidationError, 
            NutritionalValidationError, QuantityValidationError,
            ImageValidationError, PermissionValidationError,
            UnitValidationError) as e:
        
        error_info = handle_validation_error(e)
        return {
            "success": False,
            "error": error_info,
            "status_code": 400
        }
    
    except Exception as e:
        return {
            "success": False,
            "error": {
                "message": "An unexpected error occurred",
                "code": "internal_error"
            },
            "status_code": 500
        }

# Test error handling
test_data = {
    "name": "AB",  # Too short
    "servings": 0,  # Invalid
    "difficulty_level": "impossible"  # Invalid
}

result = create_recipe_endpoint(test_data)
print(f"API Result: {result}")
```

### Getting Validation Summary

```python
from jidelnicek.core.validators import JidelnicekValidator

validator = JidelnicekValidator()
summary = validator.get_validation_summary()

print("Validation Rules Summary:")
print("=" * 50)

for category, rules in summary.items():
    print(f"\n{category.replace('_', ' ').title()}:")
    for rule_name, rule_value in rules.items():
        print(f"  {rule_name}: {rule_value}")

# Use summary to build form validation on frontend
def get_frontend_validation_config():
    """Generate frontend validation configuration."""
    summary = validator.get_validation_summary()
    
    return {
        "recipe": {
            "name": {
                "required": True,
                "minLength": 3,
                "maxLength": 100
            },
            "description": {
                "required": False,
                "maxLength": 1000
            },
            "servings": {
                "required": True,
                "min": 1,
                "max": 50,
                "type": "integer"
            },
            "difficulty": {
                "required": False,
                "choices": ["easy", "medium", "hard"]
            }
        },
        "ingredient": {
            "name": {
                "required": True,
                "minLength": 2,
                "maxLength": 100
            },
            "allergens": {
                "required": False,
                "choices": list(summary["ingredient_limits"]["allergens"])
            }
        },
        "quantity": {
            "value": {
                "required": True,
                "min": 0.001,
                "max": 10000,
                "precision": 3
            },
            "unit": {
                "required": True,
                "choices": summary["quantity_limits"]["valid_units"]
            }
        }
    }

frontend_config = get_frontend_validation_config()
print("\nFrontend Validation Config:")
print(frontend_config)
```

## Integration with Database Models

```python
from sqlalchemy.orm import Session
from jidelnicek.core.validators import JidelnicekValidator
from jidelnicek.recipe.models import Recipe, RecipeIngredient
from jidelnicek.common.models import Ingredient

def create_recipe_with_validation(db: Session, recipe_data: dict, user_id: str):
    """Create a recipe with full validation."""
    validator = JidelnicekValidator(db)
    
    try:
        # Validate recipe data
        validated_recipe = validator.validate_recipe_data(recipe_data, user_id)
        
        # Create recipe instance
        recipe = Recipe(
            user_id=user_id,
            name=validated_recipe["name"],
            description=validated_recipe.get("description"),
            instructions=validated_recipe.get("instructions"),
            prep_time_minutes=validated_recipe.get("prep_time_minutes"),
            cook_time_minutes=validated_recipe.get("cook_time_minutes"),
            servings=validated_recipe["servings"],
            difficulty_level=validated_recipe.get("difficulty_level")
        )
        
        db.add(recipe)
        db.flush()  # Get the recipe ID
        
        # Validate and add ingredients
        for ingredient_data in recipe_data.get("ingredients", []):
            validated_ingredient = validator.validate_ingredient_data(ingredient_data)
            validated_recipe_ingredient = validator.validate_recipe_ingredient_data(ingredient_data)
            
            # Create or get ingredient
            ingredient = Ingredient(
                name=validated_ingredient["name"],
                nutritional_data=validated_ingredient.get("nutritional_data", {}),
                allergens=validated_ingredient.get("allergens", []),
                dietary_flags=validated_ingredient.get("dietary_flags", {})
            )
            
            db.add(ingredient)
            db.flush()
            
            # Create recipe-ingredient relationship
            recipe_ingredient = RecipeIngredient(
                recipe_id=recipe.id,
                ingredient_id=ingredient.id,
                quantity=validated_recipe_ingredient["quantity"],
                unit=validated_recipe_ingredient["unit"],
                preparation_notes=validated_recipe_ingredient.get("preparation_notes"),
                is_optional=validated_recipe_ingredient.get("is_optional", False)
            )
            
            db.add(recipe_ingredient)
        
        db.commit()
        return recipe
        
    except Exception as e:
        db.rollback()
        raise e

# Usage example
# recipe_data = {
#     "name": "Chicken Stir Fry",
#     "description": "Quick and healthy dinner",
#     "instructions": "Cook chicken, add vegetables, stir fry",
#     "servings": 4,
#     "ingredients": [
#         {
#             "name": "Chicken Breast",
#             "quantity": "1",
#             "unit": "kg",
#             "nutritional_data": {...}
#         }
#     ]
# }
# 
# recipe = create_recipe_with_validation(db, recipe_data, user_id)
```

This comprehensive validation system provides:

1. **Type Safety**: All inputs are validated for correct types
2. **Business Rules**: Enforces application-specific rules (serving limits, realistic nutritional values, etc.)
3. **Security**: Prevents injection attacks and validates permissions
4. **User Experience**: Provides clear, actionable error messages
5. **Data Integrity**: Ensures consistent and valid data in the database
6. **Extensibility**: Easy to add new validation rules or modify existing ones
7. **Performance**: Efficient validation that fails fast on errors
8. **Comprehensive Coverage**: Validates all aspects of recipes and ingredients

The validators can be used independently or together, and integrate seamlessly with the existing database models and API endpoints.