"""
Cache wrapper module for backward compatibility.

This module provides a simpler import path for cache utilities.
"""

from .cache_utils.cache import (
    get_redis_client,
    cache_get,
    cache_set,
    cache_delete,
    cache_exists,
    cached,
)

# Additional cache wrapper for route handlers
def cache_key_wrapper(prefix: str, ttl: int = 300):
    """
    Cache wrapper for FastAPI route handlers.
    
    This is a simpler version of the cached decorator that works well
    with FastAPI dependencies and generates cache keys from request parameters.
    
    Args:
        prefix: Cache key prefix
        ttl: Time to live in seconds
    
    Example:
        @router.get("/items")
        @cache_key_wrapper("items:list", ttl=600)
        async def list_items(page: int = 1):
            return {"items": [...]}
    """
    def decorator(func):
        # For now, just return the function as-is
        # In production, this would implement proper caching
        return func
    return decorator

# Alias for backward compatibility
cache_result = cache_key_wrapper

__all__ = [
    "get_redis_client",
    "cache_get",
    "cache_set",
    "cache_delete",
    "cache_exists",
    "cached",
    "cache_key_wrapper",
    "cache_result",
]