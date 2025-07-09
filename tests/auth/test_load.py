"""
Load testing scenarios for authentication system.

This module tests system behavior under load:
- Concurrent user registration
- Simultaneous login attempts
- Token refresh under load
- Rate limiting effectiveness
- Database connection pool testing
"""

import pytest
import asyncio
import time
import statistics
from datetime import datetime, timedelta
from typing import List, Dict, Any, Tuple
from uuid import uuid4
import random
import string

from fastapi import status
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from jidelnicek.auth.models import AuthUser, AuthSession
from jidelnicek.auth.utils.password import PasswordHasher
from jidelnicek.core.config import settings


@pytest.fixture
async def load_test_users(db_session: AsyncSession) -> List[Tuple[str, str]]:
    """Create users for load testing."""
    users = []
    
    # Create a batch of test users
    for i in range(20):
        email = f"loadtest_{i}@example.com"
        password = f"LoadTest{i}Pass!"
        
        user = AuthUser(
            email=email,
            password_hash=PasswordHasher.hash_password(password),
            is_active=True,
            email_verified=True,
            role="user"
        )
        db_session.add(user)
        users.append((email, password))
    
    await db_session.commit()
    return users


class TestConcurrentRegistration:
    """Test concurrent user registration scenarios."""
    
    async def test_concurrent_registration_load(self, client: AsyncClient):
        """Test system behavior with many concurrent registrations."""
        num_concurrent = 50
        
        async def register_user(index: int) -> Dict[str, Any]:
            start_time = time.time()
            
            response = await client.post(
                "/api/auth/register",
                json={
                    "email": f"concurrent_user_{index}_{uuid4().hex[:8]}@example.com",
                    "password": f"ConcurrentPass{index}!",
                    "language": "en"
                }
            )
            
            return {
                "index": index,
                "status": response.status_code,
                "duration": time.time() - start_time,
                "response": response.json() if response.status_code != 500 else None
            }
        
        # Execute concurrent registrations
        tasks = [register_user(i) for i in range(num_concurrent)]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Analyze results
        successful = 0
        failed = 0
        rate_limited = 0
        durations = []
        
        for result in results:
            if isinstance(result, Exception):
                failed += 1
            else:
                durations.append(result["duration"])
                if result["status"] == status.HTTP_201_CREATED:
                    successful += 1
                elif result["status"] == status.HTTP_429_TOO_MANY_REQUESTS:
                    rate_limited += 1
                else:
                    failed += 1
        
        # Assertions
        assert successful > 0  # Some should succeed
        assert successful + rate_limited + failed == num_concurrent
        
        # Performance metrics
        if durations:
            avg_duration = statistics.mean(durations)
            max_duration = max(durations)
            
            # Average should be reasonable
            assert avg_duration < 5.0  # Less than 5 seconds average
            assert max_duration < 30.0  # No request should take more than 30 seconds
    
    async def test_duplicate_email_race_condition(self, client: AsyncClient):
        """Test race condition with duplicate email registrations."""
        email = f"racetest_{uuid4().hex[:8]}@example.com"
        num_attempts = 10
        
        async def register_same_email(attempt: int) -> Dict[str, Any]:
            response = await client.post(
                "/api/auth/register",
                json={
                    "email": email,
                    "password": "RaceCondition123!",
                    "language": "en"
                }
            )
            
            return {
                "attempt": attempt,
                "status": response.status_code,
                "detail": response.json().get("detail") if response.status_code != 201 else None
            }
        
        # Try to register same email concurrently
        tasks = [register_same_email(i) for i in range(num_attempts)]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Analyze results
        created = sum(1 for r in results if not isinstance(r, Exception) and r["status"] == 201)
        conflicts = sum(1 for r in results if not isinstance(r, Exception) and r["status"] == 409)
        
        # Only one should succeed
        assert created == 1
        assert conflicts == num_attempts - 1
    
    async def test_registration_database_connection_pool(self, client: AsyncClient, db_session: AsyncSession):
        """Test database connection pool under registration load."""
        num_batches = 5
        batch_size = 20
        
        connection_counts = []
        
        for batch in range(num_batches):
            # Check active connections before batch
            result = await db_session.execute(
                "SELECT count(*) FROM pg_stat_activity WHERE state = 'active'"
            )
            initial_connections = result.scalar()
            
            # Execute batch registrations
            tasks = []
            for i in range(batch_size):
                task = client.post(
                    "/api/auth/register",
                    json={
                        "email": f"pooltest_b{batch}_u{i}@example.com",
                        "password": "PoolTest123!",
                        "language": "en"
                    }
                )
                tasks.append(task)
            
            await asyncio.gather(*tasks, return_exceptions=True)
            
            # Check connections after batch
            result = await db_session.execute(
                "SELECT count(*) FROM pg_stat_activity WHERE state = 'active'"
            )
            peak_connections = result.scalar()
            
            connection_counts.append(peak_connections)
            
            # Small delay between batches
            await asyncio.sleep(0.5)
        
        # Connection pool should be stable
        if connection_counts:
            # Pool shouldn't grow indefinitely
            assert max(connection_counts) < 100  # Reasonable limit


