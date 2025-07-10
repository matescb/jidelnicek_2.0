"""
Ingredient management API endpoints.

This module provides comprehensive endpoints for ingredient management:
- List ingredients with filtering and search
- Get ingredient details with nutritional data
- Create ingredient with validation
- Update ingredient (admin only)
- Delete ingredient (admin only)
- Nutrition validation for ingredients
"""

from typing import List, Optional, Dict, Any
from uuid import UUID
import logging
from math import ceil
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func, or_, desc, asc
from sqlalchemy.orm import selectinload, joinedload
from pydantic import BaseModel, Field, validator

from jidelnicek.core.dependencies import get_db
from jidelnicek.core.utils import get_utc_now
from jidelnicek.core.validation.validation import (
    PermissionValidator, SchemaValidator, ValidationDependency,
    require_permission, validate_schema
)
from jidelnicek.auth.dependencies.auth import get_current_user, get_current_user_optional, get_current_admin_user
from jidelnicek.auth.models import AuthUser
from jidelnicek.common.models.ingredient import Ingredient
from jidelnicek.recipe.models.recipe_ingredient import RecipeIngredient
# from jidelnicek.common.models.nutritional_value import NutritionalValue  # Temporarily disabled

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/ingredients",
    tags=["ingredients"],
    responses={404: {"description": "Ingredient not found"}},
)

# Validation dependencies
ingredient_create_permission_validator = PermissionValidator('admin:access', require_verified=True)
ingredient_update_permission_validator = PermissionValidator('admin:access', require_verified=True)
ingredient_delete_permission_validator = PermissionValidator('admin:access', require_verified=True)


# =============================================================================
# Pydantic Schemas
# =============================================================================

class NutritionalDataBase(BaseModel):
    """Base schema for nutritional data."""
    calories: float = Field(..., ge=0, description="Calories per 100g")
    proteins: float = Field(..., ge=0, description="Proteins in grams per 100g")
    carbs: float = Field(..., ge=0, description="Carbohydrates in grams per 100g")
    fats: float = Field(..., ge=0, description="Fats in grams per 100g")
    fiber: Optional[float] = Field(None, ge=0, description="Fiber in grams per 100g")
    sodium: Optional[float] = Field(None, ge=0, description="Sodium in mg per 100g")
    sugars: Optional[float] = Field(None, ge=0, description="Sugars in grams per 100g")
    
    @validator('calories', 'proteins', 'carbs', 'fats')
    def validate_required_nutrients(cls, v):
        if v is None:
            raise ValueError("Required nutritional values cannot be None")
        return v


class UnitConversionsBase(BaseModel):
    """Base schema for unit conversions."""
    ml_to_g: Optional[float] = Field(None, gt=0, description="Milliliters to grams conversion factor")
    cup_to_g: Optional[float] = Field(None, gt=0, description="Cups to grams conversion factor")
    tbsp_to_g: Optional[float] = Field(None, gt=0, description="Tablespoons to grams conversion factor")
    tsp_to_g: Optional[float] = Field(None, gt=0, description="Teaspoons to grams conversion factor")
    piece_to_g: Optional[float] = Field(None, gt=0, description="Pieces to grams conversion factor")


class DietaryFlagsBase(BaseModel):
    """Base schema for dietary flags."""
    vegan: bool = Field(False, description="Is the ingredient vegan")
    vegetarian: bool = Field(False, description="Is the ingredient vegetarian")
    gluten_free: bool = Field(False, description="Is the ingredient gluten-free")
    dairy_free: bool = Field(False, description="Is the ingredient dairy-free")
    nut_free: bool = Field(False, description="Is the ingredient nut-free")
    kosher: bool = Field(False, description="Is the ingredient kosher")
    halal: bool = Field(False, description="Is the ingredient halal")


class IngredientBase(BaseModel):
    """Base schema for ingredients."""
    name: str = Field(..., min_length=1, max_length=200, description="Ingredient name")
    brand: Optional[str] = Field(None, max_length=100, description="Brand name")
    barcode: Optional[str] = Field(None, max_length=50, description="Barcode (EAN/UPC)")
    
    @validator('name')
    def validate_name(cls, v):
        if not v.strip():
            raise ValueError("Ingredient name cannot be empty")
        return v.strip()


