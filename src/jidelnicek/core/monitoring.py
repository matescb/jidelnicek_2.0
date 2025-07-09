"""
Performance monitoring utilities for database operations.

This module provides tools for monitoring database performance,
detecting slow queries, and identifying N+1 query patterns.
"""

import time
import logging
from typing import Dict, List, Any, Optional
from contextlib import contextmanager
from functools import wraps
from dataclasses import dataclass
from datetime import datetime, timezone

from sqlalchemy import event
from sqlalchemy.engine import Engine
from sqlalchemy.ext.asyncio import AsyncEngine

from jidelnicek.core.config import settings

logger = logging.getLogger(__name__)


@dataclass
class QueryInfo:
    """Information about a database query."""
    query: str
    parameters: Optional[Dict[str, Any]]
    duration: float
    timestamp: datetime
    context: Optional[str] = None


class QueryMonitor:
    """Monitor database queries for performance analysis."""
    
    def __init__(self, slow_query_threshold: float = 1.0):
        self.slow_query_threshold = slow_query_threshold
        self.queries: List[QueryInfo] = []
        self.query_counts: Dict[str, int] = {}
        self.slow_queries: List[QueryInfo] = []
        self.total_queries = 0
        self.total_time = 0.0
        self.enabled = settings.environment in ['development', 'staging']
    
    def add_query(self, query: str, parameters: Optional[Dict] = None, 
                  duration: float = 0.0, context: Optional[str] = None):
        """Add a query to the monitoring log."""
        if not self.enabled:
            return
        
        query_info = QueryInfo(
            query=query,
            parameters=parameters,
            duration=duration,
            timestamp=datetime.now(timezone.utc),
            context=context
        )
        
        self.queries.append(query_info)
        self.total_queries += 1
        self.total_time += duration
        
        # Track query patterns
        query_signature = self._get_query_signature(query)
        self.query_counts[query_signature] = self.query_counts.get(query_signature, 0) + 1
        
        # Track slow queries
        if duration > self.slow_query_threshold:
            self.slow_queries.append(query_info)
            logger.warning(f"Slow query detected ({duration:.3f}s): {query[:200]}...")
    
    def _get_query_signature(self, query: str) -> str:
        """Get a normalized signature for query pattern detection."""
        # Remove parameters and normalize whitespace
        import re
        signature = re.sub(r'\$\d+', '?', query)  # Replace $1, $2, etc. with ?
        signature = re.sub(r'\s+', ' ', signature)  # Normalize whitespace
        return signature.strip()
    
    def detect_n_plus_one(self, threshold: int = 10) -> List[str]:
        """Detect potential N+1 query patterns."""
        potential_issues = []
        
        for query_signature, count in self.query_counts.items():
            if count > threshold:
                potential_issues.append(f"Query executed {count} times: {query_signature[:100]}...")
        
        return potential_issues
    
    def get_statistics(self) -> Dict[str, Any]:
        """Get comprehensive query statistics."""
        return {
            'total_queries': self.total_queries,
            'total_time': self.total_time,
            'average_time': self.total_time / self.total_queries if self.total_queries > 0 else 0,
            'slow_queries_count': len(self.slow_queries),
            'most_frequent_queries': sorted(
                self.query_counts.items(), 
                key=lambda x: x[1], 
                reverse=True
            )[:10],
            'n_plus_one_candidates': self.detect_n_plus_one()
        }
    
    def reset(self):
        """Reset all monitoring data."""
        self.queries.clear()
        self.query_counts.clear()
        self.slow_queries.clear()
        self.total_queries = 0
        self.total_time = 0.0
    
    def get_slow_queries(self, limit: int = 10) -> List[QueryInfo]:
        """Get the slowest queries."""
        return sorted(self.slow_queries, key=lambda x: x.duration, reverse=True)[:limit]
    
    def export_report(self) -> str:
        """Export a performance report."""
        stats = self.get_statistics()
        
        report = f"""
Database Performance Report
==========================
Generated: {datetime.now(timezone.utc).isoformat()}

Summary:
- Total queries: {stats['total_queries']}
- Total time: {stats['total_time']:.3f}s
- Average time: {stats['average_time']:.3f}s
- Slow queries: {stats['slow_queries_count']}

Most Frequent Queries:
{chr(10).join(f"- {count}x: {query[:100]}..." for query, count in stats['most_frequent_queries'])}

Potential N+1 Issues:
{chr(10).join(f"- {issue}" for issue in stats['n_plus_one_candidates'])}

Slowest Queries:
{chr(10).join(f"- {q.duration:.3f}s: {q.query[:100]}..." for q in self.get_slow_queries())}
        """
        
        return report.strip()


