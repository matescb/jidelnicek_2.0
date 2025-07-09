"""
Role-Based Access Control (RBAC) models for Jidelnicek 2.0 admin.

This module defines database models for:
- Roles with hierarchical structure
- Permissions with granular control
- Role-Permission mappings
- User-Role assignments
- Permission delegation and temporary elevation
"""

from datetime import datetime, timezone
from typing import Optional, List, TYPE_CHECKING
from uuid import UUID
from enum import Enum

from sqlalchemy import (
    Boolean, Column, DateTime, String, Integer, ForeignKey,
    CheckConstraint, UniqueConstraint, text, Index, JSON,
    Table, and_, or_
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import relationship, Mapped, mapped_column, validates
from sqlalchemy.ext.hybrid import hybrid_property

from jidelnicek.core.database import Base
from jidelnicek.core.utils import get_utc_now

if TYPE_CHECKING:
    from jidelnicek.auth.models import AuthUser


# Association table for many-to-many relationship between roles and permissions
role_permissions = Table(
    'admin_role_permissions',
    Base.metadata,
    Column('role_id', PG_UUID(as_uuid=True), ForeignKey('admin_roles.id', ondelete='CASCADE'), primary_key=True),
    Column('permission_id', PG_UUID(as_uuid=True), ForeignKey('admin_permissions.id', ondelete='CASCADE'), primary_key=True),
    Column('created_at', DateTime(timezone=True), default=get_utc_now, nullable=False),
    Index('idx_role_permissions_role_id', 'role_id'),
    Index('idx_role_permissions_permission_id', 'permission_id')
)


# Association table for user-role assignments
user_roles = Table(
    'admin_user_roles',
    Base.metadata,
    Column('user_id', PG_UUID(as_uuid=True), ForeignKey('auth_users.id', ondelete='CASCADE'), primary_key=True),
    Column('role_id', PG_UUID(as_uuid=True), ForeignKey('admin_roles.id', ondelete='CASCADE'), primary_key=True),
    Column('assigned_at', DateTime(timezone=True), default=get_utc_now, nullable=False),
    Column('assigned_by', PG_UUID(as_uuid=True), ForeignKey('auth_users.id', ondelete='SET NULL')),
    Column('expires_at', DateTime(timezone=True)),  # For temporary role assignments
    Index('idx_user_roles_user_id', 'user_id'),
    Index('idx_user_roles_role_id', 'role_id'),
    Index('idx_user_roles_expires_at', 'expires_at')
)


class PermissionCategory(str, Enum):
    """Categories for organizing permissions."""
    USERS = "users"
    ROLES = "roles"
    CONTENT = "content"
    RECIPES = "recipes"
    INGREDIENTS = "ingredients"
    MODERATION = "moderation"
    ANALYTICS = "analytics"
    SYSTEM = "system"
    AUDIT = "audit"
    SETTINGS = "settings"


class Permission(Base):
    """
    Permission model for granular access control.
    
    Permissions follow the format: category:action
    Examples: users:read, users:write, users:delete, roles:assign
    """
    __tablename__ = "admin_permissions"
    
    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()")
    )
    
    # Permission identifier (e.g., "users:read")
    code: Mapped[str] = mapped_column(
        String(100),
        unique=True,
        nullable=False,
        index=True
    )
    
    # Human-readable name
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    
    # Description of what this permission allows
    description: Mapped[Optional[str]] = mapped_column(String(500))
    
    # Category for organization
    category: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        index=True
    )
    
    # Whether this permission is active
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False
    )
    
    # Audit fields
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=get_utc_now,
        nullable=False
    )
    
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=get_utc_now,
        onupdate=get_utc_now,
        nullable=False
    )
    
    # Relationships
    roles: Mapped[List["Role"]] = relationship(
        "Role",
        secondary=role_permissions,
        back_populates="permissions",
        lazy="select"
    )
    
    __table_args__ = (
        CheckConstraint(
            f"category IN {tuple(cat.value for cat in PermissionCategory)}",
            name="check_permission_category"
        ),
    )
    
    def __repr__(self):
        return f"<Permission(code={self.code}, name={self.name})>"


