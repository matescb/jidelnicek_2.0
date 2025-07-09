"""Notification service for sending alerts and notifications."""

import logging
import asyncio
from typing import List, Dict, Any, Optional
from datetime import datetime
import aiosmtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from ..config import settings
from ..monitoring.metrics import MetricsCollector

logger = logging.getLogger(__name__)


class NotificationService:
    """Service for sending notifications via various channels."""
    
    def __init__(self, metrics_collector: MetricsCollector):
        self.metrics_collector = metrics_collector
        self.smtp_config = {
            "hostname": settings.smtp_host,
            "port": settings.smtp_port,
            "username": settings.smtp_username,
            "password": settings.smtp_password,
            "use_tls": settings.smtp_use_tls
        }
        self.admin_emails = settings.admin_emails
        self.from_email = settings.notification_from_email
        
        # Notification throttling
        self._notification_cache = {}
        self._throttle_window = 300  # 5 minutes
    
    async def send_admin_notification(
        self,
        subject: str,
        message: str,
        priority: str = "medium",
        attachments: Optional[List[Dict[str, Any]]] = None
    ) -> bool:
        """Send notification to admin emails."""
        # Check throttling
        cache_key = f"{subject}:{hash(message)}"
        if self._is_throttled(cache_key):
            logger.info(f"Notification throttled: {subject}")
            return False
        
        try:
            # Prepare email
            msg = MIMEMultipart()
            msg["Subject"] = f"[{priority.upper()}] {subject}"
            msg["From"] = self.from_email
            msg["To"] = ", ".join(self.admin_emails)
            
            # Add timestamp and priority
            enhanced_message = f"""
Priority: {priority.upper()}
Time: {datetime.utcnow().isoformat()}

{message}

--
This is an automated notification from Jidelnicek Export System.
"""
            
            msg.attach(MIMEText(enhanced_message, "plain"))
            
            # Add attachments if any
            if attachments:
                for attachment in attachments:
                    # TODO: Implement attachment handling
                    pass
            
            # Send email
            await self._send_email(msg)
            
            # Update throttle cache
            self._notification_cache[cache_key] = datetime.utcnow()
            
            # Track metrics
            self.metrics_collector.increment(
                "notifications_sent",
                tags={"type": "admin", "priority": priority}
            )
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to send admin notification: {e}")
            self.metrics_collector.increment(
                "notifications_failed",
                tags={"type": "admin", "error": type(e).__name__}
            )
            return False
    
    async def send_user_notification(
        self,
        user_email: str,
        subject: str,
        message: str,
        template: Optional[str] = None,
        context: Optional[Dict[str, Any]] = None
    ) -> bool:
        """Send notification to a specific user."""
        try:
            # Prepare email
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = self.from_email
            msg["To"] = user_email
            
            # Plain text version
            text_content = message
            
            # HTML version if template provided
            html_content = None
            if template:
                html_content = self._render_template(template, context or {})
            
            msg.attach(MIMEText(text_content, "plain"))
            if html_content:
                msg.attach(MIMEText(html_content, "html"))
            
            # Send email
            await self._send_email(msg)
            
            # Track metrics
            self.metrics_collector.increment(
                "notifications_sent",
                tags={"type": "user"}
            )
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to send user notification: {e}")
            self.metrics_collector.increment(
                "notifications_failed",
                tags={"type": "user", "error": type(e).__name__}
            )
            return False
    
    async def send_export_completion_notification(
        self,
        user_email: str,
        export_id: str,
        download_url: str,
        export_format: str,
        expires_at: datetime
    ) -> bool:
        """Send notification when export is completed."""
        subject = "Your export is ready"
        
        message = f"""
Your {export_format} export has been completed successfully.

Export ID: {export_id}
Download URL: {download_url}
Expires at: {expires_at.strftime('%Y-%m-%d %H:%M UTC')}

Please download your export before it expires.
"""
        
        context = {
            "export_id": export_id,
            "download_url": download_url,
            "export_format": export_format,
            "expires_at": expires_at
        }
        
        return await self.send_user_notification(
            user_email,
            subject,
            message,
            template="export_completion",
            context=context
        )
    
    async def send_export_failure_notification(
        self,
        user_email: str,
        export_id: str,
        error_message: str,
        retry_available: bool = True
    ) -> bool:
        """Send notification when export fails."""
        subject = "Export failed"
        
        message = f"""
We're sorry, but your export could not be completed.

Export ID: {export_id}
Error: {error_message}

{"You can retry your export from the application." if retry_available else "Please contact support if this issue persists."}
"""
        
        return await self.send_user_notification(
            user_email,
            subject,
            message
        )
    
    async def send_error_pattern_alert(
        self,
        pattern: str,
        count: int,
        time_window: str,
        details: Dict[str, Any]
    ) -> bool:
        """Send alert for error patterns."""
        subject = f"Error Pattern Alert: {pattern}"
        
        message = f"""
An error pattern has been detected that requires attention.

Pattern: {pattern}
Occurrences: {count}
Time Window: {time_window}

Details:
{self._format_dict(details)}

Please investigate this issue immediately.
"""
        
        return await self.send_admin_notification(
            subject,
            message,
            priority="high"
        )
    
    async def _send_email(self, message: MIMEMultipart) -> None:
        """Send email via SMTP."""
        async with aiosmtplib.SMTP(
            hostname=self.smtp_config["hostname"],
            port=self.smtp_config["port"],
            use_tls=self.smtp_config["use_tls"]
        ) as smtp:
            if self.smtp_config["username"]:
                await smtp.login(
                    self.smtp_config["username"],
                    self.smtp_config["password"]
                )
            
            await smtp.send_message(message)
    
    def _is_throttled(self, cache_key: str) -> bool:
        """Check if notification should be throttled."""
        if cache_key not in self._notification_cache:
            return False
        
        last_sent = self._notification_cache[cache_key]
        elapsed = (datetime.utcnow() - last_sent).total_seconds()
        
        return elapsed < self._throttle_window
    
    def _render_template(
        self,
        template_name: str,
        context: Dict[str, Any]
    ) -> str:
        """Render email template."""
        # TODO: Implement proper template rendering
        # For now, return a simple HTML template
        
        templates = {
            "export_completion": """
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #f0f0f0; padding: 20px; text-align: center; }
        .content { padding: 20px; }
        .button { 
            display: inline-block; 
            padding: 10px 20px; 
            background-color: #007bff; 
            color: white; 
            text-decoration: none; 
            border-radius: 5px; 
        }
        .footer { padding: 20px; text-align: center; color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2>Your Export is Ready!</h2>
        </div>
        <div class="content">
            <p>Your {export_format} export has been completed successfully.</p>
            <p><strong>Export ID:</strong> {export_id}</p>
            <p><strong>Expires at:</strong> {expires_at}</p>
            <p>
                <a href="{download_url}" class="button">Download Export</a>
            </p>
            <p><small>Please download your export before it expires.</small></p>
        </div>
        <div class="footer">
            <p>&copy; 2024 Jidelnicek. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
""".format(**context)
        }
        
        return templates.get(template_name, "")
    
    def _format_dict(self, d: Dict[str, Any], indent: int = 0) -> str:
        """Format dictionary for readable display."""
        lines = []
        prefix = "  " * indent
        
        for key, value in d.items():
            if isinstance(value, dict):
                lines.append(f"{prefix}{key}:")
                lines.append(self._format_dict(value, indent + 1))
            else:
                lines.append(f"{prefix}{key}: {value}")
        
        return "\n".join(lines)


class NotificationChannel:
    """Base class for notification channels."""
    
    async def send(
        self,
        recipient: str,
        subject: str,
        message: str,
        **kwargs
    ) -> bool:
        """Send notification through this channel."""
        raise NotImplementedError


class SlackNotificationChannel(NotificationChannel):
    """Slack notification channel."""
    
    def __init__(self, webhook_url: str):
        self.webhook_url = webhook_url
    
    async def send(
        self,
        recipient: str,
        subject: str,
        message: str,
        **kwargs
    ) -> bool:
        """Send Slack notification."""
        # TODO: Implement Slack webhook integration
        pass


class WebhookNotificationChannel(NotificationChannel):
    """Generic webhook notification channel."""
    
    def __init__(self, webhook_url: str, headers: Optional[Dict[str, str]] = None):
        self.webhook_url = webhook_url
        self.headers = headers or {}
    
    async def send(
        self,
        recipient: str,
        subject: str,
        message: str,
        **kwargs
    ) -> bool:
        """Send webhook notification."""
        # TODO: Implement webhook call
        pass