"""
Authentication schemas and DTOs for Jidelnicek 2.0.

This module contains all Pydantic models for request/response validation
in the authentication system, implementing comprehensive validation rules
as specified in the PRD.
"""

from datetime import datetime
from typing import Optional, List
from uuid import UUID
import re
from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator
from pydantic.types import SecretStr


class UserCreateDTO(BaseModel):
    """Schema for user registration requests."""
    
    email: EmailStr = Field(
        ..., 
        max_length=255,
        description="User's email address (unique, case-insensitive)"
    )
    password: SecretStr = Field(
        ...,
        min_length=12,
        max_length=128,
        description="User's password (12-128 chars)"
    )
    confirm_password: SecretStr = Field(
        ...,
        description="Password confirmation"
    )
    language: str = Field(
        default='cs',
        pattern='^(en|cs)$',
        description="Preferred language"
    )
    unit_system: str = Field(
        default='metric',
        pattern='^(metric|imperial)$',
        description="Preferred unit system"
    )
    energy_unit: str = Field(
        default='kcal',
        pattern='^(kcal|kJ)$',
        description="Preferred energy unit"
    )
    has_pku: bool = Field(
        default=False,
        description="Whether user has PKU (phenylketonuria)"
    )
    timezone: str = Field(
        default='Europe/Prague',
        max_length=50,
        description="User's timezone"
    )
    
    @field_validator('email')
    @classmethod
    def validate_email(cls, v):
        """Normalize email to lowercase and validate format."""
        return v.lower()
    
    @field_validator('password')
    @classmethod
    def validate_password_strength(cls, v):
        """Validate password meets security requirements."""
        password = v.get_secret_value()
        
        # Check length (already handled by Field, but for clarity)
        if len(password) < 12 or len(password) > 128:
            raise ValueError("Password must be 12-128 characters long")
        
        # Check for required character types
        if not re.search(r'[A-Z]', password):
            raise ValueError("Password must contain at least one uppercase letter")
        if not re.search(r'[a-z]', password):
            raise ValueError("Password must contain at least one lowercase letter")
        if not re.search(r'[0-9]', password):
            raise ValueError("Password must contain at least one number")
        if not re.search(r'[!@#$%^&*(),.?":{}|<>]', password):
            raise ValueError("Password must contain at least one special character")
        
        # Check for sequential patterns
        if re.search(r'(abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz|012|123|234|345|456|567|678|789)', password.lower()):
            raise ValueError("Password cannot contain sequential patterns (e.g., abc, 123)")
        
        # Check for repeated characters
        if re.search(r'(.)\1{2,}', password):
            raise ValueError("Password cannot contain more than 2 repeated characters in a row")
        
        return v
    
    @model_validator(mode='after')
    def validate_passwords_match(self):
        """Ensure password and confirm_password match."""
        if self.password and self.confirm_password:
            if self.password.get_secret_value() != self.confirm_password.get_secret_value():
                raise ValueError("Passwords do not match")
        
        return self
    
    @model_validator(mode='after')
    def validate_password_not_contains_email(self):
        """Ensure password doesn't contain the email."""
        if self.password and self.email:
            password_value = self.password.get_secret_value().lower()
            email_parts = self.email.lower().split('@')
            
            # Check if password contains email username or domain
            for part in email_parts:
                if part in password_value:
                    raise ValueError("Password cannot contain parts of your email address")
        
        return self
    
    class Config:
        json_encoders = {
            SecretStr: lambda v: v.get_secret_value() if v else None
        }


class UserLoginDTO(BaseModel):
    """Schema for user login requests."""
    
    email: EmailStr = Field(
        ..., 
        description="User's email address"
    )
    password: SecretStr = Field(
        ...,
        description="User's password"
    )
    captcha_challenge_id: Optional[str] = Field(
        None,
        description="CAPTCHA challenge ID if required"
    )
    captcha_response: Optional[str] = Field(
        None,
        description="User's response to CAPTCHA challenge"
    )
    
    @field_validator('email')
    @classmethod
    def normalize_email(cls, v):
        """Normalize email to lowercase."""
        return v.lower()


