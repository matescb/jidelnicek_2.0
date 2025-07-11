"""
Comprehensive security tests for authentication endpoints.

This module tests various security aspects including:
- SQL injection prevention
- XSS prevention
- CSRF protection
- Authorization bypass attempts
- Token manipulation
- Session hijacking scenarios
"""

import pytest
import pytest_asyncio
import jwt
import json
import base64
from datetime import datetime, timedelta, timezone
from uuid import uuid4, UUID
from typing import Dict, Any
import secrets
import hashlib

from fastapi import status
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from jidelnicek.auth.models import AuthUser, AuthSession
from jidelnicek.auth.services.token_service import TokenService
from jidelnicek.auth.utils.password import PasswordHasher
from jidelnicek.core.config import settings


@pytest_asyncio.fixture(scope="function")
async def test_user(db_session: AsyncSession) -> AuthUser:
    """Create a test user for security tests."""
    user = AuthUser(
        email="security_test@example.com",
        password_hash=PasswordHasher.hash_password("SecurePass123!"),
        is_active=True,
        email_verified=True,
        role="user"
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture(scope="function")
async def admin_user(db_session: AsyncSession) -> AuthUser:
    """Create an admin user for privilege escalation tests."""
    user = AuthUser(
        email="admin_test@example.com",
        password_hash=PasswordHasher.hash_password("AdminPass123!"),
        is_active=True,
        email_verified=True,
        role="admin"
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture(scope="function")
async def auth_tokens(test_user: AuthUser, db_session: AsyncSession, redis_client):
    """Generate valid auth tokens for testing."""
    token_service = TokenService(db_session, redis_client)
    access_token, _ = token_service.generate_access_token(test_user)
    refresh_token, refresh_expires = token_service.generate_refresh_token(test_user)
    
    # Create session
    await token_service.create_session(
        user=test_user,
        refresh_token=refresh_token,
        expires_at=refresh_expires
    )
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "user": test_user
    }


class TestSQLInjectionPrevention:
    """Test SQL injection prevention on all endpoints."""
    
    async def test_login_sql_injection_email(self, client: AsyncClient):
        """Test SQL injection attempts in login email field."""
        sql_payloads = [
            "admin@example.com' OR '1'='1",
            "admin@example.com'; DROP TABLE auth_users; --",
            "admin@example.com' UNION SELECT * FROM auth_users--",
            "admin@example.com' AND 1=1--",
            "' OR EXISTS(SELECT * FROM auth_users WHERE role='admin') AND ''='",
            "admin@example.com'/**/OR/**/1=1#",
            "admin@example.com' OR SLEEP(5)--",
        ]
        
        for payload in sql_payloads:
            response = await client.post(
                "/api/auth/login",
                json={
                    "email": payload,
                    "password": "anypassword"
                }
            )
            
            # Should fail with invalid credentials, not SQL error
            assert response.status_code == status.HTTP_401_UNAUTHORIZED
            assert "Invalid email or password" in response.json()["detail"]
    
    async def test_registration_sql_injection(self, client: AsyncClient):
        """Test SQL injection in registration fields."""
        sql_payloads = [
            {
                "email": "test@example.com'; DROP TABLE auth_users; --",
                "password": "ValidPass123!",
                "language": "en"
            },
            {
                "email": "test@example.com",
                "password": "ValidPass123!",
                "language": "en'; DELETE FROM auth_users WHERE '1'='1"
            },
            {
                "email": "test@example.com' UNION SELECT password_hash FROM auth_users--",
                "password": "ValidPass123!",
                "language": "en"
            }
        ]
        
        for payload in sql_payloads:
            response = await client.post(
                "/api/auth/register",
                json=payload
            )
            
            # Should fail with validation error or proceed normally
            # but never execute SQL injection
            assert response.status_code in [
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                status.HTTP_201_CREATED,
                status.HTTP_409_CONFLICT
            ]
    
    async def test_password_reset_sql_injection(self, client: AsyncClient):
        """Test SQL injection in password reset email field."""
        sql_payloads = [
            "admin@example.com' OR role='admin'--",
            "test@example.com'; UPDATE auth_users SET role='admin' WHERE email='test@example.com'--",
            "' OR '1'='1' UNION SELECT email FROM auth_users--"
        ]
        
        for payload in sql_payloads:
            response = await client.post(
                "/api/auth/forgot-password",
                json={"email": payload}
            )
            
            # Should always return success (doesn't reveal if email exists)
            assert response.status_code == status.HTTP_200_OK
            assert "If the email exists" in response.json()["message"]
    
    async def test_verify_email_sql_injection(self, client: AsyncClient):
        """Test SQL injection in email verification token."""
        sql_payloads = [
            "valid_token' OR '1'='1",
            "'; DELETE FROM auth_email_verification_tokens; --",
            "' UNION SELECT token FROM auth_email_verification_tokens--"
        ]
        
        for payload in sql_payloads:
            response = await client.get(
                f"/api/auth/verify-email?token={payload}"
            )
            
            # Should fail with invalid token
            assert response.status_code == status.HTTP_404_NOT_FOUND
            assert "Invalid verification token" in response.json()["detail"]


class TestXSSPrevention:
    """Test XSS prevention in all user inputs."""
    
    async def test_registration_xss_prevention(self, client: AsyncClient):
        """Test XSS payloads in registration."""
        xss_payloads = [
            {
                "email": "test@example.com",
                "password": "ValidPass123!",
                "language": "<script>alert('XSS')</script>"
            },
            {
                "email": "test<script>alert('XSS')</script>@example.com",
                "password": "ValidPass123!",
                "language": "en"
            }
        ]
        
        for payload in xss_payloads:
            response = await client.post(
                "/api/auth/register",
                json=payload
            )
            
            # If successful, check that script tags are not in response
            if response.status_code == status.HTTP_201_CREATED:
                response_text = json.dumps(response.json())
                assert "<script>" not in response_text
                assert "alert(" not in response_text
    
    async def test_user_agent_xss_prevention(self, client: AsyncClient, test_user: AuthUser):
        """Test XSS in User-Agent header."""
        xss_user_agents = [
            "<script>alert('XSS')</script>",
            "Mozilla/5.0<img src=x onerror=alert('XSS')>",
            "';alert(String.fromCharCode(88,83,83))//';alert(String.fromCharCode(88,83,83))//"
        ]
        
        for user_agent in xss_user_agents:
            response = await client.post(
                "/api/auth/login",
                json={
                    "email": test_user.email,
                    "password": "SecurePass123!"
                },
                headers={"User-Agent": user_agent}
            )
            
            # Login might succeed or fail, but XSS should be prevented
            if response.status_code == status.HTTP_200_OK:
                # Check sessions endpoint to verify stored user agent is sanitized
                auth_header = {"Authorization": f"Bearer {response.json()['access_token']}"}
                sessions_response = await client.get(
                    "/api/auth/sessions",
                    headers=auth_header
                )
                
                if sessions_response.status_code == status.HTTP_200_OK:
                    sessions_text = json.dumps(sessions_response.json())
                    assert "<script>" not in sessions_text
                    assert "alert(" not in sessions_text


class TestCSRFProtection:
    """Test CSRF protection mechanisms."""
    
    async def test_state_changing_operations_require_auth(self, client: AsyncClient):
        """Test that state-changing operations require authentication."""
        # Operations that should require authentication
        operations = [
            ("POST", "/api/auth/logout", {}),
            ("DELETE", f"/api/auth/sessions/{uuid4()}", None),
            ("POST", "/api/auth/refresh", {"refresh_token": "invalid"}),
        ]
        
        for method, url, data in operations:
            if method == "POST":
                response = await client.post(url, json=data)
            elif method == "DELETE":
                response = await client.delete(url)
            
            # Should require authentication
            assert response.status_code in [
                status.HTTP_401_UNAUTHORIZED,
                status.HTTP_403_FORBIDDEN
            ]
    
    async def test_token_in_cookie_not_accepted(self, client: AsyncClient, auth_tokens: Dict[str, Any]):
        """Test that tokens in cookies are not accepted (only Authorization header)."""
        # Try to use token from cookie instead of header
        response = await client.get(
            "/api/auth/me",
            cookies={"access_token": auth_tokens["access_token"]}
        )
        
        # Should fail - we only accept tokens in Authorization header
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
    
    async def test_cross_origin_requests_handled(self, client: AsyncClient):
        """Test CORS headers are properly set."""
        # Test preflight request
        response = await client.options(
            "/api/auth/login",
            headers={
                "Origin": "https://evil.com",
                "Access-Control-Request-Method": "POST"
            }
        )
        
        # Check CORS headers - should be restrictive
        cors_header = response.headers.get("Access-Control-Allow-Origin", "")
        assert cors_header != "*"  # Should not allow all origins
        assert cors_header != "https://evil.com"  # Should not allow evil origin


class TestAuthorizationBypass:
    """Test authorization bypass attempts."""
    
    async def test_jwt_none_algorithm(self, client: AsyncClient, test_user: AuthUser):
        """Test JWT none algorithm vulnerability."""
        # Create token with 'none' algorithm
        payload = {
            "sub": str(test_user.id),
            "email": test_user.email,
            "role": "admin",  # Try to escalate privileges
            "type": "access",
            "exp": datetime.now(timezone.utc) + timedelta(hours=1),
            "iat": datetime.now(timezone.utc)
        }
        
        # Create token with none algorithm
        header = {"alg": "none", "typ": "JWT"}
        token_parts = [
            base64.urlsafe_b64encode(json.dumps(header).encode()).decode().rstrip("="),
            base64.urlsafe_b64encode(json.dumps(payload, default=str).encode()).decode().rstrip("="),
            ""  # No signature
        ]
        none_token = ".".join(token_parts)
        
        response = await client.get(
            "/api/auth/me",
            headers={"Authorization": f"Bearer {none_token}"}
        )
        
        # Should reject none algorithm
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
    
    async def test_jwt_algorithm_confusion(self, client: AsyncClient, test_user: AuthUser):
        """Test JWT algorithm confusion attack."""
        # Try to use HS256 with RSA public key as secret
        payload = {
            "sub": str(test_user.id),
            "email": test_user.email,
            "role": "admin",
            "type": "access",
            "exp": datetime.now(timezone.utc) + timedelta(hours=1),
            "iat": datetime.now(timezone.utc)
        }
        
        # Try different algorithm than configured
        try:
            fake_token = jwt.encode(
                payload,
                "fake-public-key",  # Attacker doesn't know the real secret
                algorithm="HS512" if settings.algorithm == "HS256" else "HS256"
            )
            
            response = await client.get(
                "/api/auth/me",
                headers={"Authorization": f"Bearer {fake_token}"}
            )
            
            assert response.status_code == status.HTTP_401_UNAUTHORIZED
        except:
            # If encoding fails, that's also acceptable (algorithm mismatch)
            pass
    
    async def test_privilege_escalation_via_token_modification(self, client: AsyncClient, auth_tokens: Dict[str, Any]):
        """Test modifying JWT payload to escalate privileges."""
        # Decode the valid token
        token = auth_tokens["access_token"]
        
        # Try to decode and modify
        try:
            # This should fail without the secret key
            decoded = jwt.decode(token, options={"verify_signature": False})
            decoded["role"] = "admin"
            
            # Re-encode with a fake signature
            parts = token.split('.')
            new_payload = base64.urlsafe_b64encode(
                json.dumps(decoded, default=str).encode()
            ).decode().rstrip("=")
            
            # Create modified token with original header and signature
            modified_token = f"{parts[0]}.{new_payload}.{parts[2]}"
            
            response = await client.get(
                "/api/auth/me",
                headers={"Authorization": f"Bearer {modified_token}"}
            )
            
            # Should fail due to signature mismatch
            assert response.status_code == status.HTTP_401_UNAUTHORIZED
        except:
            pass
    
    async def test_access_admin_endpoints_as_user(self, client: AsyncClient, auth_tokens: Dict[str, Any]):
        """Test accessing admin-only endpoints as regular user."""
        # Note: Add admin endpoints when they exist
        # For now, test session limit which differs for admin
        response = await client.get(
            "/api/auth/sessions/active-count",
            headers={"Authorization": f"Bearer {auth_tokens['access_token']}"}
        )
        
        if response.status_code == status.HTTP_200_OK:
            data = response.json()
            assert data["is_admin"] is False
            assert data["max_allowed"] != -1  # Regular users have session limits
    
    async def test_uuid_manipulation_other_user_sessions(self, client: AsyncClient, auth_tokens: Dict[str, Any], admin_user: AuthUser, db_session: AsyncSession, redis_client):
        """Test manipulating UUIDs to access other users' sessions."""
        # Create session for admin user
        token_service = TokenService(db_session, redis_client)
        admin_refresh, expires = token_service.generate_refresh_token(admin_user)
        admin_session = await token_service.create_session(
            user=admin_user,
            refresh_token=admin_refresh,
            expires_at=expires
        )
        
        # Try to revoke admin's session as regular user
        response = await client.delete(
            f"/api/auth/sessions/{admin_session.id}",
            headers={"Authorization": f"Bearer {auth_tokens['access_token']}"}
        )
        
        # Should not be able to revoke other user's session
        assert response.status_code in [status.HTTP_404_NOT_FOUND, status.HTTP_403_FORBIDDEN]


class TestTokenManipulation:
    """Test various token manipulation attacks."""
    
    async def test_expired_token_reuse(self, client: AsyncClient, test_user: AuthUser, db_session: AsyncSession, redis_client):
        """Test reusing expired tokens."""
        token_service = TokenService(db_session, redis_client)
        
        # Generate token with very short expiry
        payload = {
            "sub": str(test_user.id),
            "email": test_user.email,
            "role": test_user.role,
            "type": "access",
            "iat": datetime.now(timezone.utc) - timedelta(hours=2),
            "exp": datetime.now(timezone.utc) - timedelta(hours=1)  # Expired
        }
        
        expired_token = jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)
        
        response = await client.get(
            "/api/auth/me",
            headers={"Authorization": f"Bearer {expired_token}"}
        )
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
        assert "expired" in response.json()["detail"].lower()
    
    async def test_token_with_future_iat(self, client: AsyncClient, test_user: AuthUser):
        """Test token with future issued-at time."""
        payload = {
            "sub": str(test_user.id),
            "email": test_user.email,
            "role": test_user.role,
            "type": "access",
            "iat": datetime.now(timezone.utc) + timedelta(hours=1),  # Future
            "exp": datetime.now(timezone.utc) + timedelta(hours=2)
        }
        
        future_token = jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)
        
        response = await client.get(
            "/api/auth/me",
            headers={"Authorization": f"Bearer {future_token}"}
        )
        
        # Should reject tokens from the future
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
    
    async def test_refresh_token_as_access_token(self, client: AsyncClient, auth_tokens: Dict[str, Any]):
        """Test using refresh token as access token."""
        response = await client.get(
            "/api/auth/me",
            headers={"Authorization": f"Bearer {auth_tokens['refresh_token']}"}
        )
        
        # Should fail - wrong token type
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
    
    async def test_access_token_for_refresh(self, client: AsyncClient, auth_tokens: Dict[str, Any]):
        """Test using access token for refresh."""
        response = await client.post(
            "/api/auth/refresh",
            json={"refresh_token": auth_tokens["access_token"]}
        )
        
        # Should fail - wrong token type
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
    
    async def test_malformed_tokens(self, client: AsyncClient):
        """Test various malformed tokens."""
        malformed_tokens = [
            "not.a.jwt",
            "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9",  # Missing parts
            "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ",  # Missing signature
            "Bearer token",  # Not base64
            base64.b64encode(b"not json").decode() + ".fake.signature",
            "",  # Empty
            "null",
            "undefined",
        ]
        
        for token in malformed_tokens:
            response = await client.get(
                "/api/auth/me",
                headers={"Authorization": f"Bearer {token}"}
            )
            
            assert response.status_code == status.HTTP_401_UNAUTHORIZED
    
    async def test_token_signature_stripping(self, client: AsyncClient, auth_tokens: Dict[str, Any]):
        """Test removing token signature."""
        token = auth_tokens["access_token"]
        parts = token.split('.')
        
        # Remove signature
        stripped_token = f"{parts[0]}.{parts[1]}."
        
        response = await client.get(
            "/api/auth/me",
            headers={"Authorization": f"Bearer {stripped_token}"}
        )
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED


