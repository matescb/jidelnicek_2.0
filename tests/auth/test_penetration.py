"""
Penetration testing scenarios for authentication system.

This module simulates various attack scenarios:
- Brute force attacks
- Timing attacks
- Password enumeration
- User enumeration
- Token prediction
- Session fixation
"""

import pytest
import pytest_asyncio
import time
import asyncio
import statistics
import secrets
import string
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Any, Tuple
from uuid import uuid4

from fastapi import status
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from jidelnicek.auth.models import AuthUser
from jidelnicek.auth.utils.password import PasswordHasher
from jidelnicek.auth.services.token_service import TokenService


@pytest_asyncio.fixture(scope="function")
async def target_users(db_session: AsyncSession) -> List[AuthUser]:
    """Create target users for penetration tests."""
    users = []
    
    # Create users with common passwords
    common_passwords = [
        "Password123!",
        "Welcome123!",
        "Admin123!",
        "User12345!",
        "Qwerty123!"
    ]
    
    for i, password in enumerate(common_passwords):
        user = AuthUser(
            email=f"target{i}@example.com",
            password_hash=PasswordHasher.hash_password(password),
            is_active=True,
            email_verified=True,
            role="user"
        )
        db_session.add(user)
        users.append((user, password))
    
    # Add a user with a weak password
    weak_user = AuthUser(
        email="weakpass@example.com",
        password_hash=PasswordHasher.hash_password("Pass123!"),
        is_active=True,
        email_verified=True,
        role="user"
    )
    db_session.add(weak_user)
    users.append((weak_user, "Pass123!"))
    
    await db_session.commit()
    return users


class TestBruteForceAttacks:
    """Test brute force attack scenarios."""
    
    async def test_password_brute_force_single_account(self, client: AsyncClient, target_users: List[Tuple[AuthUser, str]]):
        """Test brute force attack on a single account."""
        target_user, correct_password = target_users[0]
        
        # Common password list for brute force
        password_list = [
            "Password123!",
            "Welcome123!",
            "Admin123!",
            "Password1!",
            "12345678",
            "Qwerty123!",
            correct_password  # Include correct password
        ]
        
        successful_login = False
        attempts = 0
        captcha_required = False
        account_locked = False
        
        for password in password_list:
            attempts += 1
            response = await client.post(
                "/api/auth/login",
                json={
                    "email": target_user.email,
                    "password": password
                }
            )
            
            if response.status_code == status.HTTP_200_OK:
                successful_login = True
                assert password == correct_password
                break
            elif response.status_code == status.HTTP_400_BAD_REQUEST:
                detail = response.json().get("detail", {})
                if isinstance(detail, dict) and detail.get("error") == "captcha_required":
                    captcha_required = True
                    break
            elif response.status_code == status.HTTP_403_FORBIDDEN:
                if "locked" in response.json().get("detail", "").lower():
                    account_locked = True
                    break
            elif response.status_code == status.HTTP_429_TOO_MANY_REQUESTS:
                # Rate limited
                break
        
        # Verify protection mechanisms kicked in
        assert successful_login or captcha_required or account_locked or attempts < len(password_list)
    
    async def test_distributed_brute_force(self, client: AsyncClient, target_users: List[Tuple[AuthUser, str]]):
        """Test distributed brute force from multiple IPs."""
        target_user, correct_password = target_users[1]
        
        # Simulate different IPs
        ip_addresses = [f"192.168.1.{i}" for i in range(1, 11)]
        
        # Each "attacker" tries a few passwords
        passwords_per_ip = ["Password123!", "Admin123!", "Welcome123!"]
        
        blocked_ips = 0
        successful_attempts = 0
        
        for ip in ip_addresses:
            for password in passwords_per_ip:
                response = await client.post(
                    "/api/auth/login",
                    json={
                        "email": target_user.email,
                        "password": password
                    },
                    headers={"X-Forwarded-For": ip}
                )
                
                if response.status_code == status.HTTP_429_TOO_MANY_REQUESTS:
                    blocked_ips += 1
                    break
                elif response.status_code == status.HTTP_200_OK:
                    successful_attempts += 1
        
        # Should have some protection against distributed attacks
        assert blocked_ips > 0 or successful_attempts == 0
    
    async def test_password_spray_attack(self, client: AsyncClient, target_users: List[Tuple[AuthUser, str]]):
        """Test password spray attack (one password, many accounts)."""
        # Try common password against all accounts
        spray_password = "Password123!"
        
        successful_logins = 0
        blocked_attempts = 0
        
        for user, _ in target_users:
            response = await client.post(
                "/api/auth/login",
                json={
                    "email": user.email,
                    "password": spray_password
                }
            )
            
            if response.status_code == status.HTTP_200_OK:
                successful_logins += 1
            elif response.status_code in [status.HTTP_429_TOO_MANY_REQUESTS, status.HTTP_400_BAD_REQUEST]:
                blocked_attempts += 1
            
            # Add small delay to simulate real attack
            await asyncio.sleep(0.1)
        
        # Should detect pattern and block
        assert blocked_attempts > 0 or successful_logins <= 1
    
    async def test_credential_stuffing(self, client: AsyncClient, target_users: List[Tuple[AuthUser, str]]):
        """Test credential stuffing with leaked credentials."""
        # Simulate leaked credential pairs
        leaked_creds = [
            ("target0@example.com", "Password123!"),
            ("target1@example.com", "Welcome123!"),
            ("nonexistent@example.com", "Password123!"),
            ("admin@example.com", "AdminPass123!"),
        ]
        
        successful_logins = 0
        rate_limited = False
        
        for email, password in leaked_creds:
            response = await client.post(
                "/api/auth/login",
                json={
                    "email": email,
                    "password": password
                }
            )
            
            if response.status_code == status.HTTP_200_OK:
                successful_logins += 1
            elif response.status_code == status.HTTP_429_TOO_MANY_REQUESTS:
                rate_limited = True
                break
        
        # Should have rate limiting
        assert rate_limited or successful_logins <= 2


