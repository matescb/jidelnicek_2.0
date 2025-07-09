"""
Authentication dependencies for Jidelnicek 2.0.

This module provides FastAPI dependencies for authentication and authorization,
including token validation, user extraction, and role-based access control.
"""

from typing import Optional, Annotated
from uuid import UUID

from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from redis.asyncio import Redis

from jidelnicek.core.dependencies import get_db, get_redis_client
from jidelnicek.auth.models import User as AuthUser
from jidelnicek.auth.services.token_service import TokenService
from jidelnicek.auth.exceptions import (
    TokenExpiredError,
    TokenInvalidError,
    UnauthorizedError,
    PermissionDeniedError,
    AccountInactiveError,
    EmailNotVerifiedError,
    UserNotFoundError
)


# Security scheme for JWT bearer tokens
security = HTTPBearer(
    scheme_name="JWT",
    description="JWT Bearer token for authentication",
    auto_error=False  # We'll handle errors ourselves
)


async def get_current_user_optional(
    credentials: Annotated[Optional[HTTPAuthorizationCredentials], Depends(security)],
    db: AsyncSession = Depends(get_db),
    redis_client: Optional[Redis] = Depends(get_redis_client)
) -> Optional[AuthUser]:
    """
    Get current user from JWT token (optional).
    
    This dependency returns None if no valid token is provided,
    useful for endpoints that work with or without authentication.
    
    Args:
        credentials: Bearer token credentials
        db: Database session
        redis_client: Redis client
        
    Returns:
        User instance or None
    """
    if not credentials:
        return None
    
    try:
        # Initialize token service
        token_service = TokenService(db, redis_client)
        
        # Validate token
        payload = token_service.validate_token(credentials.credentials, "access")
        
        # Check if token is blacklisted
        if await token_service.is_token_blacklisted(credentials.credentials):
            raise TokenInvalidError("access")
        
        # Get user ID from token
        user_id = UUID(payload.get("sub"))
        
        # Fetch user from database
        result = await db.execute(
            select(AuthUser).where(AuthUser.id == user_id)
        )
        user = result.scalar_one_or_none()
        
        if not user:
            return None
        
        # Check if user is active
        if not user.is_active:
            return None
        
        return user
        
    except (TokenExpiredError, TokenInvalidError, ValueError):
        return None


async def get_current_user(
    credentials: Annotated[Optional[HTTPAuthorizationCredentials], Depends(security)],
    db: AsyncSession = Depends(get_db),
    redis_client: Optional[Redis] = Depends(get_redis_client)
) -> AuthUser:
    """
    Get current user from JWT token (required).
    
    This dependency requires a valid token and active user,
    raises exceptions if authentication fails.
    
    Args:
        credentials: Bearer token credentials
        db: Database session
        redis_client: Redis client
        
    Returns:
        User instance
        
    Raises:
        HTTPException: If authentication fails
    """
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    try:
        # Initialize token service
        token_service = TokenService(db, redis_client)
        
        # Validate token
        payload = token_service.validate_token(credentials.credentials, "access")
        
        # Check if token is blacklisted
        if await token_service.is_token_blacklisted(credentials.credentials):
            raise TokenInvalidError("access")
        
        # Get user ID from token
        user_id = UUID(payload.get("sub"))
        
        # Fetch user from database
        result = await db.execute(
            select(AuthUser).where(AuthUser.id == user_id)
        )
        user = result.scalar_one_or_none()
        
        if not user:
            raise UserNotFoundError(f"User {user_id}")
        
        # Check if user is active
        if not user.is_active:
            raise AccountInactiveError()
        
        # Check if user is archived
        if user.is_archived:
            raise UserNotFoundError("User account no longer exists")
        
        return user
        
    except TokenExpiredError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except TokenInvalidError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except (UserNotFoundError, AccountInactiveError) as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e)
        )
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token format",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def get_current_verified_user(
    current_user: Annotated[AuthUser, Depends(get_current_user)]
) -> AuthUser:
    """
    Get current user with verified email (required).
    
    This dependency requires the user to have a verified email address.
    
    Args:
        current_user: Current authenticated user
        
    Returns:
        User instance with verified email
        
    Raises:
        HTTPException: If email is not verified
    """
    if not current_user.email_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email verification required"
        )
    
    return current_user


