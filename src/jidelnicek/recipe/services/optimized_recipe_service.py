"""
Optimized Recipe service with advanced query patterns and performance optimizations.

This service extends the base RecipeService with additional optimizations for
common query patterns, eager loading strategies, and performance monitoring.
"""

from datetime import datetime, timezone
from typing import Optional, List, Dict, Any, Tuple
from uuid import UUID
from decimal import Decimal

from sqlalchemy import select, func, and_, or_, update, delete, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError, NoResultFound
from sqlalchemy.orm import selectinload, joinedload, contains_eager

from jidelnicek.core.services.base import SearchableService, CacheableService
from jidelnicek.core.query_helpers import (
    profile_query, QueryOptimizer, PaginationHelper, 
    query_profiler, RelationshipLoader
)
from jidelnicek.recipe.models import Recipe, RecipeVersion, RecipeImage
from jidelnicek.recipe.models.recipe_ingredient import RecipeIngredient
from jidelnicek.common.models.ingredient import Ingredient
from jidelnicek.recipe.models.categorization import RecipeCategory, RecipeTag
from jidelnicek.recipe.schemas import (
    RecipeCreate, RecipeUpdate, RecipeSearch,
    RecipeIngredientCreate, RecipeResponse, RecipeDetail,
    RecipeVersionCreate, RecipeVersionResponse, RecipeVersionHistory,
    RecipeDuplicateRequest, RecipeDuplicateResponse
)
from jidelnicek.recipe.exceptions import (
    RecipeNotFoundError, RecipePermissionError, RecipeUnpublishError,
    RecipeNotPublishedError, RecipeSelfForkError, RecipeAlreadyPublishedError,
    RecipeNotPublishedForUnpublishError, RecipeValidationError,
    IngredientNotFoundError, DuplicateIngredientError
)
from jidelnicek.recipe.utils.nutrition_calculator import NutritionCalculator


