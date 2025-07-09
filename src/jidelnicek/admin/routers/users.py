"""
Admin user management API endpoints.

This module provides comprehensive REST API endpoints for user administration
with security, rate limiting, and audit logging.
"""

from typing import Optional, List, Dict, Any
from uuid import UUID
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status, Query, Request, BackgroundTasks
from fastapi.responses import JSONResponse, StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
import csv
import io
import json

from jidelnicek.core.dependencies import get_db
from jidelnicek.auth.dependencies.auth import CurrentAdminUser, RequirePermission
from jidelnicek.auth.dependencies.rate_limit import RateLimitDependency
from jidelnicek.admin.services import UserManagementService, AdminAuditService
from jidelnicek.admin.schemas import (
    UserFilter, UserSort, SortField, SortOrder,
    AdminUserSummary, AdminUserDetail, UserListResponse,
    UserCreateRequest, UserUpdateRequest, BulkUserOperation, BulkOperationResult,
    PasswordResetRequest, PasswordResetResponse, ForceLogoutRequest,
    UserSessionInfo, UserStatistics, AdminDashboard,
    AuditLogFilter, AuditLogEntry, AuditLogListResponse
)


router = APIRouter(
    prefix="/api/v1/admin/users",
    tags=["admin-users"],
    dependencies=[
        Depends(RequirePermission("admin:access")),
        Depends(RateLimitDependency(tier="admin"))
    ]
)


def get_request_context(request: Request) -> Dict[str, Any]:
    """Extract request context for audit logging."""
    return {
        "ip_address": request.client.host if request.client else None,
        "user_agent": request.headers.get("user-agent"),
        "request_id": request.headers.get("x-request-id")
    }


@router.get("/", response_model=UserListResponse)
async def list_users(
    request: Request,
    page: int = Query(1, ge=1, description="Page number"),
    per_page: int = Query(20, ge=1, le=100, description="Items per page"),
    # Filter parameters
    email: Optional[str] = Query(None, description="Filter by email"),
    status: Optional[str] = Query(None, description="Filter by status"),
    role: Optional[str] = Query(None, description="Filter by role"),
    email_verified: Optional[bool] = Query(None, description="Filter by email verification"),
    created_after: Optional[datetime] = Query(None, description="Filter by creation date"),
    created_before: Optional[datetime] = Query(None, description="Filter by creation date"),
    has_logged_in: Optional[bool] = Query(None, description="Filter by login history"),
    # Sort parameters
    sort_by: SortField = Query(SortField.CREATED_AT, description="Sort field"),
    sort_order: SortOrder = Query(SortOrder.DESC, description="Sort order"),
    # Dependencies
    db: AsyncSession = Depends(get_db),
    admin_user: CurrentAdminUser = Depends()
):
    """
    List all users with pagination, filtering, and sorting.
    
    Requires admin access. All operations are logged.
    """
    # Build filter object
    filters = UserFilter(
        email=email,
        status=status,
        role=role,
        email_verified=email_verified,
        created_after=created_after,
        created_before=created_before,
        has_logged_in=has_logged_in
    )
    
    # Build sort object
    sort = UserSort(field=sort_by, order=sort_order)
    
    # Get users
    service = UserManagementService(db, admin_user)
    users, total, stats = await service.list_users(
        page=page,
        per_page=per_page,
        filters=filters,
        sort=sort,
        request_context=get_request_context(request)
    )
    
    # Convert to response models
    user_summaries = [
        AdminUserSummary.model_validate(user)
        for user in users
    ]
    
    # Calculate pages
    pages = (total + per_page - 1) // per_page
    
    return UserListResponse(
        users=user_summaries,
        total=total,
        page=page,
        per_page=per_page,
        pages=pages,
        stats=stats
    )


