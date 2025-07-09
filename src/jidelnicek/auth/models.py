"""
Authentication models for Jidelnicek 2.0.

This module defines all authentication-related database models including:
- Users with comprehensive security features
- Sessions with fingerprinting support
- Password reset and email verification tokens
- Audit logging for security events
"""

from datetime import datetime, timezone
from typing import Optional, List, TYPE_CHECKING
from uuid import UUID
import secrets
import hashlib

from sqlalchemy import (
    Boolean, Column, DateTime, String, Integer, ForeignKey, 
    CheckConstraint, UniqueConstraint, text, Index, JSON
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import relationship, Mapped, mapped_column, validates
from sqlalchemy.ext.hybrid import hybrid_property

from jidelnicek.core.database import Base
from jidelnicek.core.utils import get_utc_now

# Import for forward reference
if TYPE_CHECKING:
    from jidelnicek.trip.models import Trip, TripTemplate


class AuthUser(Base):
    """
    User model with comprehensive authentication and security features.
    
    Supports:
    - Email-based authentication with verification
    - Password management with bcrypt hashing
    - Account lockout after failed attempts
    - Role-based access control (user/admin)
    - User preferences and settings
    - Soft delete with archival
    """
    __tablename__ = "auth_users"
    
    # Primary key
    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), 
        primary_key=True, 
        server_default=text("gen_random_uuid()")
    )
    
    # Authentication fields
    email: Mapped[str] = mapped_column(
        String(255), 
        unique=True, 
        nullable=False,
        index=True
    )
    password_hash: Mapped[Optional[str]] = mapped_column(String(255))
    
    # Email verification
    email_verified: Mapped[bool] = mapped_column(
        Boolean, 
        default=False, 
        nullable=False
    )
    email_verified_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    verification_token: Mapped[Optional[str]] = mapped_column(String(255))
    
    # Password reset
    reset_token: Mapped[Optional[str]] = mapped_column(String(255))
    reset_token_expires: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    
    # Account security
    is_active: Mapped[bool] = mapped_column(
        Boolean, 
        default=True, 
        nullable=False
    )
    failed_login_attempts: Mapped[int] = mapped_column(
        Integer, 
        default=0, 
        nullable=False
    )
    locked_until: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    last_login: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    
    # User preferences
    language: Mapped[str] = mapped_column(
        String(2), 
        default='cs',
        nullable=False
    )
    unit_system: Mapped[str] = mapped_column(
        String(10), 
        default='metric',
        nullable=False
    )
    energy_unit: Mapped[str] = mapped_column(
        String(10), 
        default='kcal',
        nullable=False
    )
    has_pku: Mapped[bool] = mapped_column(
        Boolean, 
        default=False,
        nullable=False
    )
    timezone: Mapped[str] = mapped_column(
        String(50), 
        default='Europe/Prague',
        nullable=False
    )
    
    # Role and permissions
    role: Mapped[str] = mapped_column(
        String(20), 
        default='user',
        nullable=False
    )
    
    # Account management
    is_archived: Mapped[bool] = mapped_column(
        Boolean, 
        default=False,
        nullable=False,
        index=True
    )
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
    
    # Account limits
    recipe_count: Mapped[int] = mapped_column(
        Integer, 
        default=0,
        nullable=False
    )
    trip_count: Mapped[int] = mapped_column(
        Integer, 
        default=0,
        nullable=False
    )
    
    # Relationships
    sessions: Mapped[List["AuthSession"]] = relationship(
        "AuthSession",
        back_populates="user",
        cascade="all, delete-orphan",
        lazy="select",
        order_by="AuthSession.created_at.desc()",
        passive_deletes=True
    )
    
    api_tokens: Mapped[List["AuthToken"]] = relationship(
        "AuthToken",
        back_populates="user",
        cascade="all, delete-orphan",
        lazy="select",
        order_by="AuthToken.created_at.desc()",
        passive_deletes=True
    )
    
    password_reset_tokens: Mapped[List["AuthPasswordResetToken"]] = relationship(
        "AuthPasswordResetToken",
        back_populates="user",
        cascade="all, delete-orphan",
        lazy="select",
        order_by="AuthPasswordResetToken.created_at.desc()",
        passive_deletes=True
    )
    
    email_verification_tokens: Mapped[List["AuthEmailVerificationToken"]] = relationship(
        "AuthEmailVerificationToken",
        back_populates="user",
        cascade="all, delete-orphan",
        lazy="select",
        order_by="AuthEmailVerificationToken.created_at.desc()",
        passive_deletes=True
    )
    
    # Trip relationships
    trips: Mapped[List["Trip"]] = relationship(
        "Trip",
        back_populates="user",
        cascade="all, delete-orphan",
        lazy="select",
        order_by="Trip.created_at.desc()",
        passive_deletes=True,
        foreign_keys="Trip.user_id"
    )
    
    trip_templates: Mapped[List["TripTemplate"]] = relationship(
        "TripTemplate",
        back_populates="user",
        cascade="all, delete-orphan",
        lazy="select",
        order_by="TripTemplate.created_at.desc()",
        passive_deletes=True,
        foreign_keys="TripTemplate.user_id"
    )
    
    # Table constraints
    __table_args__ = (
        CheckConstraint("language IN ('en', 'cs')", name="check_language"),
        CheckConstraint("unit_system IN ('metric', 'imperial')", name="check_unit_system"),
        CheckConstraint("energy_unit IN ('kcal', 'kJ')", name="check_energy_unit"),
        CheckConstraint("role IN ('user', 'admin')", name="check_role"),
        Index('idx_auth_users_email_lower', text('lower(email)')),
    )
    
    @validates('email')
    def validate_email(self, key, email):
        """Normalize email to lowercase for consistency."""
        return email.lower() if email else email
    
    @hybrid_property
    def is_admin(self) -> bool:
        """Check if user has admin role."""
        return self.role == 'admin'
    
    @hybrid_property
    def is_locked(self) -> bool:
        """Check if account is currently locked."""
        if not self.locked_until:
            return False
        return datetime.now(timezone.utc) < self.locked_until
    
    def __repr__(self):
        return f"<AuthUser(id={self.id}, email={self.email}, role={self.role})>"


