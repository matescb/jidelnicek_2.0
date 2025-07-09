"""
Performance testing utilities for Jidelnicek 2.0.

Provides utilities and fixtures for performance testing including:
- N+1 query detection
- Query counting
- Performance assertions
- Load testing helpers
"""

import time
import functools
from contextlib import contextmanager
from typing import Dict, List, Any, Optional, Callable, TypeVar, Set
from collections import defaultdict

from sqlalchemy import event
from sqlalchemy.engine import Engine, Connection
from sqlalchemy.orm import Session
import pytest

T = TypeVar('T')


class QueryCounter:
    """Count and analyze database queries for N+1 detection."""
    
    def __init__(self, session: Session):
        self.session = session
        self.queries: List[str] = []
        self.query_counts: Dict[str, int] = defaultdict(int)
        self.start_count = 0
        self._listening = False
    
    def __enter__(self):
        """Start counting queries."""
        self.start_count = len(self.queries)
        
        if not self._listening:
            @event.listens_for(self.session, "after_execute")
            def receive_after_execute(conn, clauseelement, multiparams, params, execution_options, result):
                query = str(clauseelement)
                self.queries.append(query)
                
                # Normalize query for counting
                normalized = self._normalize_query(query)
                self.query_counts[normalized] += 1
            
            self._listener = receive_after_execute
            self._listening = True
        
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        """Stop counting queries."""
        if self._listening:
            event.remove(self.session, "after_execute", self._listener)
            self._listening = False
    
    def _normalize_query(self, query: str) -> str:
        """Normalize query for pattern matching."""
        # Remove specific IDs and values for pattern detection
        import re
        
        # Replace UUIDs
        query = re.sub(r"'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'", "'?'", query)
        # Replace numbers
        query = re.sub(r'\b\d+\b', '?', query)
        # Replace quoted strings
        query = re.sub(r"'[^']*'", "'?'", query)
        
        return query.strip()
    
    @property
    def count(self) -> int:
        """Get number of queries executed."""
        return len(self.queries) - self.start_count
    
    def assert_max_queries(self, max_queries: int):
        """Assert that no more than max_queries were executed."""
        actual = self.count
        assert actual <= max_queries, (
            f"Expected at most {max_queries} queries, but {actual} were executed. "
            f"Queries: {self.queries[self.start_count:]}"
        )
    
    def assert_no_n_plus_one(self, base_queries: int = 1, multiplier: int = 1):
        """Assert that there's no N+1 query pattern."""
        # Look for repeated query patterns
        for pattern, count in self.query_counts.items():
            if count > base_queries * multiplier + 1:
                raise AssertionError(
                    f"Potential N+1 query detected. Pattern executed {count} times:\n{pattern}"
                )
    
    def get_duplicated_queries(self) -> Dict[str, int]:
        """Get queries that were executed multiple times."""
        return {
            pattern: count 
            for pattern, count in self.query_counts.items() 
            if count > 1
        }


class PerformanceAssertion:
    """Context manager for performance assertions."""
    
    def __init__(self, max_duration: float, operation: str = "Operation"):
        self.max_duration = max_duration
        self.operation = operation
        self.start_time = None
        self.end_time = None
        self.duration = None
    
    def __enter__(self):
        self.start_time = time.perf_counter()
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        self.end_time = time.perf_counter()
        self.duration = self.end_time - self.start_time
        
        if exc_type is None:  # Only check if no exception
            assert self.duration <= self.max_duration, (
                f"{self.operation} took {self.duration:.3f}s, "
                f"expected max {self.max_duration}s"
            )
        
        return False


def assert_query_performance(session: Session, query: Any, max_duration: float):
    """Assert that a query completes within the specified time."""
    start = time.perf_counter()
    result = session.execute(query).all()
    duration = time.perf_counter() - start
    
    assert duration <= max_duration, (
        f"Query took {duration:.3f}s, expected max {max_duration}s"
    )
    
    return result


