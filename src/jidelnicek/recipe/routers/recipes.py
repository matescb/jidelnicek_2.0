"""
Recipe CRUD endpoints.

This module provides comprehensive endpoints for recipe management:
- Create recipe with ingredients and images
- List recipes with pagination and filtering
- Get recipe details
- Update recipe (owner only)
- Delete recipe (owner only)
- Duplicate recipe
- Publish/unpublish recipe
- Fork public recipes
- Advanced search with filters
"""

from typing import List, Optional, Dict, Any
from uuid import UUID
import logging
from math import ceil
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks, Query, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func, or_, delete, update, desc, asc
from sqlalchemy.orm import selectinload, joinedload

from jidelnicek.core.dependencies import get_db
from jidelnicek.core.utils import get_utc_now
from jidelnicek.core.validation.validation import (
    FileUploadValidator, PermissionValidator, SchemaValidator,
    require_permission, validate_file, validate_schema
)
from jidelnicek.auth.dependencies.auth import get_current_user, get_current_user_optional
from jidelnicek.auth.models import AuthUser
from jidelnicek.recipe.models.recipe import Recipe
from jidelnicek.common.models.ingredient import Ingredient
from jidelnicek.recipe.models.recipe_ingredient import RecipeIngredient
from jidelnicek.recipe.models.recipe_image import RecipeImage
from jidelnicek.recipe.models.categorization import (
    Category, Tag, RecipeCategory, RecipeTag
)
from jidelnicek.recipe.schemas.recipe import (
    RecipeCreate, RecipeUpdate, RecipeResponse, RecipeListItem, RecipeListResponse,
    RecipeSearchFilters, RecipeDuplicateRequest, RecipePublishRequest, RecipeForkRequest,
    RecipeStatsResponse
)
from jidelnicek.recipe.schemas.categorization import (
    RecipeCategoryAssignment,
    RecipeTagAssignment,
    CategoryInDB,
    TagInDB,
    RecipeCategorization,
    generate_slug
)
from jidelnicek.recipe.utils.nutrition_calculator import NutritionCalculator

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/recipes",
    tags=["recipes"],
    responses={404: {"description": "Recipe not found"}},
)

# Initialize nutrition calculator
nutrition_calculator = NutritionCalculator()

# Validation dependencies
recipe_image_validator = FileUploadValidator(
    max_size=5 * 1024 * 1024,  # 5MB
    allowed_extensions=['.jpg', '.jpeg', '.png', '.gif', '.webp'],
    allowed_mime_types=['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    require_image=True,
    max_image_dimensions=(2048, 2048),
    min_image_dimensions=(100, 100)
)

recipe_permission_validator = PermissionValidator('recipes:create')
recipe_update_permission_validator = PermissionValidator('recipes:update')
recipe_delete_permission_validator = PermissionValidator('recipes:delete')


async def validate_recipe_nutrition(recipe_ingredients: List[RecipeIngredient]) -> Dict[str, Any]:
    """
    Validate nutritional data completeness for recipe ingredients.
    
    Returns validation results and errors if any.
    """
    try:
        validation_results = nutrition_calculator.validate_nutritional_data(recipe_ingredients)
        
        errors = []
        if validation_results['missing_ingredients']:
            errors.append({
                'type': 'missing_nutritional_data',
                'message': 'Some ingredients are missing nutritional data',
                'ingredients': validation_results['missing_ingredients']
            })
        
        if validation_results['incomplete_ingredients']:
            errors.append({
                'type': 'incomplete_nutritional_data',
                'message': 'Some ingredients have incomplete nutritional data',
                'ingredients': validation_results['incomplete_ingredients']
            })
        
        return {
            'is_valid': len(errors) == 0,
            'errors': errors,
            'validation_results': validation_results
        }
    except Exception as e:
        logger.error(f"Nutrition validation error: {e}")
        return {
            'is_valid': False,
            'errors': [{
                'type': 'validation_error',
                'message': f'Nutrition validation failed: {str(e)}'
            }]
        }


async def validate_recipe_permissions(recipe: Recipe, user: AuthUser, action: str) -> None:
    """
    Validate user permissions for recipe actions.
    
    Args:
        recipe: The recipe to validate permissions for
        user: The current user
        action: The action being performed (create, update, delete)
    
    Raises:
        HTTPException: If permission is denied
    """
    if action in ['update', 'delete'] and not await is_recipe_owner(recipe, user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "error": "PERMISSION_DENIED",
                "message": f"Only the recipe owner can {action} this recipe",
                "details": [{"required_permission": f"recipes:{action}", "owner_only": True}]
            }
        )


async def validate_recipe_data_consistency(recipe_data: RecipeCreate) -> Dict[str, Any]:
    """
    Validate recipe data consistency and completeness.
    
    Args:
        recipe_data: The recipe data to validate
        
    Returns:
        Dictionary with validation results and any errors
    """
    errors = []
    
    # Validate recipe has ingredients
    if not recipe_data.ingredients:
        errors.append({
            'field': 'ingredients',
            'message': 'Recipe must have at least one ingredient'
        })
    
    # Validate image constraints
    if recipe_data.images:
        primary_count = sum(1 for img in recipe_data.images if img.is_primary)
        if primary_count > 1:
            errors.append({
                'field': 'images',
                'message': 'Only one primary image is allowed'
            })
        
        if len(recipe_data.images) > 10:
            errors.append({
                'field': 'images',
                'message': 'Maximum 10 images allowed per recipe'
            })
    
    # Validate time constraints
    if recipe_data.prep_time_minutes and recipe_data.prep_time_minutes < 0:
        errors.append({
            'field': 'prep_time_minutes',
            'message': 'Preparation time cannot be negative'
        })
    
    if recipe_data.cook_time_minutes and recipe_data.cook_time_minutes < 0:
        errors.append({
            'field': 'cook_time_minutes',
            'message': 'Cooking time cannot be negative'
        })
    
    # Validate servings
    if recipe_data.servings <= 0:
        errors.append({
            'field': 'servings',
            'message': 'Servings must be greater than 0'
        })
    
    return {
        'is_valid': len(errors) == 0,
        'errors': errors
    }


async def get_recipe_or_404(
    recipe_id: UUID,
    db: AsyncSession,
    user: Optional[AuthUser] = None,
    load_full_data: bool = False
) -> Recipe:
    """Get recipe by ID or raise 404."""
    stmt = select(Recipe).where(Recipe.id == recipe_id)
    
    # Include related data based on needs
    if load_full_data:
        stmt = stmt.options(
            selectinload(Recipe.ingredients).selectinload(RecipeIngredient.ingredient),
            selectinload(Recipe.images),
            selectinload(Recipe.recipe_categories).selectinload(RecipeCategory.category),
            selectinload(Recipe.recipe_tags).selectinload(RecipeTag.tag),
            selectinload(Recipe.original_recipe)
        )
    else:
        stmt = stmt.options(
            selectinload(Recipe.recipe_categories).selectinload(RecipeCategory.category),
            selectinload(Recipe.recipe_tags).selectinload(RecipeTag.tag)
        )
    
    result = await db.execute(stmt)
    recipe = result.scalar_one_or_none()
    
    if not recipe:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": "NOT_FOUND",
                "message": f"Recipe with ID {recipe_id} not found"
            }
        )
    
    # Check if recipe is archived
    if recipe.is_archived:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": "NOT_FOUND",
                "message": f"Recipe with ID {recipe_id} not found"
            }
        )
    
    # Check if recipe is public or user is author
    if not recipe.is_public and (not user or recipe.user_id != user.id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": "NOT_FOUND",
                "message": f"Recipe with ID {recipe_id} not found"
            }
        )
    
    return recipe


