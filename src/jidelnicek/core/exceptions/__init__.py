"""
Core exceptions for Jidelnicek 2.0.

This module defines base exceptions that can be used across all modules.
"""

from typing import Optional, Any
from uuid import UUID


class JidelnicekError(Exception):
    """Base exception for all Jidelnicek errors."""
    pass


class NotFoundError(JidelnicekError):
    """Raised when a resource cannot be found."""
    
    def __init__(self, message: str = "Resource not found"):
        super().__init__(message)


class PermissionError(JidelnicekError):
    """Raised when user lacks permission for an operation."""
    
    def __init__(self, message: str = "Permission denied"):
        super().__init__(message)


class PermissionDeniedError(PermissionError):
    """Alias for PermissionError for backward compatibility."""
    pass


class ValidationError(JidelnicekError):
    """Raised when data validation fails."""
    
    def __init__(self, message: str, field: Optional[str] = None):
        self.field = field
        super().__init__(message)


class ConflictError(JidelnicekError):
    """Raised when an operation conflicts with existing data."""
    
    def __init__(self, message: str):
        super().__init__(message)


class BusinessLogicError(JidelnicekError):
    """Raised when business logic validation fails."""
    
    def __init__(self, message: str):
        super().__init__(message)


class AuthenticationError(JidelnicekError):
    """Raised when authentication fails."""
    
    def __init__(self, message: str = "Authentication failed"):
        super().__init__(message)


class ConfigurationError(JidelnicekError):
    """Raised when configuration is invalid."""
    
    def __init__(self, message: str):
        super().__init__(message)


class ExternalServiceError(JidelnicekError):
    """Raised when an external service fails."""
    
    def __init__(self, service: str, message: str):
        self.service = service
        super().__init__(f"{service} error: {message}")


class RateLimitError(JidelnicekError):
    """Raised when rate limit is exceeded."""
    
    def __init__(self, retry_after: Optional[int] = None):
        self.retry_after = retry_after
        message = "Rate limit exceeded"
        if retry_after:
            message += f". Retry after {retry_after} seconds"
        super().__init__(message)


class PermissionValidationError(JidelnicekError):
    """Raised when permission validation fails."""
    
    def __init__(self, message: str = "Permission validation failed"):
        super().__init__(message)


# Security-specific exceptions for admin module

class SecurityException(JidelnicekError):
    """Base exception for security violations."""
    pass


class SessionExpiredException(SecurityException):
    """Raised when a session has expired."""
    
    def __init__(self, message: str = "Session has expired"):
        super().__init__(message)


class ConcurrentSessionLimitException(SecurityException):
    """Raised when concurrent session limit is exceeded."""
    
    def __init__(self, message: str = "Maximum concurrent sessions exceeded"):
        super().__init__(message)


class TwoFactorRequiredException(SecurityException):
    """Raised when two-factor authentication is required."""
    
    def __init__(self, message: str = "Two-factor authentication required"):
        super().__init__(message)


class InvalidCodeException(SecurityException):
    """Raised when verification code is invalid."""
    
    def __init__(self, message: str = "Invalid verification code"):
        super().__init__(message)


class IPBlockedException(SecurityException):
    """Raised when IP address is blocked."""
    
    def __init__(self, message: str = "IP address is blocked"):
        super().__init__(message)


class UnauthorizedLocationException(SecurityException):
    """Raised when access from location is unauthorized."""
    
    def __init__(self, message: str = "Access from this location is not allowed"):
        super().__init__(message)