class IngredientCreate(IngredientBase):
    """Schema for creating ingredients."""
    nutritional_data: NutritionalDataBase = Field(..., description="Nutritional data per 100g")
    unit_conversions: Optional[UnitConversionsBase] = Field(None, description="Unit conversion factors")
    dietary_flags: Optional[DietaryFlagsBase] = Field(None, description="Dietary restriction flags")
    allergens: Optional[List[str]] = Field(None, description="List of allergens")


class IngredientUpdate(BaseModel):
    """Schema for updating ingredients."""
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    brand: Optional[str] = Field(None, max_length=100)
    barcode: Optional[str] = Field(None, max_length=50)
    nutritional_data: Optional[NutritionalDataBase] = None
    unit_conversions: Optional[UnitConversionsBase] = None
    dietary_flags: Optional[DietaryFlagsBase] = None
    allergens: Optional[List[str]] = None
    
    @validator('name')
    def validate_name(cls, v):
        if v is not None and not v.strip():
            raise ValueError("Ingredient name cannot be empty")
        return v.strip() if v else v


class IngredientResponse(IngredientBase):
    """Schema for ingredient responses."""
    id: UUID
    nutritional_data: Dict[str, Any]
    unit_conversions: Dict[str, Any]
    dietary_flags: Dict[str, Any]
    allergens: List[str]
    created_at: str
    updated_at: str
    
    class Config:
        from_attributes = True


class IngredientListItem(BaseModel):
    """Schema for ingredient list items."""
    id: UUID
    name: str
    brand: Optional[str]
    barcode: Optional[str]
    has_nutritional_data: bool
    dietary_flags: Dict[str, Any]
    allergens: List[str]
    created_at: str
    updated_at: str
    
    class Config:
        from_attributes = True


class IngredientListResponse(BaseModel):
    """Schema for paginated ingredient list responses."""
    items: List[IngredientListItem]
    total: int
    page: int
    page_size: int
    total_pages: int
    has_next: bool
    has_prev: bool


class IngredientSearchFilters(BaseModel):
    """Schema for ingredient search filters."""
    query: Optional[str] = Field(None, description="Search query for name or brand")
    brand: Optional[str] = Field(None, description="Filter by brand")
    has_barcode: Optional[bool] = Field(None, description="Filter by barcode presence")
    vegan: Optional[bool] = Field(None, description="Filter by vegan status")
    vegetarian: Optional[bool] = Field(None, description="Filter by vegetarian status")
    gluten_free: Optional[bool] = Field(None, description="Filter by gluten-free status")
    dairy_free: Optional[bool] = Field(None, description="Filter by dairy-free status")
    allergen: Optional[str] = Field(None, description="Filter by specific allergen")
    has_nutritional_data: Optional[bool] = Field(None, description="Filter by nutritional data presence")


# =============================================================================
# Validation Helper Functions
# =============================================================================

async def get_ingredient_or_404(
    ingredient_id: UUID,
    db: AsyncSession,
    user: Optional[AuthUser] = None
) -> Ingredient:
    """Get ingredient by ID or raise 404."""
    stmt = select(Ingredient).where(Ingredient.id == ingredient_id)
    result = await db.execute(stmt)
    ingredient = result.scalar_one_or_none()
    
    if not ingredient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                'error': {
                    'code': 'INGREDIENT_NOT_FOUND',
                    'message': f'Ingredient with ID {ingredient_id} not found'
                }
            }
        )
    
    return ingredient


