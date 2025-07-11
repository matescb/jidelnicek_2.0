"""
Comprehensive tests for the advanced audit logging system.

Tests cover:
- Audit log creation and integrity
- Checksum verification
- Anomaly detection
- Alert generation
- Archiving and retention
- Performance metrics
- Compliance reporting
"""

import pytest
import pytest_asyncio
from datetime import datetime, timedelta, timezone
from uuid import uuid4
import asyncio
from typing import List

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from jidelnicek.admin.services.audit_system import (
    AdvancedAuditSystem, AlertType, AlertSeverity
)
from jidelnicek.admin.models import (
    AdminAction, AdminAuditLog, AuditLogChecksum,
    AuditAlert, AuditMetrics, AuditLogArchive
)
from jidelnicek.auth.models import AuthUser
from jidelnicek.core.utils import get_utc_now


@pytest_asyncio.fixture(scope="function")
async def audit_system(db_session: AsyncSession) -> AdvancedAuditSystem:
    """Create an audit system instance."""
    return AdvancedAuditSystem(db_session)


@pytest_asyncio.fixture(scope="function")
async def admin_user(db_session: AsyncSession) -> AuthUser:
    """Create a test admin user."""
    user = AuthUser(
        email="admin@test.com",
        role="admin",
        email_verified=True,
        hashed_password="dummy_hash"
    )
    db_session.add(user)
    await db_session.commit()
    return user


class TestAuditLogging:
    """Test basic audit logging functionality."""
    
    async def test_log_successful_action(
        self,
        audit_system: AdvancedAuditSystem,
        admin_user: AuthUser,
        db_session: AsyncSession
    ):
        """Test logging a successful administrative action."""
        # Log an action
        audit_log = await audit_system.log_action(
            admin_id=admin_user.id,
            action=AdminAction.USER_UPDATE,
            target_type="user",
            target_id=uuid4(),
            changes={"email": {"old": "old@test.com", "new": "new@test.com"}},
            reason="Email change requested by user",
            ip_address="192.168.1.100",
            user_agent="Mozilla/5.0",
            success=True
        )
        
        await db_session.commit()
        
        # Verify log was created
        assert audit_log.id is not None
        assert audit_log.admin_id == admin_user.id
        assert audit_log.action == AdminAction.USER_UPDATE
        assert audit_log.success is True
        
        # Verify checksum was created
        checksum_result = await db_session.execute(
            select(AuditLogChecksum).where(
                AuditLogChecksum.audit_log_id == audit_log.id
            )
        )
        checksum = checksum_result.scalar_one()
        assert checksum is not None
        assert len(checksum.checksum) == 64  # SHA-256 hex digest
        assert checksum.sequence_number == 1
    
    async def test_log_failed_action(
        self,
        audit_system: AdvancedAuditSystem,
        admin_user: AuthUser
    ):
        """Test logging a failed administrative action."""
        audit_log = await audit_system.log_action(
            admin_id=admin_user.id,
            action=AdminAction.USER_DELETE,
            target_type="user",
            target_id=uuid4(),
            success=False,
            error_message="User has active sessions"
        )
        
        assert audit_log.success is False
        assert audit_log.error_message == "User has active sessions"
    
    async def test_bulk_operation_logging(
        self,
        audit_system: AdvancedAuditSystem,
        admin_user: AuthUser
    ):
        """Test logging bulk operations."""
        target_ids = [str(uuid4()) for _ in range(5)]
        
        audit_log = await audit_system.log_action(
            admin_id=admin_user.id,
            action=AdminAction.BULK_SUSPEND,
            target_type="user",
            target_ids=target_ids,
            reason="Suspicious activity detected"
        )
        
        assert audit_log.target_ids == target_ids
        assert audit_log.target_id is None