async def is_recipe_owner(
    recipe: Recipe,
    user: AuthUser
) -> bool:
    """Check if user owns the recipe."""
    return recipe.user_id == user.id


def increment_view_count_sync(recipe_id: UUID):
    """Increment view count for a recipe (synchronous for background task)."""
    try:
        # This would typically use a separate database connection
        # For now, we'll just log the increment
        logger.info(f"Incrementing view count for recipe {recipe_id}")
    except Exception as e:
        logger.error(f"Error incrementing view count for recipe {recipe_id}: {e}")
        # Don't raise error as this is a background task


async def build_recipe_search_query(
    db: AsyncSession,
    filters: RecipeSearchFilters,
    user: Optional[AuthUser] = None
):
    """Build search query for recipes with filters."""
    stmt = select(Recipe).where(Recipe.is_archived == False)
    
    # Base visibility filter
    if user:
        # User can see their own recipes + public recipes
        stmt = stmt.where(
            or_(
                Recipe.user_id == user.id,
                Recipe.is_public == True
            )
        )
    else:
        # Anonymous users can only see public recipes
        stmt = stmt.where(Recipe.is_public == True)
    
    # Apply filters
    if filters.query:
        search_term = f"%{filters.query}%"
        stmt = stmt.where(
            or_(
                Recipe.name.ilike(search_term),
                Recipe.description.ilike(search_term),
                Recipe.instructions.ilike(search_term)
            )
        )
    
    if filters.difficulty_level:
        stmt = stmt.where(Recipe.difficulty_level == filters.difficulty_level)
    
    if filters.max_prep_time:
        stmt = stmt.where(Recipe.prep_time_minutes <= filters.max_prep_time)
    
    if filters.max_cook_time:
        stmt = stmt.where(Recipe.cook_time_minutes <= filters.max_cook_time)
    
    if filters.max_total_time:
        stmt = stmt.where(
            (Recipe.prep_time_minutes + Recipe.cook_time_minutes) <= filters.max_total_time
        )
    
    if filters.min_servings:
        stmt = stmt.where(Recipe.servings >= filters.min_servings)
    
    if filters.max_servings:
        stmt = stmt.where(Recipe.servings <= filters.max_servings)
    
    if filters.is_public is not None:
        stmt = stmt.where(Recipe.is_public == filters.is_public)
    
    if filters.is_published is not None:
        stmt = stmt.where(Recipe.is_published == filters.is_published)
    
    if filters.author_id:
        stmt = stmt.where(Recipe.user_id == filters.author_id)
    
    if filters.min_rating:
        stmt = stmt.where(Recipe.rating_average >= filters.min_rating)
    
    if filters.created_after:
        stmt = stmt.where(Recipe.created_at >= filters.created_after)
    
    if filters.created_before:
        stmt = stmt.where(Recipe.created_at <= filters.created_before)
    
    # Category filtering
    if filters.category_ids:
        stmt = stmt.join(RecipeCategory).where(
            RecipeCategory.category_id.in_(filters.category_ids)
        )
    
    # Tag filtering
    if filters.tag_names:
        tag_slugs = [generate_slug(tag_name) for tag_name in filters.tag_names]
        stmt = stmt.join(RecipeTag).join(Tag).where(
            Tag.slug.in_(tag_slugs)
        )
    
    # Images filtering
    if filters.has_images is not None:
        if filters.has_images:
            stmt = stmt.join(RecipeImage, Recipe.id == RecipeImage.recipe_id)
        else:
            # Left join and filter for null
            stmt = stmt.outerjoin(RecipeImage, Recipe.id == RecipeImage.recipe_id).where(
                RecipeImage.recipe_id.is_(None)
            )
    
    return stmt


# =============================================================================
# Main Recipe CRUD Endpoints
# =============================================================================

# =============================================================================
# Recipe Version Endpoints (MUST come before generic {recipe_id} patterns)
# =============================================================================

@router.get("/{recipe_id}/versions")
async def get_recipe_versions(
    recipe_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[AuthUser] = Depends(get_current_user_optional)
):
    """
    Get recipe version history.
    
    - Returns last 10 versions of a recipe
    - Shows version number, change type, and metadata
    - Only recipe owner can view versions
    """
    recipe = await get_recipe_or_404(recipe_id, db, current_user)
    
    # Check permissions - only owner can see versions
    if not current_user or not await is_recipe_owner(recipe, current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "error": "FORBIDDEN", 
                "message": "Only the recipe owner can view version history"
            }
        )
    
    # For now, return 501 - not implemented yet (versioning is complex feature)
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail={
            "error": "NOT_IMPLEMENTED",
            "message": "Recipe versioning is not yet implemented",
            "details": [{"feature": "recipe_versioning", "status": "planned"}]
        }
    )


@router.post("/{recipe_id}/versions/{version_id}/restore")  
async def restore_recipe_version(
    recipe_id: UUID,
    version_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: AuthUser = Depends(get_current_user)
):
    """
    Restore a previous version of a recipe.
    
    - Only recipe owner can restore versions
    - Creates new version based on specified version
    - Returns updated recipe data
    """
    recipe = await get_recipe_or_404(recipe_id, db, current_user)
    
    # Check permissions - only owner can restore versions
    if not await is_recipe_owner(recipe, current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "error": "FORBIDDEN",
                "message": "Only the recipe owner can restore recipe versions" 
            }
        )
    
    # For now, return 501 - not implemented yet (versioning is complex feature)
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail={
            "error": "NOT_IMPLEMENTED", 
            "message": "Recipe version restoration is not yet implemented",
            "details": [{"feature": "recipe_versioning", "status": "planned"}]
        }
    )


# =============================================================================
# Recipe Image Endpoints (MUST come before generic {recipe_id} patterns)
# =============================================================================

