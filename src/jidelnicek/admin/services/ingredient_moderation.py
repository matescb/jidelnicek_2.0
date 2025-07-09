"""
Ingredient moderation service for managing user-submitted ingredients.

This service handles the approval workflow for ingredients submitted by users
that need admin review before becoming globally available.
"""

from datetime import datetime, timezone
from typing import Optional, List, Dict, Any, Tuple
from uuid import UUID

from sqlalchemy import select, func, and_, or_, desc, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from jidelnicek.common.models.ingredient import Ingredient
from jidelnicek.admin.models import (
    AdminAuditLog, AdminAction, IngredientModeration,
    IngredientModerationStatus, AdminNotification
)
from jidelnicek.auth.models import AuthUser
from jidelnicek.core.utils import get_utc_now
from jidelnicek.core.exceptions import NotFoundError, ValidationError
from jidelnicek.admin.services.ingredient_management import IngredientManagementService


class IngredientModerationService:
    """Service for managing ingredient moderation workflow."""
    
    def __init__(self, db: AsyncSession, admin_user: Optional[AuthUser] = None):
        """
        Initialize moderation service.
        
        Args:
            db: Database session
            admin_user: Admin user performing operations (optional for automated checks)
        """
        self.db = db
        self.admin_user = admin_user
        self.ingredient_service = IngredientManagementService(db, admin_user) if admin_user else None
    
    async def submit_for_moderation(
        self,
        ingredient_id: UUID,
        submitted_by: UUID,
        priority: int = 0,
        notes: Optional[str] = None
    ) -> IngredientModeration:
        """
        Submit an ingredient for moderation.
        
        Args:
            ingredient_id: ID of ingredient to moderate
            submitted_by: User ID submitting for moderation
            priority: Priority level (0-10, higher = more urgent)
            notes: Optional submission notes
            
        Returns:
            Created moderation entry
        """
        # Check if ingredient exists
        ingredient = await self._get_ingredient(ingredient_id)
        if not ingredient:
            raise NotFoundError(f"Ingredient {ingredient_id} not found")
        
        # Check if already in moderation
        existing = await self._get_moderation_by_ingredient(ingredient_id)
        if existing and existing.status == IngredientModerationStatus.PENDING:
            raise ValidationError("Ingredient is already in moderation queue")
        
        # Run automated quality checks
        auto_check_passed, auto_issues = await self._run_automated_checks(ingredient)
        
        # Calculate quality score
        quality_report = await self.ingredient_service.validate_ingredient_quality(ingredient_id)
        
        # Create moderation entry
        moderation = IngredientModeration(
            ingredient_id=ingredient_id,
            submitted_by=submitted_by,
            submitted_at=get_utc_now(),
            status=IngredientModerationStatus.PENDING,
            priority=priority,
            review_notes=notes,
            quality_score=quality_report['quality_score'],
            quality_issues=quality_report['issues'],
            auto_check_passed=auto_check_passed,
            auto_check_issues=auto_issues
        )
        
        self.db.add(moderation)
        await self.db.commit()
        await self.db.refresh(moderation)
        
        # Create notification for admins
        await self._create_admin_notification(
            type="ingredient_submission",
            title=f"New ingredient submitted: {ingredient.name}",
            message=f"User submitted '{ingredient.name}' for global availability",
            related_id=ingredient_id
        )
        
        return moderation
    
    async def review_ingredient(
        self,
        ingredient_id: UUID,
        status: IngredientModerationStatus,
        review_notes: Optional[str] = None,
        rejection_reason: Optional[str] = None,
        suggested_changes: Optional[Dict[str, Any]] = None,
        make_global: bool = True
    ) -> IngredientModeration:
        """
        Review a moderated ingredient.
        
        Args:
            ingredient_id: Ingredient ID to review
            status: New moderation status
            review_notes: Review notes
            rejection_reason: Reason if rejected
            suggested_changes: Suggested changes for improvement
            make_global: Make ingredient global if approved
            
        Returns:
            Updated moderation entry
        """
        if not self.admin_user:
            raise ValidationError("Admin user required for review")
        
        # Get moderation entry
        moderation = await self._get_moderation_by_ingredient(ingredient_id)
        if not moderation:
            raise NotFoundError(f"No moderation entry for ingredient {ingredient_id}")
        
        if moderation.status != IngredientModerationStatus.PENDING:
            raise ValidationError(f"Ingredient already reviewed with status: {moderation.status}")
        
        # Update moderation entry
        moderation.status = status
        moderation.reviewed_by = self.admin_user.id
        moderation.reviewed_at = get_utc_now()
        moderation.review_notes = review_notes
        moderation.rejection_reason = rejection_reason
        moderation.suggested_changes = suggested_changes
        
        # Handle approval
        if status == IngredientModerationStatus.APPROVED:
            if make_global:
                # Make ingredient global
                await self.ingredient_service.update_ingredient(
                    ingredient_id,
                    is_global=True,
                    user_id=None
                )
            
            # Apply suggested changes if any
            if suggested_changes:
                await self.ingredient_service.update_ingredient(
                    ingredient_id,
                    **suggested_changes
                )
        
        await self.db.commit()
        await self.db.refresh(moderation)
        
        # Log action
        await self._log_audit_action(
            AdminAction.INGREDIENT_APPROVE if status == IngredientModerationStatus.APPROVED 
            else AdminAction.INGREDIENT_REJECT,
            ingredient_id,
            metadata={
                'review_notes': review_notes,
                'make_global': make_global
            }
        )
        
        # Notify submitter
        ingredient = await self._get_ingredient(ingredient_id)
        await self._create_user_notification(
            user_id=moderation.submitted_by,
            type=f"ingredient_{status.value}",
            title=f"Ingredient {status.value}: {ingredient.name}",
            message=rejection_reason if status == IngredientModerationStatus.REJECTED 
                   else f"Your ingredient '{ingredient.name}' has been approved",
            related_id=ingredient_id
        )
        
        return moderation
    
    async def get_moderation_queue(
        self,
        status: Optional[IngredientModerationStatus] = None,
        priority_min: Optional[int] = None,
        page: int = 1,
        per_page: int = 50,
        sort_by: str = 'priority'
    ) -> Tuple[List[IngredientModeration], int]:
        """
        Get moderation queue with filtering and pagination.
        
        Args:
            status: Filter by status
            priority_min: Minimum priority
            page: Page number
            per_page: Items per page
            sort_by: Sort field (priority, submitted_at, quality_score)
            
        Returns:
            Tuple of (moderation_entries, total_count)
        """
        # Build query
        stmt = select(IngredientModeration).options(
            selectinload(IngredientModeration.ingredient),
            selectinload(IngredientModeration.submitter),
            selectinload(IngredientModeration.reviewer)
        )
        
        # Apply filters
        conditions = []
        if status:
            conditions.append(IngredientModeration.status == status)
        else:
            # Default to pending
            conditions.append(IngredientModeration.status == IngredientModerationStatus.PENDING)
        
        if priority_min is not None:
            conditions.append(IngredientModeration.priority >= priority_min)
        
        if conditions:
            stmt = stmt.where(and_(*conditions))
        
        # Get total count
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total_result = await self.db.execute(count_stmt)
        total_count = total_result.scalar() or 0
        
        # Apply sorting
        if sort_by == 'submitted_at':
            stmt = stmt.order_by(desc(IngredientModeration.submitted_at))
        elif sort_by == 'quality_score':
            stmt = stmt.order_by(desc(IngredientModeration.quality_score))
        else:  # priority
            stmt = stmt.order_by(
                desc(IngredientModeration.priority),
                IngredientModeration.submitted_at
            )
        
        # Apply pagination
        offset = (page - 1) * per_page
        stmt = stmt.offset(offset).limit(per_page)
        
        # Execute query
        result = await self.db.execute(stmt)
        entries = list(result.scalars().all())
        
        return entries, total_count
    
    async def bulk_approve(
        self,
        ingredient_ids: List[UUID],
        make_global: bool = True
    ) -> Dict[str, Any]:
        """
        Bulk approve multiple ingredients.
        
        Args:
            ingredient_ids: List of ingredient IDs to approve
            make_global: Make ingredients global
            
        Returns:
            Results summary
        """
        results = {
            'total': len(ingredient_ids),
            'success': 0,
            'failed': 0,
            'errors': []
        }
        
        for ingredient_id in ingredient_ids:
            try:
                await self.review_ingredient(
                    ingredient_id,
                    IngredientModerationStatus.APPROVED,
                    review_notes="Bulk approved",
                    make_global=make_global
                )
                results['success'] += 1
            except Exception as e:
                results['failed'] += 1
                results['errors'].append({
                    'ingredient_id': str(ingredient_id),
                    'error': str(e)
                })
        
        return results
    
    async def auto_moderate_ingredient(
        self,
        ingredient_id: UUID
    ) -> Tuple[bool, List[str]]:
        """
        Run automated moderation checks on an ingredient.
        
        Args:
            ingredient_id: Ingredient to check
            
        Returns:
            Tuple of (passed, issues)
        """
        ingredient = await self._get_ingredient(ingredient_id)
        if not ingredient:
            raise NotFoundError(f"Ingredient {ingredient_id} not found")
        
        return await self._run_automated_checks(ingredient)
    
    async def get_moderation_stats(self) -> Dict[str, Any]:
        """Get moderation queue statistics."""
        # Count by status
        status_counts = {}
        for status in IngredientModerationStatus:
            count_result = await self.db.execute(
                select(func.count())
                .where(IngredientModeration.status == status)
            )
            status_counts[status.value] = count_result.scalar() or 0
        
        # Average quality score
        avg_quality_result = await self.db.execute(
            select(func.avg(IngredientModeration.quality_score))
            .where(IngredientModeration.status == IngredientModerationStatus.PENDING)
        )
        avg_quality = avg_quality_result.scalar() or 0
        
        # High priority count
        high_priority_result = await self.db.execute(
            select(func.count())
            .where(
                and_(
                    IngredientModeration.status == IngredientModerationStatus.PENDING,
                    IngredientModeration.priority >= 7
                )
            )
        )
        high_priority = high_priority_result.scalar() or 0
        
        return {
            'by_status': status_counts,
            'average_quality_score': float(avg_quality),
            'high_priority_count': high_priority,
            'total_pending': status_counts.get('pending', 0)
        }
    
    # Private helper methods
    
    async def _get_ingredient(self, ingredient_id: UUID) -> Optional[Ingredient]:
        """Get ingredient by ID."""
        result = await self.db.execute(
            select(Ingredient).where(Ingredient.id == ingredient_id)
        )
        return result.scalar_one_or_none()
    
    async def _get_moderation_by_ingredient(
        self,
        ingredient_id: UUID
    ) -> Optional[IngredientModeration]:
        """Get moderation entry by ingredient ID."""
        result = await self.db.execute(
            select(IngredientModeration)
            .where(IngredientModeration.ingredient_id == ingredient_id)
            .options(
                selectinload(IngredientModeration.ingredient),
                selectinload(IngredientModeration.submitter)
            )
        )
        return result.scalar_one_or_none()
    
    async def _run_automated_checks(
        self,
        ingredient: Ingredient
    ) -> Tuple[bool, List[str]]:
        """
        Run automated quality and safety checks.
        
        Returns:
            Tuple of (passed, issues)
        """
        issues = []
        
        # Check for suspicious names
        suspicious_terms = ['test', 'delete', 'xxx', 'spam']
        name_lower = ingredient.name.lower()
        if any(term in name_lower for term in suspicious_terms):
            issues.append("Suspicious ingredient name")
        
        # Check nutritional data validity
        if ingredient.nutritional_data:
            nutrition = ingredient.nutritional_data
            
            # Check if calories match macros (approximately)
            if 'calories' in nutrition and all(k in nutrition for k in ['proteins', 'carbs', 'fats']):
                calculated_calories = (
                    nutrition['proteins'] * 4 +
                    nutrition['carbs'] * 4 +
                    nutrition['fats'] * 9
                )
                if abs(nutrition['calories'] - calculated_calories) > 20:
                    issues.append("Calorie count doesn't match macronutrients")
            
            # Check for unrealistic values
            if any(nutrition.get(k, 0) > 100 for k in ['proteins', 'carbs', 'fats']):
                issues.append("Macronutrient values exceed 100g per 100g")
        
        # Check for duplicate ingredients
        duplicate_check = await self.db.execute(
            select(func.count())
            .select_from(Ingredient)
            .where(
                and_(
                    Ingredient.id != ingredient.id,
                    Ingredient.name == ingredient.name,
                    Ingredient.brand == ingredient.brand,
                    Ingredient.is_global == True
                )
            )
        )
        if duplicate_check.scalar() > 0:
            issues.append("Potential duplicate of existing global ingredient")
        
        # Check allergen information
        if not ingredient.allergens:
            issues.append("No allergen information provided")
        
        # Overall pass/fail
        passed = len(issues) == 0
        
        return passed, issues
    
    async def _create_admin_notification(
        self,
        type: str,
        title: str,
        message: str,
        related_id: Optional[UUID] = None,
        severity: str = "info"
    ) -> None:
        """Create notification for admins."""
        notification = AdminNotification(
            type=type,
            severity=severity,
            title=title,
            message=message,
            related_type="ingredient",
            related_id=related_id,
            created_at=get_utc_now()
        )
        self.db.add(notification)
    
    async def _create_user_notification(
        self,
        user_id: UUID,
        type: str,
        title: str,
        message: str,
        related_id: Optional[UUID] = None
    ) -> None:
        """Create notification for user (would integrate with notification system)."""
        # This would integrate with a user notification system
        # For now, just log it
        pass
    
    async def _log_audit_action(
        self,
        action: AdminAction,
        target_id: UUID,
        metadata: Optional[Dict[str, Any]] = None
    ) -> None:
        """Log admin action to audit log."""
        if not self.admin_user:
            return
        
        audit_entry = AdminAuditLog(
            admin_id=self.admin_user.id,
            action=action,
            target_type="ingredient",
            target_id=target_id,
            metadata=metadata,
            success=True,
            created_at=get_utc_now()
        )
        self.db.add(audit_entry)