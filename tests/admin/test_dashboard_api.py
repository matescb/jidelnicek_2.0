"""
Tests for admin dashboard API endpoints.
"""

import pytest
from datetime import date, datetime
from unittest.mock import AsyncMock, patch
import json

from fastapi import status
from fastapi.testclient import TestClient
from fastapi.websockets import WebSocketDisconnect

from jidelnicek.admin.services.statistics import StatisticsService


class TestDashboardAPI:
    """Test cases for dashboard API endpoints."""
    
    @pytest.fixture
    def admin_headers(self, admin_token):
        """Admin authorization headers."""
        return {"Authorization": f"Bearer {admin_token}"}
    
    @pytest.mark.asyncio
    async def test_get_dashboard_overview_no_dates(self, client: TestClient, admin_headers):
        """Test getting dashboard overview without date filters."""
        with patch.object(StatisticsService, 'get_dashboard_overview', new_callable=AsyncMock) as mock_overview:
            mock_overview.return_value = {
                "period": {
                    "start_date": "2024-01-01",
                    "end_date": "2024-01-31",
                    "days": 31
                },
                "users": {"total": 100},
                "content": {"recipes": {"total": 500}},
                "activity": {"logins": {"successful": 1000}},
                "system": {"errors": {"total": 50}},
                "popular_content": {"recipes": []},
                "trends": {"user_registrations": []}
            }
            
            response = client.get("/admin/dashboard/overview", headers=admin_headers)
            
            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert data["users"]["total"] == 100
            assert data["content"]["recipes"]["total"] == 500
    
    @pytest.mark.asyncio
    async def test_get_dashboard_overview_with_dates(self, client: TestClient, admin_headers):
        """Test getting dashboard overview with date filters."""
        response = client.get(
            "/admin/dashboard/overview",
            params={
                "start_date": "2024-01-01",
                "end_date": "2024-01-31"
            },
            headers=admin_headers
        )
        
        assert response.status_code == status.HTTP_200_OK
    
    @pytest.mark.asyncio
    async def test_get_user_statistics(self, client: TestClient, admin_headers):
        """Test getting user statistics."""
        with patch.object(StatisticsService, 'get_user_statistics', new_callable=AsyncMock) as mock_stats:
            mock_stats.return_value = {
                "total": 100,
                "new": 10,
                "active": 50,
                "dau": 20,
                "wau": 40,
                "mau": 60,
                "by_role": {"user": 90, "admin": 10},
                "growth_rate": 15.5,
                "retention_rate": 50.0
            }
            
            response = client.get(
                "/admin/dashboard/users",
                params={
                    "start_date": "2024-01-01",
                    "end_date": "2024-01-31"
                },
                headers=admin_headers
            )
            
            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert data["total"] == 100
            assert data["dau"] == 20
            assert data["growth_rate"] == 15.5
    
    @pytest.mark.asyncio
    async def test_get_content_statistics(self, client: TestClient, admin_headers):
        """Test getting content statistics."""
        response = client.get(
            "/admin/dashboard/content",
            params={
                "start_date": "2024-01-01",
                "end_date": "2024-01-31"
            },
            headers=admin_headers
        )
        
        assert response.status_code == status.HTTP_200_OK
    
    @pytest.mark.asyncio
    async def test_get_activity_statistics(self, client: TestClient, admin_headers):
        """Test getting activity statistics."""
        response = client.get(
            "/admin/dashboard/activity",
            params={
                "start_date": "2024-01-01",
                "end_date": "2024-01-31"
            },
            headers=admin_headers
        )
        
        assert response.status_code == status.HTTP_200_OK
    
    @pytest.mark.asyncio
    async def test_get_system_statistics(self, client: TestClient, admin_headers):
        """Test getting system statistics."""
        response = client.get(
            "/admin/dashboard/system",
            params={
                "start_date": "2024-01-01",
                "end_date": "2024-01-31"
            },
            headers=admin_headers
        )
        
        assert response.status_code == status.HTTP_200_OK
    
    @pytest.mark.asyncio
    async def test_get_popular_content(self, client: TestClient, admin_headers):
        """Test getting popular content."""
        with patch.object(StatisticsService, 'get_popular_content', new_callable=AsyncMock) as mock_popular:
            mock_popular.return_value = {
                "recipes": [
                    {
                        "id": "recipe-1",
                        "name": "Pasta",
                        "views": 100,
                        "rating": 4.5,
                        "forks": 5,
                        "author": "chef@example.com"
                    }
                ],
                "ingredients": [
                    {
                        "id": "ing-1",
                        "name": "Tomato",
                        "usage_count": 50
                    }
                ],
                "categories": []
            }
            
            response = client.get(
                "/admin/dashboard/popular",
                params={"limit": 5},
                headers=admin_headers
            )
            
            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert len(data["recipes"]) == 1
            assert data["recipes"][0]["name"] == "Pasta"
    
    @pytest.mark.asyncio
    async def test_get_usage_trends(self, client: TestClient, admin_headers):
        """Test getting usage trends."""
        response = client.get(
            "/admin/dashboard/trends",
            params={
                "start_date": "2024-01-01",
                "end_date": "2024-01-31",
                "granularity": "daily"
            },
            headers=admin_headers
        )
        
        assert response.status_code == status.HTTP_200_OK
    
    @pytest.mark.asyncio
    async def test_get_metric_comparison(self, client: TestClient, admin_headers):
        """Test getting metric comparison."""
        with patch.object(StatisticsService, 'get_date_range_comparison', new_callable=AsyncMock) as mock_compare:
            mock_compare.return_value = {
                "metric": "users",
                "current_period": {
                    "start": "2024-01-15",
                    "end": "2024-01-31",
                    "value": 50
                },
                "previous_period": {
                    "start": "2023-12-29",
                    "end": "2024-01-14",
                    "value": 30
                },
                "change": {
                    "absolute": 20,
                    "percent": 66.67
                }
            }
            
            response = client.get(
                "/admin/dashboard/comparison",
                params={
                    "metric": "users",
                    "current_start": "2024-01-15",
                    "current_end": "2024-01-31"
                },
                headers=admin_headers
            )
            
            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert data["change"]["absolute"] == 20
            assert data["change"]["percent"] == 66.67
    
    @pytest.mark.asyncio
    async def test_export_statistics_json(self, client: TestClient, admin_headers):
        """Test exporting statistics as JSON."""
        response = client.get(
            "/admin/dashboard/export",
            params={
                "start_date": "2024-01-01",
                "end_date": "2024-01-31",
                "format": "json"
            },
            headers=admin_headers
        )
        
        assert response.status_code == status.HTTP_200_OK
    
    @pytest.mark.asyncio
    async def test_export_statistics_csv_not_implemented(self, client: TestClient, admin_headers):
        """Test that CSV export returns not implemented."""
        response = client.get(
            "/admin/dashboard/export",
            params={
                "start_date": "2024-01-01",
                "end_date": "2024-01-31",
                "format": "csv"
            },
            headers=admin_headers
        )
        
        assert response.status_code == status.HTTP_501_NOT_IMPLEMENTED
    
    @pytest.mark.asyncio
    async def test_health_check(self, client: TestClient, admin_headers):
        """Test dashboard health check."""
        with patch.object(StatisticsService, 'get_system_statistics', new_callable=AsyncMock) as mock_system:
            mock_system.return_value = {
                "errors": {"total": 10},
                "jobs": {"success_rate": 95.0},
                "storage": {"total_size_mb": 1024.5}
            }
            
            response = client.get("/admin/dashboard/health-check", headers=admin_headers)
            
            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert data["status"] == "healthy"
            assert data["metrics"]["error_count"] == 10
            assert data["metrics"]["job_success_rate"] == 95.0
            assert len(data["alerts"]) == 0
    
    @pytest.mark.asyncio
    async def test_health_check_with_warnings(self, client: TestClient, admin_headers):
        """Test dashboard health check with warnings."""
        with patch.object(StatisticsService, 'get_system_statistics', new_callable=AsyncMock) as mock_system:
            mock_system.return_value = {
                "errors": {"total": 150},
                "jobs": {"success_rate": 85.0},
                "storage": {"total_size_mb": 1024.5}
            }
            
            response = client.get("/admin/dashboard/health-check", headers=admin_headers)
            
            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert data["status"] == "warning"
            assert len(data["alerts"]) == 2
    
    @pytest.mark.asyncio
    async def test_get_widget_data_user_growth(self, client: TestClient, admin_headers):
        """Test getting user growth widget data."""
        with patch.object(StatisticsService, 'get_usage_trends', new_callable=AsyncMock) as mock_trends:
            mock_trends.return_value = {
                "user_registrations": [
                    {"date": "2024-01-01", "count": 5},
                    {"date": "2024-01-02", "count": 8}
                ],
                "recipe_creations": [],
                "login_activity": []
            }
            
            response = client.get(
                "/admin/dashboard/widgets/user_growth",
                params={
                    "start_date": "2024-01-01",
                    "end_date": "2024-01-31"
                },
                headers=admin_headers
            )
            
            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert data["widget"] == "user_growth"
            assert len(data["data"]) == 2
    
    @pytest.mark.asyncio
    async def test_get_widget_data_invalid(self, client: TestClient, admin_headers):
        """Test getting invalid widget data."""
        response = client.get(
            "/admin/dashboard/widgets/invalid_widget",
            headers=admin_headers
        )
        
        assert response.status_code == status.HTTP_404_NOT_FOUND
    
    @pytest.mark.asyncio
    async def test_get_widget_data_with_options(self, client: TestClient, admin_headers):
        """Test getting widget data with options."""
        options = json.dumps({"granularity": "weekly"})
        
        response = client.get(
            "/admin/dashboard/widgets/user_growth",
            params={
                "start_date": "2024-01-01",
                "end_date": "2024-01-31",
                "options": options
            },
            headers=admin_headers
        )
        
        assert response.status_code == status.HTTP_200_OK
    
    @pytest.mark.asyncio
    async def test_refresh_cache(self, client: TestClient, admin_headers):
        """Test refreshing dashboard cache."""
        response = client.post("/admin/dashboard/refresh-cache", headers=admin_headers)
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["status"] == "success"
    
    @pytest.mark.asyncio
    async def test_dashboard_access_requires_admin(self, client: TestClient, user_headers):
        """Test that dashboard endpoints require admin role."""
        response = client.get("/admin/dashboard/overview", headers=user_headers)
        
        assert response.status_code == status.HTTP_403_FORBIDDEN
    
    @pytest.mark.asyncio
    async def test_dashboard_access_unauthorized(self, client: TestClient):
        """Test that dashboard endpoints require authentication."""
        response = client.get("/admin/dashboard/overview")
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED