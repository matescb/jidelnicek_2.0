"""
API endpoints for cleanup management.

This module provides endpoints for managing cleanup policies,
viewing audit logs, and controlling cleanup operations.
"""

from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from sqlalchemy import select, and_, or_, func
from sqlalchemy.ext.asyncio import AsyncSession

from jidelnicek.auth.dependencies.auth import get_current_user
from jidelnicek.admin.routers.moderation import require_admin
from jidelnicek.auth.models import User
from jidelnicek.core.dependencies import get_db
from jidelnicek.core.models.cleanup_policy import (
    CleanupPolicy, CleanupAuditLog, CleanupStatistics, UserCleanupPreference
)
from jidelnicek.core.services.cleanup_service import CleanupService
from jidelnicek.core.schemas.cleanup import (
    CleanupPolicyResponse, CleanupPolicyCreate, CleanupPolicyUpdate,
    CleanupAuditLogResponse, CleanupStatisticsResponse,
    UserCleanupPreferenceResponse, UserCleanupPreferenceUpdate,
    CleanupReportResponse, CleanupStatusResponse,
)
from jidelnicek.tasks.cleanup_tasks import (
    cleanup_export_files, cleanup_cloud_storage, generate_cleanup_report
)

router = APIRouter(prefix="/cleanup", tags=["cleanup"])


@router.get("/policies", response_model=List[CleanupPolicyResponse])
async def list_cleanup_policies(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
    active_only: bool = Query(True, description="Only return active policies"),
) -> List[CleanupPolicyResponse]:
    """List all cleanup policies (admin only)."""
    query = select(CleanupPolicy)
    if active_only:
        query = query.where(CleanupPolicy.is_active == True)
    query = query.order_by(CleanupPolicy.priority.desc(), CleanupPolicy.name)
    
    result = await db.execute(query)
    policies = result.scalars().all()
    
    return [CleanupPolicyResponse.from_orm(p) for p in policies]


@router.get("/policies/{policy_id}", response_model=CleanupPolicyResponse)
async def get_cleanup_policy(
    policy_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
) -> CleanupPolicyResponse:
    """Get a specific cleanup policy (admin only)."""
    policy = await db.get(CleanupPolicy, policy_id)
    if not policy:
        raise HTTPException(status_code=404, detail="Policy not found")
    
    return CleanupPolicyResponse.from_orm(policy)


@router.post("/policies", response_model=CleanupPolicyResponse)
async def create_cleanup_policy(
    policy_data: CleanupPolicyCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
) -> CleanupPolicyResponse:
    """Create a new cleanup policy (admin only)."""
    # Check if policy with same name exists
    result = await db.execute(
        select(CleanupPolicy).where(CleanupPolicy.name == policy_data.name)
    )
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Policy with this name already exists")
    
    policy = CleanupPolicy(**policy_data.dict())
    db.add(policy)
    await db.commit()
    await db.refresh(policy)
    
    return CleanupPolicyResponse.from_orm(policy)


@router.put("/policies/{policy_id}", response_model=CleanupPolicyResponse)
async def update_cleanup_policy(
    policy_id: int,
    policy_data: CleanupPolicyUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
) -> CleanupPolicyResponse:
    """Update a cleanup policy (admin only)."""
    policy = await db.get(CleanupPolicy, policy_id)
    if not policy:
        raise HTTPException(status_code=404, detail="Policy not found")
    
    update_data = policy_data.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(policy, field, value)
    
    policy.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(policy)
    
    return CleanupPolicyResponse.from_orm(policy)


@router.delete("/policies/{policy_id}")
async def delete_cleanup_policy(
    policy_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
) -> Dict[str, str]:
    """Delete a cleanup policy (admin only)."""
    policy = await db.get(CleanupPolicy, policy_id)
    if not policy:
        raise HTTPException(status_code=404, detail="Policy not found")
    
    await db.delete(policy)
    await db.commit()
    
    return {"message": "Policy deleted successfully"}


@router.get("/audit-logs", response_model=List[CleanupAuditLogResponse])
async def list_audit_logs(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    file_type: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    user_id: Optional[int] = None,
) -> List[CleanupAuditLogResponse]:
    """List cleanup audit logs."""
    query = select(CleanupAuditLog)
    
    # Non-admin users can only see their own logs
    if not current_user.is_admin:
        query = query.where(CleanupAuditLog.user_id == current_user.id)
    elif user_id:
        query = query.where(CleanupAuditLog.user_id == user_id)
    
    if file_type:
        query = query.where(CleanupAuditLog.file_type == file_type)
    
    if start_date:
        query = query.where(CleanupAuditLog.deleted_at >= start_date)
    
    if end_date:
        query = query.where(CleanupAuditLog.deleted_at <= end_date)
    
    query = query.order_by(CleanupAuditLog.deleted_at.desc())
    query = query.offset(skip).limit(limit)
    
    result = await db.execute(query)
    logs = result.scalars().all()
    
    return [CleanupAuditLogResponse.from_orm(log) for log in logs]


@router.get("/statistics", response_model=List[CleanupStatisticsResponse])
async def list_cleanup_statistics(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
) -> List[CleanupStatisticsResponse]:
    """List cleanup statistics (admin only)."""
    query = select(CleanupStatistics)
    
    if start_date:
        query = query.where(CleanupStatistics.date >= start_date.date())
    
    if end_date:
        query = query.where(CleanupStatistics.date <= end_date.date())
    
    query = query.order_by(CleanupStatistics.date.desc())
    
    result = await db.execute(query)
    stats = result.scalars().all()
    
    return [CleanupStatisticsResponse.from_orm(stat) for stat in stats]


