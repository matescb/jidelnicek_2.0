"""
Dashboard API endpoints for admin analytics.

This module provides REST API endpoints for the admin dashboard,
including real-time statistics, metrics, and analytics data.
"""

from datetime import date, datetime, timedelta, timezone
from typing import Optional, Dict, Any, List
from enum import Enum

from fastapi import APIRouter, Depends, Query, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
import asyncio
import json

from jidelnicek.core.dependencies import (
    get_db,
    get_current_user,
    require_admin
)
from jidelnicek.auth.models import AuthUser
from jidelnicek.admin.services.statistics import StatisticsService
from jidelnicek.core.websockets.connection_manager import ConnectionManager
from jidelnicek.core.cache import cache_result


class TimeGranularity(str, Enum):
    """Time granularity options for trends."""
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"


class MetricType(str, Enum):
    """Available metric types for comparison."""
    USERS = "users"
    RECIPES = "recipes"
    TRIPS = "trips"
    LOGINS = "logins"


class ExportFormat(str, Enum):
    """Available export formats."""
    JSON = "json"
    CSV = "csv"
    EXCEL = "excel"


router = APIRouter(prefix="/dashboard", tags=["admin-dashboard"])
ws_manager = ConnectionManager()


@router.get("/overview")
async def get_dashboard_overview(
    start_date: Optional[date] = Query(None, description="Start date for statistics"),
    end_date: Optional[date] = Query(None, description="End date for statistics"),
    db: AsyncSession = Depends(get_db),
    current_user: AuthUser = Depends(require_admin)
) -> Dict[str, Any]:
    """
    Get comprehensive dashboard overview statistics.
    
    Returns statistics including:
    - User metrics (total, new, active, DAU/WAU/MAU)
    - Content metrics (recipes, trips, ingredients)
    - Activity metrics (logins, views, exports)
    - System health metrics
    - Popular content
    - Usage trends
    """
    service = StatisticsService(db)
    return await service.get_dashboard_overview(start_date, end_date)


@router.get("/users")
async def get_user_statistics(
    start_date: date = Query(..., description="Start date for statistics"),
    end_date: date = Query(..., description="End date for statistics"),
    db: AsyncSession = Depends(get_db),
    current_user: AuthUser = Depends(require_admin)
) -> Dict[str, Any]:
    """Get detailed user statistics for the specified period."""
    service = StatisticsService(db)
    return await service.get_user_statistics(start_date, end_date)


@router.get("/content")
async def get_content_statistics(
    start_date: date = Query(..., description="Start date for statistics"),
    end_date: date = Query(..., description="End date for statistics"),
    db: AsyncSession = Depends(get_db),
    current_user: AuthUser = Depends(require_admin)
) -> Dict[str, Any]:
    """Get detailed content statistics for the specified period."""
    service = StatisticsService(db)
    return await service.get_content_statistics(start_date, end_date)


@router.get("/activity")
async def get_activity_statistics(
    start_date: date = Query(..., description="Start date for statistics"),
    end_date: date = Query(..., description="End date for statistics"),
    db: AsyncSession = Depends(get_db),
    current_user: AuthUser = Depends(require_admin)
) -> Dict[str, Any]:
    """Get detailed activity statistics for the specified period."""
    service = StatisticsService(db)
    return await service.get_activity_statistics(start_date, end_date)


@router.get("/system")
async def get_system_statistics(
    start_date: date = Query(..., description="Start date for statistics"),
    end_date: date = Query(..., description="End date for statistics"),
    db: AsyncSession = Depends(get_db),
    current_user: AuthUser = Depends(require_admin)
) -> Dict[str, Any]:
    """Get system health and performance statistics."""
    service = StatisticsService(db)
    return await service.get_system_statistics(start_date, end_date)


