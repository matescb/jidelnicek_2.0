"""
Pytest configuration and fixtures for Jidelnicek 2.0 tests.

This module provides common fixtures used across all test modules.
"""

import asyncio
import os
from typing import AsyncGenerator, Generator
from datetime import datetime, timezone
import secrets
import uuid

import pytest
import pytest_asyncio
import httpx
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.pool import NullPool
from sqlalchemy import text
from redis.asyncio import Redis
from unittest.mock import AsyncMock, MagicMock

# Set environment to test before importing config
os.environ["ENVIRONMENT"] = "test"
os.environ["DB_PASSWORD"] = "test_password"
os.environ["SENTRY_DSN"] = "https://test@sentry.io/123456"
os.environ["CORS_ORIGINS"] = '["http://testserver"]'

from jidelnicek.main import app
from jidelnicek.core.database import Base
from jidelnicek.core.dependencies import get_db, get_redis_client
# Import all models to ensure tables are created
from jidelnicek.db.base import *  # noqa: F401, F403
# Get AuthUser from the imported models above
AuthUser = globals()['AuthUser']  # AuthUser imported via db.base
from jidelnicek.auth.utils.password import PasswordHasher
from jidelnicek.auth.services.token_service import TokenService

# Test database URL - use PostgreSQL for tests
TEST_DATABASE_URL = "postgresql+asyncpg://jidelnicek:testpassword@localhost:5433/jidelnicek_test"