async def get_current_admin_user(
    current_user: Annotated[AuthUser, Depends(get_current_user)]
) -> AuthUser:
    """
    Get current user with admin role (required).
    
    This dependency requires the user to have admin privileges.
    
    Args:
        current_user: Current authenticated user
        
    Returns:
        Admin user instance
        
    Raises:
        HTTPException: If user is not an admin
    """
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    
    return current_user


class RequirePermission:
    """
    Dependency class for permission-based access control.
    
    Usage:
        @router.get("/admin/users", dependencies=[Depends(RequirePermission("users:read"))])
    """
    
    def __init__(self, permission: str):
        """
        Initialize permission requirement.
        
        Args:
            permission: Required permission string
        """
        self.permission = permission
    
    async def __call__(
        self,
        current_user: Annotated[AuthUser, Depends(get_current_user)]
    ) -> AuthUser:
        """
        Check if user has required permission.
        
        Args:
            current_user: Current authenticated user
            
        Returns:
            User instance if permission granted
            
        Raises:
            HTTPException: If permission denied
        """
        # For now, we have a simple role-based system
        # Admin has all permissions
        if current_user.is_admin:
            return current_user
        
        # Map permissions to roles
        user_permissions = {
            "recipes:read": True,
            "recipes:write": True,
            "trips:read": True,
            "trips:write": True,
            "profile:read": True,
            "profile:write": True,
        }
        
        admin_permissions = {
            "users:read": True,
            "users:write": True,
            "users:delete": True,
            "admin:access": True,
        }
        
        # Check permission
        if self.permission in user_permissions:
            return current_user
        
        if self.permission in admin_permissions and current_user.is_admin:
            return current_user
        
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Permission '{self.permission}' required"
        )


# Convenience dependency instances
CurrentUser = Annotated[AuthUser, Depends(get_current_user)]
CurrentUserOptional = Annotated[Optional[AuthUser], Depends(get_current_user_optional)]
CurrentVerifiedUser = Annotated[AuthUser, Depends(get_current_verified_user)]
CurrentAdminUser = Annotated[AuthUser, Depends(get_current_admin_user)]


async def get_current_user_ws(
    token: str,
    db: Optional[AsyncSession] = None,
    redis_client: Optional[Redis] = None
) -> Optional[AuthUser]:
    """
    Get current user from JWT token for WebSocket connections.
    
    WebSockets don't support the standard FastAPI dependency injection,
    so this function can be called directly with a token string.
    
    Args:
        token: JWT access token
        db: Database session (will create one if not provided)
        redis_client: Redis client (will create one if not provided)
        
    Returns:
        User instance or None if authentication fails
    """
    from jidelnicek.core.database import AsyncSessionLocal
    from jidelnicek.core.cache import get_redis_pool
    
    # Create database session if not provided
    if db is None:
        async with AsyncSessionLocal() as session:
            return await get_current_user_ws(token, session, redis_client)
    
    # Create Redis client if not provided
    if redis_client is None:
        pool = await get_redis_pool()
        if pool:
            async with Redis(connection_pool=pool) as redis:
                return await get_current_user_ws(token, db, redis)
        else:
            # Continue without Redis (token blacklist won't be checked)
            pass
    
    try:
        # Initialize token service
        token_service = TokenService(db, redis_client)
        
        # Validate token
        payload = token_service.validate_token(token, "access")
        
        # Check if token is blacklisted (if Redis available)
        if redis_client and await token_service.is_token_blacklisted(token):
            return None
        
        # Get user ID from token
        user_id = UUID(payload.get("sub"))
        
        # Fetch user from database
        result = await db.execute(
            select(AuthUser).where(AuthUser.id == user_id)
        )
        user = result.scalar_one_or_none()
        
        if not user or not user.is_active or user.is_archived:
            return None
        
        return user
        
    except (TokenExpiredError, TokenInvalidError, ValueError):
        return None