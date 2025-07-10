"""
Analytics and statistics service for admin dashboard.

This module provides comprehensive analytics calculations including:
- User activity statistics (DAU, WAU, MAU)
- Content creation metrics (recipes, trips)
- Popular content analysis
- System health monitoring
- Storage usage tracking
- Export statistics
"""

from datetime import datetime, date, timedelta, timezone
from typing import Optional, Dict, Any, List, Tuple
from decimal import Decimal
from collections import defaultdict
import asyncio
from functools import lru_cache

from sqlalchemy import select, func, and_, or_, desc, case
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql import Select

from jidelnicek.auth.models import AuthUser, AuthSession, AuditLog
from jidelnicek.recipe.models.recipe import Recipe
from jidelnicek.recipe.models.recipe_ingredient import RecipeIngredient
from jidelnicek.recipe.models.categorization import RecipeCategory, RecipeTag, Category, Tag
from jidelnicek.trip.models.trip import Trip
from jidelnicek.trip.models.participant import TripParticipant
from jidelnicek.trip.models.meal import TripMeal
from jidelnicek.core.models.job import Job, JobStatus, JobType
from jidelnicek.core.models.monitoring import ErrorLog, ExportMetric, PerformanceLog
from jidelnicek.core.storage.service import StoredFile
from jidelnicek.common.models.ingredient import Ingredient
from jidelnicek.core.cache import cache_result