class AuthSession(Base):
    """
    Session model for JWT refresh token storage and session management.
    
    Features:
    - Secure token storage with hashing
    - Session fingerprinting (IP + User-Agent)
    - Expiration tracking
    - Session invalidation support
    """
    __tablename__ = "auth_sessions"
    
    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), 
        primary_key=True, 
        server_default=text("gen_random_uuid()")
    )
    
    # User relationship
    user_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("auth_users.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    
    # Token storage (hashed for security)
    token_hash: Mapped[str] = mapped_column(
        String(255), 
        unique=True, 
        nullable=False,
        index=True
    )
    
    # Session metadata
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), 
        nullable=False,
        index=True
    )
    ip_address: Mapped[Optional[str]] = mapped_column(String(45))  # IPv4/IPv6
    user_agent: Mapped[Optional[str]] = mapped_column(String(500))
    
    # Device information parsed from User-Agent
    device_name: Mapped[Optional[str]] = mapped_column(String(255))
    device_type: Mapped[Optional[str]] = mapped_column(String(50))  # desktop, mobile, tablet
    browser: Mapped[Optional[str]] = mapped_column(String(100))
    os: Mapped[Optional[str]] = mapped_column(String(100))
    
    # Location information (to be populated by IP geolocation)
    location: Mapped[Optional[str]] = mapped_column(String(255))  # City, Country
    
    # Session management
    is_valid: Mapped[bool] = mapped_column(
        Boolean, 
        default=True,
        nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), 
        default=get_utc_now,
        nullable=False
    )
    last_accessed: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), 
        default=get_utc_now,
        nullable=False
    )
    
    # Relationships
    user: Mapped["AuthUser"] = relationship(
        "AuthUser",
        back_populates="sessions",
        lazy="select"
    )
    
    @hybrid_property
    def is_expired(self) -> bool:
        """Check if session has expired."""
        return datetime.now(timezone.utc) > self.expires_at
    
    @hybrid_property
    def fingerprint(self) -> str:
        """Generate session fingerprint from IP and User-Agent."""
        data = f"{self.ip_address or ''}:{self.user_agent or ''}"
        return hashlib.sha256(data.encode()).hexdigest()
    
    def __repr__(self):
        return f"<AuthSession(id={self.id}, user_id={self.user_id}, expires_at={self.expires_at})>"


class AuthToken(Base):
    """
    API token model for long-lived authentication tokens.
    
    Used for:
    - Mobile app authentication
    - Third-party integrations
    - CLI access
    """
    __tablename__ = "auth_tokens"
    
    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), 
        primary_key=True, 
        server_default=text("gen_random_uuid()")
    )
    
    # User relationship
    user_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("auth_users.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    
    # Token details
    token_hash: Mapped[str] = mapped_column(
        String(255), 
        unique=True, 
        nullable=False,
        index=True
    )
    name: Mapped[Optional[str]] = mapped_column(String(100))
    
    # Usage tracking
    last_used: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    
    # Management
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), 
        default=get_utc_now,
        nullable=False
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean, 
        default=True,
        nullable=False
    )
    
    # Relationships
    user: Mapped["AuthUser"] = relationship(
        "AuthUser",
        back_populates="api_tokens",
        lazy="select"
    )
    
    def __repr__(self):
        return f"<AuthToken(id={self.id}, name={self.name}, user_id={self.user_id})>"


