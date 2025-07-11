"""
Test fixtures for admin module.
"""

import pytest
import pytest_asyncio
from datetime import datetime, timezone
from uuid import uuid4
from typing import AsyncGenerator, Dict, Any

from sqlalchemy.ext.asyncio import AsyncSession

from jidelnicek.auth.models import AuthUser
from jidelnicek.auth.utils.password import PasswordHasher
from jidelnicek.admin.models import AdminAuditLog, AdminAction


@pytest_asyncio.fixture(scope="function")
async def admin_user(db_session: AsyncSession) -> AuthUser:
    """Create an admin user for testing."""
    user = AuthUser(
        email="admin@test.com",
        password_hash=PasswordHasher.hash_password("Admin123!"),
        role="admin",
        email_verified=True,
        email_verified_at=datetime.now(timezone.utc)
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture(scope="function")
async def regular_user(db_session: AsyncSession) -> AuthUser:
    """Create a regular user for testing."""
    user = AuthUser(
        email="user@test.com",
        password_hash=PasswordHasher.hash_password("User123!"),
        role="user",
        email_verified=True,
        email_verified_at=datetime.now(timezone.utc)
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture(scope="function")
async def inactive_user(db_session: AsyncSession) -> AuthUser:
    """Create an inactive user for testing."""
    user = AuthUser(
        email="inactive@test.com",
        password_hash=PasswordHasher.hash_password("Inactive123!"),
        role="user",
        is_active=False,
        email_verified=True,
        email_verified_at=datetime.now(timezone.utc)
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture(scope="function")
async def unverified_user(db_session: AsyncSession) -> AuthUser:
    """Create an unverified user for testing."""
    user = AuthUser(
        email="unverified@test.com",
        password_hash=PasswordHasher.hash_password("Unverified123!"),
        role="user",
        email_verified=False
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture(scope="function")
async def multiple_users(db_session: AsyncSession) -> list[AuthUser]:
    """Create multiple users for testing bulk operations."""
    users = []
    for i in range(10):
        user = AuthUser(
            email=f"user{i}@test.com",
            password_hash=PasswordHasher.hash_password(f"User{i}123!"),
            role="user",
            email_verified=i % 2 == 0,  # Half verified
            is_active=i % 3 != 0,  # Some inactive
            recipe_count=i * 5,
            trip_count=i * 2
        )
        db_session.add(user)
        users.append(user)
    
    await db_session.commit()
    for user in users:
        await db_session.refresh(user)
    
    return users


@pytest_asyncio.fixture(scope="function")
async def audit_logs(
    db_session: AsyncSession,
    admin_user: AuthUser,
    regular_user: AuthUser
) -> list[AdminAuditLog]:
    """Create sample audit logs."""
    logs = []
    
    # User view log
    log1 = AdminAuditLog(
        admin_id=admin_user.id,
        action=AdminAction.USER_VIEW,
        target_type="user",
        target_id=regular_user.id,
        success=True
    )
    logs.append(log1)
    
    # User update log
    log2 = AdminAuditLog(
        admin_id=admin_user.id,
        action=AdminAction.USER_UPDATE,
        target_type="user",
        target_id=regular_user.id,
        before_state={"is_active": True},
        after_state={"is_active": False},
        changes={"is_active": {"from": True, "to": False}},
        reason="Test suspension",
        success=True
    )
    logs.append(log2)
    
    # Failed operation log
    log3 = AdminAuditLog(
        admin_id=admin_user.id,
        action=AdminAction.USER_DELETE,
        target_type="user",
        target_id=uuid4(),
        success=False,
        error_message="User not found"
    )
    logs.append(log3)
    
    for log in logs:
        db_session.add(log)
    
    await db_session.commit()
    return logs


@pytest.fixture
def mock_request_context() -> Dict[str, Any]:
    """Mock request context for audit logging."""
    return {
        "ip_address": "127.0.0.1",
        "user_agent": "Mozilla/5.0 (Test)",
        "request_id": str(uuid4())
    }