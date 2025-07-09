"""
Notification tasks for sending various types of notifications.

This module contains Celery tasks for sending notifications related to
file cleanup, job completion, and other system events.
"""

import logging
from datetime import datetime
from typing import Dict, Any, List, Optional

from celery import Task
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from jidelnicek.core.celery_app import app
from jidelnicek.core.dependencies import DatabaseSession
from jidelnicek.auth.models import User
from jidelnicek.auth.services.email_service import EmailService
from jidelnicek.core.models.cleanup_policy import DeletionQueue, CleanupAuditLog
from jidelnicek.core.config import settings

logger = logging.getLogger(__name__)


class NotificationTask(Task):
    """Base class for notification tasks."""
    
    def on_failure(self, exc, task_id, args, kwargs, einfo):
        """Handle task failure."""
        logger.error(f"Notification task {task_id} failed: {exc}")


@app.task(
    bind=True,
    base=NotificationTask,
    name="jidelnicek.tasks.notification_tasks.send_deletion_notification",
    max_retries=3,
    default_retry_delay=300,
)
def send_deletion_notification(
    self,
    user_id: int,
    file_path: str,
    file_type: str,
    deletion_time: str,
) -> Dict[str, Any]:
    """
    Send notification about pending file deletion.
    
    Args:
        user_id: ID of the user to notify
        file_path: Path of the file to be deleted
        file_type: Type of file
        deletion_time: Scheduled deletion time (ISO format)
        
    Returns:
        Notification result
    """
    import asyncio
    
    try:
        result = asyncio.run(_send_deletion_notification_async(
            user_id, file_path, file_type, deletion_time
        ))
        return result
    except Exception as e:
        logger.error(f"Failed to send deletion notification: {e}")
        raise self.retry(exc=e)


async def _send_deletion_notification_async(
    user_id: int,
    file_path: str,
    file_type: str,
    deletion_time: str,
) -> Dict[str, Any]:
    """Async implementation of deletion notification."""
    async with DatabaseSession() as db:
        # Get user
        user = await db.get(User, user_id)
        if not user:
            logger.warning(f"User {user_id} not found for deletion notification")
            return {"status": "error", "reason": "user_not_found"}
        
        # Check user preferences
        preferences = user.metadata.get("cleanup_preferences", {})
        if not preferences.get("enable_deletion_notifications", True):
            return {"status": "skipped", "reason": "notifications_disabled"}
        
        # Parse deletion time
        deletion_dt = datetime.fromisoformat(deletion_time)
        time_until_deletion = deletion_dt - datetime.utcnow()
        
        # Format notification message
        hours_remaining = int(time_until_deletion.total_seconds() / 3600)
        
        if hours_remaining > 24:
            time_str = f"{hours_remaining // 24} days"
        else:
            time_str = f"{hours_remaining} hours"
        
        # Prepare email content
        subject = f"File Scheduled for Deletion in {time_str}"
        
        file_type_display = file_type.replace("_", " ").title()
        file_name = file_path.split("/")[-1]
        
        html_content = f"""
        <h2>File Deletion Notice</h2>
        <p>Dear {user.username},</p>
        
        <p>The following file is scheduled for deletion:</p>
        
        <ul>
            <li><strong>File:</strong> {file_name}</li>
            <li><strong>Type:</strong> {file_type_display}</li>
            <li><strong>Deletion Time:</strong> {deletion_dt.strftime('%Y-%m-%d %H:%M UTC')}</li>
            <li><strong>Time Remaining:</strong> {time_str}</li>
        </ul>
        
        <p>If you need to keep this file, please download it before the scheduled deletion time.</p>
        
        <p>You can manage your file retention preferences in your account settings.</p>
        
        <p>Best regards,<br>
        {settings.app_name} Team</p>
        """
        
        text_content = f"""
        File Deletion Notice
        
        Dear {user.username},
        
        The following file is scheduled for deletion:
        
        - File: {file_name}
        - Type: {file_type_display}
        - Deletion Time: {deletion_dt.strftime('%Y-%m-%d %H:%M UTC')}
        - Time Remaining: {time_str}
        
        If you need to keep this file, please download it before the scheduled deletion time.
        
        You can manage your file retention preferences in your account settings.
        
        Best regards,
        {settings.app_name} Team
        """
        
        # Send email
        email_service = EmailService()
        result = await email_service.send_email(
            to_email=user.email,
            subject=subject,
            html_content=html_content,
            text_content=text_content,
        )
        
        # Update deletion queue
        queue_result = await db.execute(
            select(DeletionQueue).where(
                DeletionQueue.user_id == user_id,
                DeletionQueue.file_path == file_path,
                DeletionQueue.processed == False,
            )
        )
        queue_entry = queue_result.scalar_one_or_none()
        
        if queue_entry:
            queue_entry.notification_sent = True
            queue_entry.notification_sent_at = datetime.utcnow()
            await db.commit()
        
        return {
            "status": "success",
            "email_sent": result,
            "user_id": user_id,
            "file_type": file_type,
        }


