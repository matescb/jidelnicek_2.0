"""
Trip invitation model.

This module defines the TripInvitation model for managing trip invitations.
"""

from datetime import datetime, timedelta
from typing import Optional, TYPE_CHECKING
from uuid import UUID
import secrets

from sqlalchemy import (
    Column, DateTime, String, ForeignKey, 
    CheckConstraint, UniqueConstraint, text, Index, Boolean
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import relationship, Mapped, mapped_column, validates

from jidelnicek.core.database import Base
from jidelnicek.core.utils import get_utc_now

if TYPE_CHECKING:
    from .trip import Trip
    from jidelnicek.auth.models import AuthUser as User


class TripInvitation(Base):
    """
    Trip invitation model.
    
    Represents an invitation to join a trip.
    """
    __tablename__ = "trip_invitations"
    
    # Primary key
    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), 
        primary_key=True, 
        server_default=text("gen_random_uuid()")
    )
    
    # Foreign keys
    trip_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("trip_trips.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    
    invited_by_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("auth_users.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )
    
    # Invitation details
    email: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    token: Mapped[str] = mapped_column(
        String(64), 
        nullable=False, 
        unique=True,
        index=True,
        default=lambda: secrets.token_urlsafe(32)
    )
    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        server_default="pending"
    )
    message: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    
    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), 
        server_default=text('now()'),
        nullable=False
    )
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: get_utc_now() + timedelta(days=7)
    )
    accepted_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True
    )
    sent_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True
    )
    
    # Relationships
    trip: Mapped["Trip"] = relationship(
        "Trip",
        back_populates="invitations",
        lazy="select"
    )
    
    invited_by: Mapped[Optional["User"]] = relationship(
        "AuthUser",
        lazy="select"
    )
    
    # Table constraints
    __table_args__ = (
        CheckConstraint(
            "status IN ('pending', 'sent', 'accepted', 'declined', 'expired', 'cancelled')",
            name='invitation_status_check'
        ),
        UniqueConstraint('trip_id', 'email', 'status', name='unique_active_invitation'),
        Index('idx_invitation_token', 'token'),
        Index('idx_invitation_email_trip', 'email', 'trip_id'),
    )
    
    @validates('email')
    def validate_email(self, key, email):
        """Validate email format."""
        if email and '@' not in email:
            raise ValueError("Invalid email format")
        return email.lower()
    
    @validates('status')
    def validate_status(self, key, status):
        """Validate invitation status."""
        valid_statuses = {'pending', 'sent', 'accepted', 'declined', 'expired', 'cancelled'}
        if status not in valid_statuses:
            raise ValueError(f"Invalid status: {status}")
        return status
    
    def is_valid(self) -> bool:
        """Check if invitation is still valid."""
        if self.status in ('accepted', 'declined', 'cancelled', 'expired'):
            return False
        
        if self.expires_at < get_utc_now():
            return False
            
        return True
    
    def mark_as_sent(self):
        """Mark invitation as sent."""
        if self.status == 'pending':
            self.status = 'sent'
            self.sent_at = get_utc_now()
    
    def accept(self):
        """Accept the invitation."""
        if not self.is_valid():
            raise ValueError("Invalid or expired invitation")
            
        self.status = 'accepted'
        self.accepted_at = get_utc_now()
    
    def decline(self):
        """Decline the invitation."""
        if self.status not in ('pending', 'sent'):
            raise ValueError("Cannot decline this invitation")
            
        self.status = 'declined'
    
    def cancel(self):
        """Cancel the invitation."""
        if self.status in ('accepted', 'expired'):
            raise ValueError("Cannot cancel this invitation")
            
        self.status = 'cancelled'
    
    def __repr__(self):
        return f"<TripInvitation(id={self.id}, trip_id={self.trip_id}, email={self.email}, status={self.status})>"


class TripInvitationLink(Base):
    """
    Trip invitation link model.
    
    Represents a shareable invitation link for a trip.
    """
    __tablename__ = "trip_invitation_links"
    
    # Primary key
    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), 
        primary_key=True, 
        server_default=text("gen_random_uuid()")
    )
    
    # Foreign keys
    trip_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("trip_trips.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    
    created_by_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("auth_users.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )
    
    # Link details
    token: Mapped[str] = mapped_column(
        String(64), 
        nullable=False, 
        unique=True,
        index=True,
        default=lambda: secrets.token_urlsafe(32)
    )
    max_uses: Mapped[Optional[int]] = mapped_column(nullable=True)
    current_uses: Mapped[int] = mapped_column(
        nullable=False,
        server_default="0"
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        server_default="true"
    )
    
    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), 
        server_default=text('now()'),
        nullable=False
    )
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: get_utc_now() + timedelta(days=7)
    )
    
    # Relationships
    trip: Mapped["Trip"] = relationship(
        "Trip",
        lazy="select"
    )
    
    created_by: Mapped[Optional["User"]] = relationship(
        "AuthUser",
        lazy="select"
    )
    
    # Table constraints
    __table_args__ = (
        CheckConstraint('max_uses IS NULL OR max_uses > 0', name='positive_max_uses_check'),
        CheckConstraint('current_uses >= 0', name='non_negative_current_uses_check'),
        Index('idx_invitation_link_token', 'token'),
    )
    
    def is_valid(self) -> bool:
        """Check if invitation link is still valid."""
        if not self.is_active:
            return False
            
        if self.expires_at < get_utc_now():
            return False
            
        if self.max_uses and self.current_uses >= self.max_uses:
            return False
            
        return True
    
    def use(self):
        """Record a use of the invitation link."""
        if not self.is_valid():
            raise ValueError("Invalid or expired invitation link")
            
        self.current_uses += 1
    
    def deactivate(self):
        """Deactivate the invitation link."""
        self.is_active = False
    
    def __repr__(self):
        return f"<TripInvitationLink(id={self.id}, trip_id={self.trip_id}, uses={self.current_uses}/{self.max_uses or 'unlimited'})>"