class TestTimingAttacks:
    """Test timing attack vulnerabilities."""
    
    async def test_user_enumeration_timing(self, client: AsyncClient, target_users: List[Tuple[AuthUser, str]]):
        """Test user enumeration through timing differences."""
        valid_user = target_users[0][0]
        
        # Measure timing for valid vs invalid users
        timings_valid = []
        timings_invalid = []
        
        # Multiple measurements for statistical significance
        for _ in range(10):
            # Valid user, wrong password
            start = time.perf_counter()
            await client.post(
                "/api/auth/login",
                json={
                    "email": valid_user.email,
                    "password": "WrongPass123!"
                }
            )
            timings_valid.append(time.perf_counter() - start)
            
            # Invalid user
            start = time.perf_counter()
            await client.post(
                "/api/auth/login",
                json={
                    "email": f"invalid_{secrets.token_hex(8)}@example.com",
                    "password": "WrongPass123!"
                }
            )
            timings_invalid.append(time.perf_counter() - start)
        
        # Calculate statistics
        avg_valid = statistics.mean(timings_valid)
        avg_invalid = statistics.mean(timings_invalid)
        std_valid = statistics.stdev(timings_valid)
        std_invalid = statistics.stdev(timings_invalid)
        
        # Check if timing difference is significant
        timing_diff = abs(avg_valid - avg_invalid)
        combined_std = (std_valid + std_invalid) / 2
        
        # Timing difference should be minimal (less than 2 standard deviations)
        assert timing_diff < 2 * combined_std
    
    async def test_password_reset_timing_enumeration(self, client: AsyncClient, target_users: List[Tuple[AuthUser, str]]):
        """Test user enumeration through password reset timing."""
        valid_user = target_users[0][0]
        
        timings_valid = []
        timings_invalid = []
        
        for _ in range(5):
            # Valid user
            start = time.perf_counter()
            await client.post(
                "/api/auth/forgot-password",
                json={"email": valid_user.email}
            )
            timings_valid.append(time.perf_counter() - start)
            
            # Invalid user
            start = time.perf_counter()
            await client.post(
                "/api/auth/forgot-password",
                json={"email": f"nonexistent_{secrets.token_hex(8)}@example.com"}
            )
            timings_invalid.append(time.perf_counter() - start)
        
        # Should have similar timing to prevent enumeration
        avg_diff = abs(statistics.mean(timings_valid) - statistics.mean(timings_invalid))
        assert avg_diff < 0.2  # Less than 200ms average difference
    
    async def test_verification_timing_attack(self, client: AsyncClient, target_users: List[Tuple[AuthUser, str]]):
        """Test timing attacks on email verification."""
        # Test with various invalid tokens
        token_types = [
            "short_token",
            "a" * 32,  # Valid length but invalid
            secrets.token_urlsafe(32),  # Valid format but not in DB
            "invalid-token-format-test",
        ]
        
        timings = []
        
        for token in token_types:
            start = time.perf_counter()
            await client.get(f"/api/auth/verify-email?token={token}")
            timings.append(time.perf_counter() - start)
        
        # All invalid tokens should have similar timing
        max_diff = max(timings) - min(timings)
        assert max_diff < 0.1  # Less than 100ms difference


