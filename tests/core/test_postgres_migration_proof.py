#!/usr/bin/env python3

"""
Minimal test to prove PostgreSQL migration is working
This demonstrates that the SQLite issues have been resolved
"""

import pytest
import pytest_asyncio
import time
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from jidelnicek.auth.models import AuthUser
from jidelnicek.recipe.models.recipe import Recipe
from jidelnicek.common.models.ingredient import Ingredient


@pytest_asyncio.fixture(scope="function")
async def sample_test_data(db_session):
    """Create minimal test data for performance testing."""
    import uuid
    session = db_session
    unique_id = str(uuid.uuid4())[:8]
    
    # Create a test user with unique email
    user = AuthUser(
        email=f"testuser-{unique_id}@example.com",
        password_hash="test_hash",
        email_verified=True,
        role="user"
    )
    session.add(user)
    await session.commit()
    
    # Create test ingredients
    ingredients = []
    for i in range(10):
        ingredient = Ingredient(
            name=f"Test Ingredient {i}",
            nutritional_data={
                "calories": 100 + i * 10,
                "proteins": 5 + i,
                "carbs": 10 + i * 2,
                "fats": 2 + i
            }
        )
        ingredients.append(ingredient)
        session.add(ingredient)
    
    await session.commit()
    
    # Create test recipes
    recipes = []
    for i in range(5):
        recipe = Recipe(
            user_id=user.id,
            name=f"Test Recipe {i}",
            description=f"Test recipe {i}",
            instructions="Test instructions",
            prep_time_minutes=15 + i * 5,
            cook_time_minutes=30 + i * 10,
            servings=2 + i,
            is_public=True,
            is_published=True
        )
        recipes.append(recipe)
        session.add(recipe)
    
    await session.commit()
    
    return {
        "user": user,
        "ingredients": ingredients,
        "recipes": recipes
    }


@pytest.mark.asyncio
async def test_postgresql_connection_works(db_session):
    """Test that PostgreSQL connection is working (no SQLite errors)."""
    session = db_session
    
    # This would fail with SQLite gen_random_uuid() error before the migration
    result = await session.execute(select(AuthUser))
    users = result.scalars().all()
    
    # Test passes if no SQLite errors occur
    assert isinstance(users, list)
    print("✅ PostgreSQL connection working - no SQLite errors!")


@pytest.mark.asyncio
async def test_async_database_operations(db_session, sample_test_data):
    """Test that async database operations work with PostgreSQL."""
    session = db_session
    test_user = sample_test_data["user"]
    
    # Test async query
    result = await session.execute(
        select(AuthUser).where(AuthUser.email == test_user.email)
    )
    user = result.scalar_one()
    assert user is not None
    assert user.email == test_user.email
    
    # Test async recipe query
    result = await session.execute(select(Recipe))
    recipes = result.scalars().all()
    assert len(recipes) == 5
    
    print("✅ Async PostgreSQL operations working!")


@pytest.mark.asyncio
async def test_performance_baseline(db_session, sample_test_data):
    """Test basic performance with PostgreSQL (no SQLite slowness)."""
    session = db_session
    
    start_time = time.perf_counter()
    
    # Perform multiple queries
    for i in range(10):
        result = await session.execute(select(Recipe).limit(1))
        recipe = result.scalar_one_or_none()
    
    duration = time.perf_counter() - start_time
    
    # Should complete quickly with PostgreSQL
    assert duration < 1.0  # Less than 1 second for 10 simple queries
    
    print(f"✅ Performance test passed: {duration:.3f}s for 10 queries")


@pytest.mark.asyncio
async def test_no_sqlite_gen_random_uuid_error(db_session):
    """Specifically test that gen_random_uuid() SQLite error is gone."""
    import uuid
    session = db_session
    unique_id = str(uuid.uuid4())[:8]
    
    # Create a user - this used to fail with SQLite gen_random_uuid() error
    user = AuthUser(
        email=f"uuid_test-{unique_id}@example.com",
        password_hash="test_hash",
        email_verified=True,
        role="user"
    )
    session.add(user)
    
    # This commit would fail with SQLite before the migration
    await session.commit()
    
    # Verify the user was created successfully
    result = await session.execute(
        select(AuthUser).where(AuthUser.email == f"uuid_test-{unique_id}@example.com")
    )
    created_user = result.scalar_one()
    assert created_user is not None
    assert created_user.id is not None  # UUID was generated successfully
    
    print("✅ No SQLite gen_random_uuid() error - PostgreSQL working!")