class TestIntegrityVerification:
    """Test audit log integrity verification."""
    
    async def test_checksum_chain_integrity(
        self,
        audit_system: AdvancedAuditSystem,
        admin_user: AuthUser,
        db_session: AsyncSession
    ):
        """Test that checksums form an unbroken chain."""
        # Create multiple audit logs
        for i in range(5):
            await audit_system.log_action(
                admin_id=admin_user.id,
                action=AdminAction.USER_VIEW,
                target_type="user",
                target_id=uuid4()
            )
        
        await db_session.commit()
        
        # Verify chain integrity
        result = await audit_system.verify_integrity()
        
        assert result["integrity_status"] == "intact"
        assert result["total_checked"] == 5
        assert result["verified"] == 5
        assert len(result["issues"]) == 0
    
    async def test_tamper_detection(
        self,
        audit_system: AdvancedAuditSystem,
        admin_user: AuthUser,
        db_session: AsyncSession
    ):
        """Test detection of tampered audit logs."""
        # Create an audit log
        audit_log = await audit_system.log_action(
            admin_id=admin_user.id,
            action=AdminAction.USER_UPDATE,
            target_type="user",
            target_id=uuid4(),
            reason="Test update"
        )
        
        await db_session.commit()
        
        # Tamper with the audit log
        audit_log.reason = "Tampered reason"
        await db_session.commit()
        
        # Verify integrity should detect tampering
        result = await audit_system.verify_integrity()
        
        assert result["integrity_status"] == "compromised"
        assert len(result["issues"]) > 0
        assert result["issues"][0]["type"] == "checksum_mismatch"
    
    async def test_sequence_gap_detection(
        self,
        audit_system: AdvancedAuditSystem,
        admin_user: AuthUser,
        db_session: AsyncSession
    ):
        """Test detection of sequence gaps in checksums."""
        # Create audit logs
        for i in range(3):
            await audit_system.log_action(
                admin_id=admin_user.id,
                action=AdminAction.USER_VIEW,
                target_type="user",
                target_id=uuid4()
            )
        
        await db_session.commit()
        
        # Delete middle checksum to create gap
        await db_session.execute(
            select(AuditLogChecksum).where(
                AuditLogChecksum.sequence_number == 2
            )
        )
        checksum = (await db_session.execute(
            select(AuditLogChecksum).where(
                AuditLogChecksum.sequence_number == 2
            )
        )).scalar_one()
        
        await db_session.delete(checksum)
        await db_session.commit()
        
        # Verify should detect sequence gap
        result = await audit_system.verify_integrity()
        
        assert result["integrity_status"] == "compromised"
        assert any(issue["type"] == "sequence_gap" for issue in result["issues"])


class TestAnomalyDetection:
    """Test anomaly detection capabilities."""
    
    async def test_excessive_failures_detection(
        self,
        audit_system: AdvancedAuditSystem,
        admin_user: AuthUser,
        db_session: AsyncSession
    ):
        """Test detection of excessive failed operations."""
        # Generate many failed operations
        for i in range(15):
            await audit_system.log_action(
                admin_id=admin_user.id,
                action=AdminAction.USER_DELETE,
                target_type="user",
                target_id=uuid4(),
                success=False,
                error_message="Test failure"
            )
        
        await db_session.commit()
        
        # Check for alerts
        alerts = await audit_system.get_alerts()
        
        assert len(alerts) > 0
        assert any(
            alert.alert_type == AlertType.EXCESSIVE_FAILURES.value
            for alert in alerts
        )
    
    async def test_rapid_actions_detection(
        self,
        audit_system: AdvancedAuditSystem,
        admin_user: AuthUser,
        db_session: AsyncSession
    ):
        """Test detection of unusually rapid actions."""
        # Generate many actions quickly
        for i in range(35):
            await audit_system.log_action(
                admin_id=admin_user.id,
                action=AdminAction.USER_VIEW,
                target_type="user",
                target_id=uuid4()
            )
        
        await db_session.commit()
        
        # Check for alerts
        alerts = await audit_system.get_alerts()
        
        assert any(
            alert.alert_type == AlertType.RAPID_ACTIONS.value
            for alert in alerts
        )
    
    async def test_after_hours_access_detection(
        self,
        audit_system: AdvancedAuditSystem,
        admin_user: AuthUser,
        db_session: AsyncSession
    ):
        """Test detection of after-hours sensitive operations."""
        # Mock after-hours time (11 PM)
        now = get_utc_now().replace(hour=23)
        
        # Perform sensitive action
        with pytest.mock.patch('jidelnicek.core.utils.get_utc_now', return_value=now):
            await audit_system.log_action(
                admin_id=admin_user.id,
                action=AdminAction.USER_DELETE,
                target_type="user",
                target_id=uuid4()
            )
        
        await db_session.commit()
        
        # Check for alerts
        alerts = await audit_system.get_alerts()
        
        assert any(
            alert.alert_type == AlertType.AFTER_HOURS_ACCESS.value
            for alert in alerts
        )
    
    async def test_bulk_operation_alert(
        self,
        audit_system: AdvancedAuditSystem,
        admin_user: AuthUser,
        db_session: AsyncSession
    ):
        """Test alert generation for large bulk operations."""
        # Large bulk operation
        target_ids = [str(uuid4()) for _ in range(50)]
        
        await audit_system.log_action(
            admin_id=admin_user.id,
            action=AdminAction.BULK_DELETE,
            target_type="user",
            target_ids=target_ids
        )
        
        await db_session.commit()
        
        # Check for alerts
        alerts = await audit_system.get_alerts()
        
        assert any(
            alert.alert_type == AlertType.BULK_OPERATION.value
            for alert in alerts
        )
    
    async def test_unusual_patterns_detection(
        self,
        audit_system: AdvancedAuditSystem,
        admin_user: AuthUser,
        db_session: AsyncSession
    ):
        """Test detection of unusual activity patterns."""
        # Create burst activity pattern
        for i in range(15):
            await audit_system.log_action(
                admin_id=admin_user.id,
                action=AdminAction.USER_UPDATE,
                target_type="user",
                target_id=uuid4()
            )
        
        await db_session.commit()
        
        # Detect patterns
        patterns = await audit_system.detect_unusual_patterns(lookback_hours=1)
        
        assert len(patterns) > 0
        assert any(
            pattern["pattern_type"] == "burst_activity"
            for pattern in patterns
        )