# Global query monitor instance
query_monitor = QueryMonitor()


def setup_query_monitoring(engine):
    """Set up query monitoring for a SQLAlchemy engine."""
    if not query_monitor.enabled:
        return
    
    @event.listens_for(engine, "before_cursor_execute")
    def before_cursor_execute(conn, cursor, statement, parameters, context, executemany):
        context._query_start_time = time.time()
        context._query_statement = statement
        context._query_parameters = parameters
    
    @event.listens_for(engine, "after_cursor_execute")
    def after_cursor_execute(conn, cursor, statement, parameters, context, executemany):
        if hasattr(context, '_query_start_time'):
            duration = time.time() - context._query_start_time
            query_monitor.add_query(
                query=statement,
                parameters=parameters,
                duration=duration
            )


class PerformanceProfiler:
    """Context manager for profiling database operations."""
    
    def __init__(self, name: str, log_slow_operations: bool = True):
        self.name = name
        self.log_slow_operations = log_slow_operations
        self.start_time = None
        self.query_count_start = None
    
    def __enter__(self):
        self.start_time = time.time()
        self.query_count_start = query_monitor.total_queries
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        duration = time.time() - self.start_time
        query_count = query_monitor.total_queries - self.query_count_start
        
        if self.log_slow_operations and duration > 1.0:
            logger.warning(
                f"Slow operation '{self.name}' took {duration:.3f}s with {query_count} queries"
            )
        elif query_monitor.enabled:
            logger.debug(
                f"Operation '{self.name}' took {duration:.3f}s with {query_count} queries"
            )


def profile_database_operation(name: str = None):
    """Decorator for profiling database operations."""
    def decorator(func):
        operation_name = name or f"{func.__module__}.{func.__name__}"
        
        @wraps(func)
        async def async_wrapper(*args, **kwargs):
            with PerformanceProfiler(operation_name):
                return await func(*args, **kwargs)
        
        @wraps(func)
        def sync_wrapper(*args, **kwargs):
            with PerformanceProfiler(operation_name):
                return func(*args, **kwargs)
        
        # Return appropriate wrapper based on function type
        if hasattr(func, '__code__') and func.__code__.co_flags & 0x80:  # CO_COROUTINE
            return async_wrapper
        else:
            return sync_wrapper
    
    return decorator


class QueryAnalyzer:
    """Analyze query patterns and suggest optimizations."""
    
    @staticmethod
    def analyze_queries(queries: List[QueryInfo]) -> Dict[str, Any]:
        """Analyze a list of queries and provide optimization suggestions."""
        analysis = {
            'total_queries': len(queries),
            'unique_queries': len(set(q.query for q in queries)),
            'duplicate_queries': [],
            'missing_indexes': [],
            'optimization_suggestions': []
        }
        
        # Find duplicate queries
        query_counts = {}
        for query in queries:
            signature = QueryMonitor()._get_query_signature(query.query)
            query_counts[signature] = query_counts.get(signature, 0) + 1
        
        for query_sig, count in query_counts.items():
            if count > 5:  # Arbitrary threshold
                analysis['duplicate_queries'].append({
                    'query': query_sig[:100],
                    'count': count,
                    'suggestion': 'Consider caching or batching these queries'
                })
        
        # Detect potential missing indexes
        for query in queries:
            if query.duration > 0.5:  # Slow query
                if 'WHERE' in query.query.upper() and 'INDEX' not in query.query.upper():
                    analysis['missing_indexes'].append({
                        'query': query.query[:100],
                        'duration': query.duration,
                        'suggestion': 'Consider adding an index on WHERE clause columns'
                    })
        
        # General optimization suggestions
        if analysis['total_queries'] > 100:
            analysis['optimization_suggestions'].append(
                'High query count detected. Consider using eager loading or query optimization.'
            )
        
        if len(analysis['duplicate_queries']) > 0:
            analysis['optimization_suggestions'].append(
                'Duplicate queries detected. Consider implementing query caching.'
            )
        
        return analysis
    
    @staticmethod
    def suggest_eager_loading(queries: List[QueryInfo]) -> List[str]:
        """Suggest relationships that should use eager loading."""
        suggestions = []
        
        # Look for patterns that suggest N+1 queries
        join_patterns = {}
        
        for query in queries:
            if 'JOIN' in query.query.upper():
                # Extract table names from JOIN clauses
                import re
                joins = re.findall(r'JOIN\s+(\w+)', query.query, re.IGNORECASE)
                for join in joins:
                    join_patterns[join] = join_patterns.get(join, 0) + 1
        
        for table, count in join_patterns.items():
            if count > 10:  # Frequently joined table
                suggestions.append(f"Consider eager loading relationship with {table}")
        
        return suggestions


