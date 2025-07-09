"""
Role management API endpoints for admin interface.

This module provides endpoints for:
- Role CRUD operations
- Permission management
- User-role assignments
- Permission delegation
- Role hierarchy visualization
"""

from typing import List, Optional
from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from redis.asyncio import Redis

from jidelnicek.core.dependencies import get_db, get_redis_client
from jidelnicek.auth.dependencies.auth import CurrentAdminUser
from jidelnicek.auth.models import AuthUser
from jidelnicek.admin.services.rbac_service import RBACService
from jidelnicek.admin.models.rbac import Role, Permission, UserRoleAssignment, PermissionDelegation
from jidelnicek.admin.dependencies.rbac import RequirePermissions
from jidelnicek.core.schemas import PaginatedResponse
from pydantic import BaseModel, Field, ConfigDict

router = APIRouter(
    prefix="/admin/roles",
    tags=["admin-roles"],
    dependencies=[Depends(RequirePermissions(["roles:read"]))]
)


# Schemas

class PermissionResponse(BaseModel):
    """Permission response schema."""
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID
    code: str
    name: str
    description: Optional[str]
    category: str
    is_active: bool
    created_at: datetime
    updated_at: datetime


class RoleResponse(BaseModel):
    """Role response schema."""
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID
    code: str
    name: str
    description: Optional[str]
    parent_id: Optional[UUID]
    priority: int
    is_system: bool
    is_active: bool
    max_users: Optional[int]
    created_at: datetime
    updated_at: datetime
    permissions: List[PermissionResponse]
    user_count: Optional[int] = None


class CreateRoleRequest(BaseModel):
    """Create role request schema."""
    code: str = Field(..., min_length=3, max_length=50, pattern="^[a-z_]+$")
    name: str = Field(..., min_length=3, max_length=255)
    description: Optional[str] = Field(None, max_length=500)
    parent_id: Optional[UUID] = None
    permissions: List[str] = Field(default_factory=list)
    priority: int = Field(0, ge=0, le=999)
    max_users: Optional[int] = Field(None, ge=1)


class UpdateRoleRequest(BaseModel):
    """Update role request schema."""
    name: Optional[str] = Field(None, min_length=3, max_length=255)
    description: Optional[str] = Field(None, max_length=500)
    parent_id: Optional[UUID] = None
    permissions: Optional[List[str]] = None
    priority: Optional[int] = Field(None, ge=0, le=999)
    max_users: Optional[int] = Field(None, ge=1)
    is_active: Optional[bool] = None


class AssignRoleRequest(BaseModel):
    """Assign role request schema."""
    user_id: UUID
    role_id: UUID
    expires_at: Optional[datetime] = None
    reason: Optional[str] = Field(None, max_length=500)


class RevokeRoleRequest(BaseModel):
    """Revoke role request schema."""
    user_id: UUID
    role_id: UUID
    reason: Optional[str] = Field(None, max_length=500)


class UserRoleResponse(BaseModel):
    """User role assignment response."""
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID
    user_id: UUID
    role_id: UUID
    role: RoleResponse
    assigned_by: UUID
    assigned_at: datetime
    expires_at: Optional[datetime]
    reason: Optional[str]
    is_active: bool
    is_expired: bool
    is_valid: bool


class DelegatePermissionsRequest(BaseModel):
    """Delegate permissions request schema."""
    delegate_id: UUID
    permissions: List[str] = Field(..., min_items=1)
    expires_at: datetime
    reason: str = Field(..., min_length=10, max_length=500)


class PermissionDelegationResponse(BaseModel):
    """Permission delegation response."""
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID
    delegator_id: UUID
    delegate_id: UUID
    permissions: List[str]
    starts_at: datetime
    expires_at: datetime
    reason: str
    is_active: bool
    revoked_at: Optional[datetime]
    revoke_reason: Optional[str]


class RoleHierarchyNode(BaseModel):
    """Role hierarchy node for visualization."""
    id: UUID
    code: str
    name: str
    priority: int
    children: List["RoleHierarchyNode"] = []


# Endpoints

@router.get("/permissions", response_model=List[PermissionResponse])
async def list_permissions(
    category: Optional[str] = None,
    is_active: Optional[bool] = None,
    db: AsyncSession = Depends(get_db),
    current_user: AuthUser = Depends(CurrentAdminUser)
):
    """List all available permissions."""
    from sqlalchemy import select
    
    query = select(Permission)
    
    if category:
        query = query.where(Permission.category == category)
    if is_active is not None:
        query = query.where(Permission.is_active == is_active)
    
    query = query.order_by(Permission.category, Permission.code)
    
    result = await db.execute(query)
    permissions = result.scalars().all()
    
    return permissions


