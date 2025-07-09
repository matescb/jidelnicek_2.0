"""
Tests for session management functionality.

This module tests session tracking, concurrent session limits,
and session invalidation features.
"""

import pytest
from datetime import datetime, timedelta, timezone
from uuid import UUID
from unittest.mock import patch, MagicMock

from fastapi import status
from sqlalchemy.ext.asyncio import AsyncSession

from jidelnicek.auth.models import AuthUser, AuthSession
from jidelnicek.auth.services.token_service import TokenService
from jidelnicek.core.config import settings


@pytest.mark.asyncio
class TestSessionManagement:
    """Test session management endpoints and functionality."""
    
    async def test_list_sessions(self, client, auth_headers, test_user, db: AsyncSession):
        """Test listing user sessions."""
        # Create multiple sessions for the user
        token_service = TokenService(db, None)
        
        # Create additional sessions with different user agents
        user_agents = [
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15",
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
        ]
        
        for ua in user_agents:
            _, refresh_expires = token_service.generate_refresh_token(test_user)
            await token_service.create_session(
                user=test_user,
                refresh_token="dummy_token",
                expires_at=refresh_expires,
                ip_address="192.168.1.100",
                user_agent=ua
            )
        
        # List sessions
        response = await client.get(
            "/api/auth/sessions",
            headers=auth_headers
        )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        
        assert "sessions" in data
        assert "total" in data
        assert "max_allowed" in data
        
        # Should have at least 4 sessions (1 from login + 3 created)
        assert data["total"] >= 4
        assert len(data["sessions"]) >= 4
        
        # Check session data structure
        for session in data["sessions"]:
            assert "id" in session
            assert "device_name" in session
            assert "device_type" in session
            assert "browser" in session
            assert "os" in session
            assert "created_at" in session
            assert "last_accessed" in session
            assert "expires_at" in session
            assert "is_current" in session
    
    async def test_get_session_count(self, client, auth_headers, test_user):
        """Test getting active session count."""
        response = await client.get(
            "/api/auth/sessions/active-count",
            headers=auth_headers
        )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        
        assert "active_sessions" in data
        assert "max_allowed" in data
        assert "is_admin" in data
        
        assert data["active_sessions"] >= 1  # At least the current session
        assert data["max_allowed"] == settings.max_sessions_per_user
        assert data["is_admin"] is False  # test_user is not admin
    
    async def test_revoke_session(self, client, auth_headers, test_user, db: AsyncSession):
        """Test revoking a specific session."""
        # Create an additional session
        token_service = TokenService(db, None)
        _, refresh_expires = token_service.generate_refresh_token(test_user)
        session = await token_service.create_session(
            user=test_user,
            refresh_token="test_token",
            expires_at=refresh_expires,
            ip_address="192.168.1.200",
            user_agent="Test Browser"
        )
        
        # Revoke the session
        response = await client.delete(
            f"/api/auth/sessions/{session.id}",
            headers=auth_headers
        )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        
        assert data["status"] == "success"
        assert str(session.id) in data["session_id"]
        
        # Verify session is revoked in database
        await db.refresh(session)
        assert session.is_valid is False
    
    async def test_revoke_nonexistent_session(self, client, auth_headers):
        """Test revoking a non-existent session."""
        fake_session_id = "00000000-0000-0000-0000-000000000000"
        
        response = await client.delete(
            f"/api/auth/sessions/{fake_session_id}",
            headers=auth_headers
        )
        
        assert response.status_code == status.HTTP_404_NOT_FOUND
    
    async def test_revoke_other_users_session(self, client, auth_headers, db: AsyncSession):
        """Test that users cannot revoke other users' sessions."""
        # Create another user and their session
        other_user = AuthUser(
            email="other@example.com",
            password_hash="dummy_hash",
            full_name="Other User"
        )
        db.add(other_user)
        await db.commit()
        
        token_service = TokenService(db, None)
        _, refresh_expires = token_service.generate_refresh_token(other_user)
        other_session = await token_service.create_session(
            user=other_user,
            refresh_token="other_token",
            expires_at=refresh_expires
        )
        
        # Try to revoke other user's session
        response = await client.delete(
            f"/api/auth/sessions/{other_session.id}",
            headers=auth_headers
        )
        
        assert response.status_code == status.HTTP_404_NOT_FOUND
        
        # Verify session is still valid
        await db.refresh(other_session)
        assert other_session.is_valid is True
    
    async def test_concurrent_session_limit(self, client, db: AsyncSession):
        """Test concurrent session limit enforcement."""
        # Create a user
        user = AuthUser(
            email="limited@example.com",
            password_hash="$2b$12$K7hKXDmGzVJPCLw7mUvCYu3Q2kgeDF4O4tCj1cNAhgOYzH7sWvdJ.",  # password123
            full_name="Limited User",
            email_verified=True
        )
        db.add(user)
        await db.commit()
        
        # Login multiple times to exceed session limit
        sessions_created = []
        for i in range(settings.max_sessions_per_user + 2):
            response = await client.post(
                "/api/auth/login",
                json={
                    "email": "limited@example.com",
                    "password": "password123"
                },
                headers={"User-Agent": f"Test Browser {i}"}
            )
            assert response.status_code == status.HTTP_200_OK
            sessions_created.append(response.json())
        
        # Check that we only have max_sessions_per_user active sessions
        token_service = TokenService(db, None)
        session_count = await token_service.get_session_count(user.id)
        assert session_count == settings.max_sessions_per_user
        
        # Verify oldest sessions were revoked
        oldest_sessions = await db.execute(
            select(AuthSession)
            .where(AuthSession.user_id == user.id)
            .order_by(AuthSession.created_at.asc())
            .limit(2)
        )
        for session in oldest_sessions.scalars():
            assert session.is_valid is False
    
    async def test_admin_unlimited_sessions(self, client, db: AsyncSession):
        """Test that admin users have unlimited sessions."""
        # Create an admin user
        admin_user = AuthUser(
            email="admin@example.com",
            password_hash="$2b$12$K7hKXDmGzVJPCLw7mUvCYu3Q2kgeDF4O4tCj1cNAhgOYzH7sWvdJ.",  # password123
            full_name="Admin User",
            role="admin",
            email_verified=True
        )
        db.add(admin_user)
        await db.commit()
        
        # Login many times (more than regular limit)
        for i in range(settings.max_sessions_per_user + 5):
            response = await client.post(
                "/api/auth/login",
                json={
                    "email": "admin@example.com",
                    "password": "password123"
                },
                headers={"User-Agent": f"Admin Browser {i}"}
            )
            assert response.status_code == status.HTTP_200_OK
        
        # Check that all sessions are active
        token_service = TokenService(db, None)
        session_count = await token_service.get_session_count(admin_user.id)
        assert session_count == settings.max_sessions_per_user + 5
        
        # Get session count endpoint should show unlimited
        response = await client.post(
            "/api/auth/login",
            json={
                "email": "admin@example.com",
                "password": "password123"
            }
        )
        admin_token = response.json()["access_token"]
        
        response = await client.get(
            "/api/auth/sessions/active-count",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["is_admin"] is True
        assert data["max_allowed"] == -1  # Unlimited
    
    async def test_device_detection(self, client, auth_headers, test_user, db: AsyncSession):
        """Test device detection from User-Agent."""
        # Test various user agents
        test_cases = [
            {
                "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/91.0.4472.124",
                "expected_device_type": "desktop",
                "expected_os": "Windows",
                "expected_browser": "Chrome"
            },
            {
                "user_agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) Safari/604.1",
                "expected_device_type": "mobile",
                "expected_device_name": "iPhone",
                "expected_os": "iOS"
            },
            {
                "user_agent": "Mozilla/5.0 (iPad; CPU OS 14_6 like Mac OS X) Safari/604.1",
                "expected_device_type": "tablet",
                "expected_device_name": "iPad",
                "expected_os": "iPadOS"
            }
        ]
        
        token_service = TokenService(db, None)
        
        for test_case in test_cases:
            _, refresh_expires = token_service.generate_refresh_token(test_user)
            session = await token_service.create_session(
                user=test_user,
                refresh_token="test_token",
                expires_at=refresh_expires,
                user_agent=test_case["user_agent"]
            )
            
            # Check parsed device info
            assert session.device_type == test_case["expected_device_type"]
            if "expected_device_name" in test_case:
                assert test_case["expected_device_name"] in session.device_name
            if "expected_os" in test_case:
                assert test_case["expected_os"] in session.os
            if "expected_browser" in test_case:
                assert test_case["expected_browser"] in session.browser
    
    async def test_session_cleanup_task(self, db: AsyncSession):
        """Test automatic session cleanup."""
        # Create expired sessions
        user = AuthUser(
            email="cleanup@example.com",
            password_hash="dummy_hash",
            full_name="Cleanup User"
        )
        db.add(user)
        await db.commit()
        
        # Create expired sessions
        expired_time = datetime.now(timezone.utc) - timedelta(days=1)
        for i in range(3):
            session = AuthSession(
                user_id=user.id,
                token_hash=f"expired_hash_{i}",
                expires_at=expired_time,
                is_valid=True
            )
            db.add(session)
        
        # Create valid session
        valid_session = AuthSession(
            user_id=user.id,
            token_hash="valid_hash",
            expires_at=datetime.now(timezone.utc) + timedelta(days=1),
            is_valid=True
        )
        db.add(valid_session)
        await db.commit()
        
        # Run cleanup
        token_service = TokenService(db, None)
        cleaned_count = await token_service.cleanup_expired_sessions()
        
        assert cleaned_count == 3
        
        # Verify expired sessions are gone
        remaining_sessions = await db.execute(
            select(AuthSession).where(AuthSession.user_id == user.id)
        )
        sessions = remaining_sessions.scalars().all()
        assert len(sessions) == 1
        assert sessions[0].id == valid_session.id
    
    async def test_logout_all_sessions(self, client, auth_headers, test_user, db: AsyncSession):
        """Test logging out from all sessions."""
        # Create multiple sessions
        token_service = TokenService(db, None)
        for i in range(3):
            _, refresh_expires = token_service.generate_refresh_token(test_user)
            await token_service.create_session(
                user=test_user,
                refresh_token=f"token_{i}",
                expires_at=refresh_expires,
                user_agent=f"Browser {i}"
            )
        
        # Logout from all sessions
        response = await client.post(
            "/api/auth/logout",
            json={"all_sessions": True},
            headers=auth_headers
        )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["sessions_revoked"] >= 4  # At least 4 sessions
        
        # Verify all sessions are invalid
        sessions = await db.execute(
            select(AuthSession).where(AuthSession.user_id == test_user.id)
        )
        for session in sessions.scalars():
            assert session.is_valid is False