def measure_performance(func: Callable[..., T]) -> Callable[..., T]:
    """Decorator to measure and log function performance."""
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        start_time = time.perf_counter()
        try:
            result = func(*args, **kwargs)
            duration = time.perf_counter() - start_time
            
            # Store performance data on the function
            if not hasattr(wrapper, '_performance_data'):
                wrapper._performance_data = []
            
            wrapper._performance_data.append({
                'duration': duration,
                'args': str(args)[:100],  # Truncate for logging
                'kwargs': str(kwargs)[:100]
            })
            
            return result
        except Exception:
            duration = time.perf_counter() - start_time
            # Log even on failure
            if not hasattr(wrapper, '_performance_data'):
                wrapper._performance_data = []
            wrapper._performance_data.append({
                'duration': duration,
                'error': True
            })
            raise
    
    # Add method to get performance statistics
    def get_performance_stats():
        if not hasattr(wrapper, '_performance_data'):
            return None
        
        data = wrapper._performance_data
        durations = [d['duration'] for d in data if not d.get('error')]
        
        if not durations:
            return None
        
        return {
            'count': len(durations),
            'total': sum(durations),
            'average': sum(durations) / len(durations),
            'min': min(durations),
            'max': max(durations),
            'errors': sum(1 for d in data if d.get('error', False))
        }
    
    wrapper.get_performance_stats = get_performance_stats
    return wrapper


class LoadTestScenario:
    """Define a load test scenario."""
    
    def __init__(self, name: str):
        self.name = name
        self.steps: List[Dict[str, Any]] = []
        self.results: List[Dict[str, Any]] = []
    
    def add_step(
        self, 
        operation: Callable[[Session], Any],
        weight: int = 1,
        name: Optional[str] = None
    ):
        """Add a step to the scenario."""
        self.steps.append({
            'operation': operation,
            'weight': weight,
            'name': name or operation.__name__
        })
        return self
    
    def run(
        self, 
        session_factory: Callable[[], Session],
        duration_seconds: float = 60,
        target_ops_per_second: Optional[float] = None
    ) -> Dict[str, Any]:
        """Run the load test scenario."""
        start_time = time.time()
        end_time = start_time + duration_seconds
        operations_completed = 0
        errors = 0
        operation_times: Dict[str, List[float]] = defaultdict(list)
        
        # Calculate total weight
        total_weight = sum(step['weight'] for step in self.steps)
        
        while time.time() < end_time:
            # Select operation based on weight
            import random
            rand_weight = random.randint(1, total_weight)
            current_weight = 0
            
            for step in self.steps:
                current_weight += step['weight']
                if rand_weight <= current_weight:
                    selected_step = step
                    break
            
            # Execute operation
            op_start = time.perf_counter()
            try:
                with session_factory() as session:
                    selected_step['operation'](session)
                    session.commit()
                
                op_duration = time.perf_counter() - op_start
                operation_times[selected_step['name']].append(op_duration)
                operations_completed += 1
                
            except Exception as e:
                errors += 1
                print(f"Error in {selected_step['name']}: {str(e)}")
            
            # Rate limiting
            if target_ops_per_second:
                elapsed = time.time() - start_time
                expected_ops = elapsed * target_ops_per_second
                if operations_completed > expected_ops:
                    sleep_time = (operations_completed - expected_ops) / target_ops_per_second
                    time.sleep(sleep_time)
        
        # Calculate results
        total_duration = time.time() - start_time
        results = {
            'scenario': self.name,
            'duration': total_duration,
            'total_operations': operations_completed,
            'operations_per_second': operations_completed / total_duration,
            'errors': errors,
            'error_rate': errors / (operations_completed + errors) if operations_completed + errors > 0 else 0,
            'operations': {}
        }
        
        # Per-operation statistics
        for op_name, times in operation_times.items():
            if times:
                results['operations'][op_name] = {
                    'count': len(times),
                    'avg_ms': sum(times) / len(times) * 1000,
                    'min_ms': min(times) * 1000,
                    'max_ms': max(times) * 1000,
                    'p95_ms': sorted(times)[int(len(times) * 0.95)] * 1000 if len(times) > 20 else max(times) * 1000
                }
        
        return results


