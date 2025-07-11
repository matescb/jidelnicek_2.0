"""
Tests for job API endpoints.

This module tests the API endpoints for job management and export operations.
"""

import pytest
from unittest.mock import Mock, patch, AsyncMock
from datetime import datetime, timedelta, timezone
import uuid

from fastapi import status
from fastapi.testclient import TestClient
from httpx import AsyncClient

from jidelnicek.core.models.job import Job, JobStatus, JobPriority, JobType
from jidelnicek.core.schemas.job import (
    JobCreate, JobResponse, ShoppingListExportCreate,
    TripExportCreate, RecipeExportCreate
)


@pytest.fixture
def sample_job(existing_user):
    """Create a sample job for testing."""
    job = Job(
        id=1,
        task_id=str(uuid.uuid4()),
        job_type=JobType.EXPORT_SHOPPING_LIST,
        name="Test Export Job",
        description="Test job description",
        status=JobStatus.RUNNING,
        priority=JobPriority.NORMAL,
        progress=45.5,
        progress_message="Processing...",
        parameters={"trip_id": 123, "format": "pdf"},
        user_id=existing_user.id,
        queue_name="default",
        created_at=datetime.now(timezone.utc),
        started_at=datetime.now(timezone.utc),
        completed_at=None,
        eta=None,
        result=None,
        error_message=None,
        retry_count=0,
        max_retries=3,
        worker_name=None,
    )
    # Set the user relationship for model validation
    job.user = existing_user
    return job


@pytest.fixture
def mock_job_service():
    """Create a mock job service."""
    service = AsyncMock()
    return service


@pytest.fixture
def mock_current_user():
    """Create a mock current user."""
    user = Mock()
    user.id = 1
    user.email = "test@example.com"
    user.is_active = True
    return user


