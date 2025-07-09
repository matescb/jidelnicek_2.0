"""
Recipe categorization service for Jidelnicek 2.0 recipe management system.

This module provides business logic for managing recipe categories and tags,
including assignments, suggestions, and primary category management.
"""

from datetime import datetime, timezone
from typing import Optional, List, Set, Dict, Any
from uuid import UUID

from sqlalchemy import select, func, and_, or_, update, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload

from jidelnicek.recipe.models import (
    Recipe, Category, Tag, RecipeCategory, RecipeTag,
    RecipeIngredient
)
from jidelnicek.recipe.models.ingredient import Ingredient
from jidelnicek.recipe.services.category_service import CategoryService
from jidelnicek.recipe.services.tag_service import TagService
from jidelnicek.recipe.exceptions import (
    RecipeNotFoundError, RecipeValidationError
)
from jidelnicek.core.exceptions import NotFoundError, ConflictError, ValidationError


class RecipeCategorizationService:
    """Service class for recipe categorization operations."""
    
    def __init__(self, session: AsyncSession):
        """
        Initialize recipe categorization service.
        
        Args:
            session: AsyncSession instance for database operations
        """
        self.session = session
        self.category_service = CategoryService(session)
        self.tag_service = TagService(session)
    
    async def assign_category(
        self,
        recipe_id: UUID,
        category_id: UUID,
        is_primary: bool = False
    ) -> RecipeCategory:
        """
        Assign a category to a recipe.
        
        Args:
            recipe_id: Recipe ID
            category_id: Category ID
            is_primary: Whether this is the primary category
            
        Returns:
            Created RecipeCategory instance
            
        Raises:
            NotFoundError: If recipe or category not found
            ConflictError: If assignment already exists
            ValidationError: If validation fails
        """
        # Validate recipe exists
        recipe = await self._get_recipe(recipe_id)
        if not recipe:
            raise RecipeNotFoundError(f"Recipe {recipe_id} not found")
        
        # Validate category exists
        category = await self.category_service.get_category(category_id)
        if not category:
            raise NotFoundError(f"Category {category_id} not found")
        
        # Check if assignment already exists
        existing = await self.session.execute(
            select(RecipeCategory).where(
                and_(
                    RecipeCategory.recipe_id == recipe_id,
                    RecipeCategory.category_id == category_id
                )
            )
        )
        if existing.scalar_one_or_none():
            raise ConflictError(f"Recipe already assigned to category {category.name}")
        
        # If setting as primary, unset other primary categories
        if is_primary:
            await self._unset_primary_categories(recipe_id)
        
        # Create assignment
        recipe_category = RecipeCategory(
            recipe_id=recipe_id,
            category_id=category_id,
            is_primary=is_primary
        )
        
        try:
            self.session.add(recipe_category)
            await self.session.commit()
            await self.session.refresh(recipe_category)
            return recipe_category
        except IntegrityError as e:
            await self.session.rollback()
            raise ValidationError(f"Failed to assign category: {str(e)}")
    
    async def remove_category(
        self,
        recipe_id: UUID,
        category_id: UUID
    ) -> bool:
        """
        Remove a category from a recipe.
        
        Args:
            recipe_id: Recipe ID
            category_id: Category ID
            
        Returns:
            True if removed successfully
            
        Raises:
            NotFoundError: If assignment not found
        """
        result = await self.session.execute(
            delete(RecipeCategory).where(
                and_(
                    RecipeCategory.recipe_id == recipe_id,
                    RecipeCategory.category_id == category_id
                )
            )
        )
        
        if result.rowcount == 0:
            raise NotFoundError("Recipe category assignment not found")
        
        await self.session.commit()
        return True
    
    async def set_primary_category(
        self,
        recipe_id: UUID,
        category_id: UUID
    ) -> RecipeCategory:
        """
        Set the primary category for a recipe.
        
        Args:
            recipe_id: Recipe ID
            category_id: Category ID to set as primary
            
        Returns:
            Updated RecipeCategory instance
            
        Raises:
            NotFoundError: If assignment not found
        """
        # Check if assignment exists
        result = await self.session.execute(
            select(RecipeCategory).where(
                and_(
                    RecipeCategory.recipe_id == recipe_id,
                    RecipeCategory.category_id == category_id
                )
            )
        )
        recipe_category = result.scalar_one_or_none()
        
        if not recipe_category:
            # Create new assignment as primary
            return await self.assign_category(recipe_id, category_id, is_primary=True)
        
        # Unset other primary categories
        await self._unset_primary_categories(recipe_id)
        
        # Set this as primary
        recipe_category.is_primary = True
        await self.session.commit()
        await self.session.refresh(recipe_category)
        
        return recipe_category
    
    async def get_recipe_categories(
        self,
        recipe_id: UUID
    ) -> List[Category]:
        """
        Get all categories for a recipe.
        
        Args:
            recipe_id: Recipe ID
            
        Returns:
            List of categories
        """
        query = (
            select(Category)
            .join(RecipeCategory)
            .where(RecipeCategory.recipe_id == recipe_id)
            .order_by(
                RecipeCategory.is_primary.desc(),
                Category.display_order,
                Category.name
            )
        )
        
        result = await self.session.execute(query)
        return result.scalars().all()
    
    async def get_primary_category(
        self,
        recipe_id: UUID
    ) -> Optional[Category]:
        """
        Get the primary category for a recipe.
        
        Args:
            recipe_id: Recipe ID
            
        Returns:
            Primary category if exists, None otherwise
        """
        query = (
            select(Category)
            .join(RecipeCategory)
            .where(
                and_(
                    RecipeCategory.recipe_id == recipe_id,
                    RecipeCategory.is_primary == True
                )
            )
        )
        
        result = await self.session.execute(query)
        return result.scalar_one_or_none()
    
    async def assign_tag(
        self,
        recipe_id: UUID,
        tag_id: UUID
    ) -> RecipeTag:
        """
        Assign a tag to a recipe.
        
        Args:
            recipe_id: Recipe ID
            tag_id: Tag ID
            
        Returns:
            Created RecipeTag instance
            
        Raises:
            NotFoundError: If recipe or tag not found
            ConflictError: If assignment already exists
            ValidationError: If validation fails
        """
        # Validate recipe exists
        recipe = await self._get_recipe(recipe_id)
        if not recipe:
            raise RecipeNotFoundError(f"Recipe {recipe_id} not found")
        
        # Validate tag exists
        tag = await self.tag_service.get_tag(tag_id)
        if not tag:
            raise NotFoundError(f"Tag {tag_id} not found")
        
        # Check if assignment already exists
        existing = await self.session.execute(
            select(RecipeTag).where(
                and_(
                    RecipeTag.recipe_id == recipe_id,
                    RecipeTag.tag_id == tag_id
                )
            )
        )
        if existing.scalar_one_or_none():
            raise ConflictError(f"Recipe already has tag {tag.name}")
        
        # Create assignment
        recipe_tag = RecipeTag(
            recipe_id=recipe_id,
            tag_id=tag_id
        )
        
        try:
            self.session.add(recipe_tag)
            # Increment tag usage count
            await self.tag_service.increment_usage_count(tag_id)
            await self.session.commit()
            await self.session.refresh(recipe_tag)
            return recipe_tag
        except IntegrityError as e:
            await self.session.rollback()
            raise ValidationError(f"Failed to assign tag: {str(e)}")
    
    async def remove_tag(
        self,
        recipe_id: UUID,
        tag_id: UUID
    ) -> bool:
        """
        Remove a tag from a recipe.
        
        Args:
            recipe_id: Recipe ID
            tag_id: Tag ID
            
        Returns:
            True if removed successfully
            
        Raises:
            NotFoundError: If assignment not found
        """
        result = await self.session.execute(
            delete(RecipeTag).where(
                and_(
                    RecipeTag.recipe_id == recipe_id,
                    RecipeTag.tag_id == tag_id
                )
            )
        )
        
        if result.rowcount == 0:
            raise NotFoundError("Recipe tag assignment not found")
        
        # Decrement tag usage count
        await self.tag_service.decrement_usage_count(tag_id)
        await self.session.commit()
        return True
    
    async def assign_tags_by_slug(
        self,
        recipe_id: UUID,
        tag_slugs: List[str]
    ) -> List[RecipeTag]:
        """
        Assign multiple tags to a recipe by slug.
        
        Args:
            recipe_id: Recipe ID
            tag_slugs: List of tag slugs
            
        Returns:
            List of created RecipeTag instances
        """
        assignments = []
        
        for slug in tag_slugs:
            tag = await self.tag_service.get_tag_by_slug(slug)
            if tag:
                try:
                    assignment = await self.assign_tag(recipe_id, tag.id)
                    assignments.append(assignment)
                except ConflictError:
                    # Tag already assigned, skip
                    pass
        
        return assignments
    
    async def get_recipe_tags(
        self,
        recipe_id: UUID
    ) -> List[Tag]:
        """
        Get all tags for a recipe.
        
        Args:
            recipe_id: Recipe ID
            
        Returns:
            List of tags
        """
        query = (
            select(Tag)
            .join(RecipeTag)
            .where(RecipeTag.recipe_id == recipe_id)
            .order_by(Tag.usage_count.desc(), Tag.name)
        )
        
        result = await self.session.execute(query)
        return result.scalars().all()
    
    async def suggest_categories(
        self,
        recipe_id: UUID,
        max_suggestions: int = 5
    ) -> List[Category]:
        """
        Suggest categories for a recipe based on content.
        
        Args:
            recipe_id: Recipe ID
            max_suggestions: Maximum number of suggestions
            
        Returns:
            List of suggested categories
        """
        # Get recipe with current categories
        recipe = await self._get_recipe_with_details(recipe_id)
        if not recipe:
            raise RecipeNotFoundError(f"Recipe {recipe_id} not found")
        
        current_category_ids = {rc.category_id for rc in recipe.recipe_categories}
        
        suggestions = []
        
        # Get categories from similar recipes (by ingredients)
        if recipe.recipe_ingredients:
            ingredient_ids = [ri.ingredient_id for ri in recipe.recipe_ingredients]
            
            # Find recipes with similar ingredients
            similar_recipes_query = (
                select(RecipeCategory.category_id, func.count().label('count'))
                .join(Recipe)
                .join(RecipeIngredient, Recipe.id == RecipeIngredient.recipe_id)
                .where(
                    and_(
                        RecipeIngredient.ingredient_id.in_(ingredient_ids),
                        Recipe.id != recipe_id,
                        Recipe.is_published == True
                    )
                )
                .group_by(RecipeCategory.category_id)
                .order_by(func.count().desc())
                .limit(max_suggestions * 2)  # Get more to filter out current
            )
            
            result = await self.session.execute(similar_recipes_query)
            
            for row in result:
                if row.category_id not in current_category_ids:
                    category = await self.category_service.get_category(row.category_id)
                    if category:
                        suggestions.append(category)
                        if len(suggestions) >= max_suggestions:
                            break
        
        return suggestions
    
    async def suggest_tags_based_on_ingredients(
        self,
        recipe_id: UUID,
        max_suggestions: int = 10
    ) -> List[Tag]:
        """
        Get suggested tags based on recipe ingredients.
        
        Args:
            recipe_id: Recipe ID
            max_suggestions: Maximum number of suggestions
            
        Returns:
            List of suggested tags
        """
        return await self.tag_service.suggest_tags_for_recipe(
            recipe_id,
            max_suggestions
        )
    
    async def update_recipe_categories(
        self,
        recipe_id: UUID,
        category_ids: List[UUID],
        primary_category_id: Optional[UUID] = None
    ) -> List[RecipeCategory]:
        """
        Update all categories for a recipe (replace existing).
        
        Args:
            recipe_id: Recipe ID
            category_ids: List of category IDs to assign
            primary_category_id: Optional primary category ID
            
        Returns:
            List of RecipeCategory assignments
        """
        # Validate recipe
        recipe = await self._get_recipe(recipe_id)
        if not recipe:
            raise RecipeNotFoundError(f"Recipe {recipe_id} not found")
        
        # Remove all existing categories
        await self.session.execute(
            delete(RecipeCategory).where(RecipeCategory.recipe_id == recipe_id)
        )
        
        # Add new categories
        assignments = []
        for category_id in category_ids:
            is_primary = category_id == primary_category_id
            try:
                assignment = await self.assign_category(
                    recipe_id,
                    category_id,
                    is_primary
                )
                assignments.append(assignment)
            except (NotFoundError, ConflictError):
                # Skip invalid categories
                pass
        
        return assignments
    
    async def update_recipe_tags(
        self,
        recipe_id: UUID,
        tag_ids: List[UUID]
    ) -> List[RecipeTag]:
        """
        Update all tags for a recipe (replace existing).
        
        Args:
            recipe_id: Recipe ID
            tag_ids: List of tag IDs to assign
            
        Returns:
            List of RecipeTag assignments
        """
        # Validate recipe
        recipe = await self._get_recipe(recipe_id)
        if not recipe:
            raise RecipeNotFoundError(f"Recipe {recipe_id} not found")
        
        # Get current tags to decrement counts
        current_tags = await self.get_recipe_tags(recipe_id)
        current_tag_ids = {tag.id for tag in current_tags}
        
        # Remove all existing tags
        await self.session.execute(
            delete(RecipeTag).where(RecipeTag.recipe_id == recipe_id)
        )
        
        # Decrement counts for removed tags
        for tag_id in current_tag_ids:
            await self.tag_service.decrement_usage_count(tag_id)
        
        # Add new tags
        assignments = []
        for tag_id in tag_ids:
            try:
                assignment = await self.assign_tag(recipe_id, tag_id)
                assignments.append(assignment)
            except (NotFoundError, ConflictError):
                # Skip invalid tags
                pass
        
        return assignments
    
    async def copy_categorization(
        self,
        source_recipe_id: UUID,
        target_recipe_id: UUID,
        include_categories: bool = True,
        include_tags: bool = True
    ) -> Dict[str, Any]:
        """
        Copy categorization from one recipe to another.
        
        Args:
            source_recipe_id: Source recipe ID
            target_recipe_id: Target recipe ID
            include_categories: Whether to copy categories
            include_tags: Whether to copy tags
            
        Returns:
            Dictionary with copied categories and tags
        """
        result = {
            "categories": [],
            "tags": []
        }
        
        if include_categories:
            # Get source categories
            source_categories = await self.session.execute(
                select(RecipeCategory).where(
                    RecipeCategory.recipe_id == source_recipe_id
                )
            )
            
            for rc in source_categories.scalars():
                try:
                    assignment = await self.assign_category(
                        target_recipe_id,
                        rc.category_id,
                        rc.is_primary
                    )
                    result["categories"].append(assignment)
                except (ConflictError, NotFoundError):
                    pass
        
        if include_tags:
            # Get source tags
            source_tags = await self.get_recipe_tags(source_recipe_id)
            
            for tag in source_tags:
                try:
                    assignment = await self.assign_tag(
                        target_recipe_id,
                        tag.id
                    )
                    result["tags"].append(assignment)
                except (ConflictError, NotFoundError):
                    pass
        
        return result
    
    async def _get_recipe(self, recipe_id: UUID) -> Optional[Recipe]:
        """Get recipe by ID."""
        result = await self.session.execute(
            select(Recipe).where(Recipe.id == recipe_id)
        )
        return result.scalar_one_or_none()
    
    async def _get_recipe_with_details(self, recipe_id: UUID) -> Optional[Recipe]:
        """Get recipe with all details loaded."""
        query = (
            select(Recipe)
            .options(
                selectinload(Recipe.recipe_categories),
                selectinload(Recipe.recipe_tags),
                selectinload(Recipe.recipe_ingredients)
                    .selectinload(RecipeIngredient.ingredient)
            )
            .where(Recipe.id == recipe_id)
        )
        
        result = await self.session.execute(query)
        return result.scalar_one_or_none()
    
    async def _unset_primary_categories(self, recipe_id: UUID) -> None:
        """Unset all primary categories for a recipe."""
        await self.session.execute(
            update(RecipeCategory)
            .where(
                and_(
                    RecipeCategory.recipe_id == recipe_id,
                    RecipeCategory.is_primary == True
                )
            )
            .values(is_primary=False)
        )