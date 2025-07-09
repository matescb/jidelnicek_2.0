"""
Tests for cleanup tasks.
"""

import pytest
from datetime import datetime, timedelta
from pathlib import Path
from unittest.mock import Mock, patch, AsyncMock, MagicMock
import json

from jidelnicek.tasks.cleanup_tasks import (
    cleanup_export_files,
    cleanup_cloud_storage,
    cleanup_temp_files,
    process_deletion_queue,
    cleanup_old_jobs,
    generate_cleanup_report,
)
from jidelnicek.core.models.cleanup_policy import CleanupPolicy
from jidelnicek.core.models.job import Job, JobStatus


@pytest.fixture
def mock_task():
    """Create a mock Celery task."""
    task = MagicMock()
    task.update_state = MagicMock()
    task.retry = MagicMock(side_effect=Exception("Retry"))
    return task


@pytest.fixture
async def cleanup_policy(db_session):
    """Create test cleanup policy."""
    policy = CleanupPolicy(
        name="Test Policy",
        file_type="shopping_list",
        retention_days=7,
        grace_period_hours=24,
        notify_before_deletion=True,
        is_active=True,
    )
    db_session.add(policy)
    await db_session.commit()
    return policy


class TestCleanupTasks:
    """Tests for cleanup tasks."""
    
    @patch("jidelnicek.tasks.cleanup_tasks.DatabaseSession")
    @patch("jidelnicek.tasks.cleanup_tasks.CleanupService")
    @patch("pathlib.Path.exists")
    @patch("pathlib.Path.mkdir")
    @patch("pathlib.Path.rglob")
    @patch("pathlib.Path.stat")
    @patch("pathlib.Path.unlink")
    async def test_cleanup_export_files(
        self,
        mock_unlink,
        mock_stat,
        mock_rglob,
        mock_mkdir,
        mock_exists,
        mock_cleanup_service,
        mock_db_session,
        mock_task,
        cleanup_policy,
    ):
        """Test cleanup export files task."""
        # Setup mocks
        mock_exists.return_value = True
        mock_db_session.return_value.__aenter__.return_value = Mock()
        
        # Mock cleanup service
        service_instance = Mock()
        mock_cleanup_service.return_value = service_instance
        service_instance.get_active_policies = AsyncMock(return_value=[cleanup_policy])
        service_instance.get_export_metadata = AsyncMock(return_value={"id": "123", "created_by": 1})
        service_instance.create_audit_log = AsyncMock()
        service_instance.queue_deletion_notification = AsyncMock()
        service_instance.remove_export_metadata = AsyncMock()
        service_instance.cleanup_orphaned_metadata = AsyncMock()
        service_instance.update_cleanup_statistics = AsyncMock()
        
        # Mock file system
        old_file = Mock()
        old_file.is_file.return_value = True
        old_file.stat.return_value.st_mtime = (datetime.utcnow() - timedelta(days=10)).timestamp()
        old_file.stat.return_value.st_size = 1024
        old_file.__str__.return_value = "/exports/shopping_lists/old_file.pdf"
        
        new_file = Mock()
        new_file.is_file.return_value = True
        new_file.stat.return_value.st_mtime = (datetime.utcnow() - timedelta(days=1)).timestamp()
        new_file.stat.return_value.st_size = 2048
        new_file.__str__.return_value = "/exports/shopping_lists/new_file.pdf"
        
        mock_rglob.return_value = [old_file, new_file]
        
        # Run task
        result = cleanup_export_files(mock_task, dry_run=False, force=True)
        
        # Verify results
        assert result["scanned_files"] == 2
        assert result["deleted_files"] == 1
        assert result["deleted_size"] == 1024
        
        # Verify old file was deleted
        old_file.unlink.assert_called_once()
        
        # Verify audit log was created
        service_instance.create_audit_log.assert_called_once()
        
        # Verify statistics were updated
        service_instance.update_cleanup_statistics.assert_called_once()
    
    @patch("jidelnicek.tasks.cleanup_tasks.DatabaseSession")
    @patch("jidelnicek.tasks.cleanup_tasks.CleanupService")
    @patch("jidelnicek.core.storage.service.StorageService")
    async def test_cleanup_cloud_storage(
        self,
        mock_storage_service,
        mock_cleanup_service,
        mock_db_session,
        mock_task,
    ):
        """Test cleanup cloud storage task."""
        # Setup mocks
        mock_db_session.return_value.__aenter__.return_value = Mock()
        
        # Mock cleanup service
        service_instance = Mock()
        mock_cleanup_service.return_value = service_instance
        service_instance.cleanup_s3_storage = AsyncMock(
            return_value={"scanned": 10, "deleted": 5, "size": 1024}
        )
        service_instance.cleanup_azure_storage = AsyncMock(
            return_value={"scanned": 8, "deleted": 3, "size": 512}
        )
        
        # Run task
        result = cleanup_cloud_storage(mock_task, storage_type="all", dry_run=False)
        
        # Verify results
        assert result["scanned_objects"] == 18
        assert result["deleted_objects"] == 8
        assert result["deleted_size"] == 1536
        assert result["by_storage"]["s3"]["count"] == 5
        assert result["by_storage"]["azure"]["count"] == 3
    
    @patch("tempfile.gettempdir")
    @patch("pathlib.Path.glob")
    @patch("pathlib.Path.is_file")
    @patch("pathlib.Path.is_dir")
    @patch("pathlib.Path.stat")
    @patch("pathlib.Path.unlink")
    @patch("pathlib.Path.rmdir")
    @patch("pathlib.Path.iterdir")
    async def test_cleanup_temp_files(
        self,
        mock_iterdir,
        mock_rmdir,
        mock_unlink,
        mock_stat,
        mock_is_dir,
        mock_is_file,
        mock_glob,
        mock_tempdir,
        mock_task,
    ):
        """Test cleanup temp files task."""
        # Setup mocks
        mock_tempdir.return_value = "/tmp"
        
        # Mock old temp file
        old_file = Mock()
        old_file.is_file.return_value = True
        old_file.is_dir.return_value = False
        old_file.stat.return_value.st_mtime = (datetime.utcnow() - timedelta(days=2)).timestamp()
        old_file.stat.return_value.st_size = 1024
        
        # Mock new temp file
        new_file = Mock()
        new_file.is_file.return_value = True
        new_file.is_dir.return_value = False
        new_file.stat.return_value.st_mtime = (datetime.utcnow() - timedelta(hours=1)).timestamp()
        new_file.stat.return_value.st_size = 512
        
        # Mock empty directory
        empty_dir = Mock()
        empty_dir.is_file.return_value = False
        empty_dir.is_dir.return_value = True
        empty_dir.iterdir.return_value = []
        
        mock_glob.return_value = [old_file, new_file, empty_dir]
        
        # Run task
        result = cleanup_temp_files(mock_task)
        
        # Verify results
        assert result["deleted_files"] == 2  # Old file + empty dir
        assert result["deleted_size"] == 1024
        
        # Verify old file was deleted
        old_file.unlink.assert_called_once()
        
        # Verify new file was not deleted
        new_file.unlink.assert_not_called()
        
        # Verify empty directory was removed
        empty_dir.rmdir.assert_called_once()
    
    @patch("jidelnicek.tasks.cleanup_tasks.DatabaseSession")
    @patch("jidelnicek.tasks.cleanup_tasks.CleanupService")
    @patch("pathlib.Path.exists")
    @patch("pathlib.Path.unlink")
    async def test_process_deletion_queue(
        self,
        mock_unlink,
        mock_exists,
        mock_cleanup_service,
        mock_db_session,
        mock_task,
    ):
        """Test process deletion queue task."""
        # Setup mocks
        mock_db_session.return_value.__aenter__.return_value = Mock()
        mock_exists.return_value = True
        
        # Mock cleanup service
        service_instance = Mock()
        mock_cleanup_service.return_value = service_instance
        
        # Mock pending deletions
        pending_deletions = [
            {
                "id": 1,
                "file_path": "/test/file1.pdf",
                "file_type": "test",
                "user_id": 1,
                "scheduled_deletion_time": datetime.utcnow() - timedelta(hours=1),
                "audit_log_id": 1,
            },
            {
                "id": 2,
                "file_path": "/test/file2.pdf",
                "file_type": "test",
                "user_id": 2,
                "scheduled_deletion_time": datetime.utcnow() + timedelta(hours=1),
                "audit_log_id": 2,
            },
        ]
        
        service_instance.get_pending_deletions = AsyncMock(return_value=pending_deletions)
        service_instance.update_audit_log = AsyncMock()
        service_instance.remove_from_deletion_queue = AsyncMock()
        
        # Run task
        result = process_deletion_queue(mock_task)
        
        # Verify results
        assert result["processed"] == 2
        assert result["deleted"] == 1  # Only past deletion
        assert result["skipped"] == 1  # Future deletion
        
        # Verify file was deleted
        mock_unlink.assert_called_once()
        
        # Verify audit log was updated
        service_instance.update_audit_log.assert_called_once_with(
            audit_log_id=1,
            deleted=True,
        )
        
        # Verify queue entry was removed
        service_instance.remove_from_deletion_queue.assert_called_once_with(1)
    
    @patch("jidelnicek.tasks.cleanup_tasks.DatabaseSession")
    @patch("sqlalchemy.ext.asyncio.AsyncSession.execute")
    @patch("sqlalchemy.ext.asyncio.AsyncSession.commit")
    async def test_cleanup_old_jobs(
        self,
        mock_commit,
        mock_execute,
        mock_db_session,
        mock_task,
    ):
        """Test cleanup old jobs task."""
        # Setup mocks
        mock_session = Mock()
        mock_db_session.return_value.__aenter__.return_value = mock_session
        mock_session.execute = mock_execute
        mock_session.commit = mock_commit
        
        # Mock count result
        count_result = Mock()
        count_result.scalar.return_value = 10
        mock_execute.return_value = count_result
        
        # Run task
        result = cleanup_old_jobs(mock_task, days_to_keep=30)
        
        # Verify results
        assert result["deleted_jobs"] == 10
        assert "cutoff_date" in result
        
        # Verify queries were executed
        assert mock_execute.call_count == 2  # Count + update
        mock_commit.assert_called_once()
    
    @patch("jidelnicek.tasks.cleanup_tasks.DatabaseSession")
    @patch("jidelnicek.tasks.cleanup_tasks.CleanupService")
    async def test_generate_cleanup_report(
        self,
        mock_cleanup_service,
        mock_db_session,
        mock_task,
    ):
        """Test generate cleanup report task."""
        # Setup mocks
        mock_db_session.return_value.__aenter__.return_value = Mock()
        
        # Mock cleanup service
        service_instance = Mock()
        mock_cleanup_service.return_value = service_instance
        
        # Mock report data
        report_data = {
            "period": {
                "start": "2024-01-01T00:00:00",
                "end": "2024-01-31T23:59:59",
            },
            "summary": {
                "total_files_deleted": 100,
                "total_size_freed": 1024 * 1024 * 100,
                "total_errors": 5,
                "files_recovered": 2,
            },
            "by_type": {
                "shopping_list": {"count": 50, "size": 1024 * 1024 * 50},
                "trip_data": {"count": 50, "size": 1024 * 1024 * 50},
            },
        }
        
        service_instance.generate_cleanup_report = AsyncMock(return_value=report_data)
        
        # Run task
        result = generate_cleanup_report(
            mock_task,
            start_date="2024-01-01T00:00:00",
            end_date="2024-01-31T23:59:59",
        )
        
        # Verify results
        assert result == report_data
        
        # Verify report was generated
        service_instance.generate_cleanup_report.assert_called_once()