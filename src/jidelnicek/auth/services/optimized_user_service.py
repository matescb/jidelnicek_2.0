"""
Optimized user service with advanced query patterns and performance optimizations.

This service extends the base user service with additional optimizations for
authentication operations, session management, and user-related queries.
"""

from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any, Tuple
from uuid import UUID

from sqlalchemy import select, func, and_, or_, update, delete, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError, NoResultFound
from sqlalchemy.orm import selectinload, joinedload

from jidelnicek.core.services.base import SearchableService, CacheableService
from jidelnicek.core.query_helpers import profile_query, QueryOptimizer
from jidelnicek.auth.models import (
    AuthUser, AuthSession, AuthToken, AuthPasswordResetToken,
    AuthEmailVerificationToken, AuditLog
)
from jidelnicek.auth.schemas import UserCreate, UserUpdate, UserResponse
from jidelnicek.auth.exceptions import (
    UserNotFoundError, EmailAlreadyExistsError, InvalidCredentialsError,
    AccountLockedError, TokenExpiredError, TokenNotFoundError
)
from jidelnicek.auth.utils.password import verify_password, get_password_hash
from jidelnicek.core.config import settings


class OptimizedUserService(SearchableService, CacheableService):
    """Optimized service class for user management operations."""
    
    @property
    def model(self):
        return AuthUser
    
    @property
    def search_fields(self) -> List[str]:
        return ['email']
    
    def __init__(self, session: AsyncSession):
        super().__init__(session)
    
    # Optimized authentication operations
    
    @profile_query
    async def authenticate_user(self, email: str, password: str) -> AuthUser:
        """
        Authenticate user with optimized query and session loading.
        
        Args:
            email: User's email address
            password: User's password
            
        Returns:
            Authenticated user with session data
            
        Raises:
            InvalidCredentialsError: If credentials are invalid
            AccountLockedError: If account is locked
        """
        # Get user with authentication-related data in single query
        stmt = (
            select(AuthUser)
            .options(selectinload(AuthUser.sessions))
            .where(
                func.lower(AuthUser.email) == email.lower(),
                AuthUser.is_archived == False
            )
        )
        
        result = await self.session.execute(stmt)
        user = result.scalar_one_or_none()
        
        if not user:
            raise InvalidCredentialsError("Invalid email or password")
        
        # Check if account is locked
        if user.is_locked:
            raise AccountLockedError(
                f"Account is locked until {user.locked_until}",
                locked_until=user.locked_until
            )
        
        # Verify password
        if not verify_password(password, user.password_hash):
            # Increment failed attempts
            await self._increment_failed_attempts(user)
            raise InvalidCredentialsError("Invalid email or password")
        
        # Reset failed attempts on successful login
        if user.failed_login_attempts > 0:
            user.failed_login_attempts = 0
            user.locked_until = None
        
        # Update last login
        user.last_login = datetime.now(timezone.utc)
        
        return user
    
    @profile_query
    async def get_user_with_sessions(self, user_id: UUID) -> AuthUser:
        """
        Get user with all active sessions in a single optimized query.
        
        Args:
            user_id: User ID
            
        Returns:
            User with sessions loaded
        """
        stmt = (
            select(AuthUser)
            .options(
                selectinload(AuthUser.sessions).where(
                    and_(
                        AuthSession.is_valid == True,
                        AuthSession.expires_at > datetime.now(timezone.utc)
                    )
                )
            )
            .where(
                AuthUser.id == user_id,
                AuthUser.is_archived == False
            )
        )
        
        result = await self.session.execute(stmt)
        user = result.scalar_one_or_none()
        
        if not user:
            raise UserNotFoundError(user_id)
        
        return user
    
    @profile_query
    async def get_users_with_stats_batch(
        self,
        user_ids: List[UUID]
    ) -> List[Dict[str, Any]]:
        """
        Get multiple users with statistics in optimized batch queries.
        
        Args:
            user_ids: List of user IDs
            
        Returns:
            List of user data with statistics
        """
        # Get users in single query
        stmt = (
            select(AuthUser)
            .where(
                AuthUser.id.in_(user_ids),
                AuthUser.is_archived == False
            )
        )
        
        result = await self.session.execute(stmt)
        users = result.scalars().all()
        
        # Get session counts in single query
        session_counts_stmt = (
            select(
                AuthSession.user_id,
                func.count(AuthSession.id).label('session_count')
            )
            .where(
                AuthSession.user_id.in_(user_ids),
                AuthSession.is_valid == True,
                AuthSession.expires_at > datetime.now(timezone.utc)
            )
            .group_by(AuthSession.user_id)
        )
        
        session_result = await self.session.execute(session_counts_stmt)
        session_counts = {row.user_id: row.session_count for row in session_result}
        
        # Get token counts in single query
        token_counts_stmt = (
            select(
                AuthToken.user_id,
                func.count(AuthToken.id).label('token_count')
            )
            .where(
                AuthToken.user_id.in_(user_ids),
                AuthToken.is_active == True
            )
            .group_by(AuthToken.user_id)
        )
        
        token_result = await self.session.execute(token_counts_stmt)
        token_counts = {row.user_id: row.token_count for row in token_result}
        
        # Combine data
        user_stats = []
        for user in users:
            user_stats.append({
                'user': user,
                'session_count': session_counts.get(user.id, 0),
                'token_count': token_counts.get(user.id, 0),
                'is_active': user.is_active and not user.is_locked
            })
        
        return user_stats
    
    @profile_query
    async def create_user_optimized(
        self,
        user_data: UserCreate,
        send_verification_email: bool = True
    ) -> AuthUser:
        """
        Create a new user with optimized duplicate checking.
        
        Args:
            user_data: User creation data
            send_verification_email: Whether to send verification email
            
        Returns:
            Created user instance
            
        Raises:
            EmailAlreadyExistsError: If email already exists
        """
        async with self.session.begin():
            # Check if email already exists
            existing_user = await self._check_email_exists(user_data.email)
            if existing_user:
                raise EmailAlreadyExistsError(user_data.email)
            
            # Create user
            user_dict = user_data.model_dump(exclude={'password'})
            user = AuthUser(
                **user_dict,
                password_hash=get_password_hash(user_data.password)
            )
            
            self.session.add(user)
            await self.session.flush()
            
            # Create verification token if needed
            if send_verification_email:
                await self._create_verification_token(user)
            
            await self.session.commit()
            
            return user
    
    @profile_query
    async def update_user_optimized(
        self,
        user_id: UUID,
        update_data: UserUpdate,
        updated_by: Optional[UUID] = None
    ) -> AuthUser:
        """
        Update user with optimized conflict checking.
        
        Args:
            user_id: User ID to update
            update_data: Update data
            updated_by: ID of user making the update
            
        Returns:
            Updated user instance
        """
        async with self.session.begin():
            # Get user
            user = await self.get_by_id(user_id, raise_not_found=True)
            
            # Check email uniqueness if email is being updated
            if update_data.email and update_data.email != user.email:
                existing_user = await self._check_email_exists(update_data.email)
                if existing_user:
                    raise EmailAlreadyExistsError(update_data.email)
            
            # Update fields
            update_dict = update_data.model_dump(exclude_unset=True, exclude_none=True)
            
            # Handle password update
            if 'password' in update_dict:
                update_dict['password_hash'] = get_password_hash(update_dict.pop('password'))
            
            for field, value in update_dict.items():
                setattr(user, field, value)
            
            user.updated_at = datetime.now(timezone.utc)
            
            # Log the update
            await self._log_user_update(user, updated_by, update_dict)
            
            await self.session.commit()
            
            # Invalidate cache
            self.invalidate_cache(user_id)
            
            return user
    
    # Session management
    
    @profile_query
    async def create_session_optimized(
        self,
        user_id: UUID,
        token_hash: str,
        expires_at: datetime,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None
    ) -> AuthSession:
        """
        Create a new session with optimized session limit enforcement.
        
        Args:
            user_id: User ID
            token_hash: Hashed refresh token
            expires_at: Session expiration time
            ip_address: Client IP address
            user_agent: Client user agent
            
        Returns:
            Created session instance
        """
        async with self.session.begin():
            # Check session limit
            await self._enforce_session_limit(user_id)
            
            # Create session
            session = AuthSession(
                user_id=user_id,
                token_hash=token_hash,
                expires_at=expires_at,
                ip_address=ip_address,
                user_agent=user_agent
            )
            
            self.session.add(session)
            await self.session.commit()
            
            return session
    
    @profile_query
    async def cleanup_expired_sessions(self, user_id: Optional[UUID] = None) -> int:
        """
        Clean up expired sessions with optimized bulk operations.
        
        Args:
            user_id: Optional user ID to limit cleanup scope
            
        Returns:
            Number of sessions cleaned up
        """
        conditions = [
            or_(
                AuthSession.expires_at < datetime.now(timezone.utc),
                AuthSession.is_valid == False
            )
        ]
        
        if user_id:
            conditions.append(AuthSession.user_id == user_id)
        
        delete_stmt = delete(AuthSession).where(and_(*conditions))
        
        result = await self.session.execute(delete_stmt)
        deleted_count = result.rowcount
        
        await self.session.commit()
        
        return deleted_count
    
    @profile_query
    async def get_active_sessions_count(self, user_id: UUID) -> int:
        """
        Get count of active sessions for a user.
        
        Args:
            user_id: User ID
            
        Returns:
            Number of active sessions
        """
        stmt = (
            select(func.count(AuthSession.id))
            .where(
                AuthSession.user_id == user_id,
                AuthSession.is_valid == True,
                AuthSession.expires_at > datetime.now(timezone.utc)
            )
        )
        
        result = await self.session.execute(stmt)
        return result.scalar()
    
    # Token management
    
    @profile_query
    async def create_password_reset_token(
        self,
        email: str,
        ip_address: Optional[str] = None
    ) -> AuthPasswordResetToken:
        """
        Create password reset token with optimized user lookup.
        
        Args:
            email: User's email address
            ip_address: Client IP address
            
        Returns:
            Created password reset token
            
        Raises:
            UserNotFoundError: If user not found
        """
        async with self.session.begin():
            # Get user by email
            user = await self._get_user_by_email(email)
            if not user:
                raise UserNotFoundError(f"User with email {email} not found")
            
            # Invalidate existing tokens
            await self._invalidate_existing_reset_tokens(user.id)
            
            # Create new token
            import secrets
            token = secrets.token_urlsafe(32)
            expires_at = datetime.now(timezone.utc) + timedelta(hours=1)
            
            reset_token = AuthPasswordResetToken(
                user_id=user.id,
                token=token,
                expires_at=expires_at,
                request_ip=ip_address
            )
            
            self.session.add(reset_token)
            await self.session.commit()
            
            return reset_token
    
    @profile_query
    async def verify_password_reset_token(
        self,
        token: str,
        ip_address: Optional[str] = None
    ) -> AuthPasswordResetToken:
        """
        Verify password reset token with optimized lookup.
        
        Args:
            token: Reset token
            ip_address: Client IP address
            
        Returns:
            Valid password reset token
            
        Raises:
            TokenNotFoundError: If token not found
            TokenExpiredError: If token is expired or used
        """
        stmt = (
            select(AuthPasswordResetToken)
            .where(AuthPasswordResetToken.token == token)
        )
        
        result = await self.session.execute(stmt)
        reset_token = result.scalar_one_or_none()
        
        if not reset_token:
            raise TokenNotFoundError("Password reset token not found")
        
        if not reset_token.is_valid:
            raise TokenExpiredError("Password reset token is expired or already used")
        
        return reset_token
    
    @profile_query
    async def use_password_reset_token(
        self,
        token: str,
        new_password: str,
        ip_address: Optional[str] = None
    ) -> AuthUser:
        """
        Use password reset token to change password.
        
        Args:
            token: Reset token
            new_password: New password
            ip_address: Client IP address
            
        Returns:
            User with updated password
        """
        async with self.session.begin():
            # Verify token
            reset_token = await self.verify_password_reset_token(token, ip_address)
            
            # Get user
            user = await self.get_by_id(reset_token.user_id, raise_not_found=True)
            
            # Update password
            user.password_hash = get_password_hash(new_password)
            user.updated_at = datetime.now(timezone.utc)
            
            # Mark token as used
            reset_token.used_at = datetime.now(timezone.utc)
            reset_token.used_ip = ip_address
            
            # Invalidate all sessions
            await self._invalidate_all_sessions(user.id)
            
            await self.session.commit()
            
            # Invalidate cache
            self.invalidate_cache(user.id)
            
            return user
    
    # User statistics and analytics
    
    @profile_query
    async def get_user_statistics(self, user_id: UUID) -> Dict[str, Any]:
        """
        Get comprehensive user statistics.
        
        Args:
            user_id: User ID
            
        Returns:
            Dictionary with user statistics
        """
        # Get user
        user = await self.get_by_id(user_id, raise_not_found=True)
        
        # Get session statistics
        session_stats_stmt = (
            select(
                func.count(AuthSession.id).label('total_sessions'),
                func.count(
                    func.case(
                        (AuthSession.is_valid == True, 1),
                        else_=None
                    )
                ).label('active_sessions'),
                func.max(AuthSession.last_accessed).label('last_session_activity')
            )
            .where(AuthSession.user_id == user_id)
        )
        
        session_result = await self.session.execute(session_stats_stmt)
        session_stats = session_result.first()
        
        # Get token statistics
        token_stats_stmt = (
            select(
                func.count(AuthToken.id).label('total_tokens'),
                func.count(
                    func.case(
                        (AuthToken.is_active == True, 1),
                        else_=None
                    )
                ).label('active_tokens'),
                func.max(AuthToken.last_used).label('last_token_use')
            )
            .where(AuthToken.user_id == user_id)
        )
        
        token_result = await self.session.execute(token_stats_stmt)
        token_stats = token_result.first()
        
        return {
            'user_id': user_id,
            'email': user.email,
            'is_active': user.is_active,
            'is_locked': user.is_locked,
            'email_verified': user.email_verified,
            'created_at': user.created_at,
            'last_login': user.last_login,
            'failed_login_attempts': user.failed_login_attempts,
            'sessions': {
                'total': session_stats.total_sessions or 0,
                'active': session_stats.active_sessions or 0,
                'last_activity': session_stats.last_session_activity
            },
            'tokens': {
                'total': token_stats.total_tokens or 0,
                'active': token_stats.active_tokens or 0,
                'last_use': token_stats.last_token_use
            }
        }
    
    # Helper methods
    
    async def _check_email_exists(self, email: str) -> Optional[AuthUser]:
        """Check if email already exists."""
        stmt = (
            select(AuthUser)
            .where(
                func.lower(AuthUser.email) == email.lower(),
                AuthUser.is_archived == False
            )
        )
        
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()
    
    async def _get_user_by_email(self, email: str) -> Optional[AuthUser]:
        """Get user by email."""
        return await self._check_email_exists(email)
    
    async def _increment_failed_attempts(self, user: AuthUser):
        """Increment failed login attempts and lock account if needed."""
        user.failed_login_attempts += 1
        
        if user.failed_login_attempts >= settings.max_login_attempts:
            user.locked_until = datetime.now(timezone.utc) + settings.lockout_duration_timedelta
    
    async def _enforce_session_limit(self, user_id: UUID):
        """Enforce maximum sessions per user."""
        active_count = await self.get_active_sessions_count(user_id)
        
        if active_count >= settings.max_sessions_per_user:
            # Remove oldest session
            oldest_session_stmt = (
                select(AuthSession)
                .where(
                    AuthSession.user_id == user_id,
                    AuthSession.is_valid == True,
                    AuthSession.expires_at > datetime.now(timezone.utc)
                )
                .order_by(AuthSession.created_at.asc())
                .limit(1)
            )
            
            result = await self.session.execute(oldest_session_stmt)
            oldest_session = result.scalar_one_or_none()
            
            if oldest_session:
                oldest_session.is_valid = False
    
    async def _invalidate_existing_reset_tokens(self, user_id: UUID):
        """Invalidate all existing reset tokens for a user."""
        update_stmt = (
            update(AuthPasswordResetToken)
            .where(
                AuthPasswordResetToken.user_id == user_id,
                AuthPasswordResetToken.used_at.is_(None)
            )
            .values(used_at=datetime.now(timezone.utc))
        )
        
        await self.session.execute(update_stmt)
    
    async def _invalidate_all_sessions(self, user_id: UUID):
        """Invalidate all sessions for a user."""
        update_stmt = (
            update(AuthSession)
            .where(AuthSession.user_id == user_id)
            .values(is_valid=False)
        )
        
        await self.session.execute(update_stmt)
    
    async def _create_verification_token(self, user: AuthUser):
        """Create email verification token."""
        import secrets
        token = secrets.token_urlsafe(32)
        expires_at = datetime.now(timezone.utc) + timedelta(hours=24)
        
        verification_token = AuthEmailVerificationToken(
            user_id=user.id,
            token=token,
            expires_at=expires_at
        )
        
        self.session.add(verification_token)
    
    async def _log_user_update(
        self,
        user: AuthUser,
        updated_by: Optional[UUID],
        changes: Dict[str, Any]
    ):
        """Log user update to audit log."""
        audit_entry = AuditLog(
            user_id=updated_by,
            action="user_updated",
            entity_type="user",
            entity_id=user.id,
            changes=changes
        )
        
        self.session.add(audit_entry)