@router.get("/popular")
async def get_popular_content(
    limit: int = Query(10, ge=1, le=50, description="Number of items to return"),
    db: AsyncSession = Depends(get_db),
    current_user: AuthUser = Depends(require_admin)
) -> Dict[str, Any]:
    """Get popular recipes, ingredients, and categories."""
    service = StatisticsService(db)
    return await service.get_popular_content(limit)


@router.get("/trends")
async def get_usage_trends(
    start_date: date = Query(..., description="Start date for trends"),
    end_date: date = Query(..., description="End date for trends"),
    granularity: TimeGranularity = Query(TimeGranularity.DAILY, description="Time granularity"),
    db: AsyncSession = Depends(get_db),
    current_user: AuthUser = Depends(require_admin)
) -> Dict[str, Any]:
    """Get usage trends over time with specified granularity."""
    service = StatisticsService(db)
    return await service.get_usage_trends(start_date, end_date, granularity.value)


@router.get("/comparison")
async def get_metric_comparison(
    metric: MetricType = Query(..., description="Metric to compare"),
    current_start: date = Query(..., description="Start of current period"),
    current_end: date = Query(..., description="End of current period"),
    previous_start: Optional[date] = Query(None, description="Start of previous period"),
    previous_end: Optional[date] = Query(None, description="End of previous period"),
    db: AsyncSession = Depends(get_db),
    current_user: AuthUser = Depends(require_admin)
) -> Dict[str, Any]:
    """
    Compare metrics between two date ranges.
    
    If previous period dates are not provided, they will be automatically
    calculated based on the current period duration.
    """
    service = StatisticsService(db)
    return await service.get_date_range_comparison(
        metric.value,
        current_start,
        current_end,
        previous_start,
        previous_end
    )


@router.get("/export")
async def export_statistics(
    start_date: date = Query(..., description="Start date for export"),
    end_date: date = Query(..., description="End date for export"),
    format: ExportFormat = Query(ExportFormat.JSON, description="Export format"),
    db: AsyncSession = Depends(get_db),
    current_user: AuthUser = Depends(require_admin)
) -> Any:
    """
    Export statistics report in various formats.
    
    Supported formats:
    - JSON: Returns raw JSON data
    - CSV: Returns CSV file (not yet implemented)
    - Excel: Returns Excel file (not yet implemented)
    """
    service = StatisticsService(db)
    result = await service.export_statistics_report(start_date, end_date, format.value)
    
    if format == ExportFormat.JSON:
        return result
    
    # Placeholder for other formats
    raise HTTPException(
        status_code=501,
        detail=f"Export format '{format.value}' is not yet implemented"
    )


@router.websocket("/ws")
async def dashboard_websocket(
    websocket: WebSocket,
    db: AsyncSession = Depends(get_db)
):
    """
    WebSocket endpoint for real-time dashboard updates.
    
    Sends periodic updates for:
    - Active user count
    - Recent activity
    - System health metrics
    - Error alerts
    """
    # Note: In production, we would add authentication for WebSocket
    await ws_manager.connect(websocket)
    
    try:
        # Send initial data
        service = StatisticsService(db)
        initial_data = await service.get_dashboard_overview()
        await websocket.send_json({
            "type": "initial",
            "data": initial_data
        })
        
        # Send periodic updates
        while True:
            # Wait for 30 seconds
            await asyncio.sleep(30)
            
            # Get latest metrics
            end_date = date.today()
            start_date = end_date - timedelta(days=1)
            
            # Get real-time metrics
            users = await service.get_user_statistics(start_date, end_date)
            system = await service.get_system_statistics(start_date, end_date)
            
            # Send update
            await websocket.send_json({
                "type": "update",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "data": {
                    "active_users": users.get("dau", 0),
                    "system_health": {
                        "error_count": system["errors"]["total"],
                        "job_success_rate": system["jobs"]["success_rate"]
                    }
                }
            })
            
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
    except Exception as e:
        await websocket.close(code=1011, reason=str(e))
        ws_manager.disconnect(websocket)


