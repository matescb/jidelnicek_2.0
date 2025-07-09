"""
Recipe service for Jidelnicek 2.0 recipe management system.

This module provides business logic for recipe management including
CRUD operations, publishing, forking, and nutritional calculations.
"""

from datetime import datetime, timezone
from typing import Optional, List, Dict, Any, Tuple
from uuid import UUID
from decimal import Decimal

from sqlalchemy import select, func, and_, or_, update, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload

from jidelnicek.recipe.models import Recipe, RecipeIngredient, RecipeVersion, RecipeImage
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
from jidelnicek.common.models import Ingredient


class RecipeService:
    """Service class for recipe management operations."""
    
    def __init__(self, session: AsyncSession):
        """
        Initialize recipe service.
        
        Args:
            session: AsyncSession instance for database operations
        """
        self.session = session
        self.nutrition_calculator = NutritionCalculator()
    
    async def create_recipe(
        self, 
        user_id: UUID, 
        recipe_data: RecipeCreate
    ) -> Recipe:
        """
        Create a new recipe with ingredients.
        
        Args:
            user_id: ID of the user creating the recipe
            recipe_data: Recipe creation data including ingredients
            
        Returns:
            Created recipe instance with ingredients
            
        Raises:
            IngredientNotFoundError: If any ingredient ID is invalid
            RecipeValidationError: If recipe data is invalid
            DuplicateIngredientError: If duplicate ingredients are provided
        """
        async with self.session.begin():
            # Validate ingredients exist
            if recipe_data.ingredients:
                ingredient_ids = [ing.ingredient_id for ing in recipe_data.ingredients]
                await self._validate_ingredients_exist(ingredient_ids)
            
            # Create recipe instance
            recipe_dict = recipe_data.model_dump(exclude={'ingredients'})
            recipe = Recipe(
                user_id=user_id,
                **recipe_dict
            )
            
            self.session.add(recipe)
            await self.session.flush()  # Get recipe ID
            
            # Add ingredients if provided
            if recipe_data.ingredients:
                for idx, ingredient_data in enumerate(recipe_data.ingredients):
                    recipe_ingredient = RecipeIngredient(
                        recipe_id=recipe.id,
                        ingredient_id=ingredient_data.ingredient_id,
                        quantity_g=ingredient_data.quantity_g,
                        display_order=ingredient_data.display_order or idx
                    )
                    self.session.add(recipe_ingredient)
            
            await self.session.commit()
            
            # Load relationships for response
            await self.session.refresh(recipe)
            
            return recipe
    
    async def get_recipe(
        self, 
        recipe_id: UUID, 
        user_id: Optional[UUID] = None
    ) -> Recipe:
        """
        Get recipe with permission check.
        
        Args:
            recipe_id: ID of the recipe to retrieve
            user_id: ID of the requesting user (optional)
            
        Returns:
            Recipe instance if authorized
            
        Raises:
            RecipeNotFoundError: If recipe not found
            RecipePermissionError: If user lacks permission to view recipe
        """
        stmt = (
            select(Recipe)
            .options(
                selectinload(Recipe.ingredients).selectinload(RecipeIngredient.ingredient)
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
    
    async def update_recipe(
        self,
        recipe_id: UUID,
        user_id: UUID,
        update_data: RecipeUpdate,
        create_version: bool = True
    ) -> Recipe:
        """
        Update recipe with validation and optional version tracking.
        
        Args:
            recipe_id: ID of the recipe to update
            user_id: ID of the user making the update
            update_data: Fields to update
            create_version: Whether to create a version entry for significant changes
            
        Returns:
            Updated recipe instance
            
        Raises:
            RecipeNotFoundError: If recipe not found
            RecipePermissionError: If user lacks permission to update
            RecipeValidationError: If update data is invalid
        """
        async with self.session.begin():
            # Get recipe with lock for update
            stmt = (
                select(Recipe)
                .options(
                    selectinload(Recipe.ingredients).selectinload(RecipeIngredient.ingredient)
                )
                .where(
                    Recipe.id == recipe_id,
                    Recipe.is_archived == False
                )
                .with_for_update()
            )
            
            result = await self.session.execute(stmt)
            recipe = result.scalar_one_or_none()
            
            if not recipe:
                raise RecipeNotFoundError(recipe_id)
            
            # Check permissions
            if recipe.user_id != user_id:
                raise RecipePermissionError(
                    f"You don't have permission to update recipe {recipe_id}"
                )
            
            # Calculate original nutrition if version tracking is enabled
            original_nutrition = None
            if create_version and recipe.ingredients:
                try:
                    original_nutrition = self.nutrition_calculator.calculate_recipe_nutrition(
                        recipe.ingredients, recipe.servings
                    )
                except Exception:
                    original_nutrition = None
            
            # Update only provided fields
            update_dict = update_data.model_dump(exclude_unset=True, exclude_none=True)
            for field, value in update_dict.items():
                setattr(recipe, field, value)
            
            recipe.updated_at = datetime.now(timezone.utc)
            
            # Calculate updated nutrition if version tracking is enabled
            updated_nutrition = None
            if create_version and recipe.ingredients:
                try:
                    updated_nutrition = self.nutrition_calculator.calculate_recipe_nutrition(
                        recipe.ingredients, recipe.servings
                    )
                except Exception:
                    updated_nutrition = None
            
            await self.session.commit()
            
            # Create version if enabled and changes are significant
            if create_version:
                change_description = f"Recipe updated: {', '.join(update_dict.keys())}"
                await self.create_version_on_update(
                    recipe, user_id, original_nutrition, updated_nutrition, change_description
                )
            
            # Reload with relationships
            await self.session.refresh(recipe)
            stmt = (
                select(Recipe)
                .options(
                    selectinload(Recipe.ingredients).selectinload(RecipeIngredient.ingredient)
                )
                .where(Recipe.id == recipe_id)
            )
            result = await self.session.execute(stmt)
            return result.scalar_one()
    
    async def delete_recipe(
        self,
        recipe_id: UUID,
        user_id: UUID
    ) -> Recipe:
        """
        Soft delete (archive) a recipe.
        
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
            recipe = await self._get_recipe_for_update(recipe_id)
            
            if not recipe:
                raise RecipeNotFoundError(recipe_id)
            
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
            await self.session.refresh(recipe)
            
            return recipe
    
    async def list_user_recipes(
        self,
        user_id: UUID,
        skip: int = 0,
        limit: int = 20
    ) -> Tuple[List[Recipe], int]:
        """
        Get paginated list of user's recipes.
        
        Args:
            user_id: ID of the user
            skip: Number of records to skip
            limit: Maximum number of records to return
            
        Returns:
            Tuple of (recipes list, total count)
        """
        # Base query for user's non-archived recipes
        base_query = select(Recipe).where(
            Recipe.user_id == user_id,
            Recipe.is_archived == False
        )
        
        # Count total
        count_stmt = select(func.count()).select_from(base_query.subquery())
        total_result = await self.session.execute(count_stmt)
        total = total_result.scalar_one()
        
        # Get paginated results
        stmt = (
            base_query
            .options(selectinload(Recipe.ingredients))
            .order_by(Recipe.updated_at.desc())
            .offset(skip)
            .limit(limit)
        )
        
        result = await self.session.execute(stmt)
        recipes = result.scalars().all()
        
        return recipes, total
    
    async def search_recipes(
        self,
        search_params: RecipeSearch,
        skip: int = 0,
        limit: int = 20
    ) -> Tuple[List[Recipe], int]:
        """
        Advanced recipe search with multiple filters.
        
        Args:
            search_params: Search parameters including filters
            skip: Number of records to skip
            limit: Maximum number of records to return
            
        Returns:
            Tuple of (recipes list, total count)
        """
        # Build base query
        query = select(Recipe)
        
        # Apply filters
        conditions = []
        
        # Archive filter (default to not showing archived)
        if not search_params.is_archived:
            conditions.append(Recipe.is_archived == False)
        
        # User filter
        if search_params.user_id:
            conditions.append(Recipe.user_id == search_params.user_id)
        
        # Public/private filter
        if search_params.is_public is not None:
            conditions.append(Recipe.is_public == search_params.is_public)
        
        # Published filter
        if search_params.is_published is not None:
            conditions.append(Recipe.is_published == search_params.is_published)
        
        # Text search in name and description
        if search_params.query:
            search_term = f"%{search_params.query}%"
            conditions.append(
                or_(
                    Recipe.name.ilike(search_term),
                    Recipe.description.ilike(search_term)
                )
            )
        
        # Time filters
        if search_params.max_prep_time:
            conditions.append(Recipe.prep_time_minutes <= search_params.max_prep_time)
        
        if search_params.max_cook_time:
            conditions.append(Recipe.cook_time_minutes <= search_params.max_cook_time)
        
        if search_params.max_total_time:
            conditions.append(
                (Recipe.prep_time_minutes + Recipe.cook_time_minutes) <= search_params.max_total_time
            )
        
        # Servings filters
        if search_params.min_servings:
            conditions.append(Recipe.servings >= search_params.min_servings)
        
        if search_params.max_servings:
            conditions.append(Recipe.servings <= search_params.max_servings)
        
        # Ingredient filter (recipes containing specific ingredients)
        if search_params.has_ingredients:
            # Subquery to find recipes with all specified ingredients
            ingredient_subquery = (
                select(RecipeIngredient.recipe_id)
                .where(RecipeIngredient.ingredient_id.in_(search_params.has_ingredients))
                .group_by(RecipeIngredient.recipe_id)
                .having(func.count(RecipeIngredient.ingredient_id) >= len(search_params.has_ingredients))
            )
            conditions.append(Recipe.id.in_(ingredient_subquery))
        
        # Apply all conditions
        if conditions:
            query = query.where(and_(*conditions))
        
        # Count total matching recipes
        count_stmt = select(func.count()).select_from(query.subquery())
        total_result = await self.session.execute(count_stmt)
        total = total_result.scalar_one()
        
        # Get paginated results
        stmt = (
            query
            .options(selectinload(Recipe.ingredients))
            .order_by(Recipe.updated_at.desc())
            .offset(skip)
            .limit(limit)
        )
        
        result = await self.session.execute(stmt)
        recipes = result.scalars().all()
        
        return recipes, total
    
    async def publish_recipe(
        self,
        recipe_id: UUID,
        user_id: UUID
    ) -> Recipe:
        """
        Make recipe public and published.
        
        Args:
            recipe_id: ID of the recipe to publish
            user_id: ID of the user publishing the recipe
            
        Returns:
            Published recipe instance
            
        Raises:
            RecipeNotFoundError: If recipe not found
            RecipePermissionError: If user lacks permission
            RecipeAlreadyPublishedError: If recipe is already published
        """
        async with self.session.begin():
            recipe = await self._get_recipe_for_update(recipe_id)
            
            if not recipe:
                raise RecipeNotFoundError(recipe_id)
            
            # Check permissions
            if recipe.user_id != user_id:
                raise RecipePermissionError(
                    f"You don't have permission to publish recipe {recipe_id}"
                )
            
            # Check if already published
            if recipe.is_published:
                raise RecipeAlreadyPublishedError(recipe_id)
            
            # Publish the recipe
            recipe.is_public = True
            recipe.is_published = True
            recipe.published_at = datetime.now(timezone.utc)
            recipe.updated_at = datetime.now(timezone.utc)
            
            await self.session.commit()
            
            # Reload with relationships
            await self.session.refresh(recipe)
            return await self.get_recipe(recipe_id, user_id)
    
    async def unpublish_recipe(
        self,
        recipe_id: UUID,
        user_id: UUID
    ) -> Recipe:
        """
        Unpublish recipe with fork count constraint check.
        
        Args:
            recipe_id: ID of the recipe to unpublish
            user_id: ID of the user unpublishing the recipe
            
        Returns:
            Unpublished recipe instance
            
        Raises:
            RecipeNotFoundError: If recipe not found
            RecipePermissionError: If user lacks permission
            RecipeNotPublishedForUnpublishError: If recipe is not published
            RecipeUnpublishError: If recipe has too many forks (>5)
        """
        async with self.session.begin():
            recipe = await self._get_recipe_for_update(recipe_id)
            
            if not recipe:
                raise RecipeNotFoundError(recipe_id)
            
            # Check permissions
            if recipe.user_id != user_id:
                raise RecipePermissionError(
                    f"You don't have permission to unpublish recipe {recipe_id}"
                )
            
            # Check if published
            if not recipe.is_published:
                raise RecipeNotPublishedForUnpublishError(recipe_id)
            
            # Check fork count constraint
            if recipe.fork_count > 5:
                raise RecipeUnpublishError(recipe_id, recipe.fork_count)
            
            # Unpublish the recipe
            recipe.is_published = False
            recipe.published_at = None
            recipe.updated_at = datetime.now(timezone.utc)
            
            await self.session.commit()
            
            # Reload with relationships
            await self.session.refresh(recipe)
            return await self.get_recipe(recipe_id, user_id)
    
    async def fork_recipe(
        self,
        recipe_id: UUID,
        user_id: UUID,
        new_name: Optional[str] = None
    ) -> Recipe:
        """
        Fork a public recipe.
        
        Args:
            recipe_id: ID of the recipe to fork
            user_id: ID of the user forking the recipe
            new_name: Optional custom name for the forked recipe
            
        Returns:
            Newly created forked recipe
            
        Raises:
            RecipeNotFoundError: If recipe not found
            RecipeNotPublishedError: If recipe is not published
            RecipeSelfForkError: If user tries to fork their own recipe
        """
        async with self.session.begin():
            # Get original recipe with ingredients
            stmt = (
                select(Recipe)
                .options(
                    selectinload(Recipe.ingredients).selectinload(RecipeIngredient.ingredient)
                )
                .where(
                    Recipe.id == recipe_id,
                    Recipe.is_archived == False
                )
                .with_for_update()
            )
            
            result = await self.session.execute(stmt)
            original_recipe = result.scalar_one_or_none()
            
            if not original_recipe:
                raise RecipeNotFoundError(recipe_id)
            
            # Check if recipe is published
            if not original_recipe.is_published:
                raise RecipeNotPublishedError(recipe_id)
            
            # Check if user is trying to fork their own recipe
            if original_recipe.user_id == user_id:
                raise RecipeSelfForkError(recipe_id)
            
            # Create forked recipe
            fork_data = {
                'user_id': user_id,
                'name': new_name or f"{original_recipe.name} (fork)",
                'description': original_recipe.description,
                'instructions': original_recipe.instructions,
                'prep_time_minutes': original_recipe.prep_time_minutes,
                'cook_time_minutes': original_recipe.cook_time_minutes,
                'water_ml': original_recipe.water_ml,
                'servings': original_recipe.servings,
                'is_public': False,  # Forked recipes start as private
                'is_published': False,
                'original_recipe_id': recipe_id
            }
            
            forked_recipe = Recipe(**fork_data)
            self.session.add(forked_recipe)
            await self.session.flush()
            
            # Copy ingredients
            for orig_ingredient in original_recipe.ingredients:
                fork_ingredient = RecipeIngredient(
                    recipe_id=forked_recipe.id,
                    ingredient_id=orig_ingredient.ingredient_id,
                    quantity_g=orig_ingredient.quantity_g,
                    display_order=orig_ingredient.display_order
                )
                self.session.add(fork_ingredient)
            
            # Increment fork count on original recipe
            original_recipe.fork_count += 1
            
            await self.session.commit()
            
            # Return the forked recipe with all relationships loaded
            return await self.get_recipe(forked_recipe.id, user_id)
    
    async def get_recipe_with_nutrition(
        self,
        recipe_id: UUID,
        user_id: Optional[UUID] = None
    ) -> RecipeDetail:
        """
        Get recipe with calculated nutritional information.
        
        Args:
            recipe_id: ID of the recipe
            user_id: ID of the requesting user (optional)
            
        Returns:
            RecipeDetail with nutritional calculations
            
        Raises:
            RecipeNotFoundError: If recipe not found
            RecipePermissionError: If user lacks permission
        """
        # Get recipe with ingredients
        recipe = await self.get_recipe(recipe_id, user_id)
        
        # Convert to response model
        recipe_detail = RecipeDetail.model_validate(recipe)
        
        # Calculate nutrition if ingredients are present
        if recipe.ingredients:
            try:
                # Calculate total nutrition
                total_nutrition = self.nutrition_calculator.calculate_recipe_nutrition(
                    recipe.ingredients,
                    recipe.servings
                )
                
                # Calculate per-serving nutrition
                per_serving_nutrition = self.nutrition_calculator.calculate_per_serving(
                    total_nutrition,
                    recipe.servings
                )
                
                # Round values for display
                recipe_detail.nutrition_total = self.nutrition_calculator.round_nutrition_values(
                    total_nutrition
                )
                recipe_detail.nutrition_per_serving = self.nutrition_calculator.round_nutrition_values(
                    per_serving_nutrition
                )
                
            except Exception as e:
                # Log error but don't fail the request
                # Nutrition data might be incomplete
                recipe_detail.nutrition_total = None
                recipe_detail.nutrition_per_serving = None
        
        return recipe_detail
    
    async def add_ingredient_to_recipe(
        self,
        recipe_id: UUID,
        user_id: UUID,
        ingredient_data: RecipeIngredientCreate,
        create_version: bool = True
    ) -> RecipeIngredient:
        """
        Add a new ingredient to an existing recipe with optional version tracking.
        
        Args:
            recipe_id: ID of the recipe
            user_id: ID of the user adding the ingredient
            ingredient_data: Ingredient data including quantity
            create_version: Whether to create a version entry for significant changes
            
        Returns:
            Created RecipeIngredient instance
            
        Raises:
            RecipeNotFoundError: If recipe not found
            RecipePermissionError: If user lacks permission
            IngredientNotFoundError: If ingredient doesn't exist
            DuplicateIngredientError: If ingredient already in recipe
        """
        async with self.session.begin():
            # Get recipe with ingredients
            stmt = (
                select(Recipe)
                .options(
                    selectinload(Recipe.ingredients).selectinload(RecipeIngredient.ingredient)
                )
                .where(
                    Recipe.id == recipe_id,
                    Recipe.is_archived == False
                )
                .with_for_update()
            )
            
            result = await self.session.execute(stmt)
            recipe = result.scalar_one_or_none()
            
            if not recipe:
                raise RecipeNotFoundError(recipe_id)
            
            # Check permissions
            if recipe.user_id != user_id:
                raise RecipePermissionError(
                    f"You don't have permission to modify recipe {recipe_id}"
                )
            
            # Validate ingredient exists
            await self._validate_ingredients_exist([ingredient_data.ingredient_id])
            
            # Check if ingredient already in recipe
            existing = await self.session.execute(
                select(RecipeIngredient).where(
                    RecipeIngredient.recipe_id == recipe_id,
                    RecipeIngredient.ingredient_id == ingredient_data.ingredient_id
                )
            )
            if existing.scalar_one_or_none():
                raise DuplicateIngredientError(recipe_id, ingredient_data.ingredient_id)
            
            # Calculate original nutrition if version tracking is enabled
            original_nutrition = None
            if create_version and recipe.ingredients:
                try:
                    original_nutrition = self.nutrition_calculator.calculate_recipe_nutrition(
                        recipe.ingredients, recipe.servings
                    )
                except Exception:
                    original_nutrition = None
            
            # Add ingredient
            recipe_ingredient = RecipeIngredient(
                recipe_id=recipe_id,
                ingredient_id=ingredient_data.ingredient_id,
                quantity_g=ingredient_data.quantity_g,
                display_order=ingredient_data.display_order
            )
            
            self.session.add(recipe_ingredient)
            
            # Update recipe timestamp
            recipe.updated_at = datetime.now(timezone.utc)
            
            # Refresh ingredients for nutrition calculation
            await self.session.flush()
            await self.session.refresh(recipe)
            
            # Calculate updated nutrition if version tracking is enabled
            updated_nutrition = None
            if create_version and recipe.ingredients:
                try:
                    updated_nutrition = self.nutrition_calculator.calculate_recipe_nutrition(
                        recipe.ingredients, recipe.servings
                    )
                except Exception:
                    updated_nutrition = None
            
            await self.session.commit()
            
            # Create version if enabled and changes are significant
            if create_version:
                change_description = f"Ingredient added: {ingredient_data.quantity_g}g"
                await self.create_version_on_update(
                    recipe, user_id, original_nutrition, updated_nutrition, change_description
                )
            
            await self.session.refresh(recipe_ingredient)
            return recipe_ingredient
    
    async def update_recipe_ingredient(
        self,
        recipe_id: UUID,
        ingredient_id: UUID,
        user_id: UUID,
        quantity_g: Decimal,
        create_version: bool = True
    ) -> RecipeIngredient:
        """
        Update ingredient quantity in a recipe with optional version tracking.
        
        Args:
            recipe_id: ID of the recipe
            ingredient_id: ID of the ingredient to update
            user_id: ID of the user making the update
            quantity_g: New quantity in grams
            create_version: Whether to create a version entry for significant changes
            
        Returns:
            Updated RecipeIngredient instance
            
        Raises:
            RecipeNotFoundError: If recipe not found
            RecipePermissionError: If user lacks permission
            IngredientNotFoundError: If ingredient not in recipe
        """
        async with self.session.begin():
            # Get recipe with ingredients
            stmt = (
                select(Recipe)
                .options(
                    selectinload(Recipe.ingredients).selectinload(RecipeIngredient.ingredient)
                )
                .where(
                    Recipe.id == recipe_id,
                    Recipe.is_archived == False
                )
                .with_for_update()
            )
            
            result = await self.session.execute(stmt)
            recipe = result.scalar_one_or_none()
            
            if not recipe:
                raise RecipeNotFoundError(recipe_id)
            
            # Check permissions
            if recipe.user_id != user_id:
                raise RecipePermissionError(
                    f"You don't have permission to modify recipe {recipe_id}"
                )
            
            # Calculate original nutrition if version tracking is enabled
            original_nutrition = None
            if create_version and recipe.ingredients:
                try:
                    original_nutrition = self.nutrition_calculator.calculate_recipe_nutrition(
                        recipe.ingredients, recipe.servings
                    )
                except Exception:
                    original_nutrition = None
            
            # Get recipe ingredient
            ingredient_stmt = select(RecipeIngredient).where(
                RecipeIngredient.recipe_id == recipe_id,
                RecipeIngredient.ingredient_id == ingredient_id
            ).with_for_update()
            
            ingredient_result = await self.session.execute(ingredient_stmt)
            recipe_ingredient = ingredient_result.scalar_one_or_none()
            
            if not recipe_ingredient:
                raise IngredientNotFoundError(ingredient_id)
            
            # Store old quantity for change description
            old_quantity = recipe_ingredient.quantity_g
            
            # Update quantity
            recipe_ingredient.quantity_g = quantity_g
            
            # Update recipe timestamp
            recipe.updated_at = datetime.now(timezone.utc)
            
            # Calculate updated nutrition if version tracking is enabled
            updated_nutrition = None
            if create_version and recipe.ingredients:
                try:
                    updated_nutrition = self.nutrition_calculator.calculate_recipe_nutrition(
                        recipe.ingredients, recipe.servings
                    )
                except Exception:
                    updated_nutrition = None
            
            await self.session.commit()
            
            # Create version if enabled and changes are significant
            if create_version:
                change_description = f"Ingredient quantity updated: {old_quantity}g → {quantity_g}g"
                await self.create_version_on_update(
                    recipe, user_id, original_nutrition, updated_nutrition, change_description
                )
            
            await self.session.refresh(recipe_ingredient)
            return recipe_ingredient
    
    async def remove_ingredient_from_recipe(
        self,
        recipe_id: UUID,
        ingredient_id: UUID,
        user_id: UUID,
        create_version: bool = True
    ) -> None:
        """
        Remove an ingredient from a recipe with optional version tracking.
        
        Args:
            recipe_id: ID of the recipe
            ingredient_id: ID of the ingredient to remove
            user_id: ID of the user removing the ingredient
            create_version: Whether to create a version entry for significant changes
            
        Raises:
            RecipeNotFoundError: If recipe not found
            RecipePermissionError: If user lacks permission
            IngredientNotFoundError: If ingredient not in recipe
        """
        async with self.session.begin():
            # Get recipe with ingredients
            stmt = (
                select(Recipe)
                .options(
                    selectinload(Recipe.ingredients).selectinload(RecipeIngredient.ingredient)
                )
                .where(
                    Recipe.id == recipe_id,
                    Recipe.is_archived == False
                )
                .with_for_update()
            )
            
            result = await self.session.execute(stmt)
            recipe = result.scalar_one_or_none()
            
            if not recipe:
                raise RecipeNotFoundError(recipe_id)
            
            # Check permissions
            if recipe.user_id != user_id:
                raise RecipePermissionError(
                    f"You don't have permission to modify recipe {recipe_id}"
                )
            
            # Get ingredient being removed for change description
            ingredient_stmt = select(RecipeIngredient).where(
                RecipeIngredient.recipe_id == recipe_id,
                RecipeIngredient.ingredient_id == ingredient_id
            )
            
            ingredient_result = await self.session.execute(ingredient_stmt)
            recipe_ingredient = ingredient_result.scalar_one_or_none()
            
            if not recipe_ingredient:
                raise IngredientNotFoundError(ingredient_id)
            
            # Calculate original nutrition if version tracking is enabled
            original_nutrition = None
            if create_version and recipe.ingredients:
                try:
                    original_nutrition = self.nutrition_calculator.calculate_recipe_nutrition(
                        recipe.ingredients, recipe.servings
                    )
                except Exception:
                    original_nutrition = None
            
            # Store quantity for change description
            removed_quantity = recipe_ingredient.quantity_g
            
            # Delete recipe ingredient
            delete_stmt = delete(RecipeIngredient).where(
                RecipeIngredient.recipe_id == recipe_id,
                RecipeIngredient.ingredient_id == ingredient_id
            )
            
            delete_result = await self.session.execute(delete_stmt)
            
            if delete_result.rowcount == 0:
                raise IngredientNotFoundError(ingredient_id)
            
            # Update recipe timestamp
            recipe.updated_at = datetime.now(timezone.utc)
            
            # Refresh ingredients for nutrition calculation
            await self.session.flush()
            await self.session.refresh(recipe)
            
            # Calculate updated nutrition if version tracking is enabled
            updated_nutrition = None
            if create_version and recipe.ingredients:
                try:
                    updated_nutrition = self.nutrition_calculator.calculate_recipe_nutrition(
                        recipe.ingredients, recipe.servings
                    )
                except Exception:
                    updated_nutrition = None
            
            await self.session.commit()
            
            # Create version if enabled and changes are significant
            if create_version:
                change_description = f"Ingredient removed: {removed_quantity}g"
                await self.create_version_on_update(
                    recipe, user_id, original_nutrition, updated_nutrition, change_description
                )
    
    # Helper methods
    
    async def _get_recipe_for_update(self, recipe_id: UUID) -> Optional[Recipe]:
        """Get recipe with update lock."""
        stmt = (
            select(Recipe)
            .where(
                Recipe.id == recipe_id,
                Recipe.is_archived == False
            )
            .with_for_update()
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()
    
    async def _validate_ingredients_exist(self, ingredient_ids: List[UUID]) -> None:
        """Validate that all ingredient IDs exist in the database."""
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
    
    def to_response_dto(self, recipe: Recipe) -> RecipeResponse:
        """
        Convert recipe model to response DTO.
        
        Args:
            recipe: Recipe model instance
            
        Returns:
            RecipeResponse instance
        """
        return RecipeResponse.model_validate(recipe)
    
    # Duplicate recipe functionality
    
    async def duplicate_recipe(
        self,
        recipe_id: UUID,
        user_id: UUID,
        duplicate_request: RecipeDuplicateRequest = None
    ) -> RecipeDuplicateResponse:
        """
        Create an exact copy of a recipe for the same user.
        
        Args:
            recipe_id: ID of the recipe to duplicate
            user_id: ID of the user creating the duplicate
            duplicate_request: Optional request data with custom name
            
        Returns:
            RecipeDuplicateResponse with details about the duplicated recipe
            
        Raises:
            RecipeNotFoundError: If recipe not found
            RecipePermissionError: If user lacks permission to duplicate
        """
        async with self.session.begin():
            # Get original recipe with ingredients and images
            stmt = (
                select(Recipe)
                .options(
                    selectinload(Recipe.ingredients).selectinload(RecipeIngredient.ingredient),
                    selectinload(Recipe.images)
                )
                .where(
                    Recipe.id == recipe_id,
                    Recipe.is_archived == False
                )
            )
            
            result = await self.session.execute(stmt)
            original_recipe = result.scalar_one_or_none()
            
            if not original_recipe:
                raise RecipeNotFoundError(recipe_id)
            
            # Check permissions - user must own the recipe
            if original_recipe.user_id != user_id:
                raise RecipePermissionError(
                    f"You don't have permission to duplicate recipe {recipe_id}"
                )
            
            # Determine new name
            if duplicate_request and duplicate_request.new_name:
                new_name = duplicate_request.new_name
            else:
                new_name = f"{original_recipe.name} (Copy)"
            
            # Create duplicated recipe
            duplicate_data = {
                'user_id': user_id,
                'name': new_name,
                'description': original_recipe.description,
                'instructions': original_recipe.instructions,
                'prep_time_minutes': original_recipe.prep_time_minutes,
                'cook_time_minutes': original_recipe.cook_time_minutes,
                'water_ml': original_recipe.water_ml,
                'servings': original_recipe.servings,
                'difficulty_level': original_recipe.difficulty_level,
                'is_public': original_recipe.is_public,
                'is_published': False,  # Reset publication status
                'published_at': None,
                # Reset stats
                'view_count': 0,
                'rating_average': None,
                'rating_count': 0,
                'fork_count': 0,
                'original_recipe_id': None  # Not a fork, but a duplicate
            }
            
            duplicated_recipe = Recipe(**duplicate_data)
            self.session.add(duplicated_recipe)
            await self.session.flush()
            
            # Copy ingredients with exact quantities
            for orig_ingredient in original_recipe.ingredients:
                duplicate_ingredient = RecipeIngredient(
                    recipe_id=duplicated_recipe.id,
                    ingredient_id=orig_ingredient.ingredient_id,
                    quantity_g=orig_ingredient.quantity_g,
                    display_order=orig_ingredient.display_order
                )
                self.session.add(duplicate_ingredient)
            
            # Copy images (reference same files)
            for orig_image in original_recipe.images:
                duplicate_image = RecipeImage(
                    recipe_id=duplicated_recipe.id,
                    file_path=orig_image.file_path,  # Reference same file
                    display_order=orig_image.display_order,
                    caption=orig_image.caption,
                    is_primary=orig_image.is_primary
                )
                self.session.add(duplicate_image)
            
            await self.session.commit()
            
            return RecipeDuplicateResponse(
                original_recipe_id=recipe_id,
                duplicated_recipe_id=duplicated_recipe.id,
                message=f"Recipe '{original_recipe.name}' successfully duplicated as '{new_name}'"
            )
    
    # Version tracking functionality
    
    async def create_version(
        self,
        recipe_id: UUID,
        user_id: UUID,
        version_data: RecipeVersionCreate
    ) -> RecipeVersionResponse:
        """
        Create a new version entry for a recipe.
        
        Args:
            recipe_id: ID of the recipe
            user_id: ID of the user creating the version
            version_data: Version creation data
            
        Returns:
            Created RecipeVersionResponse instance
            
        Raises:
            RecipeNotFoundError: If recipe not found
            RecipePermissionError: If user lacks permission
        """
        async with self.session.begin():
            # Get recipe
            recipe = await self._get_recipe_for_update(recipe_id)
            
            if not recipe:
                raise RecipeNotFoundError(recipe_id)
            
            # Check permissions
            if recipe.user_id != user_id:
                raise RecipePermissionError(
                    f"You don't have permission to create versions for recipe {recipe_id}"
                )
            
            # Create version
            version = RecipeVersion(
                recipe_id=recipe_id,
                changed_by=user_id,
                version_number=version_data.version_number,
                change_description=version_data.change_description,
                change_type=version_data.change_type,
                nutritional_change_percentage=version_data.nutritional_change_percentage,
                is_significant=version_data.is_significant,
                recipe_snapshot=version_data.recipe_snapshot
            )
            
            self.session.add(version)
            await self.session.commit()
            await self.session.refresh(version)
            
            return RecipeVersionResponse.model_validate(version)
    
    async def get_version_history(
        self,
        recipe_id: UUID,
        user_id: Optional[UUID] = None
    ) -> RecipeVersionHistory:
        """
        Get version history for a recipe.
        
        Args:
            recipe_id: ID of the recipe
            user_id: ID of the requesting user (optional)
            
        Returns:
            RecipeVersionHistory with all versions
            
        Raises:
            RecipeNotFoundError: If recipe not found
            RecipePermissionError: If user lacks permission
        """
        # Check if recipe exists and user has permission
        recipe = await self.get_recipe(recipe_id, user_id)
        
        # Get all versions
        stmt = (
            select(RecipeVersion)
            .where(RecipeVersion.recipe_id == recipe_id)
            .order_by(RecipeVersion.created_at.desc())
        )
        
        result = await self.session.execute(stmt)
        versions = result.scalars().all()
        
        # Get current version (most recent)
        current_version = versions[0].version_number if versions else None
        
        version_responses = [
            RecipeVersionResponse.model_validate(version)
            for version in versions
        ]
        
        return RecipeVersionHistory(
            recipe_id=recipe_id,
            current_version=current_version,
            versions=version_responses,
            total_versions=len(versions)
        )
    
    async def calculate_nutritional_change(
        self,
        original_nutrition: Dict[str, Optional[Decimal]],
        updated_nutrition: Dict[str, Optional[Decimal]]
    ) -> Decimal:
        """
        Calculate percentage change in nutritional values.
        
        Args:
            original_nutrition: Original nutritional values
            updated_nutrition: Updated nutritional values
            
        Returns:
            Percentage change as Decimal
        """
        if not original_nutrition or not updated_nutrition:
            return Decimal('0')
        
        # Calculate change for key nutrients
        key_nutrients = ['calories', 'proteins_g', 'carbohydrates_g', 'fats_g']
        total_change = Decimal('0')
        nutrient_count = 0
        
        for nutrient in key_nutrients:
            original_value = original_nutrition.get(nutrient)
            updated_value = updated_nutrition.get(nutrient)
            
            if original_value is not None and updated_value is not None:
                if original_value > 0:
                    change = abs(updated_value - original_value) / original_value
                    total_change += change
                    nutrient_count += 1
        
        if nutrient_count == 0:
            return Decimal('0')
        
        # Return average percentage change
        avg_change = total_change / nutrient_count
        return (avg_change * 100).quantize(Decimal('0.01'))
    
    async def is_significant_change(
        self,
        nutritional_change_percentage: Decimal,
        threshold: Decimal = Decimal('1.0')
    ) -> bool:
        """
        Determine if a change is significant based on nutritional change.
        
        Args:
            nutritional_change_percentage: Percentage change in nutrition
            threshold: Threshold for significant change (default 1%)
            
        Returns:
            True if change is significant
        """
        return nutritional_change_percentage >= threshold
    
    async def create_version_on_update(
        self,
        recipe: Recipe,
        user_id: UUID,
        original_nutrition: Optional[Dict[str, Optional[Decimal]]] = None,
        updated_nutrition: Optional[Dict[str, Optional[Decimal]]] = None,
        change_description: Optional[str] = None
    ) -> Optional[RecipeVersionResponse]:
        """
        Create a version entry when a recipe is updated significantly.
        
        Args:
            recipe: Recipe instance
            user_id: ID of the user making the update
            original_nutrition: Original nutritional values (optional)
            updated_nutrition: Updated nutritional values (optional)
            change_description: Description of changes (optional)
            
        Returns:
            RecipeVersionResponse if version was created, None otherwise
        """
        # Calculate nutritional change if nutrition data is provided
        nutritional_change = Decimal('0')
        if original_nutrition and updated_nutrition:
            nutritional_change = await self.calculate_nutritional_change(
                original_nutrition, updated_nutrition
            )
        
        # Determine if change is significant
        is_significant = await self.is_significant_change(nutritional_change)
        
        # Only create version for significant changes
        if is_significant or change_description:
            # Get current version count to determine next version number
            stmt = (
                select(func.count(RecipeVersion.id))
                .where(RecipeVersion.recipe_id == recipe.id)
            )
            result = await self.session.execute(stmt)
            version_count = result.scalar_one() or 0
            
            # Generate version number (start from 1.0, increment minor version)
            if version_count == 0:
                version_number = "1.0"
            else:
                # Get latest version to increment
                latest_stmt = (
                    select(RecipeVersion.version_number)
                    .where(RecipeVersion.recipe_id == recipe.id)
                    .order_by(RecipeVersion.created_at.desc())
                    .limit(1)
                )
                latest_result = await self.session.execute(latest_stmt)
                latest_version = latest_result.scalar_one_or_none()
                
                if latest_version:
                    major, minor = latest_version.split('.')
                    version_number = f"{major}.{int(minor) + 1}"
                else:
                    version_number = "1.0"
            
            # Create version data
            version_data = RecipeVersionCreate(
                version_number=version_number,
                change_description=change_description or "Recipe updated",
                change_type="nutritional" if nutritional_change > 0 else "metadata",
                nutritional_change_percentage=nutritional_change if nutritional_change > 0 else None,
                is_significant=is_significant,
                recipe_snapshot={
                    "name": recipe.name,
                    "description": recipe.description,
                    "instructions": recipe.instructions,
                    "prep_time_minutes": recipe.prep_time_minutes,
                    "cook_time_minutes": recipe.cook_time_minutes,
                    "servings": recipe.servings,
                    "water_ml": recipe.water_ml,
                    "difficulty_level": recipe.difficulty_level
                }
            )
            
            return await self.create_version(recipe.id, user_id, version_data)
        
        return None