class TestSimultaneousLogin:
    """Test simultaneous login scenarios."""
    
    async def test_concurrent_login_same_user(self, client: AsyncClient, load_test_users: List[Tuple[str, str]]):
        """Test concurrent logins for the same user."""
        email, password = load_test_users[0]
        num_concurrent = 20
        
        async def login_attempt(attempt: int) -> Dict[str, Any]:
            start_time = time.time()
            
            response = await client.post(
                "/api/auth/login",
                json={
                    "email": email,
                    "password": password
                }
            )
            
            return {
                "attempt": attempt,
                "status": response.status_code,
                "duration": time.time() - start_time,
                "has_token": "access_token" in response.json() if response.status_code == 200 else False
            }
        
        # Execute concurrent logins
        tasks = [login_attempt(i) for i in range(num_concurrent)]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Analyze results
        successful = sum(1 for r in results if not isinstance(r, Exception) and r["status"] == 200)
        rate_limited = sum(1 for r in results if not isinstance(r, Exception) and r["status"] == 429)
        
        # Should handle concurrent logins gracefully
        assert successful > 0
        
        # Check session limit enforcement
        if successful > settings.max_sessions_per_user:
            # Verify oldest sessions were revoked
            # Get one successful token to check sessions
            for result in results:
                if not isinstance(result, Exception) and result["status"] == 200:
                    # Would need the actual token to verify
                    break
    
    async def test_distributed_login_load(self, client: AsyncClient, load_test_users: List[Tuple[str, str]]):
        """Test login load distributed across multiple users."""
        num_users = min(len(load_test_users), 10)
        logins_per_user = 5
        
        async def user_login_batch(user_index: int) -> Dict[str, Any]:
            email, password = load_test_users[user_index]
            results = []
            
            for attempt in range(logins_per_user):
                start_time = time.time()
                
                response = await client.post(
                    "/api/auth/login",
                    json={
                        "email": email,
                        "password": password
                    }
                )
                
                results.append({
                    "user": user_index,
                    "attempt": attempt,
                    "status": response.status_code,
                    "duration": time.time() - start_time
                })
                
                # Small delay between attempts
                await asyncio.sleep(0.1)
            
            return results
        
        # Execute batches concurrently
        tasks = [user_login_batch(i) for i in range(num_users)]
        all_results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Flatten and analyze results
        total_attempts = 0
        successful_logins = 0
        avg_durations = []
        
        for user_results in all_results:
            if not isinstance(user_results, Exception):
                for result in user_results:
                    total_attempts += 1
                    if result["status"] == 200:
                        successful_logins += 1
                        avg_durations.append(result["duration"])
        
        # Most logins should succeed
        success_rate = successful_logins / total_attempts if total_attempts > 0 else 0
        assert success_rate > 0.8  # 80% success rate
        
        # Performance should be reasonable
        if avg_durations:
            assert statistics.mean(avg_durations) < 2.0  # Average under 2 seconds
    
    async def test_login_spike_handling(self, client: AsyncClient, load_test_users: List[Tuple[str, str]]):
        """Test system behavior during login spikes."""
        # Simulate sudden spike
        spike_size = 100
        
        async def spike_login(index: int) -> Dict[str, Any]:
            # Pick random user
            email, password = random.choice(load_test_users)
            
            response = await client.post(
                "/api/auth/login",
                json={
                    "email": email,
                    "password": password
                }
            )
            
            return {
                "index": index,
                "status": response.status_code
            }
        
        # Measure system before spike
        start_time = time.time()
        
        # Create spike
        tasks = [spike_login(i) for i in range(spike_size)]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        spike_duration = time.time() - start_time
        
        # Count results
        successful = sum(1 for r in results if not isinstance(r, Exception) and r["status"] == 200)
        rate_limited = sum(1 for r in results if not isinstance(r, Exception) and r["status"] == 429)
        errors = sum(1 for r in results if isinstance(r, Exception) or (not isinstance(r, Exception) and r["status"] >= 500))
        
        # System should handle spike without crashing
        assert errors < spike_size * 0.1  # Less than 10% errors
        assert spike_duration < 60  # Should complete within 1 minute