class Role(Base):
    """
    Role model with hierarchical support.
    
    Roles can inherit permissions from parent roles and can be
    assigned to users with optional expiration times.
    """
    __tablename__ = "admin_roles"
    
    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()")
    )
    
    # Role identifier (e.g., "super_admin", "content_moderator")
    code: Mapped[str] = mapped_column(
        String(50),
        unique=True,
        nullable=False,
        index=True
    )
    
    # Human-readable name
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    
    # Description of role responsibilities
    description: Mapped[Optional[str]] = mapped_column(String(500))
    
    # Role hierarchy - parent role
    parent_id: Mapped[Optional[UUID]] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("admin_roles.id", ondelete="SET NULL")
    )
    
    # Priority for role hierarchy (higher = more privileged)
    priority: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False
    )
    
    # Whether this role is a system role (cannot be deleted)
    is_system: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False
    )
    
    # Whether this role is active
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False
    )
    
    # Maximum number of users that can have this role (null = unlimited)
    max_users: Mapped[Optional[int]] = mapped_column(Integer)
    
    # Audit fields
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=get_utc_now,
        nullable=False
    )
    
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=get_utc_now,
        onupdate=get_utc_now,
        nullable=False
    )
    
    created_by: Mapped[Optional[UUID]] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("auth_users.id", ondelete="SET NULL")
    )
    
    # Relationships
    permissions: Mapped[List["Permission"]] = relationship(
        "Permission",
        secondary=role_permissions,
        back_populates="roles",
        lazy="select"
    )
    
    parent: Mapped[Optional["Role"]] = relationship(
        "Role",
        remote_side=[id],
        backref="children",
        lazy="select"
    )
    
    # Users with this role (through association table)
    users: Mapped[List["AuthUser"]] = relationship(
        "AuthUser",
        secondary=user_roles,
        backref="admin_roles",
        lazy="select",
        viewonly=True
    )
    
    @hybrid_property
    def all_permissions(self) -> List[Permission]:
        """Get all permissions including inherited ones."""
        permissions = set(self.permissions)
        
        # Add inherited permissions
        current = self.parent
        while current:
            permissions.update(current.permissions)
            current = current.parent
        
        return list(permissions)
    
    @validates('code')
    def validate_code(self, key, code):
        """Ensure role code is lowercase and valid."""
        if not code:
            raise ValueError("Role code cannot be empty")
        return code.lower().replace(' ', '_')
    
    def __repr__(self):
        return f"<Role(code={self.code}, name={self.name})>"


class UserRoleAssignment(Base):
    """
    Model for tracking user-role assignments with audit information.
    
    This provides more detailed tracking than the association table,
    including who assigned the role and when it expires.
    """
    __tablename__ = "admin_user_role_assignments"
    
    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()")
    )
    
    # User and role
    user_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("auth_users.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    
    role_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("admin_roles.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    
    # Assignment details
    assigned_by: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("auth_users.id", ondelete="SET NULL"),
        nullable=False
    )
    
    assigned_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=get_utc_now,
        nullable=False
    )
    
    # For temporary assignments
    expires_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        index=True
    )
    
    # Reason for assignment (audit trail)
    reason: Mapped[Optional[str]] = mapped_column(String(500))
    
    # Revocation details
    revoked_by: Mapped[Optional[UUID]] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("auth_users.id", ondelete="SET NULL")
    )
    
    revoked_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    
    revoke_reason: Mapped[Optional[str]] = mapped_column(String(500))
    
    # Status
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
        index=True
    )
    
    # Relationships
    user: Mapped["AuthUser"] = relationship(
        "AuthUser",
        foreign_keys=[user_id],
        lazy="select"
    )
    
    role: Mapped["Role"] = relationship(
        "Role",
        lazy="select"
    )
    
    assigned_by_user: Mapped["AuthUser"] = relationship(
        "AuthUser",
        foreign_keys=[assigned_by],
        lazy="select"
    )
    
    @hybrid_property
    def is_expired(self) -> bool:
        """Check if assignment has expired."""
        if not self.expires_at:
            return False
        return datetime.now(timezone.utc) > self.expires_at
    
    @hybrid_property
    def is_valid(self) -> bool:
        """Check if assignment is currently valid."""
        return self.is_active and not self.is_expired
    
    __table_args__ = (
        UniqueConstraint(
            'user_id', 'role_id',
            name='uq_user_role_assignment',
            postgresql_where=text('is_active = true AND revoked_at IS NULL')
        ),
        Index('idx_user_role_assignments_valid', 'user_id', 'role_id', 
              postgresql_where=text('is_active = true AND revoked_at IS NULL'))
    )
    
    def __repr__(self):
        return f"<UserRoleAssignment(user_id={self.user_id}, role_id={self.role_id}, is_valid={self.is_valid})>"


class PermissionDelegation(Base):
    """
    Model for temporary permission delegation.
    
    Allows users to delegate specific permissions to other users
    for a limited time period.
    """
    __tablename__ = "admin_permission_delegations"
    
    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()")
    )
    
    # Delegator and delegate
    delegator_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("auth_users.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    
    delegate_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("auth_users.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    
    # Permissions being delegated (JSON array of permission codes)
    permissions: Mapped[List[str]] = mapped_column(
        JSON,
        nullable=False
    )
    
    # Delegation period
    starts_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=get_utc_now,
        nullable=False
    )
    
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        index=True
    )
    
    # Reason for delegation
    reason: Mapped[str] = mapped_column(String(500), nullable=False)
    
    # Revocation
    revoked_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    
    revoke_reason: Mapped[Optional[str]] = mapped_column(String(500))
    
    # Audit
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=get_utc_now,
        nullable=False
    )
    
    # Relationships
    delegator: Mapped["AuthUser"] = relationship(
        "AuthUser",
        foreign_keys=[delegator_id],
        lazy="select"
    )
    
    delegate: Mapped["AuthUser"] = relationship(
        "AuthUser",
        foreign_keys=[delegate_id],
        lazy="select"
    )
    
    @hybrid_property
    def is_active(self) -> bool:
        """Check if delegation is currently active."""
        now = datetime.now(timezone.utc)
        return (
            self.revoked_at is None and
            self.starts_at <= now <= self.expires_at
        )
    
    __table_args__ = (
        CheckConstraint('delegator_id != delegate_id', name='check_different_users'),
        CheckConstraint('expires_at > starts_at', name='check_valid_period'),
    )
    
    def __repr__(self):
        return f"<PermissionDelegation(delegator={self.delegator_id}, delegate={self.delegate_id}, active={self.is_active})>"