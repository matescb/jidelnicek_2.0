"""
Security monitoring utilities for admin interface.

Provides real-time monitoring and alerting for security events.
"""

from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional, Callable
from uuid import UUID
from enum import Enum
import asyncio
import json
from dataclasses import dataclass
from collections import defaultdict

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from jidelnicek.core.utils import get_utc_now
from jidelnicek.admin.config.security_config import get_security_config


class SecurityEventType(str, Enum):
    """Types of security events to monitor."""
    LOGIN_FAILED = "login_failed"
    LOGIN_SUCCESS = "login_success"
    LOGIN_SUSPICIOUS = "login_suspicious"
    SESSION_HIJACK_ATTEMPT = "session_hijack_attempt"
    PRIVILEGE_ESCALATION = "privilege_escalation"
    UNAUTHORIZED_ACCESS = "unauthorized_access"
    DATA_BREACH_ATTEMPT = "data_breach_attempt"
    BRUTE_FORCE_DETECTED = "brute_force_detected"
    IP_BLOCKED = "ip_blocked"
    ANOMALY_DETECTED = "anomaly_detected"
    CONFIG_CHANGED = "config_changed"
    AUDIT_TAMPER_ATTEMPT = "audit_tamper_attempt"


@dataclass
class SecurityEvent:
    """Represents a security event."""
    event_type: SecurityEventType
    severity: str  # critical, high, medium, low
    timestamp: datetime
    user_id: Optional[UUID] = None
    ip_address: Optional[str] = None
    details: Dict[str, Any] = None
    metadata: Dict[str, Any] = None
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            'event_type': self.event_type.value,
            'severity': self.severity,
            'timestamp': self.timestamp.isoformat(),
            'user_id': str(self.user_id) if self.user_id else None,
            'ip_address': self.ip_address,
            'details': self.details or {},
            'metadata': self.metadata or {}
        }