# Pytest fixtures for performance testing
@pytest.fixture
def query_counter(db_session):
    """Fixture that provides a query counter for the session."""
    return QueryCounter(db_session)


@pytest.fixture
def performance_benchmark():
    """Fixture for performance benchmarking."""
    class Benchmark:
        def __init__(self):
            self.results = {}
        
        @contextmanager
        def measure(self, name: str):
            start = time.perf_counter()
            yield
            duration = time.perf_counter() - start
            self.results[name] = duration
        
        def assert_all_under(self, max_duration: float):
            """Assert all measurements are under the threshold."""
            for name, duration in self.results.items():
                assert duration <= max_duration, (
                    f"{name} took {duration:.3f}s, expected max {max_duration}s"
                )
        
        def get_report(self) -> str:
            """Get a performance report."""
            lines = ["Performance Report:"]
            for name, duration in sorted(self.results.items()):
                lines.append(f"  {name}: {duration*1000:.1f}ms")
            return "\n".join(lines)
    
    return Benchmark()


def assert_no_n_plus_one(func: Callable[..., T]) -> Callable[..., T]:
    """Decorator to assert no N+1 queries in a test."""
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        # Find session in args
        session = None
        for arg in args:
            if isinstance(arg, Session):
                session = arg
                break
        
        if not session:
            # If no session found, just run the function
            return func(*args, **kwargs)
        
        with QueryCounter(session) as counter:
            result = func(*args, **kwargs)
            counter.assert_no_n_plus_one()
            
            # Print query info for debugging
            duplicates = counter.get_duplicated_queries()
            if duplicates:
                print(f"\nDuplicated queries in {func.__name__}:")
                for query, count in duplicates.items():
                    print(f"  {count}x: {query[:100]}...")
        
        return result
    
    return wrapper


# Example usage in tests
class TestPerformanceExample:
    """Example of using performance testing utilities."""
    
    def test_no_n_plus_one_queries(self, db_session, query_counter):
        """Test that eager loading prevents N+1 queries."""
        from jidelnicek.recipe.models.recipe import Recipe
        from sqlalchemy.orm import selectinload
        
        # Create test data
        for i in range(5):
            recipe = Recipe(
                name=f"Recipe {i}",
                user_id="test-user-id"
            )
            db_session.add(recipe)
        db_session.commit()
        
        # Test with N+1 queries (bad)
        with query_counter:
            recipes = db_session.query(Recipe).all()
            for recipe in recipes:
                # This would cause N+1
                _ = recipe.ingredients
            
            # Should detect N+1
            with pytest.raises(AssertionError):
                query_counter.assert_no_n_plus_one()
        
        # Test with eager loading (good)
        with query_counter:
            recipes = db_session.query(Recipe)\
                .options(selectinload(Recipe.ingredients))\
                .all()
            for recipe in recipes:
                # No additional queries
                _ = recipe.ingredients
            
            # Should pass
            query_counter.assert_max_queries(2)  # One for recipes, one for ingredients
    
    def test_query_performance(self, db_session, performance_benchmark):
        """Test query performance meets requirements."""
        from jidelnicek.recipe.models.recipe import Recipe
        
        with performance_benchmark.measure("recipe_list"):
            recipes = db_session.query(Recipe).limit(20).all()
        
        with performance_benchmark.measure("recipe_search"):
            recipes = db_session.query(Recipe)\
                .filter(Recipe.name.ilike("%test%"))\
                .limit(10).all()
        
        # Assert all operations completed quickly
        performance_benchmark.assert_all_under(0.1)  # 100ms
        
        # Print report
        print(performance_benchmark.get_report())
    
    @assert_no_n_plus_one
    def test_complex_query_no_n_plus_one(self, db_session):
        """Test complex queries don't have N+1 issues."""
        from jidelnicek.recipe.models.recipe import Recipe
        from sqlalchemy.orm import joinedload
        
        recipes = db_session.query(Recipe)\
            .options(
                joinedload(Recipe.ingredients),
                joinedload(Recipe.categories)
            )\
            .all()
        
        # Access related data
        for recipe in recipes:
            _ = recipe.ingredients
            _ = recipe.categories
        
        return recipes