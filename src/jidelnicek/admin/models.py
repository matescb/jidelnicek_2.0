"""
Admin-specific models for Jidelnicek 2.0.

This module defines database models specific to administrative functionality,
including enhanced audit logging for admin actions.
"""

from datetime import datetime
from typing import Optional, Dict, Any, List
from uuid import UUID
from enum import Enum

from sqlalchemy import (
    Column, String, Integer, DateTime, JSON, ForeignKey, 
    Index, text, Boolean, Enum as SQLEnum, Text, Float, BigInteger
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
    
    # Ingredient management
    INGREDIENT_VIEW = "ingredient_view"
    INGREDIENT_LIST = "ingredient_list"
    INGREDIENT_CREATE = "ingredient_create"
    INGREDIENT_UPDATE = "ingredient_update"
    INGREDIENT_DELETE = "ingredient_delete"
    INGREDIENT_MERGE = "ingredient_merge"
    INGREDIENT_APPROVE = "ingredient_approve"
    INGREDIENT_REJECT = "ingredient_reject"
    INGREDIENT_BULK_IMPORT = "ingredient_bulk_import"
    INGREDIENT_BULK_EXPORT = "ingredient_bulk_export"
    INGREDIENT_QUALITY_CHECK = "ingredient_quality_check"


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
    action_metadata: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON)
    
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
    action_metadata: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON)
    
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


class IngredientModerationStatus(str, Enum):
    """Status for ingredient moderation."""
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    NEEDS_REVIEW = "needs_review"


class IngredientModeration(Base):
    """
    Moderation queue for user-submitted ingredients.
    
    Tracks ingredients that need admin approval before becoming global.
    """
    __tablename__ = "admin_ingredient_moderation"
    
    # Primary key
    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), 
        primary_key=True, 
        server_default=text("gen_random_uuid()")
    )
    
    # Ingredient being moderated
    ingredient_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("common_ingredients.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True
    )
    
    # Submission details
    submitted_by: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("auth_users.id", ondelete="SET NULL"),
        nullable=False,
        index=True
    )
    
    submitted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=get_utc_now,
        nullable=False,
        index=True
    )
    
    # Moderation status
    status: Mapped[IngredientModerationStatus] = mapped_column(
        SQLEnum(IngredientModerationStatus),
        default=IngredientModerationStatus.PENDING,
        nullable=False,
        index=True
    )
    
    # Review details
    reviewed_by: Mapped[Optional[UUID]] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("auth_users.id", ondelete="SET NULL"),
        index=True
    )
    
    reviewed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        index=True
    )
    
    # Review feedback
    review_notes: Mapped[Optional[str]] = mapped_column(String(1000))
    rejection_reason: Mapped[Optional[str]] = mapped_column(String(500))
    
    # Quality checks
    quality_score: Mapped[Optional[int]] = mapped_column(
        Integer,
        comment="Quality score 0-100"
    )
    quality_issues: Mapped[Optional[List[str]]] = mapped_column(JSON)
    
    # Suggested changes
    suggested_changes: Mapped[Optional[Dict[str, Any]]] = mapped_column(
        JSON,
        comment="Admin-suggested modifications"
    )
    
    # Auto-moderation results
    auto_check_passed: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False
    )
    auto_check_issues: Mapped[Optional[List[str]]] = mapped_column(JSON)
    
    # Priority for review
    priority: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
        index=True,
        comment="Higher priority = review sooner"
    )
    
    # Relationships
    ingredient: Mapped["Ingredient"] = relationship(
        "Ingredient",
        foreign_keys=[ingredient_id],
        lazy="select"
    )
    
    submitter: Mapped["AuthUser"] = relationship(
        "AuthUser",
        foreign_keys=[submitted_by],
        lazy="select"
    )
    
    reviewer: Mapped[Optional["AuthUser"]] = relationship(
        "AuthUser",
        foreign_keys=[reviewed_by],
        lazy="select"
    )
    
    # Indexes for common queries
    __table_args__ = (
        Index('idx_moderation_status_priority', 'status', 'priority'),
        Index('idx_moderation_submitted', 'submitted_at'),
    )
    
    def __repr__(self):
        return f"<IngredientModeration(id={self.id}, ingredient_id={self.ingredient_id}, status={self.status})>"


class AuditLogChecksum(Base):
    """
    Stores cryptographic checksums for audit log entries to ensure integrity.
    
    Each audit log entry has a corresponding checksum that is calculated
    from the log data and the previous checksum, creating a tamper-proof chain.
    """
    __tablename__ = "admin_audit_checksums"
    
    # Primary key - references the audit log entry
    audit_log_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("admin_audit_log.id", ondelete="CASCADE"),
        primary_key=True
    )
    
    # Checksum of the audit log entry data
    checksum: Mapped[str] = mapped_column(
        String(64),  # SHA-256 hash
        nullable=False,
        unique=True,
        index=True
    )
    
    # Reference to previous checksum for chain integrity
    previous_checksum: Mapped[Optional[str]] = mapped_column(
        String(64),
        index=True
    )
    
    # Sequence number for ordering
    sequence_number: Mapped[int] = mapped_column(
        BigInteger,
        nullable=False,
        unique=True,
        index=True
    )
    
    # Timestamp for checksum creation
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=get_utc_now,
        nullable=False
    )
    
    # Relationship to audit log
    audit_log: Mapped["AdminAuditLog"] = relationship(
        "AdminAuditLog",
        back_populates="checksum_record"
    )