@router.get("/", response_model=PaginatedResponse[RoleResponse])
async def list_roles(
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=100),
    is_active: Optional[bool] = None,
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    redis_client: Optional[Redis] = Depends(get_redis_client),
    current_user: AuthUser = Depends(CurrentAdminUser)
):
    """List all roles with pagination."""
    from sqlalchemy import select, func, or_
    from sqlalchemy.orm import selectinload
    
    rbac_service = RBACService(db, redis_client)
    
    # Base query
    query = select(Role).options(selectinload(Role.permissions))
    count_query = select(func.count()).select_from(Role)
    
    # Filters
    if is_active is not None:
        query = query.where(Role.is_active == is_active)
        count_query = count_query.where(Role.is_active == is_active)
    
    if search:
        search_filter = or_(
            Role.code.ilike(f"%{search}%"),
            Role.name.ilike(f"%{search}%"),
            Role.description.ilike(f"%{search}%")
        )
        query = query.where(search_filter)
        count_query = count_query.where(search_filter)
    
    # Get total count
    total_result = await db.execute(count_query)
    total = total_result.scalar()
    
    # Get paginated results
    query = query.order_by(Role.priority.desc(), Role.name)
    query = query.offset(skip).limit(limit)
    
    result = await db.execute(query)
    roles = result.scalars().all()
    
    # Add user counts
    role_responses = []
    for role in roles:
        # Get user count for this role
        from jidelnicek.admin.models.rbac import user_roles
        user_count_query = select(func.count()).select_from(user_roles).where(
            user_roles.c.role_id == role.id
        )
        if is_active:
            user_count_query = user_count_query.where(
                or_(
                    user_roles.c.expires_at.is_(None),
                    user_roles.c.expires_at > datetime.utcnow()
                )
            )
        user_count_result = await db.execute(user_count_query)
        user_count = user_count_result.scalar()
        
        role_dict = {
            "id": role.id,
            "code": role.code,
            "name": role.name,
            "description": role.description,
            "parent_id": role.parent_id,
            "priority": role.priority,
            "is_system": role.is_system,
            "is_active": role.is_active,
            "max_users": role.max_users,
            "created_at": role.created_at,
            "updated_at": role.updated_at,
            "permissions": role.permissions,
            "user_count": user_count
        }
        role_responses.append(RoleResponse(**role_dict))
    
    return PaginatedResponse(
        items=role_responses,
        total=total,
        skip=skip,
        limit=limit
    )


@router.get("/hierarchy", response_model=List[RoleHierarchyNode])
async def get_role_hierarchy(
    db: AsyncSession = Depends(get_db),
    current_user: AuthUser = Depends(CurrentAdminUser)
):
    """Get role hierarchy tree structure."""
    rbac_service = RBACService(db, None)
    roles = await rbac_service.list_roles(is_active=True, include_permissions=False)
    
    # Build hierarchy
    role_map = {role.id: role for role in roles}
    roots = []
    
    def build_node(role: Role) -> RoleHierarchyNode:
        children = [
            build_node(child)
            for child in roles
            if child.parent_id == role.id
        ]
        return RoleHierarchyNode(
            id=role.id,
            code=role.code,
            name=role.name,
            priority=role.priority,
            children=sorted(children, key=lambda x: (-x.priority, x.name))
        )
    
    # Find root roles (no parent)
    for role in roles:
        if not role.parent_id:
            roots.append(build_node(role))
    
    return sorted(roots, key=lambda x: (-x.priority, x.name))


@router.get("/{role_id}", response_model=RoleResponse)
async def get_role(
    role_id: UUID,
    db: AsyncSession = Depends(get_db),
    redis_client: Optional[Redis] = Depends(get_redis_client),
    current_user: AuthUser = Depends(CurrentAdminUser)
):
    """Get a specific role by ID."""
    rbac_service = RBACService(db, redis_client)
    role = await rbac_service.get_role(role_id)
    
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Role not found"
        )
    
    return role