class TestArchivingAndRetention:
    """Test log archiving and retention policies."""
    
    async def test_archive_old_logs(
        self,
        audit_system: AdvancedAuditSystem,
        admin_user: AuthUser,
        db_session: AsyncSession
    ):
        """Test archiving of old audit logs."""
        # Create old audit log
        old_date = get_utc_now() - timedelta(days=100)
        
        # Create log with old timestamp
        with pytest.mock.patch('jidelnicek.core.utils.get_utc_now', return_value=old_date):
            old_log = await audit_system.log_action(
                admin_id=admin_user.id,
                action=AdminAction.USER_VIEW,
                target_type="user",
                target_id=uuid4()
            )
        
        await db_session.commit()
        old_log_id = old_log.id
        
        # Create recent log
        recent_log = await audit_system.log_action(
            admin_id=admin_user.id,
            action=AdminAction.USER_VIEW,
            target_type="user",
            target_id=uuid4()
        )
        
        await db_session.commit()
        
        # Run archiving
        result = await audit_system.archive_old_logs()
        
        assert result["archived"] == 1
        
        # Verify old log is archived
        archive_result = await db_session.execute(
            select(AuditLogArchive).where(
                AuditLogArchive.id == old_log_id
            )
        )
        archived = archive_result.scalar_one_or_none()
        assert archived is not None
        
        # Verify recent log is still in main table
        main_result = await db_session.execute(
            select(AdminAuditLog).where(
                AdminAuditLog.id == recent_log.id
            )
        )
        assert main_result.scalar_one_or_none() is not None


class TestPerformanceMetrics:
    """Test performance metrics collection."""
    
    async def test_metrics_aggregation(
        self,
        audit_system: AdvancedAuditSystem,
        admin_user: AuthUser,
        db_session: AsyncSession
    ):
        """Test that metrics are properly aggregated."""
        # Create several audit logs
        for i in range(10):
            await audit_system.log_action(
                admin_id=admin_user.id,
                action=AdminAction.USER_VIEW,
                target_type="user",
                target_id=uuid4(),
                response_time_ms=50.0 + i * 10
            )
        
        await db_session.commit()
        
        # Get metrics
        metrics = await audit_system.get_performance_metrics(
            period_type="hour"
        )
        
        assert len(metrics) > 0
        assert metrics[0]["total_actions"] == 10
        assert metrics[0]["success_rate"] == 100.0


