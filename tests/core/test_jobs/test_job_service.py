"""
Tests for job management service.

This module tests the JobService class and its methods for creating,
tracking, and managing background jobs.
"""

import pytest
from datetime import datetime, timedelta
from unittest.mock import Mock, patch, AsyncMock
import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from jidelnicek.core.services.job_service import JobService
from jidelnicek.core.models.job import Job, JobStatus, JobPriority, JobType
from jidelnicek.core.exceptions import NotFoundError, ValidationError


@pytest.fixture
def mock_db():
    """Create a mock database session."""
    db = AsyncMock(spec=AsyncSession)
    return db


@pytest.fixture
def job_service(mock_db):
    """Create a JobService instance with mock database."""
    return JobService(mock_db)


@pytest.fixture
def sample_job():
    """Create a sample job for testing."""
    return Job(
        id=1,
        task_id=str(uuid.uuid4()),
        job_type=JobType.EXPORT_SHOPPING_LIST,
        name="Test Export Job",
        description="Test job description",
        status=JobStatus.PENDING,
        priority=JobPriority.NORMAL,
        parameters={"trip_id": 123, "format": "pdf"},
        user_id=1,
        queue_name="default",
        created_at=datetime.utcnow(),
    )


class TestJobService:
    """Test JobService functionality."""
    
    @pytest.mark.asyncio
    async def test_create_job(self, job_service, mock_db):
        """Test creating a new job."""
        # Arrange
        job_params = {
            "trip_id": 123,
            "format": "pdf",
        }
        
        # Act
        job = await job_service.create_job(
            job_type=JobType.EXPORT_SHOPPING_LIST,
            name="Export Shopping List",
            parameters=job_params,
            user_id=1,
            priority=JobPriority.HIGH,
            description="Test export",
            notify_on_completion=True,
        )
        
        # Assert
        assert job.job_type == JobType.EXPORT_SHOPPING_LIST
        assert job.name == "Export Shopping List"
        assert job.parameters == job_params
        assert job.user_id == 1
        assert job.priority == JobPriority.HIGH
        assert job.status == JobStatus.PENDING
        assert job.queue_name == "high"  # High priority queue
        assert job.notify_on_completion is True
        
        mock_db.add.assert_called_once_with(job)
        mock_db.commit.assert_called_once()
        mock_db.refresh.assert_called_once_with(job)
    
    @pytest.mark.asyncio
    async def test_submit_job_success(self, job_service, sample_job):
        """Test successfully submitting a job to the queue."""
        # Arrange
        mock_task = Mock()
        mock_task.apply_async.return_value = Mock(id=sample_job.task_id)
        
        with patch.object(job_service, '_get_task_function', return_value=mock_task):
            # Act
            result = await job_service.submit_job(sample_job)
            
            # Assert
            assert result.status == JobStatus.RUNNING
            assert result.started_at is not None
            mock_task.apply_async.assert_called_once_with(
                kwargs=sample_job.parameters,
                task_id=sample_job.task_id,
                queue=sample_job.queue_name,
                priority=5,  # Normal priority
            )
    
    @pytest.mark.asyncio
    async def test_submit_job_unknown_type(self, job_service, sample_job):
        """Test submitting a job with unknown type."""
        # Arrange
        sample_job.job_type = JobType.OTHER
        
        with patch.object(job_service, '_get_task_function', return_value=None):
            # Act & Assert
            with pytest.raises(ValidationError) as exc_info:
                await job_service.submit_job(sample_job)
            
            assert "Unknown job type" in str(exc_info.value)
            assert sample_job.status == JobStatus.FAILED
    
    @pytest.mark.asyncio
    async def test_get_job_found(self, job_service, mock_db, sample_job):
        """Test getting a job by ID."""
        # Arrange
        mock_result = Mock()
        mock_result.scalar_one_or_none.return_value = sample_job
        mock_db.execute.return_value = mock_result
        
        # Act
        result = await job_service.get_job(1, user_id=1)
        
        # Assert
        assert result == sample_job
        mock_db.execute.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_get_job_not_found(self, job_service, mock_db):
        """Test getting a non-existent job."""
        # Arrange
        mock_result = Mock()
        mock_result.scalar_one_or_none.return_value = None
        mock_db.execute.return_value = mock_result
        
        # Act & Assert
        with pytest.raises(NotFoundError) as exc_info:
            await job_service.get_job(999)
        
        assert "Job 999 not found" in str(exc_info.value)
    
    @pytest.mark.asyncio
    async def test_update_job_progress(self, job_service, sample_job):
        """Test updating job progress."""
        # Arrange
        with patch.object(job_service, 'get_job', return_value=sample_job):
            # Act
            result = await job_service.update_job_progress(
                job_id=1,
                progress=50.0,
                progress_message="Processing...",
                eta=datetime.utcnow() + timedelta(minutes=5),
            )
            
            # Assert
            assert result.progress == 50.0
            assert result.progress_message == "Processing..."
            assert result.eta is not None
    
    @pytest.mark.asyncio
    async def test_complete_job(self, job_service, mock_db, sample_job):
        """Test marking a job as completed."""
        # Arrange
        sample_job.notify_on_completion = True
        result_data = {"file_path": "/exports/test.pdf", "file_size": 1024}
        
        with patch.object(job_service, 'get_job', return_value=sample_job):
            with patch.object(job_service, '_send_job_notification') as mock_notify:
                # Act
                result = await job_service.complete_job(1, result=result_data)
                
                # Assert
                assert result.status == JobStatus.COMPLETED
                assert result.progress == 100.0
                assert result.completed_at is not None
                assert result.result == result_data
                mock_notify.assert_called_once_with(sample_job, "completed")
                mock_db.commit.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_fail_job(self, job_service, mock_db, sample_job):
        """Test marking a job as failed."""
        # Arrange
        sample_job.notify_on_failure = True
        error_msg = "Export failed due to missing data"
        
        with patch.object(job_service, 'get_job', return_value=sample_job):
            with patch.object(job_service, '_send_job_notification') as mock_notify:
                # Act
                result = await job_service.fail_job(
                    1,
                    error_message=error_msg,
                    error_traceback="Traceback..."
                )
                
                # Assert
                assert result.status == JobStatus.FAILED
                assert result.completed_at is not None
                assert result.error_message == error_msg
                assert result.error_traceback == "Traceback..."
                mock_notify.assert_called_once_with(sample_job, "failed")
                mock_db.commit.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_cancel_job_success(self, job_service, sample_job):
        """Test cancelling a running job."""
        # Arrange
        sample_job.status = JobStatus.RUNNING
        
        with patch.object(job_service, 'get_job', return_value=sample_job):
            with patch('jidelnicek.core.celery_app.revoke_task') as mock_revoke:
                mock_revoke.return_value = True
                
                # Act
                result = await job_service.cancel_job(1, user_id=1)
                
                # Assert
                assert result.status == JobStatus.CANCELLED
                assert result.completed_at is not None
                mock_revoke.assert_called_once_with(sample_job.task_id, terminate=True)
    
    @pytest.mark.asyncio
    async def test_cancel_job_terminal_state(self, job_service, sample_job):
        """Test cancelling a job in terminal state."""
        # Arrange
        sample_job.status = JobStatus.COMPLETED
        
        with patch.object(job_service, 'get_job', return_value=sample_job):
            # Act & Assert
            with pytest.raises(ValidationError) as exc_info:
                await job_service.cancel_job(1)
            
            assert "Cannot cancel job in completed state" in str(exc_info.value)
    
    @pytest.mark.asyncio
    async def test_retry_job_success(self, job_service, sample_job):
        """Test retrying a failed job."""
        # Arrange
        sample_job.status = JobStatus.FAILED
        sample_job.retry_count = 1
        sample_job.max_retries = 3
        
        new_job = Job(
            id=2,
            task_id=str(uuid.uuid4()),
            job_type=sample_job.job_type,
            name=f"{sample_job.name} (Retry 2)",
            parameters=sample_job.parameters,
            user_id=sample_job.user_id,
            priority=sample_job.priority,
            retry_count=2,
            max_retries=3,
        )
        
        with patch.object(job_service, 'get_job', return_value=sample_job):
            with patch.object(job_service, 'create_job', return_value=new_job):
                with patch.object(job_service, 'submit_job', return_value=new_job):
                    # Act
                    result = await job_service.retry_job(1, user_id=1)
                    
                    # Assert
                    assert result.id == 2
                    assert result.retry_count == 2
                    assert "(Retry 2)" in result.name
    
    @pytest.mark.asyncio
    async def test_retry_job_max_retries_exceeded(self, job_service, sample_job):
        """Test retrying a job that has exceeded max retries."""
        # Arrange
        sample_job.status = JobStatus.FAILED
        sample_job.retry_count = 3
        sample_job.max_retries = 3
        
        with patch.object(job_service, 'get_job', return_value=sample_job):
            # Act & Assert
            with pytest.raises(ValidationError) as exc_info:
                await job_service.retry_job(1)
            
            assert "Job 1 cannot be retried" in str(exc_info.value)
    
    @pytest.mark.asyncio
    async def test_list_jobs_with_filters(self, job_service, mock_db):
        """Test listing jobs with various filters."""
        # Arrange
        jobs = [
            Job(id=1, status=JobStatus.RUNNING, job_type=JobType.EXPORT_SHOPPING_LIST),
            Job(id=2, status=JobStatus.COMPLETED, job_type=JobType.EXPORT_TRIP_DATA),
        ]
        
        mock_result = Mock()
        mock_result.scalars.return_value.all.return_value = jobs
        mock_db.execute.return_value = mock_result
        
        # Act
        result = await job_service.list_jobs(
            user_id=1,
            job_type=JobType.EXPORT_SHOPPING_LIST,
            status=JobStatus.RUNNING,
            priority=JobPriority.HIGH,
            created_after=datetime.utcnow() - timedelta(days=1),
            skip=0,
            limit=10,
            order_by="created_at",
            order_desc=True,
        )
        
        # Assert
        assert len(result) == 2
        mock_db.execute.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_get_job_statistics(self, job_service, mock_db):
        """Test getting job statistics."""
        # Arrange
        # Mock count queries
        mock_result = Mock()
        mock_result.scalar.return_value = 5
        mock_db.execute.return_value = mock_result
        
        # Act
        stats = await job_service.get_job_statistics(user_id=1)
        
        # Assert
        assert "total_jobs" in stats
        assert "by_status" in stats
        assert "by_type" in stats
        assert "average_duration_seconds" in stats
        assert "success_rate" in stats
    
    @pytest.mark.asyncio
    async def test_cleanup_old_jobs(self, job_service, mock_db):
        """Test cleaning up old completed jobs."""
        # Arrange
        old_jobs = [
            Job(
                id=1,
                status=JobStatus.COMPLETED,
                completed_at=datetime.utcnow() - timedelta(days=35)
            ),
            Job(
                id=2,
                status=JobStatus.FAILED,
                completed_at=datetime.utcnow() - timedelta(days=40)
            ),
        ]
        
        mock_result = Mock()
        mock_result.scalars.return_value.all.return_value = old_jobs
        mock_db.execute.return_value = mock_result
        
        # Act
        count = await job_service.cleanup_old_jobs(days=30)
        
        # Assert
        assert count == 2
        for job in old_jobs:
            assert job.is_deleted is True
            assert job.deleted_at is not None
        mock_db.commit.assert_called_once()
    
    def test_get_queue_for_priority(self, job_service):
        """Test queue assignment based on priority."""
        assert job_service._get_queue_for_priority(JobPriority.LOW) == "low"
        assert job_service._get_queue_for_priority(JobPriority.NORMAL) == "default"
        assert job_service._get_queue_for_priority(JobPriority.HIGH) == "high"
        assert job_service._get_queue_for_priority(JobPriority.CRITICAL) == "high"
    
    def test_get_celery_priority(self, job_service):
        """Test Celery priority mapping."""
        assert job_service._get_celery_priority(JobPriority.LOW) == 1
        assert job_service._get_celery_priority(JobPriority.NORMAL) == 5
        assert job_service._get_celery_priority(JobPriority.HIGH) == 8
        assert job_service._get_celery_priority(JobPriority.CRITICAL) == 10