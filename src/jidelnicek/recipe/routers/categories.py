"""
Category management API endpoints.

This module provides endpoints for managing recipe categories with hierarchical structure:
- List categories (flat or tree structure)
- Get category details with recipes
- Create, update, and delete categories (admin only)
- Get category breadcrumbs
"""

from typing import List, Optional, Dict, Any
from uuid import UUID
import logging

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func
from sqlalchemy.orm import selectinload, joinedload

from jidelnicek.core.dependencies import get_db
from jidelnicek.core.validation.validation import (
    PermissionValidator, SchemaValidator, ValidationDependency,
    require_permission, validate_schema
)
from jidelnicek.auth.dependencies.auth import get_current_user, get_current_user_optional, get_current_admin_user
from jidelnicek.auth.models import AuthUser
from jidelnicek.recipe.models.categorization import Category, RecipeCategory, RecipeTag
from jidelnicek.recipe.models.recipe import Recipe
from jidelnicek.recipe.schemas.categorization import (
    CategoryCreate,
    CategoryUpdate,
    CategoryInDB,
    CategoryTree,
    CategoryWithRecipes,
)

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/categories",
    tags=["categories"],
    responses={404: {"description": "Category not found"}},
)

# Validation dependencies
category_create_permission_validator = PermissionValidator('admin:access', require_verified=True)
category_update_permission_validator = PermissionValidator('admin:access', require_verified=True)
category_delete_permission_validator = PermissionValidator('admin:access', require_verified=True)


async def get_category_or_404(
    category_id: UUID,
    db: AsyncSession = Depends(get_db)
) -> Category:
    """Get category by ID or raise 404."""
    stmt = select(Category).where(Category.id == category_id)
    result = await db.execute(stmt)
    category = result.scalar_one_or_none()
    
    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                'error': {
                    'code': 'CATEGORY_NOT_FOUND',
                    'message': f'Category with ID {category_id} not found'
                }
            }
        )
    
    return category


async def validate_category_hierarchy(category_id: UUID, parent_id: UUID, db: AsyncSession) -> Dict[str, Any]:
    """
    Validate category hierarchy to prevent circular references.
    
    Args:
        category_id: ID of the category being updated
        parent_id: ID of the proposed parent category
        db: Database session
        
    Returns:
        Dictionary with validation results and any errors
    """
    errors = []
    
    # Check if category is trying to be its own parent
    if category_id == parent_id:
        errors.append({
            'field': 'parent_id',
            'message': 'Category cannot be its own parent'
        })
        return {'is_valid': False, 'errors': errors}
    
    # Check for circular reference by traversing up the parent chain
    current_parent_id = parent_id
    visited = set()
    
    while current_parent_id:
        if current_parent_id in visited:
            errors.append({
                'field': 'parent_id',
                'message': 'Circular reference detected in category hierarchy'
            })
            break
        
        visited.add(current_parent_id)
        
        if current_parent_id == category_id:
            errors.append({
                'field': 'parent_id',
                'message': 'This would create a circular reference'
            })
            break
        
        # Get parent's parent
        parent_stmt = select(Category.parent_id).where(Category.id == current_parent_id)
        parent_result = await db.execute(parent_stmt)
        parent_row = parent_result.first()
        
        if not parent_row:
            break
        
        current_parent_id = parent_row[0]
    
    return {
        'is_valid': len(errors) == 0,
        'errors': errors
    }


async def validate_category_data(category_data: Dict[str, Any], db: AsyncSession) -> Dict[str, Any]:
    """
    Validate category data consistency.
    
    Args:
        category_data: Dictionary of category data
        db: Database session
        
    Returns:
        Dictionary with validation results and any errors
    """
    errors = []
    
    # Validate required fields
    if not category_data.get('name', '').strip():
        errors.append({
            'field': 'name',
            'message': 'Category name cannot be empty'
        })
    
    if not category_data.get('slug', '').strip():
        errors.append({
            'field': 'slug',
            'message': 'Category slug cannot be empty'
        })
    
    # Validate slug format
    slug = category_data.get('slug', '')
    if slug and not slug.replace('-', '').replace('_', '').isalnum():
        errors.append({
            'field': 'slug',
            'message': 'Category slug can only contain letters, numbers, hyphens, and underscores'
        })
    
    # Validate display_order
    display_order = category_data.get('display_order')
    if display_order is not None and display_order < 0:
        errors.append({
            'field': 'display_order',
            'message': 'Display order cannot be negative'
        })
    
    return {
        'is_valid': len(errors) == 0,
        'errors': errors
    }


