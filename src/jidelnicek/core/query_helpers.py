"""
Query optimization utilities for SQLAlchemy.

This module provides utilities for optimizing database queries,
including eager loading strategies, pagination helpers, and query profiling.
"""

import time
import logging
from typing import Any, Dict, List, Optional, Tuple, Type, TypeVar, Union
from functools import wraps
from contextlib import contextmanager

from sqlalchemy import Select, func, text, event
from sqlalchemy.orm import DeclarativeBase, selectinload, joinedload, contains_eager
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.engine import Engine
from sqlalchemy.sql.expression import Select as SelectExpression

from jidelnicek.core.config import settings

logger = logging.getLogger(__name__)

# Type variable for model classes
ModelType = TypeVar('ModelType', bound=DeclarativeBase)


class QueryProfiler:
    """Query profiling utility to monitor database performance."""
    
    def __init__(self, enabled: bool = None):
        self.enabled = enabled if enabled is not None else settings.environment == "development"
        self.queries: List[Dict[str, Any]] = []
        self.query_count = 0
        self.total_time = 0.0
        
    def reset(self):
        """Reset profiling statistics."""
        self.queries.clear()
        self.query_count = 0
        self.total_time = 0.0
    
    def add_query(self, query: str, duration: float, parameters: Optional[Dict] = None):
        """Add a query to the profiling log."""
        if not self.enabled:
            return
            
        self.queries.append({
            'query': query,
            'duration': duration,
            'parameters': parameters or {},
            'timestamp': time.time()
        })
        self.query_count += 1
        self.total_time += duration
    
    def get_stats(self) -> Dict[str, Any]:
        """Get profiling statistics."""
        return {
            'query_count': self.query_count,
            'total_time': self.total_time,
            'avg_time': self.total_time / self.query_count if self.query_count > 0 else 0,
            'queries': self.queries
        }
    
    def log_slow_queries(self, threshold: float = 1.0):
        """Log queries that exceed the threshold."""
        slow_queries = [q for q in self.queries if q['duration'] > threshold]
        for query in slow_queries:
            logger.warning(
                f"Slow query detected ({query['duration']:.3f}s): {query['query'][:200]}..."
            )


# Global query profiler instance
query_profiler = QueryProfiler()


def profile_query(func):
    """Decorator to profile query execution time."""
    @wraps(func)
    async def wrapper(*args, **kwargs):
        if not query_profiler.enabled:
            return await func(*args, **kwargs)
        
        start_time = time.time()
        try:
            result = await func(*args, **kwargs)
            return result
        finally:
            duration = time.time() - start_time
            query_profiler.add_query(
                query=func.__name__,
                duration=duration,
                parameters=kwargs
            )
    return wrapper


class QueryOptimizer:
    """Query optimization utilities."""
    
    @staticmethod
    def create_eager_loading_query(
        model: Type[ModelType],
        relationships: List[str],
        session: AsyncSession
    ) -> Select:
        """
        Create a query with eager loading for specified relationships.
        
        Args:
            model: The model class to query
            relationships: List of relationship names to eager load
            session: Database session
            
        Returns:
            Select query with eager loading configured
        """
        query = session.query(model)
        
        for relationship in relationships:
            # Use selectinload for collections, joinedload for single relationships
            if hasattr(getattr(model, relationship).property, 'collection_class'):
                query = query.options(selectinload(getattr(model, relationship)))
            else:
                query = query.options(joinedload(getattr(model, relationship)))
        
        return query
    
    @staticmethod
    def create_optimized_pagination_query(
        base_query: Select,
        page: int,
        page_size: int,
        count_query: Optional[Select] = None
    ) -> Tuple[Select, Select]:
        """
        Create optimized pagination queries.
        
        Args:
            base_query: The base query to paginate
            page: Page number (1-based)
            page_size: Number of items per page
            count_query: Optional separate count query for optimization
            
        Returns:
            Tuple of (data_query, count_query)
        """
        # Calculate offset
        offset = (page - 1) * page_size
        
        # Create data query with limit and offset
        data_query = base_query.limit(page_size).offset(offset)
        
        # Create count query if not provided
        if count_query is None:
            count_query = base_query.with_only_columns(func.count()).order_by(None)
        
        return data_query, count_query
    
    @staticmethod
    def detect_n_plus_one(func):
        """
        Decorator to detect N+1 query patterns.
        
        Monitors query execution and warns about potential N+1 issues.
        """
        @wraps(func)
        async def wrapper(*args, **kwargs):
            if not query_profiler.enabled:
                return await func(*args, **kwargs)
            
            initial_count = query_profiler.query_count
            result = await func(*args, **kwargs)
            final_count = query_profiler.query_count
            
            query_increase = final_count - initial_count
            
            # Heuristic: if we executed more than 10 queries, warn about N+1
            if query_increase > 10:
                logger.warning(
                    f"Potential N+1 query detected in {func.__name__}: "
                    f"{query_increase} queries executed"
                )
            
            return result
        return wrapper


