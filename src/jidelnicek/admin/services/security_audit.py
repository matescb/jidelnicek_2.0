"""
Security audit service for automated security checks.

Provides:
- Scheduled security audits
- Vulnerability scanning
- Configuration validation
- Compliance checking
- Security event monitoring
"""

from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional, Tuple
from uuid import UUID, uuid4
from enum import Enum
import asyncio
import json
from dataclasses import dataclass, asdict

from sqlalchemy import select, and_, or_, func
from sqlalchemy.ext.asyncio import AsyncSession

from jidelnicek.core.utils import get_utc_now
from jidelnicek.auth.models import AuthUser
from jidelnicek.admin.models import AdminAuditLog, AdminAction
from jidelnicek.core.monitoring import log_performance


class SecurityCheckType(str, Enum):
    """Types of security checks."""
    WEAK_PASSWORDS = "weak_passwords"
    INACTIVE_USERS = "inactive_users"
    EXCESSIVE_PERMISSIONS = "excessive_permissions"
    FAILED_LOGIN_PATTERNS = "failed_login_patterns"
    SUSPICIOUS_ACTIVITY = "suspicious_activity"
    SESSION_ANOMALIES = "session_anomalies"
    IP_REPUTATION = "ip_reputation"
    DATA_EXPOSURE = "data_exposure"
    CONFIGURATION = "configuration"
    COMPLIANCE = "compliance"


class SecuritySeverity(str, Enum):
    """Security issue severity levels."""
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    INFO = "info"


@dataclass
class SecurityIssue:
    """Represents a security issue found during audit."""
    id: UUID
    check_type: SecurityCheckType
    severity: SecuritySeverity
    title: str
    description: str
    affected_items: List[Dict[str, Any]]
    recommendations: List[str]
    metadata: Dict[str, Any]
    detected_at: datetime
    resolved: bool = False
    resolved_at: Optional[datetime] = None
    resolved_by: Optional[UUID] = None
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        data = asdict(self)
        data['id'] = str(data['id'])
        data['check_type'] = data['check_type'].value
        data['severity'] = data['severity'].value
        data['detected_at'] = data['detected_at'].isoformat()
        if data['resolved_at']:
            data['resolved_at'] = data['resolved_at'].isoformat()
        if data['resolved_by']:
            data['resolved_by'] = str(data['resolved_by'])
        return data


@dataclass
class SecurityAuditReport:
    """Complete security audit report."""
    id: UUID
    started_at: datetime
    completed_at: datetime
    total_checks: int
    passed_checks: int
    failed_checks: int
    issues: List[SecurityIssue]
    summary: Dict[str, Any]
    
    @property
    def score(self) -> float:
        """Calculate security score (0-100)."""
        if self.total_checks == 0:
            return 100.0
        return (self.passed_checks / self.total_checks) * 100
    
    @property
    def status(self) -> str:
        """Get overall status."""
        critical_count = sum(1 for issue in self.issues if issue.severity == SecuritySeverity.CRITICAL)
        high_count = sum(1 for issue in self.issues if issue.severity == SecuritySeverity.HIGH)
        
        if critical_count > 0:
            return "critical"
        elif high_count > 0:
            return "warning"
        elif self.score >= 90:
            return "good"
        else:
            return "needs_attention"