async def build_category_tree(
    categories: List[Category],
    parent_id: Optional[UUID] = None,
    depth: int = 0,
    path: List[str] = None
) -> List[CategoryTree]:
    """Build hierarchical category tree from flat list."""
    if path is None:
        path = []
    
    tree = []
    for category in categories:
        if category.parent_id == parent_id:
            current_path = path + [category.name]
            
            # Count recipes in this category
            recipe_count = len(category.recipe_categories) if hasattr(category, 'recipe_categories') else 0
            
            node = CategoryTree(
                id=category.id,
                name=category.name,
                slug=category.slug,
                description=category.description,
                icon=category.icon,
                parent_id=category.parent_id,
                display_order=category.display_order,
                recipe_count=recipe_count,
                created_at=category.created_at,
                updated_at=category.updated_at,
                depth=depth,
                path=current_path,
                children=await build_category_tree(
                    categories, 
                    category.id, 
                    depth + 1,
                    current_path
                )
            )
            tree.append(node)
    
    # Sort by display_order
    tree.sort(key=lambda x: x.display_order)
    return tree


@router.get("", response_model=List[CategoryTree])
async def list_categories(
    tree: bool = Query(True, description="Return hierarchical tree structure"),
    include_empty: bool = Query(True, description="Include categories without recipes"),
    db: AsyncSession = Depends(get_db),
    current_user: Optional[AuthUser] = Depends(get_current_user_optional)
):
    """
    List all categories.
    
    Query parameters:
    - tree: If true, returns hierarchical structure. If false, returns flat list.
    - include_empty: If false, excludes categories with no recipes.
    
    Categories are returned sorted by display_order.
    """
    # Build query
    stmt = select(Category).options(
        selectinload(Category.recipe_categories)
    )
    
    # Execute query
    result = await db.execute(stmt)
    categories = list(result.scalars().unique())
    
    # Filter empty categories if requested
    if not include_empty:
        categories = [
            cat for cat in categories 
            if hasattr(cat, 'recipe_categories') and len(cat.recipe_categories) > 0
        ]
    
    # Build tree structure if requested
    if tree:
        category_tree = await build_category_tree(categories)
        return category_tree
    else:
        # Convert to flat list with recipe counts
        flat_categories = []
        for category in categories:
            recipe_count = len(category.recipe_categories) if hasattr(category, 'recipe_categories') else 0
            
            # Get path for flat display
            path = []
            current = category
            while current:
                path.insert(0, current.name)
                # Find parent in categories list
                current = next((c for c in categories if c.id == current.parent_id), None)
            
            flat_categories.append(CategoryTree(
                id=category.id,
                name=category.name,
                slug=category.slug,
                description=category.description,
                icon=category.icon,
                parent_id=category.parent_id,
                display_order=category.display_order,
                recipe_count=recipe_count,
                created_at=category.created_at,
                updated_at=category.updated_at,
                depth=len(path) - 1,
                path=path,
                children=[]
            ))
        
        # Sort by path for logical grouping
        flat_categories.sort(key=lambda x: x.path)
        return flat_categories


