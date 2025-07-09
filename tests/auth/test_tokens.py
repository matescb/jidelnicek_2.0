"""
Unit tests for JWT token functionality.

Tests token generation, validation, session management,
and various error conditions.
"""

import pytest
from datetime import datetime, timedelta, timezone
from uuid import uuid4
import jwt

from jidelnicek.auth.services.token_service import TokenService
from jidelnicek.auth.models import AuthUser, AuthSession
from jidelnicek.auth.exceptions import (
    TokenExpiredError,
    TokenInvalidError,
    SessionInvalidError,
    SessionExpiredError
)
from jidelnicek.core.config import settings


@pytest.fixture
def mock_user():
    """Create a mock user for testing."""
    return AuthUser(
        id=uuid4(),
        email="test@example.com",
        role="user",
        is_active=True,
        email_verified=True,
        is_archived=False
    )


@pytest.fixture
def mock_admin():
    """Create a mock admin user for testing."""
    return AuthUser(
        id=uuid4(),
        email="admin@example.com",
        role="admin",
        is_active=True,
        email_verified=True,
        is_archived=False
    )


@pytest.fixture
def token_service(db_session, redis_client):
    """Create token service instance."""
    return TokenService(db_session, redis_client)


class TestAccessTokenGeneration:
    """Test access token generation."""
    
    async def test_generate_access_token_user(self, token_service, mock_user):
        """Test generating access token for regular user."""
        token, expires_at = token_service.generate_access_token(mock_user)
        
        # Verify token is a string
        assert isinstance(token, str)
        assert len(token) > 0
        
        # Verify expiration time (24 hours)
        expected_expiry = datetime.now(timezone.utc) + timedelta(hours=24)
        assert abs((expires_at - expected_expiry).total_seconds()) < 5
        
        # Decode and verify payload
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        assert payload["sub"] == str(mock_user.id)
        assert payload["email"] == mock_user.email
        assert payload["role"] == "user"
        assert payload["type"] == "access"
        assert "iat" in payload
        assert "exp" in payload
    
    async def test_generate_access_token_admin(self, token_service, mock_admin):
        """Test generating access token for admin user."""
        token, expires_at = token_service.generate_access_token(mock_admin)
        
        # Decode and verify admin role
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        assert payload["role"] == "admin"
        assert payload["email"] == mock_admin.email


class TestRefreshTokenGeneration:
    """Test refresh token generation."""
    
    async def test_generate_refresh_token(self, token_service, mock_user):
        """Test generating refresh token."""
        token, expires_at = token_service.generate_refresh_token(mock_user)
        
        # Verify token is a string
        assert isinstance(token, str)
        assert len(token) > 0
        
        # Verify expiration time (7 days)
        expected_expiry = datetime.now(timezone.utc) + timedelta(days=7)
        assert abs((expires_at - expected_expiry).total_seconds()) < 5
        
        # Decode and verify payload
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        assert payload["sub"] == str(mock_user.id)
        assert payload["email"] == mock_user.email
        assert payload["type"] == "refresh"
        assert "jti" in payload  # JWT ID for tracking
        assert "iat" in payload
        assert "exp" in payload
    
    async def test_refresh_tokens_have_unique_jti(self, token_service, mock_user):
        """Test that refresh tokens have unique JWT IDs."""
        token1, _ = token_service.generate_refresh_token(mock_user)
        token2, _ = token_service.generate_refresh_token(mock_user)
        
        payload1 = jwt.decode(token1, settings.secret_key, algorithms=[settings.algorithm])
        payload2 = jwt.decode(token2, settings.secret_key, algorithms=[settings.algorithm])
        
        assert payload1["jti"] != payload2["jti"]