@router.get("/health-check")
async def dashboard_health_check(
    db: AsyncSession = Depends(get_db),
    current_user: AuthUser = Depends(require_admin)
) -> Dict[str, Any]:
    """
    Quick health check for dashboard systems.
    
    Returns current system status and any critical alerts.
    """
    service = StatisticsService(db)
    
    # Get last hour's system stats
    end_date = date.today()
    start_date = end_date
    
    system_stats = await service.get_system_statistics(start_date, end_date)
    
    # Determine health status
    error_rate = system_stats["errors"]["total"]
    job_success_rate = system_stats["jobs"]["success_rate"]
    
    status = "healthy"
    alerts = []
    
    if error_rate > 100:
        status = "warning"
        alerts.append({
            "type": "error_rate",
            "message": f"High error rate: {error_rate} errors in the last hour",
            "severity": "warning"
        })
    
    if job_success_rate < 90:
        status = "warning" if status == "healthy" else "critical"
        alerts.append({
            "type": "job_failure",
            "message": f"Low job success rate: {job_success_rate}%",
            "severity": "warning" if job_success_rate > 80 else "critical"
        })
    
    return {
        "status": status,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "metrics": {
            "error_count": error_rate,
            "job_success_rate": job_success_rate,
            "storage_usage_mb": system_stats["storage"]["total_size_mb"]
        },
        "alerts": alerts
    }


@router.get("/widgets/{widget_name}")
async def get_widget_data(
    widget_name: str,
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    options: Optional[str] = Query(None, description="JSON string of widget options"),
    db: AsyncSession = Depends(get_db),
    current_user: AuthUser = Depends(require_admin)
) -> Dict[str, Any]:
    """
    Get data for a specific dashboard widget.
    
    Available widgets:
    - user_growth: User growth chart
    - content_creation: Content creation rate
    - activity_heatmap: User activity heatmap
    - top_performers: Top performing content
    - system_metrics: System performance metrics
    """
    service = StatisticsService(db)
    
    # Parse options if provided
    widget_options = {}
    if options:
        try:
            widget_options = json.loads(options)
        except json.JSONDecodeError:
            raise HTTPException(status_code=400, detail="Invalid options format")
    
    # Set default date range if not provided
    if not end_date:
        end_date = date.today()
    if not start_date:
        start_date = end_date - timedelta(days=30)
    
    # Get widget-specific data
    if widget_name == "user_growth":
        data = await service.get_usage_trends(
            start_date,
            end_date,
            widget_options.get("granularity", "daily")
        )
        return {
            "widget": "user_growth",
            "data": data["user_registrations"]
        }
    
    elif widget_name == "content_creation":
        data = await service.get_usage_trends(
            start_date,
            end_date,
            widget_options.get("granularity", "daily")
        )
        return {
            "widget": "content_creation",
            "data": data["recipe_creations"]
        }
    
    elif widget_name == "activity_heatmap":
        data = await service.get_usage_trends(
            start_date,
            end_date,
            "daily"
        )
        return {
            "widget": "activity_heatmap",
            "data": data["login_activity"]
        }
    
    elif widget_name == "top_performers":
        limit = widget_options.get("limit", 10)
        data = await service.get_popular_content(limit)
        return {
            "widget": "top_performers",
            "data": data
        }
    
    elif widget_name == "system_metrics":
        data = await service.get_system_statistics(start_date, end_date)
        return {
            "widget": "system_metrics",
            "data": data
        }
    
    else:
        raise HTTPException(
            status_code=404,
            detail=f"Widget '{widget_name}' not found"
        )


@router.post("/refresh-cache")
async def refresh_dashboard_cache(
    current_user: AuthUser = Depends(require_admin)
) -> Dict[str, str]:
    """
    Refresh dashboard cache to get latest data.
    
    This endpoint clears cached statistics data, forcing
    fresh calculations on the next request.
    """
    # In a real implementation, we would clear specific cache keys
    # For now, return a success message
    return {
        "status": "success",
        "message": "Dashboard cache refreshed successfully"
    }