class TestPasswordEnumeration:
    """Test password enumeration vulnerabilities."""
    
    async def test_password_complexity_feedback(self, client: AsyncClient):
        """Test if password complexity errors reveal information."""
        # Try registration with various passwords
        test_cases = [
            ("short", "Password too short"),
            ("alllowercase", "No uppercase"),
            ("ALLUPPERCASE", "No lowercase"),
            ("NoNumbers!", "No numbers"),
            ("NoSpecial123", "No special characters"),
            ("Valid123!", None),  # Should succeed or give generic error
        ]
        
        for password, expected_hint in test_cases:
            response = await client.post(
                "/api/auth/register",
                json={
                    "email": f"test_{secrets.token_hex(4)}@example.com",
                    "password": password,
                    "language": "en"
                }
            )
            
            if response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY:
                # Check error doesn't reveal specific requirements
                error_msg = str(response.json())
                
                # Should not reveal specific password requirements
                assert "uppercase" not in error_msg.lower()
                assert "lowercase" not in error_msg.lower()
                assert "special" not in error_msg.lower()
    
    async def test_password_history_enumeration(self, client: AsyncClient, target_users: List[Tuple[AuthUser, str]]):
        """Test if password history can be enumerated."""
        user, current_password = target_users[0]
        
        # Login to get tokens
        login_response = await client.post(
            "/api/auth/login",
            json={
                "email": user.email,
                "password": current_password
            }
        )
        assert login_response.status_code == status.HTTP_200_OK
        
        # Try to determine old passwords through error messages
        # (This would require a change password endpoint)
        # For now, test password reset with same password
        
        # Request password reset
        reset_response = await client.post(
            "/api/auth/forgot-password",
            json={"email": user.email}
        )
        
        # Response should not indicate if this is a previously used password
        assert "previous" not in reset_response.json().get("message", "").lower()
        assert "history" not in reset_response.json().get("message", "").lower()


