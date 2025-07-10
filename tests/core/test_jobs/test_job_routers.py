"""
Tests for job API endpoints.

This module tests the API endpoints for job management and export operations.
"""

import pytest
from unittest.mock import Mock, patch, AsyncMock
from datetime import datetime, timedelta
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
def sample_job():
    """Create a sample job for testing."""
    return Job(
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
        user_id=1,
        queue_name="default",
        created_at=datetime.utcnow(),
        started_at=datetime.utcnow(),
        retry_count=0,
        max_retries=3,
    )


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
    async def test_create_job(self, client: AsyncClient, mock_job_service, mock_current_user, sample_job):
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
            with patch('jidelnicek.core.routers.jobs.get_current_user', return_value=mock_current_user):
                mock_job_service.create_job.return_value = sample_job
                mock_job_service.submit_job.return_value = sample_job
                
                # Act
                response = await client.post("/api/v1/jobs/", json=job_data)
                
                # Assert
                assert response.status_code == status.HTTP_201_CREATED
                data = response.json()
                assert data["name"] == sample_job.name
                assert data["status"] == "running"
                assert data["progress"] == 45.5
                mock_job_service.create_job.assert_called_once()
                mock_job_service.submit_job.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_get_job(self, client: AsyncClient, mock_job_service, mock_current_user, sample_job):
        """Test getting job details."""
        # Arrange
        with patch('jidelnicek.core.routers.jobs.JobService', return_value=mock_job_service):
            with patch('jidelnicek.core.routers.jobs.get_current_user', return_value=mock_current_user):
                mock_job_service.get_job.return_value = sample_job
                
                # Act
                response = await client.get("/api/v1/jobs/1")
                
                # Assert
                assert response.status_code == status.HTTP_200_OK
                data = response.json()
                assert data["id"] == 1
                assert data["status"] == "running"
                assert data["progress"] == 45.5
                mock_job_service.get_job.assert_called_once_with(1, 1)
    
    @pytest.mark.asyncio
    async def test_list_jobs(self, client: AsyncClient, mock_job_service, mock_current_user):
        """Test listing jobs with filters."""
        # Arrange
        jobs = [
            Job(id=1, job_type=JobType.EXPORT_SHOPPING_LIST, status=JobStatus.COMPLETED),
            Job(id=2, job_type=JobType.EXPORT_TRIP_DATA, status=JobStatus.RUNNING),
        ]
        
        with patch('jidelnicek.core.routers.jobs.JobService', return_value=mock_job_service):
            with patch('jidelnicek.core.routers.jobs.get_current_user', return_value=mock_current_user):
                mock_job_service.list_jobs.return_value = jobs
                mock_job_service.count.return_value = 2
                
                # Act
                response = await client.get(
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
    async def test_cancel_job(self, client: AsyncClient, mock_job_service, mock_current_user, sample_job):
        """Test cancelling a job."""
        # Arrange
        sample_job.status = JobStatus.CANCELLED
        
        with patch('jidelnicek.core.routers.jobs.JobService', return_value=mock_job_service):
            with patch('jidelnicek.core.routers.jobs.get_current_user', return_value=mock_current_user):
                with patch('jidelnicek.core.routers.jobs.cache_delete') as mock_cache_delete:
                    mock_job_service.cancel_job.return_value = sample_job
                    
                    # Act
                    response = await client.post("/api/v1/jobs/1/cancel")
                    
                    # Assert
                    assert response.status_code == status.HTTP_200_OK
                    data = response.json()
                    assert data["status"] == "cancelled"
                    mock_job_service.cancel_job.assert_called_once_with(1, 1)
                    mock_cache_delete.assert_called_once_with("job:1")
    
    @pytest.mark.asyncio
    async def test_retry_job(self, client: AsyncClient, mock_job_service, mock_current_user):
        """Test retrying a failed job."""
        # Arrange
        new_job = Job(
            id=2,
            task_id=str(uuid.uuid4()),
            job_type=JobType.EXPORT_SHOPPING_LIST,
            name="Test Export Job (Retry 1)",
            status=JobStatus.RUNNING,
            retry_count=1,
        )
        
        with patch('jidelnicek.core.routers.jobs.JobService', return_value=mock_job_service):
            with patch('jidelnicek.core.routers.jobs.get_current_user', return_value=mock_current_user):
                mock_job_service.retry_job.return_value = new_job
                
                # Act
                response = await client.post("/api/v1/jobs/1/retry")
                
                # Assert
                assert response.status_code == status.HTTP_201_CREATED
                data = response.json()
                assert data["id"] == 2
                assert "(Retry 1)" in data["name"]
                assert data["retry_count"] == 1
    
    @pytest.mark.asyncio
    async def test_delete_job(self, client: AsyncClient, mock_job_service, mock_current_user, sample_job):
        """Test deleting a completed job."""
        # Arrange
        sample_job.status = JobStatus.COMPLETED
        
        with patch('jidelnicek.core.routers.jobs.JobService', return_value=mock_job_service):
            with patch('jidelnicek.core.routers.jobs.get_current_user', return_value=mock_current_user):
                with patch('jidelnicek.core.routers.jobs.cache_delete') as mock_cache_delete:
                    mock_job_service.get_job.return_value = sample_job
                    mock_job_service.delete_job.return_value = None
                    
                    # Act
                    response = await client.delete("/api/v1/jobs/1")
                    
                    # Assert
                    assert response.status_code == status.HTTP_204_NO_CONTENT
                    mock_job_service.delete_job.assert_called_once_with(1, 1)
                    mock_cache_delete.assert_called_once_with("job:1")
    
    @pytest.mark.asyncio
    async def test_delete_job_not_terminal(self, client: AsyncClient, mock_job_service, mock_current_user, sample_job):
        """Test deleting a running job (should fail)."""
        # Arrange
        sample_job.status = JobStatus.RUNNING
        
        with patch('jidelnicek.core.routers.jobs.JobService', return_value=mock_job_service):
            with patch('jidelnicek.core.routers.jobs.get_current_user', return_value=mock_current_user):
                mock_job_service.get_job.return_value = sample_job
                
                # Act
                response = await client.delete("/api/v1/jobs/1")
                
                # Assert
                assert response.status_code == status.HTTP_400_BAD_REQUEST
                assert "Cannot delete job in running state" in response.json()["detail"]
    
    @pytest.mark.asyncio
    async def test_get_job_statistics(self, client: AsyncClient, mock_job_service, mock_current_user):
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
            with patch('jidelnicek.core.routers.jobs.get_current_user', return_value=mock_current_user):
                mock_job_service.get_job_statistics.return_value = stats
                
                # Act
                response = await client.get("/api/v1/jobs/statistics/summary")
                
                # Assert
                assert response.status_code == status.HTTP_200_OK
                data = response.json()
                assert data["total_jobs"] == 150
                assert data["success_rate"] == 80.0
    
    @pytest.mark.asyncio
    async def test_export_shopping_list(self, client: AsyncClient, mock_job_service, mock_current_user):
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
            job_type=JobType.EXPORT_SHOPPING_LIST,
            name="Export Shopping List (Trip 123)",
            status=JobStatus.RUNNING,
        )
        
        with patch('jidelnicek.core.routers.jobs.JobService', return_value=mock_job_service):
            with patch('jidelnicek.core.routers.jobs.get_current_user', return_value=mock_current_user):
                mock_job_service.create_job.return_value = created_job
                mock_job_service.submit_job.return_value = created_job
                
                # Act
                response = await client.post("/api/v1/jobs/export/shopping-list", json=export_data)
                
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
    async def test_export_trip_data(self, client: AsyncClient, mock_job_service, mock_current_user):
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
            job_type=JobType.EXPORT_TRIP_DATA,
            name="Export Trip Data (Trip 456)",
            status=JobStatus.RUNNING,
        )
        
        with patch('jidelnicek.core.routers.jobs.JobService', return_value=mock_job_service):
            with patch('jidelnicek.core.routers.jobs.get_current_user', return_value=mock_current_user):
                mock_job_service.create_job.return_value = created_job
                mock_job_service.submit_job.return_value = created_job
                
                # Act
                response = await client.post("/api/v1/jobs/export/trip", json=export_data)
                
                # Assert
                assert response.status_code == status.HTTP_201_CREATED
                data = response.json()
                assert data["job_type"] == "export_trip_data"
                assert "Trip 456" in data["name"]
    
    @pytest.mark.asyncio
    async def test_export_recipes(self, client: AsyncClient, mock_job_service, mock_current_user):
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
            job_type=JobType.EXPORT_RECIPES,
            name="Export Recipes (5)",
            status=JobStatus.RUNNING,
        )
        
        with patch('jidelnicek.core.routers.jobs.JobService', return_value=mock_job_service):
            with patch('jidelnicek.core.routers.jobs.get_current_user', return_value=mock_current_user):
                mock_job_service.create_job.return_value = created_job
                mock_job_service.submit_job.return_value = created_job
                
                # Act
                response = await client.post("/api/v1/jobs/export/recipes", json=export_data)
                
                # Assert
                assert response.status_code == status.HTTP_201_CREATED
                data = response.json()
                assert data["job_type"] == "export_recipes"
                assert "(5)" in data["name"]
    
    @pytest.mark.asyncio
    async def test_download_export(self, client: AsyncClient, mock_current_user, tmp_path):
        """Test downloading an exported file."""
        # Arrange
        export_id = str(uuid.uuid4())
        export_file = tmp_path / "test_export.pdf"
        export_file.write_text("PDF content")
        
        export_data = {
            "id": export_id,
            "file_path": str(export_file),
            "created_by": mock_current_user.id,
            "expires_at": (datetime.utcnow() + timedelta(days=7)).isoformat(),
        }
        
        with patch('jidelnicek.core.routers.jobs.get_current_user', return_value=mock_current_user):
            with patch('jidelnicek.core.routers.jobs.cache_get', return_value=export_data):
                # Act
                response = await client.get(f"/api/v1/exports/{export_id}/download")
                
                # Assert
                assert response.status_code == status.HTTP_200_OK
                assert response.headers["content-type"] == "application/octet-stream"
                assert response.content == b"PDF content"
    
    @pytest.mark.asyncio
    async def test_download_export_not_found(self, client: AsyncClient, mock_current_user):
        """Test downloading a non-existent export."""
        # Arrange
        export_id = str(uuid.uuid4())
        
        with patch('jidelnicek.core.routers.jobs.get_current_user', return_value=mock_current_user):
            with patch('jidelnicek.core.routers.jobs.cache_get', return_value=None):
                # Act
                response = await client.get(f"/api/v1/exports/{export_id}/download")
                
                # Assert
                assert response.status_code == status.HTTP_404_NOT_FOUND
                assert "Export not found" in response.json()["detail"]
    
    @pytest.mark.asyncio
    async def test_download_export_access_denied(self, client: AsyncClient, mock_current_user):
        """Test downloading an export created by another user."""
        # Arrange
        export_id = str(uuid.uuid4())
        export_data = {
            "id": export_id,
            "file_path": "/exports/test.pdf",
            "created_by": 999,  # Different user
        }
        
        with patch('jidelnicek.core.routers.jobs.get_current_user', return_value=mock_current_user):
            with patch('jidelnicek.core.routers.jobs.cache_get', return_value=export_data):
                # Act
                response = await client.get(f"/api/v1/exports/{export_id}/download")
                
                # Assert
                assert response.status_code == status.HTTP_403_FORBIDDEN
                assert "Access denied" in response.json()["detail"]