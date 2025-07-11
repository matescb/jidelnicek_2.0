"""
Tests for audit service.
"""

import pytest
from datetime import datetime, timezone, timedelta
from uuid import uuid4

from sqlalchemy.ext.asyncio import AsyncSession

from jidelnicek.auth.models import AuthUser
from jidelnicek.admin.services.audit_service import AdminAuditService
from jidelnicek.admin.models import AdminAuditLog, AdminAction
from jidelnicek.admin.schemas import AuditLogFilter


class TestAdminAuditService:
    """Test admin audit service functionality."""
    
    async def test_list_audit_logs(
        self,
        db_session: AsyncSession,
        audit_logs: list[AdminAuditLog]
    ):
        """Test listing audit logs."""
        service = AdminAuditService(db_session)
        
        logs, total = await service.list_audit_logs(
            page=1,
            per_page=10
        )
        
        assert total == len(audit_logs)
        assert len(logs) == len(audit_logs)
        # Verify newest first
        assert logs[0].created_at >= logs[-1].created_at
    
    async def test_list_audit_logs_with_filters(
        self,
        db_session: AsyncSession,
        admin_test_user: AuthUser,
        audit_logs: list[AdminAuditLog]
    ):
        """Test listing audit logs with filters."""
        service = AdminAuditService(db_session)
        
        # Filter by admin
        filters = AuditLogFilter(admin_id=admin_test_user.id)
        logs, total = await service.list_audit_logs(
            page=1,
            per_page=10,
            filters=filters
        )
        
        assert total == len(audit_logs)
        assert all(log.admin_id == admin_test_user.id for log in logs)
        
        # Filter by action
        filters = AuditLogFilter(action=AdminAction.USER_UPDATE.value)
        logs, total = await service.list_audit_logs(
            page=1,
            per_page=10,
            filters=filters
        )
        
        assert total == 1
        assert logs[0].action == AdminAction.USER_UPDATE
        
        # Filter by success
        filters = AuditLogFilter(success=False)
        logs, total = await service.list_audit_logs(
            page=1,
            per_page=10,
            filters=filters
        )
        
        assert total == 1
        assert logs[0].success is False
    
    async def test_list_audit_logs_with_date_filters(
        self,
        db_session: AsyncSession,
        admin_test_user: AuthUser
    ):
        """Test listing audit logs with date filters."""
        # Create logs with different timestamps
        now = datetime.now(timezone.utc)
        
        old_log = AdminAuditLog(
            admin_id=admin_test_user.id,
            action=AdminAction.USER_VIEW,
            target_type="user",
            target_id=uuid4(),
            created_at=now - timedelta(days=7)
        )
        
        recent_log = AdminAuditLog(
            admin_id=admin_test_user.id,
            action=AdminAction.USER_UPDATE,
            target_type="user",
            target_id=uuid4(),
            created_at=now - timedelta(hours=1)
        )
        
        db_session.add(old_log)
        db_session.add(recent_log)
        await db_session.commit()
        
        service = AdminAuditService(db_session)
        
        # Filter by date range
        filters = AuditLogFilter(
            start_date=now - timedelta(days=2),
            end_date=now
        )
        logs, total = await service.list_audit_logs(
            page=1,
            per_page=10,
            filters=filters
        )
        
        assert total == 1
        assert logs[0].id == recent_log.id
    
    async def test_get_audit_log_detail(
        self,
        db_session: AsyncSession,
        audit_logs: list[AdminAuditLog]
    ):
        """Test getting audit log details."""
        service = AdminAuditService(db_session)
        
        log = await service.get_audit_log_detail(audit_logs[0].id)
        
        assert log is not None
        assert log.id == audit_logs[0].id
        assert log.admin is not None  # Verify relationship loaded
        
        # Test non-existent log
        log = await service.get_audit_log_detail(uuid4())
        assert log is None
    
    async def test_get_user_audit_trail(
        self,
        db_session: AsyncSession,
        admin_regular_user: AuthUser,
        audit_logs: list[AdminAuditLog]
    ):
        """Test getting user audit trail."""
        service = AdminAuditService(db_session)
        
        logs = await service.get_user_audit_trail(
            user_id=admin_regular_user.id,
            limit=10
        )
        
        # Should have 2 logs for admin_regular_user (view and update)
        assert len(logs) == 2
        assert all(log.target_id == admin_regular_user.id for log in logs)
        assert all(log.target_type == "user" for log in logs)
        
        # Verify order (newest first)
        assert logs[0].action == AdminAction.USER_UPDATE
        assert logs[1].action == AdminAction.USER_VIEW
    
    async def test_get_admin_activity(
        self,
        db_session: AsyncSession,
        admin_test_user: AuthUser,
        audit_logs: list[AdminAuditLog]
    ):
        """Test getting admin activity."""
        service = AdminAuditService(db_session)
        
        logs = await service.get_admin_activity(
            admin_id=admin_test_user.id,
            limit=10
        )
        
        assert len(logs) == len(audit_logs)
        assert all(log.admin_id == admin_test_user.id for log in logs)
    
    async def test_get_failed_actions(
        self,
        db_session: AsyncSession,
        audit_logs: list[AdminAuditLog]
    ):
        """Test getting failed actions."""
        service = AdminAuditService(db_session)
        
        logs = await service.get_failed_actions(limit=10)
        
        assert len(logs) == 1
        assert logs[0].success is False
        assert logs[0].error_message == "User not found"
    
    async def test_export_audit_logs(
        self,
        db_session: AsyncSession,
        admin_test_user: AuthUser,
        audit_logs: list[AdminAuditLog]
    ):
        """Test exporting audit logs."""
        service = AdminAuditService(db_session)
        
        export_data = await service.export_audit_logs(format="json")
        
        assert export_data["total_entries"] == len(audit_logs)
        assert len(export_data["data"]) == len(audit_logs)
        
        # Verify exported data structure
        first_entry = export_data["data"][0]
        assert "id" in first_entry
        assert "timestamp" in first_entry
        assert "admin_email" in first_entry
        assert "action" in first_entry
        assert "success" in first_entry
        
        # Test with filters
        filters = AuditLogFilter(success=True)
        export_data = await service.export_audit_logs(
            filters=filters,
            format="json"
        )
        
        assert export_data["total_entries"] == 2
        assert export_data["filters_applied"]["success"] is True
    
    async def test_get_statistics(
        self,
        db_session: AsyncSession,
        admin_test_user: AuthUser,
        audit_logs: list[AdminAuditLog]
    ):
        """Test getting audit statistics."""
        service = AdminAuditService(db_session)
        
        stats = await service.get_statistics()
        
        assert stats["total_actions"] == len(audit_logs)
        assert stats["failed_actions"] == 1
        assert stats["success_rate"] == 66.67  # 2/3 successful
        
        # Check actions by type
        assert AdminAction.USER_VIEW.value in stats["actions_by_type"]
        assert AdminAction.USER_UPDATE.value in stats["actions_by_type"]
        assert AdminAction.USER_DELETE.value in stats["actions_by_type"]
        
        # Check most active admins
        assert len(stats["most_active_admins"]) == 1
        assert stats["most_active_admins"][0]["admin_id"] == str(admin_test_user.id)
        assert stats["most_active_admins"][0]["action_count"] == len(audit_logs)
    
    async def test_get_statistics_with_date_range(
        self,
        db_session: AsyncSession,
        admin_test_user: AuthUser
    ):
        """Test getting statistics with date range."""
        # Create logs with different timestamps
        now = datetime.now(timezone.utc)
        
        # Old log (outside range)
        old_log = AdminAuditLog(
            admin_id=admin_test_user.id,
            action=AdminAction.USER_VIEW,
            target_type="user",
            target_id=uuid4(),
            created_at=now - timedelta(days=30)
        )
        
        # Recent logs (within range)
        recent_logs = []
        for i in range(3):
            log = AdminAuditLog(
                admin_id=admin_test_user.id,
                action=AdminAction.USER_UPDATE,
                target_type="user",
                target_id=uuid4(),
                created_at=now - timedelta(hours=i)
            )
            recent_logs.append(log)
        
        db_session.add(old_log)
        db_session.add_all(recent_logs)
        await db_session.commit()
        
        service = AdminAuditService(db_session)
        
        # Get statistics for last 7 days
        stats = await service.get_statistics(
            start_date=now - timedelta(days=7),
            end_date=now
        )
        
        assert stats["total_actions"] == 3
        assert stats["date_range"]["start"] is not None
        assert stats["date_range"]["end"] is not None