"""
Tag service for Jidelnicek 2.0 recipe management system.

This module provides business logic for tag management including
CRUD operations, autocomplete, trending tags, and dietary restrictions.
"""

from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any, Set, Tuple
from uuid import UUID

from sqlalchemy import select, func, and_, or_, update, delete, case, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload

from jidelnicek.recipe.models import Tag, RecipeTag, Recipe, RecipeIngredient
from jidelnicek.recipe.models.ingredient import Ingredient
from jidelnicek.recipe.exceptions import RecipeValidationError
from jidelnicek.core.exceptions import NotFoundError, ConflictError, ValidationError


class TagService:
    """Service class for tag management operations."""
    
    # Common dietary restriction tags
    DIETARY_TAGS = {
        'vegan': 'Vegan - No animal products',
        'vegetarian': 'Vegetarian - No meat or fish',
        'gluten-free': 'Gluten-Free - No gluten containing ingredients',
        'dairy-free': 'Dairy-Free - No milk products',
        'nut-free': 'Nut-Free - No tree nuts or peanuts',
        'egg-free': 'Egg-Free - No eggs',
        'soy-free': 'Soy-Free - No soy products',
        'kosher': 'Kosher - Follows Jewish dietary laws',
        'halal': 'Halal - Follows Islamic dietary laws',
        'paleo': 'Paleo - Paleolithic diet',
        'keto': 'Keto - Low carb, high fat',
        'low-carb': 'Low-Carb - Reduced carbohydrates',
        'sugar-free': 'Sugar-Free - No added sugars',
        'low-sodium': 'Low-Sodium - Reduced salt',
        'pescatarian': 'Pescatarian - Vegetarian plus seafood'
    }
    
    def __init__(self, session: AsyncSession):
        """
        Initialize tag service.
        
        Args:
            session: AsyncSession instance for database operations
        """
        self.session = session
    
    async def create_tag(
        self,
        name: str,
        slug: str
    ) -> Tag:
        """
        Create a new tag.
        
        Args:
            name: Tag name
            slug: URL-friendly identifier
            
        Returns:
            Created tag instance
            
        Raises:
            ConflictError: If slug already exists
            ValidationError: If validation fails
        """
        # Check if slug already exists
        existing = await self.session.execute(
            select(Tag).where(Tag.slug == slug)
        )
        if existing.scalar_one_or_none():
            raise ConflictError(f"Tag with slug '{slug}' already exists")
        
        # Create tag
        tag = Tag(
            name=name,
            slug=slug,
            usage_count=0
        )
        
        try:
            self.session.add(tag)
            await self.session.commit()
            await self.session.refresh(tag)
            return tag
        except IntegrityError as e:
            await self.session.rollback()
            raise ValidationError(f"Failed to create tag: {str(e)}")
    
    async def get_tag(self, tag_id: UUID) -> Optional[Tag]:
        """
        Get a tag by ID.
        
        Args:
            tag_id: Tag ID
            
        Returns:
            Tag instance if found, None otherwise
        """
        result = await self.session.execute(
            select(Tag).where(Tag.id == tag_id)
        )
        return result.scalar_one_or_none()
    
    async def get_tag_by_slug(self, slug: str) -> Optional[Tag]:
        """
        Get a tag by slug.
        
        Args:
            slug: Tag slug
            
        Returns:
            Tag instance if found, None otherwise
        """
        result = await self.session.execute(
            select(Tag).where(Tag.slug == slug)
        )
        return result.scalar_one_or_none()
    
    async def update_tag(
        self,
        tag_id: UUID,
        name: Optional[str] = None,
        slug: Optional[str] = None
    ) -> Tag:
        """
        Update a tag.
        
        Args:
            tag_id: Tag ID to update
            name: Optional new name
            slug: Optional new slug
            
        Returns:
            Updated tag instance
            
        Raises:
            NotFoundError: If tag not found
            ConflictError: If new slug already exists
            ValidationError: If validation fails
        """
        tag = await self.get_tag(tag_id)
        if not tag:
            raise NotFoundError(f"Tag {tag_id} not found")
        
        # Check slug uniqueness if changing
        if slug and slug != tag.slug:
            existing = await self.session.execute(
                select(Tag).where(
                    and_(
                        Tag.slug == slug,
                        Tag.id != tag_id
                    )
                )
            )
            if existing.scalar_one_or_none():
                raise ConflictError(f"Tag with slug '{slug}' already exists")
        
        # Update fields
        if name is not None:
            tag.name = name
        if slug is not None:
            tag.slug = slug
        
        try:
            await self.session.commit()
            await self.session.refresh(tag)
            return tag
        except IntegrityError as e:
            await self.session.rollback()
            raise ValidationError(f"Failed to update tag: {str(e)}")
    
    async def delete_tag(self, tag_id: UUID) -> bool:
        """
        Delete a tag.
        
        Args:
            tag_id: Tag ID to delete
            
        Returns:
            True if deleted successfully
            
        Raises:
            NotFoundError: If tag not found
        """
        tag = await self.get_tag(tag_id)
        if not tag:
            raise NotFoundError(f"Tag {tag_id} not found")
        
        await self.session.delete(tag)
        await self.session.commit()
        return True
    
    async def autocomplete_tags(
        self,
        prefix: str,
        limit: int = 10,
        only_popular: bool = False
    ) -> List[Tag]:
        """
        Tag autocomplete functionality - search by prefix.
        
        Args:
            prefix: Search prefix
            limit: Maximum number of results
            only_popular: Only return popular tags (usage_count > 10)
            
        Returns:
            List of matching tags ordered by usage count
        """
        query = select(Tag).where(
            or_(
                Tag.name.ilike(f"{prefix}%"),
                Tag.slug.ilike(f"{prefix}%")
            )
        )
        
        if only_popular:
            query = query.where(Tag.usage_count > 10)
        
        query = query.order_by(Tag.usage_count.desc(), Tag.name)
        query = query.limit(limit)
        
        result = await self.session.execute(query)
        return result.scalars().all()
    
    async def get_popular_tags(
        self,
        min_usage: int = 10,
        limit: int = 50
    ) -> List[Tag]:
        """
        Get popular tags based on usage count.
        
        Args:
            min_usage: Minimum usage count (default 10)
            limit: Maximum number of results
            
        Returns:
            List of popular tags ordered by usage count
        """
        query = (
            select(Tag)
            .where(Tag.usage_count >= min_usage)
            .order_by(Tag.usage_count.desc(), Tag.name)
            .limit(limit)
        )
        
        result = await self.session.execute(query)
        return result.scalars().all()
    
    async def get_trending_tags(
        self,
        days: int = 30,
        limit: int = 20
    ) -> List[Dict[str, Any]]:
        """
        Get trending tags - most used in last N days.
        
        Args:
            days: Number of days to look back (default 30)
            limit: Maximum number of results
            
        Returns:
            List of trending tags with usage data
        """
        cutoff_date = datetime.now(timezone.utc) - timedelta(days=days)
        
        # Count recipe tags added in the time period
        trending_query = (
            select(
                Tag.id,
                Tag.name,
                Tag.slug,
                Tag.usage_count,
                func.count(RecipeTag.recipe_id).label('recent_usage')
            )
            .join(RecipeTag, Tag.id == RecipeTag.tag_id)
            .where(RecipeTag.tagged_at >= cutoff_date)
            .group_by(Tag.id)
            .order_by(func.count(RecipeTag.recipe_id).desc())
            .limit(limit)
        )
        
        result = await self.session.execute(trending_query)
        
        return [
            {
                "id": str(row.id),
                "name": row.name,
                "slug": row.slug,
                "total_usage": row.usage_count,
                "recent_usage": row.recent_usage,
                "trend_percentage": (row.recent_usage / max(row.usage_count, 1)) * 100
            }
            for row in result
        ]
    
    async def increment_usage_count(self, tag_id: UUID) -> None:
        """
        Increment tag usage count.
        
        Args:
            tag_id: Tag ID to increment
        """
        await self.session.execute(
            update(Tag)
            .where(Tag.id == tag_id)
            .values(usage_count=Tag.usage_count + 1)
        )
        await self.session.commit()
    
    async def decrement_usage_count(self, tag_id: UUID) -> None:
        """
        Decrement tag usage count (minimum 0).
        
        Args:
            tag_id: Tag ID to decrement
        """
        await self.session.execute(
            update(Tag)
            .where(Tag.id == tag_id)
            .values(usage_count=case(
                (Tag.usage_count > 0, Tag.usage_count - 1),
                else_=0
            ))
        )
        await self.session.commit()
    
    async def get_dietary_restriction_tags(self) -> List[Tag]:
        """
        Get all dietary restriction tags.
        
        Returns:
            List of dietary tags that exist in the database
        """
        slugs = list(self.DIETARY_TAGS.keys())
        
        query = (
            select(Tag)
            .where(Tag.slug.in_(slugs))
            .order_by(Tag.name)
        )
        
        result = await self.session.execute(query)
        return result.scalars().all()
    
    async def ensure_dietary_tags_exist(self) -> Dict[str, Tag]:
        """
        Ensure all standard dietary tags exist in the database.
        
        Returns:
            Dictionary mapping slug to Tag instance
        """
        existing_tags = await self.get_dietary_restriction_tags()
        existing_slugs = {tag.slug for tag in existing_tags}
        
        created_tags = {}
        
        for slug, description in self.DIETARY_TAGS.items():
            if slug not in existing_slugs:
                # Extract name from description
                name = description.split(' - ')[0]
                tag = await self.create_tag(name=name, slug=slug)
                created_tags[slug] = tag
            else:
                # Find existing tag
                for tag in existing_tags:
                    if tag.slug == slug:
                        created_tags[slug] = tag
                        break
        
        return created_tags
    
    async def suggest_tags_for_recipe(
        self,
        recipe_id: UUID,
        max_suggestions: int = 10
    ) -> List[Tag]:
        """
        Suggest tags based on recipe content (ingredients, existing tags).
        
        Args:
            recipe_id: Recipe ID to analyze
            max_suggestions: Maximum number of suggestions
            
        Returns:
            List of suggested tags
        """
        # Get recipe with ingredients
        recipe_query = (
            select(Recipe)
            .options(
                selectinload(Recipe.recipe_ingredients).selectinload(RecipeIngredient.ingredient),
                selectinload(Recipe.recipe_tags).selectinload(RecipeTag.tag)
            )
            .where(Recipe.id == recipe_id)
        )
        
        result = await self.session.execute(recipe_query)
        recipe = result.scalar_one_or_none()
        
        if not recipe:
            raise NotFoundError(f"Recipe {recipe_id} not found")
        
        # Get current tag slugs
        current_tag_slugs = {rt.tag.slug for rt in recipe.recipe_tags}
        
        suggested_tags = []
        suggested_slugs = set()
        
        # Check ingredients for dietary restrictions
        ingredients = [ri.ingredient for ri in recipe.recipe_ingredients]
        
        # Analyze ingredients for dietary tags
        dietary_suggestions = await self._analyze_dietary_tags(ingredients, current_tag_slugs)
        for tag in dietary_suggestions:
            if tag.slug not in suggested_slugs:
                suggested_tags.append(tag)
                suggested_slugs.add(tag.slug)
        
        # Get tags commonly used with current tags
        if current_tag_slugs:
            related_tags = await self._get_related_tags(
                current_tag_slugs,
                exclude_slugs=current_tag_slugs | suggested_slugs,
                limit=max_suggestions - len(suggested_tags)
            )
            
            for tag in related_tags:
                if len(suggested_tags) >= max_suggestions:
                    break
                if tag.slug not in suggested_slugs:
                    suggested_tags.append(tag)
                    suggested_slugs.add(tag.slug)
        
        return suggested_tags[:max_suggestions]
    
    async def _analyze_dietary_tags(
        self,
        ingredients: List[Ingredient],
        exclude_slugs: Set[str]
    ) -> List[Tag]:
        """Analyze ingredients to suggest dietary tags."""
        suggestions = []
        
        # Check for vegan/vegetarian
        has_meat = any(
            ing.is_meat or ing.is_fish or ing.is_poultry
            for ing in ingredients
            if hasattr(ing, 'is_meat')
        )
        has_dairy = any(
            ing.is_dairy for ing in ingredients
            if hasattr(ing, 'is_dairy')
        )
        has_eggs = any(
            'egg' in ing.name.lower() for ing in ingredients
        )
        
        # Get dietary tags
        dietary_tags = await self.get_dietary_restriction_tags()
        tag_map = {tag.slug: tag for tag in dietary_tags}
        
        # Suggest based on ingredients
        if not has_meat and not has_dairy and not has_eggs:
            if 'vegan' not in exclude_slugs and 'vegan' in tag_map:
                suggestions.append(tag_map['vegan'])
        elif not has_meat:
            if 'vegetarian' not in exclude_slugs and 'vegetarian' in tag_map:
                suggestions.append(tag_map['vegetarian'])
        
        # Check for gluten-free
        has_gluten = any(
            ing.is_gluten_containing for ing in ingredients
            if hasattr(ing, 'is_gluten_containing')
        )
        if not has_gluten and 'gluten-free' not in exclude_slugs and 'gluten-free' in tag_map:
            suggestions.append(tag_map['gluten-free'])
        
        # Check for dairy-free
        if not has_dairy and 'dairy-free' not in exclude_slugs and 'dairy-free' in tag_map:
            suggestions.append(tag_map['dairy-free'])
        
        return suggestions
    
    async def _get_related_tags(
        self,
        tag_slugs: Set[str],
        exclude_slugs: Set[str],
        limit: int = 5
    ) -> List[Tag]:
        """Get tags commonly used together with given tags."""
        # Find recipes that have any of the given tags
        recipe_ids_query = (
            select(RecipeTag.recipe_id)
            .join(Tag)
            .where(Tag.slug.in_(tag_slugs))
            .distinct()
        )
        
        recipe_ids_result = await self.session.execute(recipe_ids_query)
        recipe_ids = [row[0] for row in recipe_ids_result]
        
        if not recipe_ids:
            return []
        
        # Find other tags used by these recipes
        related_tags_query = (
            select(
                Tag,
                func.count(RecipeTag.recipe_id).label('co_occurrence')
            )
            .join(RecipeTag)
            .where(
                and_(
                    RecipeTag.recipe_id.in_(recipe_ids),
                    ~Tag.slug.in_(tag_slugs | exclude_slugs)
                )
            )
            .group_by(Tag.id)
            .order_by(func.count(RecipeTag.recipe_id).desc())
            .limit(limit)
        )
        
        result = await self.session.execute(related_tags_query)
        return [row[0] for row in result]
    
    async def list_tags(
        self,
        search: Optional[str] = None,
        dietary_only: bool = False,
        popular_only: bool = False,
        limit: int = 100,
        offset: int = 0
    ) -> Tuple[List[Tag], int]:
        """
        List tags with optional filtering.
        
        Args:
            search: Search term for name/slug
            dietary_only: Only return dietary tags
            popular_only: Only return popular tags
            limit: Maximum number of results
            offset: Number of results to skip
            
        Returns:
            Tuple of (tags, total_count)
        """
        query = select(Tag)
        count_query = select(func.count(Tag.id))
        
        conditions = []
        
        if search:
            conditions.append(
                or_(
                    Tag.name.ilike(f"%{search}%"),
                    Tag.slug.ilike(f"%{search}%")
                )
            )
        
        if dietary_only:
            conditions.append(Tag.slug.in_(list(self.DIETARY_TAGS.keys())))
        
        if popular_only:
            conditions.append(Tag.usage_count > 10)
        
        if conditions:
            query = query.where(and_(*conditions))
            count_query = count_query.where(and_(*conditions))
        
        # Get count
        total_result = await self.session.execute(count_query)
        total_count = total_result.scalar() or 0
        
        # Get tags
        query = query.order_by(Tag.usage_count.desc(), Tag.name)
        query = query.limit(limit).offset(offset)
        
        result = await self.session.execute(query)
        tags = result.scalars().all()
        
        return tags, total_count