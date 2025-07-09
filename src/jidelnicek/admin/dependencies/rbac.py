"""
RBAC dependencies for permission-based access control in admin interface.

This module provides FastAPI dependencies for checking permissions
using the RBAC system.
"""

from typing import List, Optional, Annotated
from uuid import UUID

from fastapi import Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from redis.asyncio import Redis

from jidelnicek.core.dependencies import get_db, get_redis_client
from jidelnicek.auth.dependencies.auth import get_current_user
from jidelnicek.auth.models import AuthUser
from jidelnicek.admin.services.rbac_service import RBACService


class RequirePermissions:
    """
    Dependency class for permission-based access control.
    
    Usage:
        @router.get("/admin/users", dependencies=[Depends(RequirePermissions(["users:read"]))])
        
        # Or inject the user
        @router.get("/admin/users")
        async def list_users(user: AuthUser = Depends(RequirePermissions(["users:read"]))):
            ...
    """
    
    def __init__(self, permissions: List[str], require_all: bool = True):
        """
        Initialize permission requirement.
        
        Args:
            permissions: List of required permission codes
            require_all: If True, user must have all permissions. If False, any permission is sufficient.
        """
        self.permissions = permissions
        self.require_all = require_all
    
    async def __call__(
        self,
        current_user: Annotated[AuthUser, Depends(get_current_user)],
        db: AsyncSession = Depends(get_db),
        redis_client: Optional[Redis] = Depends(get_redis_client)
    ) -> AuthUser:
        """
        Check if user has required permissions.
        
        Args:
            current_user: Current authenticated user
            db: Database session
            redis_client: Redis client for caching
            
        Returns:
            User instance if permissions granted
            
        Raises:
            HTTPException: If permissions denied
        """
        rbac_service = RBACService(db, redis_client)
        
        # Check permissions
        has_permission = await rbac_service.check_permissions(
            user=current_user,
            permissions=self.permissions,
            require_all=self.require_all
        )
        
        if not has_permission:
            permissions_str = ", ".join(self.permissions)
            requirement = "all" if self.require_all else "any"
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Missing required permissions: {requirement} of [{permissions_str}]"
            )
        
        return current_user


class RequireAnyPermission(RequirePermissions):
    """
    Convenience class for checking if user has ANY of the specified permissions.
    
    Usage:
        @router.get("/admin/content", dependencies=[Depends(RequireAnyPermission(["content:read", "moderation:read"]))])
    """
    
    def __init__(self, permissions: List[str]):
        super().__init__(permissions, require_all=False)


async def check_resource_permission(
    user: AuthUser,
    permission: str,
    resource_id: Optional[UUID] = None,
    db: AsyncSession = Depends(get_db),
    redis_client: Optional[Redis] = Depends(get_redis_client)
) -> bool:
    """
    Check if user has permission for a specific resource.
    
    This is a helper function for resource-specific permission checks.
    
    Args:
        user: User to check
        permission: Permission code
        resource_id: Optional resource ID for resource-specific checks
        db: Database session
        redis_client: Redis client
        
    Returns:
        True if user has permission
    """
    rbac_service = RBACService(db, redis_client)
    return await rbac_service.check_permission(user, permission, resource_id)


async def get_user_permissions(
    current_user: Annotated[AuthUser, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
    redis_client: Optional[Redis] = Depends(get_redis_client)
) -> List[str]:
    """
    Get all permissions for the current user.
    
    This dependency is useful for endpoints that need to return
    user permissions for frontend permission checks.
    
    Args:
        current_user: Current authenticated user
        db: Database session
        redis_client: Redis client
        
    Returns:
        List of permission codes
    """
    rbac_service = RBACService(db, redis_client)
    permissions = await rbac_service.get_user_permissions(current_user.id)
    
    # Include delegated permissions
    delegated = await rbac_service.get_delegated_permissions(current_user.id)
    permissions.update(delegated)
    
    return sorted(list(permissions))


# Convenience dependency instances for common permissions
RequireUserRead = RequirePermissions(["users:read"])
RequireUserWrite = RequirePermissions(["users:write"])
RequireUserDelete = RequirePermissions(["users:delete"])

RequireRoleRead = RequirePermissions(["roles:read"])
RequireRoleWrite = RequirePermissions(["roles:write"])
RequireRoleAssign = RequirePermissions(["roles:assign"])

RequireContentRead = RequirePermissions(["content:read"])
RequireContentWrite = RequirePermissions(["content:write"])
RequireContentModerate = RequirePermissions(["moderation:write"])

RequireAnalyticsRead = RequirePermissions(["analytics:read"])
RequireAnalyticsAdmin = RequirePermissions(["analytics:admin"])

RequireSystemRead = RequirePermissions(["system:read"])
RequireSystemWrite = RequirePermissions(["system:write"])

RequireAuditRead = RequirePermissions(["audit:read"])
RequireAuditExport = RequirePermissions(["audit:export"])

# Admin permission shortcuts
RequireAdminAccess = RequireAnyPermission([
    "users:read", "roles:read", "content:read", 
    "analytics:read", "system:read", "audit:read"
])

RequireSuperAdmin = RequirePermissions(["*"])  # Wildcard permission for super admin