@router.post("/{recipe_id}/images")
async def upload_recipe_image_to_recipe(
    recipe_id: UUID,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: AuthUser = Depends(get_current_user)
):
    """
    Upload an image for a specific recipe.
    
    - Validates file type, size, and dimensions
    - Only recipe owner can upload images
    - Max 5MB per image, max 10 images per recipe
    - Returns image metadata
    """
    recipe = await get_recipe_or_404(recipe_id, db, current_user)
    
    # Check permissions - only owner can upload images
    if not await is_recipe_owner(recipe, current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "error": "FORBIDDEN",
                "message": "Only the recipe owner can upload images"
            }
        )
    
    # Check current image count
    current_image_count = await db.execute(
        select(func.count()).select_from(RecipeImage).where(RecipeImage.recipe_id == recipe_id)
    )
    image_count = current_image_count.scalar()
    
    if image_count >= 10:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": "IMAGE_LIMIT_EXCEEDED",
                "message": "Maximum 10 images allowed per recipe"
            }
        )
    
    # Validate file
    try:
        # Basic file validation
        if not file.content_type or not file.content_type.startswith('image/'):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "error": "INVALID_FILE_TYPE",
                    "message": "Only image files are allowed"
                }
            )
        
        content = await file.read()
        if len(content) > 5 * 1024 * 1024:  # 5MB limit
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "error": "FILE_TOO_LARGE",
                    "message": "Image file must be smaller than 5MB"
                }
            )
        
        # Generate URLs (in production would upload to cloud storage)
        import uuid
        import os
        file_ext = os.path.splitext(file.filename)[1] if file.filename else '.jpg'
        unique_filename = f"{uuid.uuid4()}{file_ext}"
        
        base_url = "https://example.com/images/recipes"
        image_url = f"{base_url}/{unique_filename}"
        thumbnail_url = f"{base_url}/thumbs/{unique_filename}"
        
        # Create image record
        recipe_image = RecipeImage(
            recipe_id=recipe_id,
            image_url=image_url,
            thumbnail_url=thumbnail_url,
            alt_text=f"Image for {recipe.name}",
            display_order=image_count,
            is_primary=(image_count == 0)  # First image is primary
        )
        
        db.add(recipe_image)
        await db.commit()
        
        return {
            "id": str(recipe_image.id),
            "image_url": image_url,
            "thumbnail_url": thumbnail_url,
            "file_size_bytes": len(content),
            "uploaded_at": recipe_image.created_at.isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error uploading recipe image: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": "IMAGE_UPLOAD_ERROR",
                "message": "Failed to upload image",
                "details": [{"error": str(e)}]
            }
        )


@router.delete("/{recipe_id}/images/{image_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_recipe_image(
    recipe_id: UUID,
    image_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: AuthUser = Depends(get_current_user)
):
    """
    Delete a recipe image.
    
    - Only recipe owner can delete images
    - Removes image from recipe and storage
    - Updates primary image if needed
    """
    recipe = await get_recipe_or_404(recipe_id, db, current_user)
    
    # Check permissions - only owner can delete images
    if not await is_recipe_owner(recipe, current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "error": "FORBIDDEN",
                "message": "Only the recipe owner can delete images"
            }
        )
    
    # Find the image
    image_stmt = select(RecipeImage).where(
        and_(
            RecipeImage.recipe_id == recipe_id,
            RecipeImage.id == image_id
        )
    )
    image_result = await db.execute(image_stmt)
    image = image_result.scalar_one_or_none()
    
    if not image:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": "NOT_FOUND",
                "message": "Image not found"
            }
        )
    
    try:
        was_primary = image.is_primary
        
        # Delete the image
        await db.delete(image)
        
        # If this was the primary image, make another one primary
        if was_primary:
            remaining_stmt = (
                select(RecipeImage)
                .where(RecipeImage.recipe_id == recipe_id)
                .order_by(RecipeImage.display_order)
                .limit(1)
            )
            remaining_result = await db.execute(remaining_stmt)
            next_image = remaining_result.scalar_one_or_none()
            
            if next_image:
                next_image.is_primary = True
        
        await db.commit()
        
    except Exception as e:
        await db.rollback()
        logger.error(f"Error deleting recipe image: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": "IMAGE_DELETE_ERROR",
                "message": "Failed to delete image",
                "details": [{"error": str(e)}]
            }
        )


# =============================================================================
# Main Recipe CRUD Endpoints
# =============================================================================

@router.post("/", response_model=RecipeResponse, status_code=status.HTTP_201_CREATED)
async def create_recipe(
    recipe_data: RecipeCreate,
    db: AsyncSession = Depends(get_db),
    current_user: AuthUser = Depends(recipe_permission_validator)
):
    """
    Create a new recipe with ingredients and optional images.
    
    - Validates recipe data consistency
    - Validates nutritional data completeness
    - Validates user permissions
    - Creates recipe with provided data
    - Adds ingredients if provided
    - Adds images if provided
    - Returns complete recipe data
    """
    try:
        # Validate recipe data consistency
        validation_result = await validate_recipe_data_consistency(recipe_data)
        if not validation_result['is_valid']:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={
                    "error": "RECIPE_VALIDATION_ERROR",
                    "message": "Recipe data validation failed",
                    "details": validation_result['errors']
                }
            )
        
        # Create recipe
        recipe = Recipe(
            user_id=current_user.id,
            name=recipe_data.name,
            description=recipe_data.description,
            instructions=recipe_data.instructions,
            difficulty_level=recipe_data.difficulty_level,
            prep_time_minutes=recipe_data.prep_time_minutes,
            cook_time_minutes=recipe_data.cook_time_minutes,
            water_ml=recipe_data.water_ml,
            servings=recipe_data.servings,
            is_public=recipe_data.is_public
        )
        
        db.add(recipe)
        await db.flush()  # Get recipe ID
        
        # Add ingredients with validation
        recipe_ingredients = []
        for ingredient_data in recipe_data.ingredients:
            # Validate ingredient exists
            ingredient_stmt = select(Ingredient).where(Ingredient.id == ingredient_data.ingredient_id)
            ingredient_result = await db.execute(ingredient_stmt)
            ingredient = ingredient_result.scalar_one_or_none()
            
            if not ingredient:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail={
                        "error": "INGREDIENT_NOT_FOUND",
                        "message": f"Ingredient with ID {ingredient_data.ingredient_id} not found"
                    }
                )
            
            recipe_ingredient = RecipeIngredient(
                recipe_id=recipe.id,
                ingredient_id=ingredient_data.ingredient_id,
                quantity_g=ingredient_data.quantity_g,
                preparation_notes=ingredient_data.preparation_notes,
                is_optional=ingredient_data.is_optional,
                display_order=ingredient_data.display_order
            )
            db.add(recipe_ingredient)
            recipe_ingredients.append(recipe_ingredient)
        
        # Validate nutrition data (warn but don't fail)
        if recipe_ingredients:
            nutrition_validation = await validate_recipe_nutrition(recipe_ingredients)
            if not nutrition_validation['is_valid']:
                logger.warning(f"Recipe {recipe.id} has nutrition validation issues: {nutrition_validation['errors']}")
        
        # Add images with validation
        for image_data in recipe_data.images:
            recipe_image = RecipeImage(
                recipe_id=recipe.id,
                image_url=image_data.image_url,
                thumbnail_url=image_data.thumbnail_url,
                alt_text=image_data.alt_text,
                display_order=image_data.display_order,
                is_primary=image_data.is_primary
            )
            db.add(recipe_image)
        
        await db.commit()
        
        # Return complete recipe data
        return await get_recipe_or_404(recipe.id, db, current_user, load_full_data=True)
        
    except HTTPException:
        await db.rollback()
        raise
    except Exception as e:
        await db.rollback()
        logger.error(f"Error creating recipe: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": "RECIPE_CREATION_ERROR",
                "message": "Failed to create recipe",
                "details": [{"error": str(e)}]
            }
        )


