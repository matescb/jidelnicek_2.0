"""
Security integration module that ties all security components together.

Provides a unified interface for admin security features.
"""

from typing import Optional, Dict, Any, List, Tuple
from datetime import datetime, timedelta
from uuid import UUID
import asyncio

from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import FastAPI, Request, Response

from jidelnicek.core.utils import get_utc_now
from jidelnicek.admin.config.security_config import SecurityConfig, get_security_config
from jidelnicek.admin.security import (
    SessionManager,
    TwoFactorAuth,
    IPWhitelistService,
    SecurityHeadersMiddleware
)
from jidelnicek.admin.middleware.security import AdminSecurityMiddleware
from jidelnicek.admin.services.security_audit import SecurityAuditService
from jidelnicek.admin.utils.security_monitor import (
    SecurityMonitor,
    SecurityEvent,
    SecurityEventType,
    log_alert_handler,
    console_alert_handler
)


class AdminSecuritySystem:
    """
    Unified admin security system.
    
    Integrates all security components and provides
    high-level security operations.
    """
    
    def __init__(
        self,
        db: AsyncSession,
        redis_client=None,
        sms_service=None,
        config: Optional[SecurityConfig] = None
    ):
        self.db = db
        self.redis = redis_client
        self.config = config or get_security_config()
        
        # Initialize components
        self.session_manager = SessionManager(db, redis_client)
        self.two_factor = TwoFactorAuth(db, sms_service, redis_client)
        self.ip_whitelist = IPWhitelistService(db, redis_client)
        self.audit_service = SecurityAuditService(db, redis_client)
        
        # Initialize monitor with alert handlers
        alert_handlers = [log_alert_handler]
        if self.config.environment == "development":
            alert_handlers.append(console_alert_handler)
        
        self.monitor = SecurityMonitor(db, redis_client, alert_handlers)
        
        # Background tasks
        self._background_tasks = []
    
    def setup_middleware(self, app: FastAPI) -> None:
        """Set up security middleware on FastAPI app."""
        # Security headers
        if self.config.security_headers_enabled:
            app.add_middleware(
                SecurityHeadersMiddleware,
                config=self.config,
                admin_path_prefix="/admin"
            )
        
        # Main security middleware
        app.add_middleware(
            AdminSecurityMiddleware,
            session_manager=self.session_manager,
            two_factor_auth=self.two_factor,
            ip_whitelist_service=self.ip_whitelist,
            config=self.config,
            redis_client=self.redis
        )
    
    async def authenticate_admin(
        self,
        email: str,
        password: str,
        ip_address: str,
        user_agent: str,
        device_info: Optional[Dict[str, Any]] = None
    ) -> Tuple[Optional[Any], Optional[str]]:
        """
        Authenticate admin user with full security checks.
        
        Returns:
            - (session, error_message)
        """
        # Log authentication attempt
        await self.monitor.log_event(SecurityEvent(
            event_type=SecurityEventType.LOGIN_ATTEMPT,
            severity="info",
            timestamp=get_utc_now(),
            ip_address=ip_address,
            details={'email': email}
        ))
        
        # Check IP access
        allowed, reason = await self.ip_whitelist.check_ip_access(
            ip=ip_address,
            enforce_whitelist=self.config.enforce_ip_whitelist
        )
        
        if not allowed:
            await self.monitor.log_event(SecurityEvent(
                event_type=SecurityEventType.LOGIN_FAILED,
                severity="high",
                timestamp=get_utc_now(),
                ip_address=ip_address,
                details={'reason': reason, 'email': email}
            ))
            return None, reason
        
        # Authenticate user (would integrate with auth service)
        # For now, this is a placeholder
        user = None  # Would get from auth service
        
        if not user:
            await self.monitor.log_event(SecurityEvent(
                event_type=SecurityEventType.LOGIN_FAILED,
                severity="medium",
                timestamp=get_utc_now(),
                ip_address=ip_address,
                details={'reason': 'Invalid credentials', 'email': email}
            ))
            
            # Track failed attempt
            await self.ip_whitelist.track_failed_attempt(ip_address)
            
            return None, "Invalid credentials"
        
        # Check if user is admin
        if user.role != 'admin':
            await self.monitor.log_event(SecurityEvent(
                event_type=SecurityEventType.UNAUTHORIZED_ACCESS,
                severity="high",
                timestamp=get_utc_now(),
                user_id=user.id,
                ip_address=ip_address,
                details={'attempted_area': 'admin'}
            ))
            return None, "Unauthorized access"
        
        # Create session
        try:
            session = await self.session_manager.create_session(
                user=user,
                ip_address=ip_address,
                user_agent=user_agent,
                device_info=device_info
            )
            
            await self.monitor.log_event(SecurityEvent(
                event_type=SecurityEventType.LOGIN_SUCCESS,
                severity="info",
                timestamp=get_utc_now(),
                user_id=user.id,
                ip_address=ip_address,
                details={'session_id': str(session.session_id)}
            ))
            
            return session, None
            
        except Exception as e:
            await self.monitor.log_event(SecurityEvent(
                event_type=SecurityEventType.LOGIN_FAILED,
                severity="high",
                timestamp=get_utc_now(),
                user_id=user.id if user else None,
                ip_address=ip_address,
                details={'error': str(e)}
            ))
            return None, "Session creation failed"
    
    async def verify_2fa(
        self,
        session_token: str,
        code: str,
        method: str = "totp"
    ) -> Tuple[bool, Optional[str]]:
        """
        Verify 2FA code for session.
        
        Returns:
            - (success, error_message)
        """
        # Get session
        session = await self.session_manager.validate_session(
            token=session_token,
            ip_address="",  # Would get from request
            user_agent=""   # Would get from request
        )
        
        if not session:
            return False, "Invalid session"
        
        # Get user (would fetch from DB)
        user = None  # Placeholder
        
        if not user:
            return False, "User not found"
        
        # Verify based on method
        if method == "totp":
            verified = await self.two_factor.verify_totp(user, code)
        elif method == "sms":
            verified = await self.two_factor.verify_sms_code(user, code)
        elif method == "backup":
            verified = await self.two_factor.verify_backup_code(user, code)
        else:
            return False, "Invalid 2FA method"
        
        if verified:
            # Mark session as 2FA verified
            await self.session_manager.verify_two_factor(session)
            
            await self.monitor.log_event(SecurityEvent(
                event_type=SecurityEventType.LOGIN_SUCCESS,
                severity="info",
                timestamp=get_utc_now(),
                user_id=session.user_id,
                details={'2fa_method': method}
            ))
        else:
            await self.monitor.log_event(SecurityEvent(
                event_type=SecurityEventType.LOGIN_FAILED,
                severity="medium",
                timestamp=get_utc_now(),
                user_id=session.user_id,
                details={'2fa_method': method, 'reason': 'Invalid code'}
            ))
        
        return verified, None if verified else "Invalid code"
    
    async def run_security_audit(
        self,
        initiated_by: Optional[UUID] = None
    ) -> Dict[str, Any]:
        """Run comprehensive security audit."""
        # Log audit start
        await self.monitor.log_event(SecurityEvent(
            event_type=SecurityEventType.AUDIT_STARTED,
            severity="info",
            timestamp=get_utc_now(),
            user_id=initiated_by,
            details={'type': 'comprehensive'}
        ))
        
        # Run audit
        report = await self.audit_service.run_full_audit()
        
        # Log critical findings
        for issue in report.issues:
            if issue.severity in ['critical', 'high']:
                await self.monitor.log_event(SecurityEvent(
                    event_type=SecurityEventType.ANOMALY_DETECTED,
                    severity=issue.severity,
                    timestamp=get_utc_now(),
                    details={
                        'audit_issue': issue.title,
                        'check_type': issue.check_type.value
                    }
                ))
        
        return {
            'report_id': str(report.id),
            'score': report.score,
            'status': report.status,
            'critical_issues': sum(
                1 for i in report.issues 
                if i.severity == 'critical'
            ),
            'high_issues': sum(
                1 for i in report.issues 
                if i.severity == 'high'
            ),
            'summary': report.summary
        }
    
    async def get_security_dashboard(self) -> Dict[str, Any]:
        """Get comprehensive security dashboard."""
        # Get monitor dashboard
        monitor_data = await self.monitor.get_security_dashboard()
        
        # Get latest audit report
        latest_audit = await self.audit_service.get_latest_report()
        
        # Get session statistics
        if self.redis:
            pattern = "admin:session:*"
            cursor = 0
            active_sessions = 0
            
            while True:
                cursor, keys = await self.redis.scan(
                    cursor, match=pattern, count=100
                )
                active_sessions += len(keys)
                if cursor == 0:
                    break
        else:
            active_sessions = 0
        
        # Combine data
        return {
            'monitoring': monitor_data,
            'audit': {
                'last_run': latest_audit.get('completed_at') if latest_audit else None,
                'score': latest_audit.get('score') if latest_audit else None,
                'status': latest_audit.get('status') if latest_audit else 'unknown'
            },
            'sessions': {
                'active_count': active_sessions,
                'require_2fa': self.config.require_2fa,
                'session_timeout': self.config.session_inactivity_timeout.total_seconds()
            },
            'ip_security': {
                'whitelist_enforced': self.config.enforce_ip_whitelist,
                'allow_vpn': self.config.allow_vpn_connections,
                'blocked_countries': self.config.auto_block_countries
            },
            'system_health': {
                'security_score': self._calculate_security_score(monitor_data, latest_audit),
                'recommendations': self._get_security_recommendations(monitor_data, latest_audit)
            }
        }
    
    def _calculate_security_score(
        self,
        monitor_data: Dict[str, Any],
        audit_data: Optional[Dict[str, Any]]
    ) -> float:
        """Calculate overall security score."""
        scores = []
        
        # Monitoring score (based on critical events)
        if monitor_data:
            critical_events = monitor_data['summary'].get('critical_events', 0)
            monitor_score = max(0, 100 - (critical_events * 10))
            scores.append(monitor_score)
        
        # Audit score
        if audit_data:
            scores.append(audit_data.get('score', 0))
        
        # Configuration score
        config_issues = self.config.validate()
        config_score = max(0, 100 - (len(config_issues) * 10))
        scores.append(config_score)
        
        return sum(scores) / len(scores) if scores else 0
    
    def _get_security_recommendations(
        self,
        monitor_data: Dict[str, Any],
        audit_data: Optional[Dict[str, Any]]
    ) -> List[str]:
        """Get security recommendations."""
        recommendations = []
        
        # Check configuration
        config_issues = self.config.validate()
        for issue in config_issues[:3]:  # Top 3
            recommendations.append(f"Configuration: {issue}")
        
        # Check monitoring data
        if monitor_data:
            if monitor_data['summary'].get('critical_events', 0) > 0:
                recommendations.append("Investigate and resolve critical security events")
            
            active_threats = monitor_data.get('active_threats', [])
            if active_threats:
                recommendations.append(f"Address {len(active_threats)} active security threats")
        
        # Check audit data
        if audit_data and audit_data.get('status') != 'good':
            recommendations.append("Run security audit and address findings")
        
        return recommendations
    
    async def start_background_tasks(self) -> None:
        """Start background security tasks."""
        # Periodic session cleanup
        async def cleanup_sessions():
            while True:
                try:
                    await self.session_manager.cleanup_expired_sessions()
                    await asyncio.sleep(300)  # Every 5 minutes
                except Exception:
                    await asyncio.sleep(60)
        
        # Periodic security audits
        async def run_audits():
            while True:
                try:
                    await asyncio.sleep(86400)  # Daily
                    await self.run_security_audit()
                except Exception:
                    await asyncio.sleep(3600)
        
        # Start tasks
        self._background_tasks = [
            asyncio.create_task(cleanup_sessions()),
            asyncio.create_task(run_audits())
        ]
    
    async def stop_background_tasks(self) -> None:
        """Stop background security tasks."""
        for task in self._background_tasks:
            task.cancel()
        
        await asyncio.gather(*self._background_tasks, return_exceptions=True)
        self._background_tasks = []


# Factory function for easy setup
def create_admin_security_system(
    db: AsyncSession,
    redis_client=None,
    sms_service=None,
    config: Optional[SecurityConfig] = None
) -> AdminSecuritySystem:
    """Create and configure admin security system."""
    return AdminSecuritySystem(
        db=db,
        redis_client=redis_client,
        sms_service=sms_service,
        config=config
    )