class UserUpdateDTO(BaseModel):
    """Schema for user profile updates."""
    
    language: Optional[str] = Field(
        None,
        pattern='^(en|cs)$',
        description="Preferred language"
    )
    unit_system: Optional[str] = Field(
        None,
        pattern='^(metric|imperial)$',
        description="Preferred unit system"
    )
    energy_unit: Optional[str] = Field(
        None,
        pattern='^(kcal|kJ)$',
        description="Preferred energy unit"
    )
    has_pku: Optional[bool] = Field(
        None,
        description="Whether user has PKU"
    )
    timezone: Optional[str] = Field(
        None,
        max_length=50,
        description="User's timezone"
    )
    
    class Config:
        # Only include non-None values in the dict
        exclude_none = True


class UserResponseDTO(BaseModel):
    """Schema for user responses (excludes sensitive data)."""
    
    id: UUID
    email: str
    email_verified: bool
    language: str
    unit_system: str
    energy_unit: str
    has_pku: bool
    timezone: str
    role: str
    is_active: bool
    recipe_count: int
    trip_count: int
    created_at: datetime
    updated_at: datetime
    last_login: Optional[datetime] = None
    
    class Config:
        from_attributes = True
        json_encoders = {
            datetime: lambda v: v.isoformat() if v else None
        }


class TokenResponseDTO(BaseModel):
    """Schema for JWT token responses."""
    
    access_token: str = Field(
        ...,
        description="JWT access token"
    )
    refresh_token: str = Field(
        ...,
        description="JWT refresh token"
    )
    token_type: str = Field(
        default="Bearer",
        description="Token type (always Bearer)"
    )
    expires_in: int = Field(
        ...,
        description="Access token expiration time in seconds"
    )
    user: UserResponseDTO = Field(
        ...,
        description="User information"
    )


class SessionResponseDTO(BaseModel):
    """Schema for session information responses."""
    
    id: UUID
    user_id: UUID
    expires_at: datetime
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    created_at: datetime
    last_accessed: datetime
    
    class Config:
        from_attributes = True
        json_encoders = {
            datetime: lambda v: v.isoformat() if v else None
        }


class PasswordResetRequestDTO(BaseModel):
    """Schema for password reset requests."""
    
    email: EmailStr = Field(
        ...,
        description="Email address for password reset"
    )
    
    @field_validator('email')
    @classmethod
    def normalize_email(cls, v):
        """Normalize email to lowercase."""
        return v.lower()


class PasswordResetConfirmDTO(BaseModel):
    """Schema for password reset confirmation."""
    
    token: str = Field(
        ...,
        min_length=32,
        description="Password reset token"
    )
    new_password: SecretStr = Field(
        ...,
        min_length=12,
        max_length=128,
        description="New password"
    )
    confirm_password: SecretStr = Field(
        ...,
        description="Password confirmation"
    )
    
    @field_validator('new_password')
    @classmethod
    def validate_password_strength(cls, v):
        """Validate password meets security requirements."""
        password = v.get_secret_value()
        
        # Check for required character types
        if not re.search(r'[A-Z]', password):
            raise ValueError("Password must contain at least one uppercase letter")
        if not re.search(r'[a-z]', password):
            raise ValueError("Password must contain at least one lowercase letter")
        if not re.search(r'[0-9]', password):
            raise ValueError("Password must contain at least one number")
        if not re.search(r'[!@#$%^&*(),.?":{}|<>]', password):
            raise ValueError("Password must contain at least one special character")
        
        # Check for sequential patterns
        if re.search(r'(abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz|012|123|234|345|456|567|678|789)', password.lower()):
            raise ValueError("Password cannot contain sequential patterns")
        
        # Check for repeated characters
        if re.search(r'(.)\1{2,}', password):
            raise ValueError("Password cannot contain more than 2 repeated characters in a row")
        
        return v
    
    @model_validator(mode='after')
    def validate_passwords_match(self):
        """Ensure new_password and confirm_password match."""
        if self.new_password and self.confirm_password:
            if self.new_password.get_secret_value() != self.confirm_password.get_secret_value():
                raise ValueError("Passwords do not match")
        
        return self


class EmailVerificationDTO(BaseModel):
    """Schema for email verification requests."""
    
    token: str = Field(
        ...,
        min_length=32,
        description="Email verification token"
    )