async def validate_nutritional_data(nutritional_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Validate nutritional data consistency and completeness.
    
    Args:
        nutritional_data: Dictionary of nutritional values
        
    Returns:
        Dictionary with validation results and any errors
    """
    errors = []
    
    # Required nutrients
    required_nutrients = ['calories', 'proteins', 'carbs', 'fats']
    for nutrient in required_nutrients:
        if nutrient not in nutritional_data:
            errors.append({
                'field': nutrient,
                'message': f'Required nutrient {nutrient} is missing'
            })
        elif nutritional_data[nutrient] is None:
            errors.append({
                'field': nutrient,
                'message': f'Required nutrient {nutrient} cannot be null'
            })
        elif nutritional_data[nutrient] < 0:
            errors.append({
                'field': nutrient,
                'message': f'Nutrient {nutrient} cannot be negative'
            })
    
    # Validate calorie consistency (rough check)
    if all(nutrient in nutritional_data for nutrient in ['calories', 'proteins', 'carbs', 'fats']):
        calculated_calories = (
            nutritional_data['proteins'] * 4 +
            nutritional_data['carbs'] * 4 +
            nutritional_data['fats'] * 9
        )
        
        # Allow for 15% variance (fiber, alcohol, etc.)
        if abs(nutritional_data['calories'] - calculated_calories) > calculated_calories * 0.15:
            errors.append({
                'field': 'calories',
                'message': f'Calorie value {nutritional_data["calories"]} seems inconsistent with macronutrients (calculated: {calculated_calories:.1f})'
            })
    
    # Validate optional nutrients
    optional_nutrients = ['fiber', 'sodium', 'sugars']
    for nutrient in optional_nutrients:
        if nutrient in nutritional_data and nutritional_data[nutrient] is not None:
            if nutritional_data[nutrient] < 0:
                errors.append({
                    'field': nutrient,
                    'message': f'Nutrient {nutrient} cannot be negative'
                })
    
    # Validate sugar vs carbs relationship
    if 'sugars' in nutritional_data and 'carbs' in nutritional_data:
        if (nutritional_data['sugars'] is not None and 
            nutritional_data['carbs'] is not None and
            nutritional_data['sugars'] > nutritional_data['carbs']):
            errors.append({
                'field': 'sugars',
                'message': 'Sugars cannot exceed total carbohydrates'
            })
    
    return {
        'is_valid': len(errors) == 0,
        'errors': errors
    }


async def validate_unit_conversions(unit_conversions: Dict[str, Any]) -> Dict[str, Any]:
    """
    Validate unit conversion factors.
    
    Args:
        unit_conversions: Dictionary of unit conversion factors
        
    Returns:
        Dictionary with validation results and any errors
    """
    errors = []
    
    valid_units = ['ml_to_g', 'cup_to_g', 'tbsp_to_g', 'tsp_to_g', 'piece_to_g']
    for unit, factor in unit_conversions.items():
        if unit not in valid_units:
            errors.append({
                'field': unit,
                'message': f'Unknown unit conversion: {unit}'
            })
        elif factor is not None and factor <= 0:
            errors.append({
                'field': unit,
                'message': f'Conversion factor for {unit} must be positive'
            })
    
    # Validate reasonable conversion ratios
    if 'ml_to_g' in unit_conversions and unit_conversions['ml_to_g'] is not None:
        if unit_conversions['ml_to_g'] < 0.1 or unit_conversions['ml_to_g'] > 10:
            errors.append({
                'field': 'ml_to_g',
                'message': 'ml_to_g conversion factor seems unreasonable (should be between 0.1 and 10)'
            })
    
    if 'cup_to_g' in unit_conversions and unit_conversions['cup_to_g'] is not None:
        if unit_conversions['cup_to_g'] < 50 or unit_conversions['cup_to_g'] > 500:
            errors.append({
                'field': 'cup_to_g',
                'message': 'cup_to_g conversion factor seems unreasonable (should be between 50 and 500)'
            })
    
    return {
        'is_valid': len(errors) == 0,
        'errors': errors
    }


async def validate_dietary_flags(dietary_flags: Dict[str, Any]) -> Dict[str, Any]:
    """
    Validate dietary flags consistency.
    
    Args:
        dietary_flags: Dictionary of dietary flags
        
    Returns:
        Dictionary with validation results and any errors
    """
    errors = []
    
    # Validate boolean values
    for flag, value in dietary_flags.items():
        if not isinstance(value, bool):
            errors.append({
                'field': flag,
                'message': f'Dietary flag {flag} must be a boolean value'
            })
    
    # Validate logical consistency
    if dietary_flags.get('vegan', False) and not dietary_flags.get('vegetarian', False):
        errors.append({
            'field': 'vegetarian',
            'message': 'Vegan ingredients must also be vegetarian'
        })
    
    if dietary_flags.get('dairy_free', False) and not dietary_flags.get('vegan', False):
        # This is a warning, not an error - dairy-free doesn't imply vegan
        pass
    
    return {
        'is_valid': len(errors) == 0,
        'errors': errors
    }


async def validate_allergens(allergens: List[str]) -> Dict[str, Any]:
    """
    Validate allergen list.
    
    Args:
        allergens: List of allergen names
        
    Returns:
        Dictionary with validation results and any errors
    """
    errors = []
    
    # Common allergens for validation
    common_allergens = {
        'milk', 'eggs', 'fish', 'shellfish', 'tree nuts', 'peanuts',
        'wheat', 'soybeans', 'sesame', 'mustard', 'celery', 'lupin',
        'mollusks', 'sulfur dioxide'
    }
    
    for allergen in allergens:
        if not isinstance(allergen, str):
            errors.append({
                'field': 'allergens',
                'message': f'Allergen must be a string, got {type(allergen)}'
            })
        elif not allergen.strip():
            errors.append({
                'field': 'allergens',
                'message': 'Allergen names cannot be empty'
            })
        elif allergen.lower() not in common_allergens:
            # Warning for unknown allergens
            logger.warning(f"Unknown allergen: {allergen}")
    
    # Check for duplicates
    if len(allergens) != len(set(allergens)):
        errors.append({
            'field': 'allergens',
            'message': 'Duplicate allergens found'
        })
    
    return {
        'is_valid': len(errors) == 0,
        'errors': errors
    }


# =============================================================================
# Ingredient CRUD Endpoints
# =============================================================================

@router.get("/", response_model=IngredientListResponse)
async def list_ingredients(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    sort_by: str = Query("name", description="Sort field"),
    sort_order: str = Query("asc", regex="^(asc|desc)$", description="Sort order"),
    query: Optional[str] = Query(None, description="Search query"),
    brand: Optional[str] = Query(None, description="Filter by brand"),
    has_barcode: Optional[bool] = Query(None, description="Filter by barcode presence"),
    vegan: Optional[bool] = Query(None, description="Filter by vegan status"),
    vegetarian: Optional[bool] = Query(None, description="Filter by vegetarian status"),
    gluten_free: Optional[bool] = Query(None, description="Filter by gluten-free status"),
    dairy_free: Optional[bool] = Query(None, description="Filter by dairy-free status"),
    allergen: Optional[str] = Query(None, description="Filter by specific allergen"),
    has_nutritional_data: Optional[bool] = Query(None, description="Filter by nutritional data presence"),
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
        # Build base query
        stmt = select(Ingredient)
        
        # Apply filters
        conditions = []
        
        if query:
            search_term = f"%{query}%"
            conditions.append(
                or_(
                    Ingredient.name.ilike(search_term),
                    Ingredient.brand.ilike(search_term)
                )
            )
        
        if brand:
            conditions.append(Ingredient.brand.ilike(f"%{brand}%"))
        
        if has_barcode is not None:
            if has_barcode:
                conditions.append(Ingredient.barcode.isnot(None))
            else:
                conditions.append(Ingredient.barcode.is_(None))
        
        # Dietary flags filtering
        if vegan is not None:
            conditions.append(Ingredient.dietary_flags['vegan'].astext.cast(bool) == vegan)
        
        if vegetarian is not None:
            conditions.append(Ingredient.dietary_flags['vegetarian'].astext.cast(bool) == vegetarian)
        
        if gluten_free is not None:
            conditions.append(Ingredient.dietary_flags['gluten_free'].astext.cast(bool) == gluten_free)
        
        if dairy_free is not None:
            conditions.append(Ingredient.dietary_flags['dairy_free'].astext.cast(bool) == dairy_free)
        
        # Allergen filtering
        if allergen:
            conditions.append(Ingredient.allergens.op('@>')([allergen]))
        
        # Nutritional data filtering
        if has_nutritional_data is not None:
            if has_nutritional_data:
                conditions.append(Ingredient.nutritional_data.isnot(None))
            else:
                conditions.append(Ingredient.nutritional_data.is_(None))
        
        if conditions:
            stmt = stmt.where(and_(*conditions))
        
        # Add sorting
        sort_field = getattr(Ingredient, sort_by, Ingredient.name)
        if sort_order == "desc":
            stmt = stmt.order_by(desc(sort_field))
        else:
            stmt = stmt.order_by(asc(sort_field))
        
        # Get total count
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total_result = await db.execute(count_stmt)
        total = total_result.scalar()
        
        # Apply pagination
        offset = (page - 1) * page_size
        stmt = stmt.offset(offset).limit(page_size)
        
        # Execute query
        result = await db.execute(stmt)
        ingredients = result.scalars().all()
        
        # Build response items
        items = []
        for ingredient in ingredients:
            items.append(IngredientListItem(
                id=ingredient.id,
                name=ingredient.name,
                brand=ingredient.brand,
                barcode=ingredient.barcode,
                has_nutritional_data=bool(ingredient.nutritional_data),
                dietary_flags=ingredient.dietary_flags or {},
                allergens=ingredient.allergens or [],
                created_at=ingredient.created_at.isoformat(),
                updated_at=ingredient.updated_at.isoformat()
            ))
        
        # Calculate pagination metadata
        total_pages = ceil(total / page_size)
        
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
            detail={
                'error': {
                    'code': 'INGREDIENT_LIST_ERROR',
                    'message': 'Failed to list ingredients',
                    'details': [{'error': str(e)}]
                }
            }
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
    ingredient = await get_ingredient_or_404(ingredient_id, db, current_user)
    
    return IngredientResponse(
        id=ingredient.id,
        name=ingredient.name,
        brand=ingredient.brand,
        barcode=ingredient.barcode,
        nutritional_data=ingredient.nutritional_data or {},
        unit_conversions=ingredient.unit_conversions or {},
        dietary_flags=ingredient.dietary_flags or {},
        allergens=ingredient.allergens or [],
        created_at=ingredient.created_at.isoformat(),
        updated_at=ingredient.updated_at.isoformat()
    )


@router.post("/", response_model=IngredientResponse, status_code=status.HTTP_201_CREATED)
async def create_ingredient(
    ingredient_data: IngredientCreate,
    db: AsyncSession = Depends(get_db),
    current_user: AuthUser = Depends(ingredient_create_permission_validator)
):
    """
    Create a new ingredient with validation (admin only).
    
    - Validates nutritional data consistency
    - Validates unit conversions
    - Validates dietary flags
    - Validates allergen list
    - Creates ingredient with provided data
    - Returns complete ingredient data
    """
    try:
        # Validate nutritional data
        nutritional_validation = await validate_nutritional_data(ingredient_data.nutritional_data.dict())
        if not nutritional_validation['is_valid']:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={
                    'error': {
                        'code': 'NUTRITIONAL_DATA_VALIDATION_ERROR',
                        'message': 'Nutritional data validation failed',
                        'details': nutritional_validation['errors']
                    }
                }
            )
        
        # Validate unit conversions if provided
        if ingredient_data.unit_conversions:
            unit_validation = await validate_unit_conversions(ingredient_data.unit_conversions.dict())
            if not unit_validation['is_valid']:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail={
                        'error': {
                            'code': 'UNIT_CONVERSION_VALIDATION_ERROR',
                            'message': 'Unit conversion validation failed',
                            'details': unit_validation['errors']
                        }
                    }
                )
        
        # Validate dietary flags if provided
        if ingredient_data.dietary_flags:
            dietary_validation = await validate_dietary_flags(ingredient_data.dietary_flags.dict())
            if not dietary_validation['is_valid']:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail={
                        'error': {
                            'code': 'DIETARY_FLAGS_VALIDATION_ERROR',
                            'message': 'Dietary flags validation failed',
                            'details': dietary_validation['errors']
                        }
                    }
                )
        
        # Validate allergens if provided
        if ingredient_data.allergens:
            allergen_validation = await validate_allergens(ingredient_data.allergens)
            if not allergen_validation['is_valid']:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail={
                        'error': {
                            'code': 'ALLERGEN_VALIDATION_ERROR',
                            'message': 'Allergen validation failed',
                            'details': allergen_validation['errors']
                        }
                    }
                )
        
        # Check if ingredient with same name and brand already exists
        existing_stmt = select(Ingredient).where(
            and_(
                Ingredient.name == ingredient_data.name,
                Ingredient.brand == ingredient_data.brand
            )
        )
        existing_result = await db.execute(existing_stmt)
        if existing_result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    'error': {
                        'code': 'INGREDIENT_ALREADY_EXISTS',
                        'message': f'Ingredient "{ingredient_data.name}" from brand "{ingredient_data.brand}" already exists'
                    }
                }
            )
        
        # Create ingredient
        ingredient = Ingredient(
            name=ingredient_data.name,
            brand=ingredient_data.brand,
            barcode=ingredient_data.barcode,
            nutritional_data=ingredient_data.nutritional_data.dict(),
            unit_conversions=ingredient_data.unit_conversions.dict() if ingredient_data.unit_conversions else {},
            dietary_flags=ingredient_data.dietary_flags.dict() if ingredient_data.dietary_flags else {},
            allergens=ingredient_data.allergens or []
        )
        
        db.add(ingredient)
        await db.commit()
        await db.refresh(ingredient)
        
        return IngredientResponse(
            id=ingredient.id,
            name=ingredient.name,
            brand=ingredient.brand,
            barcode=ingredient.barcode,
            nutritional_data=ingredient.nutritional_data or {},
            unit_conversions=ingredient.unit_conversions or {},
            dietary_flags=ingredient.dietary_flags or {},
            allergens=ingredient.allergens or [],
            created_at=ingredient.created_at.isoformat(),
            updated_at=ingredient.updated_at.isoformat()
        )
        
    except HTTPException:
        await db.rollback()
        raise
    except Exception as e:
        await db.rollback()
        logger.error(f"Error creating ingredient: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                'error': {
                    'code': 'INGREDIENT_CREATION_ERROR',
                    'message': 'Failed to create ingredient',
                    'details': [{'error': str(e)}]
                }
            }
        )


@router.put("/{ingredient_id}", response_model=IngredientResponse)
async def update_ingredient(
    ingredient_id: UUID,
    ingredient_update: IngredientUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: AuthUser = Depends(ingredient_update_permission_validator)
):
    """
    Update ingredient with validation (admin only).
    
    - Validates updated nutritional data
    - Validates updated unit conversions
    - Validates updated dietary flags
    - Validates updated allergen list
    - Supports partial updates
    - Returns updated ingredient data
    """
    ingredient = await get_ingredient_or_404(ingredient_id, db, current_user)
    
    try:
        # Validate nutritional data if provided
        if ingredient_update.nutritional_data:
            nutritional_validation = await validate_nutritional_data(ingredient_update.nutritional_data.dict())
            if not nutritional_validation['is_valid']:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail={
                        'error': {
                            'code': 'NUTRITIONAL_DATA_VALIDATION_ERROR',
                            'message': 'Nutritional data validation failed',
                            'details': nutritional_validation['errors']
                        }
                    }
                )
        
        # Validate unit conversions if provided
        if ingredient_update.unit_conversions:
            unit_validation = await validate_unit_conversions(ingredient_update.unit_conversions.dict())
            if not unit_validation['is_valid']:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail={
                        'error': {
                            'code': 'UNIT_CONVERSION_VALIDATION_ERROR',
                            'message': 'Unit conversion validation failed',
                            'details': unit_validation['errors']
                        }
                    }
                )
        
        # Validate dietary flags if provided
        if ingredient_update.dietary_flags:
            dietary_validation = await validate_dietary_flags(ingredient_update.dietary_flags.dict())
            if not dietary_validation['is_valid']:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail={
                        'error': {
                            'code': 'DIETARY_FLAGS_VALIDATION_ERROR',
                            'message': 'Dietary flags validation failed',
                            'details': dietary_validation['errors']
                        }
                    }
                )
        
        # Validate allergens if provided
        if ingredient_update.allergens:
            allergen_validation = await validate_allergens(ingredient_update.allergens)
            if not allergen_validation['is_valid']:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail={
                        'error': {
                            'code': 'ALLERGEN_VALIDATION_ERROR',
                            'message': 'Allergen validation failed',
                            'details': allergen_validation['errors']
                        }
                    }
                )
        
        # Update ingredient fields
        update_fields = ingredient_update.dict(exclude_unset=True)
        for field, value in update_fields.items():
            if field == 'nutritional_data' and value:
                ingredient.nutritional_data = value.dict()
            elif field == 'unit_conversions' and value:
                ingredient.unit_conversions = value.dict()
            elif field == 'dietary_flags' and value:
                ingredient.dietary_flags = value.dict()
            elif hasattr(ingredient, field):
                setattr(ingredient, field, value)
        
        await db.commit()
        await db.refresh(ingredient)
        
        return IngredientResponse(
            id=ingredient.id,
            name=ingredient.name,
            brand=ingredient.brand,
            barcode=ingredient.barcode,
            nutritional_data=ingredient.nutritional_data or {},
            unit_conversions=ingredient.unit_conversions or {},
            dietary_flags=ingredient.dietary_flags or {},
            allergens=ingredient.allergens or [],
            created_at=ingredient.created_at.isoformat(),
            updated_at=ingredient.updated_at.isoformat()
        )
        
    except HTTPException:
        await db.rollback()
        raise
    except Exception as e:
        await db.rollback()
        logger.error(f"Error updating ingredient: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                'error': {
                    'code': 'INGREDIENT_UPDATE_ERROR',
                    'message': 'Failed to update ingredient',
                    'details': [{'error': str(e)}]
                }
            }
        )


@router.delete("/{ingredient_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_ingredient(
    ingredient_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: AuthUser = Depends(ingredient_delete_permission_validator)
):
    """
    Delete ingredient (admin only).
    
    - Validates that ingredient is not used in any recipes
    - Validates user permissions
    - Permanently deletes ingredient
    """
    ingredient = await get_ingredient_or_404(ingredient_id, db, current_user)
    
    try:
        # Check if ingredient is used in any recipes
        usage_stmt = select(func.count(RecipeIngredient.id)).where(
            RecipeIngredient.ingredient_id == ingredient_id
        )
        usage_result = await db.execute(usage_stmt)
        usage_count = usage_result.scalar()
        
        if usage_count > 0:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    'error': {
                        'code': 'INGREDIENT_IN_USE',
                        'message': f'Ingredient is used in {usage_count} recipes and cannot be deleted',
                        'details': [{'usage_count': usage_count}]
                    }
                }
            )
        
        # Delete ingredient
        await db.delete(ingredient)
        await db.commit()
        
    except HTTPException:
        await db.rollback()
        raise
    except Exception as e:
        await db.rollback()
        logger.error(f"Error deleting ingredient: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                'error': {
                    'code': 'INGREDIENT_DELETE_ERROR',
                    'message': 'Failed to delete ingredient',
                    'details': [{'error': str(e)}]
                }
            }
        )


@router.get("/validate/nutrition", response_model=Dict[str, Any])
async def validate_nutrition_data(
    calories: float = Query(..., ge=0),
    proteins: float = Query(..., ge=0),
    carbs: float = Query(..., ge=0),
    fats: float = Query(..., ge=0),
    fiber: Optional[float] = Query(None, ge=0),
    sodium: Optional[float] = Query(None, ge=0),
    sugars: Optional[float] = Query(None, ge=0),
    current_user: Optional[AuthUser] = Depends(get_current_user_optional)
):
    """
    Validate nutritional data without creating an ingredient.
    
    - Validates nutritional data consistency
    - Provides feedback on calorie calculations
    - Helpful for frontend validation
    """
    nutritional_data = {
        'calories': calories,
        'proteins': proteins,
        'carbs': carbs,
        'fats': fats
    }
    
    if fiber is not None:
        nutritional_data['fiber'] = fiber
    if sodium is not None:
        nutritional_data['sodium'] = sodium
    if sugars is not None:
        nutritional_data['sugars'] = sugars
    
    validation_result = await validate_nutritional_data(nutritional_data)
    
    return {
        'is_valid': validation_result['is_valid'],
        'errors': validation_result['errors'],
        'nutritional_data': nutritional_data
    }