"""
Database performance utilities for Jidelnicek 2.0.

Provides tools for monitoring and optimizing database performance including:
- Query timing and profiling
- Connection pool monitoring  
- Performance regression detection
- Database load testing helpers
"""

import time
import logging
import functools
import asyncio
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Dict, List, Any, Optional, Callable, TypeVar, Union, Tuple
from collections import defaultdict
import json

from sqlalchemy import event, create_engine, pool
from sqlalchemy.engine import Engine, Connection
from sqlalchemy.orm import Session
from sqlalchemy.pool import Pool
import psutil

logger = logging.getLogger(__name__)

T = TypeVar('T')


class QueryTimer:
    """Track query execution times and statistics."""
    
    def __init__(self):
        self.queries: List[Dict[str, Any]] = []
        self.query_stats: Dict[str, Dict[str, Any]] = defaultdict(lambda: {
            'count': 0,
            'total_time': 0.0,
            'min_time': float('inf'),
            'max_time': 0.0,
            'avg_time': 0.0
        })
        self.enabled = True
        self._start_times: Dict[str, float] = {}
    
    def start_query(self, query: str, params: Any = None) -> str:
        """Start timing a query."""
        if not self.enabled:
            return ""
        
        query_id = f"{id(query)}_{time.time()}"
        self._start_times[query_id] = time.perf_counter()
        return query_id
    
    def end_query(self, query_id: str, query: str, params: Any = None):
        """End timing a query and record statistics."""
        if not self.enabled or query_id not in self._start_times:
            return
        
        duration = time.perf_counter() - self._start_times.pop(query_id)
        
        # Record individual query
        self.queries.append({
            'query': query,
            'params': params,
            'duration': duration,
            'timestamp': datetime.now(timezone.utc)
        })
        
        # Update statistics
        stats = self.query_stats[query]
        stats['count'] += 1
        stats['total_time'] += duration
        stats['min_time'] = min(stats['min_time'], duration)
        stats['max_time'] = max(stats['max_time'], duration)
        stats['avg_time'] = stats['total_time'] / stats['count']
    
    def get_slow_queries(self, threshold_ms: float = 100) -> List[Dict[str, Any]]:
        """Get queries that exceeded the threshold."""
        threshold_s = threshold_ms / 1000.0
        return [q for q in self.queries if q['duration'] > threshold_s]
    
    def get_statistics(self) -> Dict[str, Any]:
        """Get overall query statistics."""
        if not self.queries:
            return {
                'total_queries': 0,
                'total_time': 0.0,
                'avg_time': 0.0,
                'slow_queries': 0
            }
        
        total_time = sum(q['duration'] for q in self.queries)
        return {
            'total_queries': len(self.queries),
            'total_time': total_time,
            'avg_time': total_time / len(self.queries),
            'slow_queries': len(self.get_slow_queries()),
            'query_types': dict(self.query_stats)
        }
    
    def reset(self):
        """Reset all statistics."""
        self.queries.clear()
        self.query_stats.clear()
        self._start_times.clear()


class ConnectionPoolMonitor:
    """Monitor database connection pool health and performance."""
    
    def __init__(self, pool: Pool):
        self.pool = pool
        self.stats = {
            'connections_created': 0,
            'connections_closed': 0,
            'connection_errors': 0,
            'overflow_created': 0,
            'pool_size_history': []
        }
        self._last_check = time.time()
    
    def get_pool_status(self) -> Dict[str, Any]:
        """Get current pool status and statistics."""
        status = {
            'size': self.pool.size() if hasattr(self.pool, 'size') else 0,
            'checked_in': self.pool.checkedin() if hasattr(self.pool, 'checkedin') else 0,
            'checked_out': self.pool.checkedout() if hasattr(self.pool, 'checkedout') else 0,
            'overflow': self.pool.overflow() if hasattr(self.pool, 'overflow') else 0,
            'total': self.pool.total() if hasattr(self.pool, 'total') else 0
        }
        
        # Calculate utilization
        if status['total'] > 0:
            status['utilization'] = status['checked_out'] / status['total']
        else:
            status['utilization'] = 0.0
        
        # Record history
        current_time = time.time()
        if current_time - self._last_check > 60:  # Record every minute
            self.stats['pool_size_history'].append({
                'timestamp': datetime.now(timezone.utc),
                'size': status['size'],
                'checked_out': status['checked_out'],
                'utilization': status['utilization']
            })
            self._last_check = current_time
            
            # Keep only last 24 hours
            if len(self.stats['pool_size_history']) > 1440:
                self.stats['pool_size_history'] = self.stats['pool_size_history'][-1440:]
        
        return status
    
    def on_connect(self, dbapi_conn, connection_record):
        """Called when a new connection is created."""
        self.stats['connections_created'] += 1
    
    def on_checkout(self, dbapi_conn, connection_record, connection_proxy):
        """Called when a connection is checked out."""
        pass
    
    def on_checkin(self, dbapi_conn, connection_record):
        """Called when a connection is checked in."""
        pass
    
    def on_close(self, dbapi_conn, connection_record):
        """Called when a connection is closed."""
        self.stats['connections_closed'] += 1
    
    def get_statistics(self) -> Dict[str, Any]:
        """Get pool statistics."""
        status = self.get_pool_status()
        return {
            **status,
            **self.stats,
            'connection_lifetime': (
                self.stats['connections_created'] - self.stats['connections_closed']
            )
        }


