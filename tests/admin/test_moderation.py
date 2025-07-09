"""
Tests for content moderation system.

This module tests the moderation functionality including reports,
actions, sanctions, appeals, and automated filtering.
"""

import pytest
from datetime import datetime, timedelta
from unittest.mock import Mock, patch
from sqlalchemy.orm import Session
from redis import Redis

from jidelnicek.admin.services.content_moderation import ContentModerationService
from jidelnicek.admin.models.moderation import (
    ContentReport, ModerationActionLog, UserSanction, UserAppeal,
    ModerationTemplate, ContentFilter, ModerationQueue,
    ContentType, ReportReason, ModerationStatus, ModerationAction,
    SanctionType, AppealStatus
)
from jidelnicek.core.models.user import User
from jidelnicek.core.services.audit import AuditService
from jidelnicek.common.exceptions import ValidationError, AuthorizationError


@pytest.fixture
def mock_db():
    """Mock database session."""
    return Mock(spec=Session)


@pytest.fixture
def mock_redis():
    """Mock Redis client."""
    return Mock(spec=Redis)


@pytest.fixture
def mock_audit():
    """Mock audit service."""
    return Mock(spec=AuditService)


@pytest.fixture
def moderation_service(mock_db, mock_redis, mock_audit):
    """Create moderation service instance."""
    return ContentModerationService(mock_db, mock_redis, mock_audit)


@pytest.fixture
def sample_user():
    """Create sample user."""
    user = User(
        id=1,
        username="testuser",
        email="test@example.com",
        reputation_score=150
    )
    return user


@pytest.fixture
def sample_moderator():
    """Create sample moderator."""
    moderator = User(
        id=2,
        username="moderator",
        email="mod@example.com"
    )
    return moderator


@pytest.fixture
def sample_report():
    """Create sample content report."""
    report = ContentReport(
        id=1,
        reporter_id=1,
        content_type=ContentType.RECIPE,
        content_id=100,
        reason=ReportReason.INAPPROPRIATE,
        description="Contains inappropriate content",
        priority_score=5,
        status=ModerationStatus.PENDING
    )
    return report


class TestReportManagement:
    """Test report creation and management."""
    
    def test_create_report_success(self, moderation_service, mock_db, sample_user):
        """Test successful report creation."""
        # Mock query results
        mock_db.query.return_value.filter.return_value.first.return_value = None
        mock_db.query.return_value.filter.return_value.first.side_effect = [None, sample_user]
        
        # Create report
        report = moderation_service.create_report(
            reporter_id=1,
            content_type=ContentType.RECIPE,
            content_id=100,
            reason=ReportReason.INAPPROPRIATE,
            description="Test report"
        )
        
        # Verify report created
        assert mock_db.add.called
        assert mock_db.commit.called
        
        # Verify audit logged
        moderation_service.audit.log_event.assert_called_once()
    
    def test_create_duplicate_report_fails(self, moderation_service, mock_db, sample_report):
        """Test duplicate report prevention."""
        # Mock existing report
        mock_db.query.return_value.filter.return_value.first.return_value = sample_report
        
        # Attempt to create duplicate
        with pytest.raises(ValidationError) as exc:
            moderation_service.create_report(
                reporter_id=1,
                content_type=ContentType.RECIPE,
                content_id=100,
                reason=ReportReason.INAPPROPRIATE
            )
        
        assert "already reported" in str(exc.value)
    
    def test_calculate_report_priority(self, moderation_service, mock_db, sample_user):
        """Test priority calculation logic."""
        # Mock user query
        mock_db.query.return_value.filter.return_value.first.return_value = sample_user
        
        # Test different reasons
        priority = moderation_service._calculate_report_priority(
            1, ContentType.RECIPE, ReportReason.PRIVACY
        )
        assert priority == 11  # 9 (privacy) + 2 (trusted reporter)
        
        priority = moderation_service._calculate_report_priority(
            1, ContentType.IMAGE, ReportReason.SPAM
        )
        assert priority == 6  # 3 (spam) + 2 (trusted) + 1 (sensitive type)
    
    def test_get_pending_reports(self, moderation_service, mock_db, sample_report):
        """Test fetching pending reports."""
        # Mock query results
        mock_query = mock_db.query.return_value
        mock_query.filter.return_value = mock_query
        mock_query.order_by.return_value = mock_query
        mock_query.limit.return_value.all.return_value = [sample_report]
        
        # Get reports
        reports = moderation_service.get_pending_reports(
            moderator_id=2,
            limit=10,
            content_type=ContentType.RECIPE
        )
        
        # Verify results
        assert len(reports) == 1
        assert reports[0].status == ModerationStatus.IN_REVIEW
        assert reports[0].assigned_to == 2