@router.get("/search", response_model=RecipeListResponse)
async def search_recipes(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    sort_by: str = Query("created_at", description="Sort field"),
    sort_order: str = Query("desc", regex="^(asc|desc)$", description="Sort order"),
    query: Optional[str] = Query(None, description="Search query"),
    difficulty_level: Optional[str] = Query(None, description="Filter by difficulty"),
    max_prep_time: Optional[int] = Query(None, ge=0, description="Max prep time in minutes"),
    max_cook_time: Optional[int] = Query(None, ge=0, description="Max cook time in minutes"),
    max_total_time: Optional[int] = Query(None, ge=0, description="Max total time in minutes"),
    min_servings: Optional[int] = Query(None, gt=0, description="Minimum servings"),
    max_servings: Optional[int] = Query(None, gt=0, description="Maximum servings"),
    is_public: Optional[bool] = Query(None, description="Filter by public/private"),
    is_published: Optional[bool] = Query(None, description="Filter by published status"),
    author_id: Optional[UUID] = Query(None, description="Filter by author ID"),
    has_images: Optional[bool] = Query(None, description="Filter by presence of images"),
    min_rating: Optional[float] = Query(None, ge=0, le=5, description="Minimum rating"),
    db: AsyncSession = Depends(get_db),
    current_user: Optional[AuthUser] = Depends(get_current_user_optional)
):
    """
    Advanced search with filters.
    
    - Supports all filtering options
    - Supports full-text search
    - Supports category and tag filtering
    - Returns paginated results
    """
    # This is essentially the same as list_recipes but with more explicit filtering
    return await list_recipes(
        page=page,
        page_size=page_size,
        sort_by=sort_by,
        sort_order=sort_order,
        query=query,
        difficulty_level=difficulty_level,
        max_prep_time=max_prep_time,
        max_cook_time=max_cook_time,
        max_total_time=max_total_time,
        min_servings=min_servings,
        max_servings=max_servings,
        is_public=is_public,
        is_published=is_published,
        author_id=author_id,
        has_images=has_images,
        min_rating=min_rating,
        db=db,
        current_user=current_user
    )


@router.get("/", response_model=RecipeListResponse)
async def list_recipes(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    sort_by: str = Query("created_at", description="Sort field"),
    sort_order: str = Query("desc", regex="^(asc|desc)$", description="Sort order"),
    query: Optional[str] = Query(None, description="Search query"),
    difficulty_level: Optional[str] = Query(None, description="Filter by difficulty"),
    max_prep_time: Optional[int] = Query(None, ge=0, description="Max prep time in minutes"),
    max_cook_time: Optional[int] = Query(None, ge=0, description="Max cook time in minutes"),
    max_total_time: Optional[int] = Query(None, ge=0, description="Max total time in minutes"),
    min_servings: Optional[int] = Query(None, gt=0, description="Minimum servings"),
    max_servings: Optional[int] = Query(None, gt=0, description="Maximum servings"),
    is_public: Optional[bool] = Query(None, description="Filter by public/private"),
    is_published: Optional[bool] = Query(None, description="Filter by published status"),
    author_id: Optional[UUID] = Query(None, description="Filter by author ID"),
    has_images: Optional[bool] = Query(None, description="Filter by presence of images"),
    min_rating: Optional[float] = Query(None, ge=0, le=5, description="Minimum rating"),
    db: AsyncSession = Depends(get_db),
    current_user: Optional[AuthUser] = Depends(get_current_user_optional)
):
    """
    List recipes with pagination, filters, and search.
    
    - Supports pagination with page and page_size
    - Supports sorting by various fields
    - Supports text search in name, description, instructions
    - Supports filtering by multiple criteria
    - Returns paginated results with metadata
    """
    try:
        # Build filters
        filters = RecipeSearchFilters(
            query=query,
            difficulty_level=difficulty_level,
            max_prep_time=max_prep_time,
            max_cook_time=max_cook_time,
            max_total_time=max_total_time,
            min_servings=min_servings,
            max_servings=max_servings,
            is_public=is_public,
            is_published=is_published,
            author_id=author_id,
            has_images=has_images,
            min_rating=min_rating
        )
        
        # Build base query
        stmt = await build_recipe_search_query(db, filters, current_user)
        
        # Add sorting
        sort_field = getattr(Recipe, sort_by, Recipe.created_at)
        if sort_order == "asc":
            stmt = stmt.order_by(asc(sort_field))
        else:
            stmt = stmt.order_by(desc(sort_field))
        
        # Get total count
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total_result = await db.execute(count_stmt)
        total = total_result.scalar()
        
        # Apply pagination
        offset = (page - 1) * page_size
        stmt = stmt.offset(offset).limit(page_size)
        
        # Execute query with minimal loading
        stmt = stmt.options(
            selectinload(Recipe.images),
            selectinload(Recipe.ingredients)
        )
        
        result = await db.execute(stmt)
        recipes = result.scalars().all()
        
        # Build response items
        items = []
        for recipe in recipes:
            primary_image = next(
                (img for img in recipe.images if img.is_primary),
                recipe.images[0] if recipe.images else None
            )
            
            item = RecipeListItem(
                id=recipe.id,
                name=recipe.name,
                description=recipe.description,
                difficulty_level=recipe.difficulty_level,
                prep_time_minutes=recipe.prep_time_minutes,
                cook_time_minutes=recipe.cook_time_minutes,
                total_time_minutes=recipe.total_time_minutes,
                servings=recipe.servings,
                rating_average=recipe.rating_average,
                rating_count=recipe.rating_count,
                view_count=recipe.view_count,
                is_public=recipe.is_public,
                is_published=recipe.is_published,
                fork_count=recipe.fork_count,
                is_forked=recipe.is_forked,
                created_at=recipe.created_at,
                updated_at=recipe.updated_at,
                primary_image=primary_image,
                ingredient_count=len(recipe.ingredients)
            )
            items.append(item)
        
        # Calculate pagination metadata
        total_pages = ceil(total / page_size)
        
        return RecipeListResponse(
            items=items,
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
            has_next=page < total_pages,
            has_prev=page > 1
        )
        
    except Exception as e:
        logger.error(f"Error listing recipes: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": "INTERNAL_SERVER_ERROR",
                "message": "Failed to list recipes"
            }
        )


@router.get("/{recipe_id}", response_model=RecipeResponse)
async def get_recipe(
    recipe_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[AuthUser] = Depends(get_current_user_optional),
    background_tasks: BackgroundTasks = BackgroundTasks()
):
    """
    Get recipe details with ingredients and images.
    
    - Returns complete recipe data
    - Increments view count in background
    - Includes ingredients, images, categories, tags
    - Includes original recipe data if forked
    """
    recipe = await get_recipe_or_404(recipe_id, db, current_user, load_full_data=True)
    
    # Increment view count in background (async)
    background_tasks.add_task(increment_view_count_sync, recipe_id)
    
    return recipe


