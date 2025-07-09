"""
Advanced audit system for administrative operations.

This service provides comprehensive audit functionality including:
- Tamper-proof storage with cryptographic checksums
- Anomaly detection for suspicious activities
- Automated archiving and retention policies
- Real-time monitoring and alerting
- Compliance reporting
"""

import hashlib
import json
from datetime import datetime, timedelta, timezone
from typing import Optional, List, Dict, Any, Tuple, Set
from uuid import UUID
import asyncio
from collections import defaultdict, Counter
from enum import Enum

from sqlalchemy import select, func, and_, or_, desc, delete, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy.dialects.postgresql import insert

from jidelnicek.core.utils import get_utc_now
from jidelnicek.auth.models import AuthUser
from jidelnicek.admin.models import (
    AdminAuditLog, AdminAction, AuditLogChecksum, AuditLogArchive,
    AuditAlert, AuditMetrics
)
from jidelnicek.admin.schemas import AuditLogFilter


class AlertType(str, Enum):
    """Types of audit alerts."""
    EXCESSIVE_FAILURES = "excessive_failures"
    UNUSUAL_ACTIVITY = "unusual_activity"
    PRIVILEGE_ESCALATION = "privilege_escalation"
    BULK_OPERATION = "bulk_operation"
    DATA_EXPORT = "data_export"
    AFTER_HOURS_ACCESS = "after_hours_access"
    RAPID_ACTIONS = "rapid_actions"
    UNAUTHORIZED_ACCESS = "unauthorized_access"
    CHECKSUM_MISMATCH = "checksum_mismatch"