@contextmanager
def query_profiling_session(name: str = "session"):
    """Context manager for profiling a session of database operations."""
    initial_stats = query_monitor.get_statistics()
    
    try:
        yield query_monitor
    finally:
        final_stats = query_monitor.get_statistics()
        
        # Calculate session statistics
        session_queries = final_stats['total_queries'] - initial_stats['total_queries']
        session_time = final_stats['total_time'] - initial_stats['total_time']
        
        if session_queries > 0:
            logger.info(
                f"Session '{name}' executed {session_queries} queries in {session_time:.3f}s"
            )
            
            # Check for potential issues
            if session_queries > 50:
                logger.warning(f"High query count in session '{name}': {session_queries}")
            
            if session_time > 5.0:
                logger.warning(f"Slow session '{name}': {session_time:.3f}s")


class ConnectionPoolMonitor:
    """Monitor database connection pool health."""
    
    def __init__(self):
        self.pool_stats = {}
        self.enabled = settings.environment in ['development', 'staging']
    
    def record_pool_event(self, event_type: str, pool_info: Dict[str, Any]):
        """Record a connection pool event."""
        if not self.enabled:
            return
        
        timestamp = datetime.now(timezone.utc)
        if event_type not in self.pool_stats:
            self.pool_stats[event_type] = []
        
        self.pool_stats[event_type].append({
            'timestamp': timestamp,
            'pool_info': pool_info
        })
    
    def get_pool_health(self) -> Dict[str, Any]:
        """Get connection pool health statistics."""
        return {
            'events': {k: len(v) for k, v in self.pool_stats.items()},
            'recent_events': {
                k: v[-5:] for k, v in self.pool_stats.items() if v
            }
        }


# Global connection pool monitor
pool_monitor = ConnectionPoolMonitor()


def setup_connection_pool_monitoring(engine):
    """Set up connection pool monitoring."""
    if not pool_monitor.enabled:
        return
    
    @event.listens_for(engine, "connect")
    def on_connect(dbapi_connection, connection_record):
        pool_monitor.record_pool_event('connect', {
            'pool_size': engine.pool.size(),
            'checked_out': engine.pool.checkedout(),
            'overflow': engine.pool.overflow()
        })
    
    @event.listens_for(engine, "checkout")
    def on_checkout(dbapi_connection, connection_record, connection_proxy):
        pool_monitor.record_pool_event('checkout', {
            'pool_size': engine.pool.size(),
            'checked_out': engine.pool.checkedout(),
            'overflow': engine.pool.overflow()
        })
    
    @event.listens_for(engine, "checkin")
    def on_checkin(dbapi_connection, connection_record):
        pool_monitor.record_pool_event('checkin', {
            'pool_size': engine.pool.size(),
            'checked_out': engine.pool.checkedout(),
            'overflow': engine.pool.overflow()
        })


# Health check utilities
async def check_database_performance() -> Dict[str, Any]:
    """Check database performance and return health metrics."""
    stats = query_monitor.get_statistics()
    pool_health = pool_monitor.get_pool_health()
    
    # Determine health status
    is_healthy = True
    warnings = []
    
    if stats['slow_queries_count'] > 10:
        is_healthy = False
        warnings.append(f"High number of slow queries: {stats['slow_queries_count']}")
    
    if stats['average_time'] > 0.5:
        is_healthy = False
        warnings.append(f"High average query time: {stats['average_time']:.3f}s")
    
    if len(stats['n_plus_one_candidates']) > 0:
        warnings.append(f"Potential N+1 queries detected: {len(stats['n_plus_one_candidates'])}")
    
    return {
        'healthy': is_healthy,
        'warnings': warnings,
        'query_stats': stats,
        'pool_health': pool_health,
        'monitoring_enabled': query_monitor.enabled
    }