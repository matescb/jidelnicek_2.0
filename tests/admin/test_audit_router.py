"""
Tests for audit log API endpoints.

Tests cover all audit-related endpoints including:
- Listing and filtering audit logs
- Viewing audit details
- Exporting audit data
- Alert management
- Report generation
- Integrity verification
"""

import pytest
from datetime import datetime, timedelta, timezone
from uuid import uuid4
from typing import Dict, Any, List

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from jidelnicek.admin.models import AdminAction, AdminAuditLog
from jidelnicek.admin.services.audit_system import AdvancedAuditSystem, AlertType
from jidelnicek.auth.models import AuthUser
from jidelnicek.core.utils import get_utc_now


@pytest.fixture
async def admin_token(async_client: AsyncClient, admin_user: AuthUser) -> str:
    """Get authentication token for admin user."""
    response = await async_client.post(
        "/api/v1/auth/login",
        json={
            "email": admin_user.email,
            "password": "admin_password123"
        }
    )
    assert response.status_code == 200
    return response.json()["access_token"]


@pytest.fixture
async def audit_headers(admin_token: str) -> Dict[str, str]:
    """Get headers with admin authentication."""
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture
async def sample_audit_logs(
    db_session: AsyncSession,
    admin_user: AuthUser
) -> List[AdminAuditLog]:
    """Create sample audit logs for testing."""
    audit_system = AdvancedAuditSystem(db_session)
    
    logs = []
    # Create various types of audit logs
    actions = [
        (AdminAction.USER_VIEW, "user", True),
        (AdminAction.USER_UPDATE, "user", True),
        (AdminAction.USER_DELETE, "user", False),
        (AdminAction.INGREDIENT_CREATE, "ingredient", True),
        (AdminAction.AUDIT_LOG_VIEW, "audit_log", True),
    ]
    
    for i, (action, target_type, success) in enumerate(actions):
        log = await audit_system.log_action(
            admin_id=admin_user.id,
            action=action,
            target_type=target_type,
            target_id=uuid4() if target_type != "audit_log" else None,
            reason=f"Test action {i}",
            ip_address="192.168.1.100",
            success=success,
            error_message="Access denied" if not success else None
        )
        logs.append(log)
    
    await db_session.commit()
    return logs


