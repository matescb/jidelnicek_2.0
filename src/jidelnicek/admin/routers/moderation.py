"""
Moderation API endpoints for content review and management.

This module provides REST API endpoints for content moderation,
including report handling, moderation actions, sanctions, and appeals.
"""

from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, Body
from sqlalchemy.orm import Session
from redis import Redis

from jidelnicek.common.database import get_db, get_redis
from jidelnicek.common.auth import get_current_user, require_permissions
from jidelnicek.core.models.user import User
from jidelnicek.core.services.audit import AuditService
from jidelnicek.admin.services.content_moderation import ContentModerationService
from jidelnicek.admin.models.moderation import (
    ContentType, ReportReason, ModerationStatus, ModerationAction,
    SanctionType, AppealStatus
)


router = APIRouter(prefix="/api/v1/admin/moderation", tags=["moderation"])


# Dependencies

def get_moderation_service(
    db: Session = Depends(get_db),
    redis: Redis = Depends(get_redis)
) -> ContentModerationService:
    """Get moderation service instance."""
    audit_service = AuditService(db)
    return ContentModerationService(db, redis, audit_service)


def require_moderator(
    current_user: User = Depends(get_current_user)
) -> User:
    """Require moderator permissions."""
    if not current_user.has_permission("moderate_content"):
        raise HTTPException(status_code=403, detail="Moderator access required")
    return current_user


def require_admin(
    current_user: User = Depends(get_current_user)
) -> User:
    """Require admin permissions."""
    if not current_user.has_permission("admin_access"):
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


# Report Endpoints