@router.get("/preferences", response_model=UserCleanupPreferenceResponse)
async def get_user_preferences(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> UserCleanupPreferenceResponse:
    """Get current user's cleanup preferences."""
    result = await db.execute(
        select(UserCleanupPreference).where(
            UserCleanupPreference.user_id == current_user.id
        )
    )
    preferences = result.scalar_one_or_none()
    
    if not preferences:
        # Return default preferences
        return UserCleanupPreferenceResponse(
            user_id=current_user.id,
            shopping_list_retention_days=None,
            trip_data_retention_days=None,
            recipe_export_retention_days=None,
            dataset_export_retention_days=None,
            enable_deletion_notifications=True,
            notification_email=current_user.email,
            notification_lead_time_hours=24,
            auto_backup_before_deletion=False,
            backup_location=None,
        )
    
    return UserCleanupPreferenceResponse.from_orm(preferences)


@router.put("/preferences", response_model=UserCleanupPreferenceResponse)
async def update_user_preferences(
    preferences_data: UserCleanupPreferenceUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> UserCleanupPreferenceResponse:
    """Update current user's cleanup preferences."""
    # Get or create preferences
    result = await db.execute(
        select(UserCleanupPreference).where(
            UserCleanupPreference.user_id == current_user.id
        )
    )
    preferences = result.scalar_one_or_none()
    
    if not preferences:
        preferences = UserCleanupPreference(user_id=current_user.id)
        db.add(preferences)
    
    # Validate retention days against policy limits
    cleanup_service = CleanupService(db)
    policies = await cleanup_service.get_active_policies()
    
    update_data = preferences_data.dict(exclude_unset=True)
    
    for field, value in update_data.items():
        if field.endswith("_retention_days") and value is not None:
            file_type = field.replace("_retention_days", "")
            policy = next(
                (p for p in policies if p.file_type == file_type),
                None
            )
            
            if policy and policy.allow_user_override:
                if value < policy.min_retention_days:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Retention days for {file_type} must be at least {policy.min_retention_days}"
                    )
                if value > policy.max_retention_days:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Retention days for {file_type} cannot exceed {policy.max_retention_days}"
                    )
        
        setattr(preferences, field, value)
    
    preferences.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(preferences)
    
    return UserCleanupPreferenceResponse.from_orm(preferences)


@router.post("/trigger", response_model=CleanupStatusResponse)
async def trigger_cleanup(
    background_tasks: BackgroundTasks,
    cleanup_type: str = Query(..., regex="^(export_files|cloud_storage|all)$"),
    dry_run: bool = Query(False, description="Simulate cleanup without deleting files"),
    force: bool = Query(False, description="Force cleanup ignoring grace periods"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
) -> CleanupStatusResponse:
    """Manually trigger cleanup tasks (admin only)."""
    tasks_queued = []
    
    if cleanup_type in ["export_files", "all"]:
        task = cleanup_export_files.apply_async(
            kwargs={"dry_run": dry_run, "force": force}
        )
        tasks_queued.append({
            "task_id": task.id,
            "task_type": "export_files",
            "status": "queued",
        })
    
    if cleanup_type in ["cloud_storage", "all"]:
        task = cleanup_cloud_storage.apply_async(
            kwargs={"storage_type": "all", "dry_run": dry_run}
        )
        tasks_queued.append({
            "task_id": task.id,
            "task_type": "cloud_storage",
            "status": "queued",
        })
    
    return CleanupStatusResponse(
        message=f"Cleanup tasks queued successfully",
        tasks=tasks_queued,
        dry_run=dry_run,
        force=force,
    )


@router.post("/report", response_model=CleanupReportResponse)
async def generate_report(
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    email_report: bool = Query(False, description="Email report to current user"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
) -> CleanupReportResponse:
    """Generate cleanup report (admin only)."""
    # Default to last 30 days if no dates provided
    if not end_date:
        end_date = datetime.utcnow()
    if not start_date:
        start_date = end_date - timedelta(days=30)
    
    # Queue report generation task
    email_to = current_user.email if email_report else None
    task = generate_cleanup_report.apply_async(
        kwargs={
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "email_to": email_to,
        }
    )
    
    return CleanupReportResponse(
        task_id=task.id,
        status="queued",
        start_date=start_date,
        end_date=end_date,
        email_to=email_to,
    )


@router.post("/recover/{audit_log_id}")
async def recover_file(
    audit_log_id: int,
    recovery_path: str = Query(..., description="Path to recover the file to"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """Attempt to recover a deleted file."""
    audit_log = await db.get(CleanupAuditLog, audit_log_id)
    if not audit_log:
        raise HTTPException(status_code=404, detail="Audit log not found")
    
    # Check permissions
    if not current_user.is_admin and audit_log.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to recover this file")
    
    # Check if recovery is possible
    grace_period = timedelta(days=7)  # Default grace period
    if datetime.utcnow() - audit_log.deleted_at > grace_period:
        raise HTTPException(
            status_code=400,
            detail="File cannot be recovered - grace period has expired"
        )
    
    # Attempt recovery
    cleanup_service = CleanupService(db)
    success = await cleanup_service.recover_file(audit_log_id, recovery_path)
    
    if not success:
        raise HTTPException(
            status_code=500,
            detail="Failed to recover file - backup may not be available"
        )
    
    return {
        "message": "File recovered successfully",
        "recovery_path": recovery_path,
        "original_path": audit_log.file_path,
    }