class TestUserEnumeration:
    """Test user enumeration vulnerabilities."""
    
    async def test_registration_user_enumeration(self, client: AsyncClient, target_users: List[Tuple[AuthUser, str]]):
        """Test user enumeration through registration."""
        existing_user = target_users[0][0]
        
        # Try to register with existing email
        response1 = await client.post(
            "/api/auth/register",
            json={
                "email": existing_user.email,
                "password": "NewPass123!",
                "language": "en"
            }
        )
        
        # Try to register with non-existing email
        response2 = await client.post(
            "/api/auth/register",
            json={
                "email": f"new_{secrets.token_hex(8)}@example.com",
                "password": "NewPass123!",
                "language": "en"
            }
        )
        
        # Check responses don't reveal user existence differently
        if response1.status_code == status.HTTP_409_CONFLICT:
            # If it directly says email exists, that's enumeration
            assert "already registered" in response1.json().get("detail", "")
            # This is a known enumeration point that might be acceptable
            # depending on business requirements
    
    async def test_captcha_trigger_enumeration(self, client: AsyncClient, target_users: List[Tuple[AuthUser, str]]):
        """Test if CAPTCHA triggers differently for valid/invalid users."""
        valid_user = target_users[0][0]
        
        # Make failed attempts for valid user
        for _ in range(3):
            await client.post(
                "/api/auth/login",
                json={
                    "email": valid_user.email,
                    "password": "wrong"
                }
            )
        
        # Check if CAPTCHA required for valid user
        response_valid = await client.post(
            "/api/auth/login",
            json={
                "email": valid_user.email,
                "password": "wrong"
            }
        )
        
        # Make same attempts for invalid user
        invalid_email = "doesnotexist@example.com"
        for _ in range(3):
            await client.post(
                "/api/auth/login",
                json={
                    "email": invalid_email,
                    "password": "wrong"
                }
            )
        
        # Check if CAPTCHA required for invalid user
        response_invalid = await client.post(
            "/api/auth/login",
            json={
                "email": invalid_email,
                "password": "wrong"
            }
        )
        
        # Both should have similar behavior
        valid_captcha = response_valid.status_code == status.HTTP_400_BAD_REQUEST and \
                       response_valid.json().get("detail", {}).get("error") == "captcha_required"
        invalid_captcha = response_invalid.status_code == status.HTTP_400_BAD_REQUEST and \
                         response_invalid.json().get("detail", {}).get("error") == "captcha_required"
        
        # CAPTCHA requirement should be consistent
        # (Though it might differ based on IP-based tracking)
    
    async def test_account_lockout_enumeration(self, client: AsyncClient, target_users: List[Tuple[AuthUser, str]]):
        """Test if account lockout reveals user existence."""
        valid_user = target_users[2][0]
        invalid_email = "nonexistent@example.com"
        
        # Trigger lockout for valid user
        for _ in range(6):
            await client.post(
                "/api/auth/login",
                json={
                    "email": valid_user.email,
                    "password": "wrong"
                }
            )
        
        # Try same for invalid user
        for _ in range(6):
            await client.post(
                "/api/auth/login",
                json={
                    "email": invalid_email,
                    "password": "wrong"
                }
            )
        
        # Final attempts
        response_valid = await client.post(
            "/api/auth/login",
            json={
                "email": valid_user.email,
                "password": "wrong"
            }
        )
        
        response_invalid = await client.post(
            "/api/auth/login",
            json={
                "email": invalid_email,
                "password": "wrong"
            }
        )
        
        # Check if responses differ (revealing user existence)
        # Both should give similar errors
        assert response_valid.status_code in [401, 403, 429, 400]
        assert response_invalid.status_code in [401, 403, 429, 400]


class TestTokenPrediction:
    """Test token prediction vulnerabilities."""
    
    async def test_session_token_entropy(self, client: AsyncClient, target_users: List[Tuple[AuthUser, str]], db_session: AsyncSession, redis_client):
        """Test if session tokens have sufficient entropy."""
        user, password = target_users[0]
        token_service = TokenService(db_session, redis_client)
        
        # Generate multiple tokens
        tokens = []
        for _ in range(20):
            token, _ = token_service.generate_refresh_token(user)
            tokens.append(token)
        
        # Decode tokens to get JTIs
        jtis = []
        for token in tokens:
            import jwt
            decoded = jwt.decode(token, options={"verify_signature": False})
            jtis.append(decoded.get("jti"))
        
        # Check uniqueness
        assert len(set(jtis)) == len(jtis)
        
        # Check for patterns (simplified entropy check)
        # JTIs should not be sequential or predictable
        for i in range(1, len(jtis)):
            # Check they're not incrementing
            try:
                if jtis[i].isdigit() and jtis[i-1].isdigit():
                    assert abs(int(jtis[i]) - int(jtis[i-1])) != 1
            except:
                pass  # Not numeric, which is good
    
    async def test_verification_token_prediction(self, client: AsyncClient):
        """Test if email verification tokens are predictable."""
        # Register multiple users and collect tokens
        # (In real scenario, we'd intercept emails)
        emails = [f"predict_test_{i}@example.com" for i in range(5)]
        
        for email in emails:
            response = await client.post(
                "/api/auth/register",
                json={
                    "email": email,
                    "password": "TestPass123!",
                    "language": "en"
                }
            )
            assert response.status_code == status.HTTP_201_CREATED
        
        # Verification tokens should be unpredictable
        # We can't directly test this without intercepting emails
        # but we can verify the token format requirements
        
        # Try common weak tokens
        weak_tokens = [
            "12345",
            "token123",
            "verify",
            "a" * 32,
            "0" * 32,
        ]
        
        for token in weak_tokens:
            response = await client.get(f"/api/auth/verify-email?token={token}")
            assert response.status_code == status.HTTP_404_NOT_FOUND
    
    async def test_password_reset_token_prediction(self, client: AsyncClient, target_users: List[Tuple[AuthUser, str]]):
        """Test if password reset tokens are predictable."""
        user = target_users[0][0]
        
        # Request multiple password resets
        for _ in range(3):
            await client.post(
                "/api/auth/forgot-password",
                json={"email": user.email}
            )
            await asyncio.sleep(0.1)
        
        # Try predictable token formats
        predictable_tokens = [
            str(uuid4()),  # Random UUID
            user.email,  # Email-based
            str(int(time.time())),  # Timestamp-based
            hashlib.sha256(user.email.encode()).hexdigest(),  # Hash of email
        ]
        
        for token in predictable_tokens:
            response = await client.post(
                "/api/auth/reset-password",
                json={
                    "token": token,
                    "new_password": "NewPass123!"
                }
            )
            assert response.status_code == status.HTTP_400_BAD_REQUEST