class PerformanceBenchmark:
    """Run and track database performance benchmarks."""
    
    def __init__(self, name: str):
        self.name = name
        self.results: List[Dict[str, Any]] = []
        self.baselines: Dict[str, float] = {}
    
    def set_baseline(self, operation: str, max_duration: float):
        """Set a performance baseline for an operation."""
        self.baselines[operation] = max_duration
    
    @contextmanager
    def measure(self, operation: str, metadata: Optional[Dict[str, Any]] = None):
        """Measure the performance of an operation."""
        start_time = time.perf_counter()
        start_memory = psutil.Process().memory_info().rss / 1024 / 1024  # MB
        
        try:
            yield
        finally:
            duration = time.perf_counter() - start_time
            end_memory = psutil.Process().memory_info().rss / 1024 / 1024  # MB
            memory_delta = end_memory - start_memory
            
            result = {
                'operation': operation,
                'duration': duration,
                'memory_delta_mb': memory_delta,
                'timestamp': datetime.now(timezone.utc),
                'metadata': metadata or {}
            }
            
            # Check against baseline
            if operation in self.baselines:
                baseline = self.baselines[operation]
                result['baseline'] = baseline
                result['performance_ratio'] = duration / baseline
                result['passed'] = duration <= baseline
            
            self.results.append(result)
    
    def run_benchmark(self, func: Callable[[], T], 
                     operation: str,
                     iterations: int = 10,
                     warmup: int = 2) -> Dict[str, Any]:
        """Run a benchmark with multiple iterations."""
        # Warmup runs
        for _ in range(warmup):
            func()
        
        # Actual benchmark runs
        durations = []
        for i in range(iterations):
            with self.measure(f"{operation}_iter_{i}"):
                func()
            durations.append(self.results[-1]['duration'])
        
        # Calculate statistics
        return {
            'operation': operation,
            'iterations': iterations,
            'min_duration': min(durations),
            'max_duration': max(durations),
            'avg_duration': sum(durations) / len(durations),
            'total_duration': sum(durations),
            'passed': all(r.get('passed', True) for r in self.results[-iterations:])
        }
    
    def compare_with_baseline(self) -> Dict[str, Any]:
        """Compare results with baselines."""
        comparison = {}
        
        for operation, baseline in self.baselines.items():
            operation_results = [r for r in self.results if r['operation'] == operation]
            if not operation_results:
                continue
            
            avg_duration = sum(r['duration'] for r in operation_results) / len(operation_results)
            comparison[operation] = {
                'baseline': baseline,
                'average': avg_duration,
                'ratio': avg_duration / baseline,
                'status': 'PASS' if avg_duration <= baseline else 'FAIL',
                'samples': len(operation_results)
            }
        
        return comparison
    
    def generate_report(self) -> str:
        """Generate a performance report."""
        report = [f"Performance Benchmark Report: {self.name}"]
        report.append("=" * 60)
        
        # Summary statistics
        if self.results:
            total_duration = sum(r['duration'] for r in self.results)
            report.append(f"Total operations: {len(self.results)}")
            report.append(f"Total time: {total_duration:.3f}s")
            report.append("")
        
        # Baseline comparison
        comparison = self.compare_with_baseline()
        if comparison:
            report.append("Baseline Comparison:")
            report.append("-" * 40)
            for op, stats in comparison.items():
                status_icon = "✓" if stats['status'] == 'PASS' else "✗"
                report.append(
                    f"{status_icon} {op}: {stats['average']*1000:.1f}ms "
                    f"(baseline: {stats['baseline']*1000:.1f}ms, "
                    f"ratio: {stats['ratio']:.2f}x)"
                )
            report.append("")
        
        # Slow operations
        slow_ops = sorted(
            self.results,
            key=lambda x: x['duration'],
            reverse=True
        )[:10]
        
        if slow_ops:
            report.append("Slowest Operations:")
            report.append("-" * 40)
            for op in slow_ops:
                report.append(
                    f"{op['operation']}: {op['duration']*1000:.1f}ms "
                    f"(memory: {op['memory_delta_mb']:+.1f}MB)"
                )
        
        return "\n".join(report)


