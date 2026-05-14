"""
Moderation models for content moderation system.

This module defines database models for content moderation features including
reports, moderation actions, and audit logs.
"""

from datetime import datetime
from typing import Optional
from sqlalchemy import (
    Column, Integer, String, Text, DateTime, ForeignKey, Boolean,
    Enum as SQLEnum, Index, CheckConstraint
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.ext.declarative import declarative_base
import enum

from jidelnicek.core.database import Base


class ReportStatus(str, enum.Enum):
    """Status of content reports."""
    PENDING = "pending"
    INVESTIGATING = "investigating"
    RESOLVED = "resolved"
    DISMISSED = "dismissed"
    ESCALATED = "escalated"


class ReportReason(str, enum.Enum):
    """Reasons for reporting content."""
    SPAM = "spam"
    INAPPROPRIATE = "inappropriate"
    COPYRIGHT = "copyright"
    MISINFORMATION = "misinformation"
    OFFENSIVE = "offensive"
    OTHER = "other"


class ModerationAction(str, enum.Enum):
    """Types of moderation actions."""
    REMOVE = "remove"
    HIDE = "hide"
    FLAG = "flag"
    WARN = "warn"
    BAN = "ban"
    UNBAN = "unban"
    EDIT = "edit"
    RESTORE = "restore"
    REJECT = "reject"
    DELETE = "delete"


class ContentType(str, enum.Enum):
    """Types of content that can be moderated."""
    RECIPE = "recipe"
    COMMENT = "comment"
    IMAGE = "image"
    REVIEW = "review"
    USER_PROFILE = "user_profile"


class ModerationStatus(str, enum.Enum):
    """Status of moderation."""
    PENDING = "pending"
    IN_REVIEW = "in_review"
    APPROVED = "approved"
    REJECTED = "rejected"
    DISMISSED = "dismissed"


class SanctionType(str, enum.Enum):
    """Types of user sanctions."""
    WARNING = "warning"
    TEMPORARY_BAN = "temporary_ban"
    PERMANENT_BAN = "permanent_ban"
    CONTENT_REMOVAL = "content_removal"


class AppealStatus(str, enum.Enum):
    """Status of user appeals."""
    PENDING = "pending"
    IN_REVIEW = "in_review"
    APPROVED = "approved"
    REJECTED = "rejected"


class ContentReport(Base):
    """Model for user reports on content."""
    
    __tablename__ = "content_reports"
    
    id = Column(Integer, primary_key=True)
    
    # Content being reported
    content_type = Column(String(50), nullable=False)  # 'recipe', 'review', 'comment', etc.
    content_id = Column(Integer, nullable=False)
    content_url = Column(String(255))  # Optional URL to content
    
    # Reporter information
    reporter_id = Column(UUID(as_uuid=True), ForeignKey("auth_users.id"), nullable=False)
    reporter = relationship("AuthUser", foreign_keys=[reporter_id], backref="reports_made")
    
    # Report details
    reason = Column(SQLEnum(ReportReason), nullable=False)
    description = Column(Text)
    
    # Processing status
    status = Column(SQLEnum(ReportStatus), default=ReportStatus.PENDING, nullable=False)
    priority = Column(Integer, default=0)  # Higher number = higher priority
    
    # Moderator handling the report
    assigned_to_id = Column(UUID(as_uuid=True), ForeignKey("auth_users.id"))
    assigned_to = relationship("AuthUser", foreign_keys=[assigned_to_id], backref="assigned_reports")
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    resolved_at = Column(DateTime)
    
    # Resolution details
    resolution_notes = Column(Text)
    action_taken = Column(SQLEnum(ModerationAction))
    
    # Indexes for performance
    __table_args__ = (
        Index("idx_content_reports_status", "status"),
        Index("idx_content_reports_content", "content_type", "content_id"),
        Index("idx_content_reports_reporter", "reporter_id"),
        Index("idx_content_reports_assigned", "assigned_to_id"),
        Index("idx_content_reports_created", "created_at"),
        CheckConstraint("priority >= 0", name="check_priority_non_negative"),
    )
    
    def __repr__(self):
        return f"<ContentReport(id={self.id}, content={self.content_type}:{self.content_id}, status={self.status})>"


class ModerationLog(Base):
    """Audit log for all moderation actions."""
    
    __tablename__ = "moderation_logs"
    
    id = Column(Integer, primary_key=True)
    
    # Who performed the action
    moderator_id = Column(UUID(as_uuid=True), ForeignKey("auth_users.id"), nullable=False)
    moderator = relationship("AuthUser", foreign_keys=[moderator_id], backref="moderation_actions")
    
    # What action was taken
    action = Column(SQLEnum(ModerationAction), nullable=False)
    
    # Target of the action
    target_type = Column(String(50), nullable=False)  # 'user', 'recipe', 'review', etc.
    target_id = Column(Integer, nullable=False)
    
    # Related report (if applicable)
    report_id = Column(Integer, ForeignKey("content_reports.id"))
    report = relationship("ContentReport", backref="moderation_logs")
    
    # Details
    reason = Column(Text, nullable=False)
    details = Column(Text)  # Additional context or changes made
    
    # Reversal information
    reversed = Column(Boolean, default=False)
    reversed_by_id = Column(UUID(as_uuid=True), ForeignKey("auth_users.id"))
    reversed_by = relationship("AuthUser", foreign_keys=[reversed_by_id])
    reversed_at = Column(DateTime)
    reversal_reason = Column(Text)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    # Indexes
    __table_args__ = (
        Index("idx_moderation_logs_moderator", "moderator_id"),
        Index("idx_moderation_logs_target", "target_type", "target_id"),
        Index("idx_moderation_logs_report", "report_id"),
        Index("idx_moderation_logs_created", "created_at"),
        Index("idx_moderation_logs_action", "action"),
    )
    
    def __repr__(self):
        return f"<ModerationLog(id={self.id}, action={self.action}, target={self.target_type}:{self.target_id})>"


class AutoModerationRule(Base):
    """Rules for automatic content moderation."""
    
    __tablename__ = "auto_moderation_rules"
    
    id = Column(Integer, primary_key=True)
    
    # Rule details
    name = Column(String(100), nullable=False, unique=True)
    description = Column(Text)
    
    # Rule configuration
    content_type = Column(String(50))  # Optional: specific content type
    rule_type = Column(String(50), nullable=False)  # 'keyword', 'pattern', 'threshold'
    rule_config = Column(Text, nullable=False)  # JSON configuration
    
    # Action to take
    action = Column(SQLEnum(ModerationAction), nullable=False)
    severity = Column(Integer, default=1)  # 1-10 scale
    
    # Status
    enabled = Column(Boolean, default=True)
    
    # Statistics
    matches_count = Column(Integer, default=0)
    false_positives = Column(Integer, default=0)
    
    # Audit
    created_by_id = Column(UUID(as_uuid=True), ForeignKey("auth_users.id"), nullable=False)
    created_by = relationship("AuthUser", foreign_keys=[created_by_id])
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Indexes
    __table_args__ = (
        Index("idx_auto_moderation_rules_enabled", "enabled"),
        Index("idx_auto_moderation_rules_content_type", "content_type"),
        CheckConstraint("severity >= 1 AND severity <= 10", name="check_severity_range"),
    )
    
    def __repr__(self):
        return f"<AutoModerationRule(id={self.id}, name={self.name}, enabled={self.enabled})>"


class BannedContent(Base):
    """Track banned or flagged content patterns."""
    
    __tablename__ = "banned_content"
    
    id = Column(Integer, primary_key=True)
    
    # Pattern details
    pattern_type = Column(String(50), nullable=False)  # 'keyword', 'domain', 'email', 'ip'
    pattern_value = Column(String(255), nullable=False)
    
    # Reason and context
    reason = Column(Text, nullable=False)
    severity = Column(Integer, default=5)  # 1-10 scale
    
    # Status
    active = Column(Boolean, default=True)
    
    # Audit
    added_by_id = Column(UUID(as_uuid=True), ForeignKey("auth_users.id"), nullable=False)
    added_by = relationship("AuthUser", foreign_keys=[added_by_id])
    added_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    # Expiration (optional)
    expires_at = Column(DateTime)
    
    # Indexes
    __table_args__ = (
        Index("idx_banned_content_pattern", "pattern_type", "pattern_value"),
        Index("idx_banned_content_active", "active"),
        Index("idx_banned_content_expires", "expires_at"),
        CheckConstraint("severity >= 1 AND severity <= 10", name="check_banned_severity_range"),
    )
    
    def __repr__(self):
        return f"<BannedContent(id={self.id}, type={self.pattern_type}, value={self.pattern_value[:20]}...)>"


class ModerationQueue(Base):
    """Queue for content awaiting moderation."""
    
    __tablename__ = "moderation_queue"
    
    id = Column(Integer, primary_key=True)
    
    # Content to moderate
    content_type = Column(String(50), nullable=False)
    content_id = Column(Integer, nullable=False)
    
    # Why it's in the queue
    reason = Column(Text, nullable=False)
    auto_flagged = Column(Boolean, default=False)
    rule_id = Column(Integer, ForeignKey("auto_moderation_rules.id"))
    rule = relationship("AutoModerationRule")
    
    # Priority and assignment
    priority = Column(Integer, default=0)
    assigned_to_id = Column(UUID(as_uuid=True), ForeignKey("auth_users.id"))
    assigned_to = relationship("AuthUser")
    
    # Status
    reviewed = Column(Boolean, default=False)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    reviewed_at = Column(DateTime)
    
    # Indexes
    __table_args__ = (
        Index("idx_moderation_queue_content", "content_type", "content_id"),
        Index("idx_moderation_queue_reviewed", "reviewed"),
        Index("idx_moderation_queue_priority", "priority"),
        Index("idx_moderation_queue_created", "created_at"),
        CheckConstraint("priority >= 0", name="check_queue_priority_non_negative"),
    )
    
    def __repr__(self):
        return f"<ModerationQueue(id={self.id}, content={self.content_type}:{self.content_id}, reviewed={self.reviewed})>"


# Alias for backward compatibility
ModerationActionLog = ModerationLog


class UserSanction(Base):
    """Model for user sanctions."""
    __tablename__ = "user_sanctions"
    
    id = Column(Integer, primary_key=True)
    
    # User being sanctioned
    user_id = Column(UUID(as_uuid=True), ForeignKey("auth_users.id"), nullable=False)
    user = relationship("AuthUser", foreign_keys=[user_id])

    # Who issued the sanction
    issued_by_id = Column(UUID(as_uuid=True), ForeignKey("auth_users.id"), nullable=False)
    issued_by = relationship("AuthUser", foreign_keys=[issued_by_id])
    
    # Sanction details
    type = Column(SQLEnum(SanctionType), nullable=False)
    reason = Column(Text, nullable=False)
    
    # Status
    is_active = Column(Boolean, default=True)
    
    # Timing
    issued_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    expires_at = Column(DateTime)
    lifted_at = Column(DateTime)
    lifted_by = Column(UUID(as_uuid=True), ForeignKey("auth_users.id"))
    lift_reason = Column(Text)
    
    def __repr__(self):
        return f"<UserSanction(id={self.id}, user_id={self.user_id}, type={self.type}, active={self.is_active})>"


class UserAppeal(Base):
    """Model for user appeals of sanctions."""
    __tablename__ = "user_appeals"
    
    id = Column(Integer, primary_key=True)
    
    # User making the appeal
    user_id = Column(UUID(as_uuid=True), ForeignKey("auth_users.id"), nullable=False)
    user = relationship("AuthUser", foreign_keys=[user_id])
    
    # Sanction being appealed
    sanction_id = Column(Integer, ForeignKey("user_sanctions.id"), nullable=False)
    sanction = relationship("UserSanction")
    
    # Appeal details
    reason = Column(Text, nullable=False)
    evidence = Column(Text)  # JSON data
    
    # Status
    status = Column(SQLEnum(AppealStatus), default=AppealStatus.PENDING)
    
    # Review
    reviewed_by = Column(UUID(as_uuid=True), ForeignKey("auth_users.id"))
    reviewer = relationship("AuthUser", foreign_keys=[reviewed_by])
    reviewed_at = Column(DateTime)
    decision = Column(Text)
    
    # Timing
    submitted_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    expires_at = Column(DateTime)
    
    def __repr__(self):
        return f"<UserAppeal(id={self.id}, user_id={self.user_id}, status={self.status})>"


class ModerationTemplate(Base):
    """Model for moderation response templates."""
    __tablename__ = "moderation_templates"
    
    id = Column(Integer, primary_key=True)
    
    # Template details
    name = Column(String(100), nullable=False)
    response_text = Column(Text, nullable=False)
    
    # Usage tracking
    usage_count = Column(Integer, default=0)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def __repr__(self):
        return f"<ModerationTemplate(id={self.id}, name={self.name})>"


class ContentFilter(Base):
    """Model for automated content filters."""
    __tablename__ = "content_filters"
    
    id = Column(Integer, primary_key=True)
    
    # Filter details
    name = Column(String(100), nullable=False)
    filter_type = Column(String(50), nullable=False)  # keyword, regex, etc.
    pattern = Column(Text, nullable=False)
    action = Column(SQLEnum(ModerationAction), nullable=False)
    severity = Column(Integer, default=5)
    
    # Status
    enabled = Column(Boolean, default=True)
    auto_report = Column(Boolean, default=False)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def __repr__(self):
        return f"<ContentFilter(id={self.id}, name={self.name}, type={self.filter_type})>"