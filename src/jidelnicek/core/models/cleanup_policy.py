"""
Models for cleanup policies and audit logging.

This module defines database models for managing file retention policies,
cleanup audit logs, and related tracking information.
"""

from sqlalchemy import (
    Column, Integer, String, DateTime, Text, JSON, Boolean,
    ForeignKey, Float, Date, Index, UniqueConstraint
)
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID as PostgresUUID
from sqlalchemy.sql import func
from datetime import datetime

from jidelnicek.core.database import Base


class CleanupPolicy(Base):
    """
    Model for defining file cleanup policies.
    
    This model stores configurable retention policies for different
    types of files, allowing flexible cleanup management.
    """
    
    __tablename__ = "cleanup_policies"
    
    # Primary key
    id = Column(Integer, primary_key=True, index=True)
    
    # Policy identification
    name = Column(String(100), unique=True, nullable=False)
    description = Column(Text)
    file_type = Column(String(50), nullable=False, index=True)  # shopping_list, trip_data, recipes, dataset
    
    # Retention settings
    retention_days = Column(Integer, nullable=False, default=7)
    grace_period_hours = Column(Integer, default=24)  # Hours before permanent deletion
    
    # File pattern matching
    file_pattern = Column(String(255))  # Regex pattern for file matching
    min_file_size = Column(Integer, default=0)  # Minimum file size to consider (bytes)
    max_file_size = Column(Integer)  # Maximum file size to consider (bytes)
    
    # Storage location
    storage_location = Column(String(50), default="local")  # local, s3, azure
    
    # User preferences
    allow_user_override = Column(Boolean, default=True)
    min_retention_days = Column(Integer, default=1)
    max_retention_days = Column(Integer, default=365)
    
    # Notification settings
    notify_before_deletion = Column(Boolean, default=True)
    notification_hours_before = Column(Integer, default=24)
    
    # Policy status
    is_active = Column(Boolean, default=True)
    priority = Column(Integer, default=0)  # Higher priority policies are applied first
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    audit_logs = relationship("CleanupAuditLog", back_populates="policy")
    
    # Constraints
    __table_args__ = (
        UniqueConstraint("file_type", "storage_location", name="uix_file_type_storage"),
        Index("idx_policy_active_priority", "is_active", "priority"),
    )
    
    def __repr__(self):
        return f"<CleanupPolicy(id={self.id}, name={self.name}, file_type={self.file_type})>"


class CleanupAuditLog(Base):
    """
    Model for tracking file cleanup activities.
    
    This model maintains an audit trail of all file deletions,
    including the reason, timing, and any recovery attempts.
    """
    
    __tablename__ = "cleanup_audit_logs"
    
    # Primary key
    id = Column(Integer, primary_key=True, index=True)
    
    # File information
    file_path = Column(String(500), nullable=False)
    file_type = Column(String(50), nullable=False, index=True)
    file_size = Column(Integer, nullable=False)  # bytes
    file_hash = Column(String(64))  # SHA256 hash for recovery verification
    
    # Deletion information
    deletion_reason = Column(String(255), nullable=False)
    deleted_at = Column(DateTime(timezone=True), nullable=False, index=True)
    deleted = Column(Boolean, default=True)  # False if deletion was cancelled
    
    # Policy association
    policy_id = Column(Integer, ForeignKey("cleanup_policies.id"))
    policy = relationship("CleanupPolicy", back_populates="audit_logs")
    
    # User association
    user_id = Column(PostgresUUID(as_uuid=True), ForeignKey("auth_users.id"), index=True)
    user = relationship("AuthUser", backref="cleanup_audit_logs")
    
    # Recovery information
    recovered = Column(Boolean, default=False)
    recovery_info = Column(JSON)  # Store recovery path, timestamp, etc.
    
    # Metadata
    file_metadata = Column(JSON, default=dict)  # Additional information about the file
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Indexes
    __table_args__ = (
        Index("idx_audit_user_deleted", "user_id", "deleted_at"),
        Index("idx_audit_file_type_deleted", "file_type", "deleted_at"),
    )
    
    def __repr__(self):
        return f"<CleanupAuditLog(id={self.id}, file_path={self.file_path}, deleted_at={self.deleted_at})>"