@router.get("/search")
async def search_users(
    request: Request,
    q: str = Query(..., min_length=2, description="Search query"),
    limit: int = Query(10, ge=1, le=50, description="Maximum results"),
    db: AsyncSession = Depends(get_db),
    admin_user: CurrentAdminUser = Depends()
):
    """
    Search users by email.
    
    Returns basic user information for autocomplete/search functionality.
    """
    service = UserManagementService(db, admin_user)
    results = await service.search_users(
        query=q,
        limit=limit,
        request_context=get_request_context(request)
    )
    
    return {"results": results}


@router.get("/statistics", response_model=UserStatistics)
async def get_user_statistics(
    db: AsyncSession = Depends(get_db),
    admin_user: CurrentAdminUser = Depends()
):
    """Get overall user statistics."""
    service = UserManagementService(db, admin_user)
    _, _, stats = await service.list_users(page=1, per_page=1)
    
    # Calculate additional statistics
    # This is a simplified version - you'd want to implement more detailed stats
    return UserStatistics(
        total_users=stats.get("total_users", 0),
        active_users=stats.get("active_users", 0),
        inactive_users=stats.get("total_users", 0) - stats.get("active_users", 0),
        suspended_users=0,  # Would need to calculate
        archived_users=0,   # Would need to calculate
        verified_emails=stats.get("verified_emails", 0),
        unverified_emails=stats.get("total_users", 0) - stats.get("verified_emails", 0),
        admin_count=stats.get("admin_count", 0),
        user_count=stats.get("user_count", 0),
        users_with_recipes=0,  # Would need to calculate
        users_with_trips=0,    # Would need to calculate
        registrations_today=stats.get("registrations_today", 0),
        registrations_this_week=0,   # Would need to calculate
        registrations_this_month=0,  # Would need to calculate
        active_sessions=0,     # Would need to calculate
        growth_rate_week=0.0,  # Would need to calculate
        growth_rate_month=0.0  # Would need to calculate
    )


@router.get("/{user_id}", response_model=AdminUserDetail)
async def get_user_detail(
    request: Request,
    user_id: UUID,
    include_sessions: bool = Query(True, description="Include session info"),
    include_activity: bool = Query(True, description="Include recent activity"),
    db: AsyncSession = Depends(get_db),
    admin_user: CurrentAdminUser = Depends()
):
    """
    Get detailed information about a specific user.
    
    Includes session information and recent activity by default.
    """
    service = UserManagementService(db, admin_user)
    user_data = await service.get_user_detail(
        user_id=user_id,
        include_sessions=include_sessions,
        include_activity=include_activity,
        request_context=get_request_context(request)
    )
    
    if not user_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    return AdminUserDetail(**user_data)


@router.post("/", response_model=AdminUserSummary, status_code=status.HTTP_201_CREATED)
async def create_user(
    request: Request,
    user_data: UserCreateRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    admin_user: CurrentAdminUser = Depends()
):
    """
    Create a new user account.
    
    Admin-only endpoint for creating users with optional email verification bypass.
    """
    service = UserManagementService(db, admin_user)
    
    try:
        user = await service.create_user(
            email=user_data.email,
            password=user_data.password,
            role=user_data.role,
            email_verified=user_data.email_verified,
            send_welcome_email=user_data.send_welcome_email,
            preferences={
                "language": user_data.language,
                "unit_system": user_data.unit_system,
                "energy_unit": user_data.energy_unit,
                "has_pku": user_data.has_pku,
                "timezone": user_data.timezone
            },
            request_context=get_request_context(request)
        )
        
        return AdminUserSummary.model_validate(user)
    
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.patch("/{user_id}", response_model=AdminUserDetail)
async def update_user(
    request: Request,
    user_id: UUID,
    updates: UserUpdateRequest,
    db: AsyncSession = Depends(get_db),
    admin_user: CurrentAdminUser = Depends()
):
    """
    Update user information.
    
    Allows updating user details, status, and preferences.
    """
    service = UserManagementService(db, admin_user)
    
    # Build updates dict
    update_data = {}
    for field, value in updates.model_dump(exclude_unset=True).items():
        if field != "reason" and value is not None:
            update_data[field] = value
    
    user = await service.update_user(
        user_id=user_id,
        updates=update_data,
        reason=updates.reason,
        request_context=get_request_context(request)
    )
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Get full details
    user_data = await service.get_user_detail(user_id)
    return AdminUserDetail(**user_data)