class TestComplianceReporting:
    """Test compliance report generation."""
    
    async def test_generate_compliance_report(
        self,
        audit_system: AdvancedAuditSystem,
        admin_user: AuthUser,
        db_session: AsyncSession
    ):
        """Test generation of compliance reports."""
        # Create various audit logs
        actions = [
            (AdminAction.USER_CREATE, True),
            (AdminAction.USER_UPDATE, True),
            (AdminAction.USER_DELETE, False),
            (AdminAction.DATA_EXPORT, True),
            (AdminAction.SYSTEM_CONFIG_UPDATE, True)
        ]
        
        for action, success in actions:
            await audit_system.log_action(
                admin_id=admin_user.id,
                action=action,
                target_type="user" if "USER" in action.value else "system",
                target_id=uuid4() if "USER" in action.value else None,
                success=success
            )
        
        await db_session.commit()
        
        # Generate report
        start_date = get_utc_now() - timedelta(hours=1)
        end_date = get_utc_now()
        
        report = await audit_system.generate_compliance_report(
            start_date=start_date,
            end_date=end_date,
            include_details=True
        )
        
        # Verify report structure
        assert "report_metadata" in report
        assert "summary" in report
        assert report["summary"]["total_actions"] == 5
        assert "sensitive_operations" in report
        assert "integrity_verification" in report
        assert "detailed_logs" in report
        assert len(report["detailed_logs"]) == 5


class TestAlertManagement:
    """Test alert acknowledgment and management."""
    
    async def test_acknowledge_alert(
        self,
        audit_system: AdvancedAuditSystem,
        admin_user: AuthUser,
        db_session: AsyncSession
    ):
        """Test alert acknowledgment functionality."""
        # Create an alert
        alert = await audit_system._create_alert(
            alert_type=AlertType.EXCESSIVE_FAILURES,
            severity=AlertSeverity.HIGH,
            title="Test Alert",
            description="Test alert description",
            admin_id=admin_user.id
        )
        
        await db_session.commit()
        
        # Acknowledge the alert
        acknowledged = await audit_system.acknowledge_alert(
            alert_id=alert.id,
            admin_id=admin_user.id,
            notes="Investigated and resolved"
        )
        
        assert acknowledged.status == "acknowledged"
        assert acknowledged.acknowledged_by == admin_user.id
        assert acknowledged.resolution_notes == "Investigated and resolved"


class TestMiddlewareIntegration:
    """Test audit middleware integration."""
    
    async def test_middleware_captures_request_data(
        self,
        audit_system: AdvancedAuditSystem,
        admin_user: AuthUser,
        db_session: AsyncSession
    ):
        """Test that middleware properly captures request context."""
        # Simulate middleware logging
        audit_log = await audit_system.log_action(
            admin_id=admin_user.id,
            action=AdminAction.USER_UPDATE,
            target_type="user",
            target_id=uuid4(),
            ip_address="192.168.1.100",
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
            request_id="req-123-456",
            metadata={
                "request": {
                    "method": "PUT",
                    "path": "/admin/users/123",
                    "query_params": {"include_sessions": "true"}
                },
                "response_status": 200
            },
            response_time_ms=125.5
        )
        
        await db_session.commit()
        
        assert audit_log.ip_address == "192.168.1.100"
        assert audit_log.request_id == "req-123-456"
        assert audit_log.metadata["response_status"] == 200
        assert audit_log.metadata["response_time_ms"] == 125.5


@pytest.mark.asyncio
class TestConcurrentOperations:
    """Test system behavior under concurrent operations."""
    
    async def test_concurrent_logging(
        self,
        audit_system: AdvancedAuditSystem,
        admin_user: AuthUser,
        db_session: AsyncSession
    ):
        """Test that concurrent logging maintains integrity."""
        # Create multiple concurrent log operations
        tasks = []
        for i in range(20):
            task = audit_system.log_action(
                admin_id=admin_user.id,
                action=AdminAction.USER_VIEW,
                target_type="user",
                target_id=uuid4()
            )
            tasks.append(task)
        
        # Execute concurrently
        await asyncio.gather(*tasks)
        await db_session.commit()
        
        # Verify integrity
        result = await audit_system.verify_integrity()
        
        assert result["integrity_status"] == "intact"
        assert result["total_checked"] == 20