class AlertSeverity(str, Enum):
    """Alert severity levels."""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class AdvancedAuditSystem:
    """Advanced audit system with integrity protection and monitoring."""
    
    def __init__(self, db: AsyncSession):
        """
        Initialize the advanced audit system.
        
        Args:
            db: Database session
        """
        self.db = db
        
        # Configuration for anomaly detection
        self.anomaly_config = {
            "max_failures_per_hour": 10,
            "max_actions_per_minute": 30,
            "after_hours_start": 22,  # 10 PM
            "after_hours_end": 6,     # 6 AM
            "sensitive_actions": {
                AdminAction.USER_DELETE,
                AdminAction.BULK_DELETE,
                AdminAction.USER_RESET_PASSWORD,
                AdminAction.DATA_EXPORT,
                AdminAction.SYSTEM_CONFIG_UPDATE
            }
        }
        
        # Retention policies (in days)
        self.retention_policies = {
            "active": 90,      # Keep in main table
            "archive": 730,    # Keep in archive (2 years)
            "metrics": 365     # Keep metrics
        }
    
    async def log_action(
        self,
        admin_id: UUID,
        action: AdminAction,
        target_type: str,
        target_id: Optional[UUID] = None,
        target_ids: Optional[List[str]] = None,
        before_state: Optional[Dict[str, Any]] = None,
        after_state: Optional[Dict[str, Any]] = None,
        changes: Optional[Dict[str, Any]] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        request_id: Optional[str] = None,
        reason: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
        success: bool = True,
        error_message: Optional[str] = None,
        response_time_ms: Optional[float] = None
    ) -> AdminAuditLog:
        """
        Log an administrative action with integrity protection.
        
        Args:
            admin_id: ID of admin performing action
            action: The action being performed
            target_type: Type of target (user, ingredient, etc.)
            target_id: Single target ID
            target_ids: Multiple target IDs for bulk operations
            before_state: State before changes
            after_state: State after changes
            changes: Specific changes made
            ip_address: Client IP address
            user_agent: Client user agent
            request_id: Request tracking ID
            reason: Reason for action
            metadata: Additional metadata
            success: Whether action succeeded
            error_message: Error message if failed
            response_time_ms: Response time in milliseconds
            
        Returns:
            Created audit log entry
        """
        # Create audit log entry
        audit_log = AdminAuditLog(
            admin_id=admin_id,
            action=action,
            target_type=target_type,
            target_id=target_id,
            target_ids=target_ids,
            before_state=before_state,
            after_state=after_state,
            changes=changes,
            ip_address=ip_address,
            user_agent=user_agent,
            request_id=request_id,
            reason=reason,
            metadata=metadata or {},
            success=success,
            error_message=error_message,
            created_at=get_utc_now()
        )
        
        # Add performance metrics to metadata
        if response_time_ms is not None:
            audit_log.metadata["response_time_ms"] = response_time_ms
        
        self.db.add(audit_log)
        await self.db.flush()
        
        # Calculate and store checksum
        await self._create_checksum(audit_log)
        
        # Check for anomalies
        await self._check_anomalies(audit_log)
        
        # Update metrics
        await self._update_metrics(audit_log)
        
        return audit_log
    
    async def _create_checksum(self, audit_log: AdminAuditLog) -> AuditLogChecksum:
        """
        Create cryptographic checksum for audit log entry.
        
        Args:
            audit_log: The audit log entry
            
        Returns:
            Created checksum record
        """
        # Get the previous checksum
        result = await self.db.execute(
            select(AuditLogChecksum)
            .order_by(desc(AuditLogChecksum.sequence_number))
            .limit(1)
        )
        previous_checksum = result.scalar_one_or_none()
        
        # Calculate sequence number
        sequence_number = (previous_checksum.sequence_number + 1) if previous_checksum else 1
        
        # Serialize audit log data
        log_data = {
            "id": str(audit_log.id),
            "admin_id": str(audit_log.admin_id),
            "action": audit_log.action.value,
            "target_type": audit_log.target_type,
            "target_id": str(audit_log.target_id) if audit_log.target_id else None,
            "target_ids": audit_log.target_ids,
            "changes": audit_log.changes,
            "reason": audit_log.reason,
            "success": audit_log.success,
            "created_at": audit_log.created_at.isoformat()
        }
        
        # Create checksum including previous checksum for chain integrity
        checksum_input = json.dumps(log_data, sort_keys=True)
        if previous_checksum:
            checksum_input = f"{previous_checksum.checksum}:{checksum_input}"
        
        checksum = hashlib.sha256(checksum_input.encode()).hexdigest()
        
        # Store checksum
        checksum_record = AuditLogChecksum(
            audit_log_id=audit_log.id,
            checksum=checksum,
            previous_checksum=previous_checksum.checksum if previous_checksum else None,
            sequence_number=sequence_number,
            created_at=get_utc_now()
        )
        
        self.db.add(checksum_record)
        await self.db.flush()
        
        return checksum_record
    
    async def verify_integrity(
        self,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """
        Verify integrity of audit logs.
        
        Args:
            start_date: Start date for verification
            end_date: End date for verification
            
        Returns:
            Verification results
        """
        # Build query for checksums
        query = select(AuditLogChecksum).options(
            selectinload(AuditLogChecksum.audit_log)
        ).order_by(AuditLogChecksum.sequence_number)
        
        if start_date or end_date:
            conditions = []
            if start_date:
                conditions.append(AuditLogChecksum.created_at >= start_date)
            if end_date:
                conditions.append(AuditLogChecksum.created_at <= end_date)
            query = query.where(and_(*conditions))
        
        result = await self.db.execute(query)
        checksums = result.scalars().all()
        
        # Verify chain integrity
        issues = []
        verified_count = 0
        
        for i, checksum_record in enumerate(checksums):
            # Verify sequence
            expected_sequence = i + 1
            if checksum_record.sequence_number != expected_sequence:
                issues.append({
                    "type": "sequence_gap",
                    "audit_log_id": str(checksum_record.audit_log_id),
                    "expected_sequence": expected_sequence,
                    "actual_sequence": checksum_record.sequence_number
                })
            
            # Verify checksum
            if checksum_record.audit_log:
                log_data = {
                    "id": str(checksum_record.audit_log.id),
                    "admin_id": str(checksum_record.audit_log.admin_id),
                    "action": checksum_record.audit_log.action.value,
                    "target_type": checksum_record.audit_log.target_type,
                    "target_id": str(checksum_record.audit_log.target_id) if checksum_record.audit_log.target_id else None,
                    "target_ids": checksum_record.audit_log.target_ids,
                    "changes": checksum_record.audit_log.changes,
                    "reason": checksum_record.audit_log.reason,
                    "success": checksum_record.audit_log.success,
                    "created_at": checksum_record.audit_log.created_at.isoformat()
                }
                
                checksum_input = json.dumps(log_data, sort_keys=True)
                if checksum_record.previous_checksum:
                    checksum_input = f"{checksum_record.previous_checksum}:{checksum_input}"
                
                calculated_checksum = hashlib.sha256(checksum_input.encode()).hexdigest()
                
                if calculated_checksum != checksum_record.checksum:
                    issues.append({
                        "type": "checksum_mismatch",
                        "audit_log_id": str(checksum_record.audit_log_id),
                        "expected_checksum": calculated_checksum,
                        "actual_checksum": checksum_record.checksum
                    })
                    
                    # Create alert for checksum mismatch
                    await self._create_alert(
                        alert_type=AlertType.CHECKSUM_MISMATCH,
                        severity=AlertSeverity.CRITICAL,
                        title="Audit Log Integrity Violation",
                        description=f"Checksum mismatch detected for audit log {checksum_record.audit_log_id}",
                        related_audit_logs=[str(checksum_record.audit_log_id)],
                        metadata={"issue": issues[-1]}
                    )
                else:
                    verified_count += 1
            
            # Verify chain continuity
            if i > 0 and checksum_record.previous_checksum != checksums[i-1].checksum:
                issues.append({
                    "type": "chain_break",
                    "audit_log_id": str(checksum_record.audit_log_id),
                    "expected_previous": checksums[i-1].checksum,
                    "actual_previous": checksum_record.previous_checksum
                })
        
        return {
            "total_checked": len(checksums),
            "verified": verified_count,
            "issues_found": len(issues),
            "issues": issues,
            "integrity_status": "intact" if not issues else "compromised",
            "verification_timestamp": get_utc_now().isoformat()
        }
    
    async def _check_anomalies(self, audit_log: AdminAuditLog):
        """
        Check for anomalous activity patterns.
        
        Args:
            audit_log: The new audit log entry
        """
        now = get_utc_now()
        
        # Check for excessive failures
        if not audit_log.success:
            failures_count = await self.db.execute(
                select(func.count(AdminAuditLog.id))
                .where(
                    and_(
                        AdminAuditLog.admin_id == audit_log.admin_id,
                        AdminAuditLog.success == False,
                        AdminAuditLog.created_at >= now - timedelta(hours=1)
                    )
                )
            )
            
            if failures_count.scalar_one() > self.anomaly_config["max_failures_per_hour"]:
                await self._create_alert(
                    alert_type=AlertType.EXCESSIVE_FAILURES,
                    severity=AlertSeverity.HIGH,
                    title="Excessive Failed Operations",
                    description=f"Admin {audit_log.admin_id} has exceeded failure threshold",
                    admin_id=audit_log.admin_id,
                    related_audit_logs=[str(audit_log.id)]
                )
        
        # Check for rapid actions
        recent_actions = await self.db.execute(
            select(func.count(AdminAuditLog.id))
            .where(
                and_(
                    AdminAuditLog.admin_id == audit_log.admin_id,
                    AdminAuditLog.created_at >= now - timedelta(minutes=1)
                )
            )
        )
        
        if recent_actions.scalar_one() > self.anomaly_config["max_actions_per_minute"]:
            await self._create_alert(
                alert_type=AlertType.RAPID_ACTIONS,
                severity=AlertSeverity.MEDIUM,
                title="Unusually Rapid Admin Actions",
                description=f"Admin {audit_log.admin_id} is performing actions too quickly",
                admin_id=audit_log.admin_id,
                related_audit_logs=[str(audit_log.id)]
            )
        
        # Check for after-hours access
        hour = now.hour
        if (hour >= self.anomaly_config["after_hours_start"] or 
            hour < self.anomaly_config["after_hours_end"]):
            
            # Check if this is a sensitive action
            if audit_log.action in self.anomaly_config["sensitive_actions"]:
                await self._create_alert(
                    alert_type=AlertType.AFTER_HOURS_ACCESS,
                    severity=AlertSeverity.MEDIUM,
                    title="Sensitive Action During After Hours",
                    description=f"Admin {audit_log.admin_id} performed {audit_log.action.value} outside business hours",
                    admin_id=audit_log.admin_id,
                    related_audit_logs=[str(audit_log.id)]
                )
        
        # Check for bulk operations
        if audit_log.target_ids and len(audit_log.target_ids) > 10:
            await self._create_alert(
                alert_type=AlertType.BULK_OPERATION,
                severity=AlertSeverity.LOW,
                title="Large Bulk Operation",
                description=f"Admin {audit_log.admin_id} performed bulk operation on {len(audit_log.target_ids)} items",
                admin_id=audit_log.admin_id,
                related_audit_logs=[str(audit_log.id)]
            )
        
        # Check for data exports
        if audit_log.action in [AdminAction.DATA_EXPORT, AdminAction.USER_EXPORT, AdminAction.AUDIT_LOG_EXPORT]:
            await self._create_alert(
                alert_type=AlertType.DATA_EXPORT,
                severity=AlertSeverity.MEDIUM,
                title="Data Export Operation",
                description=f"Admin {audit_log.admin_id} exported {audit_log.target_type} data",
                admin_id=audit_log.admin_id,
                related_audit_logs=[str(audit_log.id)]
            )
    
    async def _create_alert(
        self,
        alert_type: AlertType,
        severity: AlertSeverity,
        title: str,
        description: str,
        admin_id: Optional[UUID] = None,
        related_audit_logs: Optional[List[str]] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> AuditAlert:
        """
        Create an audit alert.
        
        Args:
            alert_type: Type of alert
            severity: Alert severity
            title: Alert title
            description: Alert description
            admin_id: Related admin ID
            related_audit_logs: Related audit log IDs
            metadata: Additional metadata
            
        Returns:
            Created alert
        """
        alert = AuditAlert(
            alert_type=alert_type.value,
            severity=severity.value,
            title=title,
            description=description,
            admin_id=admin_id,
            related_audit_logs=related_audit_logs or [],
            detection_metadata=metadata or {},
            status="new",
            created_at=get_utc_now()
        )
        
        self.db.add(alert)
        await self.db.flush()
        
        return alert
    
    async def _update_metrics(self, audit_log: AdminAuditLog):
        """
        Update audit metrics for the current period.
        
        Args:
            audit_log: The audit log entry
        """
        now = audit_log.created_at
        
        # Calculate period boundaries
        hour_start = now.replace(minute=0, second=0, microsecond=0)
        hour_end = hour_start + timedelta(hours=1)
        
        # Try to update existing metrics
        stmt = insert(AuditMetrics).values(
            period_start=hour_start,
            period_end=hour_end,
            period_type="hour",
            action_counts={audit_log.action.value: 1},
            total_actions=1,
            successful_actions=1 if audit_log.success else 0,
            failed_actions=0 if audit_log.success else 1,
            unique_admins=1,
            admin_action_counts={str(audit_log.admin_id): 1},
            target_type_counts={audit_log.target_type: 1},
            alerts_generated=0,
            calculated_at=now
        )
        
        # On conflict, increment counters
        stmt = stmt.on_conflict_do_update(
            index_elements=['period_type', 'period_start', 'period_end'],
            set_={
                'total_actions': AuditMetrics.total_actions + 1,
                'successful_actions': AuditMetrics.successful_actions + (1 if audit_log.success else 0),
                'failed_actions': AuditMetrics.failed_actions + (0 if audit_log.success else 1),
                'calculated_at': now
            }
        )
        
        await self.db.execute(stmt)
    
    async def archive_old_logs(self) -> Dict[str, int]:
        """
        Archive old audit logs based on retention policy.
        
        Returns:
            Archive statistics
        """
        cutoff_date = get_utc_now() - timedelta(days=self.retention_policies["active"])
        
        # Get logs to archive
        result = await self.db.execute(
            select(AdminAuditLog)
            .options(selectinload(AdminAuditLog.admin))
            .where(AdminAuditLog.created_at < cutoff_date)
            .limit(1000)  # Process in batches
        )
        logs_to_archive = result.scalars().all()
        
        archived_count = 0
        
        for log in logs_to_archive:
            # Get checksum
            checksum_result = await self.db.execute(
                select(AuditLogChecksum)
                .where(AuditLogChecksum.audit_log_id == log.id)
            )
            checksum = checksum_result.scalar_one_or_none()
            
            # Create archive entry
            archive_entry = AuditLogArchive(
                id=log.id,
                admin_id=log.admin_id,
                action=log.action.value,
                target_type=log.target_type,
                target_id=log.target_id,
                target_ids=log.target_ids,
                before_state=log.before_state,
                after_state=log.after_state,
                changes=log.changes,
                ip_address=log.ip_address,
                user_agent=log.user_agent,
                request_id=log.request_id,
                reason=log.reason,
                metadata=log.metadata,
                success=log.success,
                error_message=log.error_message,
                created_at=log.created_at,
                archived_at=get_utc_now(),
                archive_reason="retention_policy",
                checksum=checksum.checksum if checksum else "",
                admin_email=log.admin.email if log.admin else "unknown"
            )
            
            self.db.add(archive_entry)
            
            # Delete original log (cascade will delete checksum)
            await self.db.delete(log)
            
            archived_count += 1
        
        # Clean up old archives
        archive_cutoff = get_utc_now() - timedelta(days=self.retention_policies["archive"])
        await self.db.execute(
            delete(AuditLogArchive)
            .where(AuditLogArchive.created_at < archive_cutoff)
        )
        
        # Clean up old metrics
        metrics_cutoff = get_utc_now() - timedelta(days=self.retention_policies["metrics"])
        await self.db.execute(
            delete(AuditMetrics)
            .where(AuditMetrics.period_start < metrics_cutoff)
        )
        
        await self.db.commit()
        
        return {
            "archived": archived_count,
            "archive_cutoff_date": cutoff_date.isoformat(),
            "permanent_deletion_cutoff": archive_cutoff.isoformat()
        }
    
    async def get_performance_metrics(
        self,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        period_type: str = "hour"
    ) -> List[Dict[str, Any]]:
        """
        Get performance metrics for audit operations.
        
        Args:
            start_date: Start date
            end_date: End date
            period_type: Aggregation period (hour, day, week, month)
            
        Returns:
            Performance metrics
        """
        query = select(AuditMetrics).where(
            AuditMetrics.period_type == period_type
        ).order_by(AuditMetrics.period_start)
        
        conditions = []
        if start_date:
            conditions.append(AuditMetrics.period_start >= start_date)
        if end_date:
            conditions.append(AuditMetrics.period_end <= end_date)
        
        if conditions:
            query = query.where(and_(*conditions))
        
        result = await self.db.execute(query)
        metrics = result.scalars().all()
        
        return [
            {
                "period_start": m.period_start.isoformat(),
                "period_end": m.period_end.isoformat(),
                "total_actions": m.total_actions,
                "success_rate": (m.successful_actions / m.total_actions * 100) if m.total_actions > 0 else 0,
                "unique_admins": m.unique_admins,
                "action_breakdown": m.action_counts,
                "avg_response_time_ms": m.avg_response_time_ms,
                "max_response_time_ms": m.max_response_time_ms,
                "alerts_generated": m.alerts_generated
            }
            for m in metrics
        ]
    
    async def generate_compliance_report(
        self,
        start_date: datetime,
        end_date: datetime,
        include_details: bool = False
    ) -> Dict[str, Any]:
        """
        Generate a compliance report for regulatory requirements.
        
        Args:
            start_date: Report start date
            end_date: Report end date
            include_details: Include detailed log entries
            
        Returns:
            Compliance report data
        """
        # Get summary statistics
        total_result = await self.db.execute(
            select(func.count(AdminAuditLog.id))
            .where(
                and_(
                    AdminAuditLog.created_at >= start_date,
                    AdminAuditLog.created_at <= end_date
                )
            )
        )
        total_actions = total_result.scalar_one()
        
        # Get actions by type
        actions_result = await self.db.execute(
            select(
                AdminAuditLog.action,
                func.count(AdminAuditLog.id)
            )
            .where(
                and_(
                    AdminAuditLog.created_at >= start_date,
                    AdminAuditLog.created_at <= end_date
                )
            )
            .group_by(AdminAuditLog.action)
        )
        actions_by_type = {
            action.value: count
            for action, count in actions_result
        }
        
        # Get admin activity summary
        admin_result = await self.db.execute(
            select(
                AdminAuditLog.admin_id,
                func.count(AdminAuditLog.id)
            )
            .where(
                and_(
                    AdminAuditLog.created_at >= start_date,
                    AdminAuditLog.created_at <= end_date
                )
            )
            .group_by(AdminAuditLog.admin_id)
        )
        
        admin_activity = []
        for admin_id, count in admin_result:
            admin_data = await self.db.execute(
                select(AuthUser).where(AuthUser.id == admin_id)
            )
            admin = admin_data.scalar_one_or_none()
            if admin:
                admin_activity.append({
                    "admin_id": str(admin_id),
                    "email": admin.email,
                    "action_count": count
                })
        
        # Get sensitive operations
        sensitive_result = await self.db.execute(
            select(AdminAuditLog)
            .where(
                and_(
                    AdminAuditLog.created_at >= start_date,
                    AdminAuditLog.created_at <= end_date,
                    AdminAuditLog.action.in_(list(self.anomaly_config["sensitive_actions"]))
                )
            )
            .order_by(AdminAuditLog.created_at)
        )
        sensitive_operations = sensitive_result.scalars().all()
        
        # Get integrity verification
        integrity_check = await self.verify_integrity(start_date, end_date)
        
        # Get alerts during period
        alerts_result = await self.db.execute(
            select(AuditAlert)
            .where(
                and_(
                    AuditAlert.created_at >= start_date,
                    AuditAlert.created_at <= end_date
                )
            )
            .order_by(AuditAlert.created_at)
        )
        alerts = alerts_result.scalars().all()
        
        report = {
            "report_metadata": {
                "generated_at": get_utc_now().isoformat(),
                "period_start": start_date.isoformat(),
                "period_end": end_date.isoformat(),
                "report_type": "compliance_audit"
            },
            "summary": {
                "total_actions": total_actions,
                "actions_by_type": actions_by_type,
                "unique_admins": len(admin_activity),
                "sensitive_operations_count": len(sensitive_operations),
                "alerts_generated": len(alerts),
                "integrity_status": integrity_check["integrity_status"]
            },
            "admin_activity": admin_activity,
            "sensitive_operations": [
                {
                    "id": str(op.id),
                    "timestamp": op.created_at.isoformat(),
                    "admin_id": str(op.admin_id),
                    "action": op.action.value,
                    "target_type": op.target_type,
                    "target_id": str(op.target_id) if op.target_id else None,
                    "reason": op.reason,
                    "success": op.success
                }
                for op in sensitive_operations
            ],
            "security_alerts": [
                {
                    "id": str(alert.id),
                    "timestamp": alert.created_at.isoformat(),
                    "type": alert.alert_type,
                    "severity": alert.severity,
                    "title": alert.title,
                    "status": alert.status
                }
                for alert in alerts
            ],
            "integrity_verification": integrity_check
        }
        
        # Include detailed logs if requested
        if include_details:
            logs_result = await self.db.execute(
                select(AdminAuditLog)
                .options(selectinload(AdminAuditLog.admin))
                .where(
                    and_(
                        AdminAuditLog.created_at >= start_date,
                        AdminAuditLog.created_at <= end_date
                    )
                )
                .order_by(AdminAuditLog.created_at)
                .limit(10000)  # Limit for performance
            )
            logs = logs_result.scalars().all()
            
            report["detailed_logs"] = [
                {
                    "id": str(log.id),
                    "timestamp": log.created_at.isoformat(),
                    "admin_id": str(log.admin_id),
                    "admin_email": log.admin.email if log.admin else "unknown",
                    "action": log.action.value,
                    "target_type": log.target_type,
                    "target_id": str(log.target_id) if log.target_id else None,
                    "success": log.success,
                    "reason": log.reason,
                    "ip_address": log.ip_address
                }
                for log in logs
            ]
        
        return report
    
    async def detect_unusual_patterns(
        self,
        lookback_hours: int = 24
    ) -> List[Dict[str, Any]]:
        """
        Detect unusual activity patterns using statistical analysis.
        
        Args:
            lookback_hours: Hours to look back for pattern analysis
            
        Returns:
            List of detected patterns
        """
        now = get_utc_now()
        lookback_start = now - timedelta(hours=lookback_hours)
        
        patterns = []
        
        # Get all actions in lookback period
        result = await self.db.execute(
            select(AdminAuditLog)
            .where(AdminAuditLog.created_at >= lookback_start)
        )
        recent_logs = result.scalars().all()
        
        if not recent_logs:
            return patterns
        
        # Analyze by admin
        admin_actions = defaultdict(list)
        for log in recent_logs:
            admin_actions[log.admin_id].append(log)
        
        # Check for unusual admin behavior
        for admin_id, logs in admin_actions.items():
            # Time-based analysis
            action_times = [log.created_at for log in logs]
            
            # Check for burst activity
            for i in range(len(action_times) - 10):
                window = action_times[i:i+10]
                duration = (window[-1] - window[0]).total_seconds()
                
                if duration < 60:  # 10 actions in less than a minute
                    patterns.append({
                        "pattern_type": "burst_activity",
                        "admin_id": str(admin_id),
                        "description": "10 actions performed in less than 60 seconds",
                        "timestamp": window[0].isoformat(),
                        "severity": "medium",
                        "action_count": 10,
                        "duration_seconds": duration
                    })
            
            # Check for unusual action mix
            action_counter = Counter(log.action.value for log in logs)
            total_actions = sum(action_counter.values())
            
            # Flag if one action type dominates (>80%)
            for action, count in action_counter.items():
                if count / total_actions > 0.8:
                    patterns.append({
                        "pattern_type": "action_concentration",
                        "admin_id": str(admin_id),
                        "description": f"Admin performing mostly {action} actions",
                        "dominant_action": action,
                        "percentage": round(count / total_actions * 100, 2),
                        "severity": "low"
                    })
            
            # Check for failures pattern
            failures = [log for log in logs if not log.success]
            if len(failures) > 5:
                patterns.append({
                    "pattern_type": "high_failure_rate",
                    "admin_id": str(admin_id),
                    "description": f"Admin has {len(failures)} failed operations",
                    "failure_count": len(failures),
                    "total_actions": len(logs),
                    "failure_rate": round(len(failures) / len(logs) * 100, 2),
                    "severity": "high"
                })
        
        # Check for cross-admin patterns
        # Look for similar actions across multiple admins in short time
        time_windows = defaultdict(list)
        for log in recent_logs:
            window_key = (
                log.created_at.replace(minute=0, second=0, microsecond=0),
                log.action.value
            )
            time_windows[window_key].append(log)
        
        for (timestamp, action), logs in time_windows.items():
            unique_admins = set(log.admin_id for log in logs)
            if len(unique_admins) > 3:
                patterns.append({
                    "pattern_type": "coordinated_activity",
                    "description": f"Multiple admins performing {action} around the same time",
                    "timestamp": timestamp.isoformat(),
                    "action": action,
                    "admin_count": len(unique_admins),
                    "severity": "medium"
                })
        
        return patterns
    
    async def get_alerts(
        self,
        status: Optional[str] = None,
        severity: Optional[str] = None,
        limit: int = 100
    ) -> List[AuditAlert]:
        """
        Get audit alerts.
        
        Args:
            status: Filter by status
            severity: Filter by severity
            limit: Maximum alerts to return
            
        Returns:
            List of alerts
        """
        query = select(AuditAlert).options(
            selectinload(AuditAlert.admin),
            selectinload(AuditAlert.acknowledger)
        )
        
        conditions = []
        if status:
            conditions.append(AuditAlert.status == status)
        if severity:
            conditions.append(AuditAlert.severity == severity)
        
        if conditions:
            query = query.where(and_(*conditions))
        
        query = query.order_by(desc(AuditAlert.created_at)).limit(limit)
        
        result = await self.db.execute(query)
        return result.scalars().all()
    
    async def acknowledge_alert(
        self,
        alert_id: UUID,
        admin_id: UUID,
        notes: Optional[str] = None
    ) -> AuditAlert:
        """
        Acknowledge an alert.
        
        Args:
            alert_id: Alert ID
            admin_id: Admin acknowledging the alert
            notes: Resolution notes
            
        Returns:
            Updated alert
        """
        result = await self.db.execute(
            select(AuditAlert).where(AuditAlert.id == alert_id)
        )
        alert = result.scalar_one_or_none()
        
        if not alert:
            raise ValueError(f"Alert {alert_id} not found")
        
        alert.status = "acknowledged"
        alert.acknowledged_by = admin_id
        alert.acknowledged_at = get_utc_now()
        alert.resolution_notes = notes
        
        await self.db.commit()
        return alert