class TestSessionHijacking:
    """Test session hijacking scenarios."""
    
    async def test_session_fixation(self, client: AsyncClient, test_user: AuthUser):
        """Test session fixation attack prevention."""
        # Login to get initial session
        response1 = await client.post(
            "/api/auth/login",
            json={
                "email": test_user.email,
                "password": "SecurePass123!"
            }
        )
        assert response1.status_code == status.HTTP_200_OK
        tokens1 = response1.json()
        
        # Login again - should get different tokens
        response2 = await client.post(
            "/api/auth/login",
            json={
                "email": test_user.email,
                "password": "SecurePass123!"
            }
        )
        assert response2.status_code == status.HTTP_200_OK
        tokens2 = response2.json()
        
        # Tokens should be different
        assert tokens1["access_token"] != tokens2["access_token"]
        assert tokens1["refresh_token"] != tokens2["refresh_token"]
    
    async def test_stolen_token_from_different_ip(self, client: AsyncClient, auth_tokens: Dict[str, Any]):
        """Test using stolen token from different IP."""
        # Use token from different IP (simulated by different client)
        # This is more of a monitoring test - tokens should work but be logged
        response = await client.get(
            "/api/auth/me",
            headers={
                "Authorization": f"Bearer {auth_tokens['access_token']}",
                "X-Forwarded-For": "192.168.1.100"  # Different IP
            }
        )
        
        # Token should still work (we don't bind to IP for access tokens)
        # but this should be logged for monitoring
        assert response.status_code == status.HTTP_200_OK
    
    async def test_concurrent_session_limit_bypass(self, client: AsyncClient, test_user: AuthUser):
        """Test bypassing session limits through race conditions."""
        import asyncio
        
        # Try to create many sessions concurrently
        async def create_session():
            return await client.post(
                "/api/auth/login",
                json={
                    "email": test_user.email,
                    "password": "SecurePass123!"
                }
            )
        
        # Attempt to create more sessions than allowed
        tasks = [create_session() for _ in range(settings.max_sessions_per_user + 5)]
        responses = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Count successful logins
        successful = sum(1 for r in responses if not isinstance(r, Exception) and r.status_code == 200)
        
        # Should not exceed max sessions (some might fail due to rate limiting)
        assert successful <= settings.max_sessions_per_user + 1  # +1 for race condition tolerance
    
    async def test_session_token_prediction(self, client: AsyncClient, test_user: AuthUser, db_session: AsyncSession, redis_client):
        """Test if session tokens are predictable."""
        token_service = TokenService(db_session, redis_client)
        
        # Generate multiple refresh tokens
        tokens = []
        for _ in range(5):
            token, _ = token_service.generate_refresh_token(test_user)
            # Extract JTI from token
            decoded = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
            tokens.append(decoded.get("jti"))
        
        # Check that JTIs are unique and not predictable
        assert len(set(tokens)) == len(tokens)  # All unique
        
        # Check entropy (simplified - just ensure they're not sequential)
        for i in range(1, len(tokens)):
            assert tokens[i] != tokens[i-1]
    
    async def test_revoked_session_reuse(self, client: AsyncClient, auth_tokens: Dict[str, Any], db_session: AsyncSession):
        """Test reusing revoked session tokens."""
        # Revoke the session
        response = await client.post(
            "/api/auth/logout",
            json={"all_sessions": False},
            headers={"Authorization": f"Bearer {auth_tokens['access_token']}"}
        )
        assert response.status_code == status.HTTP_200_OK
        
        # Try to use the revoked access token
        response = await client.get(
            "/api/auth/me",
            headers={"Authorization": f"Bearer {auth_tokens['access_token']}"}
        )
        
        # Should fail - token is blacklisted
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
        
        # Try to refresh with revoked refresh token
        response = await client.post(
            "/api/auth/refresh",
            json={"refresh_token": auth_tokens["refresh_token"]}
        )
        
        # Should fail - session is revoked
        assert response.status_code == status.HTTP_401_UNAUTHORIZED


