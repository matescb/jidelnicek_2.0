"""
Cache utilities for Jídelníček 2.0.

Provides Redis client access and caching decorators.
"""

import json
from typing import Optional, Any
from functools import wraps

from jidelnicek.core.dependencies import RedisClient


async def cache_get(key: str) -> Optional[Any]:
    """
    Get value from cache.
    
    Args:
        key: Cache key
        
    Returns:
        Cached value or None
    """
    async with RedisClient() as client:
        if client is None:
            return None
            
        value = await client.get(key)
        
        if value is None:
            return None
        
        try:
            return json.loads(value)
        except (json.JSONDecodeError, TypeError):
            return value


async def cache_set(
    key: str,
    value: Any,
    expire: Optional[int] = None
) -> bool:
    """
    Set value in cache.
    
    Args:
        key: Cache key
        value: Value to cache
        expire: Expiration in seconds
        
    Returns:
        Success status
    """
    async with RedisClient() as client:
        if client is None:
            return False
            
        try:
            if isinstance(value, (dict, list)):
                value = json.dumps(value)
        except (TypeError, ValueError):
            value = str(value)
        
        return await client.set(key, value, ex=expire)


async def cache_delete(key: str) -> int:
    """
    Delete key from cache.
    
    Args:
        key: Cache key
        
    Returns:
        Number of keys deleted
    """
    async with RedisClient() as client:
        if client is None:
            return 0
        return await client.delete(key)


async def cache_exists(key: str) -> bool:
    """
    Check if key exists in cache.
    
    Args:
        key: Cache key
        
    Returns:
        Existence status
    """
    async with RedisClient() as client:
        if client is None:
            return False
        return bool(await client.exists(key))


def cached(
    key_prefix: str,
    expire: int = 300,
    key_func: Optional[callable] = None
):
    """
    Cache decorator for async functions.
    
    Args:
        key_prefix: Prefix for cache keys
        expire: Cache expiration in seconds
        key_func: Function to generate cache key from arguments
        
    Example:
        @cached("user", expire=600)
        async def get_user(user_id: int):
            return await db.get_user(user_id)
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Generate cache key
            if key_func:
                cache_key = f"{key_prefix}:{key_func(*args, **kwargs)}"
            else:
                # Simple key generation from args
                key_parts = [str(arg) for arg in args]
                key_parts.extend(f"{k}={v}" for k, v in sorted(kwargs.items()))
                cache_key = f"{key_prefix}:{':'.join(key_parts)}"
            
            # Try to get from cache
            cached_value = await cache_get(cache_key)
            if cached_value is not None:
                return cached_value
            
            # Call function and cache result
            result = await func(*args, **kwargs)
            await cache_set(cache_key, result, expire=expire)
            
            return result
        
        return wrapper
    return decorator