"""
Core module for Jidelnicek 2.0.

This module provides core functionality including:
- Database configuration and utilities
- Performance monitoring and optimization
- Common utilities and helpers
"""

from .database import Base
from .database_performance import (
    QueryTimer,
    ConnectionPoolMonitor,
    PerformanceBenchmark,
    DatabaseLoadTester,
    profile_query,
    enable_query_logging,
    analyze_query_plan,
)

__all__ = [
    'Base',
    'QueryTimer',
    'ConnectionPoolMonitor',
    'PerformanceBenchmark',
    'DatabaseLoadTester',
    'profile_query',
    'enable_query_logging',
    'analyze_query_plan',
]