class StatisticsService:
    """Service for calculating analytics and statistics."""
    
    def __init__(self, db: AsyncSession):
        """Initialize the statistics service."""
        self.db = db
    
    async def get_dashboard_overview(
        self,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None
    ) -> Dict[str, Any]:
        """
        Get comprehensive dashboard overview statistics.
        
        Args:
            start_date: Start date for period statistics
            end_date: End date for period statistics
            
        Returns:
            Dictionary containing all dashboard statistics
        """
        # Set default date range if not provided (last 30 days)
        if not end_date:
            end_date = date.today()
        if not start_date:
            start_date = end_date - timedelta(days=30)
        
        # Run all queries in parallel for performance
        results = await asyncio.gather(
            self.get_user_statistics(start_date, end_date),
            self.get_content_statistics(start_date, end_date),
            self.get_activity_statistics(start_date, end_date),
            self.get_system_statistics(start_date, end_date),
            self.get_popular_content(limit=10),
            self.get_usage_trends(start_date, end_date),
            return_exceptions=True
        )
        
        # Handle any exceptions
        stats = {}
        stat_names = [
            "users", "content", "activity", "system", 
            "popular_content", "trends"
        ]
        
        for i, (name, result) in enumerate(zip(stat_names, results)):
            if isinstance(result, Exception):
                stats[name] = {"error": str(result)}
            else:
                stats[name] = result
        
        return {
            "period": {
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat(),
                "days": (end_date - start_date).days + 1
            },
            **stats
        }
    
    @cache_result("user_stats", ttl=300)  # Cache for 5 minutes
    async def get_user_statistics(
        self,
        start_date: date,
        end_date: date
    ) -> Dict[str, Any]:
        """Calculate user-related statistics."""
        end_datetime = datetime.combine(end_date, datetime.max.time()).replace(tzinfo=timezone.utc)
        start_datetime = datetime.combine(start_date, datetime.min.time()).replace(tzinfo=timezone.utc)
        
        # Total users
        total_users = await self.db.scalar(
            select(func.count(AuthUser.id))
            .where(~AuthUser.is_archived)
        )
        
        # New users in period
        new_users = await self.db.scalar(
            select(func.count(AuthUser.id))
            .where(
                and_(
                    AuthUser.created_at >= start_datetime,
                    AuthUser.created_at <= end_datetime,
                    ~AuthUser.is_archived
                )
            )
        )
        
        # Active users (logged in during period)
        active_users = await self.db.scalar(
            select(func.count(func.distinct(AuthSession.user_id)))
            .where(
                and_(
                    AuthSession.created_at >= start_datetime,
                    AuthSession.created_at <= end_datetime,
                    AuthSession.is_valid
                )
            )
        )
        
        # Daily active users (last 24 hours)
        dau = await self.db.scalar(
            select(func.count(func.distinct(AuthSession.user_id)))
            .where(
                and_(
                    AuthSession.created_at >= datetime.now(timezone.utc) - timedelta(days=1),
                    AuthSession.is_valid
                )
            )
        )
        
        # Weekly active users (last 7 days)
        wau = await self.db.scalar(
            select(func.count(func.distinct(AuthSession.user_id)))
            .where(
                and_(
                    AuthSession.created_at >= datetime.now(timezone.utc) - timedelta(days=7),
                    AuthSession.is_valid
                )
            )
        )
        
        # Monthly active users (last 30 days)
        mau = await self.db.scalar(
            select(func.count(func.distinct(AuthSession.user_id)))
            .where(
                and_(
                    AuthSession.created_at >= datetime.now(timezone.utc) - timedelta(days=30),
                    AuthSession.is_valid
                )
            )
        )
        
        # Users by role
        role_counts = await self.db.execute(
            select(
                AuthUser.role,
                func.count(AuthUser.id)
            )
            .where(~AuthUser.is_archived)
            .group_by(AuthUser.role)
        )
        roles = {row[0]: row[1] for row in role_counts}
        
        # User growth rate
        previous_period_start = start_datetime - (end_datetime - start_datetime)
        previous_new_users = await self.db.scalar(
            select(func.count(AuthUser.id))
            .where(
                and_(
                    AuthUser.created_at >= previous_period_start,
                    AuthUser.created_at < start_datetime,
                    ~AuthUser.is_archived
                )
            )
        )
        
        growth_rate = 0.0
        if previous_new_users > 0:
            growth_rate = ((new_users - previous_new_users) / previous_new_users) * 100
        
        return {
            "total": total_users or 0,
            "new": new_users or 0,
            "active": active_users or 0,
            "dau": dau or 0,
            "wau": wau or 0,
            "mau": mau or 0,
            "by_role": roles,
            "growth_rate": round(growth_rate, 2),
            "retention_rate": round((active_users / total_users * 100) if total_users > 0 else 0, 2)
        }
    
    @cache_result("content_stats", ttl=300)
    async def get_content_statistics(
        self,
        start_date: date,
        end_date: date
    ) -> Dict[str, Any]:
        """Calculate content-related statistics."""
        end_datetime = datetime.combine(end_date, datetime.max.time()).replace(tzinfo=timezone.utc)
        start_datetime = datetime.combine(start_date, datetime.min.time()).replace(tzinfo=timezone.utc)
        
        # Recipe statistics
        total_recipes = await self.db.scalar(
            select(func.count(Recipe.id))
            .where(~Recipe.is_archived)
        )
        
        new_recipes = await self.db.scalar(
            select(func.count(Recipe.id))
            .where(
                and_(
                    Recipe.created_at >= start_datetime,
                    Recipe.created_at <= end_datetime,
                    ~Recipe.is_archived
                )
            )
        )
        
        published_recipes = await self.db.scalar(
            select(func.count(Recipe.id))
            .where(
                and_(
                    Recipe.is_published,
                    ~Recipe.is_archived
                )
            )
        )
        
        # Trip statistics
        total_trips = await self.db.scalar(
            select(func.count(Trip.id))
            .where(~Trip.is_archived)
        )
        
        new_trips = await self.db.scalar(
            select(func.count(Trip.id))
            .where(
                and_(
                    Trip.created_at >= start_datetime,
                    Trip.created_at <= end_datetime,
                    ~Trip.is_archived
                )
            )
        )
        
        active_trips = await self.db.scalar(
            select(func.count(Trip.id))
            .where(
                and_(
                    Trip.status == 'active',
                    ~Trip.is_archived
                )
            )
        )
        
        # Ingredient usage
        total_ingredients = await self.db.scalar(
            select(func.count(Ingredient.id))
        )
        
        # Average recipes per user
        recipes_per_user = await self.db.execute(
            select(
                func.count(Recipe.id),
                func.count(func.distinct(Recipe.user_id))
            )
            .where(~Recipe.is_archived)
        )
        row = recipes_per_user.first()
        avg_recipes_per_user = (row[0] / row[1]) if row and row[1] > 0 else 0
        
        # Fork statistics
        total_forks = await self.db.scalar(
            select(func.count(Recipe.id))
            .where(
                and_(
                    Recipe.original_recipe_id.is_not(None),
                    ~Recipe.is_archived
                )
            )
        )
        
        return {
            "recipes": {
                "total": total_recipes or 0,
                "new": new_recipes or 0,
                "published": published_recipes or 0,
                "average_per_user": round(avg_recipes_per_user, 2),
                "total_forks": total_forks or 0
            },
            "trips": {
                "total": total_trips or 0,
                "new": new_trips or 0,
                "active": active_trips or 0
            },
            "ingredients": {
                "total": total_ingredients or 0
            }
        }
    
    @cache_result("activity_stats", ttl=300)
    async def get_activity_statistics(
        self,
        start_date: date,
        end_date: date
    ) -> Dict[str, Any]:
        """Calculate activity-related statistics."""
        end_datetime = datetime.combine(end_date, datetime.max.time()).replace(tzinfo=timezone.utc)
        start_datetime = datetime.combine(start_date, datetime.min.time()).replace(tzinfo=timezone.utc)
        
        # Login statistics
        total_logins = await self.db.scalar(
            select(func.count(AuditLog.id))
            .where(
                and_(
                    AuditLog.action == AuditLog.LOGIN_SUCCESS,
                    AuditLog.created_at >= start_datetime,
                    AuditLog.created_at <= end_datetime
                )
            )
        )
        
        failed_logins = await self.db.scalar(
            select(func.count(AuditLog.id))
            .where(
                and_(
                    AuditLog.action == AuditLog.LOGIN_FAILED,
                    AuditLog.created_at >= start_datetime,
                    AuditLog.created_at <= end_datetime
                )
            )
        )
        
        # Recipe views
        total_recipe_views = await self.db.scalar(
            select(func.sum(Recipe.view_count))
            .where(~Recipe.is_archived)
        )
        
        # Export statistics
        export_jobs = await self.db.execute(
            select(
                Job.job_type,
                func.count(Job.id),
                func.avg(Job.duration)
            )
            .where(
                and_(
                    Job.created_at >= start_datetime,
                    Job.created_at <= end_datetime,
                    Job.job_type.in_([
                        JobType.EXPORT_SHOPPING_LIST,
                        JobType.EXPORT_TRIP_DATA,
                        JobType.EXPORT_RECIPES
                    ])
                )
            )
            .group_by(Job.job_type)
        )
        
        exports = {}
        for row in export_jobs:
            exports[row[0].value] = {
                "count": row[1],
                "avg_duration": round(row[2], 2) if row[2] else 0
            }
        
        # Session duration
        avg_session_duration = await self.db.scalar(
            select(
                func.avg(
                    func.extract('epoch', AuthSession.last_accessed - AuthSession.created_at)
                )
            )
            .where(
                and_(
                    AuthSession.created_at >= start_datetime,
                    AuthSession.created_at <= end_datetime,
                    AuthSession.last_accessed.is_not(None)
                )
            )
        )
        
        return {
            "logins": {
                "successful": total_logins or 0,
                "failed": failed_logins or 0,
                "failure_rate": round((failed_logins / (total_logins + failed_logins) * 100) 
                                    if (total_logins + failed_logins) > 0 else 0, 2)
            },
            "recipe_views": total_recipe_views or 0,
            "exports": exports,
            "avg_session_duration_minutes": round((avg_session_duration or 0) / 60, 2)
        }
    
    @cache_result("system_stats", ttl=60)  # Cache for 1 minute (system stats change frequently)
    async def get_system_statistics(
        self,
        start_date: date,
        end_date: date
    ) -> Dict[str, Any]:
        """Calculate system health and performance statistics."""
        end_datetime = datetime.combine(end_date, datetime.max.time()).replace(tzinfo=timezone.utc)
        start_datetime = datetime.combine(start_date, datetime.min.time()).replace(tzinfo=timezone.utc)
        
        # Error statistics
        total_errors = await self.db.scalar(
            select(func.count(ErrorLog.id))
            .where(
                and_(
                    ErrorLog.created_at >= start_datetime,
                    ErrorLog.created_at <= end_datetime
                )
            )
        )
        
        errors_by_type = await self.db.execute(
            select(
                ErrorLog.error_type,
                func.count(ErrorLog.id)
            )
            .where(
                and_(
                    ErrorLog.created_at >= start_datetime,
                    ErrorLog.created_at <= end_datetime
                )
            )
            .group_by(ErrorLog.error_type)
            .order_by(desc(func.count(ErrorLog.id)))
            .limit(5)
        )
        
        top_errors = [
            {"type": row[0], "count": row[1]}
            for row in errors_by_type
        ]
        
        # Job statistics
        job_stats = await self.db.execute(
            select(
                Job.status,
                func.count(Job.id)
            )
            .where(
                and_(
                    Job.created_at >= start_datetime,
                    Job.created_at <= end_datetime
                )
            )
            .group_by(Job.status)
        )
        
        jobs = {row[0].value: row[1] for row in job_stats}
        total_jobs = sum(jobs.values())
        success_rate = (jobs.get(JobStatus.COMPLETED.value, 0) / total_jobs * 100) if total_jobs > 0 else 0
        
        # Storage usage
        storage_stats = await self.db.execute(
            select(
                func.count(StoredFile.id),
                func.sum(StoredFile.file_size),
                func.avg(StoredFile.file_size)
            )
            .where(~StoredFile.is_deleted)
        )
        storage_row = storage_stats.first()
        
        # Performance metrics
        avg_response_time = await self.db.scalar(
            select(func.avg(PerformanceLog.duration_ms))
            .where(
                and_(
                    PerformanceLog.created_at >= start_datetime,
                    PerformanceLog.created_at <= end_datetime,
                    PerformanceLog.success == True
                )
            )
        )
        
        return {
            "errors": {
                "total": total_errors or 0,
                "top_types": top_errors
            },
            "jobs": {
                "total": total_jobs,
                "by_status": jobs,
                "success_rate": round(success_rate, 2)
            },
            "storage": {
                "file_count": storage_row[0] or 0,
                "total_size_mb": round((storage_row[1] or 0) / (1024 * 1024), 2),
                "avg_file_size_kb": round((storage_row[2] or 0) / 1024, 2)
            },
            "performance": {
                "avg_response_time_ms": round(avg_response_time or 0, 2)
            }
        }
    
    @cache_result("popular_content", ttl=600)  # Cache for 10 minutes
    async def get_popular_content(
        self,
        limit: int = 10
    ) -> Dict[str, Any]:
        """Get popular recipes and ingredients."""
        # Most viewed recipes
        popular_recipes = await self.db.execute(
            select(
                Recipe.id,
                Recipe.name,
                Recipe.view_count,
                Recipe.rating_average,
                Recipe.fork_count,
                AuthUser.email
            )
            .join(AuthUser, Recipe.user_id == AuthUser.id)
            .where(
                and_(
                    Recipe.is_published,
                    ~Recipe.is_archived
                )
            )
            .order_by(desc(Recipe.view_count))
            .limit(limit)
        )
        
        top_recipes = [
            {
                "id": str(row[0]),
                "name": row[1],
                "views": row[2],
                "rating": float(row[3]) if row[3] else None,
                "forks": row[4],
                "author": row[5]
            }
            for row in popular_recipes
        ]
        
        # Most used ingredients
        ingredient_usage = await self.db.execute(
            select(
                Ingredient.id,
                Ingredient.name,
                func.count(RecipeIngredient.id).label('usage_count')
            )
            .join(RecipeIngredient, Ingredient.id == RecipeIngredient.ingredient_id)
            .join(Recipe, RecipeIngredient.recipe_id == Recipe.id)
            .where(~Recipe.is_archived)
            .group_by(Ingredient.id, Ingredient.name)
            .order_by(desc('usage_count'))
            .limit(limit)
        )
        
        top_ingredients = [
            {
                "id": str(row[0]),
                "name": row[1],
                "usage_count": row[2]
            }
            for row in ingredient_usage
        ]
        
        # Most active categories
        category_usage = await self.db.execute(
            select(
                Category.id,
                Category.name,
                func.count(RecipeCategory.id).label('recipe_count')
            )
            .join(RecipeCategory, Category.id == RecipeCategory.category_id)
            .join(Recipe, RecipeCategory.recipe_id == Recipe.id)
            .where(~Recipe.is_archived)
            .group_by(Category.id, Category.name)
            .order_by(desc('recipe_count'))
            .limit(5)
        )
        
        top_categories = [
            {
                "id": str(row[0]),
                "name": row[1],
                "recipe_count": row[2]
            }
            for row in category_usage
        ]
        
        return {
            "recipes": top_recipes,
            "ingredients": top_ingredients,
            "categories": top_categories
        }
    
    @cache_result("usage_trends", ttl=300)
    async def get_usage_trends(
        self,
        start_date: date,
        end_date: date,
        granularity: str = "daily"
    ) -> Dict[str, Any]:
        """
        Get usage trends over time.
        
        Args:
            start_date: Start date for trends
            end_date: End date for trends
            granularity: Time granularity (daily, weekly, monthly)
            
        Returns:
            Dictionary containing trend data
        """
        # Determine date truncation based on granularity
        if granularity == "monthly":
            date_trunc = func.date_trunc('month', AuthUser.created_at)
        elif granularity == "weekly":
            date_trunc = func.date_trunc('week', AuthUser.created_at)
        else:  # daily
            date_trunc = func.date_trunc('day', AuthUser.created_at)
        
        end_datetime = datetime.combine(end_date, datetime.max.time()).replace(tzinfo=timezone.utc)
        start_datetime = datetime.combine(start_date, datetime.min.time()).replace(tzinfo=timezone.utc)
        
        # User registration trend
        user_trend = await self.db.execute(
            select(
                date_trunc.label('period'),
                func.count(AuthUser.id).label('count')
            )
            .where(
                and_(
                    AuthUser.created_at >= start_datetime,
                    AuthUser.created_at <= end_datetime,
                    ~AuthUser.is_archived
                )
            )
            .group_by('period')
            .order_by('period')
        )
        
        user_registrations = [
            {
                "date": row[0].date().isoformat(),
                "count": row[1]
            }
            for row in user_trend
        ]
        
        # Recipe creation trend
        if granularity == "monthly":
            recipe_date_trunc = func.date_trunc('month', Recipe.created_at)
        elif granularity == "weekly":
            recipe_date_trunc = func.date_trunc('week', Recipe.created_at)
        else:
            recipe_date_trunc = func.date_trunc('day', Recipe.created_at)
        
        recipe_trend = await self.db.execute(
            select(
                recipe_date_trunc.label('period'),
                func.count(Recipe.id).label('count')
            )
            .where(
                and_(
                    Recipe.created_at >= start_datetime,
                    Recipe.created_at <= end_datetime,
                    ~Recipe.is_archived
                )
            )
            .group_by('period')
            .order_by('period')
        )
        
        recipe_creations = [
            {
                "date": row[0].date().isoformat(),
                "count": row[1]
            }
            for row in recipe_trend
        ]
        
        # Login activity trend
        if granularity == "monthly":
            login_date_trunc = func.date_trunc('month', AuditLog.created_at)
        elif granularity == "weekly":
            login_date_trunc = func.date_trunc('week', AuditLog.created_at)
        else:
            login_date_trunc = func.date_trunc('day', AuditLog.created_at)
        
        login_trend = await self.db.execute(
            select(
                login_date_trunc.label('period'),
                func.count(func.distinct(AuditLog.user_id)).label('unique_users'),
                func.count(AuditLog.id).label('total_logins')
            )
            .where(
                and_(
                    AuditLog.action == AuditLog.LOGIN_SUCCESS,
                    AuditLog.created_at >= start_datetime,
                    AuditLog.created_at <= end_datetime
                )
            )
            .group_by('period')
            .order_by('period')
        )
        
        login_activity = [
            {
                "date": row[0].date().isoformat(),
                "unique_users": row[1],
                "total_logins": row[2]
            }
            for row in login_trend
        ]
        
        return {
            "granularity": granularity,
            "user_registrations": user_registrations,
            "recipe_creations": recipe_creations,
            "login_activity": login_activity
        }
    
    async def get_date_range_comparison(
        self,
        metric: str,
        current_start: date,
        current_end: date,
        previous_start: Optional[date] = None,
        previous_end: Optional[date] = None
    ) -> Dict[str, Any]:
        """
        Compare metrics between two date ranges.
        
        Args:
            metric: Metric to compare (users, recipes, trips, logins)
            current_start: Start of current period
            current_end: End of current period
            previous_start: Start of previous period (auto-calculated if not provided)
            previous_end: End of previous period (auto-calculated if not provided)
            
        Returns:
            Dictionary with current, previous, and change values
        """
        # Calculate previous period if not provided
        if not previous_start or not previous_end:
            period_days = (current_end - current_start).days + 1
            previous_end = current_start - timedelta(days=1)
            previous_start = previous_end - timedelta(days=period_days - 1)
        
        current_value = await self._get_metric_value(metric, current_start, current_end)
        previous_value = await self._get_metric_value(metric, previous_start, previous_end)
        
        change = 0.0
        change_percent = 0.0
        
        if previous_value > 0:
            change = current_value - previous_value
            change_percent = (change / previous_value) * 100
        
        return {
            "metric": metric,
            "current_period": {
                "start": current_start.isoformat(),
                "end": current_end.isoformat(),
                "value": current_value
            },
            "previous_period": {
                "start": previous_start.isoformat(),
                "end": previous_end.isoformat(),
                "value": previous_value
            },
            "change": {
                "absolute": change,
                "percent": round(change_percent, 2)
            }
        }
    
    async def _get_metric_value(
        self,
        metric: str,
        start_date: date,
        end_date: date
    ) -> int:
        """Get single metric value for a date range."""
        end_datetime = datetime.combine(end_date, datetime.max.time()).replace(tzinfo=timezone.utc)
        start_datetime = datetime.combine(start_date, datetime.min.time()).replace(tzinfo=timezone.utc)
        
        if metric == "users":
            return await self.db.scalar(
                select(func.count(AuthUser.id))
                .where(
                    and_(
                        AuthUser.created_at >= start_datetime,
                        AuthUser.created_at <= end_datetime,
                        ~AuthUser.is_archived
                    )
                )
            ) or 0
        
        elif metric == "recipes":
            return await self.db.scalar(
                select(func.count(Recipe.id))
                .where(
                    and_(
                        Recipe.created_at >= start_datetime,
                        Recipe.created_at <= end_datetime,
                        ~Recipe.is_archived
                    )
                )
            ) or 0
        
        elif metric == "trips":
            return await self.db.scalar(
                select(func.count(Trip.id))
                .where(
                    and_(
                        Trip.created_at >= start_datetime,
                        Trip.created_at <= end_datetime,
                        ~Trip.is_archived
                    )
                )
            ) or 0
        
        elif metric == "logins":
            return await self.db.scalar(
                select(func.count(AuditLog.id))
                .where(
                    and_(
                        AuditLog.action == AuditLog.LOGIN_SUCCESS,
                        AuditLog.created_at >= start_datetime,
                        AuditLog.created_at <= end_datetime
                    )
                )
            ) or 0
        
        else:
            raise ValueError(f"Unknown metric: {metric}")
    
    async def export_statistics_report(
        self,
        start_date: date,
        end_date: date,
        format: str = "json"
    ) -> Dict[str, Any]:
        """
        Export statistics report in various formats.
        
        Args:
            start_date: Start date for report
            end_date: End date for report
            format: Export format (json, csv, excel)
            
        Returns:
            Dictionary containing export data or file information
        """
        # Get all statistics
        stats = await self.get_dashboard_overview(start_date, end_date)
        
        if format == "json":
            return stats
        
        # For other formats, we would implement CSV/Excel export
        # This is a placeholder for the export logic
        return {
            "format": format,
            "data": stats,
            "message": f"Export to {format} format would be implemented here"
        }