"""
Ingredient management API endpoints.

This module provides comprehensive endpoints for ingredient management:
- List ingredients with filtering and search
- Get ingredient details with nutritional data
- Create ingredient with validation
- Update ingredient
- Delete ingredient
- Manage categories
"""

from typing import List, Optional
from uuid import UUID
import logging
from math import ceil

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession

from jidelnicek.core.dependencies import get_db
from jidelnicek.auth.dependencies.auth import get_current_user, get_current_user_optional
from jidelnicek.auth.models import AuthUser
from jidelnicek.ingredients.schemas.ingredient import (
    IngredientCreate,
    IngredientUpdate,
    IngredientResponse,
    IngredientListItem,
    IngredientListResponse,
    IngredientFilter
)
from jidelnicek.ingredients.services.ingredient_service import IngredientService
from jidelnicek.core.exceptions import NotFoundError, ConflictError, ValidationError

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/v1/ingredients",
    tags=["ingredients"],
    responses={404: {"description": "Ingredient not found"}},
)


@router.get("/", response_model=IngredientListResponse)
async def list_ingredients(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    sort_by: str = Query("name", description="Sort field"),
    sort_order: str = Query("asc", regex="^(asc|desc)$", description="Sort order"),
    # Filter parameters
    query: Optional[str] = Query(None, description="Search query for name or brand"),
    category: Optional[str] = Query(None, description="Filter by category"),
    brand: Optional[str] = Query(None, description="Filter by brand"),
    has_barcode: Optional[bool] = Query(None, description="Filter by barcode presence"),
    vegan: Optional[bool] = Query(None, description="Filter by vegan status"),
    vegetarian: Optional[bool] = Query(None, description="Filter by vegetarian status"),
    gluten_free: Optional[bool] = Query(None, description="Filter by gluten-free status"),
    dairy_free: Optional[bool] = Query(None, description="Filter by dairy-free status"),
    allergen: Optional[str] = Query(None, description="Filter by specific allergen"),
    has_nutritional_data: Optional[bool] = Query(None, description="Filter by nutritional data presence"),
    is_global: Optional[bool] = Query(None, description="Filter by global/user-specific status"),
    db: AsyncSession = Depends(get_db),
    current_user: Optional[AuthUser] = Depends(get_current_user_optional)
):
    """
    List ingredients with pagination, filters, and search.
    
    - Supports pagination with page and page_size
    - Supports sorting by various fields
    - Supports text search in name and brand
    - Supports filtering by dietary flags and allergens
    - Returns paginated results with metadata
    """
    try:
        service = IngredientService(db)
        
        # Build filter object
        filters = IngredientFilter(
            query=query,
            category=category,
            brand=brand,
            has_barcode=has_barcode,
            vegan=vegan,
            vegetarian=vegetarian,
            gluten_free=gluten_free,
            dairy_free=dairy_free,
            allergen=allergen,
            has_nutritional_data=has_nutritional_data,
            is_global=is_global,
            is_archived=False
        )
        
        # Get ingredients
        ingredients, total = await service.list_ingredients(
            user=current_user,
            filters=filters,
            page=page,
            page_size=page_size,
            sort_by=sort_by,
            sort_order=sort_order
        )
        
        # Build response items
        items = []
        for ingredient in ingredients:
            items.append(IngredientListItem(
                id=ingredient.id,
                name=ingredient.name,
                brand=ingredient.brand,
                category=ingredient.category,
                barcode=ingredient.barcode,
                has_nutritional_data=bool(ingredient.nutritional_data),
                dietary_flags=ingredient.dietary_flags or {},
                allergens=ingredient.allergens or [],
                is_global=ingredient.is_global,
                created_at=ingredient.created_at,
                updated_at=ingredient.updated_at
            ))
        
        # Calculate pagination metadata
        total_pages = ceil(total / page_size) if page_size > 0 else 1
        
        return IngredientListResponse(
            items=items,
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
            has_next=page < total_pages,
            has_prev=page > 1
        )
        
    except Exception as e:
        logger.error(f"Error listing ingredients: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to list ingredients"
        )


@router.get("/categories", response_model=List[str])
async def get_categories(
    db: AsyncSession = Depends(get_db),
    current_user: Optional[AuthUser] = Depends(get_current_user_optional)
):
    """
    Get all unique ingredient categories.
    
    Returns a sorted list of all available categories.
    """
    try:
        service = IngredientService(db)
        categories = await service.get_categories()
        return categories
        
    except Exception as e:
        logger.error(f"Error getting categories: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get categories"
        )