class TestTokenValidation:
    """Test token validation."""
    
    async def test_validate_valid_access_token(self, token_service, mock_user):
        """Test validating a valid access token."""
        token, _ = token_service.generate_access_token(mock_user)
        
        payload = token_service.validate_token(token, "access")
        
        assert payload["sub"] == str(mock_user.id)
        assert payload["email"] == mock_user.email
        assert payload["type"] == "access"
    
    async def test_validate_valid_refresh_token(self, token_service, mock_user):
        """Test validating a valid refresh token."""
        token, _ = token_service.generate_refresh_token(mock_user)
        
        payload = token_service.validate_token(token, "refresh")
        
        assert payload["sub"] == str(mock_user.id)
        assert payload["email"] == mock_user.email
        assert payload["type"] == "refresh"
    
    async def test_validate_wrong_token_type(self, token_service, mock_user):
        """Test validating token with wrong type."""
        access_token, _ = token_service.generate_access_token(mock_user)
        
        # Try to validate access token as refresh token
        with pytest.raises(TokenInvalidError) as exc:
            token_service.validate_token(access_token, "refresh")
        
        assert "Invalid refresh token" in str(exc.value)
    
    async def test_validate_expired_token(self, token_service, mock_user, monkeypatch):
        """Test validating an expired token."""
        # Generate token with very short expiry
        def mock_expire_time():
            return datetime.now(timezone.utc) - timedelta(seconds=1)
        
        monkeypatch.setattr(
            "jidelnicek.auth.services.token_service.get_utc_now",
            lambda: datetime.now(timezone.utc) - timedelta(hours=25)
        )
        
        token, _ = token_service.generate_access_token(mock_user)
        
        # Token should be expired
        with pytest.raises(TokenExpiredError) as exc:
            token_service.validate_token(token, "access")
        
        assert "expired" in str(exc.value).lower()
    
    async def test_validate_invalid_token(self, token_service):
        """Test validating an invalid token."""
        invalid_token = "invalid.token.here"
        
        with pytest.raises(TokenInvalidError):
            token_service.validate_token(invalid_token, "access")
    
    async def test_validate_tampered_token(self, token_service, mock_user):
        """Test validating a tampered token."""
        token, _ = token_service.generate_access_token(mock_user)
        
        # Tamper with token
        parts = token.split('.')
        tampered_token = f"{parts[0]}.tampered.{parts[2]}"
        
        with pytest.raises(TokenInvalidError):
            token_service.validate_token(tampered_token, "access")


class TestSessionManagement:
    """Test session management."""
    
    async def test_create_session(self, token_service, mock_user, db_session):
        """Test creating a session for refresh token."""
        token, expires_at = token_service.generate_refresh_token(mock_user)
        
        session = await token_service.create_session(
            user=mock_user,
            refresh_token=token,
            expires_at=expires_at,
            ip_address="192.168.1.1",
            user_agent="Test Browser"
        )
        
        assert session.user_id == mock_user.id
        assert session.expires_at == expires_at
        assert session.ip_address == "192.168.1.1"
        assert session.user_agent == "Test Browser"
        assert session.is_valid is True
        
        # Verify token is hashed
        assert session.token_hash != token
        assert len(session.token_hash) == 64  # SHA256 hex length
    
    async def test_validate_session_valid(self, token_service, mock_user, db_session):
        """Test validating a valid session."""
        token, expires_at = token_service.generate_refresh_token(mock_user)
        
        # Create session
        await token_service.create_session(
            user=mock_user,
            refresh_token=token,
            expires_at=expires_at
        )
        
        # Validate session
        session = await token_service.validate_session(token)
        
        assert session.user_id == mock_user.id
        assert session.is_valid is True
    
    async def test_validate_session_not_found(self, token_service, mock_user):
        """Test validating session that doesn't exist."""
        token, _ = token_service.generate_refresh_token(mock_user)
        
        # Don't create session
        with pytest.raises(SessionInvalidError):
            await token_service.validate_session(token)
    
    async def test_validate_session_expired(self, token_service, mock_user, db_session):
        """Test validating an expired session."""
        token, _ = token_service.generate_refresh_token(mock_user)
        
        # Create expired session
        expired_time = datetime.now(timezone.utc) - timedelta(hours=1)
        await token_service.create_session(
            user=mock_user,
            refresh_token=token,
            expires_at=expired_time
        )
        
        with pytest.raises(SessionExpiredError):
            await token_service.validate_session(token)
    
    async def test_revoke_session(self, token_service, mock_user, db_session):
        """Test revoking a session."""
        token, expires_at = token_service.generate_refresh_token(mock_user)
        
        # Create session
        session = await token_service.create_session(
            user=mock_user,
            refresh_token=token,
            expires_at=expires_at
        )
        
        # Revoke session
        await token_service.revoke_session(session.id)
        
        # Try to validate - should fail
        with pytest.raises(SessionInvalidError):
            await token_service.validate_session(token)
    
    async def test_revoke_all_user_sessions(self, token_service, mock_user, db_session):
        """Test revoking all user sessions."""
        # Create multiple sessions
        sessions = []
        for _ in range(3):
            token, expires_at = token_service.generate_refresh_token(mock_user)
            session = await token_service.create_session(
                user=mock_user,
                refresh_token=token,
                expires_at=expires_at
            )
            sessions.append((token, session))
        
        # Revoke all sessions
        count = await token_service.revoke_all_user_sessions(mock_user.id)
        assert count == 3
        
        # Verify all sessions are invalid
        for token, _ in sessions:
            with pytest.raises(SessionInvalidError):
                await token_service.validate_session(token)


