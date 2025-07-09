"""
Moderation models for content review and management.

This module defines models for content moderation, including reports,
moderation actions, sanctions, and appeals.
"""

from datetime import datetime
from typing import List, Optional, Dict, Any
from enum import Enum
from sqlalchemy import (
    Column, String, Text, Integer, Boolean, DateTime, ForeignKey,
    Enum as SQLEnum, JSON, Index, UniqueConstraint, CheckConstraint
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from jidelnicek.common.database import Base


class ContentType(str, Enum):
    """Types of content that can be moderated."""
    RECIPE = "recipe"
    COMMENT = "comment"
    REVIEW = "review"
    USER_PROFILE = "user_profile"
    IMAGE = "image"


class ReportReason(str, Enum):
    """Reasons for reporting content."""
    SPAM = "spam"
    INAPPROPRIATE = "inappropriate"
    OFFENSIVE = "offensive"
    MISINFORMATION = "misinformation"
    COPYRIGHT = "copyright"
    PRIVACY = "privacy"
    OTHER = "other"


class ModerationStatus(str, Enum):
    """Status of moderation review."""
    PENDING = "pending"
    IN_REVIEW = "in_review"
    APPROVED = "approved"
    REJECTED = "rejected"
    ESCALATED = "escalated"
    AUTO_APPROVED = "auto_approved"
    AUTO_REJECTED = "auto_rejected"


class ModerationAction(str, Enum):
    """Actions that can be taken on content."""
    APPROVE = "approve"
    REJECT = "reject"
    DELETE = "delete"
    EDIT = "edit"
    HIDE = "hide"
    FLAG = "flag"
    ESCALATE = "escalate"


class SanctionType(str, Enum):
    """Types of user sanctions."""
    WARNING = "warning"
    TEMPORARY_BAN = "temporary_ban"
    PERMANENT_BAN = "permanent_ban"
    CONTENT_RESTRICTION = "content_restriction"
    RATE_LIMIT = "rate_limit"


class AppealStatus(str, Enum):
    """Status of user appeals."""
    PENDING = "pending"
    IN_REVIEW = "in_review"
    APPROVED = "approved"
    REJECTED = "rejected"
    EXPIRED = "expired"


class ContentReport(Base):
    """Model for content reports submitted by users."""
    
    __tablename__ = "content_reports"
    
    id = Column(Integer, primary_key=True, index=True)
    reporter_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    content_type = Column(SQLEnum(ContentType), nullable=False)
    content_id = Column(Integer, nullable=False)
    reason = Column(SQLEnum(ReportReason), nullable=False)
    description = Column(Text)
    priority_score = Column(Integer, default=0)  # Calculated based on various factors
    
    # Status tracking
    status = Column(SQLEnum(ModerationStatus), default=ModerationStatus.PENDING)
    assigned_to = Column(Integer, ForeignKey("users.id"))
    reviewed_at = Column(DateTime)
    resolution = Column(Text)
    
    # Timestamps
    created_at = Column(DateTime, default=func.now(), nullable=False)
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    
    # Relationships
    reporter = relationship("User", foreign_keys=[reporter_id], backref="submitted_reports")
    moderator = relationship("User", foreign_keys=[assigned_to], backref="assigned_reports")
    moderation_actions = relationship("ModerationActionLog", back_populates="report")
    
    # Indexes
    __table_args__ = (
        Index('idx_content_reports_status_priority', 'status', 'priority_score'),
        Index('idx_content_reports_content', 'content_type', 'content_id'),
        Index('idx_content_reports_reporter', 'reporter_id'),
        UniqueConstraint('reporter_id', 'content_type', 'content_id', 
                        name='uq_reporter_content'),
    )


class ModerationActionLog(Base):
    """Log of all moderation actions taken."""
    
    __tablename__ = "moderation_action_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    report_id = Column(Integer, ForeignKey("content_reports.id"))
    moderator_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    action = Column(SQLEnum(ModerationAction), nullable=False)
    
    # Content details
    content_type = Column(SQLEnum(ContentType), nullable=False)
    content_id = Column(Integer, nullable=False)
    
    # Action details
    reason = Column(Text)
    notes = Column(Text)
    metadata = Column(JSON)  # Additional action-specific data
    
    # Response template used (if any)
    template_id = Column(Integer, ForeignKey("moderation_templates.id"))
    
    # Timestamp
    created_at = Column(DateTime, default=func.now(), nullable=False)
    
    # Relationships
    report = relationship("ContentReport", back_populates="moderation_actions")
    moderator = relationship("User", foreign_keys=[moderator_id])
    template = relationship("ModerationTemplate")
    
    # Indexes
    __table_args__ = (
        Index('idx_moderation_logs_moderator', 'moderator_id'),
        Index('idx_moderation_logs_content', 'content_type', 'content_id'),
        Index('idx_moderation_logs_created', 'created_at'),
    )


class UserSanction(Base):
    """Sanctions applied to users for policy violations."""
    
    __tablename__ = "user_sanctions"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    issued_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # Sanction details
    type = Column(SQLEnum(SanctionType), nullable=False)
    reason = Column(Text, nullable=False)
    evidence = Column(JSON)  # Links to reports, content, etc.
    
    # Duration (null for permanent sanctions)
    starts_at = Column(DateTime, default=func.now(), nullable=False)
    expires_at = Column(DateTime)
    
    # Status
    is_active = Column(Boolean, default=True)
    lifted_at = Column(DateTime)
    lifted_by = Column(Integer, ForeignKey("users.id"))
    lift_reason = Column(Text)
    
    # Timestamps
    created_at = Column(DateTime, default=func.now(), nullable=False)
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    
    # Relationships
    user = relationship("User", foreign_keys=[user_id], backref="sanctions")
    issuer = relationship("User", foreign_keys=[issued_by])
    lifter = relationship("User", foreign_keys=[lifted_by])
    appeals = relationship("UserAppeal", back_populates="sanction")
    
    # Indexes
    __table_args__ = (
        Index('idx_user_sanctions_user_active', 'user_id', 'is_active'),
        Index('idx_user_sanctions_expires', 'expires_at'),
        CheckConstraint('expires_at IS NULL OR expires_at > starts_at', 
                       name='check_sanction_duration'),
    )


class UserAppeal(Base):
    """Appeals submitted by users against sanctions or moderation decisions."""
    
    __tablename__ = "user_appeals"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    sanction_id = Column(Integer, ForeignKey("user_sanctions.id"))
    
    # Appeal details
    reason = Column(Text, nullable=False)
    evidence = Column(JSON)  # Supporting documentation
    
    # Review process
    status = Column(SQLEnum(AppealStatus), default=AppealStatus.PENDING)
    reviewed_by = Column(Integer, ForeignKey("users.id"))
    reviewed_at = Column(DateTime)
    decision = Column(Text)
    
    # Timestamps
    created_at = Column(DateTime, default=func.now(), nullable=False)
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    expires_at = Column(DateTime)  # Appeal deadline
    
    # Relationships
    user = relationship("User", foreign_keys=[user_id], backref="appeals")
    sanction = relationship("UserSanction", back_populates="appeals")
    reviewer = relationship("User", foreign_keys=[reviewed_by])
    
    # Indexes
    __table_args__ = (
        Index('idx_user_appeals_status', 'status'),
        Index('idx_user_appeals_user', 'user_id'),
    )


class ModerationTemplate(Base):
    """Templates for common moderation responses."""
    
    __tablename__ = "moderation_templates"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, unique=True)
    category = Column(String(50), nullable=False)
    
    # Template content
    action = Column(SQLEnum(ModerationAction), nullable=False)
    response_text = Column(Text, nullable=False)
    internal_notes = Column(Text)
    
    # Usage tracking
    usage_count = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    
    # Metadata
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=func.now(), nullable=False)
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    
    # Relationships
    creator = relationship("User", foreign_keys=[created_by])
    
    # Indexes
    __table_args__ = (
        Index('idx_moderation_templates_category', 'category'),
        Index('idx_moderation_templates_action', 'action'),
    )


