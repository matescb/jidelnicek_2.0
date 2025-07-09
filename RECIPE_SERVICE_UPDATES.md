# RecipeService Updates - Duplicate Recipe and Version Tracking

## Overview
Updated the RecipeService to add duplicate recipe functionality and version tracking integration as requested.

## New Features Added

### 1. Duplicate Recipe Functionality
- **Method**: `duplicate_recipe()`
- **Purpose**: Create exact copy of recipe for same user
- **Features**:
  - Copies all ingredients with exact quantities
  - Copies images (references same files)
  - Resets stats (view_count, rating, etc.)
  - Adds "(Copy)" to title by default
  - Allows custom name via `RecipeDuplicateRequest`

### 2. Version Tracking Integration
- **New Model**: `RecipeVersion`
- **Purpose**: Track significant changes to recipes over time
- **Features**:
  - Version numbering (major.minor format)
  - Change descriptions
  - Nutritional change tracking
  - User who made changes
  - Recipe snapshots
  - Significance detection (>1% nutritional change)

### 3. Updated CRUD Methods
All existing CRUD methods now support version tracking:
- `update_recipe()` - Creates versions for significant changes
- `add_ingredient_to_recipe()` - Tracks ingredient additions
- `update_recipe_ingredient()` - Tracks quantity changes
- `remove_ingredient_from_recipe()` - Tracks ingredient removals

## Files Modified

### Models
- **NEW**: `src/jidelnicek/recipe/models/recipe_version.py`
  - RecipeVersion model with validation
  - Foreign key relationships to Recipe and User
  - JSON snapshot storage
  - Proper indexing for performance

- **UPDATED**: `src/jidelnicek/recipe/models/recipe.py`
  - Added `versions` relationship
  - Added TYPE_CHECKING import for RecipeVersion

- **UPDATED**: `src/jidelnicek/recipe/models/__init__.py`
  - Exported RecipeVersion model

### Schemas
- **UPDATED**: `src/jidelnicek/recipe/schemas.py`
  - Added version tracking schemas:
    - `RecipeVersionBase`
    - `RecipeVersionCreate`
    - `RecipeVersionResponse`
    - `RecipeVersionHistory`
    - `RecipeVersionSummary`
  - Added duplicate recipe schemas:
    - `RecipeDuplicateRequest`
    - `RecipeDuplicateResponse`

### Services
- **UPDATED**: `src/jidelnicek/recipe/services/recipe_service.py`
  - Added duplicate recipe methods:
    - `duplicate_recipe()`
  - Added version tracking methods:
    - `create_version()`
    - `get_version_history()`
    - `calculate_nutritional_change()`
    - `is_significant_change()`
    - `create_version_on_update()`
  - Updated existing CRUD methods:
    - `update_recipe()` - Now supports version tracking
    - `add_ingredient_to_recipe()` - Now supports version tracking
    - `update_recipe_ingredient()` - Now supports version tracking
    - `remove_ingredient_from_recipe()` - Now supports version tracking

### Tests
- **NEW**: `tests/recipe/test_recipe_service_new_features.py`
  - Comprehensive tests for duplicate functionality
  - Tests for version tracking features
  - Permission and error handling tests

## API Usage Examples

### Duplicate Recipe
```python
# Basic duplication
result = await service.duplicate_recipe(recipe_id, user_id)

# Custom name
request = RecipeDuplicateRequest(new_name="My Custom Recipe")
result = await service.duplicate_recipe(recipe_id, user_id, request)
```

### Version Tracking
```python
# Get version history
history = await service.get_version_history(recipe_id, user_id)

# Create manual version
version_data = RecipeVersionCreate(
    version_number="2.0",
    change_description="Major recipe overhaul",
    change_type="major",
    is_significant=True
)
version = await service.create_version(recipe_id, user_id, version_data)

# Update with automatic version tracking
await service.update_recipe(recipe_id, user_id, update_data, create_version=True)
```

## Key Features

### Duplicate Recipe
1. **Exact Copy**: Creates identical recipe with same ingredients, quantities, and metadata
2. **Reset Stats**: Clears view count, ratings, fork count, and publication status
3. **Image Handling**: References same image files (no duplication)
4. **Permission Control**: Only recipe owners can duplicate their recipes
5. **Custom Naming**: Optional custom name or automatic "(Copy)" suffix

### Version Tracking
1. **Automatic Detection**: Detects significant changes (>1% nutritional change)
2. **Nutritional Monitoring**: Tracks percentage changes in key nutrients
3. **Change Descriptions**: Automatically generates descriptions for ingredient changes
4. **Snapshots**: Stores recipe state at time of version creation
5. **Version History**: Provides complete chronological history
6. **Integration**: Seamlessly integrates with existing CRUD operations

## Performance Considerations
- Version tracking is optional (can be disabled per operation)
- Nutritional calculations use exception handling for robustness
- Database queries are optimized with proper indexing
- Version creation only happens for significant changes

## Backward Compatibility
- All existing API methods remain unchanged
- Version tracking is opt-in for existing operations
- New parameters have sensible defaults
- No breaking changes to existing functionality

## Next Steps
1. Create database migration for RecipeVersion table
2. Add API endpoints for new functionality
3. Update documentation and API specs
4. Consider adding version comparison features
5. Implement version rollback functionality (future enhancement)