class TestAuditLogListing:
    """Test audit log listing and filtering."""
    
    async def test_list_audit_logs(
        self,
        async_client: AsyncClient,
        audit_headers: Dict[str, str],
        sample_audit_logs: List[AdminAuditLog]
    ):
        """Test basic audit log listing."""
        response = await async_client.get(
            "/api/v1/admin/audit/logs",
            headers=audit_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert "entries" in data
        assert "total" in data
        assert data["total"] >= len(sample_audit_logs)
        assert len(data["entries"]) > 0
        
        # Verify entry structure
        entry = data["entries"][0]
        assert "id" in entry
        assert "admin_id" in entry
        assert "action" in entry
        assert "created_at" in entry
    
    async def test_filter_by_action(
        self,
        async_client: AsyncClient,
        audit_headers: Dict[str, str],
        sample_audit_logs: List[AdminAuditLog]
    ):
        """Test filtering audit logs by action."""
        response = await async_client.get(
            "/api/v1/admin/audit/logs",
            params={"action": AdminAction.USER_UPDATE.value},
            headers=audit_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # All entries should be USER_UPDATE actions
        for entry in data["entries"]:
            assert entry["action"] == AdminAction.USER_UPDATE.value
    
    async def test_filter_by_success_status(
        self,
        async_client: AsyncClient,
        audit_headers: Dict[str, str],
        sample_audit_logs: List[AdminAuditLog]
    ):
        """Test filtering audit logs by success status."""
        # Get only failed actions
        response = await async_client.get(
            "/api/v1/admin/audit/logs",
            params={"success": False},
            headers=audit_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # All entries should be failed actions
        for entry in data["entries"]:
            assert entry["success"] is False
            assert entry["error_message"] is not None
    
    async def test_filter_by_date_range(
        self,
        async_client: AsyncClient,
        audit_headers: Dict[str, str],
        sample_audit_logs: List[AdminAuditLog]
    ):
        """Test filtering audit logs by date range."""
        start_date = get_utc_now() - timedelta(hours=1)
        end_date = get_utc_now()
        
        response = await async_client.get(
            "/api/v1/admin/audit/logs",
            params={
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat()
            },
            headers=audit_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert len(data["entries"]) > 0
    
    async def test_pagination(
        self,
        async_client: AsyncClient,
        audit_headers: Dict[str, str],
        sample_audit_logs: List[AdminAuditLog]
    ):
        """Test audit log pagination."""
        # First page
        response = await async_client.get(
            "/api/v1/admin/audit/logs",
            params={"page": 1, "per_page": 2},
            headers=audit_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert len(data["entries"]) <= 2
        assert data["page"] == 1
        assert data["per_page"] == 2


class TestAuditLogDetails:
    """Test audit log detail viewing."""
    
    async def test_get_audit_log_detail(
        self,
        async_client: AsyncClient,
        audit_headers: Dict[str, str],
        sample_audit_logs: List[AdminAuditLog]
    ):
        """Test viewing detailed audit log information."""
        log = sample_audit_logs[0]
        
        response = await async_client.get(
            f"/api/v1/admin/audit/logs/{log.id}",
            headers=audit_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["id"] == str(log.id)
        assert "admin" in data
        assert "changes" in data
        assert "context" in data
        assert "integrity" in data
    
    async def test_get_nonexistent_log(
        self,
        async_client: AsyncClient,
        audit_headers: Dict[str, str]
    ):
        """Test getting non-existent audit log."""
        fake_id = uuid4()
        
        response = await async_client.get(
            f"/api/v1/admin/audit/logs/{fake_id}",
            headers=audit_headers
        )
        
        assert response.status_code == 404


class TestUserAuditTrail:
    """Test user-specific audit trail endpoints."""
    
    async def test_get_user_audit_trail(
        self,
        async_client: AsyncClient,
        audit_headers: Dict[str, str],
        db_session: AsyncSession,
        admin_user: AuthUser
    ):
        """Test getting audit trail for a specific user."""
        # Create a target user
        target_user = AuthUser(
            email="target@test.com",
            hashed_password="dummy"
        )
        db_session.add(target_user)
        await db_session.commit()
        
        # Create audit logs for this user
        audit_system = AdvancedAuditSystem(db_session)
        for action in [AdminAction.USER_VIEW, AdminAction.USER_UPDATE]:
            await audit_system.log_action(
                admin_id=admin_user.id,
                action=action,
                target_type="user",
                target_id=target_user.id
            )
        
        await db_session.commit()
        
        # Get audit trail
        response = await async_client.get(
            f"/api/v1/admin/audit/user/{target_user.id}/trail",
            headers=audit_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["user_id"] == str(target_user.id)
        assert len(data["audit_trail"]) >= 2


class TestAuditExport:
    """Test audit log export functionality."""
    
    async def test_export_json(
        self,
        async_client: AsyncClient,
        audit_headers: Dict[str, str],
        sample_audit_logs: List[AdminAuditLog]
    ):
        """Test exporting audit logs as JSON."""
        response = await async_client.get(
            "/api/v1/admin/audit/export",
            params={"format": "json"},
            headers=audit_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert "export_date" in data
        assert "total_entries" in data
        assert "data" in data
        assert len(data["data"]) > 0
    
    async def test_export_csv(
        self,
        async_client: AsyncClient,
        audit_headers: Dict[str, str],
        sample_audit_logs: List[AdminAuditLog]
    ):
        """Test exporting audit logs as CSV."""
        response = await async_client.get(
            "/api/v1/admin/audit/export",
            params={"format": "csv"},
            headers=audit_headers
        )
        
        assert response.status_code == 200
        assert response.headers["content-type"] == "text/csv"
        assert "attachment" in response.headers.get("content-disposition", "")
        
        # Verify CSV content
        content = response.text
        lines = content.strip().split('\n')
        assert len(lines) > 1  # Header + data


class TestIntegrityVerification:
    """Test audit log integrity verification."""
    
    async def test_verify_integrity(
        self,
        async_client: AsyncClient,
        audit_headers: Dict[str, str],
        sample_audit_logs: List[AdminAuditLog]
    ):
        """Test integrity verification endpoint."""
        response = await async_client.get(
            "/api/v1/admin/audit/integrity/verify",
            headers=audit_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert "integrity_status" in data
        assert "total_checked" in data
        assert "verified" in data
        assert data["integrity_status"] == "intact"


class TestAlertManagement:
    """Test alert viewing and management."""
    
    async def test_list_alerts(
        self,
        async_client: AsyncClient,
        audit_headers: Dict[str, str],
        db_session: AsyncSession,
        admin_user: AuthUser
    ):
        """Test listing security alerts."""
        # Generate some alerts by creating suspicious activity
        audit_system = AdvancedAuditSystem(db_session)
        
        # Generate excessive failures
        for _ in range(15):
            await audit_system.log_action(
                admin_id=admin_user.id,
                action=AdminAction.USER_DELETE,
                target_type="user",
                target_id=uuid4(),
                success=False
            )
        
        await db_session.commit()
        
        # Get alerts
        response = await async_client.get(
            "/api/v1/admin/audit/alerts",
            headers=audit_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert "alerts" in data
        assert len(data["alerts"]) > 0
        
        # Verify alert structure
        alert = data["alerts"][0]
        assert "id" in alert
        assert "type" in alert
        assert "severity" in alert
        assert "title" in alert
    
    async def test_acknowledge_alert(
        self,
        async_client: AsyncClient,
        audit_headers: Dict[str, str],
        db_session: AsyncSession,
        admin_user: AuthUser
    ):
        """Test acknowledging an alert."""
        # Create an alert
        audit_system = AdvancedAuditSystem(db_session)
        alert = await audit_system._create_alert(
            alert_type=AlertType.DATA_EXPORT,
            severity="medium",
            title="Test Alert",
            description="Test alert for acknowledgment"
        )
        await db_session.commit()
        
        # Acknowledge it
        response = await async_client.post(
            f"/api/v1/admin/audit/alerts/{alert.id}/acknowledge",
            json={"notes": "Reviewed and approved"},
            headers=audit_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True


class TestReportGeneration:
    """Test audit report generation."""
    
    async def test_generate_compliance_report(
        self,
        async_client: AsyncClient,
        audit_headers: Dict[str, str],
        sample_audit_logs: List[AdminAuditLog]
    ):
        """Test generating compliance report."""
        start_date = get_utc_now() - timedelta(days=1)
        end_date = get_utc_now()
        
        response = await async_client.get(
            "/api/v1/admin/audit/reports/compliance",
            params={
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat(),
                "include_details": True
            },
            headers=audit_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert "report_metadata" in data
        assert "summary" in data
        assert "integrity_verification" in data
        assert "detailed_logs" in data
    
    async def test_generate_security_report(
        self,
        async_client: AsyncClient,
        audit_headers: Dict[str, str],
        db_session: AsyncSession,
        admin_user: AuthUser
    ):
        """Test generating security report."""
        start_date = get_utc_now() - timedelta(days=1)
        end_date = get_utc_now()
        
        response = await async_client.get(
            "/api/v1/admin/audit/reports/security",
            params={
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat()
            },
            headers=audit_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["report_type"] == "security"
        assert "alerts_summary" in data
        assert "unusual_patterns" in data


class TestPatternDetection:
    """Test unusual pattern detection."""
    
    async def test_detect_patterns(
        self,
        async_client: AsyncClient,
        audit_headers: Dict[str, str],
        db_session: AsyncSession,
        admin_user: AuthUser
    ):
        """Test pattern detection endpoint."""
        # Create some patterns
        audit_system = AdvancedAuditSystem(db_session)
        
        # Burst activity
        for _ in range(20):
            await audit_system.log_action(
                admin_id=admin_user.id,
                action=AdminAction.USER_UPDATE,
                target_type="user",
                target_id=uuid4()
            )
        
        await db_session.commit()
        
        response = await async_client.get(
            "/api/v1/admin/audit/patterns/unusual",
            params={"lookback_hours": 1},
            headers=audit_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert "patterns" in data
        assert len(data["patterns"]) > 0


class TestArchiving:
    """Test audit log archiving."""
    
    async def test_trigger_archive(
        self,
        async_client: AsyncClient,
        audit_headers: Dict[str, str],
        db_session: AsyncSession,
        admin_user: AuthUser
    ):
        """Test manually triggering archive process."""
        response = await async_client.post(
            "/api/v1/admin/audit/archive",
            headers=audit_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert "archived" in data
        assert "archive_cutoff_date" in data


class TestSearch:
    """Test audit log search functionality."""
    
    async def test_search_audit_logs(
        self,
        async_client: AsyncClient,
        audit_headers: Dict[str, str],
        db_session: AsyncSession,
        admin_user: AuthUser
    ):
        """Test searching audit logs."""
        # Create logs with searchable content
        audit_system = AdvancedAuditSystem(db_session)
        
        await audit_system.log_action(
            admin_id=admin_user.id,
            action=AdminAction.USER_UPDATE,
            target_type="user",
            target_id=uuid4(),
            reason="Password reset requested by user"
        )
        
        await db_session.commit()
        
        # Search for "password"
        response = await async_client.get(
            "/api/v1/admin/audit/search",
            params={"query": "password"},
            headers=audit_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert "results" in data
        assert len(data["results"]) > 0
        assert "password" in data["results"][0]["reason"].lower()


class TestPerformanceMetrics:
    """Test performance metrics endpoints."""
    
    async def test_get_performance_metrics(
        self,
        async_client: AsyncClient,
        audit_headers: Dict[str, str],
        sample_audit_logs: List[AdminAuditLog]
    ):
        """Test getting performance metrics."""
        response = await async_client.get(
            "/api/v1/admin/audit/performance/metrics",
            params={"period": "hour"},
            headers=audit_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert "metrics" in data
        assert isinstance(data["metrics"], list)