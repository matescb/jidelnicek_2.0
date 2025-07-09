# Jidelnicek 2.0 Validation Service

## Overview

The comprehensive validation service for the Jidelnicek 2.0 application provides robust data validation for recipes, ingredients, nutritional information, quantities, images, and user permissions. This service ensures data integrity, security, and compliance with business rules.

## Architecture

### Core Components

1. **Validation Constants** (`ValidationConstants`)
   - Centralized configuration for all validation limits and rules
   - Min/max values for all data types
   - Valid choices for enums and categories
   - Unit conversion factors

2. **Validation Helpers** (`ValidationHelpers`)
   - Utility functions for common validation patterns
   - String sanitization and normalization
   - Type checking and conversion utilities

3. **Specialized Validators**
   - `RecipeValidator` - Recipe-specific validation
   - `IngredientValidator` - Ingredient data validation
   - `NutritionalValidator` - Nutritional data validation with consistency checks
   - `QuantityValidator` - Quantity and unit validation
   - `ImageValidator` - Image file validation
   - `PermissionValidator` - User permission validation

4. **Main Validator** (`JidelnicekValidator`)
   - Unified interface for all validation operations
   - Combines specialized validators
   - Provides comprehensive validation workflows

5. **Custom Exceptions**
   - Specific exception types for different validation errors
   - Structured error information with field names and error codes

## Features

### Recipe Validation

- **Basic Fields**: Name, description, instructions
- **Time Validation**: Prep time, cook time with realistic limits
- **Serving Validation**: 1-50 servings with integer validation
- **Water Requirements**: 0-10L validation for camping recipes
- **Difficulty Levels**: Easy, medium, hard validation
- **Rating System**: 0-5 star rating with count validation
- **Categories**: Predefined recipe categories
- **Consistency Checks**: Total time limits, rating consistency

### Ingredient Validation

- **Basic Information**: Name, brand, category, barcode
- **Nutritional Data**: Comprehensive nutritional validation
- **Allergens**: Predefined allergen types
- **Dietary Flags**: Vegan, vegetarian, gluten-free, etc.
- **Unit Conversions**: Flexible unit conversion factors
- **Barcode Validation**: Format and length validation

### Nutritional Data Validation

- **Required Fields**: Calories, proteins, carbs, fats
- **Optional Fields**: Fiber, vitamins, minerals
- **Realistic Ranges**: Prevents impossible nutritional values
- **Consistency Checks**: Calorie calculation verification
- **Macronutrient Logic**: Fiber ≤ carbs, saturated fats ≤ total fats
- **Vitamin Ranges**: Specific ranges for each vitamin

### Quantity Validation

- **Positive Values**: Quantities must be > 0
- **Realistic Limits**: 0.001 to 10,000 with warnings for extreme values
- **Decimal Precision**: Maximum 3 decimal places
- **Unit Validation**: 17 supported units across weight, volume, and count
- **Unit Consistency**: Prevents unrealistic quantity-unit combinations
- **Preparation Notes**: Optional preparation instructions

### Image Validation

- **File Size**: Maximum 10MB with configurable limits
- **Dimensions**: 100x100 to 4096x4096 pixels
- **Format Support**: JPEG, PNG, WebP, GIF
- **Aspect Ratio**: Prevents extremely wide/tall images
- **Content Validation**: Actual image format verification
- **Security**: Prevents malicious file uploads

### Permission Validation

- **User Authentication**: UUID validation and user existence
- **Recipe Ownership**: Creator permissions for editing
- **Access Control**: Public/private recipe access
- **Admin Permissions**: Role-based access control
- **Account Status**: Active account and email verification
- **Rate Limiting**: Recipe creation limits per user

## Validation Constants

### Recipe Limits
- Name: 3-100 characters
- Description: 0-1000 characters
- Instructions: 10-2000 characters
- Servings: 1-50
- Times: 0-1440 minutes (24 hours)
- Water: 0-10000 ml
- Rating: 0.0-5.0

### Ingredient Limits
- Name: 2-100 characters
- Brand: 0-100 characters
- Category: 0-50 characters
- Barcode: 8, 12, 13, or 14 digits
- Preparation notes: 0-200 characters

### Nutritional Ranges (per 100g)
- Calories: 0-900 kcal
- Macronutrients: 0-100g each
- Vitamins: Specific ranges per vitamin
- Minerals: Realistic ranges per mineral

### Quantity Limits
- Range: 0.001-10000
- Precision: 3 decimal places
- 17 supported units

### Image Limits
- Size: 10MB maximum
- Dimensions: 100x100 to 4096x4096
- Formats: JPEG, PNG, WebP, GIF
- Aspect ratio: 0.1 to 10.0

## Supported Units

### Weight Units
- `g` (grams) - base unit
- `kg` (kilograms) - 1000g
- `mg` (milligrams) - 0.001g

### Volume Units
- `ml` (milliliters) - base unit
- `l` (liters) - 1000ml
- `dl` (deciliters) - 100ml
- `cl` (centiliters) - 10ml
- `cup` - 240ml
- `tbsp` (tablespoon) - 15ml
- `tsp` (teaspoon) - 5ml