class TestJobEndpoints:
    """Test job management endpoints."""
    
    @pytest.mark.asyncio
    async def test_create_job(self, authenticated_client: AsyncClient, mock_job_service, existing_user, sample_job):
        """Test creating a new job."""
        # Arrange
        job_data = {
            "job_type": "export_shopping_list",
            "name": "Export Shopping List",
            "description": "Export for trip 123",
            "parameters": {"trip_id": 123, "format": "pdf"},
            "priority": "normal",
            "notify_on_completion": True,
            "notify_on_failure": True,
        }
        
        with patch('jidelnicek.core.routers.jobs.JobService', return_value=mock_job_service):
            mock_job_service.create_job.return_value = sample_job
            mock_job_service.submit_job.return_value = sample_job
            
            # Act
            response = await authenticated_client.post("/api/v1/jobs/", json=job_data)
            
            # Assert
            assert response.status_code == status.HTTP_201_CREATED
            data = response.json()
            assert data["name"] == sample_job.name
            assert data["status"] == "running"
            assert data["progress"] == 45.5
            mock_job_service.create_job.assert_called_once()
            mock_job_service.submit_job.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_get_job(self, authenticated_client: AsyncClient, mock_job_service, existing_user, sample_job):
        """Test getting job details."""
        # Arrange
        with patch('jidelnicek.core.routers.jobs.JobService', return_value=mock_job_service):
            mock_job_service.get_job.return_value = sample_job
            
            # Act
            response = await authenticated_client.get("/api/v1/jobs/1")
            
            # Assert
            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert data["id"] == 1
            assert data["status"] == "running"
            assert data["progress"] == 45.5
            mock_job_service.get_job.assert_called_once_with(1, existing_user.id)
    
    @pytest.mark.asyncio
    async def test_list_jobs(self, authenticated_client: AsyncClient, mock_job_service, existing_user):
        """Test listing jobs with filters."""
        # Arrange
        job1 = Job(
            id=1,
            task_id=str(uuid.uuid4()),
            job_type=JobType.EXPORT_SHOPPING_LIST,
            name="Export Shopping List",
            description="Test export",
            status=JobStatus.COMPLETED,
            priority=JobPriority.NORMAL,
            progress=100.0,
            progress_message="Completed",
            parameters={},
            user_id=existing_user.id,
            queue_name="default",
            created_at=datetime.now(timezone.utc),
            started_at=datetime.now(timezone.utc) - timedelta(minutes=5),
            completed_at=datetime.now(timezone.utc),
            eta=None,
            result={"file_path": "/exports/test.pdf"},
            error_message=None,
            retry_count=0,
            max_retries=3,
            worker_name="worker-01",
        )
        job1.user = existing_user
        
        job2 = Job(
            id=2,
            task_id=str(uuid.uuid4()),
            job_type=JobType.EXPORT_TRIP_DATA,
            name="Export Trip Data",
            description="Test export",
            status=JobStatus.RUNNING,
            priority=JobPriority.NORMAL,
            progress=50.0,
            progress_message="Processing...",
            parameters={},
            user_id=existing_user.id,
            queue_name="default",
            created_at=datetime.now(timezone.utc),
            started_at=datetime.now(timezone.utc),
            completed_at=None,
            eta=datetime.now(timezone.utc) + timedelta(minutes=2),
                    result=None,
            error_message=None,
            retry_count=0,
            max_retries=3,
            worker_name="worker-02",
        )
        job2.user = existing_user
        
        jobs = [job1, job2]
        
        with patch('jidelnicek.core.routers.jobs.JobService', return_value=mock_job_service):
            mock_job_service.list_jobs.return_value = jobs
            mock_job_service.count.return_value = 2
            
            # Act
            response = await authenticated_client.get(
                "/api/v1/jobs/",
                params={
                    "status": "running",
                    "job_type": "export_shopping_list",
                    "skip": 0,
                    "limit": 10,
                }
            )
            
            # Assert
            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert data["total"] == 2
            assert len(data["jobs"]) == 2
            assert data["skip"] == 0
            assert data["limit"] == 10
    
    @pytest.mark.asyncio
    async def test_cancel_job(self, authenticated_client: AsyncClient, mock_job_service, existing_user, sample_job):
        """Test cancelling a job."""
        # Arrange
        sample_job.status = JobStatus.CANCELLED
        
        with patch('jidelnicek.core.routers.jobs.JobService', return_value=mock_job_service):
            with patch('jidelnicek.core.routers.jobs.cache_delete', new_callable=AsyncMock) as mock_cache_delete:
                mock_job_service.cancel_job.return_value = sample_job
                
                # Act
                response = await authenticated_client.post("/api/v1/jobs/1/cancel")
                
                # Assert
                assert response.status_code == status.HTTP_200_OK
                data = response.json()
                assert data["status"] == "cancelled"
                mock_job_service.cancel_job.assert_called_once_with(1, existing_user.id)
                mock_cache_delete.assert_called_once_with("job:1")
    
    @pytest.mark.asyncio
    async def test_retry_job(self, authenticated_client: AsyncClient, mock_job_service, existing_user):
        """Test retrying a failed job."""
        # Arrange
        new_job = Job(
            id=2,
            task_id=str(uuid.uuid4()),
            job_type=JobType.EXPORT_SHOPPING_LIST,
            name="Test Export Job (Retry 1)",
            description="Test job description",
            status=JobStatus.RUNNING,
            priority=JobPriority.NORMAL,
            progress=0.0,
            progress_message="Starting...",
            parameters={"trip_id": 123, "format": "pdf"},
            user_id=existing_user.id,
            queue_name="default",
            created_at=datetime.now(timezone.utc),
            started_at=None,
            completed_at=None,
            eta=None,
                result=None,
            error_message=None,
            retry_count=1,
            max_retries=3,
            worker_name=None,
        )
        new_job.user = existing_user
        
        with patch('jidelnicek.core.routers.jobs.JobService', return_value=mock_job_service):
            mock_job_service.retry_job.return_value = new_job
            
            # Act
            response = await authenticated_client.post("/api/v1/jobs/1/retry")
                
            # Assert
            assert response.status_code == status.HTTP_201_CREATED
            data = response.json()
            assert data["id"] == 2
            assert "(Retry 1)" in data["name"]
            assert data["retry_count"] == 1
    
    @pytest.mark.asyncio
    async def test_delete_job(self, authenticated_client: AsyncClient, mock_job_service, existing_user, sample_job):
        """Test deleting a completed job."""
        # Arrange
        sample_job.status = JobStatus.COMPLETED
        
        with patch('jidelnicek.core.routers.jobs.JobService', return_value=mock_job_service):
            with patch('jidelnicek.core.routers.jobs.cache_delete', new_callable=AsyncMock) as mock_cache_delete:
                mock_job_service.get_job.return_value = sample_job
                mock_job_service.delete_job.return_value = None
                
                # Act
                response = await authenticated_client.delete("/api/v1/jobs/1")
                
                # Assert
                assert response.status_code == status.HTTP_204_NO_CONTENT
                mock_job_service.delete_job.assert_called_once_with(1, existing_user.id)
                mock_cache_delete.assert_called_once_with("job:1")
    
    @pytest.mark.asyncio
    async def test_delete_job_not_terminal(self, authenticated_client: AsyncClient, mock_job_service, existing_user, sample_job):
        """Test deleting a running job (should fail)."""
        # Arrange
        sample_job.status = JobStatus.RUNNING
        
        with patch('jidelnicek.core.routers.jobs.JobService', return_value=mock_job_service):
            mock_job_service.get_job.return_value = sample_job
            
            # Act
            response = await authenticated_client.delete("/api/v1/jobs/1")
                
            # Assert
            assert response.status_code == status.HTTP_400_BAD_REQUEST
            detail = response.json()["detail"]
            assert "Cannot delete job in" in detail and "RUNNING" in detail
    
    @pytest.mark.asyncio
    async def test_get_job_statistics(self, authenticated_client: AsyncClient, mock_job_service, existing_user):
        """Test getting job statistics."""
        # Arrange
        stats = {
            "total_jobs": 150,
            "by_status": {
                "pending": 5,
                "running": 3,
                "completed": 120,
                "failed": 15,
                "cancelled": 7,
            },
            "by_type": {
                "export_shopping_list": 80,
                "export_trip_data": 40,
                "export_recipes": 30,
            },
            "average_duration_seconds": 45.7,
            "success_rate": 80.0,
        }
        
        with patch('jidelnicek.core.routers.jobs.JobService', return_value=mock_job_service):
            mock_job_service.get_job_statistics.return_value = stats
            
            # Act
            response = await authenticated_client.get("/api/v1/jobs/statistics/summary")
                
            # Assert
            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert data["total_jobs"] == 150
            assert data["success_rate"] == 80.0
    
    @pytest.mark.asyncio
    async def test_export_shopping_list(self, authenticated_client: AsyncClient, mock_job_service, existing_user):
        """Test creating a shopping list export job."""
        # Arrange
        export_data = {
            "trip_id": 123,
            "format": "pdf",
            "group_by_category": True,
            "include_prices": False,
            "include_quantities": True,
            "priority": "high",
            "notify_on_completion": True,
        }
        
        created_job = Job(
            id=1,
            task_id=str(uuid.uuid4()),
            job_type=JobType.EXPORT_SHOPPING_LIST,
            name="Export Shopping List (Trip 123)",
            description="Export for trip 123",
            status=JobStatus.RUNNING,
            priority=JobPriority.HIGH,
            progress=0.0,
            progress_message="Starting export...",
            parameters={"trip_id": 123, "format": "pdf"},
            user_id=existing_user.id,
            queue_name="default",
            created_at=datetime.now(timezone.utc),
            started_at=None,
            completed_at=None,
            eta=None,
                result=None,
            error_message=None,
            retry_count=0,
            max_retries=3,
            worker_name=None,
        )
        created_job.user = existing_user
        
        with patch('jidelnicek.core.routers.jobs.JobService', return_value=mock_job_service):
            mock_job_service.create_job.return_value = created_job
            mock_job_service.submit_job.return_value = created_job
            
            # Act
            response = await authenticated_client.post("/api/v1/jobs/export/shopping-list", json=export_data)
                
            # Assert
            assert response.status_code == status.HTTP_201_CREATED
            data = response.json()
            assert data["job_type"] == "export_shopping_list"
            assert "Trip 123" in data["name"]
            
            # Verify job service was called with correct parameters
            create_call = mock_job_service.create_job.call_args
            assert create_call.kwargs["job_type"] == JobType.EXPORT_SHOPPING_LIST
            assert create_call.kwargs["parameters"]["trip_id"] == 123
            assert create_call.kwargs["parameters"]["format"] == "pdf"
            assert create_call.kwargs["priority"] == JobPriority.HIGH
    
    @pytest.mark.asyncio
    async def test_export_trip_data(self, authenticated_client: AsyncClient, mock_job_service, existing_user):
        """Test creating a trip data export job."""
        # Arrange
        export_data = {
            "trip_id": 456,
            "format": "excel",
            "include_shopping_list": True,
            "include_meal_plans": True,
            "include_participants": True,
            "include_qr_codes": False,
            "priority": "normal",
        }
        
        created_job = Job(
            id=2,
            task_id=str(uuid.uuid4()),
            job_type=JobType.EXPORT_TRIP_DATA,
            name="Export Trip Data (Trip 456)",
            description="Export for trip 456",
            status=JobStatus.RUNNING,
            priority=JobPriority.NORMAL,
            progress=0.0,
            progress_message="Starting export...",
            parameters={"trip_id": 456, "format": "excel"},
            user_id=existing_user.id,
            queue_name="default",
            created_at=datetime.now(timezone.utc),
            started_at=None,
            completed_at=None,
            eta=None,
                result=None,
            error_message=None,
            retry_count=0,
            max_retries=3,
            worker_name=None,
        )
        created_job.user = existing_user
        
        with patch('jidelnicek.core.routers.jobs.JobService', return_value=mock_job_service):
            mock_job_service.create_job.return_value = created_job
            mock_job_service.submit_job.return_value = created_job
            
            # Act
            response = await authenticated_client.post("/api/v1/jobs/export/trip", json=export_data)
                
            # Assert
            assert response.status_code == status.HTTP_201_CREATED
            data = response.json()
            assert data["job_type"] == "export_trip_data"
            assert "Trip 456" in data["name"]
    
    @pytest.mark.asyncio
    async def test_export_recipes(self, authenticated_client: AsyncClient, mock_job_service, existing_user):
        """Test creating a recipe export job."""
        # Arrange
        export_data = {
            "recipe_ids": [1, 2, 3, 4, 5],
            "format": "pdf",
            "include_images": True,
            "include_nutrition": True,
            "include_instructions": True,
            "priority": "low",
        }
        
        created_job = Job(
            id=3,
            task_id=str(uuid.uuid4()),
            job_type=JobType.EXPORT_RECIPES,
            name="Export Recipes (5)",
            description="Export 5 recipes",
            status=JobStatus.RUNNING,
            priority=JobPriority.LOW,
            progress=0.0,
            progress_message="Starting export...",
            parameters={"recipe_ids": [1, 2, 3, 4, 5], "format": "pdf"},
            user_id=existing_user.id,
            queue_name="default",
            created_at=datetime.now(timezone.utc),
            started_at=None,
            completed_at=None,
            eta=None,
                result=None,
            error_message=None,
            retry_count=0,
            max_retries=3,
            worker_name=None,
        )
        created_job.user = existing_user
        
        with patch('jidelnicek.core.routers.jobs.JobService', return_value=mock_job_service):
            mock_job_service.create_job.return_value = created_job
            mock_job_service.submit_job.return_value = created_job
            
            # Act
            response = await authenticated_client.post("/api/v1/jobs/export/recipes", json=export_data)
                
            # Assert
            assert response.status_code == status.HTTP_201_CREATED
            data = response.json()
            assert data["job_type"] == "export_recipes"
            assert "(5)" in data["name"]
    
    @pytest.mark.asyncio
    async def test_download_export(self, authenticated_client: AsyncClient, existing_user, tmp_path):
        """Test downloading an exported file."""
        # Arrange
        export_id = str(uuid.uuid4())
        export_file = tmp_path / "test_export.pdf"
        export_file.write_text("PDF content")
        
        export_data = {
            "id": export_id,
            "file_path": str(export_file),
            "created_by": existing_user.id,
            "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
        }
        
        with patch('jidelnicek.core.cache.cache_get', return_value=export_data):
            # Act
            response = await authenticated_client.get(f"/api/v1/exports/{export_id}/download")
                
            # Assert
            assert response.status_code == status.HTTP_200_OK
            assert response.headers["content-type"] == "application/octet-stream"
            assert response.content == b"PDF content"
    
    @pytest.mark.asyncio
    async def test_download_export_not_found(self, authenticated_client: AsyncClient):
        """Test downloading a non-existent export."""
        # Arrange
        export_id = str(uuid.uuid4())
        
        with patch('jidelnicek.core.cache.cache_get', return_value=None):
            # Act
            response = await authenticated_client.get(f"/api/v1/exports/{export_id}/download")
                
            # Assert
            assert response.status_code == status.HTTP_404_NOT_FOUND
            assert "Export not found" in response.json()["detail"]
    
    @pytest.mark.asyncio
    async def test_download_export_access_denied(self, authenticated_client: AsyncClient):
        """Test downloading an export created by another user."""
        # Arrange
        export_id = str(uuid.uuid4())
        export_data = {
            "id": export_id,
            "file_path": "/exports/test.pdf",
            "created_by": str(uuid.uuid4()),  # Different user UUID
        }
        
        with patch('jidelnicek.core.cache.cache_get', return_value=export_data):
            # Act
            response = await authenticated_client.get(f"/api/v1/exports/{export_id}/download")
                
            # Assert
            assert response.status_code == status.HTTP_403_FORBIDDEN
            assert "Access denied" in response.json()["detail"]