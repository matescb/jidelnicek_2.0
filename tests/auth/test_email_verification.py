"""
Integration tests for email verification functionality.

Tests the complete email verification workflow including:
- Token generation during registration
- Email verification endpoint
- Token expiration
- Resend verification functionality
- Rate limiting
"""

import secrets
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, patch
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from jidelnicek.auth.models import AuthUser, AuthEmailVerificationToken, AuditLog
from jidelnicek.auth.services.email_service import EmailService


@pytest.mark.asyncio
class TestEmailVerification:
    """Test suite for email verification functionality."""
    
    async def test_registration_creates_verification_token(
        self,
        async_async_client: AsyncClient,
        db_session: AsyncSession
    ):
        """Test that registration creates an email verification token."""
        # Register a new user
        registration_data = {
            "email": "test@example.com",
            "password": "SecurePass123!",
            "confirm_password": "SecurePass123!",
            "language": "en"
        }
        
        with patch.object(EmailService, 'send_verification_email', return_value=True) as mock_send:
            response = await async_client.post("/api/auth/register", json=registration_data)
        
        assert response.status_code == 201
        user_data = response.json()
        
        # Check that user was created
        result = await db_session.execute(
            select(AuthUser).where(AuthUser.email == "test@example.com")
        )
        user = result.scalar_one()
        assert user is not None
        assert not user.email_verified
        
        # Check that verification token was created
        result = await db_session.execute(
            select(AuthEmailVerificationToken).where(
                AuthEmailVerificationToken.user_id == user.id
            )
        )
        token = result.scalar_one()
        assert token is not None
        assert token.expires_at > datetime.now(timezone.utc)
        assert token.used_at is None
        
        # Check that email was sent
        mock_send.assert_called_once()
        call_args = mock_send.call_args
        assert call_args[0][0] == "test@example.com"
        assert len(call_args[0][1]) > 20  # Token should be reasonably long
        assert call_args[0][2] == "en"
    
    async def test_successful_email_verification(
        self,
        async_client: AsyncClient,
        db_session: AsyncSession,
        unverified_user: AuthUser
    ):
        """Test successful email verification with valid token."""
        # Create a verification token
        token_string = secrets.token_urlsafe(32)
        verification_token = AuthEmailVerificationToken(
            user_id=unverified_user.id,
            token=token_string,
            expires_at=datetime.now(timezone.utc) + timedelta(hours=24)
        )
        db_session.add(verification_token)
        await db_session.commit()
        
        # Verify the email
        response = await async_client.get(f"/api/auth/verify-email?token={token_string}")
        assert response.status_code == 200
        
        data = response.json()
        assert data["status"] == "success"
        assert data["message"] == "Email verified successfully"
        assert data["email"] == unverified_user.email
        
        # Check that user is now verified
        await db_session.refresh(test_user)
        assert unverified_user.email_verified
        assert unverified_user.email_verified_at is not None
        
        # Check that token is marked as used
        await db_session.refresh(verification_token)
        assert verification_token.used_at is not None
        
        # Check audit log
        result = await db_session.execute(
            select(AuditLog).where(
                AuditLog.user_id == unverified_user.id,
                AuditLog.action == AuditLog.EMAIL_VERIFIED
            )
        )
        audit_log = result.scalar_one()
        assert audit_log is not None
    
    async def test_expired_token_verification(
        self,
        async_client: AsyncClient,
        db_session: AsyncSession,
        unverified_user: AuthUser
    ):
        """Test email verification with expired token."""
        # Create an expired token
        token_string = secrets.token_urlsafe(32)
        verification_token = AuthEmailVerificationToken(
            user_id=unverified_user.id,
            token=token_string,
            expires_at=datetime.now(timezone.utc) - timedelta(hours=1)  # Expired
        )
        db_session.add(verification_token)
        await db_session.commit()
        
        # Try to verify with expired token
        response = await async_client.get(f"/api/auth/verify-email?token={token_string}")
        assert response.status_code == 400
        
        data = response.json()
        assert "expired" in data["detail"].lower()
        
        # Check that user is still not verified
        await db_session.refresh(test_user)
        assert not unverified_user.email_verified
    
    async def test_invalid_token_verification(
        self,
        async_client: AsyncClient,
        db_session: AsyncSession
    ):
        """Test email verification with invalid token."""
        # Try to verify with non-existent token
        response = await async_client.get("/api/auth/verify-email?token=invalid_token_12345")
        assert response.status_code == 404
        
        data = response.json()
        assert "invalid" in data["detail"].lower()
    
    async def test_already_used_token_verification(
        self,
        async_client: AsyncClient,
        db_session: AsyncSession,
        unverified_user: AuthUser
    ):
        """Test email verification with already used token."""
        # Create a used token
        token_string = secrets.token_urlsafe(32)
        verification_token = AuthEmailVerificationToken(
            user_id=unverified_user.id,
            token=token_string,
            expires_at=datetime.now(timezone.utc) + timedelta(hours=24),
            used_at=datetime.now(timezone.utc) - timedelta(minutes=30)  # Used
        )
        db_session.add(verification_token)
        await db_session.commit()
        
        # Try to verify with used token
        response = await async_client.get(f"/api/auth/verify-email?token={token_string}")
        assert response.status_code == 400
        
        data = response.json()
        assert "already been used" in data["detail"]
    
    async def test_already_verified_email(
        self,
        async_client: AsyncClient,
        db_session: AsyncSession,
        unverified_user: AuthUser
    ):
        """Test email verification when email is already verified."""
        # Mark user as already verified
        unverified_user.email_verified = True
        unverified_user.email_verified_at = datetime.now(timezone.utc)
        await db_session.commit()
        
        # Create a valid token
        token_string = secrets.token_urlsafe(32)
        verification_token = AuthEmailVerificationToken(
            user_id=unverified_user.id,
            token=token_string,
            expires_at=datetime.now(timezone.utc) + timedelta(hours=24)
        )
        db_session.add(verification_token)
        await db_session.commit()
        
        # Try to verify already verified email
        response = await async_client.get(f"/api/auth/verify-email?token={token_string}")
        assert response.status_code == 200
        
        data = response.json()
        assert data["status"] == "success"
        assert "already verified" in data["message"]
        
        # Check that token was still marked as used
        await db_session.refresh(verification_token)
        assert verification_token.used_at is not None
    
    async def test_resend_verification_success(
        self,
        async_client: AsyncClient,
        db_session: AsyncSession,
        unverified_user: AuthUser
    ):
        """Test successful resend of verification email."""
        # Ensure user is not verified
        unverified_user.email_verified = False
        await db_session.commit()
        
        with patch.object(EmailService, 'send_verification_email', return_value=True) as mock_send:
            response = await async_client.post(
                "/api/auth/resend-verification",
                json={"email": unverified_user.email}
            )
        
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        
        # Check that a new token was created
        result = await db_session.execute(
            select(AuthEmailVerificationToken).where(
                AuthEmailVerificationToken.user_id == unverified_user.id,
                AuthEmailVerificationToken.used_at.is_(None)
            )
        )
        new_token = result.scalar_one()
        assert new_token is not None
        assert new_token.expires_at > datetime.now(timezone.utc)
        
        # Check that email was sent
        mock_send.assert_called_once()
    
    async def test_resend_verification_already_verified(
        self,
        async_client: AsyncClient,
        db_session: AsyncSession,
        unverified_user: AuthUser
    ):
        """Test resend verification for already verified email."""
        # Mark user as verified
        unverified_user.email_verified = True
        unverified_user.email_verified_at = datetime.now(timezone.utc)
        await db_session.commit()
        
        response = await async_client.post(
            "/api/auth/resend-verification",
            json={"email": unverified_user.email}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "already verified" in data["message"]
    
    async def test_resend_verification_nonexistent_email(
        self,
        async_client: AsyncClient,
        db_session: AsyncSession
    ):
        """Test resend verification for non-existent email."""
        response = await async_client.post(
            "/api/auth/resend-verification",
            json={"email": "nonexistent@example.com"}
        )
        
        assert response.status_code == 200
        data = response.json()
        # Should not reveal whether email exists
        assert "If the email exists" in data["message"]
    
    async def test_resend_verification_rate_limiting(
        self,
        async_client: AsyncClient,
        db_session: AsyncSession,
        unverified_user: AuthUser,
        mock_redis
    ):
        """Test rate limiting on resend verification."""
        # Ensure user is not verified
        unverified_user.email_verified = False
        await db_session.commit()
        
        with patch.object(EmailService, 'send_verification_email', return_value=True):
            # First 3 requests should succeed
            for i in range(3):
                response = await async_client.post(
                    "/api/auth/resend-verification",
                    json={"email": unverified_user.email}
                )
                assert response.status_code == 200
            
            # 4th request should be rate limited
            response = await async_client.post(
                "/api/auth/resend-verification",
                json={"email": unverified_user.email}
            )
            assert response.status_code == 429
            assert "Too many verification email requests" in response.json()["detail"]
    
    async def test_resend_invalidates_old_tokens(
        self,
        async_client: AsyncClient,
        db_session: AsyncSession,
        unverified_user: AuthUser
    ):
        """Test that resending verification invalidates old tokens."""
        # Ensure user is not verified
        unverified_user.email_verified = False
        await db_session.commit()
        
        # Create an existing token
        old_token_string = secrets.token_urlsafe(32)
        old_token = AuthEmailVerificationToken(
            user_id=unverified_user.id,
            token=old_token_string,
            expires_at=datetime.now(timezone.utc) + timedelta(hours=24)
        )
        db_session.add(old_token)
        await db_session.commit()
        
        # Resend verification
        with patch.object(EmailService, 'send_verification_email', return_value=True):
            response = await async_client.post(
                "/api/auth/resend-verification",
                json={"email": unverified_user.email}
            )
        
        assert response.status_code == 200
        
        # Check that old token is now marked as used
        await db_session.refresh(old_token)
        assert old_token.used_at is not None
        
        # Try to use old token
        response = await async_client.get(f"/api/auth/verify-email?token={old_token_string}")
        assert response.status_code == 400
        assert "already been used" in response.json()["detail"]
    
    async def test_verified_user_dependency(
        self,
        async_client: AsyncClient,
        db_session: AsyncSession,
        unverified_user: AuthUser,
        unverified_auth_headers: dict,
        auth_headers: dict
    ):
        """Test that verified user dependency works correctly."""
        from jidelnicek.main import app
        from fastapi import Depends
        from jidelnicek.auth.dependencies.auth import CurrentVerifiedUser
        
        # Add a test endpoint that requires verified email
        @app.get("/test/verified-only")
        async def verified_only(user: CurrentVerifiedUser):
            return {"email": user.email}
        
        # Test with unverified user
        unverified_user.email_verified = False
        await db_session.commit()
        
        response = await async_client.get("/test/verified-only", headers=unverified_auth_headers)
        assert response.status_code == 403
        assert "Email verification required" in response.json()["detail"]
        
        # Test with verified user
        response = await async_client.get("/test/verified-only", headers=auth_headers)
        assert response.status_code == 200
        assert response.json()["email"] == "existing@example.com"  # This is the verified user from auth_headers