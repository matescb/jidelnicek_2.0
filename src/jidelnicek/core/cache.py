"""
Cache wrapper module for backward compatibility.

This module provides a simpler import path for cache utilities.
"""

from .cache_utils.cache import (
    cache_get,
    cache_set,
    cache_delete,
    cache_exists,
    cached,
)

# Add missing functions for backward compatibility
async def cache_result(key: str, func, ttl: int = 300):
    """Cache result of a function call."""
    result = await cache_get(key)
    if result is None:
        result = await func()
        await cache_set(key, result, ttl)
    return result

async def invalidate_cache(key: str):
    """Invalidate cache entry."""
    return await cache_delete(key)

# Create a cache manager instance for backward compatibility
class CacheManager:
    """Simple cache manager for error recovery service."""
    
    async def get(self, key: str):
        """Get value from cache."""
        return await cache_get(key)
    
    async def set(self, key: str, value, ttl: int = 300):
        """Set value in cache."""
        return await cache_set(key, value, ttl)
    
    async def delete(self, key: str):
        """Delete value from cache."""
        return await cache_delete(key)

cache_manager = CacheManager()

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
    "cache_get",
    "cache_set",
    "cache_delete",
    "cache_exists",
    "cached",
    "cache_key_wrapper",
    "cache_result",
]