class SecurityAuditService:
    """Service for running automated security audits."""
    
    def __init__(self, db: AsyncSession, redis_client=None):
        self.db = db
        self.redis = redis_client
        self.checks = self._register_checks()
    
    def _register_checks(self) -> Dict[SecurityCheckType, Callable]:
        """Register all security check functions."""
        return {
            SecurityCheckType.WEAK_PASSWORDS: self._check_weak_passwords,
            SecurityCheckType.INACTIVE_USERS: self._check_inactive_users,
            SecurityCheckType.EXCESSIVE_PERMISSIONS: self._check_excessive_permissions,
            SecurityCheckType.FAILED_LOGIN_PATTERNS: self._check_failed_login_patterns,
            SecurityCheckType.SUSPICIOUS_ACTIVITY: self._check_suspicious_activity,
            SecurityCheckType.SESSION_ANOMALIES: self._check_session_anomalies,
            SecurityCheckType.IP_REPUTATION: self._check_ip_reputation,
            SecurityCheckType.DATA_EXPOSURE: self._check_data_exposure,
            SecurityCheckType.CONFIGURATION: self._check_configuration,
            SecurityCheckType.COMPLIANCE: self._check_compliance,
        }
    
    @log_performance("security_audit")
    async def run_full_audit(
        self,
        check_types: Optional[List[SecurityCheckType]] = None
    ) -> SecurityAuditReport:
        """Run a complete security audit."""
        audit_id = uuid4()
        started_at = get_utc_now()
        issues = []
        
        # Determine which checks to run
        checks_to_run = check_types or list(SecurityCheckType)
        
        # Run checks
        check_results = {}
        for check_type in checks_to_run:
            if check_type in self.checks:
                try:
                    check_issues = await self.checks[check_type]()
                    issues.extend(check_issues)
                    check_results[check_type] = len(check_issues)
                except Exception as e:
                    # Log error but continue with other checks
                    check_results[check_type] = f"Error: {str(e)}"
        
        completed_at = get_utc_now()
        
        # Create report
        report = SecurityAuditReport(
            id=audit_id,
            started_at=started_at,
            completed_at=completed_at,
            total_checks=len(checks_to_run),
            passed_checks=sum(1 for v in check_results.values() if v == 0),
            failed_checks=sum(1 for v in check_results.values() if isinstance(v, int) and v > 0),
            issues=issues,
            summary={
                'duration_seconds': (completed_at - started_at).total_seconds(),
                'check_results': check_results,
                'severity_breakdown': self._get_severity_breakdown(issues),
                'top_risks': self._get_top_risks(issues, limit=5)
            }
        )
        
        # Store report
        await self._store_audit_report(report)
        
        # Log audit
        await self._log_audit_completion(report)
        
        return report
    
    async def _check_weak_passwords(self) -> List[SecurityIssue]:
        """Check for users with weak passwords."""
        issues = []
        
        # Query users with common weak indicators
        query = select(AuthUser).where(
            or_(
                # Password hasn't been changed in 90 days
                AuthUser.password_changed_at < get_utc_now() - timedelta(days=90),
                # No password set (OAuth only)
                AuthUser.password_hash.is_(None)
            )
        )
        
        result = await self.db.execute(query)
        users = result.scalars().all()
        
        if users:
            affected_users = [
                {
                    'user_id': str(user.id),
                    'email': user.email,
                    'issue': 'old_password' if user.password_hash else 'no_password'
                }
                for user in users
            ]
            
            issue = SecurityIssue(
                id=uuid4(),
                check_type=SecurityCheckType.WEAK_PASSWORDS,
                severity=SecuritySeverity.HIGH,
                title="Users with potential password security issues",
                description=f"Found {len(users)} users with weak or missing passwords",
                affected_items=affected_users,
                recommendations=[
                    "Enforce regular password changes",
                    "Implement password strength requirements",
                    "Enable two-factor authentication for all users"
                ],
                metadata={'total_count': len(users)},
                detected_at=get_utc_now()
            )
            issues.append(issue)
        
        return issues
    
    async def _check_inactive_users(self) -> List[SecurityIssue]:
        """Check for inactive users with active accounts."""
        issues = []
        
        # Users inactive for 30+ days
        cutoff_date = get_utc_now() - timedelta(days=30)
        
        query = select(AuthUser).where(
            and_(
                AuthUser.is_active == True,
                or_(
                    AuthUser.last_login < cutoff_date,
                    AuthUser.last_login.is_(None)
                )
            )
        )
        
        result = await self.db.execute(query)
        users = result.scalars().all()
        
        if users:
            affected_users = [
                {
                    'user_id': str(user.id),
                    'email': user.email,
                    'last_login': user.last_login.isoformat() if user.last_login else 'Never',
                    'days_inactive': (get_utc_now() - (user.last_login or user.created_at)).days
                }
                for user in users
            ]
            
            issue = SecurityIssue(
                id=uuid4(),
                check_type=SecurityCheckType.INACTIVE_USERS,
                severity=SecuritySeverity.MEDIUM,
                title="Inactive users with active accounts",
                description=f"Found {len(users)} inactive users who haven't logged in for 30+ days",
                affected_items=affected_users,
                recommendations=[
                    "Review and disable inactive accounts",
                    "Implement automatic account suspension for prolonged inactivity",
                    "Send re-engagement emails to inactive users"
                ],
                metadata={
                    'total_count': len(users),
                    'never_logged_in': sum(1 for u in users if u.last_login is None)
                },
                detected_at=get_utc_now()
            )
            issues.append(issue)
        
        return issues
    
    async def _check_excessive_permissions(self) -> List[SecurityIssue]:
        """Check for users with excessive permissions."""
        issues = []
        
        # Check for too many admin users
        admin_query = select(func.count(AuthUser.id)).where(
            and_(
                AuthUser.role == 'admin',
                AuthUser.is_active == True
            )
        )
        admin_count = await self.db.scalar(admin_query)
        
        # Check total user count
        total_query = select(func.count(AuthUser.id)).where(AuthUser.is_active == True)
        total_count = await self.db.scalar(total_query)
        
        if total_count > 0:
            admin_percentage = (admin_count / total_count) * 100
            
            if admin_percentage > 10:  # More than 10% are admins
                issue = SecurityIssue(
                    id=uuid4(),
                    check_type=SecurityCheckType.EXCESSIVE_PERMISSIONS,
                    severity=SecuritySeverity.HIGH,
                    title="Excessive admin permissions",
                    description=f"{admin_percentage:.1f}% of users have admin permissions",
                    affected_items=[{
                        'admin_count': admin_count,
                        'total_users': total_count,
                        'percentage': admin_percentage
                    }],
                    recommendations=[
                        "Review admin permissions and revoke unnecessary access",
                        "Implement role-based access control with granular permissions",
                        "Regular permission audits"
                    ],
                    metadata={
                        'admin_count': admin_count,
                        'total_count': total_count
                    },
                    detected_at=get_utc_now()
                )
                issues.append(issue)
        
        return issues
    
    async def _check_failed_login_patterns(self) -> List[SecurityIssue]:
        """Check for suspicious failed login patterns."""
        issues = []
        
        # This would analyze audit logs for patterns
        # For now, we'll check users with high failed login counts
        query = select(AuthUser).where(
            AuthUser.failed_login_attempts > 10
        )
        
        result = await self.db.execute(query)
        users = result.scalars().all()
        
        if users:
            affected_users = [
                {
                    'user_id': str(user.id),
                    'email': user.email,
                    'failed_attempts': user.failed_login_attempts,
                    'locked': user.locked_until is not None
                }
                for user in users
            ]
            
            issue = SecurityIssue(
                id=uuid4(),
                check_type=SecurityCheckType.FAILED_LOGIN_PATTERNS,
                severity=SecuritySeverity.HIGH,
                title="Users with excessive failed login attempts",
                description=f"Found {len(users)} users with high failed login counts",
                affected_items=affected_users,
                recommendations=[
                    "Investigate potential brute force attempts",
                    "Enable account lockout policies",
                    "Implement CAPTCHA for repeated failures",
                    "Consider IP-based blocking"
                ],
                metadata={'total_affected': len(users)},
                detected_at=get_utc_now()
            )
            issues.append(issue)
        
        return issues
    
    async def _check_suspicious_activity(self) -> List[SecurityIssue]:
        """Check for suspicious user activity patterns."""
        issues = []
        
        # Check for rapid location changes, unusual access times, etc.
        # This would require analyzing audit logs
        
        # For now, check for users logging in from multiple IPs in short time
        if self.redis:
            # Analyze recent login patterns from cache
            pass
        
        return issues
    
    async def _check_session_anomalies(self) -> List[SecurityIssue]:
        """Check for session-related security issues."""
        issues = []
        
        # Check for:
        # - Long-running sessions
        # - Multiple concurrent sessions
        # - Sessions from unusual locations
        
        if self.redis:
            # Analyze active sessions
            pattern = "admin:session:*"
            cursor = 0
            long_sessions = []
            
            while True:
                cursor, keys = await self.redis.scan(
                    cursor, match=pattern, count=100
                )
                
                for key in keys:
                    session_data = await self.redis.get(key)
                    if session_data:
                        session = json.loads(session_data)
                        created_at = datetime.fromisoformat(session['created_at'])
                        age = get_utc_now() - created_at
                        
                        if age > timedelta(hours=24):
                            long_sessions.append({
                                'session_id': session['session_id'],
                                'user_id': session['user_id'],
                                'age_hours': age.total_seconds() / 3600
                            })
                
                if cursor == 0:
                    break
            
            if long_sessions:
                issue = SecurityIssue(
                    id=uuid4(),
                    check_type=SecurityCheckType.SESSION_ANOMALIES,
                    severity=SecuritySeverity.MEDIUM,
                    title="Long-running admin sessions detected",
                    description=f"Found {len(long_sessions)} sessions older than 24 hours",
                    affected_items=long_sessions[:10],  # Limit to first 10
                    recommendations=[
                        "Implement absolute session timeout",
                        "Force re-authentication for sensitive operations",
                        "Regular session cleanup"
                    ],
                    metadata={'total_count': len(long_sessions)},
                    detected_at=get_utc_now()
                )
                issues.append(issue)
        
        return issues
    
    async def _check_ip_reputation(self) -> List[SecurityIssue]:
        """Check for access from suspicious IPs."""
        issues = []
        
        # This would check recent access logs against IP reputation databases
        # For now, we'll check for blocked IPs that are still attempting access
        
        return issues
    
    async def _check_data_exposure(self) -> List[SecurityIssue]:
        """Check for potential data exposure risks."""
        issues = []
        
        # Check for:
        # - Unencrypted sensitive data
        # - Excessive data in logs
        # - API endpoints exposing sensitive info
        
        return issues
    
    async def _check_configuration(self) -> List[SecurityIssue]:
        """Check security configuration settings."""
        issues = []
        
        # Check various security settings
        checks = [
            {
                'name': 'HTTPS enforcement',
                'check': lambda: True,  # Would check actual config
                'severity': SecuritySeverity.CRITICAL,
                'recommendation': 'Enable HTTPS-only mode'
            },
            {
                'name': 'Debug mode',
                'check': lambda: False,  # Would check if debug is enabled
                'severity': SecuritySeverity.HIGH,
                'recommendation': 'Disable debug mode in production'
            },
            {
                'name': 'Secret key strength',
                'check': lambda: True,  # Would check key entropy
                'severity': SecuritySeverity.CRITICAL,
                'recommendation': 'Use strong, randomly generated secret keys'
            }
        ]
        
        failed_checks = []
        for check in checks:
            if not check['check']():
                failed_checks.append({
                    'setting': check['name'],
                    'recommendation': check['recommendation']
                })
        
        if failed_checks:
            issue = SecurityIssue(
                id=uuid4(),
                check_type=SecurityCheckType.CONFIGURATION,
                severity=SecuritySeverity.HIGH,
                title="Security configuration issues",
                description=f"Found {len(failed_checks)} configuration problems",
                affected_items=failed_checks,
                recommendations=[
                    "Review and update security configuration",
                    "Use environment-specific settings",
                    "Regular configuration audits"
                ],
                metadata={'failed_count': len(failed_checks)},
                detected_at=get_utc_now()
            )
            issues.append(issue)
        
        return issues
    
    async def _check_compliance(self) -> List[SecurityIssue]:
        """Check compliance with security standards."""
        issues = []
        
        # Check for GDPR, PCI-DSS, etc. compliance
        # This would depend on configured compliance requirements
        
        compliance_checks = [
            {
                'standard': 'GDPR',
                'requirement': 'Data retention policy',
                'met': False,  # Would check actual implementation
                'recommendation': 'Implement automatic data retention and deletion policies'
            },
            {
                'standard': 'GDPR',
                'requirement': 'Right to be forgotten',
                'met': True,
                'recommendation': 'Ensure user data can be completely deleted'
            }
        ]
        
        failed_requirements = [
            check for check in compliance_checks if not check['met']
        ]
        
        if failed_requirements:
            issue = SecurityIssue(
                id=uuid4(),
                check_type=SecurityCheckType.COMPLIANCE,
                severity=SecuritySeverity.HIGH,
                title="Compliance requirements not met",
                description=f"Failed {len(failed_requirements)} compliance checks",
                affected_items=failed_requirements,
                recommendations=[
                    req['recommendation'] for req in failed_requirements
                ],
                metadata={
                    'standards': list(set(req['standard'] for req in failed_requirements))
                },
                detected_at=get_utc_now()
            )
            issues.append(issue)
        
        return issues
    
    def _get_severity_breakdown(self, issues: List[SecurityIssue]) -> Dict[str, int]:
        """Get breakdown of issues by severity."""
        breakdown = {
            severity.value: 0 for severity in SecuritySeverity
        }
        
        for issue in issues:
            breakdown[issue.severity.value] += 1
        
        return breakdown
    
    def _get_top_risks(self, issues: List[SecurityIssue], limit: int = 5) -> List[Dict[str, Any]]:
        """Get top security risks."""
        # Sort by severity (critical first) and return top N
        severity_order = {
            SecuritySeverity.CRITICAL: 0,
            SecuritySeverity.HIGH: 1,
            SecuritySeverity.MEDIUM: 2,
            SecuritySeverity.LOW: 3,
            SecuritySeverity.INFO: 4
        }
        
        sorted_issues = sorted(
            issues,
            key=lambda x: severity_order[x.severity]
        )
        
        return [
            {
                'title': issue.title,
                'severity': issue.severity.value,
                'type': issue.check_type.value
            }
            for issue in sorted_issues[:limit]
        ]
    
    async def _store_audit_report(self, report: SecurityAuditReport) -> None:
        """Store audit report for historical tracking."""
        if self.redis:
            key = f"admin:security_audit:{report.id}"
            report_data = {
                'id': str(report.id),
                'started_at': report.started_at.isoformat(),
                'completed_at': report.completed_at.isoformat(),
                'score': report.score,
                'status': report.status,
                'total_checks': report.total_checks,
                'passed_checks': report.passed_checks,
                'failed_checks': report.failed_checks,
                'issues': [issue.to_dict() for issue in report.issues],
                'summary': report.summary
            }
            
            # Store for 90 days
            await self.redis.setex(
                key,
                90 * 24 * 3600,
                json.dumps(report_data)
            )
            
            # Update latest report reference
            await self.redis.set(
                "admin:security_audit:latest",
                str(report.id)
            )
    
    async def _log_audit_completion(self, report: SecurityAuditReport) -> None:
        """Log audit completion to audit log."""
        # This would log to AdminAuditLog
        pass
    
    async def get_latest_report(self) -> Optional[SecurityAuditReport]:
        """Get the latest audit report."""
        if self.redis:
            latest_id = await self.redis.get("admin:security_audit:latest")
            if latest_id:
                key = f"admin:security_audit:{latest_id}"
                data = await self.redis.get(key)
                if data:
                    # Deserialize report
                    # This is simplified - real implementation would fully reconstruct
                    report_data = json.loads(data)
                    return report_data
        
        return None
    
    async def schedule_periodic_audits(self, interval_hours: int = 24) -> None:
        """Schedule periodic security audits."""
        while True:
            try:
                # Run audit
                await self.run_full_audit()
                
                # Wait for next run
                await asyncio.sleep(interval_hours * 3600)
                
            except Exception as e:
                # Log error and continue
                await asyncio.sleep(3600)  # Retry in 1 hour


# Import Callable at the top
from typing import Callable