@router.post(
    "/",
    response_model=RoleResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(RequirePermissions(["roles:write"]))]
)
async def create_role(
    request: CreateRoleRequest,
    db: AsyncSession = Depends(get_db),
    redis_client: Optional[Redis] = Depends(get_redis_client),
    current_user: AuthUser = Depends(CurrentAdminUser)
):
    """Create a new role."""
    rbac_service = RBACService(db, redis_client)
    
    try:
        role = await rbac_service.create_role(
            code=request.code,
            name=request.name,
            description=request.description,
            parent_id=request.parent_id,
            permissions=request.permissions,
            priority=request.priority,
            max_users=request.max_users,
            created_by=current_user.id
        )
        return role
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.put(
    "/{role_id}",
    response_model=RoleResponse,
    dependencies=[Depends(RequirePermissions(["roles:write"]))]
)
async def update_role(
    role_id: UUID,
    request: UpdateRoleRequest,
    db: AsyncSession = Depends(get_db),
    redis_client: Optional[Redis] = Depends(get_redis_client),
    current_user: AuthUser = Depends(CurrentAdminUser)
):
    """Update an existing role."""
    rbac_service = RBACService(db, redis_client)
    
    try:
        role = await rbac_service.update_role(
            role_id=role_id,
            name=request.name,
            description=request.description,
            parent_id=request.parent_id,
            permissions=request.permissions,
            priority=request.priority,
            max_users=request.max_users,
            is_active=request.is_active,
            updated_by=current_user.id
        )
        return role
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.delete(
    "/{role_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(RequirePermissions(["roles:delete"]))]
)
async def delete_role(
    role_id: UUID,
    db: AsyncSession = Depends(get_db),
    redis_client: Optional[Redis] = Depends(get_redis_client),
    current_user: AuthUser = Depends(CurrentAdminUser)
):
    """Delete a role."""
    rbac_service = RBACService(db, redis_client)
    
    try:
        success = await rbac_service.delete_role(role_id, current_user.id)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Role not found"
            )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post(
    "/assign",
    response_model=UserRoleResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(RequirePermissions(["roles:assign"]))]
)
async def assign_role(
    request: AssignRoleRequest,
    db: AsyncSession = Depends(get_db),
    redis_client: Optional[Redis] = Depends(get_redis_client),
    current_user: AuthUser = Depends(CurrentAdminUser)
):
    """Assign a role to a user."""
    rbac_service = RBACService(db, redis_client)
    
    try:
        assignment = await rbac_service.assign_role(
            user_id=request.user_id,
            role_id=request.role_id,
            assigned_by=current_user.id,
            expires_at=request.expires_at,
            reason=request.reason
        )
        
        # Load role for response
        await db.refresh(assignment, ["role"])
        
        return assignment
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post(
    "/revoke",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(RequirePermissions(["roles:assign"]))]
)
async def revoke_role(
    request: RevokeRoleRequest,
    db: AsyncSession = Depends(get_db),
    redis_client: Optional[Redis] = Depends(get_redis_client),
    current_user: AuthUser = Depends(CurrentAdminUser)
):
    """Revoke a role from a user."""
    rbac_service = RBACService(db, redis_client)
    
    success = await rbac_service.revoke_role(
        user_id=request.user_id,
        role_id=request.role_id,
        revoked_by=current_user.id,
        reason=request.reason
    )
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Role assignment not found"
        )


@router.get("/users/{user_id}/roles", response_model=List[RoleResponse])
async def get_user_roles(
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
    redis_client: Optional[Redis] = Depends(get_redis_client),
    current_user: AuthUser = Depends(CurrentAdminUser)
):
    """Get all roles assigned to a user."""
    rbac_service = RBACService(db, redis_client)
    roles = await rbac_service.get_user_roles(user_id)
    return roles


@router.get("/users/{user_id}/permissions", response_model=List[str])
async def get_user_permissions(
    user_id: UUID,
    include_delegated: bool = Query(True),
    db: AsyncSession = Depends(get_db),
    redis_client: Optional[Redis] = Depends(get_redis_client),
    current_user: AuthUser = Depends(CurrentAdminUser)
):
    """Get all permissions for a user."""
    rbac_service = RBACService(db, redis_client)
    
    permissions = await rbac_service.get_user_permissions(user_id)
    
    if include_delegated:
        delegated = await rbac_service.get_delegated_permissions(user_id)
        permissions.update(delegated)
    
    return sorted(list(permissions))


@router.post(
    "/delegate",
    response_model=PermissionDelegationResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(RequirePermissions(["roles:assign"]))]
)
async def delegate_permissions(
    request: DelegatePermissionsRequest,
    db: AsyncSession = Depends(get_db),
    redis_client: Optional[Redis] = Depends(get_redis_client),
    current_user: AuthUser = Depends(CurrentAdminUser)
):
    """Delegate permissions to another user."""
    rbac_service = RBACService(db, redis_client)
    
    try:
        delegation = await rbac_service.delegate_permissions(
            delegator_id=current_user.id,
            delegate_id=request.delegate_id,
            permissions=request.permissions,
            expires_at=request.expires_at,
            reason=request.reason
        )
        return delegation
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.delete(
    "/delegations/{delegation_id}",
    status_code=status.HTTP_204_NO_CONTENT
)
async def revoke_delegation(
    delegation_id: UUID,
    reason: Optional[str] = Query(None, max_length=500),
    db: AsyncSession = Depends(get_db),
    redis_client: Optional[Redis] = Depends(get_redis_client),
    current_user: AuthUser = Depends(CurrentAdminUser)
):
    """Revoke a permission delegation."""
    rbac_service = RBACService(db, redis_client)
    
    try:
        success = await rbac_service.revoke_delegation(
            delegation_id=delegation_id,
            revoked_by=current_user.id,
            reason=reason
        )
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Delegation not found"
            )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e)
        )


@router.post(
    "/initialize",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(RequirePermissions(["system:write"]))]
)
async def initialize_rbac(
    db: AsyncSession = Depends(get_db),
    redis_client: Optional[Redis] = Depends(get_redis_client),
    current_user: AuthUser = Depends(CurrentAdminUser)
):
    """Initialize system roles and permissions."""
    rbac_service = RBACService(db, redis_client)
    await rbac_service.initialize_system_roles_and_permissions()


# Update model config to avoid recursion in RoleHierarchyNode
RoleHierarchyNode.model_rebuild()