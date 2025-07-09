"""
Audit log management endpoints for administrators.

This module provides API endpoints for viewing, searching, and managing
audit logs with advanced filtering and analytics capabilities.
"""

from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import String
import csv
import io
import json

from jidelnicek.core.database import get_db
from jidelnicek.auth.dependencies import get_current_admin_user
from jidelnicek.auth.models import AuthUser
from jidelnicek.admin.services.audit_service import AdminAuditService
from jidelnicek.admin.services.audit_system import (
    AdvancedAuditSystem, AlertType, AlertSeverity
)
from jidelnicek.admin.schemas import (
    AuditLogFilter, AuditLogEntry, AuditLogListResponse
)
from jidelnicek.admin.models import AdminAction


router = APIRouter(prefix="/admin/audit", tags=["admin-audit"])


class AuditLogExportFormat(str):
    """Export format options."""
    JSON = "json"
    CSV = "csv"


class AuditReportType(str):
    """Types of audit reports."""
    COMPLIANCE = "compliance"
    ACTIVITY = "activity"
    SECURITY = "security"
    PERFORMANCE = "performance"


@router.get("/logs", response_model=AuditLogListResponse)
async def list_audit_logs(
    page: int = Query(1, ge=1, description="Page number"),
    per_page: int = Query(50, ge=1, le=100, description="Items per page"),
    admin_id: Optional[UUID] = Query(None, description="Filter by admin ID"),
    action: Optional[AdminAction] = Query(None, description="Filter by action"),
    target_type: Optional[str] = Query(None, description="Filter by target type"),
    target_id: Optional[UUID] = Query(None, description="Filter by target ID"),
    success: Optional[bool] = Query(None, description="Filter by success status"),
    start_date: Optional[datetime] = Query(None, description="Filter by start date"),
    end_date: Optional[datetime] = Query(None, description="Filter by end date"),
    db: AsyncSession = Depends(get_db),
    current_admin: AuthUser = Depends(get_current_admin_user)
):
    """
    List audit logs with filtering and pagination.
    
    This endpoint provides access to the audit trail of all administrative
    actions with comprehensive filtering capabilities.
    """
    # Create filter object
    filters = AuditLogFilter(
        admin_id=admin_id,
        action=action.value if action else None,
        target_type=target_type,
        target_id=target_id,
        success=success,
        start_date=start_date,
        end_date=end_date
    )
    
    # Get logs
    service = AdminAuditService(db)
    logs, total_count = await service.list_audit_logs(
        page=page,
        per_page=per_page,
        filters=filters
    )
    
    # Log this audit log viewing action
    audit_system = AdvancedAuditSystem(db)
    await audit_system.log_action(
        admin_id=current_admin.id,
        action=AdminAction.AUDIT_LOG_VIEW,
        target_type="audit_log",
        ip_address=None,  # Would come from request in real implementation
        metadata={
            "filters": filters.model_dump(exclude_none=True),
            "page": page,
            "results_count": len(logs)
        }
    )
    
    # Convert to response format
    entries = [
        AuditLogEntry(
            id=log.id,
            admin_id=log.admin_id,
            admin_email=log.admin.email if log.admin else None,
            action=log.action.value,
            target_type=log.target_type,
            target_id=log.target_id,
            target_ids=log.target_ids,
            changes=log.changes,
            reason=log.reason,
            ip_address=log.ip_address,
            success=log.success,
            error_message=log.error_message,
            created_at=log.created_at
        )
        for log in logs
    ]
    
    # Calculate pages
    pages = (total_count + per_page - 1) // per_page
    
    return AuditLogListResponse(
        entries=entries,
        total=total_count,
        page=page,
        per_page=per_page,
        pages=pages
    )


