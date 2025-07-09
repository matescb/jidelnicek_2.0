"""
User service for Jidelnicek 2.0 authentication system.

This module provides business logic for user management including
CRUD operations, email uniqueness checking, and user activation.
"""

from datetime import datetime, timezone
from typing import Optional, List
from uuid import UUID

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError

from jidelnicek.auth.models import AuthUser
from jidelnicek.auth.schemas import UserCreateDTO, UserUpdateDTO, UserResponseDTO
from jidelnicek.auth.exceptions import (
    EmailAlreadyExistsError,
    UserNotFoundError,
    AccountInactiveError
)
from jidelnicek.auth.utils.password import PasswordHasher, PasswordValidator


class UserService:
    """Service class for user management operations."""
    
    def __init__(self, session: AsyncSession):
        """
        Initialize user service.
        
        Args:
            session: AsyncSession instance for database operations
        """
        self.session = session
    
    async def create_user(self, user_data: UserCreateDTO) -> AuthUser:
        """
        Create a new user with the provided data.
        
        Args:
            user_data: User registration data
            
        Returns:
            Created user instance
            
        Raises:
            EmailAlreadyExistsError: If email already exists
            PasswordValidationError: If password doesn't meet requirements
        """
        # Check if email already exists (case-insensitive)
        if await self.email_exists(user_data.email):
            raise EmailAlreadyExistsError(user_data.email)
        
        # Validate password strength
        is_valid, errors = PasswordValidator.validate_strength(
            user_data.password.get_secret_value(),
            user_data.email
        )
        if not is_valid:
            from jidelnicek.auth.exceptions import PasswordValidationError
            raise PasswordValidationError(errors)
        
        # Hash the password
        password_hash = PasswordHasher.hash_password(
            user_data.password.get_secret_value()
        )
        
        # Create user instance
        user = AuthUser(
            email=user_data.email.lower(),
            password_hash=password_hash,
            language=user_data.language,
            unit_system=user_data.unit_system,
            energy_unit=user_data.energy_unit,
            has_pku=user_data.has_pku,
            timezone=user_data.timezone,
            is_active=True,
            email_verified=False  # Email verification required
        )
        
        try:
            self.session.add(user)
            await self.session.commit()
            await self.session.refresh(user)
            return user
        except IntegrityError as e:
            await self.session.rollback()
            # Race condition - email was created between check and insert
            raise EmailAlreadyExistsError(user_data.email)
    
    async def get_user_by_id(self, user_id: UUID) -> Optional[AuthUser]:
        """
        Get user by ID.
        
        Args:
            user_id: User's UUID
            
        Returns:
            User instance or None if not found
        """
        stmt = select(AuthUser).where(
            AuthUser.id == user_id,
            AuthUser.is_archived == False
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()
    
    async def get_user_by_email(self, email: str) -> Optional[AuthUser]:
        """
        Get user by email (case-insensitive).
        
        Args:
            email: User's email address
            
        Returns:
            User instance or None if not found
        """
        stmt = select(AuthUser).where(
            func.lower(AuthUser.email) == email.lower(),
            AuthUser.is_archived == False
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()
    
    async def get_user_by_id_or_404(self, user_id: UUID) -> AuthUser:
        """
        Get user by ID or raise UserNotFoundError.
        
        Args:
            user_id: User's UUID
            
        Returns:
            User instance
            
        Raises:
            UserNotFoundError: If user not found
        """
        user = await self.get_user_by_id(user_id)
        if not user:
            raise UserNotFoundError(str(user_id))
        return user
    
    async def get_user_by_email_or_404(self, email: str) -> AuthUser:
        """
        Get user by email or raise UserNotFoundError.
        
        Args:
            email: User's email address
            
        Returns:
            User instance
            
        Raises:
            UserNotFoundError: If user not found
        """
        user = await self.get_user_by_email(email)
        if not user:
            raise UserNotFoundError(email)
        return user
    
    async def update_user(
        self,
        user_id: UUID,
        update_data: UserUpdateDTO
    ) -> AuthUser:
        """
        Update user profile.
        
        Args:
            user_id: User's UUID
            update_data: Fields to update
            
        Returns:
            Updated user instance
            
        Raises:
            UserNotFoundError: If user not found
        """
        user = await self.get_user_by_id_or_404(user_id)
        
        # Update only provided fields
        update_dict = update_data.dict(exclude_unset=True, exclude_none=True)
        for field, value in update_dict.items():
            setattr(user, field, value)
        
        user.updated_at = datetime.now(timezone.utc)
        
        await self.session.commit()
        await self.session.refresh(user)
        
        return user
    
    async def email_exists(self, email: str) -> bool:
        """
        Check if email already exists (case-insensitive).
        
        Args:
            email: Email to check
            
        Returns:
            True if email exists, False otherwise
        """
        stmt = select(AuthUser.id).where(
            func.lower(AuthUser.email) == email.lower()
        ).limit(1)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none() is not None
    
    async def activate_user(self, user_id: UUID) -> AuthUser:
        """
        Activate a user account.
        
        Args:
            user_id: User's UUID
            
        Returns:
            Updated user instance
            
        Raises:
            UserNotFoundError: If user not found
        """
        user = await self.get_user_by_id_or_404(user_id)
        
        user.is_active = True
        user.locked_until = None
        user.failed_login_attempts = 0
        user.updated_at = datetime.now(timezone.utc)
        
        await self.session.commit()
        await self.session.refresh(user)
        
        return user
    
    async def deactivate_user(self, user_id: UUID) -> AuthUser:
        """
        Deactivate a user account.
        
        Args:
            user_id: User's UUID
            
        Returns:
            Updated user instance
            
        Raises:
            UserNotFoundError: If user not found
        """
        user = await self.get_user_by_id_or_404(user_id)
        
        user.is_active = False
        user.updated_at = datetime.now(timezone.utc)
        
        await self.session.commit()
        await self.session.refresh(user)
        
        return user
    
    async def archive_user(self, user_id: UUID) -> AuthUser:
        """
        Archive (soft delete) a user account.
        
        Args:
            user_id: User's UUID
            
        Returns:
            Updated user instance
            
        Raises:
            UserNotFoundError: If user not found
        """
        user = await self.get_user_by_id_or_404(user_id)
        
        user.is_archived = True
        user.is_active = False
        user.updated_at = datetime.now(timezone.utc)
        
        await self.session.commit()
        await self.session.refresh(user)
        
        return user
    
    async def verify_user_email(self, user_id: UUID) -> AuthUser:
        """
        Mark user's email as verified.
        
        Args:
            user_id: User's UUID
            
        Returns:
            Updated user instance
            
        Raises:
            UserNotFoundError: If user not found
        """
        user = await self.get_user_by_id_or_404(user_id)
        
        user.email_verified = True
        user.email_verified_at = datetime.now(timezone.utc)
        user.verification_token = None  # Clear verification token
        user.updated_at = datetime.now(timezone.utc)
        
        await self.session.commit()
        await self.session.refresh(user)
        
        return user
    
    async def update_last_login(self, user_id: UUID) -> None:
        """
        Update user's last login timestamp.
        
        Args:
            user_id: User's UUID
        """
        stmt = (
            select(AuthUser)
            .where(AuthUser.id == user_id)
            .with_for_update()
        )
        result = await self.session.execute(stmt)
        user = result.scalar_one_or_none()
        
        if user:
            user.last_login = datetime.now(timezone.utc)
            await self.session.commit()
    
    async def increment_failed_login_attempts(self, user: AuthUser) -> int:
        """
        Increment failed login attempts counter.
        
        Args:
            user: User instance
            
        Returns:
            New failed attempts count
        """
        user.failed_login_attempts += 1
        await self.session.commit()
        return user.failed_login_attempts
    
    async def reset_failed_login_attempts(self, user: AuthUser) -> None:
        """
        Reset failed login attempts counter.
        
        Args:
            user: User instance
        """
        user.failed_login_attempts = 0
        user.locked_until = None
        await self.session.commit()
    
    async def lock_user_account(self, user: AuthUser, until: datetime) -> None:
        """
        Lock user account until specified time.
        
        Args:
            user: User instance
            until: Datetime when lock expires
        """
        user.locked_until = until
        await self.session.commit()
    
    async def get_user_count(self) -> int:
        """
        Get total number of active users.
        
        Returns:
            Number of active users
        """
        stmt = select(func.count(AuthUser.id)).where(
            AuthUser.is_archived == False,
            AuthUser.is_active == True
        )
        result = await self.session.execute(stmt)
        return result.scalar_one()
    
    async def get_users(
        self,
        skip: int = 0,
        limit: int = 100,
        include_inactive: bool = False
    ) -> List[AuthUser]:
        """
        Get paginated list of users.
        
        Args:
            skip: Number of records to skip
            limit: Maximum number of records to return
            include_inactive: Whether to include inactive users
            
        Returns:
            List of users
        """
        stmt = select(AuthUser).where(AuthUser.is_archived == False)
        
        if not include_inactive:
            stmt = stmt.where(AuthUser.is_active == True)
        
        stmt = stmt.offset(skip).limit(limit).order_by(AuthUser.created_at.desc())
        
        result = await self.session.execute(stmt)
        return result.scalars().all()
    
    def to_response_dto(self, user: AuthUser) -> UserResponseDTO:
        """
        Convert user model to response DTO.
        
        Args:
            user: User model instance
            
        Returns:
            UserResponseDTO instance
        """
        return UserResponseDTO.from_orm(user)