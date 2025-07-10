"""
Database performance tests for Jidelnicek 2.0.

This module contains comprehensive performance tests to ensure database
queries are optimized and maintain expected performance characteristics.
"""

import pytest
import time
import asyncio
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any
from sqlalchemy import create_engine, select, func, text
from sqlalchemy.orm import Session, sessionmaker, selectinload, joinedload
from sqlalchemy.pool import NullPool, QueuePool
from unittest.mock import patch, MagicMock
import uuid

from jidelnicek.core.database import Base
from jidelnicek.auth.models import AuthUser, AuthSession, AuditLog
from jidelnicek.recipe.models.recipe import Recipe
from jidelnicek.common.models.ingredient import Ingredient
from jidelnicek.recipe.models.recipe_ingredient import RecipeIngredient
from jidelnicek.recipe.models.categorization import RecipeCategory, RecipeTag
from jidelnicek.common.models.nutritional_value import NutritionalValue


class PerformanceTimer:
    """Context manager for timing database operations."""
    
    def __init__(self, operation_name: str):
        self.operation_name = operation_name
        self.start_time = None
        self.end_time = None
        self.duration = None
    
    def __enter__(self):
        self.start_time = time.perf_counter()
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        self.end_time = time.perf_counter()
        self.duration = self.end_time - self.start_time
        return False
    
    def assert_max_duration(self, max_seconds: float):
        """Assert that operation completed within max duration."""
        assert self.duration is not None, "Timer not properly used"
        assert self.duration <= max_seconds, (
            f"{self.operation_name} took {self.duration:.3f}s, "
            f"expected max {max_seconds}s"
        )