class PaginationHelper:
    """Helper class for database pagination."""
    
    @staticmethod
    async def paginate(
        session: AsyncSession,
        query: Select,
        page: int = 1,
        page_size: int = 20,
        max_page_size: int = 100
    ) -> Dict[str, Any]:
        """
        Paginate a query and return results with metadata.
        
        Args:
            session: Database session
            query: SQLAlchemy query to paginate
            page: Page number (1-based)
            page_size: Number of items per page
            max_page_size: Maximum allowed page size
            
        Returns:
            Dictionary with pagination data and metadata
        """
        # Validate and limit page size
        page_size = min(page_size, max_page_size)
        page = max(1, page)
        
        # Get total count
        count_query = query.with_only_columns(func.count()).order_by(None)
        total_result = await session.execute(count_query)
        total_count = total_result.scalar()
        
        # Calculate pagination metadata
        total_pages = (total_count + page_size - 1) // page_size
        has_next = page < total_pages
        has_prev = page > 1
        
        # Get paginated results
        offset = (page - 1) * page_size
        data_query = query.limit(page_size).offset(offset)
        result = await session.execute(data_query)
        items = result.scalars().all()
        
        return {
            'items': items,
            'total': total_count,
            'page': page,
            'page_size': page_size,
            'total_pages': total_pages,
            'has_next': has_next,
            'has_prev': has_prev,
            'next_page': page + 1 if has_next else None,
            'prev_page': page - 1 if has_prev else None
        }
    
    @staticmethod
    async def paginate_with_cursor(
        session: AsyncSession,
        query: Select,
        cursor_field: str,
        cursor_value: Any = None,
        page_size: int = 20,
        direction: str = 'forward'
    ) -> Dict[str, Any]:
        """
        Cursor-based pagination for better performance on large datasets.
        
        Args:
            session: Database session
            query: SQLAlchemy query to paginate
            cursor_field: Field to use for cursor pagination
            cursor_value: Current cursor value
            page_size: Number of items per page
            direction: 'forward' or 'backward'
            
        Returns:
            Dictionary with pagination data and cursor information
        """
        # Apply cursor filtering
        if cursor_value is not None:
            cursor_column = getattr(query.column_descriptions[0]['type'], cursor_field)
            if direction == 'forward':
                query = query.where(cursor_column > cursor_value)
            else:
                query = query.where(cursor_column < cursor_value)
        
        # Apply limit and execute
        query = query.limit(page_size + 1)  # +1 to check if there's a next page
        result = await session.execute(query)
        items = result.scalars().all()
        
        # Check if there's a next page
        has_next = len(items) > page_size
        if has_next:
            items = items[:-1]  # Remove the extra item
        
        # Get cursor values
        next_cursor = getattr(items[-1], cursor_field) if items and has_next else None
        prev_cursor = getattr(items[0], cursor_field) if items else None
        
        return {
            'items': items,
            'page_size': page_size,
            'has_next': has_next,
            'next_cursor': next_cursor,
            'prev_cursor': prev_cursor
        }


class QueryCache:
    """Simple query result caching."""
    
    def __init__(self, max_size: int = 100):
        self.cache: Dict[str, Any] = {}
        self.max_size = max_size
        self.access_order: List[str] = []
    
    def get(self, key: str) -> Optional[Any]:
        """Get cached result."""
        if key in self.cache:
            # Move to end (most recently accessed)
            self.access_order.remove(key)
            self.access_order.append(key)
            return self.cache[key]
        return None
    
    def set(self, key: str, value: Any) -> None:
        """Cache a result."""
        if key in self.cache:
            # Update existing
            self.cache[key] = value
            self.access_order.remove(key)
            self.access_order.append(key)
        else:
            # Add new
            if len(self.cache) >= self.max_size:
                # Remove least recently used
                oldest_key = self.access_order.pop(0)
                del self.cache[oldest_key]
            
            self.cache[key] = value
            self.access_order.append(key)
    
    def clear(self) -> None:
        """Clear the cache."""
        self.cache.clear()
        self.access_order.clear()