class OptimizedRecipeService(SearchableService, CacheableService):
    """Optimized service class for recipe management operations."""
    
    @property
    def model(self):
        return Recipe
    
    @property
    def search_fields(self) -> List[str]:
        return ['name', 'description', 'instructions']
    
    def __init__(self, session: AsyncSession):
        super().__init__(session)
        self.nutrition_calculator = NutritionCalculator()
    
    # Optimized query patterns
    
    @profile_query
    async def get_recipe_with_full_details(
        self,
        recipe_id: UUID,
        user_id: Optional[UUID] = None
    ) -> Recipe:
        """
        Get recipe with all relationships loaded in a single optimized query.
        
        Args:
            recipe_id: ID of the recipe to retrieve
            user_id: ID of the requesting user (optional)
            
        Returns:
            Recipe instance with all relationships loaded
            
        Raises:
            RecipeNotFoundError: If recipe not found
            RecipePermissionError: If user lacks permission to view recipe
        """
        # Use optimized query with eager loading
        stmt = (
            select(Recipe)
            .options(
                selectinload(Recipe.ingredients).selectinload(RecipeIngredient.ingredient),
                selectinload(Recipe.images),
                selectinload(Recipe.versions),
                selectinload(Recipe.recipe_categories),
                selectinload(Recipe.recipe_tags),
                selectinload(Recipe.original_recipe),
                selectinload(Recipe.forks)
            )
            .where(
                Recipe.id == recipe_id,
                Recipe.is_archived == False
            )
        )
        
        result = await self.session.execute(stmt)
        recipe = result.scalar_one_or_none()
        
        if not recipe:
            raise RecipeNotFoundError(recipe_id)
        
        # Check permissions
        if not recipe.is_published and recipe.user_id != user_id:
            raise RecipePermissionError(
                f"You don't have permission to view recipe {recipe_id}"
            )
        
        return recipe
    
    @profile_query
    async def get_recipes_with_ingredients_batch(
        self,
        recipe_ids: List[UUID],
        user_id: Optional[UUID] = None
    ) -> List[Recipe]:
        """
        Get multiple recipes with ingredients in a single optimized query.
        
        Args:
            recipe_ids: List of recipe IDs to retrieve
            user_id: ID of the requesting user (optional)
            
        Returns:
            List of Recipe instances with ingredients loaded
        """
        # Build permission filter
        permission_filter = Recipe.is_published == True
        if user_id:
            permission_filter = or_(
                Recipe.is_published == True,
                Recipe.user_id == user_id
            )
        
        # Optimized query with eager loading
        stmt = (
            select(Recipe)
            .options(
                selectinload(Recipe.ingredients).selectinload(RecipeIngredient.ingredient)
            )
            .where(
                Recipe.id.in_(recipe_ids),
                Recipe.is_archived == False,
                permission_filter
            )
        )
        
        result = await self.session.execute(stmt)
        return result.scalars().all()
    
    @profile_query
    async def get_user_recipes_optimized(
        self,
        user_id: UUID,
        page: int = 1,
        page_size: int = 20,
        include_ingredients: bool = False
    ) -> Dict[str, Any]:
        """
        Get user's recipes with optimized pagination and optional ingredient loading.
        
        Args:
            user_id: ID of the user
            page: Page number (1-based)
            page_size: Number of items per page
            include_ingredients: Whether to include ingredients
            
        Returns:
            Dictionary with pagination data and metadata
        """
        # Base query
        query = select(Recipe).where(
            Recipe.user_id == user_id,
            Recipe.is_archived == False
        )
        
        # Add eager loading if requested
        if include_ingredients:
            query = query.options(
                selectinload(Recipe.ingredients).selectinload(RecipeIngredient.ingredient)
            )
        
        # Order by most recent
        query = query.order_by(Recipe.updated_at.desc())
        
        return await self.pagination_helper.paginate(
            self.session, query, page, page_size
        )
    
    @profile_query
    async def search_recipes_optimized(
        self,
        search_params: RecipeSearch,
        page: int = 1,
        page_size: int = 20
    ) -> Dict[str, Any]:
        """
        Advanced recipe search with optimized query patterns.
        
        Args:
            search_params: Search parameters including filters
            page: Page number (1-based)
            page_size: Number of items per page
            
        Returns:
            Dictionary with search results and metadata
        """
        # Build base query
        query = select(Recipe)
        
        # Apply filters efficiently
        conditions = [Recipe.is_archived == False]
        
        # User filter
        if search_params.user_id:
            conditions.append(Recipe.user_id == search_params.user_id)
        
        # Public/private filter
        if search_params.is_public is not None:
            conditions.append(Recipe.is_public == search_params.is_public)
        
        # Published filter
        if search_params.is_published is not None:
            conditions.append(Recipe.is_published == search_params.is_published)
        
        # Text search with full-text search capabilities
        if search_params.query:
            search_term = f"%{search_params.query}%"
            text_conditions = [
                Recipe.name.ilike(search_term),
                Recipe.description.ilike(search_term),
                Recipe.instructions.ilike(search_term)
            ]
            conditions.append(or_(*text_conditions))
        
        # Time filters (use indexed columns efficiently)
        if search_params.max_prep_time:
            conditions.append(Recipe.prep_time_minutes <= search_params.max_prep_time)
        
        if search_params.max_cook_time:
            conditions.append(Recipe.cook_time_minutes <= search_params.max_cook_time)
        
        if search_params.max_total_time:
            conditions.append(
                func.coalesce(Recipe.prep_time_minutes, 0) + 
                func.coalesce(Recipe.cook_time_minutes, 0) <= search_params.max_total_time
            )
        
        # Servings filters
        if search_params.min_servings:
            conditions.append(Recipe.servings >= search_params.min_servings)
        
        if search_params.max_servings:
            conditions.append(Recipe.servings <= search_params.max_servings)
        
        # Ingredient filter with optimized subquery
        if search_params.has_ingredients:
            ingredient_subquery = (
                select(RecipeIngredient.recipe_id)
                .where(RecipeIngredient.ingredient_id.in_(search_params.has_ingredients))
                .group_by(RecipeIngredient.recipe_id)
                .having(func.count(RecipeIngredient.ingredient_id) >= len(search_params.has_ingredients))
            )
            conditions.append(Recipe.id.in_(ingredient_subquery))
        
        # Apply all conditions
        query = query.where(and_(*conditions))
        
        # Add eager loading for common use cases
        query = query.options(
            selectinload(Recipe.ingredients).selectinload(RecipeIngredient.ingredient)
        )
        
        # Order by relevance and recency
        if search_params.query:
            # Simple relevance scoring
            query = query.order_by(
                func.length(Recipe.name).asc(),  # Shorter names first
                Recipe.updated_at.desc()
            )
        else:
            query = query.order_by(Recipe.updated_at.desc())
        
        return await self.pagination_helper.paginate(
            self.session, query, page, page_size
        )
    
    @profile_query
    async def get_popular_recipes(
        self,
        limit: int = 10,
        days: int = 7
    ) -> List[Recipe]:
        """
        Get popular recipes based on views and ratings.
        
        Args:
            limit: Maximum number of recipes to return
            days: Time window in days for popularity calculation
            
        Returns:
            List of popular recipes
        """
        # Calculate popularity score
        popularity_score = (
            func.coalesce(Recipe.view_count, 0) * 0.3 +
            func.coalesce(Recipe.rating_average, 0) * Recipe.rating_count * 0.7
        )
        
        query = (
            select(Recipe)
            .where(
                Recipe.is_published == True,
                Recipe.is_archived == False,
                Recipe.updated_at >= datetime.now(timezone.utc) - timedelta(days=days)
            )
            .order_by(popularity_score.desc())
            .limit(limit)
        )
        
        result = await self.session.execute(query)
        return result.scalars().all()
    
    @profile_query
    async def get_recipe_statistics(self, recipe_id: UUID) -> Dict[str, Any]:
        """
        Get comprehensive statistics for a recipe.
        
        Args:
            recipe_id: ID of the recipe
            
        Returns:
            Dictionary with recipe statistics
        """
        # Get recipe with basic info
        recipe = await self.get_by_id(recipe_id)
        
        # Get related statistics in parallel
        # Fork count
        fork_count_query = select(func.count(Recipe.id)).where(
            Recipe.original_recipe_id == recipe_id
        )
        
        # Version count
        version_count_query = select(func.count(RecipeVersion.id)).where(
            RecipeVersion.recipe_id == recipe_id
        )
        
        # Execute parallel queries
        fork_result = await self.session.execute(fork_count_query)
        version_result = await self.session.execute(version_count_query)
        
        fork_count = fork_result.scalar()
        version_count = version_result.scalar()
        
        return {
            'recipe_id': recipe_id,
            'name': recipe.name,
            'view_count': recipe.view_count,
            'rating_average': float(recipe.rating_average) if recipe.rating_average else None,
            'rating_count': recipe.rating_count,
            'fork_count': fork_count,
            'version_count': version_count,
            'is_published': recipe.is_published,
            'created_at': recipe.created_at,
            'updated_at': recipe.updated_at
        }
    
    # Optimized CRUD operations
    
    @profile_query
    async def create_recipe_optimized(
        self,
        user_id: UUID,
        recipe_data: RecipeCreate
    ) -> Recipe:
        """
        Create a new recipe with optimized ingredient validation.
        
        Args:
            user_id: ID of the user creating the recipe
            recipe_data: Recipe creation data including ingredients
            
        Returns:
            Created recipe instance with relationships loaded
            
        Raises:
            IngredientNotFoundError: If any ingredient ID is invalid
            RecipeValidationError: If recipe data is invalid
            DuplicateIngredientError: If duplicate ingredients are provided
        """
        async with self.session.begin():
            # Validate ingredients in bulk if provided
            if recipe_data.ingredients:
                ingredient_ids = [ing.ingredient_id for ing in recipe_data.ingredients]
                await self._validate_ingredients_exist_batch(ingredient_ids)
            
            # Create recipe instance
            recipe_dict = recipe_data.model_dump(exclude={'ingredients'})
            recipe = Recipe(user_id=user_id, **recipe_dict)
            
            self.session.add(recipe)
            await self.session.flush()  # Get recipe ID
            
            # Add ingredients in batch if provided
            if recipe_data.ingredients:
                recipe_ingredients = []
                for idx, ingredient_data in enumerate(recipe_data.ingredients):
                    recipe_ingredient = RecipeIngredient(
                        recipe_id=recipe.id,
                        ingredient_id=ingredient_data.ingredient_id,
                        quantity=ingredient_data.quantity,
                        unit=ingredient_data.unit,
                        preparation_notes=ingredient_data.preparation_notes,
                        is_optional=ingredient_data.is_optional,
                        display_order=ingredient_data.display_order or idx
                    )
                    recipe_ingredients.append(recipe_ingredient)
                
                self.session.add_all(recipe_ingredients)
            
            await self.session.commit()
            
            # Load relationships for response
            return await self.get_recipe_with_full_details(recipe.id, user_id)
    
    @profile_query
    async def update_recipe_optimized(
        self,
        recipe_id: UUID,
        user_id: UUID,
        update_data: RecipeUpdate
    ) -> Recipe:
        """
        Update recipe with optimized permission checking and relationship loading.
        
        Args:
            recipe_id: ID of the recipe to update
            user_id: ID of the user making the update
            update_data: Fields to update
            
        Returns:
            Updated recipe instance with relationships loaded
            
        Raises:
            RecipeNotFoundError: If recipe not found
            RecipePermissionError: If user lacks permission to update
        """
        async with self.session.begin():
            # Get recipe with lock for update
            recipe = await self.get_by_id(recipe_id, raise_not_found=True)
            
            # Check permissions
            if recipe.user_id != user_id:
                raise RecipePermissionError(
                    f"You don't have permission to update recipe {recipe_id}"
                )
            
            # Update only provided fields
            update_dict = update_data.model_dump(exclude_unset=True, exclude_none=True)
            for field, value in update_dict.items():
                setattr(recipe, field, value)
            
            recipe.updated_at = datetime.now(timezone.utc)
            
            await self.session.commit()
            
            # Invalidate cache
            self.invalidate_cache(recipe_id)
            
            # Return with full details
            return await self.get_recipe_with_full_details(recipe_id, user_id)
    
    @profile_query
    async def delete_recipe_optimized(
        self,
        recipe_id: UUID,
        user_id: UUID
    ) -> Recipe:
        """
        Soft delete (archive) a recipe with optimized permission checking.
        
        Args:
            recipe_id: ID of the recipe to archive
            user_id: ID of the user making the deletion
            
        Returns:
            Archived recipe instance
            
        Raises:
            RecipeNotFoundError: If recipe not found
            RecipePermissionError: If user lacks permission to delete
        """
        async with self.session.begin():
            recipe = await self.get_by_id(recipe_id, raise_not_found=True)
            
            # Check permissions
            if recipe.user_id != user_id:
                raise RecipePermissionError(
                    f"You don't have permission to delete recipe {recipe_id}"
                )
            
            # Archive the recipe
            recipe.is_archived = True
            recipe.is_published = False  # Unpublish when archiving
            recipe.updated_at = datetime.now(timezone.utc)
            
            await self.session.commit()
            
            # Invalidate cache
            self.invalidate_cache(recipe_id)
            
            return recipe
    
    # Optimized ingredient operations
    
    @profile_query
    async def add_ingredients_batch(
        self,
        recipe_id: UUID,
        user_id: UUID,
        ingredients: List[RecipeIngredientCreate]
    ) -> List[RecipeIngredient]:
        """
        Add multiple ingredients to a recipe in a single transaction.
        
        Args:
            recipe_id: ID of the recipe
            user_id: ID of the user adding ingredients
            ingredients: List of ingredient data
            
        Returns:
            List of created RecipeIngredient instances
        """
        async with self.session.begin():
            # Validate recipe and permissions
            recipe = await self.get_by_id(recipe_id, raise_not_found=True)
            
            if recipe.user_id != user_id:
                raise RecipePermissionError(
                    f"You don't have permission to modify recipe {recipe_id}"
                )
            
            # Validate all ingredients exist
            ingredient_ids = [ing.ingredient_id for ing in ingredients]
            await self._validate_ingredients_exist_batch(ingredient_ids)
            
            # Create ingredients in batch
            recipe_ingredients = []
            for ingredient_data in ingredients:
                recipe_ingredient = RecipeIngredient(
                    recipe_id=recipe_id,
                    ingredient_id=ingredient_data.ingredient_id,
                    quantity=ingredient_data.quantity,
                    unit=ingredient_data.unit,
                    preparation_notes=ingredient_data.preparation_notes,
                    is_optional=ingredient_data.is_optional,
                    display_order=ingredient_data.display_order
                )
                recipe_ingredients.append(recipe_ingredient)
            
            self.session.add_all(recipe_ingredients)
            
            # Update recipe timestamp
            recipe.updated_at = datetime.now(timezone.utc)
            
            await self.session.commit()
            
            # Invalidate cache
            self.invalidate_cache(recipe_id)
            
            return recipe_ingredients
    
    # Helper methods
    
    async def _validate_ingredients_exist_batch(self, ingredient_ids: List[UUID]) -> None:
        """
        Validate that all ingredient IDs exist in the database using a single query.
        
        Args:
            ingredient_ids: List of ingredient IDs to validate
            
        Raises:
            IngredientNotFoundError: If any ingredient ID is invalid
        """
        if not ingredient_ids:
            return
        
        # Query to check which ingredients exist
        stmt = select(Ingredient.id).where(Ingredient.id.in_(ingredient_ids))
        result = await self.session.execute(stmt)
        existing_ids = {row[0] for row in result}
        
        # Find missing ingredients
        missing_ids = set(ingredient_ids) - existing_ids
        
        if missing_ids:
            # Raise error for the first missing ingredient
            raise IngredientNotFoundError(list(missing_ids)[0])
    
    @profile_query
    async def get_nutrition_for_recipes_batch(
        self,
        recipe_ids: List[UUID]
    ) -> Dict[UUID, Dict[str, Any]]:
        """
        Calculate nutrition for multiple recipes in an optimized batch operation.
        
        Args:
            recipe_ids: List of recipe IDs
            
        Returns:
            Dictionary mapping recipe IDs to nutrition data
        """
        # Get recipes with ingredients in a single query
        recipes = await self.get_recipes_with_ingredients_batch(recipe_ids)
        
        nutrition_data = {}
        
        for recipe in recipes:
            try:
                # Calculate nutrition for this recipe
                total_nutrition = self.nutrition_calculator.calculate_recipe_nutrition(
                    recipe.ingredients, recipe.servings
                )
                
                per_serving_nutrition = self.nutrition_calculator.calculate_per_serving(
                    total_nutrition, recipe.servings
                )
                
                nutrition_data[recipe.id] = {
                    'total': self.nutrition_calculator.round_nutrition_values(total_nutrition),
                    'per_serving': self.nutrition_calculator.round_nutrition_values(per_serving_nutrition)
                }
            except Exception as e:
                # Log error but don't fail the batch operation
                logger.warning(f"Failed to calculate nutrition for recipe {recipe.id}: {e}")
                nutrition_data[recipe.id] = {'total': None, 'per_serving': None}
        
        return nutrition_data
    
    def get_query_stats(self) -> Dict[str, Any]:
        """Get query profiling statistics."""
        return query_profiler.get_stats()
    
    def reset_query_stats(self):
        """Reset query profiling statistics."""
        query_profiler.reset()