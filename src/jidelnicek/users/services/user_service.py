"""User service for business logic."""

from typing import List, Optional, Tuple, Dict, Any
from datetime import datetime, timezone
from sqlalchemy import select, func, or_, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from jidelnicek.core.models.user import User
from jidelnicek.core.exceptions import NotFoundError, ValidationError
from jidelnicek.users.schemas.user import (
    UserCreate,
    UserUpdate,
    UserResponse,
    UserPreferences,
    UserPreferencesUpdate,
    UserStats
)


class UserService:
    """Service for user-related operations."""
    
    def __init__(self, db: AsyncSession):
        """Initialize user service.
        
        Args:
            db: Database session
        """
        self.db = db
    
    async def get_user_profile(self, user_id: int) -> UserResponse:
        """Get user profile by ID.
        
        Args:
            user_id: User ID
            
        Returns:
            User profile data
            
        Raises:
            NotFoundException: If user not found
        """
        query = select(User).where(User.id == user_id)
        result = await self.db.execute(query)
        user = result.scalar_one_or_none()
        
        if not user:
            raise NotFoundError(f"User with ID {user_id} not found")
        
        return UserResponse.model_validate(user)
    
    async def update_user_profile(
        self, 
        user_id: int, 
        user_update: UserUpdate
    ) -> UserResponse:
        """Update user profile.
        
        Args:
            user_id: User ID
            user_update: Update data
            
        Returns:
            Updated user profile
            
        Raises:
            NotFoundException: If user not found
            BadRequestException: If username/email already taken
        """
        # Get existing user
        query = select(User).where(User.id == user_id)
        result = await self.db.execute(query)
        user = result.scalar_one_or_none()
        
        if not user:
            raise NotFoundError(f"User with ID {user_id} not found")
        
        # Check for duplicate username if updating
        if user_update.username and user_update.username != user.username:
            existing = await self.db.execute(
                select(User).where(User.username == user_update.username)
            )
            if existing.scalar_one_or_none():
                raise ValidationError("Username already taken", field="username")
        
        # Check for duplicate email if updating
        if user_update.email and user_update.email != user.email:
            existing = await self.db.execute(
                select(User).where(User.email == user_update.email)
            )
            if existing.scalar_one_or_none():
                raise ValidationError("Email already registered", field="email")
        
        # Update user fields
        update_data = user_update.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(user, field, value)
        
        user.updated_at = datetime.now(timezone.utc)
        
        await self.db.commit()
        await self.db.refresh(user)
        
        return UserResponse.model_validate(user)
    
    async def list_users(
        self,
        skip: int = 0,
        limit: int = 20,
        search: Optional[str] = None,
        is_active: Optional[bool] = None
    ) -> Tuple[List[UserResponse], int]:
        """List users with pagination and filters.
        
        Args:
            skip: Number of records to skip
            limit: Maximum number of records to return
            search: Search term for username/email
            is_active: Filter by active status
            
        Returns:
            Tuple of (users list, total count)
        """
        # Base query
        query = select(User)
        count_query = select(func.count(User.id))
        
        # Apply filters
        if search:
            search_filter = or_(
                User.username.ilike(f"%{search}%"),
                User.email.ilike(f"%{search}%"),
                User.first_name.ilike(f"%{search}%"),
                User.last_name.ilike(f"%{search}%")
            )
            query = query.where(search_filter)
            count_query = count_query.where(search_filter)
        
        if is_active is not None:
            query = query.where(User.is_active == is_active)
            count_query = count_query.where(User.is_active == is_active)
        
        # Get total count
        total_result = await self.db.execute(count_query)
        total = total_result.scalar()
        
        # Apply pagination and ordering
        query = query.order_by(User.created_at.desc()).offset(skip).limit(limit)
        
        # Execute query
        result = await self.db.execute(query)
        users = result.scalars().all()
        
        return (
            [UserResponse.model_validate(user) for user in users],
            total
        )
    
    async def get_user_preferences(self, user_id: int) -> UserPreferences:
        """Get user preferences.
        
        Args:
            user_id: User ID
            
        Returns:
            User preferences
        """
        # Get user with preferences
        query = select(User).where(User.id == user_id)
        result = await self.db.execute(query)
        user = result.scalar_one_or_none()
        
        if not user:
            raise NotFoundError(f"User with ID {user_id} not found")
        
        # Return preferences from user model or defaults
        # In a real implementation, preferences might be stored separately
        preferences_data = {
            "language": getattr(user, "language", "cs"),
            "timezone": getattr(user, "timezone", "Europe/Prague"),
            "theme": getattr(user, "theme", "light"),
            "email_notifications": getattr(user, "email_notifications", True),
            "push_notifications": getattr(user, "push_notifications", False),
            "dietary_restrictions": getattr(user, "dietary_restrictions", []),
            "allergens": getattr(user, "allergens", []),
            "preferred_cuisines": getattr(user, "preferred_cuisines", []),
            "cooking_skill_level": getattr(user, "cooking_skill_level", "intermediate"),
            "default_servings": getattr(user, "default_servings", 4),
            "measurement_system": getattr(user, "measurement_system", "metric")
        }
        
        return UserPreferences(**preferences_data)
    
    async def update_user_preferences(
        self,
        user_id: int,
        preferences_update: UserPreferencesUpdate
    ) -> UserPreferences:
        """Update user preferences.
        
        Args:
            user_id: User ID
            preferences_update: Preferences update data
            
        Returns:
            Updated preferences
        """
        # Get user
        query = select(User).where(User.id == user_id)
        result = await self.db.execute(query)
        user = result.scalar_one_or_none()
        
        if not user:
            raise NotFoundError(f"User with ID {user_id} not found")
        
        # Update preferences
        # In a real implementation, this might update a separate preferences table
        update_data = preferences_update.model_dump(exclude_unset=True)
        
        # For now, we'll store as JSON in user table or handle differently
        # This is a placeholder implementation
        
        await self.db.commit()
        
        return await self.get_user_preferences(user_id)
    
    async def get_user_stats(self, user_id: int) -> UserStats:
        """Get user statistics.
        
        Args:
            user_id: User ID
            
        Returns:
            User statistics
        """
        # This would typically involve queries to related tables
        # For now, returning placeholder data
        user = await self.get_user_profile(user_id)
        
        days_since_joined = (datetime.now(timezone.utc) - user.created_at).days
        
        return UserStats(
            total_recipes_created=0,
            total_trips_created=0,
            total_trips_participated=0,
            favorite_recipes_count=0,
            recent_activity_count=0,
            joined_days_ago=days_since_joined
        )