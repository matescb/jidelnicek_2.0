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


class ValidationError(JidelnicekError):
    """Raised when data validation fails."""
    
    def __init__(self, message: str, field: Optional[str] = None):
        self.field = field
        super().__init__(message)


class ConflictError(JidelnicekError):
    """Raised when an operation conflicts with existing data."""
    
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