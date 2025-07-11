"""
Tests for the cleanup service.
"""

import pytest
import pytest_asyncio
from datetime import datetime, timedelta
from pathlib import Path
from unittest.mock import Mock, patch, AsyncMock
from sqlalchemy import select

from jidelnicek.core.services.cleanup_service import CleanupService
from jidelnicek.core.models.cleanup_policy import (
    CleanupPolicy, CleanupAuditLog, DeletionQueue, CleanupStatistics
)
from jidelnicek.auth.models import User


@pytest_asyncio.fixture(scope="function")
async def cleanup_service(db_session):
    """Create cleanup service instance."""
    return CleanupService(db_session)


@pytest_asyncio.fixture(scope="function")
async def test_user(db_session):
    """Create a test user."""
    user = User(
        username="testuser",
        email="test@example.com",
        hashed_password="dummy",
        is_active=True,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture(scope="function")
async def cleanup_policy(db_session):
    """Create a test cleanup policy."""
    policy = CleanupPolicy(
        name="Test Policy",
        description="Test cleanup policy",
        file_type="shopping_list",
        retention_days=7,
        grace_period_hours=24,
        notify_before_deletion=True,
        is_active=True,
        priority=10,
    )
    db_session.add(policy)
    await db_session.commit()
    await db_session.refresh(policy)
    return policy


class TestCleanupService:
    """Tests for CleanupService."""
    
    async def test_get_active_policies(self, cleanup_service, cleanup_policy):
        """Test getting active cleanup policies."""
        policies = await cleanup_service.get_active_policies()
        assert len(policies) == 1
        assert policies[0].id == cleanup_policy.id
        assert policies[0].is_active is True
    
    async def test_get_policy_for_file_type(self, cleanup_service, cleanup_policy):
        """Test getting policy for specific file type."""
        policy = await cleanup_service.get_policy_for_file_type("shopping_list")
        assert policy is not None
        assert policy.file_type == "shopping_list"
        
        # Test non-existent file type
        policy = await cleanup_service.get_policy_for_file_type("non_existent")
        assert policy is None
    
    async def test_create_audit_log(self, cleanup_service, test_user):
        """Test creating cleanup audit log."""
        audit_log = await cleanup_service.create_audit_log(
            file_path="/exports/shopping_list_123.pdf",
            file_type="shopping_list",
            file_size=1024,
            reason="File older than retention period",
            user_id=test_user.id,
            metadata={"export_id": "test-123"},
        )
        
        assert audit_log.id is not None
        assert audit_log.file_path == "/exports/shopping_list_123.pdf"
        assert audit_log.file_type == "shopping_list"
        assert audit_log.file_size == 1024
        assert audit_log.user_id == test_user.id
        assert audit_log.metadata["export_id"] == "test-123"
    
    async def test_update_audit_log(self, cleanup_service, test_user):
        """Test updating audit log."""
        # Create audit log
        audit_log = await cleanup_service.create_audit_log(
            file_path="/test/file.pdf",
            file_type="test",
            file_size=1024,
            reason="Test",
            user_id=test_user.id,
        )
        
        # Update it
        await cleanup_service.update_audit_log(
            audit_log_id=audit_log.id,
            deleted=True,
            recovery_info={"backup_path": "/backup/file.pdf"},
        )
        
        # Verify update
        updated_log = await cleanup_service.db.get(CleanupAuditLog, audit_log.id)
        assert updated_log.deleted is True
        assert updated_log.recovery_info["backup_path"] == "/backup/file.pdf"
    
    async def test_queue_deletion_notification(self, cleanup_service, test_user):
        """Test queuing deletion notification."""
        deletion_time = datetime.utcnow() + timedelta(hours=24)
        
        with patch("jidelnicek.tasks.notification_tasks.send_deletion_notification.apply_async") as mock_task:
            await cleanup_service.queue_deletion_notification(
                user_id=test_user.id,
                file_path="/test/file.pdf",
                file_type="test",
                deletion_time=deletion_time,
                audit_log_id=1,
            )
            
            # Verify task was queued
            mock_task.assert_called_once()
            args, kwargs = mock_task.call_args
            assert args[0][0] == test_user.id
            assert args[0][1] == "/test/file.pdf"
    
    async def test_get_pending_deletions(self, cleanup_service, test_user):
        """Test getting pending deletions."""
        # Create deletion queue entries
        past_deletion = DeletionQueue(
            file_path="/test/old.pdf",
            file_type="test",
            user_id=test_user.id,
            scheduled_deletion_time=datetime.utcnow() - timedelta(hours=1),
            audit_log_id=1,
            processed=False,
        )
        future_deletion = DeletionQueue(
            file_path="/test/future.pdf",
            file_type="test",
            user_id=test_user.id,
            scheduled_deletion_time=datetime.utcnow() + timedelta(hours=1),
            audit_log_id=2,
            processed=False,
        )
        
        cleanup_service.db.add_all([past_deletion, future_deletion])
        await cleanup_service.db.commit()
        
        # Get pending deletions
        pending = await cleanup_service.get_pending_deletions()
        
        # Should only return past deletions
        assert len(pending) == 1
        assert pending[0]["file_path"] == "/test/old.pdf"
    
    @patch("jidelnicek.core.services.cleanup_service.RedisClient")
    async def test_cleanup_orphaned_metadata(self, mock_redis_class, cleanup_service, tmp_path):
        """Test cleanup of orphaned metadata."""
        # Create mock Redis client
        mock_redis = AsyncMock()
        mock_redis_class.return_value = mock_redis
        
        # Mock Redis scan and get
        mock_redis.__aenter__.return_value = mock_redis
        mock_redis.scan.return_value = (0, [b"export:123", b"export:456"])
        mock_redis.get.side_effect = [
            b'{"file_path": "/test/exists.pdf"}',
            b'{"file_path": "/test/missing.pdf"}',
        ]
        mock_redis.delete = AsyncMock()
        
        # Create existing file
        exists_file = tmp_path / "exists.pdf"
        exists_file.write_text("test")
        
        with patch("pathlib.Path.exists") as mock_exists:
            mock_exists.side_effect = [True, False]  # First file exists, second doesn't
            
            cleaned = await cleanup_service.cleanup_orphaned_metadata()
            
            # Should have deleted one orphaned entry
            assert cleaned == 1
            mock_redis.delete.assert_called_once_with(b"export:456")
    
    async def test_update_cleanup_statistics(self, cleanup_service):
        """Test updating cleanup statistics."""
        stats = {
            "deleted_files": 10,
            "deleted_size": 1024 * 1024,  # 1MB
            "errors": 2,
            "by_type": {
                "shopping_list": {"count": 5, "size": 512 * 1024},
                "trip_data": {"count": 5, "size": 512 * 1024},
            },
        }
        
        await cleanup_service.update_cleanup_statistics(stats)
        
        # Verify statistics were created
        today = datetime.utcnow().date()
        result = await cleanup_service.db.execute(
            select(CleanupStatistics).where(CleanupStatistics.date == today)
        )
        stat_entry = result.scalar_one()
        
        assert stat_entry.files_deleted == 10
        assert stat_entry.total_size_freed == 1024 * 1024
        assert stat_entry.errors_count == 2
        assert stat_entry.by_type_stats["shopping_list"]["count"] == 5
    
    async def test_get_user_cleanup_preferences(self, cleanup_service, test_user):
        """Test getting user cleanup preferences."""
        # Set preferences
        test_user.metadata = {
            "cleanup_preferences": {
                "shopping_list_retention_days": 14,
                "enable_notifications": True,
            }
        }
        await cleanup_service.db.commit()
        
        # Get preferences
        prefs = await cleanup_service.get_user_cleanup_preferences(test_user.id)
        
        assert prefs["shopping_list_retention_days"] == 14
        assert prefs["enable_notifications"] is True
    
    async def test_generate_cleanup_report(self, cleanup_service, test_user):
        """Test generating cleanup report."""
        # Create test data
        today = datetime.utcnow().date()
        
        # Add statistics
        stats = CleanupStatistics(
            date=today,
            files_deleted=10,
            total_size_freed=1024 * 1024,
            errors_count=1,
            by_type_stats={
                "shopping_list": {"count": 10, "size": 1024 * 1024}
            },
        )
        cleanup_service.db.add(stats)
        
        # Add audit logs
        audit_log = CleanupAuditLog(
            file_path="/test/file.pdf",
            file_type="shopping_list",
            file_size=1024,
            deletion_reason="Test",
            deleted_at=datetime.utcnow(),
            user_id=test_user.id,
        )
        cleanup_service.db.add(audit_log)
        
        await cleanup_service.db.commit()
        
        # Generate report
        report = await cleanup_service.generate_cleanup_report(
            start_date=datetime.utcnow() - timedelta(days=1),
            end_date=datetime.utcnow(),
        )
        
        assert report["summary"]["total_files_deleted"] == 10
        assert report["summary"]["total_size_freed"] == 1024 * 1024
        assert report["summary"]["total_errors"] == 1
        assert "shopping_list" in report["by_type"]