"""
Trip invitation router.

This module defines API endpoints for managing trip invitations.
"""

from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession

from jidelnicek.core.dependencies import get_db
from jidelnicek.auth.dependencies import get_current_user
from jidelnicek.auth.models import AuthUser as User
from jidelnicek.trip.services.invitation_service import InvitationService
from jidelnicek.trip.schemas.invitation import (
    CreateInvitationRequest,
    BulkInvitationRequest,
    InvitationLinkRequest,
    InvitationLinkResponse,
    TripInvitationResponse,
    SendInvitationResponse,
    AcceptInvitationRequest,
    InvitationTemplateResponse
)

router = APIRouter(prefix="/trips", tags=["invitations"])


# Default invitation templates
DEFAULT_TEMPLATES = [
    {
        "id": "00000000-0000-0000-0000-000000000001",
        "name": "Casual",
        "subject": "You're invited to join ${tripName}!",
        "body": "Hey! I'm organizing a trip called \"${tripName}\" and would love for you to join. Click here to see the details and RSVP: ${inviteLink}",
        "is_default": True
    },
    {
        "id": "00000000-0000-0000-0000-000000000002",
        "name": "Formal",
        "subject": "Invitation to ${tripName}",
        "body": "Dear Friend,\n\nYou are cordially invited to join our upcoming trip: \"${tripName}\".\n\nPlease follow this link to view the details and confirm your attendance: ${inviteLink}\n\nWe look forward to having you with us!\n\nBest regards",
        "is_default": True
    },
    {
        "id": "00000000-0000-0000-0000-000000000003",
        "name": "Detailed",
        "subject": "Join us for ${tripName}!",
        "body": "Join us for \"${tripName}\"!\n\nWe're planning an amazing trip and would love to have you join us. Here's what you need to know:\n\n• Trip dates: [Add dates]\n• Location: [Add location]\n• Activities planned: [Add activities]\n\nClick the link below to see all the details and let us know if you can make it:\n${inviteLink}\n\nQuestions? Just reply to this message!",
        "is_default": True
    }
]


@router.post("/invitations/send", response_model=SendInvitationResponse)
async def send_invitations(
    request: CreateInvitationRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Send email invitations to participants."""
    service = InvitationService(db)
    return await service.send_invitations(request, current_user)


@router.post("/invitations/bulk", response_model=SendInvitationResponse)
async def send_bulk_invitations(
    request: BulkInvitationRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Send bulk email invitations."""
    # Convert to CreateInvitationRequest
    create_request = CreateInvitationRequest(
        trip_id=request.trip_id,
        emails=request.emails,
        message=request.message,
        template_id=request.template_id,
        expires_in_days=7
    )
    service = InvitationService(db)
    return await service.send_invitations(create_request, current_user)


@router.post("/invitations/link", response_model=InvitationLinkResponse)
async def generate_invitation_link(
    request: InvitationLinkRequest,
    req: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Generate a shareable invitation link."""
    service = InvitationService(db)
    base_url = str(req.url_for('docs')).replace('/docs', '')
    result = await service.generate_invitation_link(request, current_user, base_url)
    return InvitationLinkResponse(**result)


@router.get("/{trip_id}/invitations", response_model=List[TripInvitationResponse])
async def get_trip_invitations(
    trip_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get all invitations for a trip."""
    service = InvitationService(db)
    invitations = await service.get_trip_invitations(trip_id, current_user)
    
    return [
        TripInvitationResponse(
            id=inv.id,
            trip_id=inv.trip_id,
            email=inv.email,
            status=inv.status,
            invited_by=inv.invited_by_id,
            invited_at=inv.created_at,
            accepted_at=inv.accepted_at,
            expires_at=inv.expires_at,
            message=inv.message,
            token=inv.token
        )
        for inv in invitations
    ]


@router.get("/invitations/templates", response_model=List[InvitationTemplateResponse])
async def get_invitation_templates():
    """Get available invitation templates."""
    return [InvitationTemplateResponse(**template) for template in DEFAULT_TEMPLATES]


@router.delete("/invitations/{invitation_id}")
async def cancel_invitation(
    invitation_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Cancel an invitation."""
    service = InvitationService(db)
    await service.cancel_invitation(invitation_id, current_user)
    return {"message": "Invitation cancelled"}


@router.post("/invitations/{invitation_id}/resend")
async def resend_invitation(
    invitation_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Resend an invitation."""
    service = InvitationService(db)
    await service.resend_invitation(invitation_id, current_user)
    return {"message": "Invitation resent"}


@router.get("/invitations/validate/{token}", response_model=TripInvitationResponse)
async def validate_invitation(
    token: str,
    db: AsyncSession = Depends(get_db)
):
    """Validate an invitation token."""
    service = InvitationService(db)
    invitation = await service.validate_invitation(token)
    
    if hasattr(invitation, 'email'):
        # Email invitation
        return TripInvitationResponse(
            id=invitation.id,
            trip_id=invitation.trip_id,
            email=invitation.email,
            status=invitation.status,
            invited_by=invitation.invited_by_id,
            invited_at=invitation.created_at,
            accepted_at=invitation.accepted_at,
            expires_at=invitation.expires_at,
            message=invitation.message,
            token=invitation.token
        )
    else:
        # Link invitation - create a response
        return TripInvitationResponse(
            id=invitation.id,
            trip_id=invitation.trip_id,
            email="",
            status="valid",
            invited_by=invitation.created_by_id,
            invited_at=invitation.created_at,
            accepted_at=None,
            expires_at=invitation.expires_at,
            message=None,
            token=invitation.token
        )


@router.post("/invitations/accept/{token}")
async def accept_invitation(
    token: str,
    request: AcceptInvitationRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Accept an invitation and join the trip."""
    service = InvitationService(db)
    request.token = token
    result = await service.accept_invitation(request, current_user)
    return result


@router.get("/invitations/link/{link_id}/qr")
async def generate_qr_code(
    link_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Generate QR code for an invitation link."""
    from jidelnicek.trip.models.invitation import TripInvitationLink
    import qrcode
    import io
    import base64
    
    # Get the invitation link
    link = db.query(TripInvitationLink).filter(
        TripInvitationLink.id == link_id
    ).first()
    
    if not link:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invitation link not found"
        )
    
    # Verify permission
    if link.trip.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only trip owner can generate QR codes"
        )
    
    # Generate QR code
    base_url = "https://your-app.com"  # TODO: Get from config
    url = f"{base_url}/trips/join/{link.token}"
    
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_L,
        box_size=10,
        border=4,
    )
    qr.add_data(url)
    qr.make(fit=True)
    
    img = qr.make_image(fill_color="black", back_color="white")
    
    # Convert to base64
    buffer = io.BytesIO()
    img.save(buffer, format='PNG')
    buffer.seek(0)
    
    qr_code_base64 = base64.b64encode(buffer.getvalue()).decode()
    
    return {"qrCode": f"data:image/png;base64,{qr_code_base64}"}