def profile_query(func: Callable[..., T]) -> Callable[..., T]:
    """Decorator to profile database queries in a function."""
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        timer = QueryTimer()
        
        # Find the session in args or kwargs
        session = None
        for arg in args:
            if isinstance(arg, Session):
                session = arg
                break
        if not session:
            session = kwargs.get('session') or kwargs.get('db')
        
        if session:
            # Set up query timing
            @event.listens_for(session, "before_execute", propagate=True)
            def receive_before_execute(conn, clauseelement, multiparams, params, execution_options):
                query_id = timer.start_query(str(clauseelement), params)
                conn.info['query_id'] = query_id
                conn.info['query'] = str(clauseelement)
            
            @event.listens_for(session, "after_execute", propagate=True)
            def receive_after_execute(conn, clauseelement, multiparams, params, execution_options, result):
                query_id = conn.info.get('query_id')
                query = conn.info.get('query', str(clauseelement))
                if query_id:
                    timer.end_query(query_id, query, params)
        
        try:
            result = func(*args, **kwargs)
            
            # Log statistics
            stats = timer.get_statistics()
            if stats['total_queries'] > 0:
                logger.info(
                    f"{func.__name__} executed {stats['total_queries']} queries "
                    f"in {stats['total_time']*1000:.1f}ms "
                    f"(avg: {stats['avg_time']*1000:.1f}ms)"
                )
                
                # Warn about slow queries
                slow_queries = timer.get_slow_queries()
                if slow_queries:
                    logger.warning(
                        f"{func.__name__} had {len(slow_queries)} slow queries"
                    )
            
            return result
        finally:
            # Clean up event listeners
            if session:
                event.remove(session, "before_execute", receive_before_execute)
                event.remove(session, "after_execute", receive_after_execute)
    
    return wrapper


