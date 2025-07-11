"""
Tests for ingredient moderation service.

This module tests the moderation workflow for user-submitted ingredients.
"""

import pytest
import pytest_asyncio
from uuid import uuid4
from datetime import datetime
from unittest.mock import AsyncMock, patch

from sqlalchemy.ext.asyncio import AsyncSession

from jidelnicek.admin.services.ingredient_moderation import IngredientModerationService
from jidelnicek.admin.services.ingredient_management import IngredientManagementService
from jidelnicek.admin.models import IngredientModeration, IngredientModerationStatus
from jidelnicek.common.models.ingredient import Ingredient
from jidelnicek.auth.models import AuthUser
from jidelnicek.core.exceptions import ValidationError, NotFoundError


@pytest.fixture
def admin_test_user():
    """Create a mock admin user."""
    return AuthUser(
        id=uuid4(),
        email="admin@example.com",
        role="admin",
        is_active=True
    )


@pytest.fixture
def regular_user():
    """Create a mock regular user."""
    return AuthUser(
        id=uuid4(),
        email="user@example.com",
        role="user",
        is_active=True
    )


@pytest.fixture
def moderation_service(db_session: AsyncSession, admin_test_user: AuthUser):
    """Create ingredient moderation service instance."""
    return IngredientModerationService(db_session, admin_test_user)


@pytest_asyncio.fixture(scope="function")
async def test_ingredient(
    db_session: AsyncSession,
    regular_user: AuthUser
) -> Ingredient:
    """Create a test ingredient for moderation."""
    ingredient = Ingredient(
        name="Test Ingredient",
        category="Test",
        nutritional_data={
            "calories": 100,
            "proteins": 10,
            "carbs": 20,
            "fats": 5
        },
        is_global=False,
        user_id=regular_user.id
    )
    db_session.add(ingredient)
    await db_session.commit()
    await db_session.refresh(ingredient)
    return ingredient


class TestIngredientSubmission:
    """Test ingredient submission for moderation."""
    
    async def test_submit_ingredient_for_moderation(
        self,
        moderation_service: IngredientModerationService,
        test_ingredient: Ingredient,
        regular_user: AuthUser
    ):
        """Test submitting an ingredient for moderation."""
        moderation = await moderation_service.submit_for_moderation(
            ingredient_id=test_ingredient.id,
            submitted_by=regular_user.id,
            priority=5,
            notes="Please approve this ingredient"
        )
        
        assert moderation.ingredient_id == test_ingredient.id
        assert moderation.submitted_by == regular_user.id
        assert moderation.status == IngredientModerationStatus.PENDING
        assert moderation.priority == 5
        assert moderation.review_notes == "Please approve this ingredient"
        assert moderation.quality_score is not None
    
    async def test_submit_nonexistent_ingredient(
        self,
        moderation_service: IngredientModerationService,
        regular_user: AuthUser
    ):
        """Test submitting non-existent ingredient."""
        fake_id = uuid4()
        
        with pytest.raises(NotFoundError):
            await moderation_service.submit_for_moderation(
                ingredient_id=fake_id,
                submitted_by=regular_user.id
            )
    
    async def test_duplicate_submission(
        self,
        moderation_service: IngredientModerationService,
        test_ingredient: Ingredient,
        regular_user: AuthUser
    ):
        """Test duplicate submission prevention."""
        # First submission
        await moderation_service.submit_for_moderation(
            ingredient_id=test_ingredient.id,
            submitted_by=regular_user.id
        )
        
        # Try duplicate submission
        with pytest.raises(ValidationError, match="already in moderation"):
            await moderation_service.submit_for_moderation(
                ingredient_id=test_ingredient.id,
                submitted_by=regular_user.id
            )
    
    async def test_automated_quality_checks(
        self,
        moderation_service: IngredientModerationService,
        db_session: AsyncSession,
        regular_user: AuthUser
    ):
        """Test automated quality checks during submission."""
        # Create ingredient with suspicious name
        suspicious = Ingredient(
            name="XXX Test Delete",
            nutritional_data={
                "calories": 100,
                "proteins": 10,
                "carbs": 20,
                "fats": 5
            },
            is_global=False,
            user_id=regular_user.id
        )
        db_session.add(suspicious)
        await db_session.commit()
        
        moderation = await moderation_service.submit_for_moderation(
            ingredient_id=suspicious.id,
            submitted_by=regular_user.id
        )
        
        assert moderation.auto_check_passed is False
        assert "Suspicious ingredient name" in moderation.auto_check_issues