@router.post("/{user_id}/suspend")
async def suspend_user(
    request: Request,
    user_id: UUID,
    reason: str = Query(..., description="Reason for suspension"),
    notify_user: bool = Query(True, description="Send notification email"),
    db: AsyncSession = Depends(get_db),
    admin_user: CurrentAdminUser = Depends()
):
    """Suspend a user account."""
    service = UserManagementService(db, admin_user)
    
    success = await service.suspend_user(
        user_id=user_id,
        reason=reason,
        notify_user=notify_user,
        request_context=get_request_context(request)
    )
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    return {"message": "User suspended successfully"}


@router.post("/{user_id}/activate")
async def activate_user(
    request: Request,
    user_id: UUID,
    reason: str = Query(..., description="Reason for activation"),
    notify_user: bool = Query(True, description="Send notification email"),
    db: AsyncSession = Depends(get_db),
    admin_user: CurrentAdminUser = Depends()
):
    """Activate a suspended user account."""
    service = UserManagementService(db, admin_user)
    
    success = await service.activate_user(
        user_id=user_id,
        reason=reason,
        notify_user=notify_user,
        request_context=get_request_context(request)
    )
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    return {"message": "User activated successfully"}


@router.post("/{user_id}/reset-password", response_model=PasswordResetResponse)
async def reset_user_password(
    request: Request,
    user_id: UUID,
    reset_data: PasswordResetRequest,
    db: AsyncSession = Depends(get_db),
    admin_user: CurrentAdminUser = Depends()
):
    """Reset a user's password."""
    if user_id != reset_data.user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User ID mismatch"
        )
    
    service = UserManagementService(db, admin_user)
    
    success, password = await service.reset_user_password(
        user_id=user_id,
        new_password=reset_data.new_password,
        generate_random=reset_data.generate_random,
        send_email=reset_data.send_email,
        require_change=reset_data.require_change,
        reason=reset_data.reason,
        request_context=get_request_context(request)
    )
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    return PasswordResetResponse(
        success=True,
        password=password if reset_data.generate_random and not reset_data.send_email else None,
        message="Password reset successfully"
    )


@router.post("/{user_id}/force-logout")
async def force_logout_user(
    request: Request,
    user_id: UUID,
    logout_data: ForceLogoutRequest,
    db: AsyncSession = Depends(get_db),
    admin_user: CurrentAdminUser = Depends()
):
    """Force logout a user by invalidating their sessions."""
    if user_id != logout_data.user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User ID mismatch"
        )
    
    service = UserManagementService(db, admin_user)
    
    count = await service.force_logout_user(
        user_id=user_id,
        reason=logout_data.reason,
        logout_all=logout_data.logout_all_sessions,
        request_context=get_request_context(request)
    )
    
    return {
        "message": f"Successfully invalidated {count} session(s)",
        "sessions_invalidated": count
    }


@router.get("/{user_id}/sessions", response_model=List[UserSessionInfo])
async def get_user_sessions(
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
    admin_user: CurrentAdminUser = Depends()
):
    """Get all sessions for a user."""
    service = UserManagementService(db, admin_user)
    user_data = await service.get_user_detail(
        user_id=user_id,
        include_sessions=True,
        include_activity=False
    )
    
    if not user_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    sessions = user_data.get("recent_sessions", [])
    return [UserSessionInfo(**session) for session in sessions]