@router.get("/{category_id}", response_model=CategoryWithRecipes)
async def get_category(
    category_id: UUID,
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    db: AsyncSession = Depends(get_db),
    current_user: Optional[AuthUser] = Depends(get_current_user_optional)
):
    """
    Get category details with recipes.
    
    Returns category information along with paginated list of recipes
    in this category.
    """
    # Get category
    category = await get_category_or_404(category_id, db)
    
    # Count total recipes in category
    count_stmt = (
        select(func.count(RecipeCategory.recipe_id))
        .where(RecipeCategory.category_id == category_id)
    )
    total_result = await db.execute(count_stmt)
    total_recipes = total_result.scalar() or 0
    
    # Get paginated recipes
    offset = (page - 1) * page_size
    recipe_stmt = (
        select(Recipe)
        .join(RecipeCategory)
        .where(RecipeCategory.category_id == category_id)
        .options(
            selectinload(Recipe.author),
            selectinload(Recipe.recipe_images),
            selectinload(Recipe.recipe_categories).selectinload(RecipeCategory.category),
            selectinload(Recipe.recipe_tags).selectinload(RecipeTag.tag)
        )
        .offset(offset)
        .limit(page_size)
        .order_by(Recipe.created_at.desc())
    )
    
    recipe_result = await db.execute(recipe_stmt)
    recipes = list(recipe_result.scalars().unique())
    
    # Convert to response dicts (avoiding circular import)
    recipe_responses = [
        {
            "id": str(recipe.id),
            "title": recipe.title,
            "description": recipe.description,
            "prep_time_minutes": recipe.prep_time_minutes,
            "cook_time_minutes": recipe.cook_time_minutes,
            "servings": recipe.servings,
            "difficulty": recipe.difficulty,
            "is_public": recipe.is_public,
            "author_id": str(recipe.author_id),
            "created_at": recipe.created_at.isoformat() if recipe.created_at else None,
            "updated_at": recipe.updated_at.isoformat() if recipe.updated_at else None,
        }
        for recipe in recipes
    ]
    
    return CategoryWithRecipes(
        id=category.id,
        name=category.name,
        slug=category.slug,
        description=category.description,
        icon=category.icon,
        parent_id=category.parent_id,
        display_order=category.display_order,
        recipe_count=total_recipes,
        created_at=category.created_at,
        updated_at=category.updated_at,
        recipes=recipe_responses,
        total_recipes=total_recipes
    )


@router.post("", response_model=CategoryInDB, status_code=status.HTTP_201_CREATED)
async def create_category(
    category_data: CategoryCreate,
    db: AsyncSession = Depends(get_db),
    admin_user: AuthUser = Depends(category_create_permission_validator)
):
    """
    Create a new category (admin only).
    
    - Validates category data consistency
    - Validates permission requirements
    - Validates slug uniqueness
    - Validates parent category existence
    - Creates category with provided data
    """
    try:
        # Validate category data
        validation_result = await validate_category_data(category_data.model_dump(), db)
        if not validation_result['is_valid']:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={
                    'error': {
                        'code': 'CATEGORY_VALIDATION_ERROR',
                        'message': 'Category data validation failed',
                        'details': validation_result['errors']
                    }
                }
            )
        
        # Check if slug already exists
        stmt = select(Category).where(Category.slug == category_data.slug)
        result = await db.execute(stmt)
        if result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    'error': {
                        'code': 'CATEGORY_SLUG_EXISTS',
                        'message': f'Category with slug \"{category_data.slug}\" already exists'
                    }
                }
            )
        
        # Verify parent exists if specified
        if category_data.parent_id:
            parent = await get_category_or_404(category_data.parent_id, db)
        
        # Create category
        category = Category(**category_data.model_dump())
        db.add(category)
        
        await db.commit()
        await db.refresh(category)
        
        return CategoryInDB.model_validate(category, from_attributes=True)
        
    except HTTPException:
        await db.rollback()
        raise
    except Exception as e:
        await db.rollback()
        logger.error(f"Error creating category: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                'error': {
                    'code': 'CATEGORY_CREATION_ERROR',
                    'message': 'Failed to create category',
                    'details': [{'error': str(e)}]
                }
            }
        )