class TestTokenBlacklisting:
    """Test token blacklisting with Redis."""
    
    async def test_revoke_token_with_redis(self, token_service, mock_user, redis_client):
        """Test revoking token adds to Redis blacklist."""
        token, _ = token_service.generate_access_token(mock_user)
        
        # Revoke token
        await token_service.revoke_token(token)
        
        # Check if blacklisted
        token_hash = token_service._hash_token(token)
        key = f"blacklist:token:{token_hash}"
        result = await redis_client.get(key)
        assert result == "1"
    
    async def test_validate_blacklisted_token(self, token_service, mock_user, db_session):
        """Test that blacklisted tokens are rejected during session validation."""
        token, expires_at = token_service.generate_refresh_token(mock_user)
        
        # Create session
        await token_service.create_session(
            user=mock_user,
            refresh_token=token,
            expires_at=expires_at
        )
        
        # Blacklist token
        await token_service.revoke_token(token)
        
        # Validation should fail
        with pytest.raises(SessionInvalidError):
            await token_service.validate_session(token)


class TestClaimExtraction:
    """Test claim extraction from tokens."""
    
    async def test_extract_claims_valid_token(self, token_service, mock_user):
        """Test extracting claims from valid token."""
        token, _ = token_service.generate_access_token(mock_user)
        
        claims = token_service.extract_claims(token)
        
        assert claims["sub"] == str(mock_user.id)
        assert claims["email"] == mock_user.email
        assert claims["role"] == "user"
        assert claims["type"] == "access"
    
    async def test_extract_claims_expired_token(self, token_service, mock_user, monkeypatch):
        """Test extracting claims from expired token."""
        # Generate expired token
        monkeypatch.setattr(
            "jidelnicek.auth.services.token_service.get_utc_now",
            lambda: datetime.now(timezone.utc) - timedelta(hours=25)
        )
        
        token, _ = token_service.generate_access_token(mock_user)
        
        # Should still extract claims (without validation)
        claims = token_service.extract_claims(token)
        assert claims["sub"] == str(mock_user.id)
    
    async def test_extract_claims_invalid_token(self, token_service):
        """Test extracting claims from invalid token."""
        invalid_token = "not.a.token"
        
        claims = token_service.extract_claims(invalid_token)
        assert claims == {}


class TestSessionCleanup:
    """Test session cleanup functionality."""
    
    async def test_cleanup_expired_sessions(self, token_service, mock_user, db_session):
        """Test cleaning up expired sessions."""
        # Create some expired sessions
        expired_time = datetime.now(timezone.utc) - timedelta(hours=1)
        for _ in range(3):
            token, _ = token_service.generate_refresh_token(mock_user)
            await token_service.create_session(
                user=mock_user,
                refresh_token=token,
                expires_at=expired_time
            )
        
        # Create one valid session
        valid_token, valid_expires = token_service.generate_refresh_token(mock_user)
        await token_service.create_session(
            user=mock_user,
            refresh_token=valid_token,
            expires_at=valid_expires
        )
        
        # Run cleanup
        cleaned = await token_service.cleanup_expired_sessions()
        assert cleaned == 3
        
        # Verify valid session still exists
        session = await token_service.validate_session(valid_token)
        assert session is not None