class TestModerationActions:
    """Test moderation action functionality."""
    
    def test_moderate_content_success(self, moderation_service, mock_db, sample_report):
        """Test successful content moderation."""
        # Setup mocks
        sample_report.assigned_to = 2
        mock_db.query.return_value.filter.return_value.first.return_value = sample_report
        
        # Moderate content
        action_log = moderation_service.moderate_content(
            moderator_id=2,
            report_id=1,
            action=ModerationAction.REJECT,
            reason="Violates community guidelines"
        )
        
        # Verify action log created
        assert mock_db.add.called
        assert mock_db.commit.called
        
        # Verify report updated
        assert sample_report.status == ModerationStatus.REJECTED
        assert sample_report.reviewed_at is not None
        
        # Verify audit logged
        moderation_service.audit.log_event.assert_called_once()
    
    def test_moderate_unassigned_report_fails(self, moderation_service, mock_db, sample_report):
        """Test moderation of unassigned report fails."""
        # Setup report assigned to different moderator
        sample_report.assigned_to = 3
        mock_db.query.return_value.filter.return_value.first.return_value = sample_report
        
        # Attempt moderation
        with pytest.raises(AuthorizationError):
            moderation_service.moderate_content(
                moderator_id=2,
                report_id=1,
                action=ModerationAction.REJECT,
                reason="Test"
            )
    
    def test_bulk_moderate(self, moderation_service, mock_db):
        """Test bulk moderation with template."""
        # Mock template
        template = ModerationTemplate(
            id=1,
            name="Spam Template",
            response_text="This content has been removed as spam",
            usage_count=0
        )
        mock_db.query.return_value.filter.return_value.first.return_value = template
        
        # Mock moderate_content to succeed
        with patch.object(moderation_service, 'moderate_content') as mock_moderate:
            mock_moderate.return_value = ModerationActionLog(id=1)
            
            # Bulk moderate
            logs = moderation_service.bulk_moderate(
                moderator_id=2,
                report_ids=[1, 2, 3],
                action=ModerationAction.DELETE,
                template_id=1
            )
            
            # Verify all reports processed
            assert len(logs) == 3
            assert mock_moderate.call_count == 3


class TestSanctionManagement:
    """Test user sanction functionality."""
    
    def test_issue_sanction_success(self, moderation_service, mock_db):
        """Test successful sanction issuance."""
        # Mock no active sanctions
        mock_db.query.return_value.filter.return_value.all.return_value = []
        
        # Issue sanction
        sanction = moderation_service.issue_sanction(
            issuer_id=2,
            user_id=1,
            sanction_type=SanctionType.WARNING,
            reason="First warning for inappropriate content"
        )
        
        # Verify sanction created
        assert mock_db.add.called
        assert mock_db.commit.called
        
        # Verify effects applied
        moderation_service.redis.setex.assert_called()
        
        # Verify audit logged
        moderation_service.audit.log_event.assert_called_once()
    
    def test_sanction_escalation(self, moderation_service, mock_db):
        """Test automatic sanction escalation."""
        # Mock existing warnings
        existing_sanctions = [
            UserSanction(type=SanctionType.WARNING, is_active=True),
            UserSanction(type=SanctionType.WARNING, is_active=True)
        ]
        mock_db.query.return_value.filter.return_value.all.return_value = existing_sanctions
        
        # Issue another warning
        sanction = moderation_service.issue_sanction(
            issuer_id=2,
            user_id=1,
            sanction_type=SanctionType.WARNING,
            reason="Third violation"
        )
        
        # Verify escalation to temporary ban
        assert mock_db.add.call_args[0][0].type == SanctionType.TEMPORARY_BAN
        assert mock_db.add.call_args[0][0].expires_at is not None
    
    def test_lift_sanction(self, moderation_service, mock_db):
        """Test lifting an active sanction."""
        # Mock active sanction
        sanction = UserSanction(
            id=1,
            user_id=1,
            type=SanctionType.TEMPORARY_BAN,
            is_active=True
        )
        mock_db.query.return_value.filter.return_value.first.return_value = sanction
        
        # Lift sanction
        lifted = moderation_service.lift_sanction(
            lifter_id=2,
            sanction_id=1,
            reason="Appeal approved"
        )
        
        # Verify sanction updated
        assert not sanction.is_active
        assert sanction.lifted_at is not None
        assert sanction.lifted_by == 2
        
        # Verify effects removed
        moderation_service.redis.setex.assert_called()