class ContentFilter(Base):
    """Automated content filtering rules."""
    
    __tablename__ = "content_filters"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, unique=True)
    description = Column(Text)
    
    # Filter configuration
    content_type = Column(SQLEnum(ContentType))  # Null for all types
    filter_type = Column(String(50), nullable=False)  # keyword, regex, ml_model
    pattern = Column(Text, nullable=False)
    
    # Action configuration
    action = Column(SQLEnum(ModerationAction), nullable=False)
    severity = Column(Integer, default=1)  # 1-10 scale
    auto_report = Column(Boolean, default=False)
    
    # Status
    is_active = Column(Boolean, default=True)
    effectiveness_score = Column(Integer, default=0)  # Based on accuracy
    
    # Metadata
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=func.now(), nullable=False)
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    
    # Relationships
    creator = relationship("User", foreign_keys=[created_by])
    
    # Indexes
    __table_args__ = (
        Index('idx_content_filters_type_active', 'content_type', 'is_active'),
    )


class ModerationQueue(Base):
    """Priority queue for content requiring moderation."""
    
    __tablename__ = "moderation_queue"
    
    id = Column(Integer, primary_key=True, index=True)
    content_type = Column(SQLEnum(ContentType), nullable=False)
    content_id = Column(Integer, nullable=False)
    
    # Priority and routing
    priority = Column(Integer, default=0, nullable=False)
    category = Column(String(50))  # For specialized routing
    auto_flagged = Column(Boolean, default=False)
    
    # Assignment
    assigned_to = Column(Integer, ForeignKey("users.id"))
    assigned_at = Column(DateTime)
    
    # Status
    status = Column(SQLEnum(ModerationStatus), default=ModerationStatus.PENDING)
    
    # Timestamps
    created_at = Column(DateTime, default=func.now(), nullable=False)
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    
    # Relationships
    moderator = relationship("User", foreign_keys=[assigned_to])
    
    # Indexes
    __table_args__ = (
        Index('idx_moderation_queue_priority', 'status', 'priority'),
        Index('idx_moderation_queue_assigned', 'assigned_to', 'status'),
        UniqueConstraint('content_type', 'content_id', name='uq_queue_content'),
    )