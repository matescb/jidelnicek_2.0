"""
Content moderation service for managing reports and moderation actions.

This service provides functionality for content moderation including report
management, automated moderation, and audit logging.
"""

from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any, Tuple
import json
import re
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func
from sqlalchemy.exc import IntegrityError

from jidelnicek.core.models.user import User
from jidelnicek.core.exceptions import (
    NotFoundError as NotFoundException, 
    ValidationError as ValidationException, 
    PermissionError as ForbiddenException
)
from jidelnicek.admin.models.moderation import (
    ContentReport, ModerationLog, AutoModerationRule,
    BannedContent, ModerationQueue, ReportStatus,
    ReportReason, ModerationAction
)
from jidelnicek.recipe.models.recipe import Recipe
# from jidelnicek.recipe.models.review import Review  # TODO: Review model not implemented yet
from jidelnicek.core.cache import CacheManager
from jidelnicek.core.services.notification_service import NotificationService

def sanitize_html(text: str) -> str:
    """Basic HTML sanitization for moderation notes."""
    if not text:
        return text
    # Basic sanitization - remove script tags and strip HTML
    import re
    # Remove script tags and content
    text = re.sub(r'<script.*?</script>', '', text, flags=re.DOTALL | re.IGNORECASE)
    # Remove other HTML tags but keep content
    text = re.sub(r'<[^>]+>', '', text)
    return text.strip()


