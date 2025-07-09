"""
User management service for administrative operations.

This service provides comprehensive user management functionality with
security features, audit logging, and notification support.
"""

from datetime import datetime, timedelta, timezone
from typing import Optional, List, Dict, Any, Tuple
from uuid import UUID
import secrets
import string
from collections import defaultdict

from sqlalchemy import select, func, and_, or_, desc, asc, delete, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from jidelnicek.auth.models import (
    AuthUser, AuthSession, AuthToken, 
    AuthPasswordResetToken, AuthEmailVerificationToken
)
from jidelnicek.auth.services.email_service import EmailService
from jidelnicek.auth.utils.password import hash_password
from jidelnicek.admin.models import AdminAuditLog, AdminAction, AdminNotification
from jidelnicek.admin.schemas import (
    UserFilter, UserSort, SortField, SortOrder,
    UserStatus, UserRole, BulkOperationResult
)
from jidelnicek.core.utils import get_utc_now


class UserManagementService:
    """Service for managing users with administrative privileges."""
    
    def __init__(self, db: AsyncSession, admin_user: AuthUser):
        """
        Initialize user management service.
        
        Args:
            db: Database session
            admin_user: The admin user performing operations
        """
        self.db = db
        self.admin_user = admin_user
        self.email_service = EmailService()
    
    async def list_users(
        self,
        page: int = 1,
        per_page: int = 20,
        filters: Optional[UserFilter] = None,
        sort: Optional[UserSort] = None,
        request_context: Optional[Dict[str, Any]] = None
    ) -> Tuple[List[AuthUser], int, Dict[str, int]]:
        """
        List users with pagination, filtering, and sorting.
        
        Args:
            page: Page number (1-based)
            per_page: Items per page
            filters: Filter criteria
            sort: Sort criteria
            request_context: Request context for audit logging
            
        Returns:
            Tuple of (users, total_count, statistics)
        """
        # Build base query
        query = select(AuthUser)
        count_query = select(func.count(AuthUser.id))
        
        # Apply filters
        if filters:
            conditions = []
            
            if filters.email:
                conditions.append(
                    func.lower(AuthUser.email).contains(filters.email.lower())
                )
            
            if filters.role:
                conditions.append(AuthUser.role == filters.role.value)
            
            if filters.email_verified is not None:
                conditions.append(AuthUser.email_verified == filters.email_verified)
            
            if filters.status:
                if filters.status == UserStatus.ARCHIVED:
                    conditions.append(AuthUser.is_archived == True)
                elif filters.status == UserStatus.SUSPENDED:
                    conditions.append(
                        and_(
                            AuthUser.is_archived == False,
                            AuthUser.is_active == False
                        )
                    )
                elif filters.status == UserStatus.INACTIVE:
                    conditions.append(
                        and_(
                            AuthUser.is_archived == False,
                            AuthUser.is_active == True,
                            AuthUser.last_login.is_(None)
                        )
                    )
                elif filters.status == UserStatus.ACTIVE:
                    conditions.append(
                        and_(
                            AuthUser.is_archived == False,
                            AuthUser.is_active == True,
                            AuthUser.last_login.isnot(None)
                        )
                    )
            
            if filters.created_after:
                conditions.append(AuthUser.created_at >= filters.created_after)
            
            if filters.created_before:
                conditions.append(AuthUser.created_at <= filters.created_before)
            
            if filters.has_logged_in is not None:
                if filters.has_logged_in:
                    conditions.append(AuthUser.last_login.isnot(None))
                else:
                    conditions.append(AuthUser.last_login.is_(None))
            
            if conditions:
                where_clause = and_(*conditions)
                query = query.where(where_clause)
                count_query = count_query.where(where_clause)
        
        # Get total count
        total_result = await self.db.execute(count_query)
        total_count = total_result.scalar_one()
        
        # Apply sorting
        if sort:
            sort_column = getattr(AuthUser, sort.field.value)
            if sort.order == SortOrder.DESC:
                query = query.order_by(desc(sort_column))
            else:
                query = query.order_by(asc(sort_column))
        else:
            query = query.order_by(desc(AuthUser.created_at))
        
        # Apply pagination
        offset = (page - 1) * per_page
        query = query.offset(offset).limit(per_page)
        
        # Execute query
        result = await self.db.execute(query)
        users = result.scalars().all()
        
        # Calculate statistics
        stats = await self._calculate_user_statistics()
        
        # Log the action
        await self._log_admin_action(
            action=AdminAction.USER_LIST,
            target_type="user",
            metadata={
                "page": page,
                "per_page": per_page,
                "filters": filters.model_dump() if filters else None,
                "sort": sort.model_dump() if sort else None,
                "result_count": len(users)
            },
            request_context=request_context
        )
        
        return users, total_count, stats
    
    async def get_user_detail(
        self,
        user_id: UUID,
        include_sessions: bool = True,
        include_activity: bool = True,
        request_context: Optional[Dict[str, Any]] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Get detailed user information.
        
        Args:
            user_id: User ID
            include_sessions: Include session information
            include_activity: Include recent activity
            request_context: Request context for audit logging
            
        Returns:
            User details dictionary or None
        """
        # Fetch user with relationships
        query = select(AuthUser).where(AuthUser.id == user_id)
        if include_sessions:
            query = query.options(selectinload(AuthUser.sessions))
        
        result = await self.db.execute(query)
        user = result.scalar_one_or_none()
        
        if not user:
            return None
        
        # Build response
        user_data = {
            "id": user.id,
            "email": user.email,
            "role": user.role,
            "email_verified": user.email_verified,
            "email_verified_at": user.email_verified_at,
            "is_active": user.is_active,
            "is_archived": user.is_archived,
            "created_at": user.created_at,
            "updated_at": user.updated_at,
            "last_login": user.last_login,
            "language": user.language,
            "unit_system": user.unit_system,
            "energy_unit": user.energy_unit,
            "has_pku": user.has_pku,
            "timezone": user.timezone,
            "failed_login_attempts": user.failed_login_attempts,
            "locked_until": user.locked_until,
            "recipe_count": user.recipe_count,
            "trip_count": user.trip_count
        }
        
        # Add session information
        if include_sessions and hasattr(user, 'sessions'):
            active_sessions = [s for s in user.sessions if s.is_valid and not s.is_expired]
            user_data["session_count"] = len(user.sessions)
            user_data["active_session_count"] = len(active_sessions)
            user_data["recent_sessions"] = [
                {
                    "id": s.id,
                    "created_at": s.created_at,
                    "expires_at": s.expires_at,
                    "last_accessed": s.last_accessed,
                    "ip_address": s.ip_address,
                    "device_name": s.device_name,
                    "location": s.location,
                    "is_valid": s.is_valid
                }
                for s in sorted(user.sessions, key=lambda x: x.created_at, reverse=True)[:5]
            ]
        
        # Log the action (but don't log viewing own profile)
        if user_id != self.admin_user.id:
            await self._log_admin_action(
                action=AdminAction.USER_VIEW,
                target_type="user",
                target_id=user_id,
                request_context=request_context
            )
        
        return user_data
    
    async def create_user(
        self,
        email: str,
        password: str,
        role: UserRole = UserRole.USER,
        email_verified: bool = False,
        send_welcome_email: bool = True,
        preferences: Optional[Dict[str, Any]] = None,
        request_context: Optional[Dict[str, Any]] = None
    ) -> AuthUser:
        """
        Create a new user.
        
        Args:
            email: User email
            password: User password
            role: User role
            email_verified: Whether email is pre-verified
            send_welcome_email: Send welcome email
            preferences: User preferences
            request_context: Request context for audit logging
            
        Returns:
            Created user
        """
        # Check if email already exists
        existing = await self.db.execute(
            select(AuthUser).where(AuthUser.email == email.lower())
        )
        if existing.scalar_one_or_none():
            raise ValueError(f"User with email {email} already exists")
        
        # Create user
        user = AuthUser(
            email=email.lower(),
            password_hash=hash_password(password),
            role=role.value,
            email_verified=email_verified,
            email_verified_at=get_utc_now() if email_verified else None
        )
        
        # Apply preferences
        if preferences:
            for key, value in preferences.items():
                if hasattr(user, key):
                    setattr(user, key, value)
        
        self.db.add(user)
        await self.db.flush()
        
        # Send welcome email
        if send_welcome_email:
            await self.email_service.send_admin_created_account(
                user_id=user.id,
                temporary_password=password
            )
        
        # Log the action
        await self._log_admin_action(
            action=AdminAction.USER_CREATE,
            target_type="user",
            target_id=user.id,
            after_state={
                "email": user.email,
                "role": user.role,
                "email_verified": user.email_verified
            },
            request_context=request_context
        )
        
        # Create admin notification
        await self._create_notification(
            type="user_created",
            severity="info",
            title="New User Created",
            message=f"User {email} was created by {self.admin_user.email}",
            related_type="user",
            related_id=user.id
        )
        
        await self.db.commit()
        return user
    
    async def update_user(
        self,
        user_id: UUID,
        updates: Dict[str, Any],
        reason: Optional[str] = None,
        request_context: Optional[Dict[str, Any]] = None
    ) -> Optional[AuthUser]:
        """
        Update user information.
        
        Args:
            user_id: User ID
            updates: Dictionary of updates
            reason: Reason for update
            request_context: Request context for audit logging
            
        Returns:
            Updated user or None
        """
        # Fetch user
        result = await self.db.execute(
            select(AuthUser).where(AuthUser.id == user_id)
        )
        user = result.scalar_one_or_none()
        
        if not user:
            return None
        
        # Capture before state
        before_state = {
            "email": user.email,
            "role": user.role,
            "is_active": user.is_active,
            "email_verified": user.email_verified
        }
        
        # Apply updates
        changes = {}
        for key, value in updates.items():
            if hasattr(user, key) and value is not None:
                old_value = getattr(user, key)
                if old_value != value:
                    setattr(user, key, value)
                    changes[key] = {"from": old_value, "to": value}
        
        # Update timestamp
        user.updated_at = get_utc_now()
        
        # Handle special cases
        if "is_active" in changes and not user.is_active:
            # User suspended - invalidate all sessions
            await self._invalidate_user_sessions(user_id)
        
        if "email_verified" in changes and user.email_verified:
            user.email_verified_at = get_utc_now()
        
        # Log the action
        await self._log_admin_action(
            action=AdminAction.USER_UPDATE,
            target_type="user",
            target_id=user_id,
            before_state=before_state,
            after_state={
                "email": user.email,
                "role": user.role,
                "is_active": user.is_active,
                "email_verified": user.email_verified
            },
            changes=changes,
            reason=reason,
            request_context=request_context
        )
        
        # Send notification for significant changes
        if "is_active" in changes or "role" in changes:
            await self.email_service.send_account_status_changed(
                user_id=user_id,
                change_type="suspended" if not user.is_active else "activated",
                admin_email=self.admin_user.email,
                reason=reason
            )
        
        await self.db.commit()
        return user
    
    async def suspend_user(
        self,
        user_id: UUID,
        reason: str,
        notify_user: bool = True,
        request_context: Optional[Dict[str, Any]] = None
    ) -> bool:
        """
        Suspend a user account.
        
        Args:
            user_id: User ID
            reason: Reason for suspension
            notify_user: Send notification to user
            request_context: Request context for audit logging
            
        Returns:
            Success status
        """
        user = await self.update_user(
            user_id=user_id,
            updates={"is_active": False},
            reason=reason,
            request_context=request_context
        )
        
        if user and notify_user:
            await self.email_service.send_account_suspended(
                user_id=user_id,
                reason=reason,
                admin_email=self.admin_user.email
            )
        
        return user is not None
    
    async def activate_user(
        self,
        user_id: UUID,
        reason: str,
        notify_user: bool = True,
        request_context: Optional[Dict[str, Any]] = None
    ) -> bool:
        """
        Activate a suspended user account.
        
        Args:
            user_id: User ID
            reason: Reason for activation
            notify_user: Send notification to user
            request_context: Request context for audit logging
            
        Returns:
            Success status
        """
        user = await self.update_user(
            user_id=user_id,
            updates={"is_active": True},
            reason=reason,
            request_context=request_context
        )
        
        if user and notify_user:
            await self.email_service.send_account_activated(
                user_id=user_id,
                reason=reason,
                admin_email=self.admin_user.email
            )
        
        return user is not None
    
    async def reset_user_password(
        self,
        user_id: UUID,
        new_password: Optional[str] = None,
        generate_random: bool = False,
        send_email: bool = True,
        require_change: bool = True,
        reason: str = "Administrative password reset",
        request_context: Optional[Dict[str, Any]] = None
    ) -> Tuple[bool, Optional[str]]:
        """
        Reset a user's password.
        
        Args:
            user_id: User ID
            new_password: New password (if provided)
            generate_random: Generate random password
            send_email: Send new password via email
            require_change: Require password change on next login
            reason: Reason for reset
            request_context: Request context for audit logging
            
        Returns:
            Tuple of (success, generated_password)
        """
        # Fetch user
        result = await self.db.execute(
            select(AuthUser).where(AuthUser.id == user_id)
        )
        user = result.scalar_one_or_none()
        
        if not user:
            return False, None
        
        # Generate password if needed
        if generate_random or not new_password:
            new_password = self._generate_secure_password()
        
        # Update password
        user.password_hash = hash_password(new_password)
        user.updated_at = get_utc_now()
        
        # Invalidate all sessions
        await self._invalidate_user_sessions(user_id)
        
        # Log the action
        await self._log_admin_action(
            action=AdminAction.USER_RESET_PASSWORD,
            target_type="user",
            target_id=user_id,
            metadata={
                "require_change": require_change,
                "reason": reason
            },
            reason=reason,
            request_context=request_context
        )
        
        # Send email
        if send_email:
            await self.email_service.send_admin_password_reset(
                user_id=user_id,
                new_password=new_password,
                admin_email=self.admin_user.email,
                reason=reason,
                require_change=require_change
            )
        
        await self.db.commit()
        return True, new_password if generate_random else None
    
    async def force_logout_user(
        self,
        user_id: UUID,
        reason: str,
        logout_all: bool = True,
        request_context: Optional[Dict[str, Any]] = None
    ) -> int:
        """
        Force logout a user by invalidating their sessions.
        
        Args:
            user_id: User ID
            reason: Reason for force logout
            logout_all: Logout all sessions or just active ones
            request_context: Request context for audit logging
            
        Returns:
            Number of sessions invalidated
        """
        count = await self._invalidate_user_sessions(user_id, all_sessions=logout_all)
        
        # Log the action
        await self._log_admin_action(
            action=AdminAction.USER_FORCE_LOGOUT,
            target_type="user",
            target_id=user_id,
            metadata={
                "sessions_invalidated": count,
                "logout_all": logout_all
            },
            reason=reason,
            request_context=request_context
        )
        
        await self.db.commit()
        return count
    
    async def bulk_operation(
        self,
        user_ids: List[UUID],
        operation: str,
        reason: Optional[str] = None,
        send_notifications: bool = True,
        request_context: Optional[Dict[str, Any]] = None
    ) -> BulkOperationResult:
        """
        Perform bulk operation on multiple users.
        
        Args:
            user_ids: List of user IDs
            operation: Operation to perform
            reason: Reason for operation
            send_notifications: Send notifications to users
            request_context: Request context for audit logging
            
        Returns:
            Operation result
        """
        result = BulkOperationResult(
            total=len(user_ids),
            successful=0,
            failed=0,
            errors=[]
        )
        
        # Map operation to action
        action_map = {
            "suspend": AdminAction.BULK_SUSPEND,
            "activate": AdminAction.BULK_ACTIVATE,
            "delete": AdminAction.BULK_DELETE,
            "export": AdminAction.BULK_EXPORT
        }
        
        # Process each user
        for user_id in user_ids:
            try:
                if operation == "suspend":
                    success = await self.suspend_user(
                        user_id, reason or "Bulk suspension",
                        notify_user=send_notifications,
                        request_context=request_context
                    )
                elif operation == "activate":
                    success = await self.activate_user(
                        user_id, reason or "Bulk activation",
                        notify_user=send_notifications,
                        request_context=request_context
                    )
                elif operation == "delete":
                    success = await self.delete_user(
                        user_id, 
                        request_context=request_context
                    )
                else:
                    success = False
                
                if success:
                    result.successful += 1
                else:
                    result.failed += 1
                    result.errors.append({
                        "user_id": str(user_id),
                        "error": "Operation failed"
                    })
            
            except Exception as e:
                result.failed += 1
                result.errors.append({
                    "user_id": str(user_id),
                    "error": str(e)
                })
        
        # Log bulk operation
        await self._log_admin_action(
            action=action_map.get(operation, AdminAction.USER_UPDATE),
            target_type="user",
            target_ids=[str(uid) for uid in user_ids],
            metadata={
                "operation": operation,
                "total": result.total,
                "successful": result.successful,
                "failed": result.failed
            },
            reason=reason,
            request_context=request_context,
            success=result.failed == 0
        )
        
        await self.db.commit()
        return result
    
    async def delete_user(
        self,
        user_id: UUID,
        request_context: Optional[Dict[str, Any]] = None
    ) -> bool:
        """
        Soft delete (archive) a user.
        
        Args:
            user_id: User ID
            request_context: Request context for audit logging
            
        Returns:
            Success status
        """
        # Don't allow deleting self
        if user_id == self.admin_user.id:
            raise ValueError("Cannot delete your own admin account")
        
        # Archive user
        result = await self.db.execute(
            update(AuthUser)
            .where(AuthUser.id == user_id)
            .values(
                is_archived=True,
                is_active=False,
                updated_at=get_utc_now()
            )
        )
        
        if result.rowcount == 0:
            return False
        
        # Invalidate all sessions
        await self._invalidate_user_sessions(user_id)
        
        # Log the action
        await self._log_admin_action(
            action=AdminAction.USER_DELETE,
            target_type="user",
            target_id=user_id,
            request_context=request_context
        )
        
        await self.db.commit()
        return True
    
    async def search_users(
        self,
        query: str,
        limit: int = 10,
        request_context: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        """
        Search users by email or name.
        
        Args:
            query: Search query
            limit: Maximum results
            request_context: Request context
            
        Returns:
            List of matching users
        """
        # Search by email
        result = await self.db.execute(
            select(AuthUser)
            .where(
                and_(
                    func.lower(AuthUser.email).contains(query.lower()),
                    AuthUser.is_archived == False
                )
            )
            .limit(limit)
        )
        
        users = result.scalars().all()
        
        return [
            {
                "id": user.id,
                "email": user.email,
                "role": user.role,
                "is_active": user.is_active
            }
            for user in users
        ]
    
    # Helper methods
    
    async def _calculate_user_statistics(self) -> Dict[str, int]:
        """Calculate user statistics."""
        stats = {}
        
        # Total users
        result = await self.db.execute(
            select(func.count(AuthUser.id))
        )
        stats["total_users"] = result.scalar_one()
        
        # Active users
        result = await self.db.execute(
            select(func.count(AuthUser.id))
            .where(
                and_(
                    AuthUser.is_active == True,
                    AuthUser.is_archived == False
                )
            )
        )
        stats["active_users"] = result.scalar_one()
        
        # Verified emails
        result = await self.db.execute(
            select(func.count(AuthUser.id))
            .where(AuthUser.email_verified == True)
        )
        stats["verified_emails"] = result.scalar_one()
        
        # By role
        result = await self.db.execute(
            select(AuthUser.role, func.count(AuthUser.id))
            .group_by(AuthUser.role)
        )
        for role, count in result:
            stats[f"{role}_count"] = count
        
        # Recent registrations
        today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        result = await self.db.execute(
            select(func.count(AuthUser.id))
            .where(AuthUser.created_at >= today)
        )
        stats["registrations_today"] = result.scalar_one()
        
        return stats
    
    async def _invalidate_user_sessions(
        self,
        user_id: UUID,
        all_sessions: bool = True
    ) -> int:
        """Invalidate user sessions."""
        query = update(AuthSession).where(
            AuthSession.user_id == user_id
        )
        
        if not all_sessions:
            query = query.where(AuthSession.is_valid == True)
        
        query = query.values(is_valid=False)
        
        result = await self.db.execute(query)
        return result.rowcount
    
    def _generate_secure_password(self, length: int = 12) -> str:
        """Generate a secure random password."""
        alphabet = string.ascii_letters + string.digits + "!@#$%^&*"
        password = ''.join(secrets.choice(alphabet) for _ in range(length))
        return password
    
    async def _log_admin_action(
        self,
        action: AdminAction,
        target_type: str,
        target_id: Optional[UUID] = None,
        target_ids: Optional[List[str]] = None,
        before_state: Optional[Dict[str, Any]] = None,
        after_state: Optional[Dict[str, Any]] = None,
        changes: Optional[Dict[str, Any]] = None,
        reason: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
        request_context: Optional[Dict[str, Any]] = None,
        success: bool = True,
        error_message: Optional[str] = None
    ):
        """Log an administrative action."""
        log_entry = AdminAuditLog(
            admin_id=self.admin_user.id,
            action=action,
            target_type=target_type,
            target_id=target_id,
            target_ids=target_ids,
            before_state=before_state,
            after_state=after_state,
            changes=changes,
            reason=reason,
            metadata=metadata,
            success=success,
            error_message=error_message
        )
        
        # Add request context
        if request_context:
            log_entry.ip_address = request_context.get("ip_address")
            log_entry.user_agent = request_context.get("user_agent")
            log_entry.request_id = request_context.get("request_id")
        
        self.db.add(log_entry)
    
    async def _create_notification(
        self,
        type: str,
        severity: str,
        title: str,
        message: str,
        related_type: Optional[str] = None,
        related_id: Optional[UUID] = None,
        metadata: Optional[Dict[str, Any]] = None
    ):
        """Create an admin notification."""
        notification = AdminNotification(
            type=type,
            severity=severity,
            title=title,
            message=message,
            related_type=related_type,
            related_id=related_id,
            metadata=metadata
        )
        
        self.db.add(notification)