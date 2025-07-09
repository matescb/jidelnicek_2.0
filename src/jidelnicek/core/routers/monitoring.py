"""
Monitoring endpoints for database performance and health.

This module provides API endpoints for monitoring database performance,
query statistics, and health checks.
"""

from typing import Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from jidelnicek.core.dependencies import get_db
from jidelnicek.core.monitoring import (
    query_monitor, pool_monitor, check_database_performance,
    QueryAnalyzer
)
from jidelnicek.core.config import settings

router = APIRouter(prefix="/monitoring", tags=["monitoring"])


@router.get("/health")
async def health_check() -> Dict[str, Any]:
    """
    Get application health status including database performance.
    
    Returns:
        Dictionary with health status and performance metrics
    """
    try:
        health_data = await check_database_performance()
        return {
            "status": "healthy" if health_data["healthy"] else "degraded",
            "database": health_data,
            "timestamp": health_data.get("timestamp")
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "error": str(e),
            "database": {"healthy": False, "error": str(e)}
        }


@router.get("/database/queries")
async def get_query_statistics() -> Dict[str, Any]:
    """
    Get comprehensive database query statistics.
    
    Returns:
        Dictionary with query performance metrics
    """
    if not query_monitor.enabled:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Query monitoring is not enabled"
        )
    
    stats = query_monitor.get_statistics()
    
    # Add query analysis
    if query_monitor.queries:
        analyzer = QueryAnalyzer()
        analysis = analyzer.analyze_queries(query_monitor.queries)
        stats["analysis"] = analysis
        stats["eager_loading_suggestions"] = analyzer.suggest_eager_loading(query_monitor.queries)
    
    return stats


@router.get("/database/slow-queries")
async def get_slow_queries(limit: int = 10) -> Dict[str, Any]:
    """
    Get the slowest database queries.
    
    Args:
        limit: Maximum number of slow queries to return
        
    Returns:
        Dictionary with slow query information
    """
    if not query_monitor.enabled:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Query monitoring is not enabled"
        )
    
    slow_queries = query_monitor.get_slow_queries(limit)
    
    return {
        "slow_queries": [
            {
                "query": q.query[:200] + "..." if len(q.query) > 200 else q.query,
                "duration": q.duration,
                "timestamp": q.timestamp.isoformat(),
                "context": q.context
            }
            for q in slow_queries
        ],
        "total_slow_queries": len(query_monitor.slow_queries),
        "threshold": query_monitor.slow_query_threshold
    }


@router.get("/database/pool")
async def get_connection_pool_status() -> Dict[str, Any]:
    """
    Get database connection pool status.
    
    Returns:
        Dictionary with connection pool metrics
    """
    if not pool_monitor.enabled:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pool monitoring is not enabled"
        )
    
    return pool_monitor.get_pool_health()


@router.get("/database/report")
async def get_performance_report() -> Dict[str, Any]:
    """
    Get a comprehensive performance report.
    
    Returns:
        Dictionary with performance report data
    """
    if not query_monitor.enabled:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Query monitoring is not enabled"
        )
    
    report = query_monitor.export_report()
    
    return {
        "report": report,
        "format": "text",
        "generated_at": query_monitor.queries[-1].timestamp.isoformat() if query_monitor.queries else None
    }


@router.post("/database/reset-stats")
async def reset_monitoring_stats() -> Dict[str, str]:
    """
    Reset monitoring statistics.
    
    Returns:
        Confirmation message
    """
    if settings.environment == "production":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot reset monitoring stats in production"
        )
    
    query_monitor.reset()
    
    return {"message": "Monitoring statistics reset successfully"}


@router.get("/database/n-plus-one")
async def detect_n_plus_one_queries(threshold: int = 10) -> Dict[str, Any]:
    """
    Detect potential N+1 query patterns.
    
    Args:
        threshold: Minimum number of executions to consider problematic
        
    Returns:
        Dictionary with N+1 query detection results
    """
    if not query_monitor.enabled:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Query monitoring is not enabled"
        )
    
    n_plus_one_candidates = query_monitor.detect_n_plus_one(threshold)
    
    return {
        "n_plus_one_candidates": n_plus_one_candidates,
        "threshold": threshold,
        "total_patterns": len(n_plus_one_candidates),
        "recommendation": "Consider using eager loading or query optimization for the identified patterns"
    }


@router.get("/database/recommendations")
async def get_optimization_recommendations() -> Dict[str, Any]:
    """
    Get optimization recommendations based on query patterns.
    
    Returns:
        Dictionary with optimization suggestions
    """
    if not query_monitor.enabled:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Query monitoring is not enabled"
        )
    
    recommendations = []
    stats = query_monitor.get_statistics()
    
    # Check for high query volume
    if stats['total_queries'] > 1000:
        recommendations.append({
            "type": "performance",
            "severity": "high",
            "message": f"High query volume detected: {stats['total_queries']} queries",
            "suggestion": "Consider implementing query caching or reducing database calls"
        })
    
    # Check for slow queries
    if stats['slow_queries_count'] > 5:
        recommendations.append({
            "type": "performance",
            "severity": "medium",
            "message": f"Multiple slow queries detected: {stats['slow_queries_count']}",
            "suggestion": "Optimize slow queries by adding indexes or rewriting queries"
        })
    
    # Check for potential N+1 patterns
    n_plus_one = stats.get('n_plus_one_candidates', [])
    if n_plus_one:
        recommendations.append({
            "type": "n_plus_one",
            "severity": "high",
            "message": f"Potential N+1 query patterns detected: {len(n_plus_one)}",
            "suggestion": "Use eager loading (selectinload/joinedload) to reduce query count"
        })
    
    # Check average query time
    if stats['average_time'] > 0.1:
        recommendations.append({
            "type": "performance",
            "severity": "medium",
            "message": f"High average query time: {stats['average_time']:.3f}s",
            "suggestion": "Review query optimization and database indexing"
        })
    
    return {
        "recommendations": recommendations,
        "total_recommendations": len(recommendations),
        "stats_summary": stats
    }


# Admin-only endpoints (if authentication is implemented)
@router.get("/database/debug")
async def get_debug_info() -> Dict[str, Any]:
    """
    Get detailed debug information about database queries.
    
    Returns:
        Dictionary with debug information
    """
    if settings.environment == "production":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Debug endpoints not available in production"
        )
    
    if not query_monitor.enabled:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Query monitoring is not enabled"
        )
    
    recent_queries = query_monitor.queries[-20:] if query_monitor.queries else []
    
    return {
        "recent_queries": [
            {
                "query": q.query,
                "parameters": q.parameters,
                "duration": q.duration,
                "timestamp": q.timestamp.isoformat(),
                "context": q.context
            }
            for q in recent_queries
        ],
        "query_patterns": dict(list(query_monitor.query_counts.items())[:20]),
        "monitoring_enabled": query_monitor.enabled,
        "slow_query_threshold": query_monitor.slow_query_threshold
    }