class SecurityMonitor:
    """Real-time security monitoring service."""
    
    def __init__(
        self,
        db: AsyncSession,
        redis_client=None,
        alert_handlers: Optional[List[Callable]] = None
    ):
        self.db = db
        self.redis = redis_client
        self.config = get_security_config()
        self.alert_handlers = alert_handlers or []
        
        # In-memory event tracking for pattern detection
        self.recent_events = defaultdict(list)
        self.event_counts = defaultdict(int)
        
        # Thresholds for alerts
        self.alert_thresholds = {
            SecurityEventType.LOGIN_FAILED: {
                'count': 5,
                'window': timedelta(minutes=5),
                'severity': 'high'
            },
            SecurityEventType.LOGIN_SUSPICIOUS: {
                'count': 3,
                'window': timedelta(minutes=10),
                'severity': 'critical'
            },
            SecurityEventType.UNAUTHORIZED_ACCESS: {
                'count': 1,
                'window': timedelta(minutes=1),
                'severity': 'critical'
            },
            SecurityEventType.DATA_BREACH_ATTEMPT: {
                'count': 1,
                'window': timedelta(minutes=1),
                'severity': 'critical'
            }
        }
    
    async def log_event(self, event: SecurityEvent) -> None:
        """Log a security event and check for alerts."""
        # Store in Redis for persistence
        if self.redis:
            key = f"admin:security_event:{event.timestamp.timestamp()}"
            await self.redis.setex(
                key,
                86400 * 7,  # Keep for 7 days
                json.dumps(event.to_dict())
            )
            
            # Update event stream
            stream_key = "admin:security_events:stream"
            await self.redis.xadd(
                stream_key,
                {"event": json.dumps(event.to_dict())},
                maxlen=10000  # Keep last 10k events
            )
        
        # Track in memory
        self._track_event(event)
        
        # Check for alert conditions
        await self._check_alerts(event)
        
        # Run anomaly detection
        if self.config.enable_anomaly_detection:
            await self._detect_anomalies(event)
    
    def _track_event(self, event: SecurityEvent) -> None:
        """Track event in memory for pattern detection."""
        # Track by event type
        self.recent_events[event.event_type].append(event)
        self.event_counts[event.event_type] += 1
        
        # Track by user if available
        if event.user_id:
            user_key = f"user:{event.user_id}"
            self.recent_events[user_key].append(event)
        
        # Track by IP if available
        if event.ip_address:
            ip_key = f"ip:{event.ip_address}"
            self.recent_events[ip_key].append(event)
        
        # Clean old events (keep last hour)
        self._cleanup_old_events()
    
    def _cleanup_old_events(self) -> None:
        """Remove events older than 1 hour from memory."""
        cutoff = get_utc_now() - timedelta(hours=1)
        
        for key in list(self.recent_events.keys()):
            self.recent_events[key] = [
                e for e in self.recent_events[key]
                if e.timestamp > cutoff
            ]
            
            # Remove empty lists
            if not self.recent_events[key]:
                del self.recent_events[key]
    
    async def _check_alerts(self, event: SecurityEvent) -> None:
        """Check if event triggers any alerts."""
        # Check threshold-based alerts
        if event.event_type in self.alert_thresholds:
            threshold = self.alert_thresholds[event.event_type]
            
            # Count recent events of this type
            recent_count = self._count_recent_events(
                event.event_type,
                threshold['window']
            )
            
            if recent_count >= threshold['count']:
                await self._trigger_alert(
                    title=f"Security Alert: {event.event_type.value}",
                    message=f"Threshold exceeded: {recent_count} events in {threshold['window']}",
                    severity=threshold['severity'],
                    event=event,
                    metadata={
                        'count': recent_count,
                        'window': str(threshold['window']),
                        'threshold': threshold['count']
                    }
                )
        
        # Check for specific critical events
        critical_events = [
            SecurityEventType.DATA_BREACH_ATTEMPT,
            SecurityEventType.AUDIT_TAMPER_ATTEMPT,
            SecurityEventType.PRIVILEGE_ESCALATION
        ]
        
        if event.event_type in critical_events:
            await self._trigger_alert(
                title=f"CRITICAL: {event.event_type.value}",
                message="Immediate attention required",
                severity="critical",
                event=event
            )
    
    def _count_recent_events(
        self,
        event_type: SecurityEventType,
        window: timedelta
    ) -> int:
        """Count events of a type within time window."""
        if event_type not in self.recent_events:
            return 0
        
        cutoff = get_utc_now() - window
        return sum(
            1 for e in self.recent_events[event_type]
            if e.timestamp > cutoff
        )
    
    async def _detect_anomalies(self, event: SecurityEvent) -> None:
        """Detect anomalous patterns in events."""
        # User behavior anomalies
        if event.user_id:
            await self._check_user_anomalies(event)
        
        # IP-based anomalies
        if event.ip_address:
            await self._check_ip_anomalies(event)
        
        # Time-based anomalies
        await self._check_temporal_anomalies(event)
    
    async def _check_user_anomalies(self, event: SecurityEvent) -> None:
        """Check for anomalies in user behavior."""
        user_key = f"user:{event.user_id}"
        user_events = self.recent_events.get(user_key, [])
        
        # Rapid activity spike
        recent_count = len([
            e for e in user_events
            if e.timestamp > get_utc_now() - timedelta(minutes=5)
        ])
        
        if recent_count > 20:
            await self.log_event(SecurityEvent(
                event_type=SecurityEventType.ANOMALY_DETECTED,
                severity="high",
                timestamp=get_utc_now(),
                user_id=event.user_id,
                details={
                    'anomaly_type': 'rapid_activity',
                    'event_count': recent_count,
                    'trigger_event': event.event_type.value
                }
            ))
        
        # Geographic anomaly (would need geolocation data)
        # Unusual access pattern (would need more context)
    
    async def _check_ip_anomalies(self, event: SecurityEvent) -> None:
        """Check for anomalies from IP address."""
        ip_key = f"ip:{event.ip_address}"
        ip_events = self.recent_events.get(ip_key, [])
        
        # Multiple users from same IP
        unique_users = set(
            e.user_id for e in ip_events
            if e.user_id and e.timestamp > get_utc_now() - timedelta(minutes=10)
        )
        
        if len(unique_users) > 5:
            await self.log_event(SecurityEvent(
                event_type=SecurityEventType.ANOMALY_DETECTED,
                severity="high",
                timestamp=get_utc_now(),
                ip_address=event.ip_address,
                details={
                    'anomaly_type': 'multiple_users_same_ip',
                    'user_count': len(unique_users),
                    'users': [str(u) for u in unique_users]
                }
            ))
    
    async def _check_temporal_anomalies(self, event: SecurityEvent) -> None:
        """Check for time-based anomalies."""
        # Unusual time of day (assuming UTC)
        hour = event.timestamp.hour
        
        # Define unusual hours (e.g., 2 AM - 5 AM)
        if 2 <= hour <= 5:
            # Check if this is unusual for the user
            if event.user_id:
                # Would check user's typical activity hours
                pass
    
    async def _trigger_alert(
        self,
        title: str,
        message: str,
        severity: str,
        event: Optional[SecurityEvent] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> None:
        """Trigger security alert through configured channels."""
        alert_data = {
            'title': title,
            'message': message,
            'severity': severity,
            'timestamp': get_utc_now().isoformat(),
            'event': event.to_dict() if event else None,
            'metadata': metadata or {}
        }
        
        # Send to all configured handlers
        for handler in self.alert_handlers:
            try:
                await handler(alert_data)
            except Exception as e:
                # Log but don't fail
                pass
        
        # Send email alert if configured
        if self.config.security_alert_email:
            await self._send_email_alert(alert_data)
        
        # Send webhook if configured
        if self.config.security_alert_webhook:
            await self._send_webhook_alert(alert_data)
        
        # Store alert
        if self.redis:
            key = f"admin:security_alert:{get_utc_now().timestamp()}"
            await self.redis.setex(
                key,
                86400 * 30,  # Keep for 30 days
                json.dumps(alert_data)
            )
    
    async def _send_email_alert(self, alert_data: Dict[str, Any]) -> None:
        """Send email alert."""
        # This would integrate with email service
        pass
    
    async def _send_webhook_alert(self, alert_data: Dict[str, Any]) -> None:
        """Send webhook alert."""
        if not self.config.security_alert_webhook:
            return
        
        try:
            async with httpx.AsyncClient() as client:
                await client.post(
                    self.config.security_alert_webhook,
                    json=alert_data,
                    timeout=5.0
                )
        except Exception:
            # Log but don't fail
            pass
    
    async def get_recent_events(
        self,
        event_type: Optional[SecurityEventType] = None,
        user_id: Optional[UUID] = None,
        ip_address: Optional[str] = None,
        hours: int = 24
    ) -> List[SecurityEvent]:
        """Get recent security events."""
        events = []
        
        if self.redis:
            # Get from Redis stream
            stream_key = "admin:security_events:stream"
            
            # Calculate timestamp for range
            start_time = get_utc_now() - timedelta(hours=hours)
            start_id = f"{int(start_time.timestamp() * 1000)}-0"
            
            # Read stream
            results = await self.redis.xrange(
                stream_key,
                min=start_id,
                max="+",
                count=1000
            )
            
            for entry_id, data in results:
                event_data = json.loads(data[b'event'])
                
                # Parse event
                event = SecurityEvent(
                    event_type=SecurityEventType(event_data['event_type']),
                    severity=event_data['severity'],
                    timestamp=datetime.fromisoformat(event_data['timestamp']),
                    user_id=UUID(event_data['user_id']) if event_data['user_id'] else None,
                    ip_address=event_data['ip_address'],
                    details=event_data.get('details'),
                    metadata=event_data.get('metadata')
                )
                
                # Apply filters
                if event_type and event.event_type != event_type:
                    continue
                if user_id and event.user_id != user_id:
                    continue
                if ip_address and event.ip_address != ip_address:
                    continue
                
                events.append(event)
        
        return sorted(events, key=lambda e: e.timestamp, reverse=True)
    
    async def get_security_dashboard(self) -> Dict[str, Any]:
        """Get security dashboard data."""
        # Get recent events
        recent_events = await self.get_recent_events(hours=24)
        
        # Calculate statistics
        event_breakdown = defaultdict(int)
        severity_breakdown = defaultdict(int)
        
        for event in recent_events:
            event_breakdown[event.event_type.value] += 1
            severity_breakdown[event.severity] += 1
        
        # Get active threats
        active_threats = []
        
        # Check for ongoing brute force
        failed_logins = self._count_recent_events(
            SecurityEventType.LOGIN_FAILED,
            timedelta(minutes=15)
        )
        if failed_logins > 10:
            active_threats.append({
                'type': 'brute_force',
                'severity': 'high',
                'description': f"{failed_logins} failed login attempts in last 15 minutes"
            })
        
        # Build dashboard
        return {
            'summary': {
                'total_events_24h': len(recent_events),
                'critical_events': severity_breakdown.get('critical', 0),
                'high_severity_events': severity_breakdown.get('high', 0),
                'active_threats': len(active_threats)
            },
            'event_breakdown': dict(event_breakdown),
            'severity_breakdown': dict(severity_breakdown),
            'active_threats': active_threats,
            'recent_alerts': [],  # Would fetch from alerts
            'system_status': {
                'monitoring_active': True,
                'anomaly_detection': self.config.enable_anomaly_detection,
                'intrusion_detection': self.config.enable_intrusion_detection
            }
        }


# Create alert handler functions

async def log_alert_handler(alert_data: Dict[str, Any]) -> None:
    """Log alerts to application log."""
    import logging
    logger = logging.getLogger(__name__)
    
    severity = alert_data.get('severity', 'info')
    if severity == 'critical':
        logger.critical(f"Security Alert: {alert_data['title']}")
    elif severity == 'high':
        logger.error(f"Security Alert: {alert_data['title']}")
    else:
        logger.warning(f"Security Alert: {alert_data['title']}")


async def console_alert_handler(alert_data: Dict[str, Any]) -> None:
    """Print alerts to console (for development)."""
    print(f"\n{'='*60}")
    print(f"SECURITY ALERT - {alert_data['severity'].upper()}")
    print(f"Title: {alert_data['title']}")
    print(f"Message: {alert_data['message']}")
    print(f"Time: {alert_data['timestamp']}")
    print(f"{'='*60}\n")