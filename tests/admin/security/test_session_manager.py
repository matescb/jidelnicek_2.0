"""
Tests for admin session management.
"""

import pytest
from datetime import datetime, timedelta
from uuid import uuid4
import secrets

from jidelnicek.admin.security.session_manager import (
    SessionManager,
    AdminSession,
    AdminSessionConfig
)
from jidelnicek.auth.models import AuthUser
from jidelnicek.core.utils import get_utc_now
from jidelnicek.core.exceptions import (
    SecurityException,
    SessionExpiredException,
    ConcurrentSessionLimitException
)


@pytest.fixture
def admin_user():
    """Create test admin user."""
    return AuthUser(
        id=uuid4(),
        email="admin@test.com",
        role="admin",
        is_active=True,
        email_verified=True
    )


@pytest.fixture
def regular_user():
    """Create test regular user."""
    return AuthUser(
        id=uuid4(),
        email="user@test.com",
        role="user",
        is_active=True,
        email_verified=True
    )


@pytest.fixture
async def session_manager(async_db, redis_client):
    """Create session manager instance."""
    return SessionManager(async_db, redis_client)


class TestSessionManager:
    """Test session management functionality."""
    
    async def test_create_session_admin_only(
        self,
        session_manager,
        admin_user,
        regular_user
    ):
        """Test that only admin users can create admin sessions."""
        # Admin user should succeed
        session = await session_manager.create_session(
            user=admin_user,
            ip_address="192.168.1.1",
            user_agent="Mozilla/5.0",
            device_info={"browser": "Chrome"}
        )
        
        assert session is not None
        assert session.user_id == admin_user.id
        assert session.ip_address == "192.168.1.1"
        assert session.two_factor_verified is False
        
        # Regular user should fail
        with pytest.raises(SecurityException, match="Only admin users"):
            await session_manager.create_session(
                user=regular_user,
                ip_address="192.168.1.1",
                user_agent="Mozilla/5.0"
            )
    
    async def test_session_fingerprint(self, session_manager):
        """Test device fingerprint generation."""
        # Same device info should generate same fingerprint
        fp1 = SessionManager.generate_fingerprint(
            ip_address="192.168.1.1",
            user_agent="Mozilla/5.0",
            device_info={"browser": "Chrome", "version": "120"}
        )
        
        fp2 = SessionManager.generate_fingerprint(
            ip_address="192.168.1.1",
            user_agent="Mozilla/5.0",
            device_info={"browser": "Chrome", "version": "120"}
        )
        
        assert fp1 == fp2
        
        # Different device info should generate different fingerprint
        fp3 = SessionManager.generate_fingerprint(
            ip_address="192.168.1.2",  # Different IP
            user_agent="Mozilla/5.0",
            device_info={"browser": "Chrome", "version": "120"}
        )
        
        assert fp1 != fp3
    
    async def test_concurrent_session_limit(
        self,
        session_manager,
        admin_user
    ):
        """Test concurrent session limiting."""
        sessions = []
        
        # Create max allowed sessions
        for i in range(AdminSessionConfig.MAX_CONCURRENT_SESSIONS):
            session = await session_manager.create_session(
                user=admin_user,
                ip_address=f"192.168.1.{i+1}",
                user_agent="Mozilla/5.0"
            )
            sessions.append(session)
        
        # Get active sessions
        active = await session_manager.get_active_sessions(admin_user.id)
        assert len(active) == AdminSessionConfig.MAX_CONCURRENT_SESSIONS
        
        # Creating one more should invalidate the oldest
        new_session = await session_manager.create_session(
            user=admin_user,
            ip_address="192.168.1.100",
            user_agent="Mozilla/5.0"
        )
        
        # Check that we still have max sessions
        active = await session_manager.get_active_sessions(admin_user.id)
        assert len(active) == AdminSessionConfig.MAX_CONCURRENT_SESSIONS
    
    async def test_session_expiry(self, session_manager, admin_user):
        """Test session expiry checks."""
        # Create session
        session = await session_manager.create_session(
            user=admin_user,
            ip_address="192.168.1.1",
            user_agent="Mozilla/5.0"
        )
        
        # Fresh session should not be expired
        assert not session.is_expired
        assert session.remaining_time > timedelta(minutes=29)
        
        # Simulate inactivity timeout
        session.last_activity = get_utc_now() - AdminSessionConfig.INACTIVITY_TIMEOUT - timedelta(minutes=1)
        assert session.is_expired
        
        # Simulate absolute timeout
        session.last_activity = get_utc_now()
        session.created_at = get_utc_now() - AdminSessionConfig.ABSOLUTE_TIMEOUT - timedelta(minutes=1)
        assert session.is_expired
    
    async def test_session_validation(
        self,
        session_manager,
        admin_user,
        redis_client
    ):
        """Test session validation and updates."""
        # Create session
        session = await session_manager.create_session(
            user=admin_user,
            ip_address="192.168.1.1",
            user_agent="Mozilla/5.0"
        )
        
        # Validate with same IP
        validated = await session_manager.validate_session(
            token=session.token,
            ip_address="192.168.1.1",
            user_agent="Mozilla/5.0"
        )
        
        assert validated is not None
        assert validated.session_id == session.session_id
        
        # Validate with different IP (should log but allow)
        validated = await session_manager.validate_session(
            token=session.token,
            ip_address="192.168.1.2",  # Different IP
            user_agent="Mozilla/5.0"
        )
        
        assert validated is not None  # Still valid but logged
    
    async def test_two_factor_verification(
        self,
        session_manager,
        admin_user
    ):
        """Test 2FA verification on session."""
        # Create session
        session = await session_manager.create_session(
            user=admin_user,
            ip_address="192.168.1.1",
            user_agent="Mozilla/5.0"
        )
        
        assert not session.two_factor_verified
        
        # Verify 2FA
        await session_manager.verify_two_factor(session)
        assert session.two_factor_verified
    
    async def test_session_invalidation(
        self,
        session_manager,
        admin_user
    ):
        """Test session invalidation."""
        # Create session
        session = await session_manager.create_session(
            user=admin_user,
            ip_address="192.168.1.1",
            user_agent="Mozilla/5.0"
        )
        
        # Invalidate it
        await session_manager.invalidate_session(session)
        
        # Should not be able to validate anymore
        validated = await session_manager.validate_session(
            token=session.token,
            ip_address="192.168.1.1",
            user_agent="Mozilla/5.0"
        )
        
        assert validated is None
    
    async def test_invalidate_all_sessions(
        self,
        session_manager,
        admin_user
    ):
        """Test invalidating all user sessions."""
        # Create multiple sessions
        sessions = []
        for i in range(3):
            session = await session_manager.create_session(
                user=admin_user,
                ip_address=f"192.168.1.{i+1}",
                user_agent="Mozilla/5.0"
            )
            sessions.append(session)
        
        # Invalidate all
        count = await session_manager.invalidate_all_sessions(admin_user.id)
        assert count >= 3
        
        # No sessions should be active
        active = await session_manager.get_active_sessions(admin_user.id)
        assert len(active) == 0
    
    async def test_session_activity_update(
        self,
        session_manager,
        admin_user
    ):
        """Test updating session activity."""
        # Create session
        session = await session_manager.create_session(
            user=admin_user,
            ip_address="192.168.1.1",
            user_agent="Mozilla/5.0"
        )
        
        original_activity = session.last_activity
        
        # Wait a bit
        await asyncio.sleep(0.1)
        
        # Update activity
        await session_manager.update_activity(session)
        
        assert session.last_activity > original_activity
    
    async def test_expired_session_cleanup(
        self,
        session_manager,
        admin_user
    ):
        """Test cleanup of expired sessions."""
        # Create session
        session = await session_manager.create_session(
            user=admin_user,
            ip_address="192.168.1.1",
            user_agent="Mozilla/5.0"
        )
        
        # Manually expire it
        session.created_at = get_utc_now() - AdminSessionConfig.ABSOLUTE_TIMEOUT - timedelta(hours=1)
        await session_manager._store_session_in_cache(session)
        
        # Run cleanup
        cleaned = await session_manager.cleanup_expired_sessions()
        assert cleaned >= 1
        
        # Session should be gone
        active = await session_manager.get_active_sessions(admin_user.id)
        assert len(active) == 0


# Import asyncio
import asyncio