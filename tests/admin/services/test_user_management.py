"""
Tests for user management service.
"""

import pytest
from datetime import datetime, timezone, timedelta
from uuid import uuid4
from unittest.mock import patch, AsyncMock

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from jidelnicek.auth.models import AuthUser, AuthSession
from jidelnicek.admin.services.user_management import UserManagementService
from jidelnicek.admin.models import AdminAuditLog, AdminAction
from jidelnicek.admin.schemas import (
    UserFilter, UserSort, SortField, SortOrder,
    UserStatus, UserRole, BulkOperationResult
)


class TestUserManagementService:
    """Test user management service functionality."""
    
    async def test_list_users_basic(
        self,
        db_session: AsyncSession,
        admin_test_user: AuthUser,
        multiple_users: list[AuthUser]
    ):
        """Test basic user listing."""
        service = UserManagementService(db_session, admin_test_user)
        
        users, total, stats = await service.list_users(
            page=1,
            per_page=5
        )
        
        assert len(users) == 5
        assert total == 11  # 10 test users + 1 admin
        assert stats["total_users"] == 11
        
        # Verify audit log
        result = await db_session.execute(
            select(AdminAuditLog).where(
                AdminAuditLog.action == AdminAction.USER_LIST
            )
        )
        audit_log = result.scalar_one()
        assert audit_log.admin_id == admin_test_user.id
        assert audit_log.success is True
    
    async def test_list_users_with_filters(
        self,
        db_session: AsyncSession,
        admin_test_user: AuthUser,
        multiple_users: list[AuthUser]
    ):
        """Test user listing with filters."""
        service = UserManagementService(db_session, admin_test_user)
        
        # Filter by email verified
        filters = UserFilter(email_verified=True)
        users, total, _ = await service.list_users(
            page=1,
            per_page=20,
            filters=filters
        )
        
        # Count verified users: half of test users (5) + admin (1) = 6 expected, but we need to check actual count
        expected_verified = sum(1 for user in multiple_users if user.email_verified) + (1 if admin_test_user.email_verified else 0)
        assert total == expected_verified
        assert all(user.email_verified for user in users)
        
        # Filter by email search - use the unique UUID from multiple_users fixture
        user1_email = multiple_users[1].email  # Get the actual email of user1
        filters = UserFilter(email=user1_email.split('@')[0])  # Extract the part before @
        users, total, _ = await service.list_users(
            page=1,
            per_page=20,
            filters=filters
        )
        
        assert total == 1
        assert users[0].email == user1_email
    
    async def test_list_users_with_sorting(
        self,
        db_session: AsyncSession,
        admin_test_user: AuthUser,
        multiple_users: list[AuthUser]
    ):
        """Test user listing with sorting."""
        service = UserManagementService(db_session, admin_test_user)
        
        # Sort by recipe count descending
        sort = UserSort(field=SortField.RECIPE_COUNT, order=SortOrder.DESC)
        users, _, _ = await service.list_users(
            page=1,
            per_page=5,
            sort=sort
        )
        
        # Verify descending order
        recipe_counts = [user.recipe_count for user in users]
        assert recipe_counts == sorted(recipe_counts, reverse=True)
    
    async def test_get_user_detail(
        self,
        db_session: AsyncSession,
        admin_test_user: AuthUser,
        admin_regular_user: AuthUser
    ):
        """Test getting user details."""
        service = UserManagementService(db_session, admin_test_user)
        
        # Create a session for the user
        session = AuthSession(
            user_id=admin_regular_user.id,
            token_hash="test_hash",
            expires_at=datetime.now(timezone.utc) + timedelta(days=1),
            ip_address="192.168.1.1",
            user_agent="Test Browser",
            device_name="Test Device",
            location="Test Location"
        )
        db_session.add(session)
        await db_session.commit()
        
        user_data = await service.get_user_detail(
            user_id=admin_regular_user.id,
            include_sessions=True
        )
        
        assert user_data["id"] == admin_regular_user.id
        assert user_data["email"] == admin_regular_user.email
        assert user_data["session_count"] == 1
        assert user_data["active_session_count"] == 1
        assert len(user_data["recent_sessions"]) == 1
        
        # Verify audit log
        result = await db_session.execute(
            select(AdminAuditLog).where(
                AdminAuditLog.action == AdminAction.USER_VIEW,
                AdminAuditLog.target_id == admin_regular_user.id
            )
        )
        audit_log = result.scalar_one()
        assert audit_log.admin_id == admin_test_user.id
    
    async def test_create_user(
        self,
        db_session: AsyncSession,
        admin_test_user: AuthUser
    ):
        """Test user creation."""
        service = UserManagementService(db_session, admin_test_user)
        
        test_email = f"newuser-{str(uuid4())[:8]}@test.com"
        with patch.object(service.email_service, 'send_admin_created_account', new_callable=AsyncMock):
            user = await service.create_user(
                email=test_email,
                password="NewUser123!",
                role=UserRole.USER,
                email_verified=False,
                send_welcome_email=True,
                preferences={
                    "language": "en",
                    "timezone": "UTC"
                }
            )
        
        assert user.email == test_email
        assert user.role == "user"
        assert user.language == "en"
        assert user.timezone == "UTC"
        
        # Verify password was hashed
        assert user.password_hash != "NewUser123!"
        
        # Verify audit log
        result = await db_session.execute(
            select(AdminAuditLog).where(
                AdminAuditLog.action == AdminAction.USER_CREATE,
                AdminAuditLog.target_id == user.id
            )
        )
        audit_log = result.scalar_one()
        assert audit_log.admin_id == admin_test_user.id
        assert audit_log.after_state["email"] == test_email
    
    async def test_create_user_duplicate_email(
        self,
        db_session: AsyncSession,
        admin_test_user: AuthUser,
        admin_regular_user: AuthUser
    ):
        """Test creating user with duplicate email."""
        service = UserManagementService(db_session, admin_test_user)
        
        with pytest.raises(ValueError, match="already exists"):
            await service.create_user(
                email=admin_regular_user.email,
                password="Test123!"
            )
    
    async def test_update_user(
        self,
        db_session: AsyncSession,
        admin_test_user: AuthUser,
        admin_regular_user: AuthUser
    ):
        """Test user update."""
        service = UserManagementService(db_session, admin_test_user)
        
        original_email = admin_regular_user.email
        updated_user = await service.update_user(
            user_id=admin_regular_user.id,
            updates={
                "role": "admin",
                "language": "en"
            },
            reason="Promoting to admin"
        )
        
        assert updated_user.role == "admin"
        assert updated_user.language == "en"
        assert updated_user.email == original_email  # Unchanged
        
        # Verify audit log
        result = await db_session.execute(
            select(AdminAuditLog).where(
                AdminAuditLog.action == AdminAction.USER_UPDATE,
                AdminAuditLog.target_id == admin_regular_user.id
            )
        )
        audit_log = result.scalar_one()
        assert audit_log.changes["role"]["from"] == "user"
        assert audit_log.changes["role"]["to"] == "admin"
        assert audit_log.reason == "Promoting to admin"
    
    async def test_suspend_user(
        self,
        db_session: AsyncSession,
        admin_test_user: AuthUser,
        admin_regular_user: AuthUser
    ):
        """Test user suspension."""
        service = UserManagementService(db_session, admin_test_user)
        
        # Create a session to verify it gets invalidated
        session = AuthSession(
            user_id=admin_regular_user.id,
            token_hash="test_hash",
            expires_at=datetime.now(timezone.utc) + timedelta(days=1),
            is_valid=True
        )
        db_session.add(session)
        await db_session.commit()
        
        with patch.object(service.email_service, 'send_account_suspended', new_callable=AsyncMock):
            success = await service.suspend_user(
                user_id=admin_regular_user.id,
                reason="Policy violation",
                notify_user=True
            )
        
        assert success is True
        
        # Verify user is suspended
        await db_session.refresh(admin_regular_user)
        assert admin_regular_user.is_active is False
        
        # Verify session was invalidated
        await db_session.refresh(session)
        assert session.is_valid is False
    
    async def test_reset_user_password(
        self,
        db_session: AsyncSession,
        admin_test_user: AuthUser,
        admin_regular_user: AuthUser
    ):
        """Test password reset."""
        service = UserManagementService(db_session, admin_test_user)
        
        original_hash = admin_regular_user.password_hash
        
        with patch.object(service.email_service, 'send_admin_password_reset', new_callable=AsyncMock):
            success, password = await service.reset_user_password(
                user_id=admin_regular_user.id,
                generate_random=True,
                send_email=True,
                reason="User request"
            )
        
        assert success is True
        assert password is not None
        assert len(password) == 12
        
        # Verify password was changed
        await db_session.refresh(admin_regular_user)
        assert admin_regular_user.password_hash != original_hash
        
        # Verify audit log
        result = await db_session.execute(
            select(AdminAuditLog).where(
                AdminAuditLog.action == AdminAction.USER_RESET_PASSWORD,
                AdminAuditLog.target_id == admin_regular_user.id
            )
        )
        audit_log = result.scalar_one()
        assert audit_log.reason == "User request"
    
    async def test_force_logout_user(
        self,
        db_session: AsyncSession,
        admin_test_user: AuthUser,
        admin_regular_user: AuthUser
    ):
        """Test force logout."""
        service = UserManagementService(db_session, admin_test_user)
        
        # Create multiple sessions
        for i in range(3):
            session = AuthSession(
                user_id=admin_regular_user.id,
                token_hash=f"test_hash_{i}",
                expires_at=datetime.now(timezone.utc) + timedelta(days=1),
                is_valid=True
            )
            db_session.add(session)
        await db_session.commit()
        
        count = await service.force_logout_user(
            user_id=admin_regular_user.id,
            reason="Security concern",
            logout_all=True
        )
        
        assert count == 3
        
        # Verify all sessions invalidated
        result = await db_session.execute(
            select(func.count(AuthSession.id)).where(
                AuthSession.user_id == admin_regular_user.id,
                AuthSession.is_valid == True
            )
        )
        valid_count = result.scalar_one()
        assert valid_count == 0
    
    async def test_bulk_operation_suspend(
        self,
        db_session: AsyncSession,
        admin_test_user: AuthUser,
        multiple_users: list[AuthUser]
    ):
        """Test bulk suspension."""
        service = UserManagementService(db_session, admin_test_user)
        
        # Select users to suspend
        user_ids = [user.id for user in multiple_users[:3]]
        
        with patch.object(service.email_service, 'send_account_suspended', new_callable=AsyncMock):
            result = await service.bulk_operation(
                user_ids=user_ids,
                operation="suspend",
                reason="Bulk test",
                send_notifications=False
            )
        
        assert isinstance(result, BulkOperationResult)
        assert result.total == 3
        assert result.successful == 3
        assert result.failed == 0
        
        # Verify users are suspended
        for user_id in user_ids:
            result = await db_session.execute(
                select(AuthUser).where(AuthUser.id == user_id)
            )
            user = result.scalar_one()
            assert user.is_active is False
    
    async def test_delete_user(
        self,
        db_session: AsyncSession,
        admin_test_user: AuthUser,
        admin_regular_user: AuthUser
    ):
        """Test user deletion (archival)."""
        service = UserManagementService(db_session, admin_test_user)
        
        success = await service.delete_user(admin_regular_user.id)
        
        assert success is True
        
        # Verify user is archived
        await db_session.refresh(admin_regular_user)
        assert admin_regular_user.is_archived is True
        assert admin_regular_user.is_active is False
    
    async def test_delete_self_prevented(
        self,
        db_session: AsyncSession,
        admin_test_user: AuthUser
    ):
        """Test prevention of self-deletion."""
        service = UserManagementService(db_session, admin_test_user)
        
        with pytest.raises(ValueError, match="Cannot delete your own admin account"):
            await service.delete_user(admin_test_user.id)
    
    async def test_search_users(
        self,
        db_session: AsyncSession,
        admin_test_user: AuthUser,
        multiple_users: list[AuthUser]
    ):
        """Test user search."""
        service = UserManagementService(db_session, admin_test_user)
        
        results = await service.search_users(
            query="user1",
            limit=5
        )
        
        assert len(results) == 1
        assert results[0]["email"] == "user1@test.com"
        
        # Test partial match
        results = await service.search_users(
            query="user",
            limit=5
        )
        
        assert len(results) == 5  # Limited by limit parameter
    
    async def test_calculate_user_statistics(
        self,
        db_session: AsyncSession,
        admin_test_user: AuthUser,
        multiple_users: list[AuthUser]
    ):
        """Test user statistics calculation."""
        service = UserManagementService(db_session, admin_test_user)
        
        stats = await service._calculate_user_statistics()
        
        assert stats["total_users"] == 11  # 10 test users + 1 admin
        assert stats["admin_count"] == 1
        assert stats["user_count"] == 10
        assert stats["verified_emails"] == 6  # Half test users + admin
        assert "registrations_today" in stats