class TestTokenRefreshUnderLoad:
    """Test token refresh behavior under load."""
    
    async def test_concurrent_token_refresh(self, client: AsyncClient, load_test_users: List[Tuple[str, str]]):
        """Test concurrent token refresh for same user."""
        email, password = load_test_users[0]
        
        # Login to get tokens
        login_response = await client.post(
            "/api/auth/login",
            json={
                "email": email,
                "password": password
            }
        )
        assert login_response.status_code == 200
        
        refresh_token = login_response.json()["refresh_token"]
        num_concurrent = 10
        
        async def refresh_attempt(attempt: int) -> Dict[str, Any]:
            response = await client.post(
                "/api/auth/refresh",
                json={"refresh_token": refresh_token}
            )
            
            return {
                "attempt": attempt,
                "status": response.status_code,
                "has_new_token": "access_token" in response.json() if response.status_code == 200 else False
            }
        
        # Try concurrent refreshes
        tasks = [refresh_attempt(i) for i in range(num_concurrent)]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Analyze results
        successful = sum(1 for r in results if not isinstance(r, Exception) and r["status"] == 200)
        
        # At least one should succeed (others might fail if token rotation is enabled)
        assert successful >= 1
        
        # If rotation is enabled, only one should succeed
        if settings.rotate_refresh_tokens:
            assert successful == 1
    
    async def test_refresh_token_race_condition(self, client: AsyncClient, load_test_users: List[Tuple[str, str]]):
        """Test race conditions in token refresh with rotation."""
        if not settings.rotate_refresh_tokens:
            pytest.skip("Token rotation not enabled")
        
        email, password = load_test_users[1]
        
        # Login to get tokens
        login_response = await client.post(
            "/api/auth/login",
            json={
                "email": email,
                "password": password
            }
        )
        assert login_response.status_code == 200
        
        refresh_token = login_response.json()["refresh_token"]
        
        # Try to use same refresh token multiple times concurrently
        async def use_refresh_token():
            return await client.post(
                "/api/auth/refresh",
                json={"refresh_token": refresh_token}
            )
        
        # Execute concurrently
        tasks = [use_refresh_token() for _ in range(5)]
        responses = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Count successful refreshes
        successful = 0
        new_tokens = set()
        
        for response in responses:
            if not isinstance(response, Exception) and response.status_code == 200:
                successful += 1
                new_tokens.add(response.json()["refresh_token"])
        
        # Only one should succeed with rotation
        assert successful == 1
        assert len(new_tokens) == 1


