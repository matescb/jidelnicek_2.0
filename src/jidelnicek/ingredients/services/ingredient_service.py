"""
Service layer for ingredient operations.
"""

from typing import List, Optional, Dict, Any, Tuple
from uuid import UUID
from datetime import datetime
import logging

from sqlalchemy import select, and_, or_, func, desc, asc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from jidelnicek.common.models.ingredient import Ingredient
from jidelnicek.auth.models import AuthUser
from jidelnicek.ingredients.schemas.ingredient import (
    IngredientCreate, IngredientUpdate, IngredientFilter,
    NutritionalData, UnitConversions, DietaryFlags
)
from jidelnicek.core.exceptions import NotFoundError, ConflictError, ValidationError

logger = logging.getLogger(__name__)


class IngredientService:
    """Service for managing ingredients."""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def create_ingredient(
        self,
        ingredient_data: IngredientCreate,
        user: Optional[AuthUser] = None
    ) -> Ingredient:
        """
        Create a new ingredient.
        
        Args:
            ingredient_data: Ingredient creation data
            user: Current user (None for global ingredients)
            
        Returns:
            Created ingredient
            
        Raises:
            ConflictError: If ingredient with same name and brand already exists
            ValidationError: If data validation fails
        """
        # Check if ingredient already exists
        stmt = select(Ingredient).where(
            and_(
                Ingredient.name == ingredient_data.name,
                Ingredient.brand == ingredient_data.brand,
                Ingredient.user_id == (user.id if user and not ingredient_data.is_global else None)
            )
        )
        result = await self.db.execute(stmt)
        if result.scalar_one_or_none():
            raise ConflictError(
                f"Ingredient '{ingredient_data.name}' from brand '{ingredient_data.brand}' already exists"
            )
        
        # Validate nutritional data consistency
        await self._validate_nutritional_data(ingredient_data.nutritional_data)
        
        # Create ingredient
        ingredient = Ingredient(
            name=ingredient_data.name,
            brand=ingredient_data.brand,
            barcode=ingredient_data.barcode,
            category=ingredient_data.category,
            image_url=ingredient_data.image_url,
            nutritional_data=ingredient_data.nutritional_data.model_dump(),
            unit_conversions=ingredient_data.unit_conversions.model_dump() if ingredient_data.unit_conversions else {},
            dietary_flags=ingredient_data.dietary_flags.model_dump() if ingredient_data.dietary_flags else {},
            allergens=ingredient_data.allergens or [],
            is_global=ingredient_data.is_global,
            user_id=None if ingredient_data.is_global else (user.id if user else None)
        )
        
        self.db.add(ingredient)
        await self.db.commit()
        await self.db.refresh(ingredient)
        
        logger.info(f"Created ingredient: {ingredient.name} (ID: {ingredient.id})")
        return ingredient
    
    async def get_ingredient(
        self,
        ingredient_id: UUID,
        user: Optional[AuthUser] = None,
        include_archived: bool = False
    ) -> Ingredient:
        """
        Get ingredient by ID.
        
        Args:
            ingredient_id: Ingredient ID
            user: Current user (for access control)
            include_archived: Whether to include archived ingredients
            
        Returns:
            Ingredient instance
            
        Raises:
            NotFoundError: If ingredient not found
        """
        stmt = select(Ingredient).where(Ingredient.id == ingredient_id)
        
        if not include_archived:
            stmt = stmt.where(Ingredient.is_archived == False)
        
        # Access control: user can see global ingredients and their own
        if user and not user.is_admin:
            stmt = stmt.where(
                or_(
                    Ingredient.is_global == True,
                    Ingredient.user_id == user.id
                )
            )
        
        result = await self.db.execute(stmt)
        ingredient = result.scalar_one_or_none()
        
        if not ingredient:
            raise NotFoundError(f"Ingredient with ID {ingredient_id} not found")
        
        return ingredient
    
    async def list_ingredients(
        self,
        user: Optional[AuthUser] = None,
        filters: Optional[IngredientFilter] = None,
        page: int = 1,
        page_size: int = 20,
        sort_by: str = "name",
        sort_order: str = "asc"
    ) -> Tuple[List[Ingredient], int]:
        """
        List ingredients with filtering, pagination, and sorting.
        
        Args:
            user: Current user (for access control)
            filters: Search and filter criteria
            page: Page number (1-based)
            page_size: Items per page
            sort_by: Field to sort by
            sort_order: Sort order (asc/desc)
            
        Returns:
            Tuple of (ingredients list, total count)
        """
        # Build base query
        stmt = select(Ingredient)
        
        # Apply filters
        conditions = []
        
        if filters:
            # Access control: user can see global ingredients and their own
            if user and not user.is_admin:
                conditions.append(
                    or_(
                        Ingredient.is_global == True,
                        Ingredient.user_id == user.id
                    )
                )
            
            # Text search
            if filters.query:
                search_term = f"%{filters.query}%"
                conditions.append(
                    or_(
                        Ingredient.name.ilike(search_term),
                        Ingredient.brand.ilike(search_term)
                    )
                )
            
            # Category filter
            if filters.category:
                conditions.append(Ingredient.category == filters.category)
            
            # Brand filter
            if filters.brand:
                conditions.append(Ingredient.brand.ilike(f"%{filters.brand}%"))
            
            # Barcode filter
            if filters.has_barcode is not None:
                if filters.has_barcode:
                    conditions.append(Ingredient.barcode.isnot(None))
                else:
                    conditions.append(Ingredient.barcode.is_(None))
            
            # Dietary flags filters
            if filters.vegan is not None:
                conditions.append(
                    Ingredient.dietary_flags['vegan'].astext.cast(bool) == filters.vegan
                )
            
            if filters.vegetarian is not None:
                conditions.append(
                    Ingredient.dietary_flags['vegetarian'].astext.cast(bool) == filters.vegetarian
                )
            
            if filters.gluten_free is not None:
                conditions.append(
                    Ingredient.dietary_flags['gluten_free'].astext.cast(bool) == filters.gluten_free
                )
            
            if filters.dairy_free is not None:
                conditions.append(
                    Ingredient.dietary_flags['dairy_free'].astext.cast(bool) == filters.dairy_free
                )
            
            # Allergen filter
            if filters.allergen:
                conditions.append(Ingredient.allergens.op('@>')([filters.allergen]))
            
            # Nutritional data filter
            if filters.has_nutritional_data is not None:
                if filters.has_nutritional_data:
                    conditions.append(Ingredient.nutritional_data.isnot(None))
                else:
                    conditions.append(Ingredient.nutritional_data.is_(None))
            
            # Global/user-specific filter
            if filters.is_global is not None:
                conditions.append(Ingredient.is_global == filters.is_global)
            
            # Archive status filter
            if not filters.is_archived:
                conditions.append(Ingredient.is_archived == False)
        else:
            # Default: exclude archived
            conditions.append(Ingredient.is_archived == False)
            
            # Access control for non-admin users
            if user and not user.is_admin:
                conditions.append(
                    or_(
                        Ingredient.is_global == True,
                        Ingredient.user_id == user.id
                    )
                )
        
        if conditions:
            stmt = stmt.where(and_(*conditions))
        
        # Get total count
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total_result = await self.db.execute(count_stmt)
        total = total_result.scalar()
        
        # Apply sorting
        sort_field = getattr(Ingredient, sort_by, Ingredient.name)
        if sort_order == "desc":
            stmt = stmt.order_by(desc(sort_field))
        else:
            stmt = stmt.order_by(asc(sort_field))
        
        # Apply pagination
        offset = (page - 1) * page_size
        stmt = stmt.offset(offset).limit(page_size)
        
        # Execute query
        result = await self.db.execute(stmt)
        ingredients = result.scalars().all()
        
        return ingredients, total
    
    async def update_ingredient(
        self,
        ingredient_id: UUID,
        update_data: IngredientUpdate,
        user: Optional[AuthUser] = None
    ) -> Ingredient:
        """
        Update an ingredient.
        
        Args:
            ingredient_id: Ingredient ID
            update_data: Update data
            user: Current user (for access control)
            
        Returns:
            Updated ingredient
            
        Raises:
            NotFoundError: If ingredient not found
            ValidationError: If data validation fails
        """
        ingredient = await self.get_ingredient(ingredient_id, user)
        
        # Check permissions: only admins can update global ingredients
        if ingredient.is_global and (not user or not user.is_admin):
            raise ValidationError("Only administrators can update global ingredients")
        
        # Check permissions: users can only update their own ingredients
        if not ingredient.is_global and ingredient.user_id != user.id and not user.is_admin:
            raise ValidationError("You can only update your own ingredients")
        
        # Validate nutritional data if provided
        if update_data.nutritional_data:
            await self._validate_nutritional_data(update_data.nutritional_data)
        
        # Update fields
        update_dict = update_data.model_dump(exclude_unset=True)
        for field, value in update_dict.items():
            if field == 'nutritional_data' and value:
                ingredient.nutritional_data = value
            elif field == 'unit_conversions' and value:
                ingredient.unit_conversions = value
            elif field == 'dietary_flags' and value:
                ingredient.dietary_flags = value
            elif hasattr(ingredient, field):
                setattr(ingredient, field, value)
        
        ingredient.updated_at = datetime.utcnow()
        
        await self.db.commit()
        await self.db.refresh(ingredient)
        
        logger.info(f"Updated ingredient: {ingredient.name} (ID: {ingredient.id})")
        return ingredient
    
    async def delete_ingredient(
        self,
        ingredient_id: UUID,
        user: Optional[AuthUser] = None,
        soft_delete: bool = True
    ) -> bool:
        """
        Delete an ingredient.
        
        Args:
            ingredient_id: Ingredient ID
            user: Current user (for access control)
            soft_delete: Whether to soft delete (archive) or hard delete
            
        Returns:
            Success status
            
        Raises:
            NotFoundError: If ingredient not found
            ValidationError: If ingredient is in use
        """
        ingredient = await self.get_ingredient(ingredient_id, user)
        
        # Check permissions
        if ingredient.is_global and (not user or not user.is_admin):
            raise ValidationError("Only administrators can delete global ingredients")
        
        if not ingredient.is_global and ingredient.user_id != user.id and not user.is_admin:
            raise ValidationError("You can only delete your own ingredients")
        
        # Check if ingredient is used in recipes
        # TODO: Implement recipe usage check
        
        if soft_delete:
            ingredient.is_archived = True
            ingredient.updated_at = datetime.utcnow()
            await self.db.commit()
            logger.info(f"Archived ingredient: {ingredient.name} (ID: {ingredient.id})")
        else:
            await self.db.delete(ingredient)
            await self.db.commit()
            logger.info(f"Deleted ingredient: {ingredient.name} (ID: {ingredient.id})")
        
        return True
    
    async def get_categories(self) -> List[str]:
        """
        Get all unique ingredient categories.
        
        Returns:
            List of category names
        """
        stmt = select(Ingredient.category).where(
            and_(
                Ingredient.category.isnot(None),
                Ingredient.is_archived == False
            )
        ).distinct()
        
        result = await self.db.execute(stmt)
        categories = [row[0] for row in result if row[0]]
        
        return sorted(categories)
    
    async def _validate_nutritional_data(self, nutritional_data: NutritionalData) -> None:
        """
        Validate nutritional data consistency.
        
        Args:
            nutritional_data: Nutritional data to validate
            
        Raises:
            ValidationError: If validation fails
        """
        # Calculate expected calories based on macronutrients
        calculated_calories = (
            nutritional_data.proteins * 4 +
            nutritional_data.carbs * 4 +
            nutritional_data.fats * 9
        )
        
        # Allow for 15% variance
        if abs(nutritional_data.calories - calculated_calories) > calculated_calories * 0.15:
            raise ValidationError(
                f"Calorie value {nutritional_data.calories} seems inconsistent with macronutrients "
                f"(calculated: {calculated_calories:.1f})"
            )
        
        # Validate sugar vs carbs
        if nutritional_data.sugars is not None and nutritional_data.sugars > nutritional_data.carbs:
            raise ValidationError("Sugars cannot exceed total carbohydrates")