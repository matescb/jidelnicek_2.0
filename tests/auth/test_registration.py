"""
Integration tests for user registration endpoint.

Tests cover:
- Successful registration
- Validation errors
- Duplicate email handling
- Rate limiting
"""

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from jidelnicek.auth.models import AuthUser, AuthEmailVerificationToken
from jidelnicek.auth.schemas import UserCreateDTO


class TestRegistration:
    """Test cases for POST /api/auth/register endpoint."""
    
    async def test_successful_registration(
        self,
        async_client: AsyncClient,
        db_session: AsyncSession
    ):
        """Test successful user registration."""
        # Prepare test data
        registration_data = {
            "email": "newuser@example.com",
            "password": "SecurePass123!@#",
            "confirm_password": "SecurePass123!@#",
            "language": "en",
            "unit_system": "metric",
            "energy_unit": "kcal",
            "has_pku": False,
            "timezone": "Europe/Prague"
        }
        
        # Make registration request
        response = await async_client.post(
            "/api/auth/register",
            json=registration_data
        )
        
        # Assert response
        assert response.status_code == 201
        data = response.json()
        
        assert data["email"] == "newuser@example.com"
        assert data["email_verified"] is False
        assert data["language"] == "en"
        assert data["unit_system"] == "metric"
        assert data["energy_unit"] == "kcal"
        assert data["has_pku"] is False
        assert data["timezone"] == "Europe/Prague"
        assert data["role"] == "user"
        assert data["is_active"] is True
        assert "id" in data
        assert "created_at" in data
        assert "updated_at" in data
        
        # Verify user was created in database
        stmt = select(AuthUser).where(AuthUser.email == "newuser@example.com")
        result = await db_session.execute(stmt)
        user = result.scalar_one()
        
        assert user is not None
        assert user.email == "newuser@example.com"
        assert user.password_hash is not None
        assert user.email_verified is False
        
        # Verify email verification token was created
        stmt = select(AuthEmailVerificationToken).where(
            AuthEmailVerificationToken.user_id == user.id
        )
        result = await db_session.execute(stmt)
        token = result.scalar_one_or_none()
        
        assert token is not None
        assert token.is_valid is True
    
    async def test_registration_with_czech_language(
        self,
        async_client: AsyncClient,
        db_session: AsyncSession
    ):
        """Test registration with Czech language preference."""
        registration_data = {
            "email": "czech.user@example.com",
            "password": "BezpečnéHeslo123!",
            "confirm_password": "BezpečnéHeslo123!",
            "language": "cs",
            "unit_system": "metric",
            "energy_unit": "kJ",
            "has_pku": True,
            "timezone": "Europe/Prague"
        }
        
        response = await async_client.post(
            "/api/auth/register",
            json=registration_data
        )
        
        assert response.status_code == 201
        data = response.json()
        
        assert data["language"] == "cs"
        assert data["energy_unit"] == "kJ"
        assert data["has_pku"] is True
    
    async def test_registration_duplicate_email(
        self,
        async_client: AsyncClient,
        existing_user: AuthUser
    ):
        """Test registration with already existing email."""
        registration_data = {
            "email": existing_user.email,  # Use existing user's email
            "password": "SecurePass123!@#",
            "confirm_password": "SecurePass123!@#"
        }
        
        response = await async_client.post(
            "/api/auth/register",
            json=registration_data
        )
        
        assert response.status_code == 409
        assert response.json()["detail"] == "Email address is already registered"
    
    async def test_registration_duplicate_email_case_insensitive(
        self,
        async_client: AsyncClient,
        existing_user: AuthUser
    ):
        """Test that email uniqueness is case-insensitive."""
        # Try to register with uppercase version of existing email
        registration_data = {
            "email": existing_user.email.upper(),
            "password": "SecurePass123!@#",
            "confirm_password": "SecurePass123!@#"
        }
        
        response = await async_client.post(
            "/api/auth/register",
            json=registration_data
        )
        
        assert response.status_code == 409
        assert response.json()["detail"] == "Email address is already registered"
    
    async def test_registration_password_mismatch(
        self,
        async_client: AsyncClient
    ):
        """Test registration with mismatched passwords."""
        registration_data = {
            "email": "test@example.com",
            "password": "SecurePass123!@#",
            "confirm_password": "DifferentPass123!@#"
        }
        
        response = await async_client.post(
            "/api/auth/register",
            json=registration_data
        )
        
        assert response.status_code == 422
        errors = response.json()["detail"]
        assert any("Passwords do not match" in str(error) for error in errors)
    
    async def test_registration_weak_password(
        self,
        async_client: AsyncClient
    ):
        """Test registration with weak password."""
        # Test various weak passwords
        weak_passwords = [
            "short",  # Too short
            "alllowercase123!",  # No uppercase
            "ALLUPPERCASE123!",  # No lowercase
            "NoNumbers!@#",  # No digits
            "NoSpecialChars123",  # No special characters
            "Sequential123!@#",  # Contains sequential pattern
            "Repeated111!@#",  # Contains repeated characters
        ]
        
        for password in weak_passwords:
            registration_data = {
                "email": f"test_{password}@example.com",
                "password": password,
                "confirm_password": password
            }
            
            response = await async_client.post(
                "/api/auth/register",
                json=registration_data
            )
            
            assert response.status_code == 422
            assert "password" in str(response.json()["detail"]).lower()
    
    async def test_registration_password_contains_email(
        self,
        async_client: AsyncClient
    ):
        """Test registration with password containing email."""
        registration_data = {
            "email": "user@example.com",
            "password": "user@example.com123!A",
            "confirm_password": "user@example.com123!A"
        }
        
        response = await async_client.post(
            "/api/auth/register",
            json=registration_data
        )
        
        assert response.status_code == 422
        errors = response.json()["detail"]
        assert any("cannot contain parts of your email" in str(error) for error in errors)
    
    async def test_registration_invalid_email_format(
        self,
        async_client: AsyncClient
    ):
        """Test registration with invalid email format."""
        invalid_emails = [
            "notanemail",
            "@example.com",
            "user@",
            "user@@example.com",
            "user@example",
            "user example@test.com"
        ]
        
        for email in invalid_emails:
            registration_data = {
                "email": email,
                "password": "SecurePass123!@#",
                "confirm_password": "SecurePass123!@#"
            }
            
            response = await async_client.post(
                "/api/auth/register",
                json=registration_data
            )
            
            assert response.status_code == 422
            assert "email" in str(response.json()["detail"]).lower()
    
    async def test_registration_invalid_preferences(
        self,
        async_client: AsyncClient
    ):
        """Test registration with invalid preference values."""
        # Test invalid language
        registration_data = {
            "email": "test1@example.com",
            "password": "SecurePass123!@#",
            "confirm_password": "SecurePass123!@#",
            "language": "fr"  # Not supported
        }
        
        response = await async_client.post(
            "/api/auth/register",
            json=registration_data
        )
        
        assert response.status_code == 422
        assert "language" in str(response.json()["detail"]).lower()
        
        # Test invalid unit system
        registration_data["email"] = "test2@example.com"
        registration_data["language"] = "en"
        registration_data["unit_system"] = "invalid"
        
        response = await async_client.post(
            "/api/auth/register",
            json=registration_data
        )
        
        assert response.status_code == 422
        assert "unit_system" in str(response.json()["detail"]).lower()
        
        # Test invalid energy unit
        registration_data["email"] = "test3@example.com"
        registration_data["unit_system"] = "metric"
        registration_data["energy_unit"] = "invalid"
        
        response = await async_client.post(
            "/api/auth/register",
            json=registration_data
        )
        
        assert response.status_code == 422
        assert "energy_unit" in str(response.json()["detail"]).lower()
    
    async def test_registration_rate_limiting(
        self,
        async_client: AsyncClient,
        mock_redis
    ):
        """Test rate limiting on registration endpoint."""
        # Make 5 registration attempts (the limit)
        for i in range(5):
            registration_data = {
                "email": f"ratelimit{i}@example.com",
                "password": "SecurePass123!@#",
                "confirm_password": "SecurePass123!@#"
            }
            
            response = await async_client.post(
                "/api/auth/register",
                json=registration_data
            )
            
            # First 5 should succeed or fail normally
            assert response.status_code in [201, 409]
        
        # 6th attempt should be rate limited
        registration_data = {
            "email": "ratelimit6@example.com",
            "password": "SecurePass123!@#",
            "confirm_password": "SecurePass123!@#"
        }
        
        response = await async_client.post(
            "/api/auth/register",
            json=registration_data
        )
        
        assert response.status_code == 429
        assert "rate limit exceeded" in response.json()["detail"].lower()
        assert "Retry-After" in response.headers
    
    async def test_registration_email_normalization(
        self,
        async_client: AsyncClient,
        db_session: AsyncSession
    ):
        """Test that emails are normalized to lowercase."""
        registration_data = {
            "email": "MiXeDcAsE@ExAmPlE.CoM",
            "password": "SecurePass123!@#",
            "confirm_password": "SecurePass123!@#"
        }
        
        response = await async_client.post(
            "/api/auth/register",
            json=registration_data
        )
        
        assert response.status_code == 201
        data = response.json()
        
        # Email should be lowercase in response
        assert data["email"] == "mixedcase@example.com"
        
        # Verify in database
        stmt = select(AuthUser).where(AuthUser.email == "mixedcase@example.com")
        result = await db_session.execute(stmt)
        user = result.scalar_one()
        
        assert user.email == "mixedcase@example.com"
    
    async def test_registration_long_password(
        self,
        async_client: AsyncClient
    ):
        """Test registration with maximum length password."""
        # Create a 128-character password (the maximum)
        long_password = "A" * 100 + "bcdefghij1234567890!@#$%^&*()"
        
        registration_data = {
            "email": "longpass@example.com",
            "password": long_password,
            "confirm_password": long_password
        }
        
        response = await async_client.post(
            "/api/auth/register",
            json=registration_data
        )
        
        assert response.status_code == 201
    
    async def test_registration_too_long_password(
        self,
        async_client: AsyncClient
    ):
        """Test registration with password exceeding maximum length."""
        # Create a 129-character password (over the limit)
        too_long_password = "A" * 101 + "bcdefghij1234567890!@#$%^&*()"
        
        registration_data = {
            "email": "toolongpass@example.com",
            "password": too_long_password,
            "confirm_password": too_long_password
        }
        
        response = await async_client.post(
            "/api/auth/register",
            json=registration_data
        )
        
        assert response.status_code == 422
        assert "password" in str(response.json()["detail"]).lower()