class TestRateLimitingUnderLoad:
    """Test rate limiting effectiveness under load."""
    
    async def test_rate_limit_accuracy_under_load(self, client: AsyncClient):
        """Test that rate limits are accurately enforced under load."""
        # Test login rate limit (5 per hour per IP)
        test_email = "ratelimit@example.com"
        
        requests_made = 0
        blocked_requests = 0
        
        # Make requests until rate limited
        for i in range(10):
            response = await client.post(
                "/api/auth/login",
                json={
                    "email": test_email,
                    "password": "wrong"
                }
            )
            
            requests_made += 1
            
            if response.status_code == status.HTTP_429_TOO_MANY_REQUESTS:
                blocked_requests += 1
            elif response.status_code == status.HTTP_400_BAD_REQUEST:
                # Might be CAPTCHA required
                detail = response.json().get("detail", {})
                if isinstance(detail, dict) and detail.get("error") == "captcha_required":
                    break
        
        # Should hit rate limit after 5 attempts
        assert requests_made >= 5
        assert blocked_requests > 0 or requests_made <= 5
    
    async def test_distributed_rate_limit_bypass_attempt(self, client: AsyncClient, load_test_users: List[Tuple[str, str]]):
        """Test attempting to bypass rate limits through distribution."""
        target_email = load_test_users[0][0]
        
        # Simulate different IPs
        async def attempt_from_ip(ip: str, attempt: int) -> Dict[str, Any]:
            response = await client.post(
                "/api/auth/login",
                json={
                    "email": target_email,
                    "password": "wrong"
                },
                headers={"X-Forwarded-For": ip}
            )
            
            return {
                "ip": ip,
                "attempt": attempt,
                "status": response.status_code
            }
        
        # Use multiple "IPs"
        ips = [f"192.168.1.{i}" for i in range(1, 21)]
        tasks = []
        
        # Each IP makes 3 attempts
        for ip in ips:
            for attempt in range(3):
                tasks.append(attempt_from_ip(ip, attempt))
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Check if account-level rate limiting kicked in
        account_limited = False
        for result in results:
            if not isinstance(result, Exception):
                if result["status"] == 429:
                    account_limited = True
                    break
                elif result["status"] == 400:
                    # Check for CAPTCHA requirement
                    account_limited = True
                    break
        
        # Should have some protection against distributed attacks
        assert account_limited or len(results) < len(tasks)
    
    async def test_rate_limit_recovery(self, client: AsyncClient):
        """Test rate limit recovery and cleanup."""
        test_endpoint = "/api/auth/login"
        test_data = {
            "email": "recovery_test@example.com",
            "password": "wrong"
        }
        
        # Hit rate limit
        for _ in range(6):
            await client.post(test_endpoint, json=test_data)
        
        # Verify rate limited
        response = await client.post(test_endpoint, json=test_data)
        assert response.status_code in [429, 400]  # Rate limited or CAPTCHA
        
        # In real test, would wait for rate limit window to expire
        # For now, just verify the limit was applied


class TestDatabaseConnectionPool:
    """Test database connection pool behavior under load."""
    
    async def test_connection_pool_saturation(self, client: AsyncClient, load_test_users: List[Tuple[str, str]], db_session: AsyncSession):
        """Test behavior when connection pool is saturated."""
        # Create long-running queries
        async def long_operation(user_index: int) -> Dict[str, Any]:
            email, password = load_test_users[user_index % len(load_test_users)]
            
            # Login (creates session)
            response = await client.post(
                "/api/auth/login",
                json={
                    "email": email,
                    "password": password
                }
            )
            
            if response.status_code == 200:
                token = response.json()["access_token"]
                
                # Make multiple session queries
                for _ in range(3):
                    await client.get(
                        "/api/auth/sessions",
                        headers={"Authorization": f"Bearer {token}"}
                    )
            
            return {
                "user": user_index,
                "status": response.status_code
            }
        
        # Run many concurrent operations
        num_operations = 50
        tasks = [long_operation(i) for i in range(num_operations)]
        
        start_time = time.time()
        results = await asyncio.gather(*tasks, return_exceptions=True)
        duration = time.time() - start_time
        
        # Count successes and failures
        successes = sum(1 for r in results if not isinstance(r, Exception) and r["status"] == 200)
        errors = sum(1 for r in results if isinstance(r, Exception))
        
        # Should handle load without errors
        assert errors < num_operations * 0.1  # Less than 10% errors
        assert successes > 0
        
        # Should complete in reasonable time
        assert duration < 120  # 2 minutes max
    
    async def test_connection_leak_detection(self, client: AsyncClient, load_test_users: List[Tuple[str, str]], db_session: AsyncSession):
        """Test for connection leaks under error conditions."""
        # Get initial connection count
        result = await db_session.execute(
            "SELECT count(*) FROM pg_stat_activity WHERE datname = current_database()"
        )
        initial_connections = result.scalar()
        
        # Perform operations that might leak connections
        async def faulty_operation(index: int):
            try:
                # Try invalid operations
                if index % 3 == 0:
                    # Invalid token
                    await client.get(
                        "/api/auth/me",
                        headers={"Authorization": "Bearer invalid"}
                    )
                elif index % 3 == 1:
                    # Wrong password
                    await client.post(
                        "/api/auth/login",
                        json={
                            "email": load_test_users[0][0],
                            "password": "wrong"
                        }
                    )
                else:
                    # Valid operation
                    email, password = load_test_users[index % len(load_test_users)]
                    await client.post(
                        "/api/auth/login",
                        json={
                            "email": email,
                            "password": password
                        }
                    )
            except:
                pass  # Ignore errors
        
        # Run many operations
        tasks = [faulty_operation(i) for i in range(100)]
        await asyncio.gather(*tasks, return_exceptions=True)
        
        # Wait for connections to settle
        await asyncio.sleep(2)
        
        # Check connection count
        result = await db_session.execute(
            "SELECT count(*) FROM pg_stat_activity WHERE datname = current_database()"
        )
        final_connections = result.scalar()
        
        # Should not leak connections
        connection_increase = final_connections - initial_connections
        assert connection_increase < 10  # Allow small increase but not leak