@pytest.fixture(scope="session")
def event_loop() -> Generator:
    """Create an instance of the default event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(scope="function")
async def test_engine():
    """Create a test database engine."""
    engine = create_async_engine(
        TEST_DATABASE_URL,
        poolclass=NullPool,
    )
    
    # Create tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    yield engine
    
    # Drop tables after test - graceful cleanup with fallback
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)
    except Exception:
        # Fallback: Use direct PostgreSQL CASCADE to handle foreign key constraints
        try:
            async with engine.begin() as conn:
                await conn.execute(text("DROP SCHEMA IF EXISTS public CASCADE"))
                await conn.execute(text("CREATE SCHEMA public"))
                await conn.execute(text("GRANT ALL ON SCHEMA public TO postgres"))
                await conn.execute(text("GRANT ALL ON SCHEMA public TO public"))
        except Exception:
            # Final fallback: ignore cleanup errors to avoid test failures
            pass
    
    await engine.dispose()


@pytest_asyncio.fixture(scope="function")
async def db_session(test_engine) -> AsyncGenerator[AsyncSession, None]:
    """Create a test database session with proper test isolation."""
    async_session_maker = async_sessionmaker(
        test_engine,
        class_=AsyncSession,
        expire_on_commit=False
    )
    
    async with async_session_maker() as session:
        yield session
        # Rollback any uncommitted changes for test isolation
        await session.rollback()


@pytest_asyncio.fixture(scope="function")
async def mock_redis() -> AsyncMock:
    """Create a mock Redis client."""
    mock = AsyncMock(spec=Redis)
    
    # Mock common Redis operations with async return values
    mock.get = AsyncMock(return_value=None)
    mock.setex = AsyncMock(return_value=True)
    mock.incr = AsyncMock(return_value=1)
    mock.ttl = AsyncMock(return_value=3600)
    mock.ping = AsyncMock(return_value=True)
    mock.delete = AsyncMock(return_value=1)
    mock.exists = AsyncMock(return_value=0)
    
    return mock


@pytest_asyncio.fixture(scope="function")
async def async_client(db_session: AsyncSession, mock_redis: AsyncMock) -> AsyncGenerator[AsyncClient, None]:
    """Create an async test client with dependency overrides."""
    
    async def override_get_db():
        yield db_session
    
    async def override_get_redis():
        yield mock_redis
    
    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_redis_client] = override_get_redis
    
    async with AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        yield client
    
    # Clear overrides
    app.dependency_overrides.clear()


@pytest_asyncio.fixture(scope="function")
async def client(async_client: AsyncClient) -> AsyncClient:
    """Alias for async_client to match test expectations."""
    return async_client


@pytest_asyncio.fixture(scope="function")
async def existing_user(db_session: AsyncSession) -> AuthUser:
    """Create an existing user for tests."""
    unique_id = str(uuid.uuid4())[:8]
    user = AuthUser(
        email=f"existing-{unique_id}@example.com",
        password_hash=PasswordHasher.hash_password("ExistingPass123!@#"),
        email_verified=True,
        email_verified_at=datetime.now(timezone.utc),
        language="en",
        unit_system="metric",
        energy_unit="kcal",
        has_pku=False,
        timezone="Europe/Prague",
        role="user",
        is_active=True,
        is_archived=False
    )
    
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    
    return user


@pytest_asyncio.fixture(scope="function")
async def admin_user(db_session: AsyncSession) -> AuthUser:
    """Create an admin user for tests."""
    unique_id = str(uuid.uuid4())[:8]
    user = AuthUser(
        email=f"admin-{unique_id}@example.com",
        password_hash=PasswordHasher.hash_password("AdminPass123!@#"),
        email_verified=True,
        email_verified_at=datetime.now(timezone.utc),
        language="en",
        unit_system="metric",
        energy_unit="kcal",
        has_pku=False,
        timezone="Europe/Prague",
        role="admin",
        is_active=True,
        is_archived=False
    )
    
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    
    return user


@pytest_asyncio.fixture(scope="function")
async def unverified_user(db_session: AsyncSession) -> AuthUser:
    """Create an unverified user for tests."""
    unique_id = str(uuid.uuid4())[:8]
    user = AuthUser(
        email=f"unverified-{unique_id}@example.com",
        password_hash=PasswordHasher.hash_password("UnverifiedPass123!@#"),
        email_verified=False,
        language="cs",
        unit_system="metric",
        energy_unit="kJ",
        has_pku=True,
        timezone="Europe/Prague",
        role="user",
        is_active=True,
        is_archived=False
    )
    
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    
    return user


@pytest_asyncio.fixture(scope="function")
async def inactive_user(db_session: AsyncSession) -> AuthUser:
    """Create an inactive user for tests."""
    unique_id = str(uuid.uuid4())[:8]
    user = AuthUser(
        email=f"inactive-{unique_id}@example.com",
        password_hash=PasswordHasher.hash_password("InactivePass123!@#"),
        email_verified=True,
        email_verified_at=datetime.now(timezone.utc),
        language="en",
        unit_system="imperial",
        energy_unit="kcal",
        has_pku=False,
        timezone="America/New_York",
        role="user",
        is_active=False,
        is_archived=False
    )
    
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    
    return user


# Environment variable fixtures
@pytest.fixture(autouse=True)
def setup_test_environment(monkeypatch):
    """Set up test environment variables."""
    monkeypatch.setenv("ENVIRONMENT", "test")
    monkeypatch.setenv("SECRET_KEY", "test-secret-key-for-testing-only-change-in-production")
    monkeypatch.setenv("DATABASE_URL", TEST_DATABASE_URL)
    monkeypatch.setenv("REDIS_URL", "redis://localhost:6379/0")
    monkeypatch.setenv("DB_PASSWORD", "test-password")
    monkeypatch.setenv("RATE_LIMIT_ENABLED", "true")


@pytest_asyncio.fixture(scope="function")
async def auth_headers(existing_user: AuthUser, db_session: AsyncSession, mock_redis: AsyncMock) -> dict:
    """Create authentication headers with a valid token for testing."""
    token_service = TokenService(db_session, mock_redis)
    access_token, _ = token_service.generate_access_token(existing_user)
    
    return {
        "Authorization": f"Bearer {access_token}"
    }


@pytest_asyncio.fixture(scope="function") 
async def admin_headers(admin_user: AuthUser, db_session: AsyncSession, mock_redis: AsyncMock) -> dict:
    """Create authentication headers for admin user."""
    token_service = TokenService(db_session, mock_redis)
    access_token, _ = token_service.generate_access_token(admin_user)
    
    return {
        "Authorization": f"Bearer {access_token}"
    }


@pytest_asyncio.fixture(scope="function")
async def admin_regular_user_headers(existing_user: AuthUser, db_session: AsyncSession, mock_redis: AsyncMock) -> dict:
    """Create authentication headers for regular user (non-admin) to test admin access restrictions."""
    token_service = TokenService(db_session, mock_redis)
    access_token, _ = token_service.generate_access_token(existing_user)
    
    return {
        "Authorization": f"Bearer {access_token}"
    }


@pytest_asyncio.fixture(scope="function")
async def unverified_auth_headers(unverified_user: AuthUser, db_session: AsyncSession, mock_redis: AsyncMock) -> dict:
    """Create authentication headers for an unverified user."""
    token_service = TokenService(db_session, mock_redis)
    access_token, _ = token_service.generate_access_token(unverified_user)
    
    return {
        "Authorization": f"Bearer {access_token}"
    }


# Token fixtures for specific users
@pytest_asyncio.fixture(scope="function")
async def admin_token(admin_user: AuthUser, db_session: AsyncSession, mock_redis: AsyncMock) -> str:
    """Create an admin user token."""
    token_service = TokenService(db_session, mock_redis)
    access_token, _ = token_service.generate_access_token(admin_user)
    return access_token


@pytest_asyncio.fixture(scope="function")
async def user_token(existing_user: AuthUser, db_session: AsyncSession, mock_redis: AsyncMock) -> str:
    """Create a regular user token."""
    token_service = TokenService(db_session, mock_redis)
    access_token, _ = token_service.generate_access_token(existing_user)
    return access_token


@pytest_asyncio.fixture(scope="function")
async def owner_token(request, db_session: AsyncSession, mock_redis: AsyncMock) -> str:
    """Create a token for the recipe owner (used in recipe tests)."""
    # Get the recipe_owner fixture from the test
    if hasattr(request, "getfixturevalue"):
        owner = request.getfixturevalue("recipe_owner")
    else:
        # Fallback to existing user
        owner = request.getfixturevalue("existing_user")
    
    token_service = TokenService(db_session, mock_redis)
    access_token, _ = token_service.generate_access_token(owner)
    return access_token


@pytest_asyncio.fixture(scope="function")
async def other_user_token(request, db_session: AsyncSession, mock_redis: AsyncMock) -> str:
    """Create a token for another user (not recipe owner)."""
    # Get the other_user fixture from the test if available
    if hasattr(request, "getfixturevalue"):
        try:
            other = request.getfixturevalue("other_user")
        except:
            # Create a new user if other_user fixture not available
            unique_id = str(uuid.uuid4())[:8]
            other = AuthUser(
                email=f"another-{unique_id}@example.com",
                password_hash=PasswordHasher.hash_password("AnotherPass123!"),
                email_verified=True,
                language="en",
                unit_system="metric",
                energy_unit="kcal",
                timezone="UTC",
                role="user",
                is_active=True
            )
            db_session.add(other)
            await db_session.commit()
    
    token_service = TokenService(db_session, mock_redis)
    access_token, _ = token_service.generate_access_token(other)
    return access_token


@pytest_asyncio.fixture(scope="function")
async def regular_user_token(request, db_session: AsyncSession, mock_redis: AsyncMock) -> str:
    """Create a token for a regular user (used in category tests)."""
    # Get the regular_user fixture from the test if available
    if hasattr(request, "getfixturevalue"):
        try:
            user = request.getfixturevalue("regular_user")
        except:
            user = request.getfixturevalue("existing_user")
    else:
        user = request.getfixturevalue("existing_user")
    
    token_service = TokenService(db_session, mock_redis)
    access_token, _ = token_service.generate_access_token(user)
    return access_token


@pytest_asyncio.fixture(scope="function")
async def authenticated_client(
    db_session: AsyncSession, 
    mock_redis: AsyncMock, 
    existing_user: AuthUser
) -> AsyncGenerator[AsyncClient, None]:
    """Create an authenticated async test client with dependency overrides."""
    
    async def override_get_db():
        yield db_session
    
    async def override_get_redis():
        yield mock_redis
    
    # Create authentication headers
    token_service = TokenService(db_session, mock_redis)
    access_token, _ = token_service.generate_access_token(existing_user)
    
    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_redis_client] = override_get_redis
    
    # Create client with default authentication headers
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json"
    }
    
    async with AsyncClient(
        transport=httpx.ASGITransport(app=app), 
        base_url="http://test",
        headers=headers
    ) as client:
        yield client
    
    # Clear overrides
    app.dependency_overrides.clear()


@pytest_asyncio.fixture(scope="function")
async def admin_authenticated_client(
    db_session: AsyncSession, 
    mock_redis: AsyncMock, 
    admin_user: AuthUser
) -> AsyncGenerator[AsyncClient, None]:
    """Create an admin authenticated async test client with dependency overrides."""
    
    async def override_get_db():
        yield db_session
    
    async def override_get_redis():
        yield mock_redis
    
    # Create authentication headers for admin
    token_service = TokenService(db_session, mock_redis)
    access_token, _ = token_service.generate_access_token(admin_user)
    
    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_redis_client] = override_get_redis
    
    # Create client with default authentication headers
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json"
    }
    
    async with AsyncClient(
        transport=httpx.ASGITransport(app=app), 
        base_url="http://test",
        headers=headers
    ) as client:
        yield client
    
    # Clear overrides
    app.dependency_overrides.clear()