"""Authentication module for Jidelnicek 2.0."""

from .models import (
    AuthUser,
    AuthSession,
    AuthToken,
    AuthPasswordResetToken,
    AuthEmailVerificationToken,
    AuditLog
)

from .schemas import (
    UserCreateDTO,
    UserLoginDTO,
    UserUpdateDTO,
    UserResponseDTO,
    TokenResponseDTO,
    SessionResponseDTO,
    PasswordResetRequestDTO,
    PasswordResetConfirmDTO,
    EmailVerificationDTO,
    PasswordChangeDTO,
    RefreshTokenDTO,
    LogoutDTO
)

from .exceptions import (
    AuthException,
    InvalidCredentialsError,
    AccountLockedError,
    AccountInactiveError,
    EmailNotVerifiedError,
    EmailAlreadyExistsError,
    TokenExpiredError,
    TokenInvalidError,
    TokenAlreadyUsedError,
    SessionExpiredError,
    SessionInvalidError,
    PasswordValidationError,
    PasswordResetRequiredError,
    UnauthorizedError,
    PermissionDeniedError,
    RateLimitExceededError,
    UserNotFoundError,
    InvalidPasswordError,
    RecoveryError
)

from .services import UserService

from .utils import (
    PasswordHasher,
    PasswordValidator
)

__all__ = [
    # Models
    'AuthUser',
    'AuthSession',
    'AuthToken',
    'AuthPasswordResetToken',
    'AuthEmailVerificationToken',
    'AuditLog',
    
    # Schemas/DTOs
    'UserCreateDTO',
    'UserLoginDTO',
    'UserUpdateDTO',
    'UserResponseDTO',
    'TokenResponseDTO',
    'SessionResponseDTO',
    'PasswordResetRequestDTO',
    'PasswordResetConfirmDTO',
    'EmailVerificationDTO',
    'PasswordChangeDTO',
    'RefreshTokenDTO',
    'LogoutDTO',
    
    # Exceptions
    'AuthException',
    'InvalidCredentialsError',
    'AccountLockedError',
    'AccountInactiveError',
    'EmailNotVerifiedError',
    'EmailAlreadyExistsError',
    'TokenExpiredError',
    'TokenInvalidError',
    'TokenAlreadyUsedError',
    'SessionExpiredError',
    'SessionInvalidError',
    'PasswordValidationError',
    'PasswordResetRequiredError',
    'UnauthorizedError',
    'PermissionDeniedError',
    'RateLimitExceededError',
    'UserNotFoundError',
    'InvalidPasswordError',
    'RecoveryError',
    
    # Services
    'UserService',
    
    # Utils
    'PasswordHasher',
    'PasswordValidator'
]