@router.get("/logs/{log_id}")
async def get_audit_log_detail(
    log_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_admin: AuthUser = Depends(get_current_admin_user)
):
    """
    Get detailed information about a specific audit log entry.
    
    Includes full context, before/after states, and related metadata.
    """
    service = AdminAuditService(db)
    log = await service.get_audit_log_detail(log_id)
    
    if not log:
        raise HTTPException(status_code=404, detail="Audit log not found")
    
    # Get checksum for integrity verification
    audit_system = AdvancedAuditSystem(db)
    integrity_info = await audit_system.verify_integrity(
        start_date=log.created_at,
        end_date=log.created_at
    )
    
    return {
        "id": log.id,
        "admin": {
            "id": log.admin_id,
            "email": log.admin.email if log.admin else None
        },
        "action": log.action.value,
        "target": {
            "type": log.target_type,
            "id": log.target_id,
            "ids": log.target_ids
        },
        "changes": {
            "before": log.before_state,
            "after": log.after_state,
            "diff": log.changes
        },
        "context": {
            "ip_address": log.ip_address,
            "user_agent": log.user_agent,
            "request_id": log.request_id,
            "reason": log.reason,
            "metadata": log.metadata
        },
        "result": {
            "success": log.success,
            "error_message": log.error_message
        },
        "integrity": {
            "verified": integrity_info["integrity_status"] == "intact",
            "checksum": log.checksum_record.checksum if hasattr(log, 'checksum_record') and log.checksum_record else None
        },
        "created_at": log.created_at
    }


@router.get("/user/{user_id}/trail")
async def get_user_audit_trail(
    user_id: UUID,
    limit: int = Query(100, ge=1, le=500, description="Maximum entries to return"),
    db: AsyncSession = Depends(get_db),
    current_admin: AuthUser = Depends(get_current_admin_user)
):
    """
    Get audit trail for a specific user.
    
    Shows all administrative actions performed on a user account.
    """
    service = AdminAuditService(db)
    logs = await service.get_user_audit_trail(user_id, limit)
    
    return {
        "user_id": user_id,
        "total_actions": len(logs),
        "audit_trail": [
            {
                "id": log.id,
                "timestamp": log.created_at,
                "admin": {
                    "id": log.admin_id,
                    "email": log.admin.email if log.admin else None
                },
                "action": log.action.value,
                "changes": log.changes,
                "reason": log.reason,
                "success": log.success
            }
            for log in logs
        ]
    }


@router.get("/admin/{admin_id}/activity")
async def get_admin_activity(
    admin_id: UUID,
    limit: int = Query(100, ge=1, le=500, description="Maximum entries to return"),
    db: AsyncSession = Depends(get_db),
    current_admin: AuthUser = Depends(get_current_admin_user)
):
    """
    Get recent activity by a specific administrator.
    
    Shows all actions performed by an admin user.
    """
    service = AdminAuditService(db)
    logs = await service.get_admin_activity(admin_id, limit)
    
    return {
        "admin_id": admin_id,
        "total_actions": len(logs),
        "recent_activity": [
            {
                "id": log.id,
                "timestamp": log.created_at,
                "action": log.action.value,
                "target": {
                    "type": log.target_type,
                    "id": log.target_id
                },
                "success": log.success,
                "error_message": log.error_message
            }
            for log in logs
        ]
    }


@router.get("/export")
async def export_audit_logs(
    format: AuditLogExportFormat = Query(AuditLogExportFormat.JSON),
    admin_id: Optional[UUID] = Query(None),
    action: Optional[AdminAction] = Query(None),
    target_type: Optional[str] = Query(None),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_admin: AuthUser = Depends(get_current_admin_user)
):
    """
    Export audit logs for compliance or analysis.
    
    Supports JSON and CSV formats with filtering.
    """
    # Create filter
    filters = AuditLogFilter(
        admin_id=admin_id,
        action=action.value if action else None,
        target_type=target_type,
        start_date=start_date,
        end_date=end_date
    )
    
    # Get export data
    service = AdminAuditService(db)
    export_data = await service.export_audit_logs(filters, format)
    
    # Log export action
    audit_system = AdvancedAuditSystem(db)
    await audit_system.log_action(
        admin_id=current_admin.id,
        action=AdminAction.AUDIT_LOG_EXPORT,
        target_type="audit_log",
        metadata={
            "format": format,
            "filters": filters.model_dump(exclude_none=True),
            "exported_count": len(export_data["data"])
        }
    )
    
    if format == AuditLogExportFormat.CSV:
        # Convert to CSV
        output = io.StringIO()
        if export_data["data"]:
            writer = csv.DictWriter(
                output,
                fieldnames=export_data["data"][0].keys()
            )
            writer.writeheader()
            writer.writerows(export_data["data"])
        
        return Response(
            content=output.getvalue(),
            media_type="text/csv",
            headers={
                "Content-Disposition": f"attachment; filename=audit_logs_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}.csv"
            }
        )
    else:
        # Return JSON
        return export_data


