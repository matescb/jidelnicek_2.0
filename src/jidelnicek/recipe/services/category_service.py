"""
Category service for Jidelnicek 2.0 recipe management system.

This module provides business logic for category management including
CRUD operations, hierarchical operations, and recipe categorization.
"""

from datetime import datetime, timezone
from typing import Optional, List, Dict, Any, Tuple
from uuid import UUID

from sqlalchemy import select, func, and_, or_, update, delete, case, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload, joinedload

from jidelnicek.recipe.models import Category, RecipeCategory, Recipe
from jidelnicek.recipe.exceptions import (
    RecipeNotFoundError, RecipeValidationError
)
from jidelnicek.core.exceptions import NotFoundError, ConflictError, ValidationError


class CategoryService:
    """Service class for category management operations."""
    
    def __init__(self, session: AsyncSession):
        """
        Initialize category service.
        
        Args:
            session: AsyncSession instance for database operations
        """
        self.session = session
    
    async def create_category(
        self,
        name: str,
        slug: str,
        parent_id: Optional[UUID] = None,
        description: Optional[str] = None,
        icon: Optional[str] = None,
        display_order: int = 0
    ) -> Category:
        """
        Create a new category.
        
        Args:
            name: Category name
            slug: URL-friendly identifier
            parent_id: Optional parent category ID
            description: Optional category description
            icon: Optional icon name or emoji
            display_order: Display order within siblings
            
        Returns:
            Created category instance
            
        Raises:
            ConflictError: If slug already exists
            NotFoundError: If parent_id doesn't exist
            ValidationError: If validation fails
        """
        # Check if slug already exists
        existing = await self.session.execute(
            select(Category).where(Category.slug == slug)
        )
        if existing.scalar_one_or_none():
            raise ConflictError(f"Category with slug '{slug}' already exists")
        
        # Validate parent exists if provided
        if parent_id:
            parent = await self.get_category(parent_id)
            if not parent:
                raise NotFoundError(f"Parent category {parent_id} not found")
        
        # Create category
        category = Category(
            name=name,
            slug=slug,
            parent_id=parent_id,
            description=description,
            icon=icon,
            display_order=display_order
        )
        
        try:
            self.session.add(category)
            await self.session.commit()
            await self.session.refresh(category)
            return category
        except IntegrityError as e:
            await self.session.rollback()
            raise ValidationError(f"Failed to create category: {str(e)}")
    
    async def get_category(
        self,
        category_id: UUID,
        include_children: bool = False,
        include_parent: bool = False
    ) -> Optional[Category]:
        """
        Get a category by ID.
        
        Args:
            category_id: Category ID
            include_children: Whether to include child categories
            include_parent: Whether to include parent category
            
        Returns:
            Category instance if found, None otherwise
        """
        query = select(Category).where(Category.id == category_id)
        
        options = []
        if include_children:
            options.append(selectinload(Category.children))
        if include_parent:
            options.append(selectinload(Category.parent))
        
        if options:
            query = query.options(*options)
        
        result = await self.session.execute(query)
        return result.scalar_one_or_none()
    
    async def get_category_by_slug(self, slug: str) -> Optional[Category]:
        """
        Get a category by slug.
        
        Args:
            slug: Category slug
            
        Returns:
            Category instance if found, None otherwise
        """
        result = await self.session.execute(
            select(Category).where(Category.slug == slug)
        )
        return result.scalar_one_or_none()
    
    async def update_category(
        self,
        category_id: UUID,
        name: Optional[str] = None,
        slug: Optional[str] = None,
        description: Optional[str] = None,
        icon: Optional[str] = None,
        display_order: Optional[int] = None
    ) -> Category:
        """
        Update a category.
        
        Args:
            category_id: Category ID to update
            name: Optional new name
            slug: Optional new slug
            description: Optional new description
            icon: Optional new icon
            display_order: Optional new display order
            
        Returns:
            Updated category instance
            
        Raises:
            NotFoundError: If category not found
            ConflictError: If new slug already exists
            ValidationError: If validation fails
        """
        category = await self.get_category(category_id)
        if not category:
            raise NotFoundError(f"Category {category_id} not found")
        
        # Check slug uniqueness if changing
        if slug and slug != category.slug:
            existing = await self.session.execute(
                select(Category).where(
                    and_(
                        Category.slug == slug,
                        Category.id != category_id
                    )
                )
            )
            if existing.scalar_one_or_none():
                raise ConflictError(f"Category with slug '{slug}' already exists")
        
        # Update fields
        if name is not None:
            category.name = name
        if slug is not None:
            category.slug = slug
        if description is not None:
            category.description = description
        if icon is not None:
            category.icon = icon
        if display_order is not None:
            category.display_order = display_order
        
        try:
            await self.session.commit()
            await self.session.refresh(category)
            return category
        except IntegrityError as e:
            await self.session.rollback()
            raise ValidationError(f"Failed to update category: {str(e)}")
    
    async def delete_category(
        self,
        category_id: UUID,
        force: bool = False
    ) -> bool:
        """
        Delete a category.
        
        Args:
            category_id: Category ID to delete
            force: If True, delete even if has children or recipes
            
        Returns:
            True if deleted successfully
            
        Raises:
            NotFoundError: If category not found
            ConflictError: If category has children or recipes and force=False
        """
        category = await self.get_category(category_id, include_children=True)
        if not category:
            raise NotFoundError(f"Category {category_id} not found")
        
        # Check for children
        if not force and category.children:
            raise ConflictError("Cannot delete category with children")
        
        # Check for recipes
        if not force:
            recipe_count = await self.session.execute(
                select(func.count(RecipeCategory.recipe_id))
                .where(RecipeCategory.category_id == category_id)
            )
            if recipe_count.scalar() > 0:
                raise ConflictError("Cannot delete category with recipes")
        
        await self.session.delete(category)
        await self.session.commit()
        return True
    
    async def get_category_tree(
        self,
        parent_id: Optional[UUID] = None,
        max_depth: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """
        Get category tree/hierarchy.
        
        Args:
            parent_id: Optional parent ID to start from (None for root)
            max_depth: Maximum depth to traverse
            
        Returns:
            List of category trees with nested children
        """
        # Get categories with their children
        query = select(Category).options(selectinload(Category.children))
        
        if parent_id is None:
            query = query.where(Category.parent_id.is_(None))
        else:
            query = query.where(Category.parent_id == parent_id)
        
        query = query.order_by(Category.display_order, Category.name)
        
        result = await self.session.execute(query)
        categories = result.scalars().unique().all()
        
        return [
            self._build_category_tree(cat, current_depth=1, max_depth=max_depth)
            for cat in categories
        ]
    
    def _build_category_tree(
        self,
        category: Category,
        current_depth: int = 1,
        max_depth: Optional[int] = None
    ) -> Dict[str, Any]:
        """Build category tree recursively."""
        tree = {
            "id": str(category.id),
            "name": category.name,
            "slug": category.slug,
            "description": category.description,
            "icon": category.icon,
            "display_order": category.display_order,
            "level": current_depth - 1,
            "children": []
        }
        
        if max_depth is None or current_depth < max_depth:
            tree["children"] = [
                self._build_category_tree(child, current_depth + 1, max_depth)
                for child in sorted(category.children, key=lambda c: (c.display_order, c.name))
            ]
        
        return tree
    
    async def get_category_breadcrumbs(self, category_id: UUID) -> List[Dict[str, str]]:
        """
        Get category breadcrumbs from root to specified category.
        
        Args:
            category_id: Category ID
            
        Returns:
            List of breadcrumb items with id, name, and slug
            
        Raises:
            NotFoundError: If category not found
        """
        # Use recursive CTE to get path from root to category
        cte_query = """
        WITH RECURSIVE category_path AS (
            SELECT id, name, slug, parent_id, 0 as level
            FROM recipe_categories
            WHERE id = :category_id
            
            UNION ALL
            
            SELECT c.id, c.name, c.slug, c.parent_id, cp.level + 1
            FROM recipe_categories c
            JOIN category_path cp ON c.id = cp.parent_id
        )
        SELECT id, name, slug
        FROM category_path
        ORDER BY level DESC;
        """
        
        result = await self.session.execute(
            text(cte_query),
            {"category_id": category_id}
        )
        
        breadcrumbs = [
            {
                "id": str(row.id),
                "name": row.name,
                "slug": row.slug
            }
            for row in result
        ]
        
        if not breadcrumbs:
            raise NotFoundError(f"Category {category_id} not found")
        
        return breadcrumbs
    
    async def move_category(
        self,
        category_id: UUID,
        new_parent_id: Optional[UUID] = None
    ) -> Category:
        """
        Move category to a new parent.
        
        Args:
            category_id: Category ID to move
            new_parent_id: New parent ID (None for root)
            
        Returns:
            Updated category
            
        Raises:
            NotFoundError: If category or new parent not found
            ValidationError: If move would create circular reference
        """
        category = await self.get_category(category_id)
        if not category:
            raise NotFoundError(f"Category {category_id} not found")
        
        # Validate new parent if provided
        if new_parent_id:
            new_parent = await self.get_category(new_parent_id)
            if not new_parent:
                raise NotFoundError(f"New parent category {new_parent_id} not found")
            
            # Check for circular reference
            if await self._would_create_cycle(category_id, new_parent_id):
                raise ValidationError("Cannot move category to its own descendant")
        
        category.parent_id = new_parent_id
        
        try:
            await self.session.commit()
            await self.session.refresh(category)
            return category
        except IntegrityError as e:
            await self.session.rollback()
            raise ValidationError(f"Failed to move category: {str(e)}")
    
    async def _would_create_cycle(
        self,
        category_id: UUID,
        proposed_parent_id: UUID
    ) -> bool:
        """Check if moving category would create a cycle."""
        current = await self.get_category(proposed_parent_id)
        
        while current:
            if current.id == category_id:
                return True
            current = await self.get_category(current.parent_id) if current.parent_id else None
        
        return False
    
    async def get_recipes_by_category(
        self,
        category_id: UUID,
        include_subcategories: bool = False,
        limit: int = 20,
        offset: int = 0
    ) -> Tuple[List[Recipe], int]:
        """
        Get recipes in a category.
        
        Args:
            category_id: Category ID
            include_subcategories: Whether to include recipes from subcategories
            limit: Maximum number of recipes
            offset: Number of recipes to skip
            
        Returns:
            Tuple of (recipes, total_count)
            
        Raises:
            NotFoundError: If category not found
        """
        category = await self.get_category(category_id)
        if not category:
            raise NotFoundError(f"Category {category_id} not found")
        
        category_ids = [category_id]
        
        # Get subcategory IDs if requested
        if include_subcategories:
            subcategory_ids = await self._get_all_subcategory_ids(category_id)
            category_ids.extend(subcategory_ids)
        
        # Get recipes
        query = (
            select(Recipe)
            .join(RecipeCategory)
            .where(
                and_(
                    RecipeCategory.category_id.in_(category_ids),
                    Recipe.is_published == True
                )
            )
            .distinct()
            .order_by(Recipe.created_at.desc())
        )
        
        # Get count
        count_query = (
            select(func.count(Recipe.id))
            .join(RecipeCategory)
            .where(
                and_(
                    RecipeCategory.category_id.in_(category_ids),
                    Recipe.is_published == True
                )
            )
            .distinct()
        )
        
        total_result = await self.session.execute(count_query)
        total_count = total_result.scalar() or 0
        
        # Get recipes with pagination
        query = query.limit(limit).offset(offset)
        result = await self.session.execute(query)
        recipes = result.scalars().unique().all()
        
        return recipes, total_count
    
    async def _get_all_subcategory_ids(self, category_id: UUID) -> List[UUID]:
        """Get all subcategory IDs recursively."""
        cte_query = """
        WITH RECURSIVE subcategories AS (
            SELECT id
            FROM recipe_categories
            WHERE parent_id = :category_id
            
            UNION ALL
            
            SELECT c.id
            FROM recipe_categories c
            JOIN subcategories s ON c.parent_id = s.id
        )
        SELECT id FROM subcategories;
        """
        
        result = await self.session.execute(
            text(cte_query),
            {"category_id": category_id}
        )
        
        return [row.id for row in result]
    
    async def list_categories(
        self,
        parent_id: Optional[UUID] = None,
        search: Optional[str] = None,
        limit: int = 100,
        offset: int = 0
    ) -> Tuple[List[Category], int]:
        """
        List categories with optional filtering.
        
        Args:
            parent_id: Filter by parent ID
            search: Search term for name
            limit: Maximum number of results
            offset: Number of results to skip
            
        Returns:
            Tuple of (categories, total_count)
        """
        query = select(Category)
        count_query = select(func.count(Category.id))
        
        conditions = []
        
        if parent_id is not None:
            conditions.append(Category.parent_id == parent_id)
        
        if search:
            conditions.append(
                or_(
                    Category.name.ilike(f"%{search}%"),
                    Category.description.ilike(f"%{search}%")
                )
            )
        
        if conditions:
            query = query.where(and_(*conditions))
            count_query = count_query.where(and_(*conditions))
        
        # Get count
        total_result = await self.session.execute(count_query)
        total_count = total_result.scalar() or 0
        
        # Get categories
        query = query.order_by(Category.display_order, Category.name)
        query = query.limit(limit).offset(offset)
        
        result = await self.session.execute(query)
        categories = result.scalars().all()
        
        return categories, total_count