class PasswordChangeDTO(BaseModel):
    """Schema for authenticated password change requests."""
    
    current_password: SecretStr = Field(
        ...,
        description="Current password"
    )
    new_password: SecretStr = Field(
        ...,
        min_length=12,
        max_length=128,
        description="New password"
    )
    confirm_password: SecretStr = Field(
        ...,
        description="Password confirmation"
    )
    
    @field_validator('new_password')
    @classmethod
    def validate_password_strength(cls, v):
        """Validate password meets security requirements."""
        password = v.get_secret_value()
        
        # Check for required character types
        if not re.search(r'[A-Z]', password):
            raise ValueError("Password must contain at least one uppercase letter")
        if not re.search(r'[a-z]', password):
            raise ValueError("Password must contain at least one lowercase letter")
        if not re.search(r'[0-9]', password):
            raise ValueError("Password must contain at least one number")
        if not re.search(r'[!@#$%^&*(),.?":{}|<>]', password):
            raise ValueError("Password must contain at least one special character")
        
        # Check for sequential patterns
        if re.search(r'(abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz|012|123|234|345|456|567|678|789)', password.lower()):
            raise ValueError("Password cannot contain sequential patterns")
        
        # Check for repeated characters
        if re.search(r'(.)\1{2,}', password):
            raise ValueError("Password cannot contain more than 2 repeated characters in a row")
        
        return v
    
    @model_validator(mode='after')
    def validate_passwords_match(self):
        """Ensure new_password and confirm_password match."""
        if self.new_password and self.confirm_password:
            if self.new_password.get_secret_value() != self.confirm_password.get_secret_value():
                raise ValueError("Passwords do not match")
        
        return self
    
    @model_validator(mode='after')
    def validate_passwords_different(self):
        """Ensure new password is different from current password."""
        if self.current_password and self.new_password:
            if self.current_password.get_secret_value() == self.new_password.get_secret_value():
                raise ValueError("New password must be different from current password")
        
        return self


class RefreshTokenDTO(BaseModel):
    """Schema for token refresh requests."""
    
    refresh_token: str = Field(
        ...,
        description="Valid refresh token"
    )


class LogoutDTO(BaseModel):
    """Schema for logout requests."""
    
    refresh_token: Optional[str] = Field(
        None,
        description="Refresh token to invalidate (optional)"
    )
    all_sessions: bool = Field(
        default=False,
        description="Whether to logout from all sessions"
    )


class SessionResponseDTO(BaseModel):
    """Schema for session information response."""
    
    id: UUID = Field(
        ...,
        description="Session ID"
    )
    device_name: str = Field(
        ...,
        description="Device name extracted from User-Agent"
    )
    device_type: str = Field(
        ...,
        description="Device type (desktop, mobile, tablet)"
    )
    browser: str = Field(
        ...,
        description="Browser name and version"
    )
    os: str = Field(
        ...,
        description="Operating system"
    )
    ip_address: Optional[str] = Field(
        None,
        description="IP address of the session"
    )
    location: Optional[str] = Field(
        None,
        description="Approximate location (city, country)"
    )
    created_at: datetime = Field(
        ...,
        description="When the session was created"
    )
    last_accessed: datetime = Field(
        ...,
        description="Last activity timestamp"
    )
    expires_at: datetime = Field(
        ...,
        description="When the session expires"
    )
    is_current: bool = Field(
        default=False,
        description="Whether this is the current session"
    )
    
    class Config:
        from_attributes = True


class SessionListResponseDTO(BaseModel):
    """Schema for list of sessions response."""
    
    sessions: List[SessionResponseDTO] = Field(
        ...,
        description="List of active sessions"
    )
    total: int = Field(
        ...,
        description="Total number of active sessions"
    )
    max_allowed: int = Field(
        ...,
        description="Maximum allowed sessions per user"
    )


class SessionCountResponseDTO(BaseModel):
    """Schema for session count response."""
    
    active_sessions: int = Field(
        ...,
        description="Number of active sessions"
    )
    max_allowed: int = Field(
        ...,
        description="Maximum allowed sessions per user"
    )
    is_admin: bool = Field(
        default=False,
        description="Whether user has unlimited sessions"
    )