"""
Ingredient management service for administrative operations.

This service provides comprehensive CRUD operations for managing ingredients,
including nutritional data, categories, bulk operations, and quality control.
"""

import csv
import json
import io
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any, Tuple, Set
from uuid import UUID
from decimal import Decimal

from sqlalchemy import select, func, and_, or_, desc, asc, update, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from fastapi import UploadFile

from jidelnicek.common.models.ingredient import Ingredient
from jidelnicek.admin.models import AdminAuditLog, AdminAction
from jidelnicek.auth.models import AuthUser
from jidelnicek.core.utils import get_utc_now
from jidelnicek.core.exceptions import ValidationError, NotFoundError, ConflictError


class IngredientManagementService:
    """Service for managing ingredients with admin capabilities."""
    
    # Supported units for conversions
    SUPPORTED_UNITS = {
        'g', 'kg', 'mg', 'l', 'ml', 'cup', 'tbsp', 'tsp', 'piece', 'oz', 'lb'
    }
    
    # Common allergens to track
    COMMON_ALLERGENS = {
        'gluten', 'dairy', 'eggs', 'soy', 'nuts', 'peanuts', 'fish', 
        'shellfish', 'sesame', 'celery', 'mustard', 'sulphites'
    }
    
    # Required nutritional fields
    REQUIRED_NUTRITION_FIELDS = {'calories', 'proteins', 'carbs', 'fats'}
    
    def __init__(self, db: AsyncSession, admin_user: AuthUser):
        """
        Initialize ingredient management service.
        
        Args:
            db: Database session
            admin_user: Admin user performing operations
        """
        self.db = db
        self.admin_user = admin_user
    
    async def create_ingredient(
        self,
        name: str,
        category: Optional[str] = None,
        brand: Optional[str] = None,
        barcode: Optional[str] = None,
        nutritional_data: Dict[str, Any] = None,
        unit_conversions: Dict[str, float] = None,
        allergens: List[str] = None,
        dietary_flags: Dict[str, bool] = None,
        is_global: bool = True,
        user_id: Optional[UUID] = None
    ) -> Ingredient:
        """
        Create a new ingredient with validation.
        
        Args:
            name: Ingredient name
            category: Ingredient category
            brand: Brand name (optional)
            barcode: Product barcode (optional)
            nutritional_data: Nutritional values per 100g
            unit_conversions: Unit conversion factors
            allergens: List of allergens
            dietary_flags: Dietary information
            is_global: Whether ingredient is globally available
            user_id: User ID for user-specific ingredients
            
        Returns:
            Created ingredient
            
        Raises:
            ValidationError: If validation fails
            ConflictError: If ingredient already exists
        """
        # Validate nutritional data
        if nutritional_data:
            self._validate_nutritional_data(nutritional_data)
        
        # Validate unit conversions
        if unit_conversions:
            self._validate_unit_conversions(unit_conversions)
        
        # Validate allergens
        if allergens:
            allergens = self._validate_allergens(allergens)
        
        # Check for duplicates
        await self._check_duplicate_ingredient(name, brand, barcode, user_id)
        
        # Create ingredient
        ingredient = Ingredient(
            name=name.strip(),
            category=category,
            brand=brand.strip() if brand else None,
            barcode=barcode.strip() if barcode else None,
            nutritional_data=nutritional_data or {},
            unit_conversions=unit_conversions or {},
            allergens=allergens or [],
            dietary_flags=dietary_flags or {},
            is_global=is_global,
            user_id=None if is_global else user_id
        )
        
        self.db.add(ingredient)
        await self.db.commit()
        await self.db.refresh(ingredient)
        
        # Log action
        await self._log_audit_action(
            AdminAction.DATA_IMPORT,
            'ingredient',
            ingredient.id,
            after_state={'name': name, 'is_global': is_global}
        )
        
        return ingredient
    
    async def update_ingredient(
        self,
        ingredient_id: UUID,
        **update_data: Any
    ) -> Ingredient:
        """
        Update an existing ingredient.
        
        Args:
            ingredient_id: Ingredient ID
            **update_data: Fields to update
            
        Returns:
            Updated ingredient
            
        Raises:
            NotFoundError: If ingredient not found
            ValidationError: If validation fails
        """
        # Get ingredient
        ingredient = await self.get_ingredient_by_id(ingredient_id)
        if not ingredient:
            raise NotFoundError(f"Ingredient {ingredient_id} not found")
        
        # Store before state for audit
        before_state = {
            'name': ingredient.name,
            'nutritional_data': ingredient.nutritional_data,
            'allergens': ingredient.allergens
        }
        
        # Validate and update fields
        if 'nutritional_data' in update_data:
            self._validate_nutritional_data(update_data['nutritional_data'])
        
        if 'unit_conversions' in update_data:
            self._validate_unit_conversions(update_data['unit_conversions'])
        
        if 'allergens' in update_data:
            update_data['allergens'] = self._validate_allergens(update_data['allergens'])
        
        # Update fields
        for field, value in update_data.items():
            if hasattr(ingredient, field):
                setattr(ingredient, field, value)
        
        ingredient.updated_at = get_utc_now()
        
        await self.db.commit()
        await self.db.refresh(ingredient)
        
        # Log action
        await self._log_audit_action(
            AdminAction.DATA_IMPORT,
            'ingredient',
            ingredient.id,
            before_state=before_state,
            after_state=update_data
        )
        
        return ingredient
    
    async def delete_ingredient(
        self,
        ingredient_id: UUID,
        force: bool = False
    ) -> bool:
        """
        Delete or archive an ingredient.
        
        Args:
            ingredient_id: Ingredient ID
            force: Force delete even if used in recipes
            
        Returns:
            Success status
            
        Raises:
            NotFoundError: If ingredient not found
            ConflictError: If ingredient is in use and force=False
        """
        ingredient = await self.get_ingredient_by_id(ingredient_id)
        if not ingredient:
            raise NotFoundError(f"Ingredient {ingredient_id} not found")
        
        # Check if ingredient is used in recipes
        if not force:
            recipe_count = await self._count_ingredient_usage(ingredient_id)
            if recipe_count > 0:
                raise ConflictError(
                    f"Ingredient is used in {recipe_count} recipes. "
                    "Use force=True to delete anyway."
                )
        
        if force:
            # Hard delete
            await self.db.delete(ingredient)
        else:
            # Soft delete (archive)
            ingredient.is_archived = True
            ingredient.updated_at = get_utc_now()
        
        await self.db.commit()
        
        # Log action
        await self._log_audit_action(
            AdminAction.DATA_CLEANUP if force else AdminAction.USER_DELETE,
            'ingredient',
            ingredient_id,
            metadata={'force': force, 'archived': not force}
        )
        
        return True
    
    async def get_ingredient_by_id(self, ingredient_id: UUID) -> Optional[Ingredient]:
        """Get ingredient by ID."""
        result = await self.db.execute(
            select(Ingredient).where(Ingredient.id == ingredient_id)
        )
        return result.scalar_one_or_none()
    
    async def search_ingredients(
        self,
        query: Optional[str] = None,
        category: Optional[str] = None,
        brand: Optional[str] = None,
        allergens: Optional[List[str]] = None,
        dietary_flags: Optional[Dict[str, bool]] = None,
        is_global: Optional[bool] = None,
        is_archived: bool = False,
        user_id: Optional[UUID] = None,
        page: int = 1,
        per_page: int = 50,
        sort_by: str = 'name',
        sort_order: str = 'asc'
    ) -> Tuple[List[Ingredient], int]:
        """
        Search ingredients with filters and pagination.
        
        Args:
            query: Search query for name/brand
            category: Filter by category
            brand: Filter by brand
            allergens: Filter by allergens (any match)
            dietary_flags: Filter by dietary flags
            is_global: Filter by global/user-specific
            is_archived: Include archived ingredients
            user_id: Filter by user ID
            page: Page number (1-based)
            per_page: Items per page
            sort_by: Sort field
            sort_order: Sort order (asc/desc)
            
        Returns:
            Tuple of (ingredients, total_count)
        """
        # Build base query
        stmt = select(Ingredient)
        
        # Apply filters
        conditions = []
        
        if query:
            search_term = f"%{query}%"
            conditions.append(
                or_(
                    Ingredient.name.ilike(search_term),
                    Ingredient.brand.ilike(search_term),
                    Ingredient.barcode == query
                )
            )
        
        if category:
            conditions.append(Ingredient.category == category)
        
        if brand:
            conditions.append(Ingredient.brand == brand)
        
        if allergens:
            # Check if any of the specified allergens are present
            for allergen in allergens:
                conditions.append(Ingredient.allergens.contains([allergen]))
        
        if dietary_flags:
            # Check dietary flags
            for flag, value in dietary_flags.items():
                conditions.append(
                    Ingredient.dietary_flags[flag].astext.cast(func.bool) == value
                )
        
        if is_global is not None:
            conditions.append(Ingredient.is_global == is_global)
        
        if not is_archived:
            conditions.append(Ingredient.is_archived == False)
        
        if user_id:
            conditions.append(
                or_(
                    Ingredient.user_id == user_id,
                    Ingredient.is_global == True
                )
            )
        
        if conditions:
            stmt = stmt.where(and_(*conditions))
        
        # Get total count
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total_result = await self.db.execute(count_stmt)
        total_count = total_result.scalar() or 0
        
        # Apply sorting
        sort_column = getattr(Ingredient, sort_by, Ingredient.name)
        if sort_order == 'desc':
            stmt = stmt.order_by(desc(sort_column))
        else:
            stmt = stmt.order_by(asc(sort_column))
        
        # Apply pagination
        offset = (page - 1) * per_page
        stmt = stmt.offset(offset).limit(per_page)
        
        # Execute query
        result = await self.db.execute(stmt)
        ingredients = list(result.scalars().all())
        
        return ingredients, total_count
    
    async def get_categories(self) -> List[str]:
        """Get all unique ingredient categories."""
        result = await self.db.execute(
            select(Ingredient.category)
            .where(Ingredient.category.isnot(None))
            .distinct()
            .order_by(Ingredient.category)
        )
        return [row[0] for row in result.all()]
    
    async def bulk_import_csv(
        self,
        file: UploadFile,
        is_global: bool = True,
        user_id: Optional[UUID] = None
    ) -> Dict[str, Any]:
        """
        Import ingredients from CSV file.
        
        Expected CSV format:
        name,brand,barcode,category,calories,proteins,carbs,fats,allergens
        
        Args:
            file: CSV file upload
            is_global: Import as global ingredients
            user_id: User ID for user-specific imports
            
        Returns:
            Import results with success/failure counts
        """
        content = await file.read()
        text_content = content.decode('utf-8')
        csv_reader = csv.DictReader(io.StringIO(text_content))
        
        results = {
            'total': 0,
            'success': 0,
            'failed': 0,
            'errors': []
        }
        
        for row_num, row in enumerate(csv_reader, start=2):  # Start at 2 (header is row 1)
            results['total'] += 1
            
            try:
                # Parse nutritional data
                nutritional_data = {
                    'calories': float(row.get('calories', 0)),
                    'proteins': float(row.get('proteins', 0)),
                    'carbs': float(row.get('carbs', 0)),
                    'fats': float(row.get('fats', 0))
                }
                
                # Parse allergens
                allergens = []
                if row.get('allergens'):
                    allergens = [a.strip() for a in row['allergens'].split(',')]
                
                # Create ingredient
                await self.create_ingredient(
                    name=row['name'],
                    brand=row.get('brand'),
                    barcode=row.get('barcode'),
                    category=row.get('category'),
                    nutritional_data=nutritional_data,
                    allergens=allergens,
                    is_global=is_global,
                    user_id=user_id
                )
                
                results['success'] += 1
                
            except Exception as e:
                results['failed'] += 1
                results['errors'].append({
                    'row': row_num,
                    'name': row.get('name', 'Unknown'),
                    'error': str(e)
                })
        
        # Log bulk import
        await self._log_audit_action(
            AdminAction.DATA_IMPORT,
            'ingredient_bulk',
            None,
            metadata=results
        )
        
        return results
    
    async def bulk_export(
        self,
        format: str = 'csv',
        filters: Optional[Dict[str, Any]] = None
    ) -> bytes:
        """
        Export ingredients in specified format.
        
        Args:
            format: Export format (csv, json)
            filters: Optional filters to apply
            
        Returns:
            Export data as bytes
        """
        # Get ingredients with filters
        ingredients, _ = await self.search_ingredients(
            **(filters or {}),
            per_page=10000  # Export all matching
        )
        
        if format == 'json':
            return await self._export_json(ingredients)
        else:  # csv
            return await self._export_csv(ingredients)
    
    async def merge_ingredients(
        self,
        source_id: UUID,
        target_id: UUID,
        update_recipes: bool = True
    ) -> Ingredient:
        """
        Merge two ingredients, combining their data.
        
        Args:
            source_id: Source ingredient to merge from
            target_id: Target ingredient to merge into
            update_recipes: Update recipes to use target ingredient
            
        Returns:
            Merged ingredient
        """
        source = await self.get_ingredient_by_id(source_id)
        target = await self.get_ingredient_by_id(target_id)
        
        if not source or not target:
            raise NotFoundError("Source or target ingredient not found")
        
        # Merge data
        # Combine allergens
        target.allergens = list(set(target.allergens or []) | set(source.allergens or []))
        
        # Merge nutritional data (prefer target unless missing)
        if source.nutritional_data:
            target.nutritional_data = {
                **source.nutritional_data,
                **target.nutritional_data
            }
        
        # Merge unit conversions
        if source.unit_conversions:
            target.unit_conversions = {
                **source.unit_conversions,
                **target.unit_conversions
            }
        
        # Update recipes if requested
        if update_recipes:
            await self._update_recipe_ingredients(source_id, target_id)
        
        # Delete source ingredient
        await self.db.delete(source)
        
        await self.db.commit()
        await self.db.refresh(target)
        
        # Log action
        await self._log_audit_action(
            AdminAction.DATA_IMPORT,
            'ingredient_merge',
            target_id,
            metadata={
                'source_id': str(source_id),
                'source_name': source.name
            }
        )
        
        return target
    
    async def validate_ingredient_quality(
        self,
        ingredient_id: UUID
    ) -> Dict[str, Any]:
        """
        Validate ingredient data quality.
        
        Args:
            ingredient_id: Ingredient ID to validate
            
        Returns:
            Validation results with quality score
        """
        ingredient = await self.get_ingredient_by_id(ingredient_id)
        if not ingredient:
            raise NotFoundError(f"Ingredient {ingredient_id} not found")
        
        issues = []
        score = 100
        
        # Check nutritional data
        if not ingredient.nutritional_data:
            issues.append("Missing nutritional data")
            score -= 20
        else:
            missing_fields = self.REQUIRED_NUTRITION_FIELDS - set(ingredient.nutritional_data.keys())
            if missing_fields:
                issues.append(f"Missing nutritional fields: {', '.join(missing_fields)}")
                score -= 10 * len(missing_fields)
        
        # Check category
        if not ingredient.category:
            issues.append("Missing category")
            score -= 10
        
        # Check allergens
        if not ingredient.allergens:
            issues.append("No allergen information")
            score -= 5
        
        # Check unit conversions
        if not ingredient.unit_conversions:
            issues.append("No unit conversions defined")
            score -= 10
        
        # Check dietary flags
        if not ingredient.dietary_flags:
            issues.append("No dietary flags set")
            score -= 5
        
        return {
            'ingredient_id': str(ingredient_id),
            'name': ingredient.name,
            'quality_score': max(0, score),
            'issues': issues,
            'is_complete': len(issues) == 0
        }
    
    async def get_usage_statistics(
        self,
        ingredient_id: UUID
    ) -> Dict[str, Any]:
        """
        Get usage statistics for an ingredient.
        
        Args:
            ingredient_id: Ingredient ID
            
        Returns:
            Usage statistics
        """
        ingredient = await self.get_ingredient_by_id(ingredient_id)
        if not ingredient:
            raise NotFoundError(f"Ingredient {ingredient_id} not found")
        
        # Count recipe usage
        recipe_count = await self._count_ingredient_usage(ingredient_id)
        
        # Get recent usage
        recent_usage = await self._get_recent_usage(ingredient_id, limit=10)
        
        return {
            'ingredient_id': str(ingredient_id),
            'name': ingredient.name,
            'total_recipes': recipe_count,
            'recent_usage': recent_usage,
            'created_at': ingredient.created_at,
            'updated_at': ingredient.updated_at
        }
    
    # Private helper methods
    
    def _validate_nutritional_data(self, data: Dict[str, Any]) -> None:
        """Validate nutritional data structure and values."""
        for field in self.REQUIRED_NUTRITION_FIELDS:
            if field not in data:
                raise ValidationError(f"Missing required nutritional field: {field}")
            
            value = data[field]
            if not isinstance(value, (int, float)) or value < 0:
                raise ValidationError(f"Invalid value for {field}: must be non-negative number")
        
        # Validate macro totals (allow some tolerance for rounding)
        macro_total = data.get('proteins', 0) + data.get('carbs', 0) + data.get('fats', 0)
        if macro_total > 100.5:  # Allow 0.5g tolerance
            raise ValidationError("Macro nutrients cannot exceed 100g per 100g")
    
    def _validate_unit_conversions(self, conversions: Dict[str, float]) -> None:
        """Validate unit conversion factors."""
        for unit, factor in conversions.items():
            if not isinstance(factor, (int, float)) or factor <= 0:
                raise ValidationError(f"Invalid conversion factor for {unit}: must be positive number")
    
    def _validate_allergens(self, allergens: List[str]) -> List[str]:
        """Validate and normalize allergen list."""
        normalized = []
        for allergen in allergens:
            normalized_allergen = allergen.lower().strip()
            if normalized_allergen:
                normalized.append(normalized_allergen)
        return list(set(normalized))  # Remove duplicates
    
    async def _check_duplicate_ingredient(
        self,
        name: str,
        brand: Optional[str],
        barcode: Optional[str],
        user_id: Optional[UUID]
    ) -> None:
        """Check for duplicate ingredients."""
        conditions = []
        
        # Check by name and brand
        conditions.append(
            and_(
                Ingredient.name == name,
                Ingredient.brand == brand,
                or_(
                    Ingredient.user_id == user_id,
                    Ingredient.is_global == True
                )
            )
        )
        
        # Check by barcode if provided
        if barcode:
            conditions.append(Ingredient.barcode == barcode)
        
        stmt = select(Ingredient).where(or_(*conditions))
        result = await self.db.execute(stmt)
        
        if result.scalar_one_or_none():
            raise ConflictError(f"Ingredient already exists: {name} {brand or ''}")
    
    async def _count_ingredient_usage(self, ingredient_id: UUID) -> int:
        """Count how many recipes use this ingredient."""
        # Import here to avoid circular dependency
        from jidelnicek.recipe.models import RecipeIngredient
        
        result = await self.db.execute(
            select(func.count(RecipeIngredient.id))
            .where(RecipeIngredient.ingredient_id == ingredient_id)
        )
        return result.scalar() or 0
    
    async def _get_recent_usage(
        self,
        ingredient_id: UUID,
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        """Get recent recipe usage for an ingredient."""
        # Import here to avoid circular dependency
        from jidelnicek.recipe.models import RecipeIngredient, Recipe
        
        stmt = (
            select(Recipe.id, Recipe.title, Recipe.created_at)
            .join(RecipeIngredient)
            .where(RecipeIngredient.ingredient_id == ingredient_id)
            .order_by(desc(Recipe.created_at))
            .limit(limit)
        )
        
        result = await self.db.execute(stmt)
        return [
            {
                'recipe_id': str(row.id),
                'recipe_title': row.title,
                'created_at': row.created_at
            }
            for row in result.all()
        ]
    
    async def _update_recipe_ingredients(
        self,
        source_id: UUID,
        target_id: UUID
    ) -> None:
        """Update all recipe ingredients from source to target."""
        # Import here to avoid circular dependency
        from jidelnicek.recipe.models import RecipeIngredient
        
        stmt = (
            update(RecipeIngredient)
            .where(RecipeIngredient.ingredient_id == source_id)
            .values(ingredient_id=target_id)
        )
        await self.db.execute(stmt)
    
    async def _export_csv(self, ingredients: List[Ingredient]) -> bytes:
        """Export ingredients as CSV."""
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Write header
        writer.writerow([
            'name', 'brand', 'barcode', 'category',
            'calories', 'proteins', 'carbs', 'fats', 'fiber', 'sodium',
            'allergens', 'vegan', 'gluten_free', 'is_global'
        ])
        
        # Write data
        for ing in ingredients:
            nutrition = ing.nutritional_data or {}
            dietary = ing.dietary_flags or {}
            
            writer.writerow([
                ing.name,
                ing.brand or '',
                ing.barcode or '',
                ing.category or '',
                nutrition.get('calories', ''),
                nutrition.get('proteins', ''),
                nutrition.get('carbs', ''),
                nutrition.get('fats', ''),
                nutrition.get('fiber', ''),
                nutrition.get('sodium', ''),
                ','.join(ing.allergens or []),
                dietary.get('vegan', ''),
                dietary.get('gluten_free', ''),
                ing.is_global
            ])
        
        return output.getvalue().encode('utf-8')
    
    async def _export_json(self, ingredients: List[Ingredient]) -> bytes:
        """Export ingredients as JSON."""
        data = []
        for ing in ingredients:
            data.append({
                'id': str(ing.id),
                'name': ing.name,
                'brand': ing.brand,
                'barcode': ing.barcode,
                'category': ing.category,
                'nutritional_data': ing.nutritional_data,
                'unit_conversions': ing.unit_conversions,
                'allergens': ing.allergens,
                'dietary_flags': ing.dietary_flags,
                'is_global': ing.is_global,
                'created_at': ing.created_at.isoformat(),
                'updated_at': ing.updated_at.isoformat()
            })
        
        return json.dumps(data, indent=2).encode('utf-8')
    
    async def _log_audit_action(
        self,
        action: AdminAction,
        target_type: str,
        target_id: Optional[UUID],
        before_state: Optional[Dict[str, Any]] = None,
        after_state: Optional[Dict[str, Any]] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> None:
        """Log an admin action to the audit log."""
        audit_entry = AdminAuditLog(
            admin_id=self.admin_user.id,
            action=action,
            target_type=target_type,
            target_id=target_id,
            before_state=before_state,
            after_state=after_state,
            metadata=metadata,
            success=True,
            created_at=get_utc_now()
        )
        
        self.db.add(audit_entry)
        await self.db.commit()