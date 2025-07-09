"""
Tag management API endpoints.

This module provides endpoints for managing recipe tags:
- List tags with filters (popular, dietary, search)
- Tag autocomplete
- Get popular tags
- Get dietary restriction tags
- Create tags
- Get tag details with recipes
"""

from typing import List, Optional, Dict, Any
from uuid import UUID
import logging

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func, or_, desc
from sqlalchemy.orm import selectinload, joinedload

from jidelnicek.core.dependencies import get_db
from jidelnicek.core.validation.validation import (
    PermissionValidator, SchemaValidator, ValidationDependency,
    require_permission, validate_schema
)
from jidelnicek.auth.dependencies.auth import get_current_user, get_current_user_optional
from jidelnicek.auth.models import AuthUser
from jidelnicek.recipe.models.categorization import Tag, RecipeTag, RecipeCategory
from jidelnicek.recipe.models.recipe import Recipe
from jidelnicek.recipe.schemas.categorization import (
    TagCreate,
    TagInDB,
    TagWithCount,
    TagCloud,
)
# RecipeResponse import removed to avoid circular import

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/tags",
    tags=["tags"],
    responses={404: {"description": "Tag not found"}},
)

# Common dietary restriction keywords
DIETARY_KEYWORDS = [
    'vegan', 'vegetarian', 'gluten-free', 'dairy-free', 
    'nut-free', 'kosher', 'halal', 'paleo', 'keto', 
    'low-carb', 'sugar-free', 'egg-free', 'soy-free',
    'pescatarian', 'low-sodium', 'high-protein', 'whole30'
]

# Tag validation dependencies
tag_create_permission_validator = PermissionValidator('recipes:create')


async def get_tag_or_404(
    tag_slug: str,
    db: AsyncSession = Depends(get_db)
) -> Tag:
    """Get tag by slug or raise 404."""
    stmt = select(Tag).where(Tag.slug == tag_slug)
    result = await db.execute(stmt)
    tag = result.scalar_one_or_none()
    
    if not tag:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                'error': {
                    'code': 'TAG_NOT_FOUND',
                    'message': f'Tag with slug \"{tag_slug}\" not found'
                }
            }
        )
    
    return tag