@app.task(
    bind=True,
    base=NotificationTask,
    name="jidelnicek.tasks.notification_tasks.send_cleanup_summary",
    queue="low",
)
def send_cleanup_summary(
    self,
    user_id: Optional[int] = None,
    admin_only: bool = False,
) -> Dict[str, Any]:
    """
    Send cleanup activity summary.
    
    Args:
        user_id: Specific user to send summary to (None for all users)
        admin_only: Send only to admin users
        
    Returns:
        Summary of notifications sent
    """
    import asyncio
    
    try:
        result = asyncio.run(_send_cleanup_summary_async(user_id, admin_only))
        return result
    except Exception as e:
        logger.error(f"Failed to send cleanup summary: {e}")
        raise


async def _send_cleanup_summary_async(
    user_id: Optional[int],
    admin_only: bool,
) -> Dict[str, Any]:
    """Async implementation of cleanup summary notification."""
    async with DatabaseSession() as db:
        # Get cleanup statistics for the past week
        from jidelnicek.core.services.cleanup_service import CleanupService
        
        cleanup_service = CleanupService(db)
        
        # Generate report
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=7)
        
        report = await cleanup_service.generate_cleanup_report(
            start_date=start_date,
            end_date=end_date,
        )
        
        # Prepare email content
        subject = f"Weekly Cleanup Summary - {settings.app_name}"
        
        total_files = report["summary"]["total_files_deleted"]
        total_size_mb = report["summary"]["total_size_freed"] / (1024 * 1024)
        
        html_content = f"""
        <h2>Weekly Cleanup Summary</h2>
        
        <p>Here's a summary of cleanup activities for the past week:</p>
        
        <h3>Overall Statistics</h3>
        <ul>
            <li><strong>Files Deleted:</strong> {total_files:,}</li>
            <li><strong>Storage Freed:</strong> {total_size_mb:.2f} MB</li>
            <li><strong>Errors:</strong> {report['summary']['total_errors']}</li>
            <li><strong>Files Recovered:</strong> {report['summary']['files_recovered']}</li>
        </ul>
        
        <h3>Breakdown by File Type</h3>
        <table border="1" cellpadding="5">
            <tr>
                <th>File Type</th>
                <th>Files Deleted</th>
                <th>Size Freed (MB)</th>
            </tr>
        """
        
        for file_type, stats in report["by_type"].items():
            size_mb = stats["size"] / (1024 * 1024)
            html_content += f"""
            <tr>
                <td>{file_type.replace('_', ' ').title()}</td>
                <td>{stats['count']:,}</td>
                <td>{size_mb:.2f}</td>
            </tr>
            """
        
        html_content += """
        </table>
        
        <p>You can view detailed cleanup logs and manage retention policies in your admin dashboard.</p>
        
        <p>Best regards,<br>
        {settings.app_name} Team</p>
        """
        
        # Determine recipients
        recipients = []
        
        if user_id:
            user = await db.get(User, user_id)
            if user:
                recipients.append(user)
        else:
            # Get all admin users or all users based on admin_only flag
            query = select(User).where(User.is_active == True)
            if admin_only:
                query = query.where(User.is_admin == True)
            
            result = await db.execute(query)
            recipients = result.scalars().all()
        
        # Send emails
        email_service = EmailService()
        sent_count = 0
        failed_count = 0
        
        for recipient in recipients:
            try:
                await email_service.send_email(
                    to_email=recipient.email,
                    subject=subject,
                    html_content=html_content.format(settings=settings),
                )
                sent_count += 1
            except Exception as e:
                logger.error(f"Failed to send summary to {recipient.email}: {e}")
                failed_count += 1
        
        return {
            "sent": sent_count,
            "failed": failed_count,
            "total_recipients": len(recipients),
        }