class TestIngredientReview:
    """Test ingredient review functionality."""
    
    async def test_approve_ingredient(
        self,
        moderation_service: IngredientModerationService,
        test_ingredient: Ingredient,
        regular_user: AuthUser,
        admin_test_user: AuthUser
    ):
        """Test approving an ingredient."""
        # Submit for moderation
        moderation = await moderation_service.submit_for_moderation(
            ingredient_id=test_ingredient.id,
            submitted_by=regular_user.id
        )
        
        # Approve
        reviewed = await moderation_service.review_ingredient(
            ingredient_id=test_ingredient.id,
            status=IngredientModerationStatus.APPROVED,
            review_notes="Looks good",
            make_global=True
        )
        
        assert reviewed.status == IngredientModerationStatus.APPROVED
        assert reviewed.reviewed_by == admin_test_user.id
        assert reviewed.reviewed_at is not None
        assert reviewed.review_notes == "Looks good"
    
    async def test_reject_ingredient(
        self,
        moderation_service: IngredientModerationService,
        test_ingredient: Ingredient,
        regular_user: AuthUser
    ):
        """Test rejecting an ingredient."""
        # Submit for moderation
        await moderation_service.submit_for_moderation(
            ingredient_id=test_ingredient.id,
            submitted_by=regular_user.id
        )
        
        # Reject
        reviewed = await moderation_service.review_ingredient(
            ingredient_id=test_ingredient.id,
            status=IngredientModerationStatus.REJECTED,
            review_notes="Quality issues",
            rejection_reason="Incomplete nutritional data"
        )
        
        assert reviewed.status == IngredientModerationStatus.REJECTED
        assert reviewed.rejection_reason == "Incomplete nutritional data"
    
    async def test_review_with_suggested_changes(
        self,
        moderation_service: IngredientModerationService,
        test_ingredient: Ingredient,
        regular_user: AuthUser
    ):
        """Test review with suggested changes."""
        # Submit for moderation
        await moderation_service.submit_for_moderation(
            ingredient_id=test_ingredient.id,
            submitted_by=regular_user.id
        )
        
        # Approve with changes
        suggested_changes = {
            "category": "Grains",
            "allergens": ["gluten"]
        }
        
        reviewed = await moderation_service.review_ingredient(
            ingredient_id=test_ingredient.id,
            status=IngredientModerationStatus.APPROVED,
            suggested_changes=suggested_changes,
            make_global=True
        )
        
        assert reviewed.status == IngredientModerationStatus.APPROVED
        assert reviewed.suggested_changes == suggested_changes
    
    async def test_review_already_reviewed(
        self,
        moderation_service: IngredientModerationService,
        test_ingredient: Ingredient,
        regular_user: AuthUser
    ):
        """Test reviewing already reviewed ingredient."""
        # Submit and approve
        await moderation_service.submit_for_moderation(
            ingredient_id=test_ingredient.id,
            submitted_by=regular_user.id
        )
        
        await moderation_service.review_ingredient(
            ingredient_id=test_ingredient.id,
            status=IngredientModerationStatus.APPROVED
        )
        
        # Try to review again
        with pytest.raises(ValidationError, match="already reviewed"):
            await moderation_service.review_ingredient(
                ingredient_id=test_ingredient.id,
                status=IngredientModerationStatus.REJECTED
            )


class TestModerationQueue:
    """Test moderation queue functionality."""
    
    async def test_get_pending_queue(
        self,
        moderation_service: IngredientModerationService,
        db_session: AsyncSession,
        regular_user: AuthUser
    ):
        """Test getting pending moderation queue."""
        # Create and submit multiple ingredients
        for i in range(5):
            ingredient = Ingredient(
                name=f"Queue Test {i}",
                nutritional_data={
                    "calories": 100,
                    "proteins": 10,
                    "carbs": 20,
                    "fats": 5
                },
                is_global=False,
                user_id=regular_user.id
            )
            db_session.add(ingredient)
            await db_session.commit()
            
            await moderation_service.submit_for_moderation(
                ingredient_id=ingredient.id,
                submitted_by=regular_user.id,
                priority=i
            )
        
        # Get queue
        queue, total = await moderation_service.get_moderation_queue(
            status=IngredientModerationStatus.PENDING
        )
        
        assert total == 5
        assert len(queue) == 5
        # Should be sorted by priority (descending)
        assert all(
            queue[i].priority >= queue[i+1].priority 
            for i in range(len(queue)-1)
        )
    
    async def test_filter_by_priority(
        self,
        moderation_service: IngredientModerationService,
        test_ingredient: Ingredient,
        regular_user: AuthUser
    ):
        """Test filtering queue by priority."""
        # Submit with low priority
        await moderation_service.submit_for_moderation(
            ingredient_id=test_ingredient.id,
            submitted_by=regular_user.id,
            priority=3
        )
        
        # Filter for high priority only
        queue, total = await moderation_service.get_moderation_queue(
            priority_min=5
        )
        
        assert total == 0
        
        # Filter for low priority
        queue, total = await moderation_service.get_moderation_queue(
            priority_min=1
        )
        
        assert total == 1