class ContentModerationService:
    """Service for content moderation operations."""
    
    def __init__(
        self,
        session: Session,
        cache_service: Optional[CacheManager] = None,
        notification_service: Optional[NotificationService] = None
    ):
        """
        Initialize content moderation service.
        
        Args:
            session: Database session
            cache_service: Optional cache service
            notification_service: Optional notification service
        """
        self.session = session
        self.cache = cache_service
        self.notifications = notification_service
    
    # Report Management
    
    def create_report(
        self,
        reporter_id: int,
        content_type: str,
        content_id: int,
        reason: ReportReason,
        description: Optional[str] = None
    ) -> ContentReport:
        """
        Create a new content report.
        
        Args:
            reporter_id: ID of user making the report
            content_type: Type of content being reported
            content_id: ID of content being reported
            reason: Reason for report
            description: Optional detailed description
            
        Returns:
            Created report
            
        Raises:
            ValidationException: If report is invalid
        """
        # Check if content exists
        if not self._content_exists(content_type, content_id):
            raise ValidationException(f"Content {content_type}:{content_id} not found")
        
        # Check for duplicate report
        existing = self.session.query(ContentReport).filter(
            and_(
                ContentReport.reporter_id == reporter_id,
                ContentReport.content_type == content_type,
                ContentReport.content_id == content_id,
                ContentReport.status.in_([ReportStatus.PENDING, ReportStatus.INVESTIGATING])
            )
        ).first()
        
        if existing:
            raise ValidationException("You have already reported this content")
        
        # Create report
        report = ContentReport(
            reporter_id=reporter_id,
            content_type=content_type,
            content_id=content_id,
            reason=reason,
            description=sanitize_html(description) if description else None,
            priority=self._calculate_priority(reason, content_type)
        )
        
        self.session.add(report)
        self.session.commit()
        
        # Check auto-moderation rules
        self._check_auto_moderation(report)
        
        # Notify moderators if high priority
        if report.priority >= 7:
            self._notify_moderators(report)
        
        return report
    
    def get_report(self, report_id: int) -> ContentReport:
        """
        Get a specific report.
        
        Args:
            report_id: Report ID
            
        Returns:
            Report
            
        Raises:
            NotFoundException: If report not found
        """
        report = self.session.query(ContentReport).filter_by(id=report_id).first()
        if not report:
            raise NotFoundException("Report not found")
        return report
    
    def list_reports(
        self,
        status: Optional[ReportStatus] = None,
        content_type: Optional[str] = None,
        assigned_to: Optional[int] = None,
        limit: int = 50,
        offset: int = 0
    ) -> Tuple[List[ContentReport], int]:
        """
        List content reports with filtering.
        
        Args:
            status: Filter by status
            content_type: Filter by content type
            assigned_to: Filter by assigned moderator
            limit: Maximum number of results
            offset: Number of results to skip
            
        Returns:
            Tuple of (reports, total_count)
        """
        query = self.session.query(ContentReport)
        
        if status:
            query = query.filter(ContentReport.status == status)
        if content_type:
            query = query.filter(ContentReport.content_type == content_type)
        if assigned_to:
            query = query.filter(ContentReport.assigned_to_id == assigned_to)
        
        total = query.count()
        
        reports = query.order_by(
            ContentReport.priority.desc(),
            ContentReport.created_at.desc()
        ).limit(limit).offset(offset).all()
        
        return reports, total
    
    def assign_report(
        self,
        report_id: int,
        moderator_id: int
    ) -> ContentReport:
        """
        Assign a report to a moderator.
        
        Args:
            report_id: Report ID
            moderator_id: Moderator user ID
            
        Returns:
            Updated report
        """
        report = self.get_report(report_id)
        
        report.assigned_to_id = moderator_id
        report.status = ReportStatus.INVESTIGATING
        report.updated_at = datetime.utcnow()
        
        self.session.commit()
        
        return report
    
    def resolve_report(
        self,
        report_id: int,
        moderator_id: int,
        action: Optional[ModerationAction] = None,
        notes: Optional[str] = None,
        dismiss: bool = False
    ) -> ContentReport:
        """
        Resolve a content report.
        
        Args:
            report_id: Report ID
            moderator_id: Moderator resolving the report
            action: Action taken (if any)
            notes: Resolution notes
            dismiss: Whether to dismiss the report
            
        Returns:
            Updated report
        """
        report = self.get_report(report_id)
        
        if dismiss:
            report.status = ReportStatus.DISMISSED
        else:
            report.status = ReportStatus.RESOLVED
            
        report.resolved_at = datetime.utcnow()
        report.resolution_notes = notes
        report.action_taken = action
        
        # Create moderation log if action taken
        if action:
            self._log_moderation_action(
                moderator_id=moderator_id,
                action=action,
                target_type=report.content_type,
                target_id=report.content_id,
                reason=f"Report #{report_id}: {report.reason.value}",
                report_id=report_id
            )
            
            # Execute the action
            self._execute_moderation_action(
                action=action,
                content_type=report.content_type,
                content_id=report.content_id
            )
        
        self.session.commit()
        
        return report
    
    # Moderation Actions
    
    def moderate_content(
        self,
        moderator_id: int,
        content_type: str,
        content_id: int,
        action: ModerationAction,
        reason: str,
        details: Optional[str] = None
    ) -> ModerationLog:
        """
        Take a moderation action on content.
        
        Args:
            moderator_id: Moderator taking action
            content_type: Type of content
            content_id: ID of content
            action: Action to take
            reason: Reason for action
            details: Optional additional details
            
        Returns:
            Moderation log entry
        """
        # Verify content exists
        if not self._content_exists(content_type, content_id):
            raise ValidationException(f"Content {content_type}:{content_id} not found")
        
        # Execute action
        self._execute_moderation_action(action, content_type, content_id)
        
        # Log action
        log = self._log_moderation_action(
            moderator_id=moderator_id,
            action=action,
            target_type=content_type,
            target_id=content_id,
            reason=reason,
            details=details
        )
        
        self.session.commit()
        
        return log
    
    def reverse_moderation(
        self,
        log_id: int,
        moderator_id: int,
        reason: str
    ) -> ModerationLog:
        """
        Reverse a previous moderation action.
        
        Args:
            log_id: ID of moderation log to reverse
            moderator_id: Moderator reversing the action
            reason: Reason for reversal
            
        Returns:
            Updated moderation log
        """
        log = self.session.query(ModerationLog).filter_by(id=log_id).first()
        if not log:
            raise NotFoundException("Moderation log not found")
        
        if log.reversed:
            raise ValidationException("Action has already been reversed")
        
        # Reverse the action
        reverse_action = self._get_reverse_action(log.action)
        if reverse_action:
            self._execute_moderation_action(
                reverse_action,
                log.target_type,
                log.target_id
            )
        
        # Update log
        log.reversed = True
        log.reversed_by_id = moderator_id
        log.reversed_at = datetime.utcnow()
        log.reversal_reason = reason
        
        self.session.commit()
        
        return log
    
    # Auto-moderation
    
    def create_auto_rule(
        self,
        name: str,
        rule_type: str,
        rule_config: Dict[str, Any],
        action: ModerationAction,
        created_by: int,
        content_type: Optional[str] = None,
        description: Optional[str] = None,
        severity: int = 5
    ) -> AutoModerationRule:
        """
        Create an auto-moderation rule.
        
        Args:
            name: Rule name
            rule_type: Type of rule (keyword, pattern, threshold)
            rule_config: Rule configuration
            action: Action to take when rule matches
            created_by: User creating the rule
            content_type: Optional specific content type
            description: Rule description
            severity: Rule severity (1-10)
            
        Returns:
            Created rule
        """
        rule = AutoModerationRule(
            name=name,
            description=description,
            content_type=content_type,
            rule_type=rule_type,
            rule_config=json.dumps(rule_config),
            action=action,
            severity=severity,
            created_by_id=created_by
        )
        
        self.session.add(rule)
        self.session.commit()
        
        return rule
    
    def check_content(
        self,
        content_type: str,
        content: Dict[str, Any]
    ) -> List[AutoModerationRule]:
        """
        Check content against auto-moderation rules.
        
        Args:
            content_type: Type of content
            content: Content data to check
            
        Returns:
            List of matched rules
        """
        # Get active rules
        rules = self.session.query(AutoModerationRule).filter(
            AutoModerationRule.enabled == True,
            or_(
                AutoModerationRule.content_type == None,
                AutoModerationRule.content_type == content_type
            )
        ).all()
        
        matched_rules = []
        
        for rule in rules:
            if self._check_rule(rule, content):
                matched_rules.append(rule)
                rule.matches_count += 1
        
        if matched_rules:
            self.session.commit()
        
        return matched_rules
    
    # Banned Content
    
    def add_banned_pattern(
        self,
        pattern_type: str,
        pattern_value: str,
        reason: str,
        added_by: int,
        severity: int = 5,
        expires_at: Optional[datetime] = None
    ) -> BannedContent:
        """
        Add a banned content pattern.
        
        Args:
            pattern_type: Type of pattern (keyword, domain, etc.)
            pattern_value: Pattern value
            reason: Reason for ban
            added_by: User adding the pattern
            severity: Severity level (1-10)
            expires_at: Optional expiration date
            
        Returns:
            Created banned content entry
        """
        banned = BannedContent(
            pattern_type=pattern_type,
            pattern_value=pattern_value,
            reason=reason,
            severity=severity,
            added_by_id=added_by,
            expires_at=expires_at
        )
        
        self.session.add(banned)
        self.session.commit()
        
        return banned
    
    def check_banned_content(
        self,
        content: Dict[str, Any]
    ) -> List[BannedContent]:
        """
        Check if content contains banned patterns.
        
        Args:
            content: Content to check
            
        Returns:
            List of matched banned patterns
        """
        # Get active banned patterns
        patterns = self.session.query(BannedContent).filter(
            BannedContent.active == True,
            or_(
                BannedContent.expires_at == None,
                BannedContent.expires_at > datetime.utcnow()
            )
        ).all()
        
        matched = []
        
        for pattern in patterns:
            if self._check_banned_pattern(pattern, content):
                matched.append(pattern)
        
        return matched
    
    # Moderation Queue
    
    def add_to_queue(
        self,
        content_type: str,
        content_id: int,
        reason: str,
        priority: int = 0,
        auto_flagged: bool = False,
        rule_id: Optional[int] = None
    ) -> ModerationQueue:
        """
        Add content to moderation queue.
        
        Args:
            content_type: Type of content
            content_id: ID of content
            reason: Reason for queuing
            priority: Priority level
            auto_flagged: Whether auto-flagged
            rule_id: ID of rule that flagged it
            
        Returns:
            Queue entry
        """
        # Check if already in queue
        existing = self.session.query(ModerationQueue).filter(
            and_(
                ModerationQueue.content_type == content_type,
                ModerationQueue.content_id == content_id,
                ModerationQueue.reviewed == False
            )
        ).first()
        
        if existing:
            # Update priority if higher
            if priority > existing.priority:
                existing.priority = priority
            return existing
        
        queue_item = ModerationQueue(
            content_type=content_type,
            content_id=content_id,
            reason=reason,
            priority=priority,
            auto_flagged=auto_flagged,
            rule_id=rule_id
        )
        
        self.session.add(queue_item)
        self.session.commit()
        
        return queue_item
    
    def get_queue_item(self, queue_id: int) -> ModerationQueue:
        """Get a specific queue item."""
        item = self.session.query(ModerationQueue).filter_by(id=queue_id).first()
        if not item:
            raise NotFoundException("Queue item not found")
        return item
    
    def review_queue_item(
        self,
        queue_id: int,
        moderator_id: int
    ) -> ModerationQueue:
        """
        Mark a queue item as reviewed.
        
        Args:
            queue_id: Queue item ID
            moderator_id: Moderator reviewing
            
        Returns:
            Updated queue item
        """
        item = self.get_queue_item(queue_id)
        
        item.reviewed = True
        item.reviewed_at = datetime.utcnow()
        item.assigned_to_id = moderator_id
        
        self.session.commit()
        
        return item
    
    # Statistics
    
    def get_moderation_stats(
        self,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """
        Get moderation statistics.
        
        Args:
            start_date: Start date for stats
            end_date: End date for stats
            
        Returns:
            Dictionary of statistics
        """
        if not start_date:
            start_date = datetime.utcnow() - timedelta(days=30)
        if not end_date:
            end_date = datetime.utcnow()
        
        # Report stats
        report_query = self.session.query(ContentReport).filter(
            ContentReport.created_at.between(start_date, end_date)
        )
        
        total_reports = report_query.count()
        pending_reports = report_query.filter(
            ContentReport.status == ReportStatus.PENDING
        ).count()
        resolved_reports = report_query.filter(
            ContentReport.status == ReportStatus.RESOLVED
        ).count()
        
        # Action stats
        action_query = self.session.query(ModerationLog).filter(
            ModerationLog.created_at.between(start_date, end_date)
        )
        
        total_actions = action_query.count()
        
        # Queue stats
        queue_pending = self.session.query(ModerationQueue).filter(
            ModerationQueue.reviewed == False
        ).count()
        
        return {
            "reports": {
                "total": total_reports,
                "pending": pending_reports,
                "resolved": resolved_reports,
                "resolution_rate": resolved_reports / total_reports if total_reports > 0 else 0
            },
            "actions": {
                "total": total_actions,
                "by_type": self._get_actions_by_type(start_date, end_date)
            },
            "queue": {
                "pending": queue_pending
            },
            "period": {
                "start": start_date.isoformat(),
                "end": end_date.isoformat()
            }
        }
    
    # Private helper methods
    
    def _content_exists(self, content_type: str, content_id: int) -> bool:
        """Check if content exists."""
        if content_type == "recipe":
            return self.session.query(Recipe).filter_by(id=content_id).count() > 0
        elif content_type == "review":
            # return self.session.query(Review).filter_by(id=content_id).count() > 0  # TODO: Review model not implemented yet
            return False  # TODO: Implement when Review model exists
        # Add more content types as needed
        return False
    
    def _calculate_priority(self, reason: ReportReason, content_type: str) -> int:
        """Calculate report priority based on reason and content type."""
        base_priority = {
            ReportReason.SPAM: 3,
            ReportReason.INAPPROPRIATE: 5,
            ReportReason.COPYRIGHT: 7,
            ReportReason.MISINFORMATION: 6,
            ReportReason.OFFENSIVE: 8,
            ReportReason.OTHER: 2
        }.get(reason, 2)
        
        # Adjust based on content type
        if content_type == "recipe":
            base_priority += 1
        
        return min(base_priority, 10)
    
    def _check_auto_moderation(self, report: ContentReport):
        """Check if report triggers auto-moderation."""
        # Count recent reports for same content
        recent_count = self.session.query(ContentReport).filter(
            and_(
                ContentReport.content_type == report.content_type,
                ContentReport.content_id == report.content_id,
                ContentReport.created_at > datetime.utcnow() - timedelta(hours=24)
            )
        ).count()
        
        # Auto-flag if multiple reports
        if recent_count >= 3:
            self.add_to_queue(
                content_type=report.content_type,
                content_id=report.content_id,
                reason=f"Multiple reports ({recent_count}) in 24 hours",
                priority=8,
                auto_flagged=True
            )
    
    def _notify_moderators(self, report: ContentReport):
        """Notify moderators of high-priority report."""
        if self.notifications:
            # Get moderator IDs (implement based on your role system)
            moderator_ids = []  # TODO: Get moderator IDs
            
            for mod_id in moderator_ids:
                self.notifications.send_notification(
                    user_id=mod_id,
                    type="high_priority_report",
                    data={
                        "report_id": report.id,
                        "content_type": report.content_type,
                        "reason": report.reason.value
                    }
                )
    
    def _log_moderation_action(
        self,
        moderator_id: int,
        action: ModerationAction,
        target_type: str,
        target_id: int,
        reason: str,
        details: Optional[str] = None,
        report_id: Optional[int] = None
    ) -> ModerationLog:
        """Create moderation log entry."""
        log = ModerationLog(
            moderator_id=moderator_id,
            action=action,
            target_type=target_type,
            target_id=target_id,
            reason=reason,
            details=details,
            report_id=report_id
        )
        
        self.session.add(log)
        return log
    
    def _execute_moderation_action(
        self,
        action: ModerationAction,
        content_type: str,
        content_id: int
    ):
        """Execute a moderation action on content."""
        if content_type == "recipe":
            recipe = self.session.query(Recipe).filter_by(id=content_id).first()
            if recipe:
                if action == ModerationAction.REMOVE:
                    recipe.is_active = False
                elif action == ModerationAction.HIDE:
                    recipe.is_visible = False
                elif action == ModerationAction.RESTORE:
                    recipe.is_active = True
                    recipe.is_visible = True
        elif content_type == "review":
            # TODO: Review model not implemented yet
            # review = self.session.query(Review).filter_by(id=content_id).first()
            # if review:
            #     if action == ModerationAction.REMOVE:
            #         self.session.delete(review)
            #     # Add more actions as needed
            pass  # TODO: Implement when Review model exists
        
        # Clear cache if applicable
        if self.cache:
            self.cache.delete(f"{content_type}:{content_id}")
    
    def _get_reverse_action(self, action: ModerationAction) -> Optional[ModerationAction]:
        """Get the reverse of a moderation action."""
        reverses = {
            ModerationAction.REMOVE: ModerationAction.RESTORE,
            ModerationAction.HIDE: ModerationAction.RESTORE,
            ModerationAction.BAN: ModerationAction.UNBAN,
            ModerationAction.FLAG: None,
            ModerationAction.WARN: None
        }
        return reverses.get(action)
    
    def _check_rule(self, rule: AutoModerationRule, content: Dict[str, Any]) -> bool:
        """Check if content matches an auto-moderation rule."""
        config = json.loads(rule.rule_config)
        
        if rule.rule_type == "keyword":
            keywords = config.get("keywords", [])
            text = " ".join(str(v) for v in content.values() if isinstance(v, str))
            text_lower = text.lower()
            
            for keyword in keywords:
                if keyword.lower() in text_lower:
                    return True
                    
        elif rule.rule_type == "pattern":
            pattern = config.get("pattern")
            if pattern:
                text = " ".join(str(v) for v in content.values() if isinstance(v, str))
                if re.search(pattern, text, re.IGNORECASE):
                    return True
                    
        elif rule.rule_type == "threshold":
            # Implement threshold-based rules (e.g., spam score)
            pass
        
        return False
    
    def _check_banned_pattern(
        self,
        pattern: BannedContent,
        content: Dict[str, Any]
    ) -> bool:
        """Check if content matches a banned pattern."""
        if pattern.pattern_type == "keyword":
            text = " ".join(str(v) for v in content.values() if isinstance(v, str))
            return pattern.pattern_value.lower() in text.lower()
            
        elif pattern.pattern_type == "domain":
            # Check for domain in URLs
            text = " ".join(str(v) for v in content.values() if isinstance(v, str))
            return pattern.pattern_value in text
            
        return False
    
    def _get_actions_by_type(
        self,
        start_date: datetime,
        end_date: datetime
    ) -> Dict[str, int]:
        """Get count of actions by type."""
        results = self.session.query(
            ModerationLog.action,
            func.count(ModerationLog.id)
        ).filter(
            ModerationLog.created_at.between(start_date, end_date)
        ).group_by(ModerationLog.action).all()
        
        return {action.value: count for action, count in results}