class AuditLogArchive(Base):
    """
    Archive storage for old audit logs.
    
    Older audit logs are moved here for long-term storage while keeping
    the main audit table performant.
    """
    __tablename__ = "admin_audit_archive"
    
    # Same structure as AdminAuditLog
    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), 
        primary_key=True
    )
    
    admin_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        nullable=False,
        index=True
    )
    
    action: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        index=True
    )
    
    target_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        index=True
    )
    target_id: Mapped[Optional[UUID]] = mapped_column(
        PG_UUID(as_uuid=True),
        index=True
    )
    target_ids: Mapped[Optional[list[str]]] = mapped_column(JSON)
    
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
    action_metadata: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON)
    
    # Result tracking
    success: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False
    )
    error_message: Mapped[Optional[str]] = mapped_column(String(1000))
    
    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        index=True
    )
    
    # Archive metadata
    archived_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=get_utc_now,
        nullable=False,
        index=True
    )
    archive_reason: Mapped[str] = mapped_column(
        String(100),
        nullable=False
    )
    
    # Checksum for integrity
    checksum: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        unique=True
    )
    
    # Original admin email (denormalized for archive)
    admin_email: Mapped[str] = mapped_column(
        String(255),
        nullable=False
    )


class AuditAlert(Base):
    """
    Stores alerts generated by suspicious activity detection.
    
    The audit system can generate alerts based on patterns of admin activity
    that may indicate security issues or policy violations.
    """
    __tablename__ = "admin_audit_alerts"
    
    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), 
        primary_key=True, 
        server_default=text("gen_random_uuid()")
    )
    
    # Alert details
    alert_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        index=True
    )
    
    severity: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="medium",
        index=True
    )
    
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    
    # Related audit logs
    related_audit_logs: Mapped[List[str]] = mapped_column(
        JSON,  # List of audit log IDs
        default=list
    )
    
    # Admin involved
    admin_id: Mapped[Optional[UUID]] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("auth_users.id", ondelete="SET NULL"),
        index=True
    )
    
    # Detection metadata
    detection_metadata: Mapped[Dict[str, Any]] = mapped_column(
        JSON,
        default=dict
    )
    
    # Pattern that triggered the alert
    pattern_matched: Mapped[Optional[str]] = mapped_column(String(200))
    
    # Alert status
    status: Mapped[str] = mapped_column(
        String(20),
        default="new",
        nullable=False,
        index=True
    )
    
    acknowledged_by: Mapped[Optional[UUID]] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("auth_users.id", ondelete="SET NULL")
    )
    
    acknowledged_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True)
    )
    
    resolution_notes: Mapped[Optional[str]] = mapped_column(Text)
    
    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=get_utc_now,
        nullable=False,
        index=True
    )
    
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=get_utc_now,
        onupdate=get_utc_now,
        nullable=False
    )
    
    # Relationships
    admin: Mapped[Optional["AuthUser"]] = relationship(
        "AuthUser",
        foreign_keys=[admin_id],
        lazy="select"
    )
    
    acknowledger: Mapped[Optional["AuthUser"]] = relationship(
        "AuthUser",
        foreign_keys=[acknowledged_by],
        lazy="select"
    )


class AuditMetrics(Base):
    """
    Stores aggregated metrics about audit activity for performance monitoring.
    
    Pre-calculated metrics help with dashboard performance and trend analysis.
    """
    __tablename__ = "admin_audit_metrics"
    
    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), 
        primary_key=True, 
        server_default=text("gen_random_uuid()")
    )
    
    # Time period
    period_start: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        index=True
    )
    
    period_end: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        index=True
    )
    
    period_type: Mapped[str] = mapped_column(
        String(20),  # hour, day, week, month
        nullable=False,
        index=True
    )
    
    # Action counts by type
    action_counts: Mapped[Dict[str, int]] = mapped_column(
        JSON,
        default=dict
    )
    
    # Success/failure rates
    total_actions: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False
    )
    
    successful_actions: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False
    )
    
    failed_actions: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False
    )
    
    # Performance metrics
    avg_response_time_ms: Mapped[Optional[float]] = mapped_column(Float)
    max_response_time_ms: Mapped[Optional[float]] = mapped_column(Float)
    
    # Admin activity
    unique_admins: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False
    )
    
    admin_action_counts: Mapped[Dict[str, int]] = mapped_column(
        JSON,
        default=dict
    )
    
    # Target metrics
    target_type_counts: Mapped[Dict[str, int]] = mapped_column(
        JSON,
        default=dict
    )
    
    # Alert counts
    alerts_generated: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False
    )
    
    # Calculated at
    calculated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=get_utc_now,
        nullable=False
    )
    
    # Unique constraint on period
    __table_args__ = (
        Index(
            'idx_audit_metrics_period',
            'period_type', 'period_start', 'period_end',
            unique=True
        ),
    )


# Update AdminAuditLog to add relationship to checksum
AdminAuditLog.checksum_record = relationship(
    "AuditLogChecksum",
    back_populates="audit_log",
    uselist=False,
    cascade="all, delete-orphan"
)