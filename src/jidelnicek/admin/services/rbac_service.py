"""
RBAC (Role-Based Access Control) service for managing roles and permissions.

This service provides comprehensive functionality for:
- Role management (CRUD, hierarchy, inheritance)
- Permission management and checking
- User-role assignments with expiration
- Permission delegation
- Caching for performance
- Audit logging
"""

from typing import List, Optional, Dict, Set, Any
from datetime import datetime, timezone, timedelta
from uuid import UUID
import json
import logging

from sqlalchemy import select, and_, or_, delete, update, func
from sqlalchemy.orm import selectinload, joinedload
from sqlalchemy.ext.asyncio import AsyncSession
from redis.asyncio import Redis

from jidelnicek.auth.models import AuthUser
from jidelnicek.admin.models.rbac import (
    Role, Permission, UserRoleAssignment, PermissionDelegation,
    role_permissions, user_roles, PermissionCategory
)
from jidelnicek.admin.services.audit_service import AuditService
from jidelnicek.core.cache import cache_result, invalidate_cache

logger = logging.getLogger(__name__)


class RBACService:
    """Service for managing roles, permissions, and access control."""
    
    # Cache configuration
    CACHE_TTL = 3600  # 1 hour
    PERMISSION_CACHE_PREFIX = "rbac:user_permissions:"
    ROLE_CACHE_PREFIX = "rbac:user_roles:"
    
    # Predefined system roles
    SYSTEM_ROLES = {
        "super_admin": {
            "name": "Super Administrator",
            "description": "Full system access with all permissions",
            "priority": 1000,
            "permissions": ["*"]  # Special wildcard for all permissions
        },
        "admin": {
            "name": "Administrator",
            "description": "Administrative access with most permissions",
            "priority": 900,
            "parent": "super_admin"
        },
        "content_moderator": {
            "name": "Content Moderator",
            "description": "Can moderate user-generated content",
            "priority": 500,
            "permissions": [
                "content:read", "content:write", "content:delete",
                "moderation:read", "moderation:write",
                "users:read", "analytics:read"
            ]
        },
        "support": {
            "name": "Support Staff",
            "description": "Can view user data and help with issues",
            "priority": 400,
            "permissions": [
                "users:read", "content:read", "analytics:read",
                "audit:read", "settings:read"
            ]
        },
        "analyst": {
            "name": "Data Analyst",
            "description": "Can view analytics and generate reports",
            "priority": 300,
            "permissions": [
                "analytics:read", "analytics:export",
                "users:read", "content:read"
            ]
        }
    }
    
    # Predefined permissions
    SYSTEM_PERMISSIONS = {
        # User management
        "users:read": {"name": "View Users", "category": PermissionCategory.USERS},
        "users:write": {"name": "Edit Users", "category": PermissionCategory.USERS},
        "users:delete": {"name": "Delete Users", "category": PermissionCategory.USERS},
        "users:export": {"name": "Export User Data", "category": PermissionCategory.USERS},
        
        # Role management
        "roles:read": {"name": "View Roles", "category": PermissionCategory.ROLES},
        "roles:write": {"name": "Manage Roles", "category": PermissionCategory.ROLES},
        "roles:assign": {"name": "Assign Roles", "category": PermissionCategory.ROLES},
        "roles:delete": {"name": "Delete Roles", "category": PermissionCategory.ROLES},
        
        # Content management
        "content:read": {"name": "View Content", "category": PermissionCategory.CONTENT},
        "content:write": {"name": "Edit Content", "category": PermissionCategory.CONTENT},
        "content:delete": {"name": "Delete Content", "category": PermissionCategory.CONTENT},
        "content:publish": {"name": "Publish Content", "category": PermissionCategory.CONTENT},
        
        # Recipe management
        "recipes:read": {"name": "View Recipes", "category": PermissionCategory.RECIPES},
        "recipes:write": {"name": "Edit Recipes", "category": PermissionCategory.RECIPES},
        "recipes:delete": {"name": "Delete Recipes", "category": PermissionCategory.RECIPES},
        "recipes:approve": {"name": "Approve Recipes", "category": PermissionCategory.RECIPES},
        
        # Ingredient management
        "ingredients:read": {"name": "View Ingredients", "category": PermissionCategory.INGREDIENTS},
        "ingredients:write": {"name": "Edit Ingredients", "category": PermissionCategory.INGREDIENTS},
        "ingredients:delete": {"name": "Delete Ingredients", "category": PermissionCategory.INGREDIENTS},
        "ingredients:approve": {"name": "Approve Ingredients", "category": PermissionCategory.INGREDIENTS},
        
        # Moderation
        "moderation:read": {"name": "View Moderation Queue", "category": PermissionCategory.MODERATION},
        "moderation:write": {"name": "Moderate Content", "category": PermissionCategory.MODERATION},
        "moderation:override": {"name": "Override Moderation", "category": PermissionCategory.MODERATION},
        
        # Analytics
        "analytics:read": {"name": "View Analytics", "category": PermissionCategory.ANALYTICS},
        "analytics:export": {"name": "Export Analytics", "category": PermissionCategory.ANALYTICS},
        "analytics:admin": {"name": "Admin Analytics", "category": PermissionCategory.ANALYTICS},
        
        # System
        "system:read": {"name": "View System Info", "category": PermissionCategory.SYSTEM},
        "system:write": {"name": "Manage System", "category": PermissionCategory.SYSTEM},
        "system:maintenance": {"name": "System Maintenance", "category": PermissionCategory.SYSTEM},
        
        # Audit
        "audit:read": {"name": "View Audit Logs", "category": PermissionCategory.AUDIT},
        "audit:export": {"name": "Export Audit Logs", "category": PermissionCategory.AUDIT},
        "audit:delete": {"name": "Delete Audit Logs", "category": PermissionCategory.AUDIT},
        
        # Settings
        "settings:read": {"name": "View Settings", "category": PermissionCategory.SETTINGS},
        "settings:write": {"name": "Manage Settings", "category": PermissionCategory.SETTINGS},
    }
    
    def __init__(self, db: AsyncSession, redis_client: Optional[Redis] = None):
        """Initialize RBAC service."""
        self.db = db
        self.redis = redis_client
        self.audit_service = AuditService(db)
    
    # Permission checking methods
    
    async def check_permission(
        self,
        user: AuthUser,
        permission: str,
        resource_id: Optional[UUID] = None
    ) -> bool:
        """
        Check if user has a specific permission.
        
        Args:
            user: User to check
            permission: Permission code (e.g., "users:read")
            resource_id: Optional resource ID for resource-specific checks
        
        Returns:
            True if user has permission
        """
        # Get user's permissions (cached)
        user_permissions = await self.get_user_permissions(user.id)
        
        # Check for wildcard permission (super admin)
        if "*" in user_permissions:
            return True
        
        # Check specific permission
        if permission in user_permissions:
            return True
        
        # Check delegated permissions
        delegated = await self.get_delegated_permissions(user.id)
        if permission in delegated:
            return True
        
        return False
    
    async def check_permissions(
        self,
        user: AuthUser,
        permissions: List[str],
        require_all: bool = True
    ) -> bool:
        """
        Check if user has multiple permissions.
        
        Args:
            user: User to check
            permissions: List of permission codes
            require_all: If True, user must have all permissions. If False, any permission is sufficient.
        
        Returns:
            True if user has required permissions
        """
        user_permissions = await self.get_user_permissions(user.id)
        
        # Super admin has all permissions
        if "*" in user_permissions:
            return True
        
        # Add delegated permissions
        delegated = await self.get_delegated_permissions(user.id)
        all_permissions = user_permissions.union(delegated)
        
        if require_all:
            return all(perm in all_permissions for perm in permissions)
        else:
            return any(perm in all_permissions for perm in permissions)
    
    async def get_user_permissions(self, user_id: UUID) -> Set[str]:
        """
        Get all permissions for a user (with caching).
        
        Args:
            user_id: User ID
        
        Returns:
            Set of permission codes
        """
        # Check cache first
        if self.redis:
            cache_key = f"{self.PERMISSION_CACHE_PREFIX}{user_id}"
            cached = await self.redis.get(cache_key)
            if cached:
                return set(json.loads(cached))
        
        # Get user's roles with permissions
        query = (
            select(Role)
            .join(user_roles, user_roles.c.role_id == Role.id)
            .where(
                and_(
                    user_roles.c.user_id == user_id,
                    Role.is_active == True,
                    or_(
                        user_roles.c.expires_at.is_(None),
                        user_roles.c.expires_at > datetime.now(timezone.utc)
                    )
                )
            )
            .options(selectinload(Role.permissions))
        )
        
        result = await self.db.execute(query)
        roles = result.scalars().all()
        
        # Collect all permissions including inherited ones
        permissions = set()
        for role in roles:
            # Get direct permissions
            for perm in role.permissions:
                if perm.is_active:
                    permissions.add(perm.code)
            
            # Get inherited permissions
            current_parent = role.parent
            while current_parent:
                parent_result = await self.db.execute(
                    select(Role)
                    .where(Role.id == current_parent.id)
                    .options(selectinload(Role.permissions))
                )
                parent_role = parent_result.scalar_one_or_none()
                if parent_role:
                    for perm in parent_role.permissions:
                        if perm.is_active:
                            permissions.add(perm.code)
                    current_parent = parent_role.parent
                else:
                    break
        
        # Cache the result
        if self.redis:
            cache_key = f"{self.PERMISSION_CACHE_PREFIX}{user_id}"
            await self.redis.setex(
                cache_key,
                self.CACHE_TTL,
                json.dumps(list(permissions))
            )
        
        return permissions
    
    async def get_delegated_permissions(self, user_id: UUID) -> Set[str]:
        """Get permissions delegated to a user."""
        query = (
            select(PermissionDelegation)
            .where(
                and_(
                    PermissionDelegation.delegate_id == user_id,
                    PermissionDelegation.revoked_at.is_(None),
                    PermissionDelegation.starts_at <= datetime.now(timezone.utc),
                    PermissionDelegation.expires_at > datetime.now(timezone.utc)
                )
            )
        )
        
        result = await self.db.execute(query)
        delegations = result.scalars().all()
        
        permissions = set()
        for delegation in delegations:
            permissions.update(delegation.permissions)
        
        return permissions
    
    # Role management methods
    
    async def create_role(
        self,
        code: str,
        name: str,
        description: Optional[str] = None,
        parent_id: Optional[UUID] = None,
        permissions: Optional[List[str]] = None,
        priority: int = 0,
        max_users: Optional[int] = None,
        created_by: Optional[UUID] = None
    ) -> Role:
        """Create a new role."""
        # Check if role already exists
        existing = await self.db.execute(
            select(Role).where(Role.code == code.lower())
        )
        if existing.scalar_one_or_none():
            raise ValueError(f"Role with code '{code}' already exists")
        
        # Create role
        role = Role(
            code=code.lower(),
            name=name,
            description=description,
            parent_id=parent_id,
            priority=priority,
            max_users=max_users,
            created_by=created_by
        )
        
        # Add permissions
        if permissions:
            perm_query = select(Permission).where(Permission.code.in_(permissions))
            result = await self.db.execute(perm_query)
            role.permissions = list(result.scalars().all())
        
        self.db.add(role)
        await self.db.commit()
        await self.db.refresh(role)
        
        # Audit log
        await self.audit_service.log_admin_action(
            user_id=created_by,
            action="role_created",
            resource_type="role",
            resource_id=role.id,
            details={"code": role.code, "name": role.name}
        )
        
        return role
    
    async def update_role(
        self,
        role_id: UUID,
        name: Optional[str] = None,
        description: Optional[str] = None,
        parent_id: Optional[UUID] = None,
        permissions: Optional[List[str]] = None,
        priority: Optional[int] = None,
        max_users: Optional[int] = None,
        is_active: Optional[bool] = None,
        updated_by: Optional[UUID] = None
    ) -> Role:
        """Update an existing role."""
        # Get role
        result = await self.db.execute(
            select(Role).where(Role.id == role_id)
        )
        role = result.scalar_one_or_none()
        if not role:
            raise ValueError(f"Role {role_id} not found")
        
        # Check if system role
        if role.is_system:
            # Limited updates for system roles
            if name or parent_id is not None:
                raise ValueError("Cannot modify system role structure")
        
        # Update fields
        if name is not None:
            role.name = name
        if description is not None:
            role.description = description
        if parent_id is not None:
            # Check for circular dependencies
            if parent_id == role_id:
                raise ValueError("Role cannot be its own parent")
            role.parent_id = parent_id
        if priority is not None:
            role.priority = priority
        if max_users is not None:
            role.max_users = max_users
        if is_active is not None:
            role.is_active = is_active
        
        # Update permissions
        if permissions is not None:
            perm_query = select(Permission).where(Permission.code.in_(permissions))
            result = await self.db.execute(perm_query)
            role.permissions = list(result.scalars().all())
        
        await self.db.commit()
        await self.db.refresh(role)
        
        # Invalidate caches for all users with this role
        await self._invalidate_role_caches(role_id)
        
        # Audit log
        await self.audit_service.log_admin_action(
            user_id=updated_by,
            action="role_updated",
            resource_type="role",
            resource_id=role.id,
            details={"code": role.code, "changes": "role updated"}
        )
        
        return role
    
    async def delete_role(self, role_id: UUID, deleted_by: Optional[UUID] = None) -> bool:
        """Delete a role (if not system role)."""
        # Get role
        result = await self.db.execute(
            select(Role).where(Role.id == role_id)
        )
        role = result.scalar_one_or_none()
        if not role:
            return False
        
        # Check if system role
        if role.is_system:
            raise ValueError("Cannot delete system role")
        
        # Check if role has users
        user_count = await self.db.execute(
            select(func.count())
            .select_from(user_roles)
            .where(user_roles.c.role_id == role_id)
        )
        if user_count.scalar() > 0:
            raise ValueError("Cannot delete role with assigned users")
        
        # Delete role
        await self.db.delete(role)
        await self.db.commit()
        
        # Audit log
        await self.audit_service.log_admin_action(
            user_id=deleted_by,
            action="role_deleted",
            resource_type="role",
            resource_id=role_id,
            details={"code": role.code, "name": role.name}
        )
        
        return True
    
    async def get_role(self, role_id: UUID) -> Optional[Role]:
        """Get a role by ID."""
        result = await self.db.execute(
            select(Role)
            .where(Role.id == role_id)
            .options(
                selectinload(Role.permissions),
                selectinload(Role.parent),
                selectinload(Role.children)
            )
        )
        return result.scalar_one_or_none()
    
    async def get_role_by_code(self, code: str) -> Optional[Role]:
        """Get a role by code."""
        result = await self.db.execute(
            select(Role)
            .where(Role.code == code.lower())
            .options(
                selectinload(Role.permissions),
                selectinload(Role.parent)
            )
        )
        return result.scalar_one_or_none()
    
    async def list_roles(
        self,
        is_active: Optional[bool] = None,
        include_permissions: bool = True
    ) -> List[Role]:
        """List all roles."""
        query = select(Role)
        
        if is_active is not None:
            query = query.where(Role.is_active == is_active)
        
        if include_permissions:
            query = query.options(selectinload(Role.permissions))
        
        query = query.order_by(Role.priority.desc(), Role.name)
        
        result = await self.db.execute(query)
        return list(result.scalars().all())
    
    # User-role assignment methods
    
    async def assign_role(
        self,
        user_id: UUID,
        role_id: UUID,
        assigned_by: UUID,
        expires_at: Optional[datetime] = None,
        reason: Optional[str] = None
    ) -> UserRoleAssignment:
        """Assign a role to a user."""
        # Check if role exists and is active
        role = await self.get_role(role_id)
        if not role or not role.is_active:
            raise ValueError("Invalid or inactive role")
        
        # Check max users limit
        if role.max_users:
            current_count = await self.db.execute(
                select(func.count())
                .select_from(user_roles)
                .where(
                    and_(
                        user_roles.c.role_id == role_id,
                        or_(
                            user_roles.c.expires_at.is_(None),
                            user_roles.c.expires_at > datetime.now(timezone.utc)
                        )
                    )
                )
            )
            if current_count.scalar() >= role.max_users:
                raise ValueError(f"Role has reached maximum user limit ({role.max_users})")
        
        # Check if assignment already exists
        existing = await self.db.execute(
            select(UserRoleAssignment)
            .where(
                and_(
                    UserRoleAssignment.user_id == user_id,
                    UserRoleAssignment.role_id == role_id,
                    UserRoleAssignment.is_active == True,
                    UserRoleAssignment.revoked_at.is_(None)
                )
            )
        )
        if existing.scalar_one_or_none():
            raise ValueError("User already has this role")
        
        # Create assignment
        assignment = UserRoleAssignment(
            user_id=user_id,
            role_id=role_id,
            assigned_by=assigned_by,
            expires_at=expires_at,
            reason=reason
        )
        
        self.db.add(assignment)
        
        # Also add to association table
        await self.db.execute(
            user_roles.insert().values(
                user_id=user_id,
                role_id=role_id,
                assigned_by=assigned_by,
                expires_at=expires_at
            )
        )
        
        await self.db.commit()
        await self.db.refresh(assignment)
        
        # Invalidate user's permission cache
        await self._invalidate_user_caches(user_id)
        
        # Audit log
        await self.audit_service.log_admin_action(
            user_id=assigned_by,
            action="role_assigned",
            resource_type="user",
            resource_id=user_id,
            details={
                "role_id": str(role_id),
                "role_code": role.code,
                "expires_at": expires_at.isoformat() if expires_at else None,
                "reason": reason
            }
        )
        
        return assignment
    
    async def revoke_role(
        self,
        user_id: UUID,
        role_id: UUID,
        revoked_by: UUID,
        reason: Optional[str] = None
    ) -> bool:
        """Revoke a role from a user."""
        # Find active assignment
        result = await self.db.execute(
            select(UserRoleAssignment)
            .where(
                and_(
                    UserRoleAssignment.user_id == user_id,
                    UserRoleAssignment.role_id == role_id,
                    UserRoleAssignment.is_active == True,
                    UserRoleAssignment.revoked_at.is_(None)
                )
            )
        )
        assignment = result.scalar_one_or_none()
        
        if not assignment:
            return False
        
        # Revoke assignment
        assignment.revoked_by = revoked_by
        assignment.revoked_at = datetime.now(timezone.utc)
        assignment.revoke_reason = reason
        assignment.is_active = False
        
        # Remove from association table
        await self.db.execute(
            delete(user_roles)
            .where(
                and_(
                    user_roles.c.user_id == user_id,
                    user_roles.c.role_id == role_id
                )
            )
        )
        
        await self.db.commit()
        
        # Invalidate user's permission cache
        await self._invalidate_user_caches(user_id)
        
        # Audit log
        await self.audit_service.log_admin_action(
            user_id=revoked_by,
            action="role_revoked",
            resource_type="user",
            resource_id=user_id,
            details={
                "role_id": str(role_id),
                "reason": reason
            }
        )
        
        return True
    
    async def get_user_roles(self, user_id: UUID) -> List[Role]:
        """Get all active roles for a user."""
        query = (
            select(Role)
            .join(user_roles, user_roles.c.role_id == Role.id)
            .where(
                and_(
                    user_roles.c.user_id == user_id,
                    Role.is_active == True,
                    or_(
                        user_roles.c.expires_at.is_(None),
                        user_roles.c.expires_at > datetime.now(timezone.utc)
                    )
                )
            )
            .options(selectinload(Role.permissions))
            .order_by(Role.priority.desc())
        )
        
        result = await self.db.execute(query)
        return list(result.scalars().all())
    
    # Permission delegation methods
    
    async def delegate_permissions(
        self,
        delegator_id: UUID,
        delegate_id: UUID,
        permissions: List[str],
        expires_at: datetime,
        reason: str
    ) -> PermissionDelegation:
        """Delegate permissions to another user."""
        # Verify delegator has all permissions being delegated
        delegator_perms = await self.get_user_permissions(delegator_id)
        if not all(perm in delegator_perms or "*" in delegator_perms for perm in permissions):
            raise ValueError("Cannot delegate permissions you don't have")
        
        # Create delegation
        delegation = PermissionDelegation(
            delegator_id=delegator_id,
            delegate_id=delegate_id,
            permissions=permissions,
            expires_at=expires_at,
            reason=reason
        )
        
        self.db.add(delegation)
        await self.db.commit()
        await self.db.refresh(delegation)
        
        # Audit log
        await self.audit_service.log_admin_action(
            user_id=delegator_id,
            action="permissions_delegated",
            resource_type="user",
            resource_id=delegate_id,
            details={
                "permissions": permissions,
                "expires_at": expires_at.isoformat(),
                "reason": reason
            }
        )
        
        return delegation
    
    async def revoke_delegation(
        self,
        delegation_id: UUID,
        revoked_by: UUID,
        reason: Optional[str] = None
    ) -> bool:
        """Revoke a permission delegation."""
        result = await self.db.execute(
            select(PermissionDelegation)
            .where(PermissionDelegation.id == delegation_id)
        )
        delegation = result.scalar_one_or_none()
        
        if not delegation or delegation.revoked_at:
            return False
        
        # Only delegator or super admin can revoke
        revoker_perms = await self.get_user_permissions(revoked_by)
        if delegation.delegator_id != revoked_by and "*" not in revoker_perms:
            raise ValueError("Only delegator or super admin can revoke delegation")
        
        delegation.revoked_at = datetime.now(timezone.utc)
        delegation.revoke_reason = reason
        
        await self.db.commit()
        
        # Audit log
        await self.audit_service.log_admin_action(
            user_id=revoked_by,
            action="delegation_revoked",
            resource_type="delegation",
            resource_id=delegation_id,
            details={"reason": reason}
        )
        
        return True
    
    # Initialization methods
    
    async def initialize_system_roles_and_permissions(self) -> None:
        """Initialize system roles and permissions."""
        # Create permissions
        for code, data in self.SYSTEM_PERMISSIONS.items():
            existing = await self.db.execute(
                select(Permission).where(Permission.code == code)
            )
            if not existing.scalar_one_or_none():
                permission = Permission(
                    code=code,
                    name=data["name"],
                    category=data["category"],
                    description=data.get("description"),
                    is_active=True
                )
                self.db.add(permission)
        
        await self.db.commit()
        
        # Create roles
        role_map = {}
        for code, data in self.SYSTEM_ROLES.items():
            existing = await self.db.execute(
                select(Role).where(Role.code == code)
            )
            if not existing.scalar_one_or_none():
                role = Role(
                    code=code,
                    name=data["name"],
                    description=data["description"],
                    priority=data["priority"],
                    is_system=True,
                    is_active=True
                )
                
                # Set parent if specified
                if "parent" in data and data["parent"] in role_map:
                    role.parent_id = role_map[data["parent"]].id
                
                # Add permissions
                if "permissions" in data:
                    if data["permissions"] == ["*"]:
                        # Super admin gets all permissions
                        all_perms = await self.db.execute(select(Permission))
                        role.permissions = list(all_perms.scalars().all())
                    else:
                        perm_query = select(Permission).where(
                            Permission.code.in_(data["permissions"])
                        )
                        perms = await self.db.execute(perm_query)
                        role.permissions = list(perms.scalars().all())
                
                self.db.add(role)
                await self.db.commit()
                await self.db.refresh(role)
                role_map[code] = role
        
        logger.info("System roles and permissions initialized")
    
    # Cache management
    
    async def _invalidate_user_caches(self, user_id: UUID) -> None:
        """Invalidate all caches for a user."""
        if self.redis:
            await self.redis.delete(
                f"{self.PERMISSION_CACHE_PREFIX}{user_id}",
                f"{self.ROLE_CACHE_PREFIX}{user_id}"
            )
    
    async def _invalidate_role_caches(self, role_id: UUID) -> None:
        """Invalidate caches for all users with a specific role."""
        if self.redis:
            # Get all users with this role
            result = await self.db.execute(
                select(user_roles.c.user_id)
                .where(user_roles.c.role_id == role_id)
            )
            user_ids = [row[0] for row in result]
            
            # Invalidate their caches
            for user_id in user_ids:
                await self._invalidate_user_caches(user_id)