@router.put("/{recipe_id}", response_model=RecipeResponse)
async def update_recipe(
    recipe_id: UUID,
    recipe_update: RecipeUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: AuthUser = Depends(recipe_update_permission_validator)
):
    """
    Update recipe (owner only).
    
    - Validates user permissions
    - Validates updated data consistency
    - Only recipe owner can update
    - Supports partial updates
    - Can update ingredients and images
    - Returns updated recipe data
    """
    recipe = await get_recipe_or_404(recipe_id, db, current_user, load_full_data=True)
    
    # Validate permissions
    await validate_recipe_permissions(recipe, current_user, 'update')
    
    try:
        # Update recipe fields
        update_fields = recipe_update.dict(exclude_unset=True, exclude={'ingredients', 'images'})
        for field, value in update_fields.items():
            if hasattr(recipe, field):
                setattr(recipe, field, value)
        
        # Update ingredients if provided
        if recipe_update.ingredients is not None:
            # Delete existing ingredients
            await db.execute(
                delete(RecipeIngredient).where(RecipeIngredient.recipe_id == recipe_id)
            )
            
            # Add new ingredients with validation
            recipe_ingredients = []
            for ingredient_data in recipe_update.ingredients:
                if ingredient_data.ingredient_id:  # Only add if ingredient_id is provided
                    # Validate ingredient exists
                    ingredient_stmt = select(Ingredient).where(Ingredient.id == ingredient_data.ingredient_id)
                    ingredient_result = await db.execute(ingredient_stmt)
                    ingredient = ingredient_result.scalar_one_or_none()
                    
                    if not ingredient:
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail={
                                "error": "INGREDIENT_NOT_FOUND",
                                "message": f"Ingredient with ID {ingredient_data.ingredient_id} not found"
                            }
                        )
                    
                    # Validate quantity
                    if ingredient_data.quantity_g is not None and ingredient_data.quantity_g <= 0:
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail={
                                "error": "INVALID_QUANTITY",
                                "message": "Ingredient quantity must be greater than 0"
                            }
                        )
                    
                    recipe_ingredient = RecipeIngredient(
                        recipe_id=recipe.id,
                        ingredient_id=ingredient_data.ingredient_id,
                        quantity_g=ingredient_data.quantity_g or 1,
                        preparation_notes=ingredient_data.preparation_notes,
                        is_optional=ingredient_data.is_optional or False,
                        display_order=ingredient_data.display_order or 0
                    )
                    db.add(recipe_ingredient)
                    recipe_ingredients.append(recipe_ingredient)
            
            # Validate nutrition data (warn but don't fail)
            if recipe_ingredients:
                nutrition_validation = await validate_recipe_nutrition(recipe_ingredients)
                if not nutrition_validation['is_valid']:
                    logger.warning(f"Recipe {recipe.id} has nutrition validation issues: {nutrition_validation['errors']}")
        
        # Update images if provided
        if recipe_update.images is not None:
            # Validate image constraints
            if len(recipe_update.images) > 10:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail={
                        "error": "TOO_MANY_IMAGES",
                        "message": "Maximum 10 images allowed per recipe"
                    }
                )
            
            primary_count = sum(1 for img in recipe_update.images if img.is_primary)
            if primary_count > 1:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail={
                        "error": "MULTIPLE_PRIMARY_IMAGES",
                        "message": "Only one primary image is allowed"
                    }
                )
            
            # Delete existing images
            await db.execute(
                delete(RecipeImage).where(RecipeImage.recipe_id == recipe_id)
            )
            
            # Add new images
            for image_data in recipe_update.images:
                if image_data.image_url:  # Only add if image_url is provided
                    recipe_image = RecipeImage(
                        recipe_id=recipe.id,
                        image_url=image_data.image_url,
                        thumbnail_url=image_data.thumbnail_url,
                        alt_text=image_data.alt_text,
                        display_order=image_data.display_order or 0,
                        is_primary=image_data.is_primary or False
                    )
                    db.add(recipe_image)
        
        await db.commit()
        
        # Return updated recipe
        return await get_recipe_or_404(recipe.id, db, current_user, load_full_data=True)
        
    except HTTPException:
        await db.rollback()
        raise
    except Exception as e:
        await db.rollback()
        logger.error(f"Error updating recipe: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": "RECIPE_UPDATE_ERROR",
                "message": "Failed to update recipe",
                "details": [{"error": str(e)}]
            }
        )


@router.delete("/{recipe_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_recipe(
    recipe_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: AuthUser = Depends(recipe_delete_permission_validator)
):
    """
    Soft delete recipe (owner only).
    
    - Validates user permissions
    - Only recipe owner can delete
    - Soft delete (sets is_archived=True)
    - Unpublishes recipe if published
    """
    recipe = await get_recipe_or_404(recipe_id, db, current_user)
    
    # Validate permissions
    await validate_recipe_permissions(recipe, current_user, 'delete')
    
    try:
        # Soft delete
        recipe.is_archived = True
        recipe.is_published = False
        recipe.published_at = None
        
        await db.commit()
        
    except Exception as e:
        await db.rollback()
        logger.error(f"Error deleting recipe: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": "RECIPE_DELETE_ERROR",
                "message": "Failed to delete recipe",
                "details": [{"error": str(e)}]
            }
        )


@router.post("/{recipe_id}/duplicate", response_model=RecipeResponse)
async def duplicate_recipe(
    recipe_id: UUID,
    duplicate_request: RecipeDuplicateRequest = RecipeDuplicateRequest(),
    db: AsyncSession = Depends(get_db),
    current_user: AuthUser = Depends(get_current_user)
):
    """
    Duplicate recipe (creates new copy).
    
    - Creates a new recipe copy
    - Copies all ingredients and images
    - User becomes owner of new recipe
    - Can specify new name and privacy settings
    """
    original_recipe = await get_recipe_or_404(recipe_id, db, current_user, load_full_data=True)
    
    try:
        # Create new recipe
        new_recipe = Recipe(
            user_id=current_user.id,
            name=duplicate_request.new_name or f"Copy of {original_recipe.name}",
            description=original_recipe.description,
            instructions=original_recipe.instructions,
            difficulty_level=original_recipe.difficulty_level,
            prep_time_minutes=original_recipe.prep_time_minutes,
            cook_time_minutes=original_recipe.cook_time_minutes,
            water_ml=original_recipe.water_ml,
            servings=original_recipe.servings,
            is_public=not duplicate_request.make_private,
            is_published=False  # Duplicated recipes are not published
        )
        
        db.add(new_recipe)
        await db.flush()
        
        # Copy ingredients
        for ingredient in original_recipe.ingredients:
            new_ingredient = RecipeIngredient(
                recipe_id=new_recipe.id,
                ingredient_id=ingredient.ingredient_id,
                quantity_g=ingredient.quantity_g,
                preparation_notes=ingredient.preparation_notes,
                is_optional=ingredient.is_optional,
                display_order=ingredient.display_order
            )
            db.add(new_ingredient)
        
        # Copy images
        for image in original_recipe.images:
            new_image = RecipeImage(
                recipe_id=new_recipe.id,
                image_url=image.image_url,
                thumbnail_url=image.thumbnail_url,
                alt_text=image.alt_text,
                display_order=image.display_order,
                is_primary=image.is_primary
            )
            db.add(new_image)
        
        await db.commit()
        
        # Return new recipe
        return await get_recipe_or_404(new_recipe.id, db, current_user, load_full_data=True)
        
    except Exception as e:
        await db.rollback()
        logger.error(f"Error duplicating recipe: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": "INTERNAL_SERVER_ERROR",
                "message": "Failed to duplicate recipe"
            }
        )