@router.get("/statistics")
async def get_audit_statistics(
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_admin: AuthUser = Depends(get_current_admin_user)
):
    """
    Get audit log statistics and analytics.
    
    Provides insights into admin activity patterns and system usage.
    """
    service = AdminAuditService(db)
    stats = await service.get_statistics(start_date, end_date)
    
    return stats


@router.get("/integrity/verify")
async def verify_audit_integrity(
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_admin: AuthUser = Depends(get_current_admin_user)
):
    """
    Verify integrity of audit logs.
    
    Checks cryptographic signatures and chain integrity to detect tampering.
    """
    audit_system = AdvancedAuditSystem(db)
    result = await audit_system.verify_integrity(start_date, end_date)
    
    return result


@router.get("/alerts")
async def list_audit_alerts(
    status: Optional[str] = Query(None, description="Filter by status (new, acknowledged, resolved)"),
    severity: Optional[AlertSeverity] = Query(None, description="Filter by severity"),
    limit: int = Query(100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    current_admin: AuthUser = Depends(get_current_admin_user)
):
    """
    List security alerts generated by the audit system.
    
    Shows alerts for suspicious activities and policy violations.
    """
    audit_system = AdvancedAuditSystem(db)
    alerts = await audit_system.get_alerts(
        status=status,
        severity=severity.value if severity else None,
        limit=limit
    )
    
    return {
        "total": len(alerts),
        "alerts": [
            {
                "id": alert.id,
                "type": alert.alert_type,
                "severity": alert.severity,
                "title": alert.title,
                "description": alert.description,
                "admin_id": alert.admin_id,
                "related_logs": alert.related_audit_logs,
                "status": alert.status,
                "created_at": alert.created_at,
                "acknowledged": {
                    "by": alert.acknowledged_by,
                    "at": alert.acknowledged_at,
                    "notes": alert.resolution_notes
                } if alert.acknowledged_by else None
            }
            for alert in alerts
        ]
    }


@router.post("/alerts/{alert_id}/acknowledge")
async def acknowledge_alert(
    alert_id: UUID,
    notes: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_admin: AuthUser = Depends(get_current_admin_user)
):
    """
    Acknowledge a security alert.
    
    Marks an alert as reviewed by an administrator.
    """
    audit_system = AdvancedAuditSystem(db)
    
    try:
        alert = await audit_system.acknowledge_alert(
            alert_id=alert_id,
            admin_id=current_admin.id,
            notes=notes
        )
        
        return {
            "success": True,
            "alert_id": alert.id,
            "acknowledged_at": alert.acknowledged_at
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/patterns/unusual")
async def detect_unusual_patterns(
    lookback_hours: int = Query(24, ge=1, le=168, description="Hours to analyze"),
    db: AsyncSession = Depends(get_db),
    current_admin: AuthUser = Depends(get_current_admin_user)
):
    """
    Detect unusual activity patterns.
    
    Uses statistical analysis to identify anomalous admin behavior.
    """
    audit_system = AdvancedAuditSystem(db)
    patterns = await audit_system.detect_unusual_patterns(lookback_hours)
    
    return {
        "lookback_hours": lookback_hours,
        "patterns_detected": len(patterns),
        "patterns": patterns
    }


@router.get("/performance/metrics")
async def get_performance_metrics(
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    period: str = Query("hour", description="Aggregation period (hour, day, week, month)"),
    db: AsyncSession = Depends(get_db),
    current_admin: AuthUser = Depends(get_current_admin_user)
):
    """
    Get performance metrics for audit operations.
    
    Shows response times and throughput metrics.
    """
    audit_system = AdvancedAuditSystem(db)
    metrics = await audit_system.get_performance_metrics(
        start_date=start_date,
        end_date=end_date,
        period_type=period
    )
    
    return {
        "period_type": period,
        "metrics": metrics
    }


@router.post("/archive")
async def trigger_archive(
    db: AsyncSession = Depends(get_db),
    current_admin: AuthUser = Depends(get_current_admin_user)
):
    """
    Manually trigger audit log archiving.
    
    Archives old logs based on retention policy.
    """
    audit_system = AdvancedAuditSystem(db)
    result = await audit_system.archive_old_logs()
    
    # Log the archive operation
    await audit_system.log_action(
        admin_id=current_admin.id,
        action=AdminAction.DATA_CLEANUP,
        target_type="audit_log",
        metadata={"archive_result": result}
    )
    
    return result


@router.get("/reports/{report_type}")
async def generate_audit_report(
    report_type: AuditReportType,
    start_date: datetime = Query(..., description="Report start date"),
    end_date: datetime = Query(..., description="Report end date"),
    include_details: bool = Query(False, description="Include detailed log entries"),
    db: AsyncSession = Depends(get_db),
    current_admin: AuthUser = Depends(get_current_admin_user)
):
    """
    Generate comprehensive audit reports.
    
    Supports different report types for various compliance and analysis needs.
    """
    audit_system = AdvancedAuditSystem(db)
    
    if report_type == AuditReportType.COMPLIANCE:
        report = await audit_system.generate_compliance_report(
            start_date=start_date,
            end_date=end_date,
            include_details=include_details
        )
    elif report_type == AuditReportType.ACTIVITY:
        # Activity report focusing on admin actions
        service = AdminAuditService(db)
        stats = await service.get_statistics(start_date, end_date)
        
        report = {
            "report_type": "activity",
            "period": {
                "start": start_date.isoformat(),
                "end": end_date.isoformat()
            },
            "statistics": stats,
            "top_admins": stats.get("most_active_admins", []),
            "action_distribution": stats.get("actions_by_type", {})
        }
    elif report_type == AuditReportType.SECURITY:
        # Security report focusing on alerts and threats
        alerts = await audit_system.get_alerts(limit=1000)
        patterns = await audit_system.detect_unusual_patterns(
            lookback_hours=int((end_date - start_date).total_seconds() / 3600)
        )
        
        report = {
            "report_type": "security",
            "period": {
                "start": start_date.isoformat(),
                "end": end_date.isoformat()
            },
            "alerts_summary": {
                "total": len(alerts),
                "by_severity": {},
                "by_type": {}
            },
            "unusual_patterns": patterns
        }
        
        # Count alerts by severity and type
        for alert in alerts:
            if start_date <= alert.created_at <= end_date:
                severity = alert.severity
                alert_type = alert.alert_type
                
                report["alerts_summary"]["by_severity"][severity] = \
                    report["alerts_summary"]["by_severity"].get(severity, 0) + 1
                report["alerts_summary"]["by_type"][alert_type] = \
                    report["alerts_summary"]["by_type"].get(alert_type, 0) + 1
    else:
        # Performance report
        metrics = await audit_system.get_performance_metrics(
            start_date=start_date,
            end_date=end_date,
            period_type="day"
        )
        
        report = {
            "report_type": "performance",
            "period": {
                "start": start_date.isoformat(),
                "end": end_date.isoformat()
            },
            "performance_metrics": metrics
        }
    
    return report


@router.get("/search")
async def search_audit_logs(
    query: str = Query(..., description="Search query (searches in reason, metadata, changes)"),
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_admin: AuthUser = Depends(get_current_admin_user)
):
    """
    Full-text search in audit logs.
    
    Searches through reason, metadata, and changes fields.
    """
    # This would ideally use PostgreSQL full-text search
    # For now, we'll use a simple implementation
    from sqlalchemy import or_
    
    service = AdminAuditService(db)
    
    # Build search conditions
    search_conditions = or_(
        AdminAuditLog.reason.ilike(f"%{query}%"),
        AdminAuditLog.metadata.cast(String).ilike(f"%{query}%"),
        AdminAuditLog.changes.cast(String).ilike(f"%{query}%")
    )
    
    # Execute search with pagination
    # This is a simplified version - in production you'd want proper full-text search
    result = await db.execute(
        select(AdminAuditLog)
        .where(search_conditions)
        .order_by(desc(AdminAuditLog.created_at))
        .offset((page - 1) * per_page)
        .limit(per_page)
    )
    
    logs = result.scalars().all()
    
    # Get total count
    count_result = await db.execute(
        select(func.count(AdminAuditLog.id))
        .where(search_conditions)
    )
    total = count_result.scalar_one()
    
    return {
        "query": query,
        "total": total,
        "page": page,
        "per_page": per_page,
        "pages": (total + per_page - 1) // per_page,
        "results": [
            {
                "id": log.id,
                "timestamp": log.created_at,
                "admin_id": log.admin_id,
                "action": log.action.value,
                "target_type": log.target_type,
                "target_id": log.target_id,
                "reason": log.reason,
                "success": log.success
            }
            for log in logs
        ]
    }