class CleanupStatistics(Base):
    """
    Model for storing aggregated cleanup statistics.
    
    This model tracks daily cleanup activities for reporting
    and monitoring purposes.
    """
    
    __tablename__ = "cleanup_statistics"
    
    # Primary key
    id = Column(Integer, primary_key=True, index=True)
    
    # Date for statistics
    date = Column(Date, unique=True, nullable=False, index=True)
    
    # Aggregated statistics
    files_deleted = Column(Integer, default=0)
    total_size_freed = Column(Integer, default=0)  # bytes
    errors_count = Column(Integer, default=0)
    
    # By type statistics
    by_type_stats = Column(JSON, default=dict)  # {file_type: {count, size}}
    
    # Storage statistics
    local_files_deleted = Column(Integer, default=0)
    cloud_files_deleted = Column(Integer, default=0)
    
    # Performance metrics
    cleanup_duration_seconds = Column(Float)
    average_file_size = Column(Float)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    def __repr__(self):
        return f"<CleanupStatistics(date={self.date}, files_deleted={self.files_deleted})>"


class DeletionQueue(Base):
    """
    Model for queuing files for deletion after grace period.
    
    This model tracks files that are scheduled for deletion,
    allowing for a grace period during which users can recover them.
    """
    
    __tablename__ = "deletion_queue"
    
    # Primary key
    id = Column(Integer, primary_key=True, index=True)
    
    # File information
    file_path = Column(String(500), nullable=False)
    file_type = Column(String(50), nullable=False)
    file_size = Column(Integer)
    
    # Scheduling
    scheduled_deletion_time = Column(DateTime(timezone=True), nullable=False, index=True)
    grace_period_hours = Column(Integer, default=24)
    
    # User association
    user_id = Column(PostgresUUID(as_uuid=True), ForeignKey("auth_users.id"), nullable=False, index=True)
    user = relationship("AuthUser", backref="deletion_queue")
    
    # Audit log reference
    audit_log_id = Column(Integer, ForeignKey("cleanup_audit_logs.id"))
    audit_log = relationship("CleanupAuditLog", backref="deletion_queue_entry")
    
    # Status
    notification_sent = Column(Boolean, default=False)
    notification_sent_at = Column(DateTime(timezone=True))
    processed = Column(Boolean, default=False)
    processed_at = Column(DateTime(timezone=True))
    cancelled = Column(Boolean, default=False)
    cancellation_reason = Column(String(255))
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Indexes
    __table_args__ = (
        Index("idx_queue_scheduled_processed", "scheduled_deletion_time", "processed"),
        Index("idx_queue_user_scheduled", "user_id", "scheduled_deletion_time"),
    )
    
    def __repr__(self):
        return f"<DeletionQueue(id={self.id}, file_path={self.file_path}, scheduled={self.scheduled_deletion_time})>"


class UserCleanupPreference(Base):
    """
    Model for storing user-specific cleanup preferences.
    
    This model allows users to customize their file retention
    settings within allowed limits.
    """
    
    __tablename__ = "user_cleanup_preferences"
    
    # Primary key
    id = Column(Integer, primary_key=True, index=True)
    
    # User association
    user_id = Column(PostgresUUID(as_uuid=True), ForeignKey("auth_users.id"), unique=True, nullable=False)
    user = relationship("AuthUser", backref="cleanup_preferences")
    
    # File type preferences
    shopping_list_retention_days = Column(Integer)
    trip_data_retention_days = Column(Integer)
    recipe_export_retention_days = Column(Integer)
    dataset_export_retention_days = Column(Integer)
    
    # Notification preferences
    enable_deletion_notifications = Column(Boolean, default=True)
    notification_email = Column(String(255))
    notification_lead_time_hours = Column(Integer, default=24)
    
    # Recovery preferences
    auto_backup_before_deletion = Column(Boolean, default=False)
    backup_location = Column(String(50))  # local, cloud
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    def __repr__(self):
        return f"<UserCleanupPreference(user_id={self.user_id})>"