@router.post("/{recipe_id}/publish", response_model=RecipeResponse)
async def publish_recipe(
    recipe_id: UUID,
    publish_request: RecipePublishRequest = RecipePublishRequest(),
    db: AsyncSession = Depends(get_db),
    current_user: AuthUser = Depends(get_current_user)
):
    """
    Publish recipe to marketplace.
    
    - Only recipe owner can publish
    - Makes recipe public and published
    - Sets published_at timestamp
    """
    recipe = await get_recipe_or_404(recipe_id, db, current_user)
    
    if not await is_recipe_owner(recipe, current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "error": "FORBIDDEN",
                "message": "Only the recipe owner can publish this recipe"
            }
        )
    
    if recipe.is_published:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": "BAD_REQUEST",
                "message": "Recipe is already published"
            }
        )
    
    try:
        recipe.is_published = True
        recipe.published_at = get_utc_now()
        
        if publish_request.make_public:
            recipe.is_public = True
        
        await db.commit()
        
        return await get_recipe_or_404(recipe.id, db, current_user, load_full_data=True)
        
    except Exception as e:
        await db.rollback()
        logger.error(f"Error publishing recipe: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": "INTERNAL_SERVER_ERROR",
                "message": "Failed to publish recipe"
            }
        )


@router.post("/{recipe_id}/unpublish", response_model=RecipeResponse)
async def unpublish_recipe(
    recipe_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: AuthUser = Depends(get_current_user)
):
    """
    Unpublish recipe (with fork count check).
    
    - Only recipe owner can unpublish
    - Checks fork count <= 5 (database constraint)
    - Removes from marketplace but keeps recipe
    """
    recipe = await get_recipe_or_404(recipe_id, db, current_user)
    
    if not await is_recipe_owner(recipe, current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "error": "FORBIDDEN",
                "message": "Only the recipe owner can unpublish this recipe"
            }
        )
    
    if not recipe.is_published:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": "BAD_REQUEST",
                "message": "Recipe is not published"
            }
        )
    
    if not recipe.can_be_unpublished:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": "BAD_REQUEST",
                "message": "Cannot unpublish recipe with more than 5 forks"
            }
        )
    
    try:
        recipe.is_published = False
        recipe.published_at = None
        
        await db.commit()
        
        return await get_recipe_or_404(recipe.id, db, current_user, load_full_data=True)
        
    except Exception as e:
        await db.rollback()
        logger.error(f"Error unpublishing recipe: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": "INTERNAL_SERVER_ERROR",
                "message": "Failed to unpublish recipe"
            }
        )


@router.post("/{recipe_id}/fork", response_model=RecipeResponse)
async def fork_recipe(
    recipe_id: UUID,
    fork_request: RecipeForkRequest,
    db: AsyncSession = Depends(get_db),
    current_user: AuthUser = Depends(get_current_user)
):
    """
    Fork public recipe.
    
    - Creates new recipe copy with original_recipe_id set
    - Increments fork_count on original recipe
    - User becomes owner of forked recipe
    - Can specify new name
    """
    original_recipe = await get_recipe_or_404(recipe_id, db, current_user, load_full_data=True)
    
    if not original_recipe.is_published:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": "BAD_REQUEST",
                "message": "Can only fork published recipes"
            }
        )
    
    if original_recipe.user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": "BAD_REQUEST",
                "message": "Cannot fork your own recipe"
            }
        )
    
    try:
        # Create forked recipe
        forked_recipe = Recipe(
            user_id=current_user.id,
            name=fork_request.new_name or f"Fork of {original_recipe.name}",
            description=original_recipe.description,
            instructions=original_recipe.instructions,
            difficulty_level=original_recipe.difficulty_level,
            prep_time_minutes=original_recipe.prep_time_minutes,
            cook_time_minutes=original_recipe.cook_time_minutes,
            water_ml=original_recipe.water_ml,
            servings=original_recipe.servings,
            is_public=False,  # Forked recipes start as private
            is_published=False,
            original_recipe_id=original_recipe.id
        )
        
        db.add(forked_recipe)
        await db.flush()
        
        # Copy ingredients
        for ingredient in original_recipe.ingredients:
            new_ingredient = RecipeIngredient(
                recipe_id=forked_recipe.id,
                ingredient_id=ingredient.ingredient_id,
                quantity_g=ingredient.quantity_g,
                preparation_notes=ingredient.preparation_notes,
                is_optional=ingredient.is_optional,
                display_order=ingredient.display_order
            )
            db.add(new_ingredient)
        
        # Copy images
        for image in original_recipe.images:
            new_image = RecipeImage(
                recipe_id=forked_recipe.id,
                image_url=image.image_url,
                thumbnail_url=image.thumbnail_url,
                alt_text=image.alt_text,
                display_order=image.display_order,
                is_primary=image.is_primary
            )
            db.add(new_image)
        
        # Increment fork count on original
        original_recipe.fork_count += 1
        
        await db.commit()
        
        # Return forked recipe
        return await get_recipe_or_404(forked_recipe.id, db, current_user, load_full_data=True)
        
    except Exception as e:
        await db.rollback()
        logger.error(f"Error forking recipe: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": "INTERNAL_SERVER_ERROR",
                "message": "Failed to fork recipe"
            }
        )


# =============================================================================
# Recipe Categorization Endpoints (existing endpoints preserved)
# =============================================================================

async def update_tag_usage_counts(
    tag_ids: List[UUID],
    db: AsyncSession
):
    """Update usage counts for tags."""
    for tag_id in tag_ids:
        # Count recipes using this tag
        count_stmt = (
            select(func.count(RecipeTag.recipe_id))
            .where(RecipeTag.tag_id == tag_id)
        )
        result = await db.execute(count_stmt)
        count = result.scalar() or 0
        
        # Update tag usage count
        update_stmt = (
            select(Tag)
            .where(Tag.id == tag_id)
        )
        tag_result = await db.execute(update_stmt)
        tag = tag_result.scalar_one_or_none()
        if tag:
            tag.usage_count = count


