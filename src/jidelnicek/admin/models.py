"""
Admin-specific models for Jidelnicek 2.0.

This module defines database models specific to administrative functionality,
including enhanced audit logging for admin actions.
"""

from datetime import datetime
from typing import Optional, Dict, Any
from uuid import UUID
from enum import Enum

from sqlalchemy import (
    Column, String, Integer, DateTime, JSON, ForeignKey, 
    Index, text, Boolean, Enum as SQLEnum
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import relationship, Mapped, mapped_column

from jidelnicek.core.database import Base
from jidelnicek.core.utils import get_utc_now


class AdminAction(str, Enum):
    """Enumeration of admin actions for audit logging."""
    # User management
    USER_VIEW = "user_view"
    USER_LIST = "user_list"
    USER_CREATE = "user_create"
    USER_UPDATE = "user_update"
    USER_DELETE = "user_delete"
    USER_SUSPEND = "user_suspend"
    USER_ACTIVATE = "user_activate"
    USER_RESET_PASSWORD = "user_reset_password"
    USER_FORCE_LOGOUT = "user_force_logout"
    USER_EXPORT = "user_export"
    
    # Bulk operations
    BULK_SUSPEND = "bulk_suspend"
    BULK_ACTIVATE = "bulk_activate"
    BULK_DELETE = "bulk_delete"
    BULK_EXPORT = "bulk_export"
    
    # System operations
    SYSTEM_CONFIG_VIEW = "system_config_view"
    SYSTEM_CONFIG_UPDATE = "system_config_update"
    AUDIT_LOG_VIEW = "audit_log_view"
    AUDIT_LOG_EXPORT = "audit_log_export"
    
    # Data management
    DATA_CLEANUP = "data_cleanup"
    DATA_EXPORT = "data_export"
    DATA_IMPORT = "data_import"


class AdminAuditLog(Base):
    """
    Enhanced audit log for administrative actions.
    
    Tracks all administrative operations with detailed context,
    including before/after states for critical changes.
    """
    __tablename__ = "admin_audit_log"
    
    # Primary key
    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), 
        primary_key=True, 
        server_default=text("gen_random_uuid()")
    )
    
    # Admin user who performed the action
    admin_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("auth_users.id", ondelete="SET NULL"),
        nullable=False,
        index=True
    )
    
    # Action details
    action: Mapped[AdminAction] = mapped_column(
        SQLEnum(AdminAction),
        nullable=False,
        index=True
    )
    
    # Target of the action
    target_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        index=True
    )
    target_id: Mapped[Optional[UUID]] = mapped_column(
        PG_UUID(as_uuid=True),
        index=True
    )
    target_ids: Mapped[Optional[list[str]]] = mapped_column(
        JSON  # For bulk operations
    )
    
    # Change tracking
    before_state: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON)
    after_state: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON)
    changes: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON)
    
    # Request context
    ip_address: Mapped[Optional[str]] = mapped_column(String(45))
    user_agent: Mapped[Optional[str]] = mapped_column(String(500))
    request_id: Mapped[Optional[str]] = mapped_column(String(100))
    
    # Additional context
    reason: Mapped[Optional[str]] = mapped_column(String(500))
    metadata: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON)
    
    # Result tracking
    success: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False
    )
    error_message: Mapped[Optional[str]] = mapped_column(String(1000))
    
    # Timestamp
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=get_utc_now,
        nullable=False,
        index=True
    )
    
    # Relationships
    admin: Mapped["AuthUser"] = relationship(
        "AuthUser",
        foreign_keys=[admin_id],
        lazy="select"
    )
    
    # Indexes for common queries
    __table_args__ = (
        Index('idx_admin_audit_admin_action', 'admin_id', 'action'),
        Index('idx_admin_audit_target', 'target_type', 'target_id'),
        Index('idx_admin_audit_created_at', 'created_at'),
    )
    
    def __repr__(self):
        return f"<AdminAuditLog(id={self.id}, admin_id={self.admin_id}, action={self.action})>"


class AdminNotification(Base):
    """
    Notifications for administrative events.
    
    Used to notify admins of important system events or user actions
    that may require attention.
    """
    __tablename__ = "admin_notifications"
    
    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), 
        primary_key=True, 
        server_default=text("gen_random_uuid()")
    )
    
    # Notification details
    type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        index=True
    )
    severity: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="info",
        index=True
    )
    
    # Content
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    message: Mapped[str] = mapped_column(String(1000), nullable=False)
    
    # Related entities
    related_type: Mapped[Optional[str]] = mapped_column(String(50))
    related_id: Mapped[Optional[UUID]] = mapped_column(PG_UUID(as_uuid=True))
    
    # Metadata
    metadata: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON)
    
    # Status
    is_read: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
        index=True
    )
    read_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    read_by: Mapped[Optional[UUID]] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("auth_users.id", ondelete="SET NULL")
    )
    
    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=get_utc_now,
        nullable=False,
        index=True
    )
    expires_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        index=True
    )
    
    def __repr__(self):
        return f"<AdminNotification(id={self.id}, type={self.type}, severity={self.severity})>"