class AuthPasswordResetToken(Base):
    """
    Password reset token model with expiration and single-use enforcement.
    
    Features:
    - 1-hour expiration by default
    - Single-use enforcement
    - IP tracking for security
    """
    __tablename__ = "auth_password_reset_tokens"
    
    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), 
        primary_key=True, 
        server_default=text("gen_random_uuid()")
    )
    
    # User relationship
    user_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("auth_users.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    
    # Token details
    token: Mapped[str] = mapped_column(
        String(255), 
        unique=True, 
        nullable=False,
        index=True
    )
    
    # Security metadata
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), 
        nullable=False,
        index=True
    )
    used_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    request_ip: Mapped[Optional[str]] = mapped_column(String(45))  # IPv4/IPv6
    used_ip: Mapped[Optional[str]] = mapped_column(String(45))  # IPv4/IPv6
    
    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), 
        default=get_utc_now,
        nullable=False
    )
    
    # Relationships
    user: Mapped["AuthUser"] = relationship(
        "AuthUser",
        back_populates="password_reset_tokens",
        lazy="select"
    )
    
    @hybrid_property
    def is_expired(self) -> bool:
        """Check if token has expired."""
        return datetime.now(timezone.utc) > self.expires_at
    
    @hybrid_property
    def is_used(self) -> bool:
        """Check if token has been used."""
        return self.used_at is not None
    
    @hybrid_property
    def is_valid(self) -> bool:
        """Check if token is valid (not expired and not used)."""
        return not self.is_expired and not self.is_used
    
    def __repr__(self):
        return f"<AuthPasswordResetToken(id={self.id}, user_id={self.user_id}, expires_at={self.expires_at})>"


class AuthEmailVerificationToken(Base):
    """
    Email verification token model with expiration.
    
    Features:
    - 24-hour expiration by default
    - Single-use enforcement
    - Resend rate limiting support
    """
    __tablename__ = "auth_email_verification_tokens"
    
    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), 
        primary_key=True, 
        server_default=text("gen_random_uuid()")
    )
    
    # User relationship
    user_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("auth_users.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    
    # Token details
    token: Mapped[str] = mapped_column(
        String(255), 
        unique=True, 
        nullable=False,
        index=True
    )
    
    # Metadata
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), 
        nullable=False,
        index=True
    )
    used_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    
    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), 
        default=get_utc_now,
        nullable=False
    )
    
    # Relationships
    user: Mapped["AuthUser"] = relationship(
        "AuthUser",
        back_populates="email_verification_tokens",
        lazy="select"
    )
    
    @hybrid_property
    def is_expired(self) -> bool:
        """Check if token has expired."""
        return datetime.now(timezone.utc) > self.expires_at
    
    @hybrid_property
    def is_used(self) -> bool:
        """Check if token has been used."""
        return self.used_at is not None
    
    @hybrid_property
    def is_valid(self) -> bool:
        """Check if token is valid (not expired and not used)."""
        return not self.is_expired and not self.is_used
    
    def __repr__(self):
        return f"<AuthEmailVerificationToken(id={self.id}, user_id={self.user_id}, expires_at={self.expires_at})>"


class AuditLog(Base):
    """
    Audit log model for security and compliance tracking.
    
    Records:
    - Authentication events (login, logout, failed attempts)
    - Account changes (password reset, email change)
    - Administrative actions
    - Data access for sensitive operations
    """
    __tablename__ = "audit_log"
    
    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), 
        primary_key=True, 
        server_default=text("gen_random_uuid()")
    )
    
    # User relationship (nullable for anonymous events)
    user_id: Mapped[Optional[UUID]] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("auth_users.id", ondelete="SET NULL"),
        index=True
    )
    
    # Event details
    action: Mapped[str] = mapped_column(
        String(50), 
        nullable=False,
        index=True
    )
    entity_type: Mapped[str] = mapped_column(
        String(50), 
        nullable=False,
        index=True
    )
    entity_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), 
        nullable=False,
        index=True
    )
    
    # Additional context
    changes: Mapped[Optional[dict]] = mapped_column(JSON)  # JSONB in PostgreSQL
    ip_address: Mapped[Optional[str]] = mapped_column(String(45))  # IPv4/IPv6
    user_agent: Mapped[Optional[str]] = mapped_column(String(500))
    
    # Timestamp
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), 
        default=get_utc_now,
        nullable=False,
        index=True
    )
    
    # Common audit actions
    LOGIN_SUCCESS = "login_success"
    LOGIN_FAILED = "login_failed"
    LOGOUT = "logout"
    PASSWORD_RESET_REQUEST = "password_reset_request"
    PASSWORD_RESET_COMPLETE = "password_reset_complete"
    EMAIL_VERIFICATION_SENT = "email_verification_sent"
    EMAIL_VERIFIED = "email_verified"
    ACCOUNT_LOCKED = "account_locked"
    ACCOUNT_UNLOCKED = "account_unlocked"
    SESSION_CREATED = "session_created"
    SESSION_INVALIDATED = "session_invalidated"
    
    def __repr__(self):
        return f"<AuditLog(id={self.id}, action={self.action}, user_id={self.user_id})>"