async def validate_tag_data(tag_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Validate tag data consistency.
    
    Args:
        tag_data: Dictionary of tag data
        
    Returns:
        Dictionary with validation results and any errors
    """
    errors = []
    
    # Validate required fields
    if not tag_data.get('name', '').strip():
        errors.append({
            'field': 'name',
            'message': 'Tag name cannot be empty'
        })
    
    # Validate name length
    name = tag_data.get('name', '').strip()
    if len(name) > 50:
        errors.append({
            'field': 'name',
            'message': 'Tag name cannot exceed 50 characters'
        })
    
    # Validate name format (no special characters except spaces and hyphens)
    if name and not all(c.isalnum() or c in ' -' for c in name):
        errors.append({
            'field': 'name',
            'message': 'Tag name can only contain letters, numbers, spaces, and hyphens'
        })
    
    # Validate slug format if provided
    slug = tag_data.get('slug', '')
    if slug and not slug.replace('-', '').replace('_', '').isalnum():
        errors.append({
            'field': 'slug',
            'message': 'Tag slug can only contain letters, numbers, hyphens, and underscores'
        })
    
    return {
        'is_valid': len(errors) == 0,
        'errors': errors
    }


async def calculate_tag_trend(tag: Tag, db: AsyncSession) -> str:
    """Calculate usage trend for a tag based on recent activity."""
    # This is a simplified implementation
    # In production, you'd want to track historical data
    
    # Get usage count from 30 days ago (simplified - just checking if growing)
    recent_recipes_stmt = (
        select(func.count(RecipeTag.recipe_id))
        .where(
            and_(
                RecipeTag.tag_id == tag.id,
                RecipeTag.tagged_at >= func.now() - func.interval('30 days')
            )
        )
    )
    result = await db.execute(recent_recipes_stmt)
    recent_count = result.scalar() or 0
    
    # Simple trend calculation
    if tag.usage_count == 0:
        return "stable"
    
    recent_percentage = (recent_count / tag.usage_count) * 100
    
    if recent_percentage > 60:  # More than 60% of uses are recent
        return "rising"
    elif recent_percentage < 20:  # Less than 20% of uses are recent
        return "falling"
    else:
        return "stable"


@router.get("", response_model=List[TagWithCount])
async def list_tags(
    search: Optional[str] = Query(None, description="Search tags by name"),
    dietary_only: bool = Query(False, description="Only show dietary restriction tags"),
    popular_only: bool = Query(False, description="Only show popular tags (usage > 10)"),
    min_usage: int = Query(0, ge=0, description="Minimum usage count"),
    limit: int = Query(50, ge=1, le=200, description="Maximum tags to return"),
    offset: int = Query(0, ge=0, description="Offset for pagination"),
    db: AsyncSession = Depends(get_db),
    current_user: Optional[AuthUser] = Depends(get_current_user_optional)
):
    """
    List tags with optional filters.
    
    Query parameters:
    - search: Search tags by name (partial match)
    - dietary_only: Only return dietary restriction tags
    - popular_only: Only return tags with usage_count > 10
    - min_usage: Minimum usage count filter
    - limit: Maximum number of tags to return
    - offset: Pagination offset
    
    Tags are sorted by usage_count descending.
    """
    # Build base query
    stmt = select(Tag)
    
    # Apply filters
    conditions = []
    
    if search:
        conditions.append(Tag.name.ilike(f"%{search}%"))
    
    if dietary_only:
        dietary_conditions = []
        for keyword in DIETARY_KEYWORDS:
            dietary_conditions.append(Tag.slug.contains(keyword))
        conditions.append(or_(*dietary_conditions))
    
    if popular_only:
        conditions.append(Tag.usage_count > 10)
    
    if min_usage > 0:
        conditions.append(Tag.usage_count >= min_usage)
    
    if conditions:
        stmt = stmt.where(and_(*conditions))
    
    # Add ordering and pagination
    stmt = stmt.order_by(desc(Tag.usage_count), Tag.name)
    stmt = stmt.offset(offset).limit(limit)
    
    # Execute query
    result = await db.execute(stmt)
    tags = list(result.scalars().unique())
    
    # Convert to response with trends
    tag_responses = []
    for tag in tags:
        trend = await calculate_tag_trend(tag, db)
        
        # Get recent usage count
        recent_stmt = (
            select(func.count(RecipeTag.recipe_id))
            .where(
                and_(
                    RecipeTag.tag_id == tag.id,
                    RecipeTag.tagged_at >= func.now() - func.interval('30 days')
                )
            )
        )
        recent_result = await db.execute(recent_stmt)
        recent_count = recent_result.scalar() or 0
        
        tag_responses.append(TagWithCount(
            id=tag.id,
            name=tag.name,
            slug=tag.slug,
            usage_count=tag.usage_count,
            created_at=tag.created_at,
            updated_at=tag.updated_at,
            recent_usage_count=recent_count,
            trend=trend
        ))
    
    return tag_responses


@router.get("/autocomplete", response_model=List[str])
async def autocomplete_tags(
    q: str = Query(..., min_length=2, description="Query string (min 2 chars)"),
    limit: int = Query(10, ge=1, le=20, description="Maximum suggestions"),
    db: AsyncSession = Depends(get_db),
    current_user: Optional[AuthUser] = Depends(get_current_user_optional)
):
    """
    Get tag autocomplete suggestions.
    
    Returns tag names that match the query string,
    sorted by relevance (exact matches first, then by usage count).
    """
    # Normalize query
    query_lower = q.lower().strip()
    
    # Search for matching tags
    stmt = (
        select(Tag.name)
        .where(Tag.name.ilike(f"%{query_lower}%"))
        .order_by(
            # Exact matches first
            func.case(
                (Tag.name == query_lower, 0),
                else_=1
            ),
            # Then by usage count
            desc(Tag.usage_count)
        )
        .limit(limit)
    )
    
    result = await db.execute(stmt)
    suggestions = [name for (name,) in result]
    
    return suggestions


@router.get("/popular", response_model=TagCloud)
async def get_popular_tags(
    limit: int = Query(30, ge=1, le=100, description="Number of tags to return"),
    days: int = Query(30, ge=1, le=365, description="Time period in days"),
    db: AsyncSession = Depends(get_db),
    current_user: Optional[AuthUser] = Depends(get_current_user_optional)
):
    """
    Get popular tags for tag cloud display.
    
    Returns the most used tags with their usage counts and trends.
    The response includes min/max counts for UI scaling.
    """
    # Get top tags by usage
    stmt = (
        select(Tag)
        .where(Tag.usage_count > 0)
        .order_by(desc(Tag.usage_count))
        .limit(limit)
    )
    
    result = await db.execute(stmt)
    tags = list(result.scalars().unique())
    
    if not tags:
        return TagCloud(
            tags=[],
            min_count=0,
            max_count=0,
            total_tags=0
        )
    
    # Calculate trends and recent counts
    tag_responses = []
    for tag in tags:
        trend = await calculate_tag_trend(tag, db)
        
        # Get recent usage count
        recent_stmt = (
            select(func.count(RecipeTag.recipe_id))
            .where(
                and_(
                    RecipeTag.tag_id == tag.id,
                    RecipeTag.tagged_at >= func.now() - func.interval(f'{days} days')
                )
            )
        )
        recent_result = await db.execute(recent_stmt)
        recent_count = recent_result.scalar() or 0
        
        tag_responses.append(TagWithCount(
            id=tag.id,
            name=tag.name,
            slug=tag.slug,
            usage_count=tag.usage_count,
            created_at=tag.created_at,
            updated_at=tag.updated_at,
            recent_usage_count=recent_count,
            trend=trend
        ))
    
    # Get total tag count
    count_stmt = select(func.count(Tag.id))
    count_result = await db.execute(count_stmt)
    total_tags = count_result.scalar() or 0
    
    # Calculate min/max for scaling
    usage_counts = [tag.usage_count for tag in tags]
    min_count = min(usage_counts) if usage_counts else 0
    max_count = max(usage_counts) if usage_counts else 0
    
    return TagCloud(
        tags=tag_responses,
        min_count=min_count,
        max_count=max_count,
        total_tags=total_tags
    )


@router.get("/dietary", response_model=List[TagInDB])
async def get_dietary_tags(
    db: AsyncSession = Depends(get_db),
    current_user: Optional[AuthUser] = Depends(get_current_user_optional)
):
    """
    Get all dietary restriction tags.
    
    Returns tags that match common dietary restriction patterns,
    sorted alphabetically.
    """
    # Build query for dietary tags
    dietary_conditions = []
    for keyword in DIETARY_KEYWORDS:
        dietary_conditions.append(Tag.slug.contains(keyword))
    
    stmt = (
        select(Tag)
        .where(or_(*dietary_conditions))
        .order_by(Tag.name)
    )
    
    result = await db.execute(stmt)
    tags = list(result.scalars().unique())
    
    return [
        TagInDB.model_validate(tag, from_attributes=True)
        for tag in tags
    ]


@router.post("", response_model=TagInDB, status_code=status.HTTP_201_CREATED)
async def create_tag(
    tag_data: TagCreate,
    db: AsyncSession = Depends(get_db),
    current_user: AuthUser = Depends(tag_create_permission_validator)
):
    """
    Create a new tag.
    
    - Validates tag data consistency
    - Validates user permissions
    - The slug will be auto-generated from the name if not provided
    - Tag names are normalized to lowercase for consistency
    """
    try:
        # Validate tag data
        validation_result = await validate_tag_data(tag_data.model_dump())
        if not validation_result['is_valid']:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={
                    'error': {
                        'code': 'TAG_VALIDATION_ERROR',
                        'message': 'Tag data validation failed',
                        'details': validation_result['errors']
                    }
                }
            )
        
        # Check if tag already exists (by slug)
        stmt = select(Tag).where(Tag.slug == tag_data.slug)
        result = await db.execute(stmt)
        existing_tag = result.scalar_one_or_none()
        
        if existing_tag:
            # Return existing tag instead of error
            return TagInDB.model_validate(existing_tag, from_attributes=True)
        
        # Create new tag
        tag = Tag(
            name=tag_data.name,
            slug=tag_data.slug,
            usage_count=0
        )
        db.add(tag)
        
        await db.commit()
        await db.refresh(tag)
        
        return TagInDB.model_validate(tag, from_attributes=True)
        
    except HTTPException:
        await db.rollback()
        raise
    except Exception as e:
        await db.rollback()
        logger.error(f"Error creating tag: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                'error': {
                    'code': 'TAG_CREATION_ERROR',
                    'message': 'Failed to create tag',
                    'details': [{'error': str(e)}]
                }
            }
        )


@router.get("/{tag_slug}", response_model=dict)
async def get_tag_details(
    tag_slug: str,
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    db: AsyncSession = Depends(get_db),
    current_user: Optional[AuthUser] = Depends(get_current_user_optional)
):
    """
    Get tag details with recipes.
    
    Returns tag information along with paginated list of recipes
    that have this tag.
    """
    # Get tag
    tag = await get_tag_or_404(tag_slug, db)
    
    # Count total recipes with this tag
    count_stmt = (
        select(func.count(RecipeTag.recipe_id))
        .where(RecipeTag.tag_id == tag.id)
    )
    total_result = await db.execute(count_stmt)
    total_recipes = total_result.scalar() or 0
    
    # Get paginated recipes
    offset = (page - 1) * page_size
    recipe_stmt = (
        select(Recipe)
        .join(RecipeTag)
        .where(RecipeTag.tag_id == tag.id)
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
    
    # Calculate trend
    trend = await calculate_tag_trend(tag, db)
    
    # Get recent usage count
    recent_stmt = (
        select(func.count(RecipeTag.recipe_id))
        .where(
            and_(
                RecipeTag.tag_id == tag.id,
                RecipeTag.tagged_at >= func.now() - func.interval('30 days')
            )
        )
    )
    recent_result = await db.execute(recent_stmt)
    recent_count = recent_result.scalar() or 0
    
    # Check if dietary
    is_dietary = any(keyword in tag.slug for keyword in DIETARY_KEYWORDS)
    
    return {
        "tag": TagWithCount(
            id=tag.id,
            name=tag.name,
            slug=tag.slug,
            usage_count=tag.usage_count,
            created_at=tag.created_at,
            updated_at=tag.updated_at,
            recent_usage_count=recent_count,
            trend=trend
        ),
        "is_dietary": is_dietary,
        "recipes": recipe_responses,
        "total_recipes": total_recipes,
        "page": page,
        "page_size": page_size,
        "total_pages": (total_recipes + page_size - 1) // page_size
    }