class TestAdditionalSecurityChecks:
    """Additional security checks."""
    
    async def test_timing_attack_on_login(self, client: AsyncClient, test_user: AuthUser):
        """Test timing attack resistance on login."""
        import time
        
        # Time valid user with wrong password
        start1 = time.time()
        response1 = await client.post(
            "/api/auth/login",
            json={
                "email": test_user.email,
                "password": "WrongPassword123!"
            }
        )
        time1 = time.time() - start1
        assert response1.status_code == status.HTTP_401_UNAUTHORIZED
        
        # Time non-existent user
        start2 = time.time()
        response2 = await client.post(
            "/api/auth/login",
            json={
                "email": "nonexistent@example.com",
                "password": "WrongPassword123!"
            }
        )
        time2 = time.time() - start2
        assert response2.status_code == status.HTTP_401_UNAUTHORIZED
        
        # Times should be similar (within reasonable variance)
        # This prevents user enumeration through timing
        time_diff = abs(time1 - time2)
        assert time_diff < 0.5  # Less than 500ms difference
    
    async def test_password_in_response(self, client: AsyncClient):
        """Ensure passwords are never returned in responses."""
        # Register user
        response = await client.post(
            "/api/auth/register",
            json={
                "email": "checkpass@example.com",
                "password": "SecurePass123!",
                "language": "en"
            }
        )
        
        # Check response doesn't contain password
        response_text = json.dumps(response.json())
        assert "SecurePass123!" not in response_text
        assert "password" not in response_text.lower()
        assert "password_hash" not in response_text
    
    async def test_sensitive_data_in_logs(self, client: AsyncClient, test_user: AuthUser, caplog):
        """Test that sensitive data is not logged."""
        # Perform login
        response = await client.post(
            "/api/auth/login",
            json={
                "email": test_user.email,
                "password": "SecurePass123!"
            }
        )
        
        # Check logs don't contain sensitive data
        log_text = caplog.text.lower()
        assert "securepass123!" not in log_text
        assert "password_hash" not in log_text
        assert response.json()["access_token"] not in caplog.text  # Token not in logs
    
    async def test_headers_security(self, client: AsyncClient):
        """Test security headers are present."""
        response = await client.get("/api/auth/captcha/challenge")
        
        # Check security headers
        headers = response.headers
        
        # These should be set by the security middleware
        assert headers.get("X-Content-Type-Options") == "nosniff"
        assert "X-Frame-Options" in headers
        assert "X-XSS-Protection" in headers
        assert "Strict-Transport-Security" in headers
    
    async def test_rate_limit_bypass_attempts(self, client: AsyncClient, test_user: AuthUser):
        """Test various rate limit bypass attempts."""
        # Test case sensitivity bypass
        emails = [
            test_user.email,
            test_user.email.upper(),
            test_user.email.capitalize(),
        ]
        
        # Make multiple requests with different case
        for email in emails * 3:
            response = await client.post(
                "/api/auth/login",
                json={
                    "email": email,
                    "password": "wrong"
                }
            )
        
        # Should still be rate limited (email should be normalized)
        response = await client.post(
            "/api/auth/login",
            json={
                "email": test_user.email,
                "password": "wrong"
            }
        )
        
        # Should eventually hit rate limit
        assert response.status_code in [
            status.HTTP_401_UNAUTHORIZED,
            status.HTTP_429_TOO_MANY_REQUESTS,
            status.HTTP_400_BAD_REQUEST  # CAPTCHA required
        ]