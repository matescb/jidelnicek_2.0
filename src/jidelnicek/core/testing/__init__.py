"""
Testing utilities for Jidelnicek 2.0.

This package provides utilities for testing including:
- Performance testing helpers
- Database testing utilities
- Mock factories
"""

from .performance import (
    QueryCounter,
    PerformanceAssertion,
    LoadTestScenario,
    assert_query_performance,
    measure_performance,
    assert_no_n_plus_one,
)

__all__ = [
    'QueryCounter',
    'PerformanceAssertion', 
    'LoadTestScenario',
    'assert_query_performance',
    'measure_performance',
    'assert_no_n_plus_one',
]