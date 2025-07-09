"""
Admin notification utilities.

This module provides functions for sending notifications about administrative actions.
"""

from typing import List, Optional, Dict, Any
from uuid import UUID
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from jidelnicek.auth.models import AuthUser
from jidelnicek.auth.services.email_service import EmailService
from jidelnicek.admin.models import AdminNotification


async def send_admin_notification(
    db: AsyncSession,
    notification_type: str,
    title: str,
    message: str,
    severity: str = "info",
    related_type: Optional[str] = None,
    related_id: Optional[UUID] = None,
    metadata: Optional[Dict[str, Any]] = None,
    notify_all_admins: bool = True,
    specific_admin_ids: Optional[List[UUID]] = None
) -> None:
    """
    Send notification to admin users.
    
    Args:
        db: Database session
        notification_type: Type of notification
        title: Notification title
        message: Notification message
        severity: Severity level (info, warning, error, critical)
        related_type: Type of related entity
        related_id: ID of related entity
        metadata: Additional metadata
        notify_all_admins: Send to all admins
        specific_admin_ids: Send to specific admins only
    """
    # Create notification record
    notification = AdminNotification(
        type=notification_type,
        severity=severity,
        title=title,
        message=message,
        related_type=related_type,
        related_id=related_id,
        metadata=metadata
    )
    
    db.add(notification)
    
    # Determine recipients
    admin_ids = specific_admin_ids or []
    
    if notify_all_admins and not specific_admin_ids:
        # Get all admin users
        result = await db.execute(
            select(AuthUser.id)
            .where(
                AuthUser.role == "admin",
                AuthUser.is_active == True,
                AuthUser.is_archived == False
            )
        )
        admin_ids = [row[0] for row in result]
    
    # Send emails for critical notifications
    if severity in ["error", "critical"]:
        email_service = EmailService(db)
        
        for admin_id in admin_ids:
            try:
                await email_service.send_admin_alert(
                    admin_id=admin_id,
                    alert_type=notification_type,
                    title=title,
                    message=message,
                    metadata=metadata
                )
            except Exception:
                # Log error but don't fail the operation
                pass
    
    await db.flush()


async def notify_user_registration(
    db: AsyncSession,
    new_user: AuthUser
) -> None:
    """Notify admins of new user registration."""
    await send_admin_notification(
        db=db,
        notification_type="user_registration",
        title="New User Registration",
        message=f"New user registered: {new_user.email}",
        severity="info",
        related_type="user",
        related_id=new_user.id,
        metadata={
            "email": new_user.email,
            "registered_at": new_user.created_at.isoformat()
        }
    )


async def notify_suspicious_activity(
    db: AsyncSession,
    user_id: UUID,
    activity_type: str,
    details: str,
    metadata: Optional[Dict[str, Any]] = None
) -> None:
    """Notify admins of suspicious user activity."""
    await send_admin_notification(
        db=db,
        notification_type="suspicious_activity",
        title=f"Suspicious Activity: {activity_type}",
        message=details,
        severity="warning",
        related_type="user",
        related_id=user_id,
        metadata=metadata
    )


async def notify_system_error(
    db: AsyncSession,
    error_type: str,
    error_message: str,
    metadata: Optional[Dict[str, Any]] = None
) -> None:
    """Notify admins of system errors."""
    await send_admin_notification(
        db=db,
        notification_type="system_error",
        title=f"System Error: {error_type}",
        message=error_message,
        severity="error",
        metadata=metadata
    )


async def notify_quota_exceeded(
    db: AsyncSession,
    user_id: UUID,
    quota_type: str,
    current_usage: int,
    limit: int
) -> None:
    """Notify admins when a user exceeds quotas."""
    result = await db.execute(
        select(AuthUser).where(AuthUser.id == user_id)
    )
    user = result.scalar_one_or_none()
    
    if user:
        await send_admin_notification(
            db=db,
            notification_type="quota_exceeded",
            title=f"Quota Exceeded: {quota_type}",
            message=f"User {user.email} has exceeded {quota_type} quota ({current_usage}/{limit})",
            severity="warning",
            related_type="user",
            related_id=user_id,
            metadata={
                "quota_type": quota_type,
                "current_usage": current_usage,
                "limit": limit,
                "user_email": user.email
            }
        )