@router.get("/{ingredient_id}", response_model=IngredientResponse)
async def get_ingredient(
    ingredient_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[AuthUser] = Depends(get_current_user_optional)
):
    """
    Get ingredient details with complete nutritional data.
    
    - Returns complete ingredient data
    - Includes nutritional data, unit conversions, and dietary flags
    - Includes allergen information
    """
    try:
        service = IngredientService(db)
        ingredient = await service.get_ingredient(
            ingredient_id=ingredient_id,
            user=current_user
        )
        
        return IngredientResponse(
            id=ingredient.id,
            name=ingredient.name,
            brand=ingredient.brand,
            barcode=ingredient.barcode,
            category=ingredient.category,
            # image_url=ingredient.image_url,  # TODO: Add after migration
            user_id=ingredient.user_id,
            nutritional_data=ingredient.nutritional_data or {},
            unit_conversions=ingredient.unit_conversions or {},
            dietary_flags=ingredient.dietary_flags or {},
            allergens=ingredient.allergens or [],
            is_global=ingredient.is_global,
            is_archived=ingredient.is_archived,
            created_at=ingredient.created_at,
            updated_at=ingredient.updated_at
        )
        
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error getting ingredient: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get ingredient"
        )


@router.post("/", response_model=IngredientResponse, status_code=status.HTTP_201_CREATED)
async def create_ingredient(
    ingredient_data: IngredientCreate,
    db: AsyncSession = Depends(get_db),
    current_user: AuthUser = Depends(get_current_user)
):
    """
    Create a new ingredient with validation.
    
    - Validates nutritional data consistency
    - Validates unit conversions
    - Validates dietary flags
    - Validates allergen list
    - Creates ingredient with provided data
    - Returns complete ingredient data
    
    Requires authentication.
    """
    try:
        service = IngredientService(db)
        
        # Only admins can create global ingredients
        if ingredient_data.is_global and not current_user.is_admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only administrators can create global ingredients"
            )
        
        ingredient = await service.create_ingredient(
            ingredient_data=ingredient_data,
            user=current_user
        )
        
        return IngredientResponse(
            id=ingredient.id,
            name=ingredient.name,
            brand=ingredient.brand,
            barcode=ingredient.barcode,
            category=ingredient.category,
            # image_url=ingredient.image_url,  # TODO: Add after migration
            user_id=ingredient.user_id,
            nutritional_data=ingredient.nutritional_data or {},
            unit_conversions=ingredient.unit_conversions or {},
            dietary_flags=ingredient.dietary_flags or {},
            allergens=ingredient.allergens or [],
            is_global=ingredient.is_global,
            is_archived=ingredient.is_archived,
            created_at=ingredient.created_at,
            updated_at=ingredient.updated_at
        )
        
    except ConflictError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(e)
        )
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error creating ingredient: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create ingredient"
        )


@router.put("/{ingredient_id}", response_model=IngredientResponse)
async def update_ingredient(
    ingredient_id: UUID,
    ingredient_update: IngredientUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: AuthUser = Depends(get_current_user)
):
    """
    Update ingredient with validation.
    
    - Validates updated nutritional data
    - Validates updated unit conversions
    - Validates updated dietary flags
    - Validates updated allergen list
    - Supports partial updates
    - Returns updated ingredient data
    
    Requires authentication. Users can only update their own ingredients,
    admins can update any ingredient.
    """
    try:
        service = IngredientService(db)
        ingredient = await service.update_ingredient(
            ingredient_id=ingredient_id,
            update_data=ingredient_update,
            user=current_user
        )
        
        return IngredientResponse(
            id=ingredient.id,
            name=ingredient.name,
            brand=ingredient.brand,
            barcode=ingredient.barcode,
            category=ingredient.category,
            # image_url=ingredient.image_url,  # TODO: Add after migration
            user_id=ingredient.user_id,
            nutritional_data=ingredient.nutritional_data or {},
            unit_conversions=ingredient.unit_conversions or {},
            dietary_flags=ingredient.dietary_flags or {},
            allergens=ingredient.allergens or [],
            is_global=ingredient.is_global,
            is_archived=ingredient.is_archived,
            created_at=ingredient.created_at,
            updated_at=ingredient.updated_at
        )
        
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error updating ingredient: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update ingredient"
        )


@router.delete("/{ingredient_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_ingredient(
    ingredient_id: UUID,
    hard_delete: bool = Query(False, description="Permanently delete instead of archiving"),
    db: AsyncSession = Depends(get_db),
    current_user: AuthUser = Depends(get_current_user)
):
    """
    Delete or archive an ingredient.
    
    - By default, performs soft delete (archives the ingredient)
    - Use hard_delete=true to permanently delete
    - Validates that ingredient is not used in any recipes
    - Users can only delete their own ingredients
    - Admins can delete any ingredient
    
    Requires authentication.
    """
    try:
        service = IngredientService(db)
        await service.delete_ingredient(
            ingredient_id=ingredient_id,
            user=current_user,
            soft_delete=not hard_delete
        )
        
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error deleting ingredient: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete ingredient"
        )