class TestBulkOperations:
    """Test bulk moderation operations."""
    
    async def test_bulk_approve(
        self,
        moderation_service: IngredientModerationService,
        db_session: AsyncSession,
        regular_user: AuthUser
    ):
        """Test bulk approval of ingredients."""
        # Create and submit multiple ingredients
        ingredient_ids = []
        for i in range(3):
            ingredient = Ingredient(
                name=f"Bulk Test {i}",
                nutritional_data={
                    "calories": 100,
                    "proteins": 10,
                    "carbs": 20,
                    "fats": 5
                },
                is_global=False,
                user_id=regular_user.id
            )
            db_session.add(ingredient)
            await db_session.commit()
            
            await moderation_service.submit_for_moderation(
                ingredient_id=ingredient.id,
                submitted_by=regular_user.id
            )
            
            ingredient_ids.append(ingredient.id)
        
        # Bulk approve
        results = await moderation_service.bulk_approve(
            ingredient_ids=ingredient_ids,
            make_global=True
        )
        
        assert results['total'] == 3
        assert results['success'] == 3
        assert results['failed'] == 0


class TestAutomatedChecks:
    """Test automated moderation checks."""
    
    async def test_nutritional_data_validation(
        self,
        moderation_service: IngredientModerationService,
        db_session: AsyncSession
    ):
        """Test automated nutritional data validation."""
        # Create ingredient with mismatched calories
        ingredient = Ingredient(
            name="Bad Nutrition",
            nutritional_data={
                "calories": 500,  # Way too high for the macros
                "proteins": 10,   # 40 cal
                "carbs": 20,      # 80 cal
                "fats": 5         # 45 cal
            },  # Total should be ~165 cal
            is_global=False
        )
        db_session.add(ingredient)
        await db_session.commit()
        
        passed, issues = await moderation_service.auto_moderate_ingredient(
            ingredient.id
        )
        
        assert passed is False
        assert "Calorie count doesn't match macronutrients" in issues
    
    async def test_duplicate_detection(
        self,
        moderation_service: IngredientModerationService,
        db_session: AsyncSession,
        regular_user: AuthUser
    ):
        """Test duplicate ingredient detection."""
        # Create global ingredient
        global_ingredient = Ingredient(
            name="Duplicate Product",
            brand="Test Brand",
            nutritional_data={
                "calories": 100,
                "proteins": 10,
                "carbs": 20,
                "fats": 5
            },
            is_global=True
        )
        db_session.add(global_ingredient)
        
        # Create user ingredient with same name/brand
        user_ingredient = Ingredient(
            name="Duplicate Product",
            brand="Test Brand",
            nutritional_data={
                "calories": 100,
                "proteins": 10,
                "carbs": 20,
                "fats": 5
            },
            is_global=False,
            user_id=regular_user.id
        )
        db_session.add(user_ingredient)
        await db_session.commit()
        
        passed, issues = await moderation_service.auto_moderate_ingredient(
            user_ingredient.id
        )
        
        assert passed is False
        assert "Potential duplicate of existing global ingredient" in issues


class TestModerationStatistics:
    """Test moderation statistics."""
    
    async def test_get_moderation_stats(
        self,
        moderation_service: IngredientModerationService,
        db_session: AsyncSession,
        regular_user: AuthUser
    ):
        """Test getting moderation statistics."""
        # Create ingredients with different statuses
        for i in range(3):
            ingredient = Ingredient(
                name=f"Stats Test {i}",
                nutritional_data={
                    "calories": 100,
                    "proteins": 10,
                    "carbs": 20,
                    "fats": 5
                },
                is_global=False,
                user_id=regular_user.id
            )
            db_session.add(ingredient)
            await db_session.commit()
            
            await moderation_service.submit_for_moderation(
                ingredient_id=ingredient.id,
                submitted_by=regular_user.id,
                priority=7 if i == 0 else 3  # One high priority
            )
            
            # Approve one, leave others pending
            if i == 0:
                await moderation_service.review_ingredient(
                    ingredient_id=ingredient.id,
                    status=IngredientModerationStatus.APPROVED
                )
        
        stats = await moderation_service.get_moderation_stats()
        
        assert stats['by_status']['pending'] == 2
        assert stats['by_status']['approved'] == 1
        assert stats['total_pending'] == 2
        assert stats['high_priority_count'] == 0  # Approved one was high priority