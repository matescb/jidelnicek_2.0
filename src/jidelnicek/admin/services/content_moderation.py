"""
Content moderation service for managing user-generated content.

This service provides functionality for content moderation, including
report handling, automated filtering, sanction management, and appeal processing.
"""

import re
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_, desc
from redis import Redis
import logging

from jidelnicek.admin.models.moderation import (
    ContentReport, ModerationActionLog, UserSanction, UserAppeal,
    ModerationTemplate, ContentFilter, ModerationQueue,
    ContentType, ReportReason, ModerationStatus, ModerationAction,
    SanctionType, AppealStatus
)
from jidelnicek.core.models.user import User
from jidelnicek.core.services.audit import AuditService
from jidelnicek.common.exceptions import ValidationError, AuthorizationError
from jidelnicek.common.utils.text import sanitize_text


logger = logging.getLogger(__name__)


class ContentModerationService:
    """Service for content moderation operations."""
    
    def __init__(self, db: Session, redis_client: Redis, audit_service: AuditService):
        self.db = db
        self.redis = redis_client
        self.audit = audit_service
        
    # Report Management
    
    def create_report(
        self,
        reporter_id: int,
        content_type: ContentType,
        content_id: int,
        reason: ReportReason,
        description: Optional[str] = None
    ) -> ContentReport:
        """Create a new content report."""
        # Check for existing report from same user
        existing = self.db.query(ContentReport).filter(
            and_(
                ContentReport.reporter_id == reporter_id,
                ContentReport.content_type == content_type,
                ContentReport.content_id == content_id
            )
        ).first()
        
        if existing:
            raise ValidationError("You have already reported this content")
        
        # Calculate priority score
        priority_score = self._calculate_report_priority(
            reporter_id, content_type, reason
        )
        
        # Create report
        report = ContentReport(
            reporter_id=reporter_id,
            content_type=content_type,
            content_id=content_id,
            reason=reason,
            description=sanitize_text(description) if description else None,
            priority_score=priority_score
        )
        
        self.db.add(report)
        self.db.commit()
        
        # Add to moderation queue if high priority
        if priority_score >= 7:
            self._add_to_queue(content_type, content_id, priority_score)
        
        # Log audit event
        self.audit.log_event(
            "content_reported",
            reporter_id,
            {
                "report_id": report.id,
                "content_type": content_type.value,
                "content_id": content_id,
                "reason": reason.value
            }
        )
        
        return report
    
    def get_pending_reports(
        self,
        moderator_id: int,
        limit: int = 20,
        content_type: Optional[ContentType] = None
    ) -> List[ContentReport]:
        """Get pending reports for moderation."""
        query = self.db.query(ContentReport).filter(
            ContentReport.status == ModerationStatus.PENDING
        )
        
        if content_type:
            query = query.filter(ContentReport.content_type == content_type)
        
        # Order by priority and age
        reports = query.order_by(
            desc(ContentReport.priority_score),
            ContentReport.created_at
        ).limit(limit).all()
        
        # Mark as in review
        for report in reports:
            report.status = ModerationStatus.IN_REVIEW
            report.assigned_to = moderator_id
        
        self.db.commit()
        
        return reports
    
    # Moderation Actions
    
    def moderate_content(
        self,
        moderator_id: int,
        report_id: int,
        action: ModerationAction,
        reason: str,
        template_id: Optional[int] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> ModerationActionLog:
        """Take moderation action on reported content."""
        # Get report
        report = self.db.query(ContentReport).filter(
            ContentReport.id == report_id
        ).first()
        
        if not report:
            raise ValidationError("Report not found")
        
        if report.assigned_to != moderator_id:
            raise AuthorizationError("Report not assigned to you")
        
        # Create action log
        action_log = ModerationActionLog(
            report_id=report_id,
            moderator_id=moderator_id,
            action=action,
            content_type=report.content_type,
            content_id=report.content_id,
            reason=reason,
            template_id=template_id,
            metadata=metadata
        )
        
        self.db.add(action_log)
        
        # Update report status
        report.status = self._get_report_status_for_action(action)
        report.reviewed_at = datetime.utcnow()
        report.resolution = reason
        
        # Apply the action
        self._apply_moderation_action(
            report.content_type,
            report.content_id,
            action,
            metadata
        )
        
        # Update template usage count
        if template_id:
            template = self.db.query(ModerationTemplate).filter(
                ModerationTemplate.id == template_id
            ).first()
            if template:
                template.usage_count += 1
        
        self.db.commit()
        
        # Clear from queue
        self._remove_from_queue(report.content_type, report.content_id)
        
        # Log audit event
        self.audit.log_event(
            "content_moderated",
            moderator_id,
            {
                "report_id": report_id,
                "action": action.value,
                "content_type": report.content_type.value,
                "content_id": report.content_id
            }
        )
        
        return action_log
    
    def bulk_moderate(
        self,
        moderator_id: int,
        report_ids: List[int],
        action: ModerationAction,
        template_id: int
    ) -> List[ModerationActionLog]:
        """Apply bulk moderation action using template."""
        template = self.db.query(ModerationTemplate).filter(
            ModerationTemplate.id == template_id
        ).first()
        
        if not template:
            raise ValidationError("Template not found")
        
        action_logs = []
        
        for report_id in report_ids:
            try:
                log = self.moderate_content(
                    moderator_id=moderator_id,
                    report_id=report_id,
                    action=action,
                    reason=template.response_text,
                    template_id=template_id
                )
                action_logs.append(log)
            except Exception as e:
                logger.error(f"Failed to moderate report {report_id}: {e}")
        
        return action_logs
    
    # Sanction Management
    
    def issue_sanction(
        self,
        issuer_id: int,
        user_id: int,
        sanction_type: SanctionType,
        reason: str,
        duration_days: Optional[int] = None,
        evidence: Optional[Dict[str, Any]] = None
    ) -> UserSanction:
        """Issue a sanction against a user."""
        # Check for active sanctions
        active_sanctions = self.db.query(UserSanction).filter(
            and_(
                UserSanction.user_id == user_id,
                UserSanction.is_active == True
            )
        ).all()
        
        # Escalate if user has recent sanctions
        if sanction_type == SanctionType.WARNING and len(active_sanctions) >= 2:
            sanction_type = SanctionType.TEMPORARY_BAN
            duration_days = duration_days or 7
        
        # Calculate expiration
        expires_at = None
        if duration_days and sanction_type != SanctionType.PERMANENT_BAN:
            expires_at = datetime.utcnow() + timedelta(days=duration_days)
        
        # Create sanction
        sanction = UserSanction(
            user_id=user_id,
            issued_by=issuer_id,
            type=sanction_type,
            reason=reason,
            evidence=evidence,
            expires_at=expires_at
        )
        
        self.db.add(sanction)
        self.db.commit()
        
        # Apply sanction effects
        self._apply_sanction_effects(user_id, sanction_type)
        
        # Log audit event
        self.audit.log_event(
            "sanction_issued",
            issuer_id,
            {
                "sanction_id": sanction.id,
                "user_id": user_id,
                "type": sanction_type.value,
                "duration_days": duration_days
            }
        )
        
        return sanction
    
    def lift_sanction(
        self,
        lifter_id: int,
        sanction_id: int,
        reason: str
    ) -> UserSanction:
        """Lift an active sanction."""
        sanction = self.db.query(UserSanction).filter(
            UserSanction.id == sanction_id
        ).first()
        
        if not sanction:
            raise ValidationError("Sanction not found")
        
        if not sanction.is_active:
            raise ValidationError("Sanction is already inactive")
        
        # Lift sanction
        sanction.is_active = False
        sanction.lifted_at = datetime.utcnow()
        sanction.lifted_by = lifter_id
        sanction.lift_reason = reason
        
        self.db.commit()
        
        # Remove sanction effects
        self._remove_sanction_effects(sanction.user_id, sanction.type)
        
        # Log audit event
        self.audit.log_event(
            "sanction_lifted",
            lifter_id,
            {
                "sanction_id": sanction_id,
                "user_id": sanction.user_id,
                "reason": reason
            }
        )
        
        return sanction
    
    # Appeal Processing
    
    def create_appeal(
        self,
        user_id: int,
        sanction_id: Optional[int],
        reason: str,
        evidence: Optional[Dict[str, Any]] = None
    ) -> UserAppeal:
        """Create an appeal against a sanction or moderation decision."""
        # Validate sanction if provided
        if sanction_id:
            sanction = self.db.query(UserSanction).filter(
                and_(
                    UserSanction.id == sanction_id,
                    UserSanction.user_id == user_id
                )
            ).first()
            
            if not sanction:
                raise ValidationError("Sanction not found or not yours")
            
            # Check for existing appeal
            existing = self.db.query(UserAppeal).filter(
                and_(
                    UserAppeal.sanction_id == sanction_id,
                    UserAppeal.status.in_([
                        AppealStatus.PENDING,
                        AppealStatus.IN_REVIEW
                    ])
                )
            ).first()
            
            if existing:
                raise ValidationError("Appeal already pending for this sanction")
        
        # Create appeal with 30-day expiration
        appeal = UserAppeal(
            user_id=user_id,
            sanction_id=sanction_id,
            reason=sanitize_text(reason),
            evidence=evidence,
            expires_at=datetime.utcnow() + timedelta(days=30)
        )
        
        self.db.add(appeal)
        self.db.commit()
        
        # Log audit event
        self.audit.log_event(
            "appeal_created",
            user_id,
            {
                "appeal_id": appeal.id,
                "sanction_id": sanction_id
            }
        )
        
        return appeal
    
    def review_appeal(
        self,
        reviewer_id: int,
        appeal_id: int,
        approved: bool,
        decision: str
    ) -> UserAppeal:
        """Review and decide on an appeal."""
        appeal = self.db.query(UserAppeal).filter(
            UserAppeal.id == appeal_id
        ).first()
        
        if not appeal:
            raise ValidationError("Appeal not found")
        
        if appeal.status != AppealStatus.PENDING:
            raise ValidationError("Appeal is not pending review")
        
        # Update appeal
        appeal.status = AppealStatus.APPROVED if approved else AppealStatus.REJECTED
        appeal.reviewed_by = reviewer_id
        appeal.reviewed_at = datetime.utcnow()
        appeal.decision = decision
        
        # If approved and has sanction, lift it
        if approved and appeal.sanction_id:
            self.lift_sanction(
                reviewer_id,
                appeal.sanction_id,
                f"Appeal approved: {decision}"
            )
        
        self.db.commit()
        
        # Log audit event
        self.audit.log_event(
            "appeal_reviewed",
            reviewer_id,
            {
                "appeal_id": appeal_id,
                "approved": approved,
                "user_id": appeal.user_id
            }
        )
        
        return appeal
    
    # Content Filtering
    
    def create_filter(
        self,
        creator_id: int,
        name: str,
        filter_type: str,
        pattern: str,
        action: ModerationAction,
        content_type: Optional[ContentType] = None,
        severity: int = 1,
        auto_report: bool = False
    ) -> ContentFilter:
        """Create a new content filter rule."""
        # Validate pattern based on type
        if filter_type == "regex":
            try:
                re.compile(pattern)
            except re.error:
                raise ValidationError("Invalid regex pattern")
        
        filter_rule = ContentFilter(
            name=name,
            content_type=content_type,
            filter_type=filter_type,
            pattern=pattern,
            action=action,
            severity=severity,
            auto_report=auto_report,
            created_by=creator_id
        )
        
        self.db.add(filter_rule)
        self.db.commit()
        
        # Cache filter for fast access
        self._cache_filter(filter_rule)
        
        return filter_rule
    
    def check_content(
        self,
        content_type: ContentType,
        content: str,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Tuple[bool, Optional[ContentFilter], Optional[ModerationAction]]:
        """Check content against active filters."""
        # Get active filters
        filters = self._get_active_filters(content_type)
        
        for filter_rule in filters:
            if self._apply_filter(filter_rule, content, metadata):
                return False, filter_rule, filter_rule.action
        
        return True, None, None
    
    def auto_moderate(
        self,
        content_type: ContentType,
        content_id: int,
        content: str,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Optional[ModerationActionLog]:
        """Automatically moderate content based on filters."""
        passed, filter_rule, action = self.check_content(
            content_type, content, metadata
        )
        
        if not passed and filter_rule:
            # Create auto-generated report if configured
            if filter_rule.auto_report:
                report = ContentReport(
                    reporter_id=1,  # System user
                    content_type=content_type,
                    content_id=content_id,
                    reason=ReportReason.OTHER,
                    description=f"Auto-flagged by filter: {filter_rule.name}",
                    priority_score=filter_rule.severity
                )
                self.db.add(report)
                self.db.commit()
                
                # Add to moderation queue
                self._add_to_queue(
                    content_type,
                    content_id,
                    filter_rule.severity,
                    auto_flagged=True
                )
            
            # Apply immediate action if configured
            if action in [ModerationAction.DELETE, ModerationAction.HIDE]:
                action_log = ModerationActionLog(
                    moderator_id=1,  # System user
                    action=action,
                    content_type=content_type,
                    content_id=content_id,
                    reason=f"Automated action by filter: {filter_rule.name}"
                )
                self.db.add(action_log)
                
                self._apply_moderation_action(
                    content_type, content_id, action, {}
                )
                
                self.db.commit()
                return action_log
        
        return None
    
    # Analytics and Metrics
    
    def get_moderation_stats(
        self,
        start_date: datetime,
        end_date: datetime,
        moderator_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """Get moderation statistics for a date range."""
        # Base query
        query = self.db.query(ModerationActionLog).filter(
            ModerationActionLog.created_at.between(start_date, end_date)
        )
        
        if moderator_id:
            query = query.filter(ModerationActionLog.moderator_id == moderator_id)
        
        # Get action counts
        action_counts = {}
        for action in ModerationAction:
            count = query.filter(
                ModerationActionLog.action == action
            ).count()
            action_counts[action.value] = count
        
        # Get report stats
        report_query = self.db.query(ContentReport).filter(
            ContentReport.created_at.between(start_date, end_date)
        )
        
        if moderator_id:
            report_query = report_query.filter(
                ContentReport.assigned_to == moderator_id
            )
        
        total_reports = report_query.count()
        resolved_reports = report_query.filter(
            ContentReport.status.in_([
                ModerationStatus.APPROVED,
                ModerationStatus.REJECTED
            ])
        ).count()
        
        # Average resolution time
        avg_resolution_time = self.db.query(
            func.avg(
                func.extract(
                    'epoch',
                    ContentReport.reviewed_at - ContentReport.created_at
                )
            )
        ).filter(
            and_(
                ContentReport.reviewed_at.isnot(None),
                ContentReport.created_at.between(start_date, end_date)
            )
        ).scalar()
        
        # Sanction stats
        sanction_query = self.db.query(UserSanction).filter(
            UserSanction.created_at.between(start_date, end_date)
        )
        
        if moderator_id:
            sanction_query = sanction_query.filter(
                UserSanction.issued_by == moderator_id
            )
        
        sanction_counts = {}
        for sanction_type in SanctionType:
            count = sanction_query.filter(
                UserSanction.type == sanction_type
            ).count()
            sanction_counts[sanction_type.value] = count
        
        return {
            "period": {
                "start": start_date.isoformat(),
                "end": end_date.isoformat()
            },
            "reports": {
                "total": total_reports,
                "resolved": resolved_reports,
                "resolution_rate": (resolved_reports / total_reports * 100) 
                                 if total_reports > 0 else 0,
                "avg_resolution_time_seconds": avg_resolution_time or 0
            },
            "actions": action_counts,
            "sanctions": sanction_counts,
            "moderator_id": moderator_id
        }
    
    # Helper methods
    
    def _calculate_report_priority(
        self,
        reporter_id: int,
        content_type: ContentType,
        reason: ReportReason
    ) -> int:
        """Calculate priority score for a report."""
        score = 0
        
        # Base score by reason
        reason_scores = {
            ReportReason.SPAM: 3,
            ReportReason.INAPPROPRIATE: 5,
            ReportReason.OFFENSIVE: 7,
            ReportReason.MISINFORMATION: 6,
            ReportReason.COPYRIGHT: 8,
            ReportReason.PRIVACY: 9,
            ReportReason.OTHER: 2
        }
        score += reason_scores.get(reason, 0)
        
        # Boost for trusted reporters
        reporter = self.db.query(User).filter(User.id == reporter_id).first()
        if reporter and reporter.reputation_score > 100:
            score += 2
        
        # Boost for sensitive content types
        if content_type in [ContentType.USER_PROFILE, ContentType.IMAGE]:
            score += 1
        
        return min(score, 10)  # Cap at 10
    
    def _get_report_status_for_action(
        self,
        action: ModerationAction
    ) -> ModerationStatus:
        """Map moderation action to report status."""
        status_map = {
            ModerationAction.APPROVE: ModerationStatus.APPROVED,
            ModerationAction.REJECT: ModerationStatus.REJECTED,
            ModerationAction.DELETE: ModerationStatus.REJECTED,
            ModerationAction.HIDE: ModerationStatus.REJECTED,
            ModerationAction.ESCALATE: ModerationStatus.ESCALATED
        }
        return status_map.get(action, ModerationStatus.APPROVED)
    
    def _apply_moderation_action(
        self,
        content_type: ContentType,
        content_id: int,
        action: ModerationAction,
        metadata: Optional[Dict[str, Any]]
    ):
        """Apply the moderation action to the content."""
        # This would integrate with specific content services
        # For now, we'll just cache the action
        cache_key = f"moderation:{content_type.value}:{content_id}"
        self.redis.setex(
            cache_key,
            86400,  # 24 hours
            action.value
        )
    
    def _apply_sanction_effects(
        self,
        user_id: int,
        sanction_type: SanctionType
    ):
        """Apply the effects of a sanction."""
        cache_key = f"user:sanctions:{user_id}"
        sanctions = self.redis.get(cache_key) or []
        if isinstance(sanctions, bytes):
            sanctions = []
        sanctions.append(sanction_type.value)
        self.redis.setex(cache_key, 86400 * 30, str(sanctions))
    
    def _remove_sanction_effects(
        self,
        user_id: int,
        sanction_type: SanctionType
    ):
        """Remove the effects of a sanction."""
        cache_key = f"user:sanctions:{user_id}"
        sanctions = self.redis.get(cache_key) or []
        if isinstance(sanctions, bytes):
            sanctions = eval(sanctions.decode())
        if sanction_type.value in sanctions:
            sanctions.remove(sanction_type.value)
        self.redis.setex(cache_key, 86400 * 30, str(sanctions))
    
    def _add_to_queue(
        self,
        content_type: ContentType,
        content_id: int,
        priority: int,
        auto_flagged: bool = False
    ):
        """Add content to moderation queue."""
        # Check if already in queue
        existing = self.db.query(ModerationQueue).filter(
            and_(
                ModerationQueue.content_type == content_type,
                ModerationQueue.content_id == content_id
            )
        ).first()
        
        if not existing:
            queue_item = ModerationQueue(
                content_type=content_type,
                content_id=content_id,
                priority=priority,
                auto_flagged=auto_flagged
            )
            self.db.add(queue_item)
            self.db.commit()
    
    def _remove_from_queue(
        self,
        content_type: ContentType,
        content_id: int
    ):
        """Remove content from moderation queue."""
        self.db.query(ModerationQueue).filter(
            and_(
                ModerationQueue.content_type == content_type,
                ModerationQueue.content_id == content_id
            )
        ).delete()
        self.db.commit()
    
    def _cache_filter(self, filter_rule: ContentFilter):
        """Cache filter for fast access."""
        cache_key = f"filter:{filter_rule.id}"
        self.redis.setex(
            cache_key,
            3600,  # 1 hour
            filter_rule.pattern
        )
    
    def _get_active_filters(
        self,
        content_type: ContentType
    ) -> List[ContentFilter]:
        """Get active filters for content type."""
        filters = self.db.query(ContentFilter).filter(
            and_(
                ContentFilter.is_active == True,
                or_(
                    ContentFilter.content_type == content_type,
                    ContentFilter.content_type.is_(None)
                )
            )
        ).order_by(desc(ContentFilter.severity)).all()
        
        return filters
    
    def _apply_filter(
        self,
        filter_rule: ContentFilter,
        content: str,
        metadata: Optional[Dict[str, Any]]
    ) -> bool:
        """Apply a filter rule to content."""
        if filter_rule.filter_type == "keyword":
            return filter_rule.pattern.lower() in content.lower()
        
        elif filter_rule.filter_type == "regex":
            try:
                return bool(re.search(filter_rule.pattern, content, re.IGNORECASE))
            except:
                return False
        
        elif filter_rule.filter_type == "ml_model":
            # Placeholder for ML-based filtering
            # Would integrate with ML service
            return False
        
        return False