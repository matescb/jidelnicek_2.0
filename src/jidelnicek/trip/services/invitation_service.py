"""
Trip invitation service.

This module provides services for managing trip invitations.
"""

import logging
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Tuple
from uuid import UUID
import secrets

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy import and_, or_, select
from fastapi import HTTPException, status

from jidelnicek.core.utils import get_utc_now
from jidelnicek.core.email_service import EmailService
from jidelnicek.trip.models.invitation import TripInvitation, TripInvitationLink
from jidelnicek.trip.models.trip import Trip
from jidelnicek.trip.models.participant import TripParticipant
from jidelnicek.trip.schemas.invitation import (
    CreateInvitationRequest,
    InvitationLinkRequest,
    SendInvitationResponse,
    AcceptInvitationRequest
)
from jidelnicek.auth.models import AuthUser as User

logger = logging.getLogger(__name__)


class InvitationService:
    """Service for managing trip invitations."""
    
    def __init__(self, db: AsyncSession, email_service: Optional[EmailService] = None):
        self.db = db
        self.email_service = email_service or EmailService()
    
    async def send_invitations(
        self,
        request: CreateInvitationRequest,
        current_user: User
    ) -> SendInvitationResponse:
        """Send email invitations to multiple recipients."""
        # Verify trip exists and user has permission
        result = await self.db.execute(select(Trip).where(Trip.id == request.trip_id))
        trip = result.scalar_one_or_none()
        
        if not trip:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Trip not found"
            )
        
        if trip.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only trip owner can send invitations"
            )
        
        successful = []
        failed = []
        
        for email in request.emails:
            try:
                # Check if invitation already exists
                result = await self.db.execute(
                    select(TripInvitation).where(
                        and_(
                            TripInvitation.trip_id == request.trip_id,
                            TripInvitation.email == email.lower(),
                            TripInvitation.status.in_(['pending', 'sent'])
                        )
                    )
                )
                existing = result.scalar_one_or_none()
                
                if existing:
                    # Resend existing invitation
                    invitation = existing
                    invitation.message = request.message
                    invitation.expires_at = get_utc_now() + timedelta(days=request.expires_in_days)
                else:
                    # Create new invitation
                    invitation = TripInvitation(
                        trip_id=request.trip_id,
                        email=email.lower(),
                        invited_by_id=current_user.id,
                        message=request.message,
                        expires_at=get_utc_now() + timedelta(days=request.expires_in_days),
                        token=secrets.token_urlsafe(32)
                    )
                    self.db.add(invitation)
                
                # Send email
                if self.email_service:
                    await self._send_invitation_email(invitation, trip)
                    invitation.mark_as_sent()
                
                successful.append(email)
                
            except Exception as e:
                logger.error(f"Failed to send invitation to {email}: {str(e)}")
                failed.append({
                    "email": email,
                    "reason": str(e)
                })
        
        await self.db.commit()
        
        return SendInvitationResponse(
            successful=successful,
            failed=failed,
            total_sent=len(successful)
        )
    
    async def generate_invitation_link(
        self,
        request: InvitationLinkRequest,
        current_user: User,
        base_url: str
    ) -> Dict:
        """Generate a shareable invitation link."""
        # Verify trip exists and user has permission
        result = await self.db.execute(select(Trip).where(Trip.id == request.trip_id))
        trip = result.scalar_one_or_none()
        
        if not trip:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Trip not found"
            )
        
        if trip.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only trip owner can generate invitation links"
            )
        
        # Create invitation link
        link = TripInvitationLink(
            trip_id=request.trip_id,
            created_by_id=current_user.id,
            expires_at=get_utc_now() + timedelta(days=request.expires_in_days),
            max_uses=request.max_uses,
            token=secrets.token_urlsafe(32)
        )
        
        self.db.add(link)
        await self.db.commit()
        await self.db.refresh(link)
        
        # Generate URL
        url = f"{base_url}/trips/join/{link.token}"
        
        return {
            "id": link.id,
            "trip_id": link.trip_id,
            "token": link.token,
            "url": url,
            "expires_at": link.expires_at,
            "max_uses": link.max_uses,
            "current_uses": link.current_uses,
            "created_by": link.created_by_id,
            "created_at": link.created_at
        }
    
    async def validate_invitation(self, token: str) -> TripInvitation:
        """Validate an invitation token."""
        # Check if it's an email invitation
        result = await self.db.execute(
            select(TripInvitation).where(TripInvitation.token == token)
        )
        invitation = result.scalar_one_or_none()
        
        if invitation:
            if not invitation.is_valid():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid or expired invitation"
                )
            return invitation
        
        # Check if it's a link invitation
        result = await self.db.execute(
            select(TripInvitationLink).where(TripInvitationLink.token == token)
        )
        link = result.scalar_one_or_none()
        
        if link:
            if not link.is_valid():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid or expired invitation link"
                )
            return link
        
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invitation not found"
        )
    
    async def accept_invitation(
        self,
        request: AcceptInvitationRequest,
        current_user: Optional[User] = None
    ) -> Dict:
        """Accept an invitation and join the trip."""
        invitation = await self.validate_invitation(request.token)
        
        if isinstance(invitation, TripInvitation):
            # Email invitation
            if invitation.status == 'accepted':
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invitation already accepted"
                )
            
            # Create participant
            participant = TripParticipant(
                trip_id=invitation.trip_id,
                name=request.participant_name or invitation.email.split('@')[0],
                email=invitation.email
            )
            
            invitation.accept()
            
        else:
            # Link invitation
            invitation.use()
            
            # Create participant
            participant = TripParticipant(
                trip_id=invitation.trip_id,
                name=request.participant_name or f"Guest {invitation.current_uses}",
                email=current_user.email if current_user else None
            )
        
        self.db.add(participant)
        await self.db.commit()
        
        return {
            "trip_id": participant.trip_id,
            "participant_id": participant.id,
            "message": "Successfully joined the trip"
        }
    
    async def cancel_invitation(self, invitation_id: UUID, current_user: User):
        """Cancel an invitation."""
        result = await self.db.execute(
            select(TripInvitation).options(selectinload(TripInvitation.trip)).where(
                TripInvitation.id == invitation_id
            )
        )
        invitation = result.scalar_one_or_none()
        
        if not invitation:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Invitation not found"
            )
        
        # Verify permission
        if invitation.trip.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only trip owner can cancel invitations"
            )
        
        invitation.cancel()
        await self.db.commit()
    
    async def resend_invitation(self, invitation_id: UUID, current_user: User):
        """Resend an invitation."""
        result = await self.db.execute(
            select(TripInvitation).options(selectinload(TripInvitation.trip)).where(
                TripInvitation.id == invitation_id
            )
        )
        invitation = result.scalar_one_or_none()
        
        if not invitation:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Invitation not found"
            )
        
        # Verify permission
        if invitation.trip.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only trip owner can resend invitations"
            )
        
        if invitation.status not in ['pending', 'sent']:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot resend this invitation"
            )
        
        # Send email
        if self.email_service:
            await self._send_invitation_email(invitation, invitation.trip)
            invitation.mark_as_sent()
            await self.db.commit()
    
    async def get_trip_invitations(
        self,
        trip_id: UUID,
        current_user: User
    ) -> List[TripInvitation]:
        """Get all invitations for a trip."""
        # Verify permission
        result = await self.db.execute(select(Trip).where(Trip.id == trip_id))
        trip = result.scalar_one_or_none()
        
        if not trip:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Trip not found"
            )
        
        if trip.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only trip owner can view invitations"
            )
        
        result = await self.db.execute(
            select(TripInvitation).where(TripInvitation.trip_id == trip_id)
        )
        return result.scalars().all()
    
    async def _send_invitation_email(self, invitation: TripInvitation, trip: Trip):
        """Send invitation email."""
        if not self.email_service:
            return
        
        subject = f"You're invited to join {trip.name}"
        
        # Build invitation URL
        base_url = "https://your-app.com"  # TODO: Get from config
        invitation_url = f"{base_url}/trips/join/{invitation.token}"
        
        # Get invited by name
        invited_by_name = "Someone"
        if invitation.invited_by:
            invited_by_name = invitation.invited_by.email
        
        body = f"""
        <h2>You're invited to join {trip.name}!</h2>
        
        <p>{invited_by_name} has invited you to join their trip.</p>
        
        {f'<p>{invitation.message}</p>' if invitation.message else ''}
        
        <p><strong>Trip Details:</strong></p>
        <ul>
            <li>Name: {trip.name}</li>
            <li>Dates: {trip.start_date.strftime('%B %d')} - {trip.end_date.strftime('%B %d, %Y')}</li>
            <li>Participants: {len(trip.participants)}</li>
        </ul>
        
        <p>
            <a href="{invitation_url}" style="display: inline-block; padding: 10px 20px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 5px;">
                Accept Invitation
            </a>
        </p>
        
        <p>Or copy this link: {invitation_url}</p>
        
        <p><small>This invitation expires on {invitation.expires_at.strftime('%B %d, %Y at %I:%M %p')}.</small></p>
        """
        
        await self.email_service.send_email(
            to_email=invitation.email,
            subject=subject,
            body=body,
            is_html=True
        )