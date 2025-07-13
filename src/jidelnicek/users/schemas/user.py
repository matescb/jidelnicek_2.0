"""User schemas for DTOs."""

from datetime import datetime
from typing import List, Optional, Dict, Any
from uuid import UUID
from pydantic import BaseModel, EmailStr, Field, ConfigDict


class UserBase(BaseModel):
    """Base user schema."""
    email: EmailStr


class UserCreate(UserBase):
    """Schema for creating a user."""
    password: str = Field(..., min_length=8)


class UserUpdate(BaseModel):
    """Schema for updating user profile."""
    email: Optional[EmailStr] = None
    language: Optional[str] = Field(None, max_length=2)
    unit_system: Optional[str] = Field(None, max_length=10)
    energy_unit: Optional[str] = Field(None, max_length=10)
    timezone: Optional[str] = Field(None, max_length=50)


class UserResponse(UserBase):
    """Schema for user response."""
    id: UUID
    is_active: bool
    email_verified: bool
    role: str
    language: str
    unit_system: str
    energy_unit: str
    timezone: str
    has_pku: bool
    created_at: datetime
    updated_at: datetime
    last_login: Optional[datetime]
    recipe_count: int
    trip_count: int
    
    model_config = ConfigDict(from_attributes=True)


class UserListResponse(BaseModel):
    """Schema for paginated user list response."""
    users: List[UserResponse]
    total: int
    skip: int
    limit: int


class UserPreferences(BaseModel):
    """Schema for user preferences."""
    language: str = Field(default="cs", pattern="^[a-z]{2}$")
    timezone: str = Field(default="Europe/Prague")
    theme: str = Field(default="light", pattern="^(light|dark|auto)$")
    email_notifications: bool = True
    push_notifications: bool = False
    dietary_restrictions: List[str] = Field(default_factory=list)
    allergens: List[str] = Field(default_factory=list)
    preferred_cuisines: List[str] = Field(default_factory=list)
    cooking_skill_level: str = Field(default="intermediate", pattern="^(beginner|intermediate|advanced)$")
    default_servings: int = Field(default=4, ge=1, le=20)
    measurement_system: str = Field(default="metric", pattern="^(metric|imperial)$")
    
    model_config = ConfigDict(from_attributes=True)


class UserPreferencesUpdate(BaseModel):
    """Schema for updating user preferences."""
    language: Optional[str] = Field(None, pattern="^[a-z]{2}$")
    timezone: Optional[str] = None
    theme: Optional[str] = Field(None, pattern="^(light|dark|auto)$")
    email_notifications: Optional[bool] = None
    push_notifications: Optional[bool] = None
    dietary_restrictions: Optional[List[str]] = None
    allergens: Optional[List[str]] = None
    preferred_cuisines: Optional[List[str]] = None
    cooking_skill_level: Optional[str] = Field(None, pattern="^(beginner|intermediate|advanced)$")
    default_servings: Optional[int] = Field(None, ge=1, le=20)
    measurement_system: Optional[str] = Field(None, pattern="^(metric|imperial)$")


class UserStats(BaseModel):
    """Schema for user statistics."""
    total_recipes_created: int
    total_trips_created: int
    total_trips_participated: int
    favorite_recipes_count: int
    recent_activity_count: int
    joined_days_ago: int
    
    model_config = ConfigDict(from_attributes=True)