class DatabaseLoadTester:
    """Utility for database load testing."""
    
    def __init__(self, engine: Engine):
        self.engine = engine
        self.results: Dict[str, List[float]] = defaultdict(list)
    
    async def run_concurrent_load(
        self,
        operation: Callable[[Session], Any],
        num_workers: int = 10,
        operations_per_worker: int = 100,
        ramp_up_time: float = 0.0
    ) -> Dict[str, Any]:
        """Run concurrent database operations."""
        async def worker(worker_id: int):
            """Individual worker executing operations."""
            # Ramp up delay
            if ramp_up_time > 0:
                await asyncio.sleep(worker_id * ramp_up_time / num_workers)
            
            worker_results = []
            Session = sessionmaker(bind=self.engine)
            
            for i in range(operations_per_worker):
                start = time.perf_counter()
                try:
                    with Session() as session:
                        operation(session)
                        session.commit()
                    duration = time.perf_counter() - start
                    worker_results.append(duration)
                except Exception as e:
                    logger.error(f"Worker {worker_id} operation {i} failed: {e}")
                    worker_results.append(-1)  # Error marker
            
            return worker_id, worker_results
        
        # Run workers concurrently
        start_time = time.perf_counter()
        tasks = [worker(i) for i in range(num_workers)]
        results = await asyncio.gather(*tasks)
        total_time = time.perf_counter() - start_time
        
        # Aggregate results
        all_durations = []
        error_count = 0
        
        for worker_id, durations in results:
            for d in durations:
                if d < 0:
                    error_count += 1
                else:
                    all_durations.append(d)
        
        if not all_durations:
            return {
                'error': 'All operations failed',
                'error_count': error_count
            }
        
        # Calculate statistics
        all_durations.sort()
        return {
            'total_operations': num_workers * operations_per_worker,
            'successful_operations': len(all_durations),
            'failed_operations': error_count,
            'total_time': total_time,
            'operations_per_second': len(all_durations) / total_time,
            'latency': {
                'min': all_durations[0] * 1000,
                'max': all_durations[-1] * 1000,
                'avg': sum(all_durations) / len(all_durations) * 1000,
                'p50': all_durations[len(all_durations) // 2] * 1000,
                'p95': all_durations[int(len(all_durations) * 0.95)] * 1000,
                'p99': all_durations[int(len(all_durations) * 0.99)] * 1000,
            }
        }
    
    def run_sequential_load(
        self,
        operations: List[Tuple[str, Callable[[Session], Any]]],
        iterations: int = 100
    ) -> Dict[str, Any]:
        """Run sequential database operations for baseline comparison."""
        Session = sessionmaker(bind=self.engine)
        results = {}
        
        for op_name, operation in operations:
            durations = []
            errors = 0
            
            for _ in range(iterations):
                start = time.perf_counter()
                try:
                    with Session() as session:
                        operation(session)
                        session.commit()
                    duration = time.perf_counter() - start
                    durations.append(duration)
                except Exception as e:
                    logger.error(f"Sequential operation {op_name} failed: {e}")
                    errors += 1
            
            if durations:
                results[op_name] = {
                    'iterations': iterations,
                    'successful': len(durations),
                    'failed': errors,
                    'total_time': sum(durations),
                    'avg_time': sum(durations) / len(durations) * 1000,
                    'min_time': min(durations) * 1000,
                    'max_time': max(durations) * 1000
                }
            else:
                results[op_name] = {
                    'error': 'All operations failed',
                    'failed': errors
                }
        
        return results


def enable_query_logging(engine: Engine, slow_query_threshold: float = 0.1):
    """Enable query logging for an engine."""
    query_timer = QueryTimer()
    
    @event.listens_for(engine, "before_execute")
    def receive_before_execute(conn, clauseelement, multiparams, params, execution_options):
        query_id = query_timer.start_query(str(clauseelement), params)
        conn.info['query_start_time'] = time.perf_counter()
        conn.info['query_id'] = query_id
    
    @event.listens_for(engine, "after_execute")
    def receive_after_execute(conn, clauseelement, multiparams, params, execution_options, result):
        query_id = conn.info.get('query_id')
        if query_id:
            query_timer.end_query(query_id, str(clauseelement), params)
            
            # Check for slow queries
            duration = time.perf_counter() - conn.info.get('query_start_time', 0)
            if duration > slow_query_threshold:
                logger.warning(
                    f"Slow query detected ({duration*1000:.1f}ms): {clauseelement}"
                )
    
    return query_timer


def analyze_query_plan(session: Session, query: str) -> Dict[str, Any]:
    """Analyze query execution plan (PostgreSQL specific)."""
    if session.bind.dialect.name != 'postgresql':
        return {'error': 'Query plan analysis only supported for PostgreSQL'}
    
    try:
        # Get query plan
        result = session.execute(f"EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) {query}")
        plan = result.scalar()
        
        # Parse plan
        if isinstance(plan, str):
            plan = json.loads(plan)
        
        # Extract key metrics
        if isinstance(plan, list) and len(plan) > 0:
            plan_data = plan[0]
            return {
                'execution_time': plan_data.get('Execution Time', 0),
                'planning_time': plan_data.get('Planning Time', 0),
                'total_time': (
                    plan_data.get('Execution Time', 0) + 
                    plan_data.get('Planning Time', 0)
                ),
                'plan': plan_data.get('Plan', {}),
                'uses_index': 'Index Scan' in str(plan_data)
            }
        
        return {'error': 'Could not parse query plan'}
        
    except Exception as e:
        return {'error': f'Query plan analysis failed: {str(e)}'}


# Example usage functions
def example_benchmark():
    """Example of using the performance benchmark utilities."""
    benchmark = PerformanceBenchmark("Recipe Query Performance")
    
    # Set baselines
    benchmark.set_baseline("recipe_by_id", 0.01)  # 10ms
    benchmark.set_baseline("recipe_search", 0.05)  # 50ms
    benchmark.set_baseline("user_recipes", 0.03)  # 30ms
    
    # Run benchmarks
    def get_recipe_by_id():
        # Simulate database query
        time.sleep(0.008)  # 8ms
    
    results = benchmark.run_benchmark(
        get_recipe_by_id,
        "recipe_by_id",
        iterations=100
    )
    
    # Generate report
    print(benchmark.generate_report())


if __name__ == "__main__":
    example_benchmark()