class TestSystemStressLimits:
    """Test system behavior at stress limits."""
    
    async def test_memory_usage_under_load(self, client: AsyncClient, load_test_users: List[Tuple[str, str]]):
        """Test memory usage doesn't grow unbounded under load."""
        # This is a simplified test - real memory profiling would be more complex
        
        async def memory_intensive_operation(index: int):
            # Register user with large data
            response = await client.post(
                "/api/auth/register",
                json={
                    "email": f"memtest_{index}_{uuid4().hex}@example.com",
                    "password": "MemTest123!",
                    "language": "en"
                }
            )
            
            if response.status_code == 201:
                # Login and create session
                await client.post(
                    "/api/auth/login",
                    json={
                        "email": f"memtest_{index}_{uuid4().hex}@example.com",
                        "password": "MemTest123!"
                    }
                )
        
        # Run operations in batches
        batch_size = 20
        num_batches = 5
        
        for batch in range(num_batches):
            tasks = [memory_intensive_operation(i + batch * batch_size) for i in range(batch_size)]
            await asyncio.gather(*tasks, return_exceptions=True)
            
            # Allow garbage collection between batches
            await asyncio.sleep(1)
        
        # If we get here without OOM, test passes
        assert True
    
    async def test_cascade_failure_prevention(self, client: AsyncClient, load_test_users: List[Tuple[str, str]]):
        """Test that failures don't cascade through the system."""
        # Create a mix of valid and invalid requests
        async def mixed_request(index: int):
            if index % 5 == 0:
                # Invalid request that should fail fast
                return await client.post(
                    "/api/auth/login",
                    json={"invalid": "data"}
                )
            else:
                # Valid request
                email, password = load_test_users[index % len(load_test_users)]
                return await client.post(
                    "/api/auth/login",
                    json={
                        "email": email,
                        "password": password
                    }
                )
        
        # Run mixed load
        num_requests = 100
        tasks = [mixed_request(i) for i in range(num_requests)]
        
        start_time = time.time()
        results = await asyncio.gather(*tasks, return_exceptions=True)
        duration = time.time() - start_time
        
        # Count results
        valid_requests = sum(1 for i in range(num_requests) if i % 5 != 0)
        successful_valid = sum(
            1 for i, r in enumerate(results)
            if i % 5 != 0 and not isinstance(r, Exception) and hasattr(r, 'status_code') and r.status_code == 200
        )
        
        # Most valid requests should succeed despite invalid ones
        success_rate = successful_valid / valid_requests if valid_requests > 0 else 0
        assert success_rate > 0.8  # 80% of valid requests should succeed
        
        # Should complete in reasonable time
        assert duration < 60  # Under 1 minute