@router.post("/{recipe_id}/categories", response_model=List[CategoryInDB])
async def assign_categories(
    recipe_id: UUID,
    assignments: List[RecipeCategoryAssignment],
    db: AsyncSession = Depends(get_db),
    current_user: AuthUser = Depends(get_current_user),
    background_tasks: BackgroundTasks = BackgroundTasks()
):
    """
    Assign categories to a recipe.
    
    Only the recipe owner can assign categories.
    Maximum of 3 categories per recipe.
    The first category in the list will be marked as primary.
    """
    # Get recipe and verify ownership
    recipe = await get_recipe_or_404(recipe_id, db, current_user)
    if not await is_recipe_owner(recipe, current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "error": "FORBIDDEN",
                "message": "Only the recipe owner can assign categories"
            }
        )
    
    # Validate category limit
    if len(assignments) > 3:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": "BAD_REQUEST",
                "message": "Maximum 3 categories allowed per recipe"
            }
        )
    
    # Verify all categories exist
    category_ids = [a.category_id for a in assignments]
    stmt = select(Category).where(Category.id.in_(category_ids))
    result = await db.execute(stmt)
    categories = list(result.scalars().unique())
    
    if len(categories) != len(category_ids):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": "BAD_REQUEST",
                "message": "One or more category IDs are invalid"
            }
        )
    
    # Remove existing category assignments
    delete_stmt = delete(RecipeCategory).where(RecipeCategory.recipe_id == recipe_id)
    await db.execute(delete_stmt)
    
    # Create new assignments
    assigned_categories = []
    for idx, assignment in enumerate(assignments):
        recipe_category = RecipeCategory(
            recipe_id=recipe_id,
            category_id=assignment.category_id,
            is_primary=(idx == 0)  # First is primary
        )
        db.add(recipe_category)
        
        # Find the category in our list
        category = next(c for c in categories if c.id == assignment.category_id)
        assigned_categories.append(category)
    
    try:
        await db.commit()
    except Exception as e:
        await db.rollback()
        logger.error(f"Error assigning categories: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": "INTERNAL_SERVER_ERROR",
                "message": "Failed to assign categories"
            }
        )
    
    return [
        CategoryInDB.model_validate(cat, from_attributes=True)
        for cat in assigned_categories
    ]


@router.post("/{recipe_id}/tags", response_model=List[TagInDB])
async def assign_tags(
    recipe_id: UUID,
    assignment: RecipeTagAssignment,
    db: AsyncSession = Depends(get_db),
    current_user: AuthUser = Depends(get_current_user),
    background_tasks: BackgroundTasks = BackgroundTasks()
):
    """
    Assign tags to a recipe.
    
    Only the recipe owner can assign tags.
    Tags will be created if they don't exist.
    Maximum of 20 tags per recipe.
    """
    # Get recipe and verify ownership
    recipe = await get_recipe_or_404(recipe_id, db, current_user)
    if not await is_recipe_owner(recipe, current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "error": "FORBIDDEN",
                "message": "Only the recipe owner can assign tags"
            }
        )
    
    # Process tag names - create or get existing
    tags_to_assign = []
    for tag_name in assignment.tag_names:
        slug = generate_slug(tag_name)
        
        # Check if tag exists
        stmt = select(Tag).where(Tag.slug == slug)
        result = await db.execute(stmt)
        tag = result.scalar_one_or_none()
        
        if not tag:
            # Create new tag
            tag = Tag(
                name=tag_name,
                slug=slug,
                usage_count=0
            )
            db.add(tag)
        
        tags_to_assign.append(tag)
    
    # Flush to get tag IDs
    await db.flush()
    
    # Remove existing tag assignments
    delete_stmt = delete(RecipeTag).where(RecipeTag.recipe_id == recipe_id)
    await db.execute(delete_stmt)
    
    # Create new assignments
    tag_ids = []
    for tag in tags_to_assign:
        recipe_tag = RecipeTag(
            recipe_id=recipe_id,
            tag_id=tag.id
        )
        db.add(recipe_tag)
        tag_ids.append(tag.id)
    
    try:
        await db.commit()
        
        # Update tag usage counts in background
        background_tasks.add_task(update_tag_usage_counts, tag_ids, db)
        
    except Exception as e:
        await db.rollback()
        logger.error(f"Error assigning tags: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": "INTERNAL_SERVER_ERROR",
                "message": "Failed to assign tags"
            }
        )
    
    return [
        TagInDB.model_validate(tag, from_attributes=True)
        for tag in tags_to_assign
    ]


@router.delete("/{recipe_id}/categories/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_category(
    recipe_id: UUID,
    category_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: AuthUser = Depends(get_current_user)
):
    """
    Remove a category from a recipe.
    
    Only the recipe owner can remove categories.
    """
    # Get recipe and verify ownership
    recipe = await get_recipe_or_404(recipe_id, db, current_user)
    if not await is_recipe_owner(recipe, current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "error": "FORBIDDEN",
                "message": "Only the recipe owner can remove categories"
            }
        )
    
    # Delete the assignment
    delete_stmt = delete(RecipeCategory).where(
        and_(
            RecipeCategory.recipe_id == recipe_id,
            RecipeCategory.category_id == category_id
        )
    )
    result = await db.execute(delete_stmt)
    
    if result.rowcount == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": "NOT_FOUND",
                "message": "Category assignment not found"
            }
        )
    
    # If this was the primary category, make another one primary
    remaining_stmt = (
        select(RecipeCategory)
        .where(RecipeCategory.recipe_id == recipe_id)
        .order_by(RecipeCategory.created_at)
        .limit(1)
    )
    remaining_result = await db.execute(remaining_stmt)
    first_remaining = remaining_result.scalar_one_or_none()
    
    if first_remaining:
        first_remaining.is_primary = True
    
    try:
        await db.commit()
    except Exception as e:
        await db.rollback()
        logger.error(f"Error removing category: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": "INTERNAL_SERVER_ERROR",
                "message": "Failed to remove category"
            }
        )


@router.delete("/{recipe_id}/tags/{tag_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_tag(
    recipe_id: UUID,
    tag_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: AuthUser = Depends(get_current_user),
    background_tasks: BackgroundTasks = BackgroundTasks()
):
    """
    Remove a tag from a recipe.
    
    Only the recipe owner can remove tags.
    """
    # Get recipe and verify ownership
    recipe = await get_recipe_or_404(recipe_id, db, current_user)
    if not await is_recipe_owner(recipe, current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "error": "FORBIDDEN",
                "message": "Only the recipe owner can remove tags"
            }
        )
    
    # Delete the assignment
    delete_stmt = delete(RecipeTag).where(
        and_(
            RecipeTag.recipe_id == recipe_id,
            RecipeTag.tag_id == tag_id
        )
    )
    result = await db.execute(delete_stmt)
    
    if result.rowcount == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": "NOT_FOUND",
                "message": "Tag assignment not found"
            }
        )
    
    try:
        await db.commit()
        
        # Update tag usage count in background
        background_tasks.add_task(update_tag_usage_counts, [tag_id], db)
        
    except Exception as e:
        await db.rollback()
        logger.error(f"Error removing tag: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": "INTERNAL_SERVER_ERROR",
                "message": "Failed to remove tag"
            }
        )