# Global query cache instance
query_cache = QueryCache()


def cached_query(cache_key: str = None, ttl: int = 300):
    """
    Decorator for caching query results.
    
    Args:
        cache_key: Custom cache key (uses function name if not provided)
        ttl: Time to live in seconds
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Generate cache key
            key = cache_key or f"{func.__name__}:{hash(str(args) + str(kwargs))}"
            
            # Check cache
            cached_result = query_cache.get(key)
            if cached_result is not None:
                return cached_result
            
            # Execute and cache result
            result = await func(*args, **kwargs)
            query_cache.set(key, result)
            
            return result
        return wrapper
    return decorator


# SQL query logging setup
if settings.environment == "development":
    @event.listens_for(Engine, "before_cursor_execute")
    def receive_before_cursor_execute(conn, cursor, statement, parameters, context, executemany):
        context._query_start_time = time.time()
        if settings.db_echo:
            logger.debug(f"SQL: {statement}")
            logger.debug(f"Parameters: {parameters}")
    
    @event.listens_for(Engine, "after_cursor_execute")
    def receive_after_cursor_execute(conn, cursor, statement, parameters, context, executemany):
        total = time.time() - context._query_start_time
        query_profiler.add_query(statement, total, parameters)
        
        if total > 1.0:  # Log slow queries
            logger.warning(f"Slow query ({total:.3f}s): {statement[:200]}...")


@contextmanager
def query_profiling_context():
    """Context manager for query profiling."""
    query_profiler.reset()
    try:
        yield query_profiler
    finally:
        stats = query_profiler.get_stats()
        if stats['query_count'] > 0:
            logger.info(f"Query stats: {stats['query_count']} queries, {stats['total_time']:.3f}s total")
        query_profiler.log_slow_queries()


# Relationship loading utilities
class RelationshipLoader:
    """Utilities for optimizing relationship loading."""
    
    @staticmethod
    def create_recipe_with_full_details_query(session: AsyncSession):
        """Create optimized query for recipe with all details."""
        from jidelnicek.recipe.models import Recipe, RecipeIngredient, RecipeImage
        from jidelnicek.recipe.models.ingredient import Ingredient
        
        return session.query(Recipe).options(
            selectinload(Recipe.ingredients).selectinload(RecipeIngredient.ingredient),
            selectinload(Recipe.images),
            selectinload(Recipe.versions),
            selectinload(Recipe.recipe_categories),
            selectinload(Recipe.recipe_tags)
        )
    
    @staticmethod
    def create_user_with_auth_details_query(session: AsyncSession):
        """Create optimized query for user with authentication details."""
        from jidelnicek.auth.models import AuthUser
        
        return session.query(AuthUser).options(
            selectinload(AuthUser.sessions),
            selectinload(AuthUser.api_tokens)
        )


# Query building utilities
class QueryBuilder:
    """Utilities for building complex queries."""
    
    @staticmethod
    def create_search_query(
        model: Type[ModelType],
        search_fields: List[str],
        search_term: str,
        session: AsyncSession
    ) -> Select:
        """
        Create a search query across multiple fields.
        
        Args:
            model: The model to search
            search_fields: List of field names to search
            search_term: Search term
            session: Database session
            
        Returns:
            Search query
        """
        query = session.query(model)
        
        # Create search conditions
        search_conditions = []
        for field in search_fields:
            field_attr = getattr(model, field)
            search_conditions.append(field_attr.ilike(f'%{search_term}%'))
        
        # Combine with OR
        if search_conditions:
            from sqlalchemy import or_
            query = query.filter(or_(*search_conditions))
        
        return query
    
    @staticmethod
    def create_filter_query(
        query: Select,
        filters: Dict[str, Any]
    ) -> Select:
        """
        Apply filters to a query.
        
        Args:
            query: Base query
            filters: Dictionary of field: value filters
            
        Returns:
            Filtered query
        """
        for field, value in filters.items():
            if value is not None:
                if isinstance(value, list):
                    query = query.filter(getattr(query.column_descriptions[0]['type'], field).in_(value))
                else:
                    query = query.filter(getattr(query.column_descriptions[0]['type'], field) == value)
        
        return query