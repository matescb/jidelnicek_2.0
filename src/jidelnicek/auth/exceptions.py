"""
Authentication exceptions for Jidelnicek 2.0.

This module defines custom exception classes for authentication-related errors
with proper error codes and user-friendly messages.
"""

from typing import Optional, Dict, Any


class AuthException(Exception):
    """Base exception for all authentication errors."""
    
    def __init__(
        self,
        message: str,
        error_code: str,
        status_code: int = 400,
        details: Optional[Dict[str, Any]] = None
    ):
        self.message = message
        self.error_code = error_code
        self.status_code = status_code
        self.details = details or {}
        super().__init__(self.message)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert exception to dictionary for API responses."""
        result = {
            "error": self.error_code,
            "message": self.message
        }
        if self.details:
            result["details"] = self.details
        return result


class InvalidCredentialsError(AuthException):
    """Raised when login credentials are invalid."""
    
    def __init__(self, message: str = "Invalid email or password"):
        super().__init__(
            message=message,
            error_code="AUTH_INVALID_CREDENTIALS",
            status_code=401
        )


class AccountLockedError(AuthException):
    """Raised when account is locked due to failed login attempts."""
    
    def __init__(self, locked_until: str, attempts: int):
        super().__init__(
            message=f"Account locked due to {attempts} failed login attempts. Try again after {locked_until}",
            error_code="AUTH_ACCOUNT_LOCKED",
            status_code=423,
            details={
                "locked_until": locked_until,
                "failed_attempts": attempts
            }
        )


class AccountInactiveError(AuthException):
    """Raised when account is deactivated."""
    
    def __init__(self):
        super().__init__(
            message="Account has been deactivated. Please contact support",
            error_code="AUTH_ACCOUNT_INACTIVE",
            status_code=403
        )


class EmailNotVerifiedError(AuthException):
    """Raised when email is not verified for operations that require it."""
    
    def __init__(self):
        super().__init__(
            message="Email address not verified. Please check your email for verification link",
            error_code="AUTH_EMAIL_NOT_VERIFIED",
            status_code=403
        )


class EmailAlreadyExistsError(AuthException):
    """Raised when attempting to register with an existing email."""
    
    def __init__(self, email: str):
        super().__init__(
            message=f"Email address '{email}' is already registered",
            error_code="AUTH_EMAIL_EXISTS",
            status_code=409,
            details={"email": email}
        )


class TokenExpiredError(AuthException):
    """Raised when a token has expired."""
    
    def __init__(self, token_type: str = "token"):
        super().__init__(
            message=f"The {token_type} has expired",
            error_code="AUTH_TOKEN_EXPIRED",
            status_code=401,
            details={"token_type": token_type}
        )


class TokenInvalidError(AuthException):
    """Raised when a token is invalid or malformed."""
    
    def __init__(self, token_type: str = "token"):
        super().__init__(
            message=f"Invalid {token_type}",
            error_code="AUTH_TOKEN_INVALID",
            status_code=401,
            details={"token_type": token_type}
        )


class TokenAlreadyUsedError(AuthException):
    """Raised when attempting to use a single-use token that was already used."""
    
    def __init__(self, token_type: str = "token"):
        super().__init__(
            message=f"This {token_type} has already been used",
            error_code="AUTH_TOKEN_USED",
            status_code=400,
            details={"token_type": token_type}
        )


class SessionExpiredError(AuthException):
    """Raised when a session has expired."""
    
    def __init__(self):
        super().__init__(
            message="Session has expired. Please login again",
            error_code="AUTH_SESSION_EXPIRED",
            status_code=401
        )


class SessionInvalidError(AuthException):
    """Raised when a session is invalid or not found."""
    
    def __init__(self):
        super().__init__(
            message="Invalid session. Please login again",
            error_code="AUTH_SESSION_INVALID",
            status_code=401
        )


class PasswordValidationError(AuthException):
    """Raised when password doesn't meet requirements."""
    
    def __init__(self, errors: list[str]):
        super().__init__(
            message="Password does not meet security requirements",
            error_code="AUTH_PASSWORD_INVALID",
            status_code=400,
            details={"validation_errors": errors}
        )


class PasswordResetRequiredError(AuthException):
    """Raised when a password reset is required."""
    
    def __init__(self):
        super().__init__(
            message="Password reset required. Please check your email",
            error_code="AUTH_PASSWORD_RESET_REQUIRED",
            status_code=403
        )


class UnauthorizedError(AuthException):
    """Raised for general authorization failures."""
    
    def __init__(self, message: str = "Unauthorized access"):
        super().__init__(
            message=message,
            error_code="AUTH_UNAUTHORIZED",
            status_code=401
        )


class PermissionDeniedError(AuthException):
    """Raised when user lacks required permissions."""
    
    def __init__(self, required_permission: Optional[str] = None):
        message = "You don't have permission to perform this action"
        details = {}
        if required_permission:
            message = f"This action requires '{required_permission}' permission"
            details["required_permission"] = required_permission
            
        super().__init__(
            message=message,
            error_code="AUTH_PERMISSION_DENIED",
            status_code=403,
            details=details
        )


class RateLimitExceededError(AuthException):
    """Raised when rate limit is exceeded."""
    
    def __init__(self, retry_after: int, limit_type: str = "requests"):
        super().__init__(
            message=f"Rate limit exceeded for {limit_type}. Try again in {retry_after} seconds",
            error_code="AUTH_RATE_LIMIT_EXCEEDED",
            status_code=429,
            details={
                "retry_after": retry_after,
                "limit_type": limit_type
            }
        )


class UserNotFoundError(AuthException):
    """Raised when a user is not found."""
    
    def __init__(self, identifier: str = "user"):
        super().__init__(
            message=f"User not found: {identifier}",
            error_code="AUTH_USER_NOT_FOUND",
            status_code=404,
            details={"identifier": identifier}
        )


class InvalidPasswordError(AuthException):
    """Raised when current password is incorrect during password change."""
    
    def __init__(self):
        super().__init__(
            message="Current password is incorrect",
            error_code="AUTH_INVALID_PASSWORD",
            status_code=400
        )


class RecoveryError(AuthException):
    """Raised when account recovery fails."""
    
    def __init__(self, message: str = "Account recovery failed"):
        super().__init__(
            message=message,
            error_code="AUTH_RECOVERY_FAILED",
            status_code=400
        )