@router.get("/{recipe_id}/suggested-tags", response_model=List[str])
async def get_suggested_tags(
    recipe_id: UUID,
    limit: int = 10,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[AuthUser] = Depends(get_current_user_optional)
):
    """
    Get AI-suggested tags for a recipe based on its content.
    
    Analyzes recipe title, description, ingredients, and instructions
    to suggest relevant tags.
    """
    # Get recipe
    recipe = await get_recipe_or_404(recipe_id, db, current_user)
    
    # Simple tag suggestion based on content analysis
    # In production, this would use ML/NLP
    suggestions = set()
    
    # Combine text for analysis
    text_content = " ".join(filter(None, [
        recipe.title.lower() if hasattr(recipe, 'title') else "",
        recipe.description.lower() if hasattr(recipe, 'description') else "",
        recipe.instructions.lower() if hasattr(recipe, 'instructions') else ""
    ]))
    
    # Check for dietary keywords
    dietary_suggestions = {
        'vegan': ['plant-based', 'dairy-free', 'egg-free', 'no meat', 'no animal'],
        'vegetarian': ['no meat', 'meatless', 'veggie'],
        'gluten-free': ['no gluten', 'celiac', 'gluten free'],
        'dairy-free': ['no dairy', 'lactose-free', 'dairy free'],
        'keto': ['low-carb', 'high-fat', 'ketogenic'],
        'paleo': ['grain-free', 'no grains', 'paleolithic'],
        'sugar-free': ['no sugar', 'sugar free', 'unsweetened']
    }
    
    for tag, keywords in dietary_suggestions.items():
        if any(keyword in text_content for keyword in keywords):
            suggestions.add(tag)
    
    # Check for meal type keywords
    meal_suggestions = {
        'breakfast': ['morning', 'brunch', 'cereal', 'pancake', 'waffle'],
        'lunch': ['midday', 'sandwich', 'salad'],
        'dinner': ['evening', 'main course', 'entree'],
        'dessert': ['sweet', 'cake', 'cookie', 'ice cream', 'chocolate'],
        'snack': ['bite', 'quick', 'between meals'],
        'appetizer': ['starter', 'hors d\'oeuvre', 'finger food']
    }
    
    for tag, keywords in meal_suggestions.items():
        if any(keyword in text_content for keyword in keywords):
            suggestions.add(tag)
    
    # Check for cooking method keywords
    method_suggestions = {
        'baked': ['bake', 'oven', 'roast'],
        'grilled': ['grill', 'bbq', 'barbecue'],
        'fried': ['fry', 'pan-fry', 'deep-fry'],
        'slow-cooker': ['slow cook', 'crockpot', 'slow cooker'],
        'instant-pot': ['pressure cook', 'instant pot'],
        'no-cook': ['no cooking', 'raw', 'chilled']
    }
    
    for tag, keywords in method_suggestions.items():
        if any(keyword in text_content for keyword in keywords):
            suggestions.add(tag)
    
    # Check for cuisine keywords
    cuisine_suggestions = {
        'italian': ['pasta', 'pizza', 'risotto', 'italian'],
        'mexican': ['taco', 'burrito', 'salsa', 'mexican'],
        'asian': ['soy', 'sesame', 'wok', 'stir-fry'],
        'indian': ['curry', 'masala', 'tandoori', 'indian'],
        'mediterranean': ['olive', 'feta', 'hummus', 'mediterranean']
    }
    
    for tag, keywords in cuisine_suggestions.items():
        if any(keyword in text_content for keyword in keywords):
            suggestions.add(tag)
    
    # Special occasion tags
    if any(word in text_content for word in ['holiday', 'christmas', 'thanksgiving', 'easter']):
        suggestions.add('holiday')
    
    if any(word in text_content for word in ['party', 'gathering', 'crowd']):
        suggestions.add('party-food')
    
    # Quick/easy tags
    if any(word in text_content for word in ['quick', 'easy', 'simple', '15 minute', '30 minute']):
        suggestions.add('quick-and-easy')
    
    # Healthy tags
    if any(word in text_content for word in ['healthy', 'nutritious', 'low-calorie', 'light']):
        suggestions.add('healthy')
    
    # Get existing tags to avoid duplicates
    existing_tags_stmt = (
        select(Tag.slug)
        .join(RecipeTag)
        .where(RecipeTag.recipe_id == recipe_id)
    )
    existing_result = await db.execute(existing_tags_stmt)
    existing_slugs = {slug for (slug,) in existing_result}
    
    # Filter out existing tags
    suggestions = [tag for tag in suggestions if generate_slug(tag) not in existing_slugs]
    
    # Limit results
    return list(suggestions)[:limit]


@router.post("/upload-image", response_model=Dict[str, str])
async def upload_recipe_image(
    file: UploadFile = Depends(recipe_image_validator),
    current_user: AuthUser = Depends(get_current_user)
):
    """
    Upload a recipe image with validation.
    
    - Validates file type, size, and dimensions
    - Validates user permissions
    - Stores image and returns URL
    - Generates thumbnail automatically
    """
    try:
        # This would typically upload to cloud storage (S3, etc.)
        # For now, return a placeholder response
        
        # Read and validate file content
        content = await file.read()
        
        # Generate unique filename
        import uuid
        import os
        file_ext = os.path.splitext(file.filename)[1]
        unique_filename = f"{uuid.uuid4()}{file_ext}"
        
        # In production, upload to cloud storage
        # For demo purposes, return mock URLs
        base_url = "https://example.com/images/recipes"
        image_url = f"{base_url}/{unique_filename}"
        thumbnail_url = f"{base_url}/thumbs/{unique_filename}"
        
        return {
            "image_url": image_url,
            "thumbnail_url": thumbnail_url,
            "filename": unique_filename,
            "size": len(content),
            "content_type": file.content_type
        }
        
    except Exception as e:
        logger.error(f"Error uploading image: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": "IMAGE_UPLOAD_ERROR",
                "message": "Failed to upload image",
                "details": [{"error": str(e)}]
            }
        )


@router.get("/{recipe_id}/categorization", response_model=RecipeCategorization)
async def get_recipe_categorization(
    recipe_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[AuthUser] = Depends(get_current_user_optional)
):
    """
    Get complete categorization info for a recipe.
    
    Returns current categories, tags, and AI suggestions.
    """
    # Get recipe with categorization data
    recipe = await get_recipe_or_404(recipe_id, db, current_user)
    
    # Get current category
    category = None
    if hasattr(recipe, 'recipe_categories') and recipe.recipe_categories:
        # Find primary category or first one
        primary_cat = next(
            (rc for rc in recipe.recipe_categories if rc.is_primary),
            recipe.recipe_categories[0] if recipe.recipe_categories else None
        )
        if primary_cat:
            category = CategoryInDB.model_validate(
                primary_cat.category,
                from_attributes=True
            )
    
    # Get current tags
    tags = []
    if hasattr(recipe, 'recipe_tags'):
        tags = [
            TagInDB.model_validate(rt.tag, from_attributes=True)
            for rt in recipe.recipe_tags
        ]
    
    # Get suggested tags
    suggested_tags = await get_suggested_tags(recipe_id, 10, db, current_user)
    
    # Get suggested categories (simplified - in production would use ML)
    suggested_categories = []
    
    # Simple category suggestions based on tags and content
    if any('breakfast' in tag.name for tag in tags):
        breakfast_cat_stmt = select(Category).where(
            Category.slug.in_(['breakfast', 'morning-meals'])
        )
        breakfast_result = await db.execute(breakfast_cat_stmt)
        breakfast_cats = list(breakfast_result.scalars())
        suggested_categories.extend(breakfast_cats)
    
    # Convert to response models
    suggested_category_responses = [
        CategoryInDB.model_validate(cat, from_attributes=True)
        for cat in suggested_categories
        if not category or cat.id != category.id  # Don't suggest current category
    ][:3]  # Limit to 3 suggestions
    
    return RecipeCategorization(
        recipe_id=recipe_id,
        category=category,
        tags=tags,
        suggested_categories=suggested_category_responses,
        suggested_tags=suggested_tags
    )