class TestAppealProcessing:
    """Test appeal functionality."""
    
    def test_create_appeal_success(self, moderation_service, mock_db):
        """Test successful appeal creation."""
        # Mock sanction
        sanction = UserSanction(id=1, user_id=1)
        mock_db.query.return_value.filter.return_value.first.side_effect = [
            sanction,  # Sanction exists
            None       # No existing appeal
        ]
        
        # Create appeal
        appeal = moderation_service.create_appeal(
            user_id=1,
            sanction_id=1,
            reason="I believe this was a mistake",
            evidence={"screenshots": ["url1", "url2"]}
        )
        
        # Verify appeal created
        assert mock_db.add.called
        assert mock_db.commit.called
        
        # Verify expiration set
        added_appeal = mock_db.add.call_args[0][0]
        assert added_appeal.expires_at > datetime.utcnow()
    
    def test_create_duplicate_appeal_fails(self, moderation_service, mock_db):
        """Test duplicate appeal prevention."""
        # Mock existing appeal
        existing_appeal = UserAppeal(
            sanction_id=1,
            status=AppealStatus.PENDING
        )
        mock_db.query.return_value.filter.return_value.first.side_effect = [
            UserSanction(id=1, user_id=1),
            existing_appeal
        ]
        
        # Attempt duplicate
        with pytest.raises(ValidationError) as exc:
            moderation_service.create_appeal(
                user_id=1,
                sanction_id=1,
                reason="Another appeal"
            )
        
        assert "already pending" in str(exc.value)
    
    def test_review_appeal_approved(self, moderation_service, mock_db):
        """Test appeal approval."""
        # Mock appeal and sanction
        appeal = UserAppeal(
            id=1,
            user_id=1,
            sanction_id=1,
            status=AppealStatus.PENDING
        )
        mock_db.query.return_value.filter.return_value.first.return_value = appeal
        
        # Mock lift_sanction
        with patch.object(moderation_service, 'lift_sanction') as mock_lift:
            # Review appeal
            reviewed = moderation_service.review_appeal(
                reviewer_id=2,
                appeal_id=1,
                approved=True,
                decision="Valid appeal, lifting sanction"
            )
            
            # Verify appeal updated
            assert appeal.status == AppealStatus.APPROVED
            assert appeal.reviewed_by == 2
            assert appeal.reviewed_at is not None
            
            # Verify sanction lifted
            mock_lift.assert_called_once()


