"""
Integration tests for logout and token refresh functionality.

Tests cover:
- Single session logout
- All sessions logout
- Token refresh with valid refresh token
- Token refresh with invalid/expired token
- Token refresh with revoked session
- Blacklisted token rejection
"""

import pytest
from datetime import datetime, timedelta, timezone
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from redis.asyncio import Redis

from jidelnicek.auth.models import AuthUser, AuthSession, AuditLog
from jidelnicek.auth.services.token_service import TokenService
from jidelnicek.core.config import settings


@pytest.mark.asyncio
async def test_logout_single_session(
    async_client: AsyncClient,
    test_user: AuthUser,
    auth_headers: dict,
    db_session: AsyncSession,
    redis_client: Redis
):
    """Test logout from single session."""
    # Login to create a session
    login_response = await async_client.post(
        "/api/auth/login",
        json={
            "email": test_user.email,
            "password": "TestPassword123!"
        }
    )
    assert login_response.status_code == 200
    tokens = login_response.json()
    access_token = tokens["access_token"]
    refresh_token = tokens["refresh_token"]
    
    # Use the new access token for logout
    headers = {"Authorization": f"Bearer {access_token}"}
    
    # Verify session exists
    result = await db_session.execute(
        select(AuthSession).where(
            AuthSession.user_id == test_user.id,
            AuthSession.is_valid == True
        )
    )
    sessions_before = result.scalars().all()
    assert len(sessions_before) >= 1
    
    # Logout from current session
    response = await async_client.post(
        "/api/auth/logout",
        json={"all_sessions": False},
        headers=headers
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["sessions_revoked"] >= 1
    
    # Verify the access token is blacklisted
    token_service = TokenService(db_session, redis_client)
    is_blacklisted = await token_service.is_token_blacklisted(access_token)
    assert is_blacklisted is True
    
    # Try to use the blacklisted token
    response = await async_client.get(
        "/api/auth/me",
        headers=headers
    )
    assert response.status_code == 401
    
    # Verify audit log
    result = await db_session.execute(
        select(AuditLog).where(
            AuditLog.user_id == test_user.id,
            AuditLog.action == AuditLog.LOGOUT
        ).order_by(AuditLog.created_at.desc())
    )
    audit_log = result.scalars().first()
    assert audit_log is not None
    assert audit_log.changes["all_sessions"] is False


@pytest.mark.asyncio
async def test_logout_all_sessions(
    async_client: AsyncClient,
    test_user: AuthUser,
    db_session: AsyncSession,
    redis_client: Redis
):
    """Test logout from all sessions."""
    # Create multiple sessions by logging in multiple times
    tokens_list = []
    for i in range(3):
        login_response = await async_client.post(
            "/api/auth/login",
            json={
                "email": test_user.email,
                "password": "TestPassword123!"
            }
        )
        assert login_response.status_code == 200
        tokens_list.append(login_response.json())
    
    # Use the last token for logout
    headers = {"Authorization": f"Bearer {tokens_list[-1]['access_token']}"}
    
    # Verify multiple sessions exist
    result = await db_session.execute(
        select(AuthSession).where(
            AuthSession.user_id == test_user.id,
            AuthSession.is_valid == True
        )
    )
    sessions_before = result.scalars().all()
    assert len(sessions_before) >= 3
    
    # Logout from all sessions
    response = await async_client.post(
        "/api/auth/logout",
        json={"all_sessions": True},
        headers=headers
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["sessions_revoked"] >= 3
    
    # Verify all sessions are invalidated
    result = await db_session.execute(
        select(AuthSession).where(
            AuthSession.user_id == test_user.id,
            AuthSession.is_valid == True
        )
    )
    valid_sessions = result.scalars().all()
    assert len(valid_sessions) == 0
    
    # Try to use any of the old tokens
    for tokens in tokens_list:
        response = await async_client.get(
            "/api/auth/me",
            headers={"Authorization": f"Bearer {tokens['access_token']}"}
        )
        assert response.status_code == 401
    
    # Verify audit log
    result = await db_session.execute(
        select(AuditLog).where(
            AuditLog.user_id == test_user.id,
            AuditLog.action == AuditLog.LOGOUT
        ).order_by(AuditLog.created_at.desc())
    )
    audit_log = result.scalars().first()
    assert audit_log is not None
    assert audit_log.changes["all_sessions"] is True
    assert audit_log.changes["sessions_revoked"] >= 3


@pytest.mark.asyncio
async def test_token_refresh_success(
    async_client: AsyncClient,
    test_user: AuthUser,
    db_session: AsyncSession
):
    """Test successful token refresh."""
    # Login to get tokens
    login_response = await async_client.post(
        "/api/auth/login",
        json={
            "email": test_user.email,
            "password": "TestPassword123!"
        }
    )
    assert login_response.status_code == 200
    tokens = login_response.json()
    refresh_token = tokens["refresh_token"]
    old_access_token = tokens["access_token"]
    
    # Wait a moment to ensure new token has different timestamp
    import asyncio
    await asyncio.sleep(1)
    
    # Refresh token
    response = await async_client.post(
        "/api/auth/refresh",
        json={"refresh_token": refresh_token}
    )
    
    assert response.status_code == 200
    data = response.json()
    
    # Verify response structure
    assert "access_token" in data
    assert "refresh_token" in data
    assert "token_type" in data
    assert data["token_type"] == "Bearer"
    assert "expires_in" in data
    assert "user" in data
    
    # New access token should be different
    assert data["access_token"] != old_access_token
    
    # If rotation is disabled, refresh token should be the same
    if not settings.rotate_refresh_tokens:
        assert data["refresh_token"] == refresh_token
    
    # New access token should work
    headers = {"Authorization": f"Bearer {data['access_token']}"}
    response = await async_client.get("/api/auth/me", headers=headers)
    assert response.status_code == 200
    
    # Verify audit log
    result = await db_session.execute(
        select(AuditLog).where(
            AuditLog.user_id == test_user.id,
            AuditLog.action == "token_refreshed"
        ).order_by(AuditLog.created_at.desc())
    )
    audit_log = result.scalars().first()
    assert audit_log is not None


@pytest.mark.asyncio
async def test_token_refresh_with_invalid_token(
    async_client: AsyncClient,
    db_session: AsyncSession
):
    """Test token refresh with invalid refresh token."""
    # Try to refresh with invalid token
    response = await async_client.post(
        "/api/auth/refresh",
        json={"refresh_token": "invalid.refresh.token"}
    )
    
    assert response.status_code == 401
    assert "Invalid or expired refresh token" in response.json()["detail"]
    
    # Verify audit log for failed attempt
    result = await db_session.execute(
        select(AuditLog).where(
            AuditLog.action == "token_refresh_failed"
        ).order_by(AuditLog.created_at.desc())
    )
    audit_log = result.scalars().first()
    assert audit_log is not None
    assert audit_log.changes["reason"] == "invalid_or_expired_session"


@pytest.mark.asyncio
async def test_token_refresh_with_revoked_session(
    async_client: AsyncClient,
    test_user: AuthUser,
    db_session: AsyncSession
):
    """Test token refresh with revoked session."""
    # Login to get tokens
    login_response = await async_client.post(
        "/api/auth/login",
        json={
            "email": test_user.email,
            "password": "TestPassword123!"
        }
    )
    assert login_response.status_code == 200
    tokens = login_response.json()
    refresh_token = tokens["refresh_token"]
    
    # Logout to revoke session
    headers = {"Authorization": f"Bearer {tokens['access_token']}"}
    logout_response = await async_client.post(
        "/api/auth/logout",
        json={"all_sessions": True},
        headers=headers
    )
    assert logout_response.status_code == 200
    
    # Try to refresh with revoked session's token
    response = await async_client.post(
        "/api/auth/refresh",
        json={"refresh_token": refresh_token}
    )
    
    assert response.status_code == 401
    assert "Invalid or expired refresh token" in response.json()["detail"]


@pytest.mark.asyncio
async def test_token_refresh_with_inactive_user(
    async_client: AsyncClient,
    test_user: AuthUser,
    db_session: AsyncSession
):
    """Test token refresh when user becomes inactive."""
    # Login to get tokens
    login_response = await async_client.post(
        "/api/auth/login",
        json={
            "email": test_user.email,
            "password": "TestPassword123!"
        }
    )
    assert login_response.status_code == 200
    tokens = login_response.json()
    refresh_token = tokens["refresh_token"]
    
    # Deactivate user
    test_user.is_active = False
    await db_session.commit()
    
    # Try to refresh token
    response = await async_client.post(
        "/api/auth/refresh",
        json={"refresh_token": refresh_token}
    )
    
    assert response.status_code == 403
    assert "Account is inactive" in response.json()["detail"]
    
    # Verify audit log
    result = await db_session.execute(
        select(AuditLog).where(
            AuditLog.user_id == test_user.id,
            AuditLog.action == "token_refresh_failed"
        ).order_by(AuditLog.created_at.desc())
    )
    audit_log = result.scalars().first()
    assert audit_log is not None
    assert audit_log.changes["reason"] == "user_inactive"


@pytest.mark.asyncio
async def test_token_refresh_with_locked_user(
    async_client: AsyncClient,
    test_user: AuthUser,
    db_session: AsyncSession
):
    """Test token refresh when user account is locked."""
    # Login to get tokens
    login_response = await async_client.post(
        "/api/auth/login",
        json={
            "email": test_user.email,
            "password": "TestPassword123!"
        }
    )
    assert login_response.status_code == 200
    tokens = login_response.json()
    refresh_token = tokens["refresh_token"]
    
    # Lock user account
    test_user.locked_until = datetime.now(timezone.utc) + timedelta(hours=1)
    await db_session.commit()
    
    # Try to refresh token
    response = await async_client.post(
        "/api/auth/refresh",
        json={"refresh_token": refresh_token}
    )
    
    assert response.status_code == 403
    assert "Account is temporarily locked" in response.json()["detail"]
    
    # Verify audit log
    result = await db_session.execute(
        select(AuditLog).where(
            AuditLog.user_id == test_user.id,
            AuditLog.action == "token_refresh_failed"
        ).order_by(AuditLog.created_at.desc())
    )
    audit_log = result.scalars().first()
    assert audit_log is not None
    assert audit_log.changes["reason"] == "account_locked"


@pytest.mark.asyncio
async def test_logout_without_token(
    async_client: AsyncClient
):
    """Test logout without providing token."""
    response = await async_client.post(
        "/api/auth/logout",
        json={"all_sessions": False}
    )
    
    assert response.status_code == 401
    assert "Authentication required" in response.json()["detail"]


@pytest.mark.asyncio
async def test_blacklisted_token_rejection(
    async_client: AsyncClient,
    test_user: AuthUser,
    auth_headers: dict,
    db_session: AsyncSession,
    redis_client: Redis
):
    """Test that blacklisted tokens are properly rejected."""
    # Login to get fresh token
    login_response = await async_client.post(
        "/api/auth/login",
        json={
            "email": test_user.email,
            "password": "TestPassword123!"
        }
    )
    assert login_response.status_code == 200
    tokens = login_response.json()
    access_token = tokens["access_token"]
    headers = {"Authorization": f"Bearer {access_token}"}
    
    # Verify token works before blacklisting
    response = await async_client.get("/api/auth/me", headers=headers)
    assert response.status_code == 200
    
    # Blacklist the token
    token_service = TokenService(db_session, redis_client)
    await token_service.revoke_token(access_token)
    
    # Verify token is rejected after blacklisting
    response = await async_client.get("/api/auth/me", headers=headers)
    assert response.status_code == 401
    assert "Invalid token" in response.json()["detail"]