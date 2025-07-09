"""
Tests for admin statistics service.
"""

import pytest
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock

from sqlalchemy.ext.asyncio import AsyncSession

from jidelnicek.admin.services.statistics import StatisticsService
from jidelnicek.auth.models import AuthUser, AuthSession, AuditLog
from jidelnicek.recipe.models.recipe import Recipe
from jidelnicek.trip.models.trip import Trip
from jidelnicek.core.models.job import Job, JobStatus, JobType


class TestStatisticsService:
    """Test cases for StatisticsService."""
    
    @pytest.fixture
    def db_session(self):
        """Mock database session."""
        return AsyncMock(spec=AsyncSession)
    
    @pytest.fixture
    def service(self, db_session):
        """Create StatisticsService instance."""
        return StatisticsService(db_session)
    
    @pytest.mark.asyncio
    async def test_get_user_statistics(self, service, db_session):
        """Test user statistics calculation."""
        start_date = date(2024, 1, 1)
        end_date = date(2024, 1, 31)
        
        # Mock database queries
        db_session.scalar.side_effect = [
            100,  # total users
            10,   # new users
            50,   # active users
            20,   # DAU
            40,   # WAU
            60,   # MAU
            5     # previous period new users
        ]
        
        db_session.execute.return_value.fetchall.return_value = [
            ('user', 90),
            ('admin', 10)
        ]
        
        # Execute test
        result = await service.get_user_statistics(start_date, end_date)
        
        # Verify results
        assert result['total'] == 100
        assert result['new'] == 10
        assert result['active'] == 50
        assert result['dau'] == 20
        assert result['wau'] == 40
        assert result['mau'] == 60
        assert result['by_role'] == {'user': 90, 'admin': 10}
        assert result['growth_rate'] == 100.0  # (10-5)/5 * 100
        assert result['retention_rate'] == 50.0  # 50/100 * 100
    
    @pytest.mark.asyncio
    async def test_get_content_statistics(self, service, db_session):
        """Test content statistics calculation."""
        start_date = date(2024, 1, 1)
        end_date = date(2024, 1, 31)
        
        # Mock database queries
        db_session.scalar.side_effect = [
            500,  # total recipes
            50,   # new recipes
            200,  # published recipes
            100,  # total trips
            10,   # new trips
            20,   # active trips
            1000, # total ingredients
            25    # total forks
        ]
        
        # Mock recipe count query
        mock_result = MagicMock()
        mock_result.first.return_value = (500, 100)  # recipes, users
        db_session.execute.return_value = mock_result
        
        # Execute test
        result = await service.get_content_statistics(start_date, end_date)
        
        # Verify results
        assert result['recipes']['total'] == 500
        assert result['recipes']['new'] == 50
        assert result['recipes']['published'] == 200
        assert result['recipes']['average_per_user'] == 5.0
        assert result['recipes']['total_forks'] == 25
        assert result['trips']['total'] == 100
        assert result['trips']['new'] == 10
        assert result['trips']['active'] == 20
        assert result['ingredients']['total'] == 1000
    
    @pytest.mark.asyncio
    async def test_get_activity_statistics(self, service, db_session):
        """Test activity statistics calculation."""
        start_date = date(2024, 1, 1)
        end_date = date(2024, 1, 31)
        
        # Mock database queries
        db_session.scalar.side_effect = [
            1000,  # total logins
            50,    # failed logins
            5000,  # total recipe views
            3600   # avg session duration in seconds
        ]
        
        # Mock export jobs query
        mock_export_result = MagicMock()
        mock_export_result.__iter__.return_value = [
            (JobType.EXPORT_SHOPPING_LIST, 10, 30.5),
            (JobType.EXPORT_TRIP_DATA, 5, 45.0)
        ]
        db_session.execute.return_value = mock_export_result
        
        # Execute test
        result = await service.get_activity_statistics(start_date, end_date)
        
        # Verify results
        assert result['logins']['successful'] == 1000
        assert result['logins']['failed'] == 50
        assert result['logins']['failure_rate'] == pytest.approx(4.76, 0.01)
        assert result['recipe_views'] == 5000
        assert result['exports']['export_shopping_list']['count'] == 10
        assert result['exports']['export_shopping_list']['avg_duration'] == 30.5
        assert result['avg_session_duration_minutes'] == 60.0
    
    @pytest.mark.asyncio
    async def test_get_system_statistics(self, service, db_session):
        """Test system statistics calculation."""
        start_date = date(2024, 1, 1)
        end_date = date(2024, 1, 31)
        
        # Mock error count
        db_session.scalar.side_effect = [
            100,  # total errors
            150.5  # avg response time
        ]
        
        # Mock errors by type
        mock_errors_result = MagicMock()
        mock_errors_result.__iter__.return_value = [
            ('ValidationError', 50),
            ('DatabaseError', 30),
            ('NetworkError', 20)
        ]
        
        # Mock job stats
        mock_jobs_result = MagicMock()
        mock_jobs_result.__iter__.return_value = [
            (JobStatus.COMPLETED, 90),
            (JobStatus.FAILED, 10)
        ]
        
        # Mock storage stats
        mock_storage_result = MagicMock()
        mock_storage_result.first.return_value = (1000, 1024 * 1024 * 512, 1024 * 50)
        
        db_session.execute.side_effect = [
            mock_errors_result,
            mock_jobs_result,
            mock_storage_result
        ]
        
        # Execute test
        result = await service.get_system_statistics(start_date, end_date)
        
        # Verify results
        assert result['errors']['total'] == 100
        assert len(result['errors']['top_types']) == 3
        assert result['errors']['top_types'][0]['type'] == 'ValidationError'
        assert result['jobs']['total'] == 100
        assert result['jobs']['success_rate'] == 90.0
        assert result['storage']['file_count'] == 1000
        assert result['storage']['total_size_mb'] == 512.0
        assert result['storage']['avg_file_size_kb'] == 50.0
        assert result['performance']['avg_response_time_ms'] == 150.5
    
    @pytest.mark.asyncio
    async def test_get_popular_content(self, service, db_session):
        """Test popular content retrieval."""
        # Mock popular recipes query
        mock_recipes_result = MagicMock()
        mock_recipes_result.__iter__.return_value = [
            ('recipe-1', 'Pasta Carbonara', 100, Decimal('4.5'), 5, 'user@example.com'),
            ('recipe-2', 'Pizza Margherita', 80, Decimal('4.8'), 3, 'chef@example.com')
        ]
        
        # Mock ingredient usage query
        mock_ingredients_result = MagicMock()
        mock_ingredients_result.__iter__.return_value = [
            ('ing-1', 'Tomato', 50),
            ('ing-2', 'Cheese', 45)
        ]
        
        # Mock category usage query
        mock_categories_result = MagicMock()
        mock_categories_result.__iter__.return_value = [
            ('cat-1', 'Italian', 25),
            ('cat-2', 'Vegetarian', 20)
        ]
        
        db_session.execute.side_effect = [
            mock_recipes_result,
            mock_ingredients_result,
            mock_categories_result
        ]
        
        # Execute test
        result = await service.get_popular_content(limit=2)
        
        # Verify results
        assert len(result['recipes']) == 2
        assert result['recipes'][0]['name'] == 'Pasta Carbonara'
        assert result['recipes'][0]['views'] == 100
        assert result['recipes'][0]['rating'] == 4.5
        
        assert len(result['ingredients']) == 2
        assert result['ingredients'][0]['name'] == 'Tomato'
        assert result['ingredients'][0]['usage_count'] == 50
        
        assert len(result['categories']) == 2
        assert result['categories'][0]['name'] == 'Italian'
        assert result['categories'][0]['recipe_count'] == 25
    
    @pytest.mark.asyncio
    async def test_get_usage_trends(self, service, db_session):
        """Test usage trends calculation."""
        start_date = date(2024, 1, 1)
        end_date = date(2024, 1, 31)
        
        # Mock user trend query
        mock_user_trend = MagicMock()
        mock_user_trend.__iter__.return_value = [
            (datetime(2024, 1, 1, tzinfo=timezone.utc), 5),
            (datetime(2024, 1, 2, tzinfo=timezone.utc), 8),
            (datetime(2024, 1, 3, tzinfo=timezone.utc), 3)
        ]
        
        # Mock recipe trend query
        mock_recipe_trend = MagicMock()
        mock_recipe_trend.__iter__.return_value = [
            (datetime(2024, 1, 1, tzinfo=timezone.utc), 10),
            (datetime(2024, 1, 2, tzinfo=timezone.utc), 15),
            (datetime(2024, 1, 3, tzinfo=timezone.utc), 12)
        ]
        
        # Mock login trend query
        mock_login_trend = MagicMock()
        mock_login_trend.__iter__.return_value = [
            (datetime(2024, 1, 1, tzinfo=timezone.utc), 20, 50),
            (datetime(2024, 1, 2, tzinfo=timezone.utc), 25, 60),
            (datetime(2024, 1, 3, tzinfo=timezone.utc), 22, 55)
        ]
        
        db_session.execute.side_effect = [
            mock_user_trend,
            mock_recipe_trend,
            mock_login_trend
        ]
        
        # Execute test
        result = await service.get_usage_trends(start_date, end_date, 'daily')
        
        # Verify results
        assert result['granularity'] == 'daily'
        
        assert len(result['user_registrations']) == 3
        assert result['user_registrations'][0]['date'] == '2024-01-01'
        assert result['user_registrations'][0]['count'] == 5
        
        assert len(result['recipe_creations']) == 3
        assert result['recipe_creations'][1]['date'] == '2024-01-02'
        assert result['recipe_creations'][1]['count'] == 15
        
        assert len(result['login_activity']) == 3
        assert result['login_activity'][2]['unique_users'] == 22
        assert result['login_activity'][2]['total_logins'] == 55
    
    @pytest.mark.asyncio
    async def test_get_date_range_comparison(self, service, db_session):
        """Test date range comparison."""
        current_start = date(2024, 1, 15)
        current_end = date(2024, 1, 31)
        
        # Mock metric queries
        db_session.scalar.side_effect = [
            50,  # current period value
            30   # previous period value
        ]
        
        # Execute test
        result = await service.get_date_range_comparison(
            'users',
            current_start,
            current_end
        )
        
        # Verify results
        assert result['metric'] == 'users'
        assert result['current_period']['value'] == 50
        assert result['previous_period']['value'] == 30
        assert result['change']['absolute'] == 20
        assert result['change']['percent'] == pytest.approx(66.67, 0.01)
    
    @pytest.mark.asyncio
    async def test_get_dashboard_overview(self, service, db_session):
        """Test complete dashboard overview."""
        # Mock all the sub-queries
        # This test mainly verifies that all components are called
        service.get_user_statistics = AsyncMock(return_value={'total': 100})
        service.get_content_statistics = AsyncMock(return_value={'recipes': {'total': 500}})
        service.get_activity_statistics = AsyncMock(return_value={'logins': {'successful': 1000}})
        service.get_system_statistics = AsyncMock(return_value={'errors': {'total': 50}})
        service.get_popular_content = AsyncMock(return_value={'recipes': []})
        service.get_usage_trends = AsyncMock(return_value={'user_registrations': []})
        
        # Execute test
        result = await service.get_dashboard_overview()
        
        # Verify all methods were called
        assert service.get_user_statistics.called
        assert service.get_content_statistics.called
        assert service.get_activity_statistics.called
        assert service.get_system_statistics.called
        assert service.get_popular_content.called
        assert service.get_usage_trends.called
        
        # Verify result structure
        assert 'period' in result
        assert 'users' in result
        assert 'content' in result
        assert 'activity' in result
        assert 'system' in result
        assert 'popular_content' in result
        assert 'trends' in result
    
    @pytest.mark.asyncio
    async def test_error_handling_in_overview(self, service, db_session):
        """Test error handling in dashboard overview."""
        # Mock one service to raise an exception
        service.get_user_statistics = AsyncMock(side_effect=Exception("Database error"))
        service.get_content_statistics = AsyncMock(return_value={'recipes': {'total': 500}})
        service.get_activity_statistics = AsyncMock(return_value={'logins': {'successful': 1000}})
        service.get_system_statistics = AsyncMock(return_value={'errors': {'total': 50}})
        service.get_popular_content = AsyncMock(return_value={'recipes': []})
        service.get_usage_trends = AsyncMock(return_value={'user_registrations': []})
        
        # Execute test
        result = await service.get_dashboard_overview()
        
        # Verify error is handled gracefully
        assert 'error' in result['users']
        assert result['users']['error'] == "Database error"
        
        # Other stats should still be available
        assert result['content']['recipes']['total'] == 500
        assert result['activity']['logins']['successful'] == 1000