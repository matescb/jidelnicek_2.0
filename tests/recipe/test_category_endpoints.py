"""
Integration tests for category management endpoints.

These tests verify the category functionality including:
- List categories (tree and flat views)
- Get category details with recipes
- Create, update, and delete categories (admin only)
- Get breadcrumbs
- Authorization checks
"""

import pytest
import pytest_asyncio
from uuid import uuid4
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from jidelnicek.auth.models import AuthUser
from jidelnicek.recipe.models.categorization import Category, RecipeCategory
from jidelnicek.recipe.models.recipe import Recipe
from jidelnicek.auth.utils.password import PasswordHasher


pytestmark = pytest.mark.asyncio


@pytest_asyncio.fixture(scope="function")
async def test_categories(db_session: AsyncSession) -> list[Category]:
    """Create test categories with hierarchical structure."""
    # Create parent categories
    main_dishes = Category(
        name="Main Dishes",
        slug="main-dishes",
        description="Hearty main course recipes",
        icon="main-dish",
        display_order=1
    )
    desserts = Category(
        name="Desserts",
        slug="desserts",
        description="Sweet treats and desserts",
        icon="dessert",
        display_order=2
    )
    
    db_session.add_all([main_dishes, desserts])
    await db_session.flush()
    
    # Create child categories
    pasta = Category(
        name="Pasta",
        slug="pasta",
        description="Italian pasta dishes",
        icon="pasta",
        parent_id=main_dishes.id,
        display_order=1
    )
    pizza = Category(
        name="Pizza",
        slug="pizza",
        description="Pizza recipes",
        icon="pizza",
        parent_id=main_dishes.id,
        display_order=2
    )
    cakes = Category(
        name="Cakes",
        slug="cakes",
        description="Cake recipes",
        icon="cake",
        parent_id=desserts.id,
        display_order=1
    )
    
    db_session.add_all([pasta, pizza, cakes])
    await db_session.commit()
    
    return [main_dishes, desserts, pasta, pizza, cakes]


@pytest_asyncio.fixture(scope="function")
async def admin_user(db_session: AsyncSession) -> AuthUser:
    """Create an admin user for testing."""
    user = AuthUser(
        email="admin@example.com",
        password_hash=PasswordHasher.hash_password("AdminPassword123!"),
        language="en",
        unit_system="metric",
        energy_unit="kcal",
        timezone="UTC",
        is_active=True,
        email_verified=True,
        role="admin"
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture(scope="function")
async def regular_user(db_session: AsyncSession) -> AuthUser:
    """Create a regular user for testing."""
    user = AuthUser(
        email="user@example.com",
        password_hash=PasswordHasher.hash_password("UserPassword123!"),
        language="en",
        unit_system="metric",
        energy_unit="kcal",
        timezone="UTC",
        is_active=True,
        email_verified=True,
        role="user"
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture(scope="function")
async def test_recipe_with_category(
    db_session: AsyncSession,
    regular_user: AuthUser,
    test_categories: list[Category]
) -> Recipe:
    """Create a test recipe with category."""
    recipe = Recipe(
        title="Spaghetti Carbonara",
        description="Classic Italian pasta dish",
        instructions="Cook pasta, mix with eggs and bacon",
        prep_time_minutes=10,
        cook_time_minutes=15,
        servings=4,
        difficulty="medium",
        author_id=regular_user.id,
        is_public=True
    )
    db_session.add(recipe)
    await db_session.flush()
    
    # Assign to pasta category
    recipe_category = RecipeCategory(
        recipe_id=recipe.id,
        category_id=test_categories[2].id,  # pasta
        is_primary=True
    )
    db_session.add(recipe_category)
    await db_session.commit()
    await db_session.refresh(recipe)
    
    return recipe


class TestListCategories:
    """Test listing categories endpoint."""
    
    async def test_list_categories_tree_structure(
        self,
        async_client: AsyncClient,
        test_categories: list[Category]
    ):
        """Test listing categories in tree structure."""
        response = await async_client.get("/api/v1/recipes/categories?tree=true")
        
        assert response.status_code == 200
        data = response.json()
        
        # Should have 2 root categories
        assert len(data) == 2
        
        # Check main dishes category
        main_dishes = next(c for c in data if c["name"] == "Main Dishes")
        assert main_dishes["slug"] == "main-dishes"
        assert len(main_dishes["children"]) == 2
        assert main_dishes["depth"] == 0
        assert main_dishes["path"] == ["Main Dishes"]
        
        # Check child categories
        pasta = next(c for c in main_dishes["children"] if c["name"] == "Pasta")
        assert pasta["parent_id"] == main_dishes["id"]
        assert pasta["depth"] == 1
        assert pasta["path"] == ["Main Dishes", "Pasta"]
    
    async def test_list_categories_flat(
        self,
        async_client: AsyncClient,
        test_categories: list[Category]
    ):
        """Test listing categories in flat structure."""
        response = await async_client.get("/api/v1/recipes/categories?tree=false")
        
        assert response.status_code == 200
        data = response.json()
        
        # Should have all 5 categories
        assert len(data) == 5
        
        # All should have empty children arrays
        for category in data:
            assert category["children"] == []
        
        # Check paths are correct
        pasta = next(c for c in data if c["name"] == "Pasta")
        assert pasta["path"] == ["Main Dishes", "Pasta"]
        assert pasta["depth"] == 1
    
    async def test_list_categories_exclude_empty(
        self,
        async_client: AsyncClient,
        test_categories: list[Category],
        test_recipe_with_category: Recipe
    ):
        """Test excluding categories without recipes."""
        response = await async_client.get("/api/v1/recipes/categories?include_empty=false")
        
        assert response.status_code == 200
        data = response.json()
        
        # Should only include categories with recipes
        # In tree view, should show pasta and its parent
        category_names = []
        
        def extract_names(categories):
            for cat in categories:
                category_names.append(cat["name"])
                if cat["children"]:
                    extract_names(cat["children"])
        
        extract_names(data)
        assert "Pasta" in category_names  # Has recipe
        assert "Main Dishes" in category_names  # Parent of pasta


class TestGetCategory:
    """Test getting category details endpoint."""
    
    async def test_get_category_with_recipes(
        self,
        async_client: AsyncClient,
        test_categories: list[Category],
        test_recipe_with_category: Recipe
    ):
        """Test getting category details with recipes."""
        pasta_id = test_categories[2].id  # pasta category
        response = await async_client.get(f"/api/v1/categories/{pasta_id}")
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["name"] == "Pasta"
        assert data["slug"] == "pasta"
        assert data["recipe_count"] == 1
        assert data["total_recipes"] == 1
        assert len(data["recipes"]) == 1
        assert data["recipes"][0]["title"] == "Spaghetti Carbonara"
    
    async def test_get_category_pagination(
        self,
        async_client: AsyncClient,
        test_categories: list[Category],
        test_recipe_with_category: Recipe,
        db_session: AsyncSession,
        regular_user: AuthUser
    ):
        """Test category recipe pagination."""
        # Create multiple recipes in the same category
        pasta_id = test_categories[2].id
        
        for i in range(5):
            recipe = Recipe(
                title=f"Pasta Recipe {i}",
                description="Another pasta dish",
                instructions="Cook and serve",
                prep_time_minutes=10,
                cook_time_minutes=15,
                servings=4,
                difficulty="easy",
                author_id=regular_user.id,
                is_public=True
            )
            db_session.add(recipe)
            await db_session.flush()
            
            recipe_category = RecipeCategory(
                recipe_id=recipe.id,
                category_id=pasta_id,
                is_primary=True
            )
            db_session.add(recipe_category)
        
        await db_session.commit()
        
        # Test pagination
        response = await async_client.get(
            f"/api/v1/recipes/categories/{pasta_id}?page=1&page_size=3"
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["total_recipes"] == 6  # Original + 5 new
        assert len(data["recipes"]) == 3  # Page size
    
    async def test_get_category_not_found(
        self,
        client: AsyncClient
    ):
        """Test getting non-existent category."""
        fake_id = uuid4()
        response = await async_client.get(f"/api/v1/categories/{fake_id}")
        
        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()


class TestCreateCategory:
    """Test creating categories endpoint."""
    
    async def test_create_category_admin_only(
        self,
        async_client: AsyncClient,
        admin_user: AuthUser,
        admin_token: str
    ):
        """Test creating category as admin."""
        category_data = {
            "name": "Appetizers",
            "description": "Small dishes to start a meal",
            "icon": "appetizer",
            "display_order": 3
        }
        
        response = await async_client.post(
            "/api/v1/recipes/categories",
            json=category_data,
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 201
        data = response.json()
        
        assert data["name"] == "Appetizers"
        assert data["slug"] == "appetizers"  # Auto-generated
        assert data["description"] == category_data["description"]
        assert data["icon"] == "appetizer"
        assert data["parent_id"] is None
    
    async def test_create_category_with_parent(
        self,
        async_client: AsyncClient,
        admin_token: str,
        test_categories: list[Category]
    ):
        """Test creating category with parent."""
        main_dishes_id = test_categories[0].id
        
        category_data = {
            "name": "Grilled",
            "slug": "grilled",
            "description": "Grilled dishes",
            "parent_id": str(main_dishes_id)
        }
        
        response = await async_client.post(
            "/api/v1/recipes/categories",
            json=category_data,
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 201
        data = response.json()
        
        assert data["parent_id"] == str(main_dishes_id)
    
    async def test_create_category_duplicate_slug(
        self,
        async_client: AsyncClient,
        admin_token: str,
        test_categories: list[Category]
    ):
        """Test creating category with duplicate slug."""
        category_data = {
            "name": "Main Dishes",
            "slug": "main-dishes"  # Already exists
        }
        
        response = await async_client.post(
            "/api/v1/recipes/categories",
            json=category_data,
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 400
        assert "already exists" in response.json()["detail"]
    
    async def test_create_category_regular_user_forbidden(
        self,
        async_client: AsyncClient,
        regular_user_token: str
    ):
        """Test regular user cannot create categories."""
        category_data = {
            "name": "New Category"
        }
        
        response = await async_client.post(
            "/api/v1/recipes/categories",
            json=category_data,
            headers={"Authorization": f"Bearer {regular_user_token}"}
        )
        
        assert response.status_code == 403


class TestUpdateCategory:
    """Test updating categories endpoint."""
    
    async def test_update_category_admin_only(
        self,
        async_client: AsyncClient,
        admin_token: str,
        test_categories: list[Category]
    ):
        """Test updating category as admin."""
        category_id = test_categories[0].id
        
        update_data = {
            "name": "Main Courses",
            "description": "Updated description",
            "display_order": 10
        }
        
        response = await async_client.put(
            f"/api/v1/recipes/categories/{category_id}",
            json=update_data,
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["name"] == "Main Courses"
        assert data["description"] == "Updated description"
        assert data["display_order"] == 10
        assert data["slug"] == "main-dishes"  # Unchanged
    
    async def test_update_category_parent(
        self,
        async_client: AsyncClient,
        admin_token: str,
        test_categories: list[Category]
    ):
        """Test updating category parent."""
        pasta_id = test_categories[2].id
        desserts_id = test_categories[1].id
        
        update_data = {
            "parent_id": str(desserts_id)  # Move pasta to desserts
        }
        
        response = await async_client.put(
            f"/api/v1/recipes/categories/{pasta_id}",
            json=update_data,
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["parent_id"] == str(desserts_id)
    
    async def test_update_category_self_parent_error(
        self,
        async_client: AsyncClient,
        admin_token: str,
        test_categories: list[Category]
    ):
        """Test category cannot be its own parent."""
        category_id = test_categories[0].id
        
        update_data = {
            "parent_id": str(category_id)
        }
        
        response = await async_client.put(
            f"/api/v1/recipes/categories/{category_id}",
            json=update_data,
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 400
        assert "own parent" in response.json()["detail"]
    
    async def test_update_category_circular_reference(
        self,
        async_client: AsyncClient,
        admin_token: str,
        test_categories: list[Category]
    ):
        """Test preventing circular references."""
        main_dishes_id = test_categories[0].id
        pasta_id = test_categories[2].id
        
        # Try to make main dishes a child of its own child
        update_data = {
            "parent_id": str(pasta_id)
        }
        
        response = await async_client.put(
            f"/api/v1/recipes/categories/{main_dishes_id}",
            json=update_data,
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 400
        assert "circular reference" in response.json()["detail"]


class TestDeleteCategory:
    """Test deleting categories endpoint."""
    
    async def test_delete_category_admin_only(
        self,
        async_client: AsyncClient,
        admin_token: str,
        test_categories: list[Category]
    ):
        """Test deleting category as admin."""
        # Delete a leaf category (no children)
        cakes_id = test_categories[4].id
        
        response = await async_client.delete(
            f"/api/v1/recipes/categories/{cakes_id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 204
        
        # Verify it's deleted
        response = await async_client.get(f"/api/v1/categories/{cakes_id}")
        assert response.status_code == 404
    
    async def test_delete_category_with_children_error(
        self,
        async_client: AsyncClient,
        admin_token: str,
        test_categories: list[Category]
    ):
        """Test deleting category with children requires cascade."""
        main_dishes_id = test_categories[0].id
        
        response = await async_client.delete(
            f"/api/v1/recipes/categories/{main_dishes_id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 400
        assert "child categories" in response.json()["detail"]
    
    async def test_delete_category_cascade(
        self,
        async_client: AsyncClient,
        admin_token: str,
        test_categories: list[Category]
    ):
        """Test deleting category with cascade."""
        main_dishes_id = test_categories[0].id
        
        response = await async_client.delete(
            f"/api/v1/recipes/categories/{main_dishes_id}?cascade=true",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 204
        
        # Verify parent and children are deleted
        response = await async_client.get(f"/api/v1/categories/{main_dishes_id}")
        assert response.status_code == 404
        
        # Check children are also deleted
        pasta_id = test_categories[2].id
        response = await async_client.get(f"/api/v1/categories/{pasta_id}")
        assert response.status_code == 404
    
    async def test_delete_category_regular_user_forbidden(
        self,
        async_client: AsyncClient,
        regular_user_token: str,
        test_categories: list[Category]
    ):
        """Test regular user cannot delete categories."""
        category_id = test_categories[0].id
        
        response = await async_client.delete(
            f"/api/v1/recipes/categories/{category_id}",
            headers={"Authorization": f"Bearer {regular_user_token}"}
        )
        
        assert response.status_code == 403


class TestCategoryBreadcrumbs:
    """Test category breadcrumbs endpoint."""
    
    async def test_get_breadcrumbs(
        self,
        async_client: AsyncClient,
        test_categories: list[Category]
    ):
        """Test getting category breadcrumb path."""
        pasta_id = test_categories[2].id
        
        response = await async_client.get(f"/api/v1/categories/{pasta_id}/breadcrumbs")
        
        assert response.status_code == 200
        data = response.json()
        
        assert len(data) == 2
        assert data[0]["name"] == "Main Dishes"
        assert data[1]["name"] == "Pasta"
    
    async def test_get_breadcrumbs_root_category(
        self,
        async_client: AsyncClient,
        test_categories: list[Category]
    ):
        """Test breadcrumbs for root category."""
        main_dishes_id = test_categories[0].id
        
        response = await async_client.get(f"/api/v1/categories/{main_dishes_id}/breadcrumbs")
        
        assert response.status_code == 200
        data = response.json()
        
        assert len(data) == 1
        assert data[0]["name"] == "Main Dishes"