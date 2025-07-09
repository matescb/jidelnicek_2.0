"""
Tests for CategoryService.

This module tests the business logic for category management including:
- CRUD operations for categories
- Hierarchical operations (tree, breadcrumbs)
- Category movements and circular reference validation
- Recipe listing by category
- Search and filtering
"""

import pytest
import pytest_asyncio
from uuid import uuid4
from typing import List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError

from jidelnicek.recipe.services.category_service import CategoryService
from jidelnicek.recipe.models import Category, Recipe, RecipeCategory
from jidelnicek.auth.models import AuthUser
from jidelnicek.core.exceptions import NotFoundError, ConflictError, ValidationError


class TestCategoryService:
    """Test suite for CategoryService."""
    
    @pytest_asyncio.fixture
    async def service(self, db_session: AsyncSession) -> CategoryService:
        """Create CategoryService instance."""
        return CategoryService(db_session)
    
    @pytest_asyncio.fixture
    async def test_user(self, db_session: AsyncSession) -> AuthUser:
        """Create a test user."""
        user = AuthUser(
            email="test@example.com",
            password_hash="dummy_hash",
            email_verified=True,
            language="en",
            unit_system="metric",
            energy_unit="kcal",
            has_pku=False,
            timezone="Europe/Prague",
            role="user",
            is_active=True
        )
        db_session.add(user)
        await db_session.commit()
        await db_session.refresh(user)
        return user
    
    @pytest_asyncio.fixture
    async def sample_categories(self, db_session: AsyncSession, service: CategoryService) -> List[Category]:
        """Create sample category hierarchy."""
        # Create root categories
        recipes = await service.create_category(
            name="Recipes",
            slug="recipes",
            description="All recipes",
            icon="📚",
            display_order=1
        )
        
        # Create subcategories
        main_dishes = await service.create_category(
            name="Main Dishes",
            slug="main-dishes",
            parent_id=recipes.id,
            description="Primary meal categories",
            icon="🍽️",
            display_order=1
        )
        
        desserts = await service.create_category(
            name="Desserts",
            slug="desserts",
            parent_id=recipes.id,
            description="Sweet treats",
            icon="🍰",
            display_order=2
        )
        
        # Create sub-subcategories
        pasta = await service.create_category(
            name="Pasta",
            slug="pasta",
            parent_id=main_dishes.id,
            description="Pasta dishes",
            icon="🍝",
            display_order=1
        )
        
        cakes = await service.create_category(
            name="Cakes",
            slug="cakes",
            parent_id=desserts.id,
            description="Various cakes",
            icon="🎂",
            display_order=1
        )
        
        return [recipes, main_dishes, desserts, pasta, cakes]
    
    @pytest.mark.asyncio
    async def test_create_category_success(self, service: CategoryService):
        """Test successful category creation."""
        category = await service.create_category(
            name="Breakfast",
            slug="breakfast",
            description="Morning meals",
            icon="🌅",
            display_order=1
        )
        
        assert category.id is not None
        assert category.name == "Breakfast"
        assert category.slug == "breakfast"
        assert category.description == "Morning meals"
        assert category.icon == "🌅"
        assert category.display_order == 1
        assert category.parent_id is None
    
    @pytest.mark.asyncio
    async def test_create_category_with_parent(
        self,
        service: CategoryService,
        sample_categories: List[Category]
    ):
        """Test creating category with parent."""
        parent = sample_categories[0]  # Recipes
        
        child = await service.create_category(
            name="Appetizers",
            slug="appetizers",
            parent_id=parent.id,
            description="Starters and snacks"
        )
        
        assert child.parent_id == parent.id
    
    @pytest.mark.asyncio
    async def test_create_category_duplicate_slug(self, service: CategoryService):
        """Test creating category with duplicate slug."""
        await service.create_category(
            name="Test Category",
            slug="test-slug"
        )
        
        with pytest.raises(ConflictError) as exc_info:
            await service.create_category(
                name="Another Category",
                slug="test-slug"
            )
        
        assert "already exists" in str(exc_info.value)
    
    @pytest.mark.asyncio
    async def test_create_category_invalid_parent(self, service: CategoryService):
        """Test creating category with non-existent parent."""
        fake_parent_id = uuid4()
        
        with pytest.raises(NotFoundError) as exc_info:
            await service.create_category(
                name="Test",
                slug="test",
                parent_id=fake_parent_id
            )
        
        assert f"Parent category {fake_parent_id} not found" in str(exc_info.value)
    
    @pytest.mark.asyncio
    async def test_get_category(
        self,
        service: CategoryService,
        sample_categories: List[Category]
    ):
        """Test getting category by ID."""
        category = sample_categories[1]  # Main Dishes
        
        # Test basic retrieval
        retrieved = await service.get_category(category.id)
        assert retrieved is not None
        assert retrieved.id == category.id
        assert retrieved.name == category.name
        
        # Test with children included
        retrieved_with_children = await service.get_category(
            category.id,
            include_children=True
        )
        assert len(retrieved_with_children.children) > 0
        
        # Test with parent included
        retrieved_with_parent = await service.get_category(
            category.id,
            include_parent=True
        )
        assert retrieved_with_parent.parent is not None
    
    @pytest.mark.asyncio
    async def test_get_category_not_found(self, service: CategoryService):
        """Test getting non-existent category."""
        fake_id = uuid4()
        result = await service.get_category(fake_id)
        assert result is None
    
    @pytest.mark.asyncio
    async def test_get_category_by_slug(
        self,
        service: CategoryService,
        sample_categories: List[Category]
    ):
        """Test getting category by slug."""
        category = await service.get_category_by_slug("main-dishes")
        assert category is not None
        assert category.name == "Main Dishes"
        
        # Test non-existent slug
        result = await service.get_category_by_slug("non-existent")
        assert result is None
    
    @pytest.mark.asyncio
    async def test_update_category(
        self,
        service: CategoryService,
        sample_categories: List[Category]
    ):
        """Test updating category."""
        category = sample_categories[1]  # Main Dishes
        
        updated = await service.update_category(
            category_id=category.id,
            name="Updated Main Dishes",
            description="Updated description",
            icon="🍖",
            display_order=5
        )
        
        assert updated.name == "Updated Main Dishes"
        assert updated.description == "Updated description"
        assert updated.icon == "🍖"
        assert updated.display_order == 5
        assert updated.slug == "main-dishes"  # Unchanged
    
    @pytest.mark.asyncio
    async def test_update_category_slug(
        self,
        service: CategoryService,
        sample_categories: List[Category]
    ):
        """Test updating category slug."""
        category = sample_categories[2]  # Desserts
        
        updated = await service.update_category(
            category_id=category.id,
            slug="sweet-treats"
        )
        
        assert updated.slug == "sweet-treats"
    
    @pytest.mark.asyncio
    async def test_update_category_duplicate_slug(
        self,
        service: CategoryService,
        sample_categories: List[Category]
    ):
        """Test updating category with duplicate slug."""
        category1 = sample_categories[1]  # Main Dishes
        category2 = sample_categories[2]  # Desserts
        
        with pytest.raises(ConflictError) as exc_info:
            await service.update_category(
                category_id=category2.id,
                slug=category1.slug
            )
        
        assert "already exists" in str(exc_info.value)
    
    @pytest.mark.asyncio
    async def test_update_category_not_found(self, service: CategoryService):
        """Test updating non-existent category."""
        fake_id = uuid4()
        
        with pytest.raises(NotFoundError):
            await service.update_category(
                category_id=fake_id,
                name="Test"
            )
    
    @pytest.mark.asyncio
    async def test_delete_category_success(self, service: CategoryService):
        """Test successful category deletion."""
        category = await service.create_category(
            name="To Delete",
            slug="to-delete"
        )
        
        result = await service.delete_category(category.id)
        assert result is True
        
        # Verify deletion
        deleted = await service.get_category(category.id)
        assert deleted is None
    
    @pytest.mark.asyncio
    async def test_delete_category_with_children(
        self,
        service: CategoryService,
        sample_categories: List[Category]
    ):
        """Test deleting category with children."""
        parent = sample_categories[1]  # Main Dishes (has Pasta as child)
        
        # Should fail without force
        with pytest.raises(ConflictError) as exc_info:
            await service.delete_category(parent.id)
        
        assert "Cannot delete category with children" in str(exc_info.value)
        
        # Should succeed with force
        result = await service.delete_category(parent.id, force=True)
        assert result is True
    
    @pytest.mark.asyncio
    async def test_delete_category_with_recipes(
        self,
        service: CategoryService,
        db_session: AsyncSession,
        sample_categories: List[Category],
        test_user: AuthUser
    ):
        """Test deleting category with recipes."""
        category = sample_categories[3]  # Pasta
        
        # Create a recipe in this category
        recipe = Recipe(
            user_id=test_user.id,
            name="Spaghetti Carbonara",
            description="Classic Italian pasta",
            instructions="Cook pasta...",
            servings=4,
            is_published=True
        )
        db_session.add(recipe)
        await db_session.commit()
        
        recipe_category = RecipeCategory(
            recipe_id=recipe.id,
            category_id=category.id,
            is_primary=True
        )
        db_session.add(recipe_category)
        await db_session.commit()
        
        # Should fail without force
        with pytest.raises(ConflictError) as exc_info:
            await service.delete_category(category.id)
        
        assert "Cannot delete category with recipes" in str(exc_info.value)
        
        # Should succeed with force
        result = await service.delete_category(category.id, force=True)
        assert result is True
    
    @pytest.mark.asyncio
    async def test_get_category_tree(
        self,
        service: CategoryService,
        sample_categories: List[Category]
    ):
        """Test getting category tree."""
        # Get full tree
        tree = await service.get_category_tree()
        
        assert len(tree) == 1  # One root category (Recipes)
        assert tree[0]["name"] == "Recipes"
        assert len(tree[0]["children"]) == 2  # Main Dishes, Desserts
        
        # Check structure
        main_dishes = next(c for c in tree[0]["children"] if c["name"] == "Main Dishes")
        assert len(main_dishes["children"]) == 1  # Pasta
        assert main_dishes["children"][0]["name"] == "Pasta"
        assert main_dishes["level"] == 1
        assert main_dishes["children"][0]["level"] == 2
    
    @pytest.mark.asyncio
    async def test_get_category_tree_from_parent(
        self,
        service: CategoryService,
        sample_categories: List[Category]
    ):
        """Test getting category tree from specific parent."""
        main_dishes = sample_categories[1]
        
        tree = await service.get_category_tree(parent_id=main_dishes.id)
        
        assert len(tree) == 1  # Only Pasta
        assert tree[0]["name"] == "Pasta"
        assert tree[0]["level"] == 0  # Relative to parent
    
    @pytest.mark.asyncio
    async def test_get_category_tree_max_depth(
        self,
        service: CategoryService,
        sample_categories: List[Category]
    ):
        """Test getting category tree with max depth."""
        tree = await service.get_category_tree(max_depth=2)
        
        # Should include Recipes and its children, but not grandchildren
        assert len(tree) == 1
        assert len(tree[0]["children"]) == 2
        
        # Children should have empty children arrays due to max_depth
        for child in tree[0]["children"]:
            assert child["children"] == []
    
    @pytest.mark.asyncio
    async def test_get_category_breadcrumbs(
        self,
        service: CategoryService,
        sample_categories: List[Category]
    ):
        """Test getting category breadcrumbs."""
        pasta = sample_categories[3]  # Pasta (deepest level)
        
        breadcrumbs = await service.get_category_breadcrumbs(pasta.id)
        
        assert len(breadcrumbs) == 3
        assert breadcrumbs[0]["name"] == "Recipes"
        assert breadcrumbs[1]["name"] == "Main Dishes"
        assert breadcrumbs[2]["name"] == "Pasta"
        
        # Check all have required fields
        for crumb in breadcrumbs:
            assert "id" in crumb
            assert "name" in crumb
            assert "slug" in crumb
    
    @pytest.mark.asyncio
    async def test_get_category_breadcrumbs_not_found(self, service: CategoryService):
        """Test getting breadcrumbs for non-existent category."""
        fake_id = uuid4()
        
        with pytest.raises(NotFoundError):
            await service.get_category_breadcrumbs(fake_id)
    
    @pytest.mark.asyncio
    async def test_move_category(
        self,
        service: CategoryService,
        sample_categories: List[Category]
    ):
        """Test moving category to new parent."""
        pasta = sample_categories[3]  # Currently under Main Dishes
        desserts = sample_categories[2]
        
        # Move pasta to desserts (weird but valid)
        moved = await service.move_category(pasta.id, desserts.id)
        
        assert moved.parent_id == desserts.id
    
    @pytest.mark.asyncio
    async def test_move_category_to_root(
        self,
        service: CategoryService,
        sample_categories: List[Category]
    ):
        """Test moving category to root level."""
        pasta = sample_categories[3]
        
        # Move to root
        moved = await service.move_category(pasta.id, None)
        
        assert moved.parent_id is None
    
    @pytest.mark.asyncio
    async def test_move_category_circular_reference(
        self,
        service: CategoryService,
        sample_categories: List[Category]
    ):
        """Test preventing circular reference when moving."""
        recipes = sample_categories[0]
        main_dishes = sample_categories[1]
        pasta = sample_categories[3]
        
        # Try to move parent to its child
        with pytest.raises(ValidationError) as exc_info:
            await service.move_category(main_dishes.id, pasta.id)
        
        assert "Cannot move category to its own descendant" in str(exc_info.value)
        
        # Try to move to itself
        with pytest.raises(ValidationError) as exc_info:
            await service.move_category(main_dishes.id, main_dishes.id)
        
        assert "Cannot move category to its own descendant" in str(exc_info.value)
    
    @pytest.mark.asyncio
    async def test_get_recipes_by_category(
        self,
        service: CategoryService,
        db_session: AsyncSession,
        sample_categories: List[Category],
        test_user: AuthUser
    ):
        """Test getting recipes by category."""
        pasta_category = sample_categories[3]
        
        # Create test recipes
        recipes = []
        for i in range(5):
            recipe = Recipe(
                user_id=test_user.id,
                name=f"Pasta Recipe {i}",
                description=f"Recipe {i}",
                instructions="Cook...",
                servings=4,
                is_published=True
            )
            db_session.add(recipe)
            recipes.append(recipe)
        
        await db_session.commit()
        
        # Assign to category
        for recipe in recipes:
            recipe_category = RecipeCategory(
                recipe_id=recipe.id,
                category_id=pasta_category.id
            )
            db_session.add(recipe_category)
        
        await db_session.commit()
        
        # Test retrieval
        result_recipes, total = await service.get_recipes_by_category(
            pasta_category.id,
            limit=3,
            offset=0
        )
        
        assert len(result_recipes) == 3
        assert total == 5
        
        # Test pagination
        result_recipes_page2, _ = await service.get_recipes_by_category(
            pasta_category.id,
            limit=3,
            offset=3
        )
        
        assert len(result_recipes_page2) == 2
    
    @pytest.mark.asyncio
    async def test_get_recipes_by_category_include_subcategories(
        self,
        service: CategoryService,
        db_session: AsyncSession,
        sample_categories: List[Category],
        test_user: AuthUser
    ):
        """Test getting recipes including subcategories."""
        main_dishes = sample_categories[1]
        pasta = sample_categories[3]
        
        # Create recipes in parent category
        recipe_main = Recipe(
            user_id=test_user.id,
            name="Main Dish Recipe",
            description="In main category",
            instructions="Cook...",
            servings=4,
            is_published=True
        )
        db_session.add(recipe_main)
        
        # Create recipe in subcategory
        recipe_pasta = Recipe(
            user_id=test_user.id,
            name="Pasta Recipe",
            description="In pasta category",
            instructions="Cook...",
            servings=4,
            is_published=True
        )
        db_session.add(recipe_pasta)
        await db_session.commit()
        
        # Assign categories
        db_session.add(RecipeCategory(
            recipe_id=recipe_main.id,
            category_id=main_dishes.id
        ))
        db_session.add(RecipeCategory(
            recipe_id=recipe_pasta.id,
            category_id=pasta.id
        ))
        await db_session.commit()
        
        # Test without subcategories
        recipes, total = await service.get_recipes_by_category(
            main_dishes.id,
            include_subcategories=False
        )
        assert total == 1
        
        # Test with subcategories
        recipes_with_sub, total_with_sub = await service.get_recipes_by_category(
            main_dishes.id,
            include_subcategories=True
        )
        assert total_with_sub == 2
    
    @pytest.mark.asyncio
    async def test_list_categories(
        self,
        service: CategoryService,
        sample_categories: List[Category]
    ):
        """Test listing categories with filtering."""
        # Test listing all
        categories, total = await service.list_categories()
        assert total == 5
        
        # Test search
        categories, total = await service.list_categories(search="Dish")
        assert total == 1
        assert categories[0].name == "Main Dishes"
        
        # Test by parent
        recipes = sample_categories[0]
        categories, total = await service.list_categories(parent_id=recipes.id)
        assert total == 2  # Main Dishes and Desserts
        
        # Test pagination
        categories, total = await service.list_categories(limit=2, offset=0)
        assert len(categories) == 2
        assert total == 5