### Count Units
- `piece` - individual items
- `pcs` - pieces
- `slice` - slices
- `clove` - cloves
- `can` - cans
- `package` - packages
- `bottle` - bottles

## Error Handling

### Exception Hierarchy
```
ValidationException (base)
├── RecipeValidationError
├── IngredientValidationError
├── NutritionalValidationError
├── QuantityValidationError
├── ImageValidationError
├── PermissionValidationError
└── UnitValidationError
```

### Error Information
Each exception includes:
- `message`: Human-readable error description
- `field`: Field name that caused the error
- `code`: Machine-readable error code

### Common Error Codes
- `required`: Missing required field
- `min_length`/`max_length`: Length validation
- `min_value`/`max_value`: Numeric range validation
- `invalid_choice`: Invalid enum/choice value
- `type`: Wrong data type
- `consistency`: Data consistency violation
- `insufficient_permission`: Permission denied

## Usage Examples

### Basic Recipe Validation
```python
from jidelnicek.core.validators import RecipeValidator

try:
    name = RecipeValidator.validate_recipe_name("Chocolate Cake")
    servings = RecipeValidator.validate_recipe_servings(8)
    prep_time, cook_time = RecipeValidator.validate_recipe_times(30, 45)
    print(f"Recipe: {name}, {servings} servings, {prep_time + cook_time} minutes")
except RecipeValidationError as e:
    print(f"Error: {e.message} (field: {e.field}, code: {e.code})")
```

### Complete Data Validation
```python
from jidelnicek.core.validators import JidelnicekValidator

validator = JidelnicekValidator()

recipe_data = {
    "name": "Vegetable Soup",
    "description": "Healthy and delicious",
    "instructions": "Chop vegetables, simmer in broth",
    "servings": 4,
    "difficulty_level": "easy",
    "categories": ["soup", "vegetarian"]
}

try:
    validated = validator.validate_recipe_data(recipe_data)
    print("Validation successful!")
except Exception as e:
    print(f"Validation failed: {e}")
```

### Nutritional Data Validation
```python
from jidelnicek.core.validators import NutritionalValidator

nutrition = {
    "calories": 250,
    "proteins": 15,
    "carbs": 30,
    "fats": 8,
    "fiber": 5,
    "vitamin_c": 45
}

try:
    validated = NutritionalValidator.validate_nutritional_data(nutrition)
    print("Nutritional data is valid and consistent")
except NutritionalValidationError as e:
    print(f"Nutrition error: {e.message}")
```

## Integration Points

### Database Models
- Validates data before saving to database
- Ensures consistency with model constraints
- Prevents invalid data persistence

### API Endpoints
- Input validation for all endpoints
- Consistent error response format
- User-friendly error messages

### Frontend Integration
- Validation rules available for client-side validation
- Consistent validation across frontend and backend
- Real-time validation feedback

### File Uploads
- Secure image validation
- Size and format restrictions
- Malicious file prevention

## Security Features

### Input Sanitization
- HTML/script injection prevention
- SQL injection protection
- XSS prevention through validation

### File Security
- Image format verification
- Size limits to prevent DoS
- Malicious file detection

### Permission Enforcement
- Role-based access control
- Resource ownership validation
- Account status verification

## Performance Considerations

### Validation Efficiency
- Fail-fast validation approach
- Minimal database queries
- Efficient regular expressions

### Caching
- Validation rules cached in memory
- Reusable validator instances
- Optimized helper functions

### Scalability
- Stateless validation design
- Thread-safe operations
- Minimal resource usage

## Testing

### Test Coverage
- Unit tests for all validators
- Integration tests for workflows
- Edge case testing
- Performance benchmarks

### Test Categories
- Valid input acceptance
- Invalid input rejection
- Boundary condition testing
- Error message accuracy
- Performance testing

## Configuration

### Environment Variables
- Validation limits configurable
- Feature flags for optional validation
- Debug mode for detailed errors

### Customization
- Extensible validator classes
- Custom validation rules
- Configurable error messages

## Future Enhancements

### Planned Features
- Multi-language error messages
- Custom validation rules per user
- Machine learning-based validation
- Advanced image analysis
- Bulk validation operations

### Extensibility
- Plugin architecture for custom validators
- Validation rule configuration UI
- API for validation rule management
- Integration with external validation services

## Dependencies

### Required
- `pydantic` - Data validation and settings
- `sqlalchemy` - Database ORM integration
- `uuid` - UUID validation
- `decimal` - Precise decimal arithmetic
- `pathlib` - File path operations
- `re` - Regular expressions

### Optional
- `PIL` (Pillow) - Image validation
- `typing` - Type hints
- `datetime` - Date/time validation

## Conclusion

The Jidelnicek 2.0 validation service provides comprehensive, secure, and efficient validation for all application data. It ensures data integrity, provides excellent user experience through clear error messages, and maintains security through proper input validation and permission checking.

The modular design allows for easy extension and customization while maintaining consistency across the application. The service integrates seamlessly with existing database models and API endpoints, providing a solid foundation for the application's data validation needs.