@router.post("/bulk", response_model=BulkOperationResult)
async def bulk_user_operation(
    request: Request,
    operation: BulkUserOperation,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    admin_user: CurrentAdminUser = Depends()
):
    """
    Perform bulk operations on multiple users.
    
    Supports: suspend, activate, delete, export
    """
    service = UserManagementService(db, admin_user)
    
    result = await service.bulk_operation(
        user_ids=operation.user_ids,
        operation=operation.operation,
        reason=operation.reason,
        send_notifications=operation.send_notification,
        request_context=get_request_context(request)
    )
    
    return result


@router.get("/export/csv")
async def export_users_csv(
    request: Request,
    # Same filter parameters as list_users
    email: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    role: Optional[str] = Query(None),
    email_verified: Optional[bool] = Query(None),
    created_after: Optional[datetime] = Query(None),
    created_before: Optional[datetime] = Query(None),
    db: AsyncSession = Depends(get_db),
    admin_user: CurrentAdminUser = Depends()
):
    """Export users to CSV format."""
    # Build filter
    filters = UserFilter(
        email=email,
        status=status,
        role=role,
        email_verified=email_verified,
        created_after=created_after,
        created_before=created_before
    )
    
    # Get all users (no pagination)
    service = UserManagementService(db, admin_user)
    users, _, _ = await service.list_users(
        page=1,
        per_page=10000,  # Get all
        filters=filters,
        request_context=get_request_context(request)
    )
    
    # Create CSV
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Write header
    writer.writerow([
        "ID", "Email", "Role", "Status", "Email Verified",
        "Created At", "Last Login", "Recipe Count", "Trip Count"
    ])
    
    # Write data
    for user in users:
        status = "active"
        if user.is_archived:
            status = "archived"
        elif not user.is_active:
            status = "suspended"
        elif not user.last_login:
            status = "inactive"
        
        writer.writerow([
            str(user.id),
            user.email,
            user.role,
            status,
            "Yes" if user.email_verified else "No",
            user.created_at.isoformat(),
            user.last_login.isoformat() if user.last_login else "",
            user.recipe_count,
            user.trip_count
        ])
    
    # Return as download
    output.seek(0)
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode()),
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename=users_export_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.csv"
        }
    )


# Audit log endpoints

@router.get("/audit/logs", response_model=AuditLogListResponse)
async def list_audit_logs(
    request: Request,
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=100),
    admin_id: Optional[UUID] = Query(None),
    action: Optional[str] = Query(None),
    target_type: Optional[str] = Query(None),
    target_id: Optional[UUID] = Query(None),
    success: Optional[bool] = Query(None),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    db: AsyncSession = Depends(get_db),
    admin_user: CurrentAdminUser = Depends()
):
    """List audit logs with filtering."""
    filters = AuditLogFilter(
        admin_id=admin_id,
        action=action,
        target_type=target_type,
        target_id=target_id,
        success=success,
        start_date=start_date,
        end_date=end_date
    )
    
    service = AdminAuditService(db)
    logs, total = await service.list_audit_logs(
        page=page,
        per_page=per_page,
        filters=filters
    )
    
    # Convert to response models
    entries = []
    for log in logs:
        entry = AuditLogEntry.model_validate(log)
        entry.admin_email = log.admin.email if log.admin else "Unknown"
        entries.append(entry)
    
    pages = (total + per_page - 1) // per_page
    
    return AuditLogListResponse(
        entries=entries,
        total=total,
        page=page,
        per_page=per_page,
        pages=pages
    )


@router.get("/{user_id}/audit-trail", response_model=List[AuditLogEntry])
async def get_user_audit_trail(
    user_id: UUID,
    limit: int = Query(100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    admin_user: CurrentAdminUser = Depends()
):
    """Get audit trail for a specific user."""
    service = AdminAuditService(db)
    logs = await service.get_user_audit_trail(user_id, limit)
    
    entries = []
    for log in logs:
        entry = AuditLogEntry.model_validate(log)
        entry.admin_email = log.admin.email if log.admin else "Unknown"
        entries.append(entry)
    
    return entries