@router.post("/reports")
async def create_report(
    content_type: ContentType,
    content_id: int,
    reason: ReportReason,
    description: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    service: ContentModerationService = Depends(get_moderation_service)
):
    """Submit a content report."""
    try:
        report = service.create_report(
            reporter_id=current_user.id,
            content_type=content_type,
            content_id=content_id,
            reason=reason,
            description=description
        )
        
        return {
            "id": report.id,
            "status": report.status.value,
            "created_at": report.created_at.isoformat()
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/reports/pending")
async def get_pending_reports(
    limit: int = Query(20, ge=1, le=100),
    content_type: Optional[ContentType] = None,
    moderator: User = Depends(require_moderator),
    service: ContentModerationService = Depends(get_moderation_service)
):
    """Get pending reports for moderation."""
    reports = service.get_pending_reports(
        moderator_id=moderator.id,
        limit=limit,
        content_type=content_type
    )
    
    return {
        "reports": [
            {
                "id": report.id,
                "content_type": report.content_type.value,
                "content_id": report.content_id,
                "reason": report.reason.value,
                "description": report.description,
                "priority_score": report.priority_score,
                "reporter_id": report.reporter_id,
                "created_at": report.created_at.isoformat()
            }
            for report in reports
        ],
        "count": len(reports)
    }


@router.get("/reports/{report_id}")
async def get_report(
    report_id: int,
    moderator: User = Depends(require_moderator),
    service: ContentModerationService = Depends(get_moderation_service),
    db: Session = Depends(get_db)
):
    """Get detailed report information."""
    from jidelnicek.admin.models.moderation import ContentReport
    
    report = db.query(ContentReport).filter(
        ContentReport.id == report_id
    ).first()
    
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    
    # Get content details based on type
    content_details = {}
    if report.content_type == ContentType.RECIPE:
        from jidelnicek.recipe.models.recipe import Recipe
        content = db.query(Recipe).filter(Recipe.id == report.content_id).first()
        if content:
            content_details = {
                "title": content.title,
                "author_id": content.author_id,
                "created_at": content.created_at.isoformat()
            }
    
    return {
        "id": report.id,
        "content_type": report.content_type.value,
        "content_id": report.content_id,
        "content_details": content_details,
        "reason": report.reason.value,
        "description": report.description,
        "priority_score": report.priority_score,
        "status": report.status.value,
        "reporter": {
            "id": report.reporter_id,
            "username": report.reporter.username if report.reporter else None
        },
        "assigned_to": report.assigned_to,
        "created_at": report.created_at.isoformat(),
        "updated_at": report.updated_at.isoformat()
    }


# Moderation Action Endpoints

@router.post("/reports/{report_id}/moderate")
async def moderate_report(
    report_id: int,
    action: ModerationAction,
    reason: str = Body(...),
    template_id: Optional[int] = None,
    metadata: Optional[Dict[str, Any]] = None,
    moderator: User = Depends(require_moderator),
    service: ContentModerationService = Depends(get_moderation_service)
):
    """Take moderation action on a report."""
    try:
        action_log = service.moderate_content(
            moderator_id=moderator.id,
            report_id=report_id,
            action=action,
            reason=reason,
            template_id=template_id,
            metadata=metadata
        )
        
        return {
            "id": action_log.id,
            "action": action_log.action.value,
            "content_type": action_log.content_type.value,
            "content_id": action_log.content_id,
            "created_at": action_log.created_at.isoformat()
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/reports/bulk-moderate")
async def bulk_moderate_reports(
    report_ids: List[int],
    action: ModerationAction,
    template_id: int,
    moderator: User = Depends(require_moderator),
    service: ContentModerationService = Depends(get_moderation_service)
):
    """Apply bulk moderation action to multiple reports."""
    action_logs = service.bulk_moderate(
        moderator_id=moderator.id,
        report_ids=report_ids,
        action=action,
        template_id=template_id
    )
    
    return {
        "processed": len(action_logs),
        "actions": [
            {
                "id": log.id,
                "report_id": log.report_id,
                "action": log.action.value
            }
            for log in action_logs
        ]
    }


# Template Endpoints

@router.get("/templates")
async def list_templates(
    category: Optional[str] = None,
    action: Optional[ModerationAction] = None,
    moderator: User = Depends(require_moderator),
    db: Session = Depends(get_db)
):
    """List moderation response templates."""
    from jidelnicek.admin.models.moderation import ModerationTemplate
    
    query = db.query(ModerationTemplate).filter(
        ModerationTemplate.is_active == True
    )
    
    if category:
        query = query.filter(ModerationTemplate.category == category)
    
    if action:
        query = query.filter(ModerationTemplate.action == action)
    
    templates = query.all()
    
    return {
        "templates": [
            {
                "id": template.id,
                "name": template.name,
                "category": template.category,
                "action": template.action.value,
                "response_text": template.response_text,
                "usage_count": template.usage_count
            }
            for template in templates
        ]
    }


@router.post("/templates")
async def create_template(
    name: str,
    category: str,
    action: ModerationAction,
    response_text: str,
    internal_notes: Optional[str] = None,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Create a new moderation template."""
    from jidelnicek.admin.models.moderation import ModerationTemplate
    
    template = ModerationTemplate(
        name=name,
        category=category,
        action=action,
        response_text=response_text,
        internal_notes=internal_notes,
        created_by=admin.id
    )
    
    db.add(template)
    db.commit()
    
    return {
        "id": template.id,
        "name": template.name,
        "created_at": template.created_at.isoformat()
    }


# Sanction Endpoints

@router.post("/sanctions")
async def issue_sanction(
    user_id: int,
    sanction_type: SanctionType,
    reason: str,
    duration_days: Optional[int] = None,
    evidence: Optional[Dict[str, Any]] = None,
    moderator: User = Depends(require_moderator),
    service: ContentModerationService = Depends(get_moderation_service)
):
    """Issue a sanction against a user."""
    try:
        sanction = service.issue_sanction(
            issuer_id=moderator.id,
            user_id=user_id,
            sanction_type=sanction_type,
            reason=reason,
            duration_days=duration_days,
            evidence=evidence
        )
        
        return {
            "id": sanction.id,
            "user_id": sanction.user_id,
            "type": sanction.type.value,
            "expires_at": sanction.expires_at.isoformat() if sanction.expires_at else None,
            "created_at": sanction.created_at.isoformat()
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/sanctions/{sanction_id}/lift")
async def lift_sanction(
    sanction_id: int,
    reason: str = Body(...),
    admin: User = Depends(require_admin),
    service: ContentModerationService = Depends(get_moderation_service)
):
    """Lift an active sanction."""
    try:
        sanction = service.lift_sanction(
            lifter_id=admin.id,
            sanction_id=sanction_id,
            reason=reason
        )
        
        return {
            "id": sanction.id,
            "lifted_at": sanction.lifted_at.isoformat(),
            "lifted_by": sanction.lifted_by
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/users/{user_id}/sanctions")
async def get_user_sanctions(
    user_id: int,
    include_expired: bool = False,
    moderator: User = Depends(require_moderator),
    db: Session = Depends(get_db)
):
    """Get sanctions for a specific user."""
    from jidelnicek.admin.models.moderation import UserSanction
    
    query = db.query(UserSanction).filter(
        UserSanction.user_id == user_id
    )
    
    if not include_expired:
        query = query.filter(UserSanction.is_active == True)
    
    sanctions = query.order_by(UserSanction.created_at.desc()).all()
    
    return {
        "sanctions": [
            {
                "id": sanction.id,
                "type": sanction.type.value,
                "reason": sanction.reason,
                "is_active": sanction.is_active,
                "starts_at": sanction.starts_at.isoformat(),
                "expires_at": sanction.expires_at.isoformat() if sanction.expires_at else None,
                "issued_by": sanction.issued_by
            }
            for sanction in sanctions
        ]
    }


# Appeal Endpoints

@router.post("/appeals")
async def create_appeal(
    sanction_id: Optional[int] = None,
    reason: str = Body(...),
    evidence: Optional[Dict[str, Any]] = None,
    current_user: User = Depends(get_current_user),
    service: ContentModerationService = Depends(get_moderation_service)
):
    """Create an appeal against a sanction."""
    try:
        appeal = service.create_appeal(
            user_id=current_user.id,
            sanction_id=sanction_id,
            reason=reason,
            evidence=evidence
        )
        
        return {
            "id": appeal.id,
            "status": appeal.status.value,
            "expires_at": appeal.expires_at.isoformat(),
            "created_at": appeal.created_at.isoformat()
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/appeals/pending")
async def get_pending_appeals(
    limit: int = Query(20, ge=1, le=100),
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Get pending appeals for review."""
    from jidelnicek.admin.models.moderation import UserAppeal
    
    appeals = db.query(UserAppeal).filter(
        UserAppeal.status == AppealStatus.PENDING
    ).order_by(UserAppeal.created_at).limit(limit).all()
    
    return {
        "appeals": [
            {
                "id": appeal.id,
                "user_id": appeal.user_id,
                "sanction_id": appeal.sanction_id,
                "reason": appeal.reason,
                "created_at": appeal.created_at.isoformat(),
                "expires_at": appeal.expires_at.isoformat()
            }
            for appeal in appeals
        ]
    }


@router.put("/appeals/{appeal_id}/review")
async def review_appeal(
    appeal_id: int,
    approved: bool,
    decision: str = Body(...),
    admin: User = Depends(require_admin),
    service: ContentModerationService = Depends(get_moderation_service)
):
    """Review and decide on an appeal."""
    try:
        appeal = service.review_appeal(
            reviewer_id=admin.id,
            appeal_id=appeal_id,
            approved=approved,
            decision=decision
        )
        
        return {
            "id": appeal.id,
            "status": appeal.status.value,
            "reviewed_at": appeal.reviewed_at.isoformat()
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# Filter Endpoints

@router.post("/filters")
async def create_filter(
    name: str,
    filter_type: str,
    pattern: str,
    action: ModerationAction,
    content_type: Optional[ContentType] = None,
    severity: int = Query(1, ge=1, le=10),
    auto_report: bool = False,
    admin: User = Depends(require_admin),
    service: ContentModerationService = Depends(get_moderation_service)
):
    """Create a new content filter."""
    try:
        filter_rule = service.create_filter(
            creator_id=admin.id,
            name=name,
            filter_type=filter_type,
            pattern=pattern,
            action=action,
            content_type=content_type,
            severity=severity,
            auto_report=auto_report
        )
        
        return {
            "id": filter_rule.id,
            "name": filter_rule.name,
            "is_active": filter_rule.is_active
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/filters")
async def list_filters(
    content_type: Optional[ContentType] = None,
    is_active: Optional[bool] = None,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """List content filters."""
    from jidelnicek.admin.models.moderation import ContentFilter
    
    query = db.query(ContentFilter)
    
    if content_type:
        query = query.filter(ContentFilter.content_type == content_type)
    
    if is_active is not None:
        query = query.filter(ContentFilter.is_active == is_active)
    
    filters = query.all()
    
    return {
        "filters": [
            {
                "id": f.id,
                "name": f.name,
                "content_type": f.content_type.value if f.content_type else "all",
                "filter_type": f.filter_type,
                "action": f.action.value,
                "severity": f.severity,
                "is_active": f.is_active,
                "effectiveness_score": f.effectiveness_score
            }
            for f in filters
        ]
    }


@router.post("/content/check")
async def check_content(
    content_type: ContentType,
    content: str,
    metadata: Optional[Dict[str, Any]] = None,
    moderator: User = Depends(require_moderator),
    service: ContentModerationService = Depends(get_moderation_service)
):
    """Check content against filters without saving."""
    passed, filter_rule, action = service.check_content(
        content_type=content_type,
        content=content,
        metadata=metadata
    )
    
    return {
        "passed": passed,
        "filter_matched": filter_rule.name if filter_rule else None,
        "suggested_action": action.value if action else None
    }


# Queue Endpoints

@router.get("/queue")
async def get_moderation_queue(
    limit: int = Query(20, ge=1, le=100),
    content_type: Optional[ContentType] = None,
    auto_flagged_only: bool = False,
    moderator: User = Depends(require_moderator),
    db: Session = Depends(get_db)
):
    """Get items from the moderation queue."""
    from jidelnicek.admin.models.moderation import ModerationQueue
    
    query = db.query(ModerationQueue).filter(
        ModerationQueue.status == ModerationStatus.PENDING
    )
    
    if content_type:
        query = query.filter(ModerationQueue.content_type == content_type)
    
    if auto_flagged_only:
        query = query.filter(ModerationQueue.auto_flagged == True)
    
    items = query.order_by(
        ModerationQueue.priority.desc(),
        ModerationQueue.created_at
    ).limit(limit).all()
    
    return {
        "items": [
            {
                "id": item.id,
                "content_type": item.content_type.value,
                "content_id": item.content_id,
                "priority": item.priority,
                "auto_flagged": item.auto_flagged,
                "created_at": item.created_at.isoformat()
            }
            for item in items
        ],
        "count": len(items)
    }


@router.put("/queue/{queue_id}/assign")
async def assign_queue_item(
    queue_id: int,
    moderator: User = Depends(require_moderator),
    db: Session = Depends(get_db)
):
    """Assign a queue item to yourself."""
    from jidelnicek.admin.models.moderation import ModerationQueue
    
    item = db.query(ModerationQueue).filter(
        ModerationQueue.id == queue_id
    ).first()
    
    if not item:
        raise HTTPException(status_code=404, detail="Queue item not found")
    
    if item.assigned_to and item.assigned_to != moderator.id:
        raise HTTPException(status_code=400, detail="Already assigned to another moderator")
    
    item.assigned_to = moderator.id
    item.assigned_at = datetime.utcnow()
    item.status = ModerationStatus.IN_REVIEW
    
    db.commit()
    
    return {
        "id": item.id,
        "assigned_to": item.assigned_to,
        "assigned_at": item.assigned_at.isoformat()
    }


# Analytics Endpoints

@router.get("/stats")
async def get_moderation_stats(
    start_date: datetime = Query(...),
    end_date: datetime = Query(...),
    moderator_id: Optional[int] = None,
    admin: User = Depends(require_admin),
    service: ContentModerationService = Depends(get_moderation_service)
):
    """Get moderation statistics."""
    stats = service.get_moderation_stats(
        start_date=start_date,
        end_date=end_date,
        moderator_id=moderator_id
    )
    
    return stats


@router.get("/stats/moderators")
async def get_moderator_performance(
    start_date: datetime = Query(...),
    end_date: datetime = Query(...),
    admin: User = Depends(require_admin),
    service: ContentModerationService = Depends(get_moderation_service),
    db: Session = Depends(get_db)
):
    """Get performance statistics for all moderators."""
    # Get all moderators
    moderators = db.query(User).filter(
        User.has_permission("moderate_content")
    ).all()
    
    performance = []
    for moderator in moderators:
        stats = service.get_moderation_stats(
            start_date=start_date,
            end_date=end_date,
            moderator_id=moderator.id
        )
        
        performance.append({
            "moderator_id": moderator.id,
            "moderator_name": moderator.username,
            "stats": stats
        })
    
    # Sort by total actions
    performance.sort(
        key=lambda x: sum(x["stats"]["actions"].values()),
        reverse=True
    )
    
    return {
        "period": {
            "start": start_date.isoformat(),
            "end": end_date.isoformat()
        },
        "moderators": performance
    }