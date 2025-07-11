"""User endpoints for the Jidelnicek application."""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from jidelnicek.auth.dependencies.auth import get_current_user
from jidelnicek.core.dependencies import get_db
from jidelnicek.core.models.user import User
from jidelnicek.users.schemas.user import (
    UserCreate,
    UserUpdate,
    UserResponse,
    UserListResponse,
    UserPreferences,
    UserPreferencesUpdate
)
from jidelnicek.users.services.user_service import UserService

router = APIRouter(prefix="/api/v1/users", tags=["users"])


@router.get("/me", response_model=UserResponse)
async def get_current_user_profile(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> UserResponse:
    """Get current user's profile."""
    service = UserService(db)
    user_data = await service.get_user_profile(current_user.id)
    return user_data


@router.put("/me", response_model=UserResponse)
async def update_current_user_profile(
    user_update: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> UserResponse:
    """Update current user's profile."""
    service = UserService(db)
    updated_user = await service.update_user_profile(current_user.id, user_update)
    return updated_user


@router.get("/me/preferences", response_model=UserPreferences)
async def get_user_preferences(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> UserPreferences:
    """Get current user's preferences."""
    service = UserService(db)
    preferences = await service.get_user_preferences(current_user.id)
    return preferences


@router.put("/me/preferences", response_model=UserPreferences)
async def update_user_preferences(
    preferences_update: UserPreferencesUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> UserPreferences:
    """Update current user's preferences."""
    service = UserService(db)
    updated_preferences = await service.update_user_preferences(
        current_user.id, 
        preferences_update
    )
    return updated_preferences


@router.get("/{user_id}", response_model=UserResponse)
async def get_user_by_id(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> UserResponse:
    """Get user by ID (admin only or self)."""
    # Check if user is admin or requesting own profile
    if not current_user.is_admin and current_user.id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view this user's profile"
        )
    
    service = UserService(db)
    user_data = await service.get_user_profile(user_id)
    return user_data


@router.get("/", response_model=UserListResponse)
async def list_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    is_active: Optional[bool] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> UserListResponse:
    """List users (admin only)."""
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    
    service = UserService(db)
    users, total = await service.list_users(
        skip=skip,
        limit=limit,
        search=search,
        is_active=is_active
    )
    
    return UserListResponse(
        users=users,
        total=total,
        skip=skip,
        limit=limit
    )