"""
Core application dependencies for dependency injection.

This module provides common dependencies used throughout the application
including database sessions, Redis connections, and configuration access.
"""

from typing import AsyncGenerator, Optional
import logging

from fastapi import Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.pool import NullPool
from redis.asyncio import Redis, ConnectionPool
import redis.exceptions

from jidelnicek.core.config import settings
from jidelnicek.core.database import Base
from jidelnicek.core.monitoring import setup_query_monitoring, setup_connection_pool_monitoring

logger = logging.getLogger(__name__)

# Global instances
_engine = None
_async_session_maker = None
_redis_pool = None


async def init_db() -> None:
    """
    Initialize database connection and create tables.
    
    Should be called once during application startup.
    """
    global _engine, _async_session_maker
    
    # Create async engine
    _engine = create_async_engine(
        str(settings.database_url),
        **settings.get_db_settings(),
        future=True
    )
    
    # Set up monitoring
    setup_query_monitoring(_engine.sync_engine)
    setup_connection_pool_monitoring(_engine.sync_engine)
    
    # Create session maker
    _async_session_maker = async_sessionmaker(
        _engine,
        class_=AsyncSession,
        expire_on_commit=False
    )
    
    # Create tables if they don't exist
    async with _engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    logger.info("Database initialized successfully")


async def close_db() -> None:
    """
    Close database connections.
    
    Should be called during application shutdown.
    """
    global _engine
    
    if _engine:
        await _engine.dispose()
        logger.info("Database connections closed")


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    Dependency to get database session.
    
    Yields:
        AsyncSession instance
        
    Raises:
        HTTPException: If database is not initialized
    """
    if not _async_session_maker:
        logger.error("Database not initialized")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database connection not available"
        )
    
    async with _async_session_maker() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def init_redis() -> None:
    """
    Initialize Redis connection pool.
    
    Should be called once during application startup.
    """
    global _redis_pool
    
    try:
        # Create connection pool
        _redis_pool = ConnectionPool.from_url(
            str(settings.redis_url),
            **settings.get_redis_settings()
        )
        
        # Test connection
        redis_client = Redis(connection_pool=_redis_pool)
        await redis_client.ping()
        await redis_client.close()
        
        logger.info("Redis initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize Redis: {str(e)}")
        # Don't fail startup if Redis is unavailable
        # Some features will be degraded but app can still run


async def close_redis() -> None:
    """
    Close Redis connections.
    
    Should be called during application shutdown.
    """
    global _redis_pool
    
    if _redis_pool:
        await _redis_pool.disconnect()
        logger.info("Redis connections closed")


async def get_redis_client() -> AsyncGenerator[Optional[Redis], None]:
    """
    Dependency to get Redis client.
    
    Yields:
        Redis client instance or None if unavailable
    """
    if not _redis_pool:
        logger.warning("Redis not initialized - returning None")
        yield None
        return
    
    redis_client = None
    try:
        redis_client = Redis(connection_pool=_redis_pool)
        # Test connection
        await redis_client.ping()
        yield redis_client
    except redis.exceptions.RedisError as e:
        logger.error(f"Redis connection error: {str(e)}")
        yield None
    finally:
        if redis_client:
            await redis_client.close()


class DatabaseSession:
    """
    Context manager for database sessions.
    
    Useful for background tasks and non-request contexts.
    """
    
    def __init__(self):
        self.session = None
    
    async def __aenter__(self) -> AsyncSession:
        if not _async_session_maker:
            raise RuntimeError("Database not initialized")
        self.session = _async_session_maker()
        return self.session
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            if exc_type:
                await self.session.rollback()
            else:
                await self.session.commit()
            await self.session.close()


class RedisClient:
    """
    Context manager for Redis clients.
    
    Useful for background tasks and non-request contexts.
    """
    
    def __init__(self):
        self.client = None
    
    async def __aenter__(self) -> Optional[Redis]:
        if not _redis_pool:
            return None
        try:
            self.client = Redis(connection_pool=_redis_pool)
            await self.client.ping()
            return self.client
        except redis.exceptions.RedisError:
            return None
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.client:
            await self.client.close()


# Health check dependencies
async def check_database_health() -> bool:
    """
    Check if database is healthy.
    
    Returns:
        True if database is accessible
    """
    try:
        async with DatabaseSession() as session:
            result = await session.execute("SELECT 1")
            return result.scalar() == 1
    except Exception as e:
        logger.error(f"Database health check failed: {str(e)}")
        return False


async def check_redis_health() -> bool:
    """
    Check if Redis is healthy.
    
    Returns:
        True if Redis is accessible
    """
    try:
        async with RedisClient() as client:
            if client:
                return await client.ping()
            return False
    except Exception as e:
        logger.error(f"Redis health check failed: {str(e)}")
        return False