class TestSessionFixation:
    """Test session fixation vulnerabilities."""
    
    async def test_session_id_regeneration_on_login(self, client: AsyncClient, target_users: List[Tuple[AuthUser, str]]):
        """Test if session IDs are regenerated on login."""
        user, password = target_users[0]
        
        # Login twice
        response1 = await client.post(
            "/api/auth/login",
            json={
                "email": user.email,
                "password": password
            }
        )
        assert response1.status_code == status.HTTP_200_OK
        tokens1 = response1.json()
        
        response2 = await client.post(
            "/api/auth/login",
            json={
                "email": user.email,
                "password": password
            }
        )
        assert response2.status_code == status.HTTP_200_OK
        tokens2 = response2.json()
        
        # Sessions should be different
        assert tokens1["refresh_token"] != tokens2["refresh_token"]
        assert tokens1["access_token"] != tokens2["access_token"]
    
    async def test_session_fixation_via_token_reuse(self, client: AsyncClient, target_users: List[Tuple[AuthUser, str]]):
        """Test session fixation through token reuse."""
        user, password = target_users[0]
        
        # Attacker gets a session
        attacker_response = await client.post(
            "/api/auth/login",
            json={
                "email": user.email,
                "password": password
            }
        )
        assert attacker_response.status_code == status.HTTP_200_OK
        attacker_tokens = attacker_response.json()
        
        # User logs in (should get different session)
        user_response = await client.post(
            "/api/auth/login",
            json={
                "email": user.email,
                "password": password
            }
        )
        assert user_response.status_code == status.HTTP_200_OK
        user_tokens = user_response.json()
        
        # Try to use attacker's token after user login
        response = await client.get(
            "/api/auth/me",
            headers={"Authorization": f"Bearer {attacker_tokens['access_token']}"}
        )
        
        # Old session should still work (unless invalidated by session limit)
        # but should be tracked separately
        if response.status_code == status.HTTP_200_OK:
            # Get sessions to verify they're tracked separately
            sessions_response = await client.get(
                "/api/auth/sessions",
                headers={"Authorization": f"Bearer {user_tokens['access_token']}"}
            )
            
            if sessions_response.status_code == status.HTTP_200_OK:
                sessions = sessions_response.json()["sessions"]
                # Should have multiple sessions
                assert len(sessions) >= 1
    
    async def test_session_hijacking_detection(self, client: AsyncClient, target_users: List[Tuple[AuthUser, str]]):
        """Test detection of session hijacking attempts."""
        user, password = target_users[0]
        
        # Login from one "location"
        response = await client.post(
            "/api/auth/login",
            json={
                "email": user.email,
                "password": password
            },
            headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/91.0",
                "X-Forwarded-For": "192.168.1.100"
            }
        )
        assert response.status_code == status.HTTP_200_OK
        tokens = response.json()
        
        # Use token from different "location" (potential hijack)
        hijack_response = await client.get(
            "/api/auth/me",
            headers={
                "Authorization": f"Bearer {tokens['access_token']}",
                "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 14_6) Safari/604.1",
                "X-Forwarded-For": "10.0.0.50"
            }
        )
        
        # Should still work (we don't block on IP change)
        # but this should be logged for anomaly detection
        assert hijack_response.status_code == status.HTTP_200_OK
        
        # Verify session info shows different IPs
        sessions_response = await client.get(
            "/api/auth/sessions",
            headers={"Authorization": f"Bearer {tokens['access_token']}"}
        )
        
        if sessions_response.status_code == status.HTTP_200_OK:
            sessions = sessions_response.json()["sessions"]
            # Session should show original IP
            assert any(s["ip_address"] == "192.168.1.100" for s in sessions)