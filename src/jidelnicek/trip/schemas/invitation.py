"""
Trip invitation schemas.

This module defines Pydantic schemas for trip invitations.
"""

from datetime import datetime
from typing import Optional, List
from uuid import UUID

from pydantic import BaseModel, Field, EmailStr, field_validator


class InvitationTemplateBase(BaseModel):
    """Base schema for invitation templates."""
    name: str = Field(..., min_length=1, max_length=100)
    subject: str = Field(..., min_length=1, max_length=200)
    body: str = Field(..., min_length=1, max_length=2000)
    is_default: bool = False


class InvitationTemplateCreate(InvitationTemplateBase):
    """Schema for creating an invitation template."""
    pass


class InvitationTemplateResponse(InvitationTemplateBase):
    """Schema for invitation template response."""
    id: UUID
    
    class Config:
        from_attributes = True


class CreateInvitationRequest(BaseModel):
    """Schema for creating trip invitations."""
    trip_id: UUID
    emails: List[EmailStr] = Field(..., min_items=1, max_items=100)
    message: Optional[str] = Field(None, max_length=1000)
    template_id: Optional[UUID] = None
    expires_in_days: int = Field(default=7, ge=1, le=30)


class BulkInvitationRequest(BaseModel):
    """Schema for bulk invitation requests."""
    trip_id: UUID
    emails: List[EmailStr] = Field(..., min_items=1, max_items=500)
    message: Optional[str] = Field(None, max_length=1000)
    template_id: Optional[UUID] = None


class InvitationLinkRequest(BaseModel):
    """Schema for creating invitation links."""
    trip_id: UUID
    expires_in_days: int = Field(default=7, ge=1, le=30)
    max_uses: Optional[int] = Field(None, gt=0, le=1000)


class InvitationLinkResponse(BaseModel):
    """Schema for invitation link response."""
    id: UUID
    trip_id: UUID
    token: str
    url: str
    expires_at: datetime
    max_uses: Optional[int]
    current_uses: int
    created_by: UUID
    created_at: datetime
    qr_code: Optional[str] = None
    
    class Config:
        from_attributes = True


class TripInvitationResponse(BaseModel):
    """Schema for trip invitation response."""
    id: UUID
    trip_id: UUID
    email: str
    status: str
    invited_by: UUID
    invited_at: datetime
    accepted_at: Optional[datetime]
    expires_at: datetime
    message: Optional[str]
    token: str
    
    class Config:
        from_attributes = True


class SendInvitationResponse(BaseModel):
    """Schema for send invitation response."""
    successful: List[str]
    failed: List[dict]  # List of {"email": str, "reason": str}
    total_sent: int


class AcceptInvitationRequest(BaseModel):
    """Schema for accepting an invitation."""
    token: str
    participant_name: Optional[str] = Field(None, min_length=1, max_length=100)


class InvitationStatusUpdate(BaseModel):
    """Schema for updating invitation status."""
    status: str
    
    @field_validator('status')
    def validate_status(cls, v):
        valid_statuses = {'pending', 'sent', 'accepted', 'declined', 'expired', 'cancelled'}
        if v not in valid_statuses:
            raise ValueError(f"Status must be one of: {', '.join(valid_statuses)}")
        return v