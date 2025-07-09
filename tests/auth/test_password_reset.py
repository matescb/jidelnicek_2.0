"""
Integration tests for password reset functionality.

Tests cover:
- Password reset request with valid/invalid emails
- Reset token validation and expiration
- Password update and session invalidation
- Rate limiting for reset requests
"""

import pytest
from datetime import datetime, timedelta, timezone
from uuid import uuid4
import asyncio

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from jidelnicek.auth.models import (
    AuthUser, AuthPasswordResetToken, AuthSession, AuditLog
)
from jidelnicek.auth.utils.password import PasswordHasher


@pytest.mark.asyncio
class TestPasswordReset:
    """Test password reset functionality."""
    
    async def test_request_password_reset_success(
        self,
        async_client: AsyncClient,
        existing_user: AuthUser,
        db_session: AsyncSession
    ):
        """Test successful password reset request."""
        # Request password reset
        response = await async_client.post(
            "/api/auth/forgot-password",
            json={"email": existing_user.email}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        # Message should not reveal if email exists
        assert "if the email exists" in data["message"].lower()
        
        # Verify reset token was created
        result = await db_session.execute(
            select(AuthPasswordResetToken)
            .where(AuthPasswordResetToken.user_id == existing_user.id)
        )
        reset_token = result.scalar_one()
        
        assert reset_token is not None
        assert reset_token.token is not None
        assert reset_token.used_at is None
        assert reset_token.expires_at > datetime.now(timezone.utc)
        
        # Verify audit log entry
        result = await db_session.execute(
            select(AuditLog)
            .where(
                and_(
                    AuditLog.user_id == existing_user.id,
                    AuditLog.action == AuditLog.PASSWORD_RESET_REQUEST
                )
            )
            .order_by(AuditLog.created_at.desc())
        )
        audit_log = result.scalar_one()
        assert audit_log is not None
    
    async def test_request_password_reset_nonexistent_email(
        self,
        async_client: AsyncClient,
        db_session: AsyncSession
    ):
        """Test password reset request with non-existent email."""
        # Request with non-existent email
        response = await async_client.post(
            "/api/auth/forgot-password",
            json={"email": "nonexistent@example.com"}
        )
        
        # Should still return success (security)
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        assert "if the email exists" in data["message"].lower()
        
        # Verify no token was created
        result = await db_session.execute(
            select(AuthPasswordResetToken)
        )
        tokens = result.scalars().all()
        assert len(tokens) == 0
    
    async def test_password_reset_rate_limiting(
        self,
        async_client: AsyncClient,
        existing_user: AuthUser
    ):
        """Test rate limiting for password reset requests."""
        # Make 3 requests (the limit)
        for _ in range(3):
            response = await async_client.post(
                "/api/auth/forgot-password",
                json={"email": existing_user.email}
            )
            assert response.status_code == 200
        
        # 4th request should be rate limited but still return success
        response = await async_client.post(
            "/api/auth/forgot-password",
            json={"email": existing_user.email}
        )
        # Should still return 200 to not reveal rate limiting
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
    
    async def test_confirm_password_reset_success(
        self,
        async_client: AsyncClient,
        existing_user: AuthUser,
        db_session: AsyncSession
    ):
        """Test successful password reset confirmation."""
        # Create a valid reset token
        reset_token = AuthPasswordResetToken(
            user_id=existing_user.id,
            token=str(uuid4()),
            expires_at=datetime.now(timezone.utc) + timedelta(hours=1)
        )
        db_session.add(reset_token)
        
        # Create some active sessions to verify they get invalidated
        session1 = AuthSession(
            user_id=existing_user.id,
            token_hash="hash1",
            expires_at=datetime.now(timezone.utc) + timedelta(days=7),
            is_valid=True
        )
        session2 = AuthSession(
            user_id=existing_user.id,
            token_hash="hash2",
            expires_at=datetime.now(timezone.utc) + timedelta(days=7),
            is_valid=True
        )
        db_session.add_all([session1, session2])
        await db_session.commit()
        
        # Reset password
        new_password = "NewSecureP@ssw0rd123!"
        response = await async_client.post(
            "/api/auth/reset-password",
            json={
                "token": reset_token.token,
                "new_password": new_password
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        
        # Verify password was updated
        await db_session.refresh(existing_user)
        assert PasswordHasher.verify_password(new_password, existing_user.password_hash)
        
        # Verify token was marked as used
        await db_session.refresh(reset_token)
        assert reset_token.used_at is not None
        
        # Verify all sessions were invalidated
        result = await db_session.execute(
            select(AuthSession)
            .where(AuthSession.user_id == existing_user.id)
        )
        sessions = result.scalars().all()
        assert all(not session.is_valid for session in sessions)
        
        # Verify audit log
        result = await db_session.execute(
            select(AuditLog)
            .where(
                and_(
                    AuditLog.user_id == existing_user.id,
                    AuditLog.action == AuditLog.PASSWORD_RESET_COMPLETE
                )
            )
        )
        audit_log = result.scalar_one()
        assert audit_log is not None
        assert audit_log.changes["sessions_invalidated"] == 2
    
    async def test_confirm_password_reset_invalid_token(
        self,
        async_client: AsyncClient
    ):
        """Test password reset with invalid token."""
        response = await async_client.post(
            "/api/auth/reset-password",
            json={
                "token": str(uuid4()),  # Random token
                "new_password": "NewSecureP@ssw0rd123!"
            }
        )
        
        assert response.status_code == 400
        assert "invalid or expired" in response.json()["detail"].lower()
    
    async def test_confirm_password_reset_expired_token(
        self,
        async_client: AsyncClient,
        existing_user: AuthUser,
        db_session: AsyncSession
    ):
        """Test password reset with expired token."""
        # Create an expired token
        reset_token = AuthPasswordResetToken(
            user_id=existing_user.id,
            token=str(uuid4()),
            expires_at=datetime.now(timezone.utc) - timedelta(hours=1)  # Expired
        )
        db_session.add(reset_token)
        await db_session.commit()
        
        response = await async_client.post(
            "/api/auth/reset-password",
            json={
                "token": reset_token.token,
                "new_password": "NewSecureP@ssw0rd123!"
            }
        )
        
        assert response.status_code == 400
        assert "expired" in response.json()["detail"].lower()
    
    async def test_confirm_password_reset_used_token(
        self,
        async_client: AsyncClient,
        existing_user: AuthUser,
        db_session: AsyncSession
    ):
        """Test password reset with already used token."""
        # Create a used token
        reset_token = AuthPasswordResetToken(
            user_id=existing_user.id,
            token=str(uuid4()),
            expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
            used_at=datetime.now(timezone.utc)  # Already used
        )
        db_session.add(reset_token)
        await db_session.commit()
        
        response = await async_client.post(
            "/api/auth/reset-password",
            json={
                "token": reset_token.token,
                "new_password": "NewSecureP@ssw0rd123!"
            }
        )
        
        assert response.status_code == 400
        assert "already been used" in response.json()["detail"].lower()
    
    async def test_confirm_password_reset_weak_password(
        self,
        async_client: AsyncClient,
        existing_user: AuthUser,
        db_session: AsyncSession
    ):
        """Test password reset with weak password."""
        # Create a valid token
        reset_token = AuthPasswordResetToken(
            user_id=existing_user.id,
            token=str(uuid4()),
            expires_at=datetime.now(timezone.utc) + timedelta(hours=1)
        )
        db_session.add(reset_token)
        await db_session.commit()
        
        # Try to set a weak password
        response = await async_client.post(
            "/api/auth/reset-password",
            json={
                "token": reset_token.token,
                "new_password": "weak"
            }
        )
        
        assert response.status_code == 400
        errors = response.json()["detail"]["errors"]
        assert any("at least 12 characters" in error for error in errors)
    
    async def test_password_reset_invalidates_old_tokens(
        self,
        async_client: AsyncClient,
        existing_user: AuthUser,
        db_session: AsyncSession
    ):
        """Test that requesting new reset invalidates old tokens."""
        # Create an existing unused token
        old_token = AuthPasswordResetToken(
            user_id=existing_user.id,
            token=str(uuid4()),
            expires_at=datetime.now(timezone.utc) + timedelta(hours=1)
        )
        db_session.add(old_token)
        await db_session.commit()
        
        # Request new password reset
        response = await async_client.post(
            "/api/auth/forgot-password",
            json={"email": existing_user.email}
        )
        assert response.status_code == 200
        
        # Verify old token was invalidated
        await db_session.refresh(old_token)
        assert old_token.used_at is not None
        
        # Verify new token was created
        result = await db_session.execute(
            select(AuthPasswordResetToken)
            .where(
                and_(
                    AuthPasswordResetToken.user_id == existing_user.id,
                    AuthPasswordResetToken.used_at.is_(None)
                )
            )
        )
        new_token = result.scalar_one()
        assert new_token.id != old_token.id
    
    async def test_login_after_password_reset(
        self,
        async_client: AsyncClient,
        existing_user: AuthUser,
        db_session: AsyncSession
    ):
        """Test that user can login with new password after reset."""
        # Create and use a reset token
        reset_token = AuthPasswordResetToken(
            user_id=existing_user.id,
            token=str(uuid4()),
            expires_at=datetime.now(timezone.utc) + timedelta(hours=1)
        )
        db_session.add(reset_token)
        await db_session.commit()
        
        # Reset password
        new_password = "NewSecureP@ssw0rd123!"
        response = await async_client.post(
            "/api/auth/reset-password",
            json={
                "token": reset_token.token,
                "new_password": new_password
            }
        )
        assert response.status_code == 200
        
        # Try to login with old password (should fail)
        response = await async_client.post(
            "/api/auth/login",
            json={
                "email": existing_user.email,
                "password": "Test123!Pass"  # Original password
            }
        )
        assert response.status_code == 401
        
        # Login with new password (should succeed)
        response = await async_client.post(
            "/api/auth/login",
            json={
                "email": existing_user.email,
                "password": new_password
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data