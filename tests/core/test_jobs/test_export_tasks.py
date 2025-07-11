"""
Tests for export tasks.

This module tests the Celery tasks for handling export operations.
"""

import pytest
from unittest.mock import Mock, patch, AsyncMock
import json
from datetime import datetime, timedelta
from pathlib import Path
import uuid

from celery.exceptions import SoftTimeLimitExceeded

from jidelnicek.tasks.export_tasks import (
    export_shopping_list,
    export_trip_data,
    export_recipes,
    export_large_dataset,
    cleanup_expired_jobs,
    cleanup_old_exports,
    ExportTask,
)


@pytest.fixture
def mock_task():
    """Create a mock Celery task."""
    task = Mock(spec=ExportTask)
    task.update_state = Mock()
    task.retry = Mock(side_effect=Exception("Task retry"))
    return task


@pytest.fixture
def mock_db_session():
    """Create a mock database session."""
    return AsyncMock()


@pytest.fixture
def mock_redis_client():
    """Create a mock Redis client."""
    client = AsyncMock()
    client.set = AsyncMock(return_value=True)
    client.get = AsyncMock(return_value=None)
    client.delete = AsyncMock(return_value=1)
    client.scan = AsyncMock(return_value=(0, []))
    return client


class TestExportTasks:
    """Test export task functionality."""
    
    @patch('asyncio.run')
    @patch.object(export_shopping_list, 'update_state')
    def test_export_shopping_list_success(self, mock_update_state, mock_asyncio_run):
        """Test successful shopping list export."""
        # Arrange
        export_result = {
            "export_id": str(uuid.uuid4()),
            "file_path": "/exports/shopping_list.pdf",
            "file_size": 1024,
            "format": "pdf",
            "download_url": "/api/v1/exports/test/download",
            "expires_at": (datetime.utcnow() + timedelta(days=7)).isoformat(),
        }
        mock_asyncio_run.return_value = export_result
        
        # Act
        result = export_shopping_list(
            trip_id=123,
            format="pdf",
            options={"group_by_category": True},
            user_id=1,
        )
        
        # Assert
        assert result == export_result
        mock_update_state.assert_called()
        mock_asyncio_run.assert_called_once()
    
    @patch('asyncio.run')
    @patch.object(export_shopping_list, 'update_state')
    def test_export_shopping_list_timeout(self, mock_update_state, mock_asyncio_run):
        """Test shopping list export timeout."""
        # Arrange
        mock_asyncio_run.side_effect = SoftTimeLimitExceeded()
        
        # Act & Assert
        with pytest.raises(SoftTimeLimitExceeded):
            export_shopping_list(
                trip_id=123,
                format="pdf",
                user_id=1,
            )
    
    @patch('asyncio.run')
    @patch.object(export_shopping_list, 'update_state')
    @patch.object(export_shopping_list, 'retry')
    def test_export_shopping_list_retry_on_error(self, mock_retry, mock_update_state, mock_asyncio_run):
        """Test shopping list export retry on error."""
        # Arrange
        mock_asyncio_run.side_effect = Exception("Database error")
        mock_retry.side_effect = Exception("Task retry")
        
        # Act & Assert
        with pytest.raises(Exception) as exc_info:
            export_shopping_list(
                trip_id=123,
                format="pdf",
                user_id=1,
            )
        
        assert "Task retry" in str(exc_info.value)
        mock_retry.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_export_shopping_list_async_implementation(self, mock_db_session, mock_redis_client):
        """Test async implementation of shopping list export."""
        from jidelnicek.tasks.export_tasks import _export_shopping_list_async
        
        # Arrange
        mock_task = Mock()
        mock_task.update_state = Mock()
        
        mock_export_manager = AsyncMock()
        mock_export_manager.export = AsyncMock(return_value={"status": "success"})
        
        with patch('jidelnicek.tasks.export_tasks.DatabaseSession') as mock_db_context:
            with patch('jidelnicek.tasks.export_tasks.RedisClient') as mock_redis_context:
                with patch('jidelnicek.tasks.export_tasks.ExportManager', return_value=mock_export_manager):
                    with patch('jidelnicek.tasks.export_tasks.Path') as mock_path:
                        mock_db_context.return_value.__aenter__.return_value = mock_db_session
                        mock_redis_context.return_value.__aenter__.return_value = mock_redis_client
                        
                        mock_file_path = Mock()
                        mock_file_path.stat.return_value.st_size = 1024
                        mock_path.return_value = Mock()
                        mock_path.return_value.__truediv__ = Mock(return_value=mock_file_path)
                        
                        # Act
                        result = await _export_shopping_list_async(
                            trip_id=123,
                            format="pdf",
                            options={},
                            user_id=1,
                            task=mock_task,
                        )
                        
                        # Assert
                        assert "export_id" in result
                        assert "file_path" in result
                        assert "download_url" in result
                        assert result["format"] == "pdf"
                        mock_export_manager.export.assert_called_once()
                        mock_redis_client.set.assert_called_once()
    
    @patch('asyncio.run')
    def test_cleanup_expired_jobs(self, mock_asyncio_run):
        """Test cleanup of expired jobs."""
        # Arrange
        mock_asyncio_run.return_value = {"cleaned": 5}
        
        # Act
        result = cleanup_expired_jobs()
        
        # Assert
        assert result == {"cleaned": 5}
        mock_asyncio_run.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_cleanup_expired_jobs_async_implementation(self, mock_redis_client):
        """Test async implementation of expired jobs cleanup."""
        from jidelnicek.tasks.export_tasks import _cleanup_expired_jobs_async
        
        # Arrange
        expired_job = {
            "updated_at": (datetime.utcnow() - timedelta(days=8)).isoformat()
        }
        mock_redis_client.scan = AsyncMock(side_effect=[
            (1, [b"job:1", b"job:2"]),
            (0, [b"job:3"])
        ])
        mock_redis_client.get = AsyncMock(side_effect=[
            json.dumps(expired_job),
            json.dumps({"updated_at": datetime.utcnow().isoformat()}),
            json.dumps(expired_job),
        ])
        mock_redis_client.delete = AsyncMock(return_value=1)
        
        with patch('jidelnicek.tasks.export_tasks.RedisClient') as mock_redis_context:
            mock_redis_context.return_value.__aenter__.return_value = mock_redis_client
            
            # Act
            result = await _cleanup_expired_jobs_async()
            
            # Assert
            assert result["cleaned"] == 2
            assert mock_redis_client.delete.call_count == 2
    
    @patch('asyncio.run')
    def test_cleanup_old_exports(self, mock_asyncio_run):
        """Test cleanup of old export files."""
        # Arrange
        mock_asyncio_run.return_value = {"files": 10, "size": 10485760}
        
        # Act
        result = cleanup_old_exports()
        
        # Assert
        assert result == {"files": 10, "size": 10485760}
        mock_asyncio_run.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_cleanup_old_exports_async_implementation(self, mock_redis_client, tmp_path):
        """Test async implementation of old exports cleanup."""
        from jidelnicek.tasks.export_tasks import _cleanup_old_exports_async
        
        # Create test files
        export_dir = tmp_path / "exports" / "test"
        export_dir.mkdir(parents=True)
        
        # Old file (should be deleted)
        old_file = export_dir / "old_export.pdf"
        old_file.write_text("old content")
        # Make it old
        import os
        old_timestamp = (datetime.utcnow() - timedelta(days=8)).timestamp()
        os.utime(old_file, (old_timestamp, old_timestamp))
        
        # Recent file (should be kept)
        recent_file = export_dir / "recent_export.pdf"
        recent_file.write_text("recent content")
        
        with patch('jidelnicek.tasks.export_tasks.settings') as mock_settings:
            mock_settings.upload_path = str(tmp_path)
            
            with patch('jidelnicek.tasks.export_tasks.RedisClient') as mock_redis_context:
                mock_redis_context.return_value.__aenter__.return_value = mock_redis_client
                
                # Act
                result = await _cleanup_old_exports_async()
                
                # Assert
                assert result["files"] == 1
                assert result["size"] == 11  # "old content" = 11 bytes
                assert not old_file.exists()
                assert recent_file.exists()
    
    def test_export_task_base_class(self):
        """Test ExportTask base class methods."""
        # Test on_failure
        task = ExportTask()
        task.update_job_status = Mock()
        
        exc = Exception("Test error")
        task_id = "test-task-id"
        
        task.on_failure(exc, task_id, [], {}, None)
        task.update_job_status.assert_called_once_with(
            task_id, "failed", error=str(exc)
        )
        
        # Test on_success
        task.update_job_status.reset_mock()
        retval = {"result": "success"}
        
        task.on_success(retval, task_id, [], {})
        task.update_job_status.assert_called_once_with(
            task_id, "completed", result=retval
        )
    
    @pytest.mark.asyncio
    async def test_export_task_update_job_status(self, mock_redis_client):
        """Test ExportTask job status update."""
        task = ExportTask()
        
        # Mock existing job data
        existing_job = {
            "status": "running",
            "created_at": datetime.utcnow().isoformat()
        }
        mock_redis_client.get = AsyncMock(return_value=json.dumps(existing_job))
        
        with patch('jidelnicek.tasks.export_tasks.RedisClient') as mock_redis_context:
            mock_redis_context.return_value.__aenter__.return_value = mock_redis_client
            
            # Act
            await task._update_job_status_async(
                "test-task-id",
                "completed",
                result={"file": "test.pdf"}
            )
            
            # Assert
            mock_redis_client.set.assert_called_once()
            call_args = mock_redis_client.set.call_args
            job_data = json.loads(call_args[0][1])
            assert job_data["status"] == "completed"
            assert job_data["result"] == {"file": "test.pdf"}
            assert "updated_at" in job_data