@app.task(
    bind=True,
    base=NotificationTask,
    name="jidelnicek.tasks.notification_tasks.send_storage_alert",
    queue="high",
)
def send_storage_alert(
    self,
    alert_type: str,
    details: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Send storage-related alerts.
    
    Args:
        alert_type: Type of alert (quota_exceeded, cleanup_failed, etc.)
        details: Alert details
        
    Returns:
        Alert result
    """
    import asyncio
    
    try:
        result = asyncio.run(_send_storage_alert_async(alert_type, details))
        return result
    except Exception as e:
        logger.error(f"Failed to send storage alert: {e}")
        raise


async def _send_storage_alert_async(
    alert_type: str,
    details: Dict[str, Any],
) -> Dict[str, Any]:
    """Async implementation of storage alert notification."""
    async with DatabaseSession() as db:
        # Get admin users
        result = await db.execute(
            select(User).where(
                User.is_admin == True,
                User.is_active == True,
            )
        )
        admins = result.scalars().all()
        
        if not admins:
            logger.warning("No admin users found for storage alert")
            return {"status": "error", "reason": "no_admins"}
        
        # Prepare alert content based on type
        if alert_type == "quota_exceeded":
            subject = "Storage Quota Exceeded Alert"
            message = f"""
            Storage quota has been exceeded:
            - Storage Type: {details.get('storage_type', 'Unknown')}
            - Used: {details.get('used_gb', 0):.2f} GB
            - Quota: {details.get('quota_gb', 0):.2f} GB
            - Usage: {details.get('usage_percent', 0):.1f}%
            """
        elif alert_type == "cleanup_failed":
            subject = "Cleanup Task Failed"
            message = f"""
            A cleanup task has failed:
            - Task: {details.get('task_name', 'Unknown')}
            - Error: {details.get('error', 'Unknown error')}
            - Time: {details.get('timestamp', datetime.utcnow().isoformat())}
            """
        else:
            subject = f"Storage Alert: {alert_type}"
            message = f"Storage alert details: {details}"
        
        # Send to all admins
        email_service = EmailService()
        sent_count = 0
        
        for admin in admins:
            try:
                await email_service.send_email(
                    to_email=admin.email,
                    subject=subject,
                    text_content=message,
                )
                sent_count += 1
            except Exception as e:
                logger.error(f"Failed to send alert to {admin.email}: {e}")
        
        return {
            "status": "success",
            "alert_type": alert_type,
            "admins_notified": sent_count,
        }


# Schedule periodic notification tasks
app.conf.beat_schedule.update({
    "send-weekly-cleanup-summary": {
        "task": "jidelnicek.tasks.notification_tasks.send_cleanup_summary",
        "schedule": timedelta(days=7),
        "kwargs": {"admin_only": True},
        "options": {"queue": "low", "priority": 0},
    },
})