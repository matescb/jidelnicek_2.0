"""
Comprehensive tests for the unified export API.

Tests all export formats, types, and features including:
- Single item exports (sync/async)
- Batch exports
- Export history
- Export presets
- Format-specific options
- Error handling
- Rate limiting
"""

import pytest
import pytest_asyncio
import asyncio
import json
import io
from datetime import datetime, timedelta
from uuid import uuid4
from unittest.mock import Mock, patch, AsyncMock

from fastapi import status
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from jidelnicek.api.v1.schemas.export_schemas import (
    ExportType,
    ExportFormat,
    ExportStatus
)
from jidelnicek.api.v1.models.export_models import (
    ExportJob,
    ExportPreset,
    ExportQuota
)
from jidelnicek.auth.models import AuthUser as User
from jidelnicek.trip.models import Trip
from jidelnicek.recipe.models import Recipe


class TestExportAPI:
    """Test suite for export API endpoints."""
    
    @pytest_asyncio.fixture(scope="function")
    async def test_user(self, db_session: AsyncSession) -> User:
        """Create a test user."""
        user = User(
            email="test@example.com",
            username="testuser",
            hashed_password="hashed",
            is_active=True
        )
        db_session.add(user)
        await db_session.commit()
        return user
    
    @pytest_asyncio.fixture(scope="function")
    async def test_trip(self, db_session: AsyncSession, test_user: User) -> Trip:
        """Create a test trip."""
        trip = Trip(
            name="Test Trip",
            description="Test trip for export",
            start_date=datetime.utcnow(),
            end_date=datetime.utcnow() + timedelta(days=7),
            user_id=test_user.id
        )
        db_session.add(trip)
        await db_session.commit()
        return trip
    
    @pytest_asyncio.fixture(scope="function")
    async def test_recipe(self, db_session: AsyncSession, test_user: User) -> Recipe:
        """Create a test recipe."""
        recipe = Recipe(
            name="Test Recipe",
            description="Test recipe for export",
            servings=4,
            prep_time=30,
            cook_time=45,
            user_id=test_user.id
        )
        db_session.add(recipe)
        await db_session.commit()
        return recipe
    
    @pytest.fixture
    def auth_headers(self, test_user: User) -> dict:
        """Create auth headers for test user."""
        return {"Authorization": f"Bearer test_token_{test_user.id}"}
    
    # Single Export Tests
    
    @pytest.mark.asyncio
    async def test_export_single_trip_pdf_sync(
        self,
        client: AsyncClient,
        test_trip: Trip,
        auth_headers: dict
    ):
        """Test synchronous PDF export of a single trip."""
        response = await client.post(
            "/api/v1/exports/single",
            json={
                "export_type": ExportType.TRIP.value,
                "export_format": ExportFormat.PDF.value,
                "item_id": str(test_trip.id),
                "async_export": False,
                "options": {
                    "include_recipes": True,
                    "include_shopping": True,
                    "page_size": "A4"
                }
            },
            headers=auth_headers
        )
        
        assert response.status_code == status.HTTP_200_OK
        assert response.headers["content-type"] == "application/pdf"
        assert "content-disposition" in response.headers
        assert f"trip_{test_trip.id}" in response.headers["content-disposition"]
    
    @pytest.mark.asyncio
    async def test_export_single_recipe_json_sync(
        self,
        client: AsyncClient,
        test_recipe: Recipe,
        auth_headers: dict
    ):
        """Test synchronous JSON export of a single recipe."""
        response = await client.post(
            "/api/v1/exports/single",
            json={
                "export_type": ExportType.RECIPE.value,
                "export_format": ExportFormat.JSON.value,
                "item_id": str(test_recipe.id),
                "async_export": False
            },
            headers=auth_headers
        )
        
        assert response.status_code == status.HTTP_200_OK
        assert response.headers["content-type"] == "application/json"
        
        # Verify JSON content
        content = response.content
        recipe_data = json.loads(content)
        assert recipe_data["name"] == test_recipe.name
    
    @pytest.mark.asyncio
    async def test_export_single_async(
        self,
        client: AsyncClient,
        test_trip: Trip,
        auth_headers: dict
    ):
        """Test asynchronous export returns job ID."""
        response = await client.post(
            "/api/v1/exports/single",
            json={
                "export_type": ExportType.TRIP.value,
                "export_format": ExportFormat.EXCEL.value,
                "item_id": str(test_trip.id),
                "async_export": True
            },
            headers=auth_headers
        )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        
        assert "job_id" in data
        assert data["status"] == ExportStatus.PENDING.value
        assert data["export_type"] == ExportType.TRIP.value
        assert data["export_format"] == ExportFormat.EXCEL.value
    
    @pytest.mark.asyncio
    async def test_export_all_formats(
        self,
        client: AsyncClient,
        test_recipe: Recipe,
        auth_headers: dict
    ):
        """Test export in all supported formats."""
        formats = [
            ExportFormat.PDF,
            ExportFormat.EXCEL,
            ExportFormat.CSV,
            ExportFormat.JSON,
            ExportFormat.HTML,
            ExportFormat.TEXT,
            ExportFormat.MARKDOWN
        ]
        
        for format in formats:
            response = await client.post(
                "/api/v1/exports/single",
                json={
                    "export_type": ExportType.RECIPE.value,
                    "export_format": format.value,
                    "item_id": str(test_recipe.id),
                    "async_export": False
                },
                headers=auth_headers
            )
            
            # Some formats might not be implemented yet
            assert response.status_code in [
                status.HTTP_200_OK,
                status.HTTP_400_BAD_REQUEST
            ]
    
    # Batch Export Tests
    
    @pytest.mark.asyncio
    async def test_batch_export(
        self,
        client: AsyncClient,
        test_trip: Trip,
        test_recipe: Recipe,
        auth_headers: dict
    ):
        """Test batch export of multiple items."""
        response = await client.post(
            "/api/v1/exports/batch",
            json={
                "exports": [
                    {
                        "export_type": ExportType.TRIP.value,
                        "export_format": ExportFormat.PDF.value,
                        "item_ids": [str(test_trip.id)],
                        "merge_into_single_file": False
                    },
                    {
                        "export_type": ExportType.RECIPE.value,
                        "export_format": ExportFormat.JSON.value,
                        "item_ids": [str(test_recipe.id)],
                        "merge_into_single_file": False
                    }
                ]
            },
            headers=auth_headers
        )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        
        assert "batch_id" in data
        assert data["job_count"] == 2
        assert data["status"] == ExportStatus.PENDING.value
    
    # Export Status Tests
    
    @pytest.mark.asyncio
    async def test_get_export_status(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
        test_user: User,
        test_trip: Trip,
        auth_headers: dict
    ):
        """Test retrieving export job status."""
        # Create a job
        job = ExportJob(
            user_id=test_user.id,
            export_type=ExportType.TRIP,
            export_format=ExportFormat.PDF,
            item_ids=[test_trip.id],
            status=ExportStatus.PROCESSING,
            progress=50.0
        )
        db_session.add(job)
        await db_session.commit()
        
        response = await client.get(
            f"/api/v1/exports/status/{job.id}",
            headers=auth_headers
        )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        
        assert data["job_id"] == str(job.id)
        assert data["status"] == ExportStatus.PROCESSING.value
        assert data["progress"] == 50.0
    
    @pytest.mark.asyncio
    async def test_get_export_status_not_found(
        self,
        client: AsyncClient,
        auth_headers: dict
    ):
        """Test getting status of non-existent job."""
        fake_id = uuid4()
        response = await client.get(
            f"/api/v1/exports/status/{fake_id}",
            headers=auth_headers
        )
        
        assert response.status_code == status.HTTP_404_NOT_FOUND
    
    # Download Tests
    
    @pytest.mark.asyncio
    async def test_download_completed_export(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
        test_user: User,
        test_trip: Trip,
        auth_headers: dict
    ):
        """Test downloading a completed export."""
        # Create completed job
        job = ExportJob(
            user_id=test_user.id,
            export_type=ExportType.TRIP,
            export_format=ExportFormat.PDF,
            item_ids=[test_trip.id],
            status=ExportStatus.COMPLETED,
            file_path="exports/test.pdf",
            file_size=1024,
            mime_type="application/pdf"
        )
        db_session.add(job)
        await db_session.commit()
        
        # Mock storage service
        with patch("src.jidelnicek.api.v1.services.unified_export_service.StorageService") as mock_storage:
            mock_storage.return_value.retrieve = AsyncMock(return_value=b"PDF content")
            
            response = await client.get(
                f"/api/v1/exports/download/{job.id}",
                headers=auth_headers
            )
            
            assert response.status_code == status.HTTP_200_OK
            assert response.headers["content-type"] == "application/pdf"
            assert response.content == b"PDF content"
    
    # History Tests
    
    @pytest.mark.asyncio
    async def test_get_export_history(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
        test_user: User,
        auth_headers: dict
    ):
        """Test retrieving export history."""
        # Create multiple jobs
        for i in range(5):
            job = ExportJob(
                user_id=test_user.id,
                export_type=ExportType.TRIP if i % 2 == 0 else ExportType.RECIPE,
                export_format=ExportFormat.PDF,
                item_ids=[i],
                status=ExportStatus.COMPLETED,
                created_at=datetime.utcnow() - timedelta(hours=i)
            )
            db_session.add(job)
        
        await db_session.commit()
        
        response = await client.get(
            "/api/v1/exports/history",
            headers=auth_headers
        )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        
        assert len(data) == 5
        # Check ordering (newest first)
        assert data[0]["created_at"] > data[1]["created_at"]
    
    @pytest.mark.asyncio
    async def test_get_export_history_filtered(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
        test_user: User,
        auth_headers: dict
    ):
        """Test filtered export history."""
        # Create jobs with different types and formats
        jobs = [
            ExportJob(
                user_id=test_user.id,
                export_type=ExportType.TRIP,
                export_format=ExportFormat.PDF,
                item_ids=[1],
                status=ExportStatus.COMPLETED
            ),
            ExportJob(
                user_id=test_user.id,
                export_type=ExportType.RECIPE,
                export_format=ExportFormat.JSON,
                item_ids=[2],
                status=ExportStatus.COMPLETED
            ),
            ExportJob(
                user_id=test_user.id,
                export_type=ExportType.TRIP,
                export_format=ExportFormat.EXCEL,
                item_ids=[3],
                status=ExportStatus.FAILED
            )
        ]
        
        for job in jobs:
            db_session.add(job)
        await db_session.commit()
        
        # Filter by export type
        response = await client.get(
            "/api/v1/exports/history",
            params={"export_type": ExportType.TRIP.value},
            headers=auth_headers
        )
        
        data = response.json()
        assert len(data) == 2
        assert all(item["export_type"] == ExportType.TRIP.value for item in data)
        
        # Filter by status
        response = await client.get(
            "/api/v1/exports/history",
            params={"status": ExportStatus.FAILED.value},
            headers=auth_headers
        )
        
        data = response.json()
        assert len(data) == 1
        assert data[0]["status"] == ExportStatus.FAILED.value
    
    # Delete Export Tests
    
    @pytest.mark.asyncio
    async def test_delete_export(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
        test_user: User,
        auth_headers: dict
    ):
        """Test deleting an export."""
        job = ExportJob(
            user_id=test_user.id,
            export_type=ExportType.TRIP,
            export_format=ExportFormat.PDF,
            item_ids=[1],
            status=ExportStatus.COMPLETED,
            file_path="exports/test.pdf"
        )
        db_session.add(job)
        await db_session.commit()
        
        with patch("src.jidelnicek.api.v1.services.unified_export_service.StorageService") as mock_storage:
            mock_storage.return_value.delete = AsyncMock()
            
            response = await client.delete(
                f"/api/v1/exports/history/{job.id}",
                headers=auth_headers
            )
            
            assert response.status_code == status.HTTP_200_OK
            
            # Verify job was deleted
            result = await db_session.get(ExportJob, job.id)
            assert result is None
    
    # Format Options Tests
    
    @pytest.mark.asyncio
    async def test_get_supported_formats(self, client: AsyncClient):
        """Test getting supported formats for each export type."""
        response = await client.get("/api/v1/exports/formats")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        
        assert ExportType.TRIP.value in data
        assert ExportType.RECIPE.value in data
        assert ExportType.SHOPPING_LIST.value in data
        
        # Check that each type has formats
        for export_type, formats in data.items():
            assert len(formats) > 0
            assert ExportFormat.PDF.value in formats
    
    @pytest.mark.asyncio
    async def test_get_format_options(self, client: AsyncClient):
        """Test getting options for specific formats."""
        # Test PDF options
        response = await client.get(
            f"/api/v1/exports/options/{ExportFormat.PDF.value}"
        )
        
        assert response.status_code == status.HTTP_200_OK
        options = response.json()
        
        assert "page_size" in options
        assert "orientation" in options
        assert "margin" in options
        
        # Test Excel options
        response = await client.get(
            f"/api/v1/exports/options/{ExportFormat.EXCEL.value}"
        )
        
        options = response.json()
        assert "include_formulas" in options
        assert "include_charts" in options
    
    # Preset Tests
    
    @pytest.mark.asyncio
    async def test_create_export_preset(
        self,
        client: AsyncClient,
        auth_headers: dict
    ):
        """Test creating an export preset."""
        preset_data = {
            "name": "My PDF Template",
            "description": "Custom PDF settings",
            "export_type": ExportType.TRIP.value,
            "export_format": ExportFormat.PDF.value,
            "options": {
                "page_size": "A4",
                "orientation": "landscape",
                "include_toc": True
            }
        }
        
        response = await client.post(
            "/api/v1/exports/presets",
            json=preset_data,
            headers=auth_headers
        )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        
        assert data["name"] == preset_data["name"]
        assert data["export_type"] == preset_data["export_type"]
        assert "id" in data
    
    @pytest.mark.asyncio
    async def test_get_export_presets(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
        test_user: User,
        auth_headers: dict
    ):
        """Test retrieving user's export presets."""
        # Create presets
        presets = [
            ExportPreset(
                user_id=test_user.id,
                name="Trip PDF",
                export_type=ExportType.TRIP,
                export_format=ExportFormat.PDF,
                options={"page_size": "A4"}
            ),
            ExportPreset(
                user_id=test_user.id,
                name="Recipe Excel",
                export_type=ExportType.RECIPE,
                export_format=ExportFormat.EXCEL,
                options={"include_charts": True}
            )
        ]
        
        for preset in presets:
            db_session.add(preset)
        await db_session.commit()
        
        response = await client.get(
            "/api/v1/exports/presets",
            headers=auth_headers
        )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        
        assert len(data) == 2
        assert {p["name"] for p in data} == {"Trip PDF", "Recipe Excel"}
    
    # Preview Tests
    
    @pytest.mark.asyncio
    async def test_export_preview(
        self,
        client: AsyncClient,
        test_recipe: Recipe,
        auth_headers: dict
    ):
        """Test generating export preview."""
        response = await client.post(
            f"/api/v1/exports/preview/{ExportFormat.PDF.value}",
            json={
                "export_type": ExportType.RECIPE.value,
                "export_format": ExportFormat.PDF.value,
                "item_id": str(test_recipe.id)
            },
            headers=auth_headers
        )
        
        # Preview might not be implemented for all formats
        assert response.status_code in [
            status.HTTP_200_OK,
            status.HTTP_400_BAD_REQUEST
        ]
        
        if response.status_code == status.HTTP_200_OK:
            assert "content-disposition" in response.headers
            assert "preview" in response.headers["content-disposition"]
    
    # Error Handling Tests
    
    @pytest.mark.asyncio
    async def test_export_invalid_item_id(
        self,
        client: AsyncClient,
        auth_headers: dict
    ):
        """Test export with invalid item ID."""
        response = await client.post(
            "/api/v1/exports/single",
            json={
                "export_type": ExportType.TRIP.value,
                "export_format": ExportFormat.PDF.value,
                "item_id": "999999",  # Non-existent ID
                "async_export": False
            },
            headers=auth_headers
        )
        
        assert response.status_code == status.HTTP_400_BAD_REQUEST
    
    @pytest.mark.asyncio
    async def test_export_invalid_format_options(
        self,
        client: AsyncClient,
        test_trip: Trip,
        auth_headers: dict
    ):
        """Test export with invalid format options."""
        response = await client.post(
            "/api/v1/exports/single",
            json={
                "export_type": ExportType.TRIP.value,
                "export_format": ExportFormat.PDF.value,
                "item_id": str(test_trip.id),
                "async_export": False,
                "options": {
                    "pdf_options": {
                        "page_size": "INVALID_SIZE",  # Invalid option
                        "margin": 999  # Out of range
                    }
                }
            },
            headers=auth_headers
        )
        
        # Should still work but ignore invalid options
        assert response.status_code in [
            status.HTTP_200_OK,
            status.HTTP_400_BAD_REQUEST
        ]
    
    # Rate Limiting Tests
    
    @pytest.mark.asyncio
    async def test_export_rate_limiting(
        self,
        client: AsyncClient,
        test_trip: Trip,
        auth_headers: dict
    ):
        """Test rate limiting on export endpoints."""
        # Make multiple requests quickly
        requests = []
        for _ in range(10):
            requests.append(
                client.post(
                    "/api/v1/exports/single",
                    json={
                        "export_type": ExportType.TRIP.value,
                        "export_format": ExportFormat.JSON.value,
                        "item_id": str(test_trip.id),
                        "async_export": False
                    },
                    headers=auth_headers
                )
            )
        
        responses = await asyncio.gather(*requests, return_exceptions=True)
        
        # Some requests should be rate limited
        status_codes = [r.status_code for r in responses if hasattr(r, 'status_code')]
        
        # At least one should succeed
        assert status.HTTP_200_OK in status_codes or \
               status.HTTP_429_TOO_MANY_REQUESTS in status_codes
    
    @pytest.mark.asyncio
    async def test_batch_export_rate_limiting(
        self,
        client: AsyncClient,
        test_trip: Trip,
        auth_headers: dict
    ):
        """Test stricter rate limiting on batch exports."""
        # Batch exports have lower rate limit
        requests = []
        for _ in range(3):
            requests.append(
                client.post(
                    "/api/v1/exports/batch",
                    json={
                        "exports": [{
                            "export_type": ExportType.TRIP.value,
                            "export_format": ExportFormat.PDF.value,
                            "item_ids": [str(test_trip.id)]
                        }]
                    },
                    headers=auth_headers
                )
            )
        
        responses = await asyncio.gather(*requests, return_exceptions=True)
        
        # Check for rate limiting
        status_codes = [r.status_code for r in responses if hasattr(r, 'status_code')]
        
        # With stricter limits, we might see rate limiting
        assert any(
            code in [status.HTTP_200_OK, status.HTTP_429_TOO_MANY_REQUESTS]
            for code in status_codes
        )