@router.put("/{category_id}", response_model=CategoryInDB)
async def update_category(
    category_id: UUID,
    category_update: CategoryUpdate,
    db: AsyncSession = Depends(get_db),
    admin_user: AuthUser = Depends(category_update_permission_validator)
):
    """
    Update a category (admin only).
    
    - Validates category data consistency
    - Validates permission requirements
    - Validates hierarchy constraints
    - Only provided fields will be updated
    - Cannot set a category as its own parent
    """
    category = await get_category_or_404(category_id, db)
    
    try:
        update_data = category_update.model_dump(exclude_unset=True)
        
        # Validate updated data
        if update_data:
            validation_result = await validate_category_data(update_data, db)
            if not validation_result['is_valid']:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail={
                        'error': {
                            'code': 'CATEGORY_VALIDATION_ERROR',
                            'message': 'Category data validation failed',
                            'details': validation_result['errors']
                        }
                    }
                )
        
        # Validate parent_id if provided
        if "parent_id" in update_data and update_data["parent_id"]:
            # Validate hierarchy
            hierarchy_validation = await validate_category_hierarchy(
                category_id, update_data["parent_id"], db
            )
            if not hierarchy_validation['is_valid']:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail={
                        'error': {
                            'code': 'CATEGORY_HIERARCHY_ERROR',
                            'message': 'Category hierarchy validation failed',
                            'details': hierarchy_validation['errors']
                        }
                    }
                )
            
            # Check parent exists
            parent = await get_category_or_404(update_data["parent_id"], db)
        
        # Check slug uniqueness if changed
        if "slug" in update_data and update_data["slug"] != category.slug:
            stmt = select(Category).where(
                and_(
                    Category.slug == update_data["slug"],
                    Category.id != category_id
                )
            )
            result = await db.execute(stmt)
            if result.scalar_one_or_none():
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail={
                        'error': {
                            'code': 'CATEGORY_SLUG_EXISTS',
                            'message': f'Category with slug \"{update_data["slug"]}\" already exists'
                        }
                    }
                )
        
        # Update category
        for field, value in update_data.items():
            setattr(category, field, value)
        
        await db.commit()
        await db.refresh(category)
        
        return CategoryInDB.model_validate(category, from_attributes=True)
        
    except HTTPException:
        await db.rollback()
        raise
    except Exception as e:
        await db.rollback()
        logger.error(f"Error updating category: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                'error': {
                    'code': 'CATEGORY_UPDATE_ERROR',
                    'message': 'Failed to update category',
                    'details': [{'error': str(e)}]
                }
            }
        )


@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_category(
    category_id: UUID,
    cascade: bool = Query(False, description="Delete child categories"),
    db: AsyncSession = Depends(get_db),
    admin_user: AuthUser = Depends(category_delete_permission_validator)
):
    """
    Delete a category (admin only).
    
    - Validates permission requirements
    - Validates deletion constraints
    - If cascade is true, deletes all child categories
    - If cascade is false and category has children, returns error
    - Recipes are not deleted, only their category association is removed
    """
    category = await get_category_or_404(category_id, db)
    
    try:
        # Check for child categories
        stmt = select(Category).where(Category.parent_id == category_id)
        result = await db.execute(stmt)
        children = list(result.scalars())
        
        if children and not cascade:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    'error': {
                        'code': 'CATEGORY_HAS_CHILDREN',
                        'message': f'Category has {len(children)} child categories. Use cascade=true to delete them.',
                        'details': [{'child_count': len(children)}]
                    }
                }
            )
        
        # Check for recipe associations
        from jidelnicek.recipe.models.categorization import RecipeCategory
        recipe_stmt = select(func.count(RecipeCategory.id)).where(
            RecipeCategory.category_id == category_id
        )
        recipe_result = await db.execute(recipe_stmt)
        recipe_count = recipe_result.scalar()
        
        if recipe_count > 0:
            logger.warning(f"Deleting category {category_id} with {recipe_count} recipe associations")
        
        await db.delete(category)
        await db.commit()
        
    except HTTPException:
        await db.rollback()
        raise
    except Exception as e:
        await db.rollback()
        logger.error(f"Error deleting category: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                'error': {
                    'code': 'CATEGORY_DELETE_ERROR',
                    'message': 'Failed to delete category',
                    'details': [{'error': str(e)}]
                }
            }
        )


@router.get("/{category_id}/breadcrumbs", response_model=List[CategoryInDB])
async def get_category_breadcrumbs(
    category_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[AuthUser] = Depends(get_current_user_optional)
):
    """
    Get category breadcrumb path.
    
    Returns the path from root category to the specified category,
    useful for navigation breadcrumbs.
    """
    category = await get_category_or_404(category_id, db)
    
    breadcrumbs = []
    current = category
    
    while current:
        breadcrumbs.insert(0, CategoryInDB.model_validate(current, from_attributes=True))
        
        if current.parent_id:
            stmt = select(Category).where(Category.id == current.parent_id)
            result = await db.execute(stmt)
            current = result.scalar_one_or_none()
        else:
            current = None
    
    return breadcrumbs