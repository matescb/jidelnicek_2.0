"""
Integration tests for login endpoint.

These tests verify the login functionality including:
- Successful authentication
- Invalid credentials handling
- Account lockout after failed attempts
- Rate limiting
- Progressive delays
- Case-insensitive email
"""

import asyncio
from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from jidelnicek.auth.models import AuthUser, AuthSession, AuditLog
from jidelnicek.auth.utils.password import PasswordHasher
from jidelnicek.auth.services.user_service import UserService


@pytest.fixture
async def test_user(db_session: AsyncSession) -> AuthUser:
    """Create a test user for login tests."""
    user = AuthUser(
        email="test@example.com",
        password_hash=PasswordHasher.hash_password("ValidPassword123!"),
        language="en",
        unit_system="metric",
        energy_unit="kcal",
        has_pku=False,
        timezone="UTC",
        is_active=True,
        email_verified=True,  # Email verification not required for login
        role="user"
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest.fixture
async def inactive_user(db_session: AsyncSession) -> AuthUser:
    """Create an inactive test user."""
    user = AuthUser(
        email="inactive@example.com",
        password_hash=PasswordHasher.hash_password("ValidPassword123!"),
        is_active=False,
        email_verified=True
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest.fixture
async def locked_user(db_session: AsyncSession) -> AuthUser:
    """Create a locked test user."""
    user = AuthUser(
        email="locked@example.com",
        password_hash=PasswordHasher.hash_password("ValidPassword123!"),
        is_active=True,
        email_verified=True,
        failed_login_attempts=5,
        locked_until=datetime.now(timezone.utc) + timedelta(hours=1)
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


class TestLoginEndpoint:
    """Test cases for the login endpoint."""
    
    async def test_successful_login(
        self,
        client: AsyncClient,
        test_user: AuthUser,
        db_session: AsyncSession
    ):
        """Test successful login with valid credentials."""
        response = await client.post(
            "/api/auth/login",
            json={
                "email": "test@example.com",
                "password": "ValidPassword123!"
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Check response structure
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["token_type"] == "Bearer"
        assert "expires_in" in data
        assert "user" in data
        
        # Check user data
        user_data = data["user"]
        assert user_data["email"] == test_user.email
        assert user_data["id"] == str(test_user.id)
        assert user_data["email_verified"] is True
        
        # Verify session was created
        session = await db_session.execute(
            AuthSession.__table__.select().where(
                AuthSession.user_id == test_user.id
            )
        )
        session_record = session.first()
        assert session_record is not None
        
        # Verify last login was updated
        await db_session.refresh(test_user)
        assert test_user.last_login is not None
        assert (datetime.now(timezone.utc) - test_user.last_login).seconds < 5
        
        # Verify audit log
        audit_log = await db_session.execute(
            AuditLog.__table__.select().where(
                AuditLog.user_id == test_user.id,
                AuditLog.action == AuditLog.LOGIN_SUCCESS
            )
        )
        audit_record = audit_log.first()
        assert audit_record is not None
    
    async def test_login_case_insensitive_email(
        self,
        client: AsyncClient,
        test_user: AuthUser
    ):
        """Test login with different email case."""
        response = await client.post(
            "/api/auth/login",
            json={
                "email": "TEST@EXAMPLE.COM",  # Upper case
                "password": "ValidPassword123!"
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["user"]["email"] == test_user.email.lower()
    
    async def test_login_invalid_email(
        self,
        client: AsyncClient,
        db_session: AsyncSession
    ):
        """Test login with non-existent email."""
        response = await client.post(
            "/api/auth/login",
            json={
                "email": "nonexistent@example.com",
                "password": "SomePassword123!"
            }
        )
        
        assert response.status_code == 401
        assert response.json()["detail"] == "Invalid email or password"
        
        # Verify audit log
        audit_log = await db_session.execute(
            AuditLog.__table__.select().where(
                AuditLog.action == AuditLog.LOGIN_FAILED
            ).order_by(AuditLog.created_at.desc())
        )
        audit_record = audit_log.first()
        assert audit_record is not None
        assert audit_record.changes["reason"] == "user_not_found"
    
    async def test_login_invalid_password(
        self,
        client: AsyncClient,
        test_user: AuthUser,
        db_session: AsyncSession
    ):
        """Test login with wrong password."""
        response = await client.post(
            "/api/auth/login",
            json={
                "email": test_user.email,
                "password": "WrongPassword123!"
            }
        )
        
        assert response.status_code == 401
        assert response.json()["detail"] == "Invalid email or password"
        
        # Verify failed login attempt was recorded
        await db_session.refresh(test_user)
        assert test_user.failed_login_attempts == 1
        
        # Verify audit log
        audit_log = await db_session.execute(
            AuditLog.__table__.select().where(
                AuditLog.user_id == test_user.id,
                AuditLog.action == AuditLog.LOGIN_FAILED
            )
        )
        audit_record = audit_log.first()
        assert audit_record is not None
        assert audit_record.changes["reason"] == "invalid_password"
    
    async def test_login_inactive_account(
        self,
        client: AsyncClient,
        inactive_user: AuthUser,
        db_session: AsyncSession
    ):
        """Test login with inactive account."""
        response = await client.post(
            "/api/auth/login",
            json={
                "email": inactive_user.email,
                "password": "ValidPassword123!"
            }
        )
        
        assert response.status_code == 403
        assert response.json()["detail"] == "Account is inactive"
        
        # Verify audit log
        audit_log = await db_session.execute(
            AuditLog.__table__.select().where(
                AuditLog.user_id == inactive_user.id,
                AuditLog.action == AuditLog.LOGIN_FAILED
            )
        )
        audit_record = audit_log.first()
        assert audit_record is not None
        assert audit_record.changes["reason"] == "account_inactive"
    
    async def test_login_locked_account(
        self,
        client: AsyncClient,
        locked_user: AuthUser,
        db_session: AsyncSession
    ):
        """Test login with locked account."""
        response = await client.post(
            "/api/auth/login",
            json={
                "email": locked_user.email,
                "password": "ValidPassword123!"
            }
        )
        
        assert response.status_code == 423
        assert response.json()["detail"] == "Account is locked due to too many failed login attempts"
        
        # Verify audit log
        audit_log = await db_session.execute(
            AuditLog.__table__.select().where(
                AuditLog.user_id == locked_user.id,
                AuditLog.action == AuditLog.LOGIN_FAILED
            )
        )
        audit_record = audit_log.first()
        assert audit_record is not None
        assert audit_record.changes["reason"] == "account_locked"
    
    async def test_progressive_delays(
        self,
        client: AsyncClient,
        test_user: AuthUser,
        db_session: AsyncSession
    ):
        """Test progressive delays after failed login attempts."""
        # First 2 attempts - no delay
        for i in range(2):
            start_time = asyncio.get_event_loop().time()
            response = await client.post(
                "/api/auth/login",
                json={
                    "email": test_user.email,
                    "password": "WrongPassword123!"
                }
            )
            elapsed = asyncio.get_event_loop().time() - start_time
            
            assert response.status_code == 401
            assert elapsed < 2  # Should be fast (no delay)
        
        # 3rd attempt - 5 second delay
        start_time = asyncio.get_event_loop().time()
        response = await client.post(
            "/api/auth/login",
            json={
                "email": test_user.email,
                "password": "WrongPassword123!"
            }
        )
        elapsed = asyncio.get_event_loop().time() - start_time
        
        assert response.status_code == 401
        assert 5 <= elapsed < 7  # 5 second delay
        
        # Verify failed attempts count
        await db_session.refresh(test_user)
        assert test_user.failed_login_attempts == 3
    
    async def test_account_lockout_after_5_attempts(
        self,
        client: AsyncClient,
        test_user: AuthUser,
        db_session: AsyncSession
    ):
        """Test account lockout after 5 failed attempts."""
        # Make 4 failed attempts first
        test_user.failed_login_attempts = 4
        await db_session.commit()
        
        # 5th failed attempt should lock the account
        response = await client.post(
            "/api/auth/login",
            json={
                "email": test_user.email,
                "password": "WrongPassword123!"
            }
        )
        
        assert response.status_code == 423
        assert response.json()["detail"] == "Account is locked due to too many failed login attempts"
        
        # Verify account is locked
        await db_session.refresh(test_user)
        assert test_user.failed_login_attempts == 5
        assert test_user.locked_until is not None
        assert test_user.locked_until > datetime.now(timezone.utc)
        
        # Verify audit log for lockout
        audit_log = await db_session.execute(
            AuditLog.__table__.select().where(
                AuditLog.user_id == test_user.id,
                AuditLog.action == AuditLog.ACCOUNT_LOCKED
            )
        )
        audit_record = audit_log.first()
        assert audit_record is not None
    
    async def test_successful_login_resets_failed_attempts(
        self,
        client: AsyncClient,
        test_user: AuthUser,
        db_session: AsyncSession
    ):
        """Test that successful login resets failed attempts."""
        # Set some failed attempts
        test_user.failed_login_attempts = 3
        await db_session.commit()
        
        # Successful login
        response = await client.post(
            "/api/auth/login",
            json={
                "email": test_user.email,
                "password": "ValidPassword123!"
            }
        )
        
        assert response.status_code == 200
        
        # Verify failed attempts reset
        await db_session.refresh(test_user)
        assert test_user.failed_login_attempts == 0
        assert test_user.locked_until is None
    
    @pytest.mark.skip(reason="Rate limiting tests require Redis and multiple requests")
    async def test_ip_rate_limiting(self, client: AsyncClient):
        """Test IP-based rate limiting (5 attempts per hour)."""
        # This test would require Redis to be available and
        # would need to make 6 requests to trigger rate limit
        pass
    
    @pytest.mark.skip(reason="Rate limiting tests require Redis and multiple requests")
    async def test_account_rate_limiting(self, client: AsyncClient, test_user: AuthUser):
        """Test account-based rate limiting (10 attempts per hour)."""
        # This test would require Redis to be available and
        # would need to make 11 requests to trigger rate limit
        pass
    
    async def test_login_validation_errors(self, client: AsyncClient):
        """Test login with invalid input data."""
        # Missing email
        response = await client.post(
            "/api/auth/login",
            json={"password": "ValidPassword123!"}
        )
        assert response.status_code == 422
        
        # Missing password
        response = await client.post(
            "/api/auth/login",
            json={"email": "test@example.com"}
        )
        assert response.status_code == 422
        
        # Invalid email format
        response = await client.post(
            "/api/auth/login",
            json={
                "email": "invalid-email",
                "password": "ValidPassword123!"
            }
        )
        assert response.status_code == 422