class TestContentFiltering:
    """Test automated content filtering."""
    
    def test_create_filter_success(self, moderation_service, mock_db):
        """Test filter creation."""
        # Create filter
        filter_rule = moderation_service.create_filter(
            creator_id=2,
            name="Profanity Filter",
            filter_type="regex",
            pattern=r"\b(bad|words)\b",
            action=ModerationAction.HIDE,
            severity=5
        )
        
        # Verify filter created
        assert mock_db.add.called
        assert mock_db.commit.called
        
        # Verify cached
        moderation_service.redis.setex.assert_called()
    
    def test_create_invalid_regex_filter_fails(self, moderation_service, mock_db):
        """Test invalid regex pattern fails."""
        with pytest.raises(ValidationError) as exc:
            moderation_service.create_filter(
                creator_id=2,
                name="Bad Regex",
                filter_type="regex",
                pattern="[invalid(regex",
                action=ModerationAction.HIDE
            )
        
        assert "Invalid regex" in str(exc.value)
    
    def test_check_content_with_filters(self, moderation_service, mock_db):
        """Test content checking against filters."""
        # Mock filters
        filters = [
            ContentFilter(
                filter_type="keyword",
                pattern="spam",
                action=ModerationAction.REJECT,
                severity=3
            ),
            ContentFilter(
                filter_type="regex",
                pattern=r"buy\s+now",
                action=ModerationAction.HIDE,
                severity=5
            )
        ]
        mock_db.query.return_value.filter.return_value.order_by.return_value.all.return_value = filters
        
        # Test content that matches keyword filter
        passed, matched_filter, action = moderation_service.check_content(
            ContentType.COMMENT,
            "This is spam content"
        )
        
        assert not passed
        assert matched_filter.pattern == "spam"
        assert action == ModerationAction.REJECT
    
    def test_auto_moderate_with_report(self, moderation_service, mock_db):
        """Test auto-moderation with report generation."""
        # Mock filter that auto-reports
        filter_rule = ContentFilter(
            id=1,
            name="Severe Filter",
            filter_type="keyword",
            pattern="violation",
            action=ModerationAction.DELETE,
            severity=8,
            auto_report=True
        )
        
        # Mock check_content to fail
        with patch.object(moderation_service, 'check_content') as mock_check:
            mock_check.return_value = (False, filter_rule, ModerationAction.DELETE)
            
            # Mock _add_to_queue
            with patch.object(moderation_service, '_add_to_queue') as mock_queue:
                # Auto moderate
                action_log = moderation_service.auto_moderate(
                    ContentType.COMMENT,
                    123,
                    "This is a violation"
                )
                
                # Verify report created
                assert mock_db.add.called
                report = mock_db.add.call_args_list[0][0][0]
                assert isinstance(report, ContentReport)
                assert report.reporter_id == 1  # System user
                
                # Verify added to queue
                mock_queue.assert_called_once()
                
                # Verify action applied
                assert action_log is not None


class TestModerationQueue:
    """Test moderation queue functionality."""
    
    def test_add_to_queue(self, moderation_service, mock_db):
        """Test adding content to moderation queue."""
        # Mock no existing queue item
        mock_db.query.return_value.filter.return_value.first.return_value = None
        
        # Add to queue
        moderation_service._add_to_queue(
            ContentType.RECIPE,
            100,
            priority=7,
            auto_flagged=True
        )
        
        # Verify queue item created
        assert mock_db.add.called
        queue_item = mock_db.add.call_args[0][0]
        assert queue_item.content_type == ContentType.RECIPE
        assert queue_item.content_id == 100
        assert queue_item.priority == 7
        assert queue_item.auto_flagged
    
    def test_remove_from_queue(self, moderation_service, mock_db):
        """Test removing content from queue."""
        # Remove from queue
        moderation_service._remove_from_queue(
            ContentType.RECIPE,
            100
        )
        
        # Verify deletion called
        mock_db.query.return_value.filter.return_value.delete.assert_called_once()
        assert mock_db.commit.called


class TestAnalytics:
    """Test moderation analytics."""
    
    def test_get_moderation_stats(self, moderation_service, mock_db):
        """Test statistics generation."""
        # Mock data
        start_date = datetime.utcnow() - timedelta(days=7)
        end_date = datetime.utcnow()
        
        # Mock action counts
        mock_db.query.return_value.filter.return_value.count.side_effect = [
            10, 5, 3, 2, 1, 0, 0  # Different action counts
        ]
        
        # Mock report counts
        mock_db.query.return_value.filter.return_value.count.side_effect = [
            50,  # Total reports
            40   # Resolved reports
        ]
        
        # Mock average resolution time
        mock_db.query.return_value.filter.return_value.scalar.return_value = 3600  # 1 hour
        
        # Mock sanction counts
        mock_db.query.return_value.filter.return_value.count.side_effect = [
            20, 5, 1, 2, 3  # Different sanction type counts
        ]
        
        # Get stats
        stats = moderation_service.get_moderation_stats(
            start_date=start_date,
            end_date=end_date,
            moderator_id=2
        )
        
        # Verify stats structure
        assert "period" in stats
        assert "reports" in stats
        assert "actions" in stats
        assert "sanctions" in stats
        
        # Verify calculations
        assert stats["reports"]["resolution_rate"] == 80.0
        assert stats["reports"]["avg_resolution_time_seconds"] == 3600