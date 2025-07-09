"""
Authentication router for Jidelnicek 2.0.

This module provides API endpoints for user authentication including:
- User registration with email verification
- Login/logout functionality
- Password reset and recovery
- Token refresh
"""

import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import UUID
import logging

from fastapi import APIRouter, Depends, HTTPException, status, Request, BackgroundTasks
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy import select, and_
from pydantic import EmailStr

from jidelnicek.core.config import settings
from jidelnicek.core.dependencies import get_db, get_redis_client
from jidelnicek.auth.schemas import (
    UserCreateDTO,
    UserResponseDTO,
    UserLoginDTO,
    TokenResponseDTO,
    PasswordResetRequestDTO,
    PasswordResetConfirmDTO,
    EmailVerificationDTO,
    RefreshTokenDTO,
    LogoutDTO,
    SessionResponseDTO,
    SessionListResponseDTO,
    SessionCountResponseDTO,
)
from jidelnicek.auth.services.user_service import UserService
from jidelnicek.auth.services.email_service import EmailService
from jidelnicek.auth.services.token_service import TokenService
from jidelnicek.auth.services.captcha_service import CaptchaService
from jidelnicek.auth.models import AuthUser, AuthEmailVerificationToken, AuthSession
from jidelnicek.auth.exceptions import (
    EmailAlreadyExistsError,
    UserNotFoundError,
    InvalidCredentialsError,
    AccountInactiveError,
    AccountLockedError,
    SessionInvalidError,
    SessionExpiredError,
)
from jidelnicek.auth.dependencies.rate_limit import RateLimitDep, RateLimitExceeded
from jidelnicek.auth.dependencies.auth import CurrentUser, CurrentUserOptional

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auth", tags=["authentication"])


@router.get(
    "/captcha/challenge",
    response_model=dict,
    summary="Get CAPTCHA challenge",
    description="Generate a new CAPTCHA challenge when required"
)
async def get_captcha_challenge(
    request: Request,
    redis_client = Depends(get_redis_client)
) -> dict:
    """
    Generate a CAPTCHA challenge.
    
    This endpoint creates a new CAPTCHA challenge that can be used
    for login, registration, or other security-sensitive operations.
    """
    captcha_service = CaptchaService(redis_client)
    
    try:
        challenge = await captcha_service.generate_challenge()
        
        logger.info(
            f"CAPTCHA challenge generated: {challenge['challenge_id']} "
            f"for IP: {request.client.host if request.client else 'unknown'}"
        )
        
        return challenge
        
    except Exception as e:
        logger.error(f"CAPTCHA generation error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate CAPTCHA challenge"
        )


@router.post(
    "/register",
    response_model=UserResponseDTO,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new user",
    description="Create a new user account with email verification"
)
async def register(
    user_data: UserCreateDTO,
    background_tasks: BackgroundTasks,
    request: Request,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(RateLimitDep(key_prefix="register", max_attempts=5, window_hours=1))
) -> UserResponseDTO:
    """
    Register a new user account.
    
    This endpoint:
    - Validates the registration data
    - Checks for duplicate emails
    - Creates the user account
    - Generates an email verification token
    - Sends a verification email (in background)
    
    Rate limited to 5 registration attempts per hour per IP.
    """
    user_service = UserService(db)
    email_service = EmailService()
    
    try:
        # Create the user
        user = await user_service.create_user(user_data)
        
        # Generate email verification token
        verification_token = secrets.token_urlsafe(32)
        expires_at = datetime.now(timezone.utc) + timedelta(hours=24)
        
        # Create verification token record
        email_verification = AuthEmailVerificationToken(
            user_id=user.id,
            token=verification_token,
            expires_at=expires_at
        )
        db.add(email_verification)
        await db.commit()
        
        # Get client IP for logging
        client_ip = request.client.host if request.client else "unknown"
        
        # Send verification email in background
        background_tasks.add_task(
            email_service.send_verification_email,
            user.email,
            verification_token,
            user.language
        )
        
        logger.info(
            f"New user registered: {user.email} from IP: {client_ip}"
        )
        
        # Return user response
        return user_service.to_response_dto(user)
        
    except EmailAlreadyExistsError:
        logger.warning(f"Registration attempt with existing email: {user_data.email}")
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email address is already registered"
        )
    except Exception as e:
        logger.error(f"Registration error: {str(e)}")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred during registration"
        )


@router.post(
    "/login",
    response_model=TokenResponseDTO,
    summary="Login user",
    description="Authenticate user and receive access tokens"
)
async def login(
    credentials: UserLoginDTO,
    request: Request,
    db: AsyncSession = Depends(get_db),
    redis_client = Depends(get_redis_client),
    _: None = Depends(RateLimitDep(key_prefix="login_ip", max_attempts=5, window_hours=1))
) -> TokenResponseDTO:
    """
    Authenticate user and issue JWT tokens.
    
    This endpoint:
    - Validates credentials
    - Checks account status (active, locked, verified)
    - Issues access and refresh tokens
    - Creates a session record
    - Updates last login timestamp
    
    Rate limited to 5 login attempts per hour per IP.
    Additional rate limiting of 10 attempts per hour per account.
    """
    import asyncio
    from jidelnicek.auth.models import AuditLog
    from jidelnicek.auth.utils.password import PasswordHasher
    
    user_service = UserService(db)
    token_service = TokenService(db, redis_client)
    captcha_service = CaptchaService(redis_client)
    
    # Get client info for logging
    client_ip = request.client.host if request.client else "unknown"
    user_agent = request.headers.get("User-Agent", "unknown")
    
    try:
        # Retrieve user by email (case-insensitive)
        user = await user_service.get_user_by_email(credentials.email)
        
        if not user:
            # Log failed login attempt (user not found)
            audit_log = AuditLog(
                action=AuditLog.LOGIN_FAILED,
                entity_type="user",
                entity_id=UUID("00000000-0000-0000-0000-000000000000"),
                ip_address=client_ip,
                user_agent=user_agent,
                changes={"reason": "user_not_found", "email": credentials.email}
            )
            db.add(audit_log)
            await db.commit()
            
            # Sleep to prevent timing attacks
            await asyncio.sleep(0.5)
            
            # Record failed attempt for CAPTCHA tracking
            await captcha_service.record_failed_attempt(client_ip, "login")
            
            raise InvalidCredentialsError()
        
        # Check per-account rate limit (10 attempts per hour)
        account_rate_limiter = RateLimitDep(
            key_prefix="login_account",
            max_attempts=10,
            window_hours=1,
            get_identifier=lambda req: credentials.email.lower()
        )
        try:
            await account_rate_limiter(request, redis_client)
        except RateLimitExceeded:
            # Log rate limit exceeded for account
            audit_log = AuditLog(
                user_id=user.id,
                action=AuditLog.LOGIN_FAILED,
                entity_type="user",
                entity_id=user.id,
                ip_address=client_ip,
                user_agent=user_agent,
                changes={"reason": "account_rate_limit_exceeded"}
            )
            db.add(audit_log)
            await db.commit()
            raise
        
        # Check if CAPTCHA is required
        captcha_required = await captcha_service.should_require_captcha(
            client_ip, "login"
        )
        
        # Also check if user has too many failed attempts
        if user and user.failed_login_attempts >= 3:
            captcha_required = True
        
        if captcha_required:
            # Verify CAPTCHA if provided
            if not credentials.captcha_challenge_id or not credentials.captcha_response:
                # Record failed attempt for CAPTCHA tracking
                await captcha_service.record_failed_attempt(client_ip, "login")
                
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail={
                        "error": "captcha_required",
                        "message": "CAPTCHA verification is required due to multiple failed attempts"
                    }
                )
            
            # Verify CAPTCHA response
            captcha_valid = await captcha_service.verify_response(
                credentials.captcha_challenge_id,
                credentials.captcha_response,
                client_ip
            )
            
            if not captcha_valid:
                # Log failed CAPTCHA attempt
                audit_log = AuditLog(
                    user_id=user.id if user else None,
                    action="captcha_failed",
                    entity_type="login",
                    entity_id=user.id if user else UUID("00000000-0000-0000-0000-000000000000"),
                    ip_address=client_ip,
                    user_agent=user_agent,
                    changes={"email": credentials.email}
                )
                db.add(audit_log)
                await db.commit()
                
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid CAPTCHA response"
                )
        
        # Check if account is locked
        if user.is_locked:
            # Log locked account login attempt
            audit_log = AuditLog(
                user_id=user.id,
                action=AuditLog.LOGIN_FAILED,
                entity_type="user",
                entity_id=user.id,
                ip_address=client_ip,
                user_agent=user_agent,
                changes={"reason": "account_locked"}
            )
            db.add(audit_log)
            await db.commit()
            
            raise AccountLockedError()
        
        # Check if account is active
        if not user.is_active:
            # Log inactive account login attempt
            audit_log = AuditLog(
                user_id=user.id,
                action=AuditLog.LOGIN_FAILED,
                entity_type="user",
                entity_id=user.id,
                ip_address=client_ip,
                user_agent=user_agent,
                changes={"reason": "account_inactive"}
            )
            db.add(audit_log)
            await db.commit()
            
            raise AccountInactiveError()
        
        # Apply progressive delay based on failed attempts
        if user.failed_login_attempts > 0:
            delay_seconds = 0
            if user.failed_login_attempts >= 3:
                delay_seconds = 5
            if user.failed_login_attempts >= 4:
                delay_seconds = 15
            if user.failed_login_attempts >= 5:
                delay_seconds = 30
            
            if delay_seconds > 0:
                logger.info(
                    f"Applying {delay_seconds}s delay for user {user.email} "
                    f"with {user.failed_login_attempts} failed attempts"
                )
                await asyncio.sleep(delay_seconds)
        
        # Verify password
        if not PasswordHasher.verify_password(
            credentials.password.get_secret_value(),
            user.password_hash
        ):
            # Increment failed login attempts
            failed_attempts = await user_service.increment_failed_login_attempts(user)
            
            # Lock account after 5 failed attempts
            if failed_attempts >= 5:
                lock_until = datetime.now(timezone.utc) + timedelta(hours=1)
                await user_service.lock_user_account(user, lock_until)
                
                # Log account lockout
                audit_log = AuditLog(
                    user_id=user.id,
                    action=AuditLog.ACCOUNT_LOCKED,
                    entity_type="user",
                    entity_id=user.id,
                    ip_address=client_ip,
                    user_agent=user_agent,
                    changes={"locked_until": lock_until.isoformat()}
                )
                db.add(audit_log)
                await db.commit()
                
                raise AccountLockedError()
            
            # Log failed login attempt
            audit_log = AuditLog(
                user_id=user.id,
                action=AuditLog.LOGIN_FAILED,
                entity_type="user",
                entity_id=user.id,
                ip_address=client_ip,
                user_agent=user_agent,
                changes={"reason": "invalid_password", "failed_attempts": failed_attempts}
            )
            db.add(audit_log)
            await db.commit()
            
            # Record failed attempt for CAPTCHA tracking
            await captcha_service.record_failed_attempt(client_ip, "login")
            
            raise InvalidCredentialsError()
        
        # Password is correct - reset failed login attempts
        await user_service.reset_failed_login_attempts(user)
        
        # Clear CAPTCHA failed attempts for this IP
        await captcha_service.clear_failed_attempts(client_ip, "login")
        
        # Check concurrent session limit
        is_admin = user.role == "admin"
        if not await token_service.check_session_limit(user.id, is_admin):
            # Revoke oldest session to make room
            revoked_session_id = await token_service.revoke_oldest_session(user.id)
            
            # Log session limit enforcement
            audit_log = AuditLog(
                user_id=user.id,
                action="session_limit_enforced",
                entity_type="session",
                entity_id=revoked_session_id or UUID("00000000-0000-0000-0000-000000000000"),
                ip_address=client_ip,
                user_agent=user_agent,
                changes={
                    "max_sessions": settings.max_sessions_per_user,
                    "oldest_session_revoked": str(revoked_session_id) if revoked_session_id else None
                }
            )
            db.add(audit_log)
            await db.commit()
            
            logger.info(
                f"Session limit enforced for user {user.email}. "
                f"Revoked oldest session: {revoked_session_id}"
            )
        
        # Generate tokens
        access_token, access_expires = token_service.generate_access_token(user)
        refresh_token, refresh_expires = token_service.generate_refresh_token(user)
        
        # Create session record with enhanced metadata
        from jidelnicek.auth.utils.user_agent import parse_user_agent
        
        # Parse user agent for device info
        device_info = parse_user_agent(user_agent)
        
        # Store device info in session metadata
        session = await token_service.create_session(
            user=user,
            refresh_token=refresh_token,
            expires_at=refresh_expires,
            ip_address=client_ip,
            user_agent=user_agent
        )
        
        # Update last login timestamp
        await user_service.update_last_login(user.id)
        
        # Log successful login
        audit_log = AuditLog(
            user_id=user.id,
            action=AuditLog.LOGIN_SUCCESS,
            entity_type="user",
            entity_id=user.id,
            ip_address=client_ip,
            user_agent=user_agent,
            changes={"session_id": str(session.id)}
        )
        db.add(audit_log)
        await db.commit()
        
        logger.info(
            f"User {user.email} successfully logged in from IP: {client_ip}"
        )
        
        # Return tokens and user data
        return TokenResponseDTO(
            access_token=access_token,
            refresh_token=refresh_token,
            token_type="Bearer",
            expires_in=token_service.get_token_expiry_seconds(),
            user=user_service.to_response_dto(user)
        )
        
    except (InvalidCredentialsError, AccountLockedError, AccountInactiveError):
        raise
    except Exception as e:
        logger.error(f"Login error: {str(e)}")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred during login"
        )


@router.get(
    "/verify-email",
    response_model=dict,
    summary="Verify email address",
    description="Verify user's email address using verification token"
)
async def verify_email(
    token: str,
    request: Request,
    db: AsyncSession = Depends(get_db)
) -> dict:
    """
    Verify user's email address.
    
    This endpoint:
    - Validates the verification token
    - Marks the email as verified
    - Marks the token as used
    - Returns success status
    """
    from sqlalchemy import and_
    
    try:
        # Find the verification token
        result = await db.execute(
            select(AuthEmailVerificationToken)
            .where(AuthEmailVerificationToken.token == token)
            .options(selectinload(AuthEmailVerificationToken.user))
        )
        verification_token = result.scalar_one_or_none()
        
        if not verification_token:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Invalid verification token"
            )
        
        # Check if token is already used
        if verification_token.is_used:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Verification token has already been used"
            )
        
        # Check if token is expired
        if verification_token.is_expired:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Verification token has expired. Please request a new verification email."
            )
        
        # Get the user
        user = verification_token.user
        
        # Check if email is already verified
        if user.email_verified:
            # Mark token as used anyway
            verification_token.used_at = datetime.now(timezone.utc)
            await db.commit()
            
            return {
                "status": "success",
                "message": "Email is already verified"
            }
        
        # Mark email as verified
        user.email_verified = True
        user.email_verified_at = datetime.now(timezone.utc)
        
        # Mark token as used
        verification_token.used_at = datetime.now(timezone.utc)
        
        # Log the verification
        client_ip = request.client.host if request.client else "unknown"
        user_agent = request.headers.get("User-Agent", "unknown")
        
        audit_log = AuditLog(
            user_id=user.id,
            action=AuditLog.EMAIL_VERIFIED,
            entity_type="user",
            entity_id=user.id,
            ip_address=client_ip,
            user_agent=user_agent,
            changes={"email": user.email}
        )
        db.add(audit_log)
        
        # Commit all changes
        await db.commit()
        
        logger.info(f"Email verified for user: {user.email}")
        
        return {
            "status": "success",
            "message": "Email verified successfully",
            "email": user.email
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Email verification error: {str(e)}")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred during email verification"
        )


@router.post(
    "/resend-verification",
    response_model=dict,
    summary="Resend verification email",
    description="Request a new email verification token"
)
async def resend_verification_email(
    email: EmailStr,
    background_tasks: BackgroundTasks,
    request: Request,
    db: AsyncSession = Depends(get_db),
    redis_client = Depends(get_redis_client),
    _: None = Depends(RateLimitDep(key_prefix="resend_verification", max_attempts=3, window_hours=1))
) -> dict:
    """
    Resend email verification.
    
    This endpoint:
    - Validates the email exists
    - Checks if already verified
    - Generates a new verification token
    - Invalidates old tokens
    - Sends new verification email
    
    Rate limited to 3 requests per hour per IP.
    """
    user_service = UserService(db)
    email_service = EmailService()
    
    try:
        # Normalize email
        email = email.lower()
        
        # Find user by email
        user = await user_service.get_user_by_email(email)
        
        if not user:
            # Don't reveal if email exists or not
            return {
                "status": "success",
                "message": "If the email exists in our system, a verification email has been sent"
            }
        
        # Check if already verified
        if user.email_verified:
            return {
                "status": "success",
                "message": "Email is already verified"
            }
        
        # Apply per-email rate limit (3 resends per hour)
        email_rate_key = f"resend_verification_email:{email}"
        if redis_client:
            current_count = await redis_client.get(email_rate_key)
            if current_count and int(current_count) >= 3:
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Too many verification email requests. Please try again later."
                )
            
            # Increment counter with 1 hour expiry
            await redis_client.incr(email_rate_key)
            await redis_client.expire(email_rate_key, 3600)
        
        # Invalidate any existing unused tokens
        result = await db.execute(
            select(AuthEmailVerificationToken)
            .where(
                and_(
                    AuthEmailVerificationToken.user_id == user.id,
                    AuthEmailVerificationToken.used_at.is_(None)
                )
            )
        )
        old_tokens = result.scalars().all()
        
        for old_token in old_tokens:
            old_token.used_at = datetime.now(timezone.utc)
        
        # Generate new verification token
        verification_token = secrets.token_urlsafe(32)
        expires_at = datetime.now(timezone.utc) + timedelta(hours=24)
        
        # Create new verification token record
        email_verification = AuthEmailVerificationToken(
            user_id=user.id,
            token=verification_token,
            expires_at=expires_at
        )
        db.add(email_verification)
        
        # Log the resend request
        client_ip = request.client.host if request.client else "unknown"
        audit_log = AuditLog(
            user_id=user.id,
            action="email_verification_resent",
            entity_type="user",
            entity_id=user.id,
            ip_address=client_ip,
            changes={"email": user.email}
        )
        db.add(audit_log)
        
        await db.commit()
        
        # Send verification email in background
        background_tasks.add_task(
            email_service.send_verification_email,
            user.email,
            verification_token,
            user.language
        )
        
        logger.info(f"Verification email resent to: {user.email}")
        
        return {
            "status": "success",
            "message": "If the email exists in our system, a verification email has been sent"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Resend verification error: {str(e)}")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while resending verification email"
        )


@router.post(
    "/forgot-password",
    response_model=dict,
    summary="Request password reset",
    description="Request a password reset email"
)
async def request_password_reset(
    reset_data: PasswordResetRequestDTO,
    background_tasks: BackgroundTasks,
    request: Request,
    db: AsyncSession = Depends(get_db),
    redis_client = Depends(get_redis_client),
    _: None = Depends(RateLimitDep(key_prefix="password_reset", max_attempts=3, window_hours=1))
) -> dict:
    """
    Request password reset.
    
    This endpoint:
    - Validates the email
    - Generates a password reset token
    - Sends reset instructions via email
    - Returns success even if email doesn't exist (security)
    
    Rate limited to 3 requests per hour per IP.
    Additional rate limiting of 3 requests per hour per email.
    """
    import asyncio
    from uuid import uuid4
    from jidelnicek.auth.models import AuditLog, AuthPasswordResetToken
    
    user_service = UserService(db)
    email_service = EmailService()
    
    # Get client info for logging
    client_ip = request.client.host if request.client else "unknown"
    user_agent = request.headers.get("User-Agent", "unknown")
    
    try:
        # Normalize email
        email = reset_data.email.lower()
        
        # Apply per-email rate limit (3 requests per hour)
        email_rate_key = f"password_reset_email:{email}"
        if redis_client:
            current_count = await redis_client.get(email_rate_key)
            if current_count and int(current_count) >= 3:
                # Don't reveal rate limiting for specific email
                # Just act as if we sent the email
                return {
                    "status": "success",
                    "message": "If the email exists in our system, a password reset link has been sent"
                }
            
            # Increment counter with 1 hour expiry
            await redis_client.incr(email_rate_key)
            await redis_client.expire(email_rate_key, 3600)
        
        # Find user by email
        user = await user_service.get_user_by_email(email)
        
        if user:
            # User exists - create reset token
            # Invalidate any existing unused tokens
            result = await db.execute(
                select(AuthPasswordResetToken)
                .where(
                    and_(
                        AuthPasswordResetToken.user_id == user.id,
                        AuthPasswordResetToken.used_at.is_(None)
                    )
                )
            )
            old_tokens = result.scalars().all()
            
            for old_token in old_tokens:
                old_token.used_at = datetime.now(timezone.utc)
            
            # Generate new reset token (UUID for security)
            reset_token = str(uuid4())
            expires_at = datetime.now(timezone.utc) + timedelta(hours=1)
            
            # Create reset token record
            password_reset = AuthPasswordResetToken(
                user_id=user.id,
                token=reset_token,
                expires_at=expires_at,
                request_ip=client_ip
            )
            db.add(password_reset)
            
            # Log the password reset request
            audit_log = AuditLog(
                user_id=user.id,
                action=AuditLog.PASSWORD_RESET_REQUEST,
                entity_type="user",
                entity_id=user.id,
                ip_address=client_ip,
                user_agent=user_agent,
                changes={"email": user.email}
            )
            db.add(audit_log)
            
            await db.commit()
            
            # Send password reset email in background
            background_tasks.add_task(
                email_service.send_password_reset_email,
                user.email,
                reset_token,
                user.language
            )
            
            logger.info(f"Password reset requested for: {user.email} from IP: {client_ip}")
        else:
            # User doesn't exist - simulate processing time to prevent timing attacks
            await asyncio.sleep(0.2)
            
            # Log failed attempt (for security monitoring)
            logger.warning(f"Password reset requested for non-existent email: {email} from IP: {client_ip}")
        
        # Always return same response (don't reveal if email exists)
        return {
            "status": "success",
            "message": "If the email exists in our system, a password reset link has been sent"
        }
        
    except Exception as e:
        logger.error(f"Password reset request error: {str(e)}")
        await db.rollback()
        # Even on error, return generic message for security
        return {
            "status": "success",
            "message": "If the email exists in our system, a password reset link has been sent"
        }


@router.post(
    "/reset-password",
    response_model=dict,
    summary="Confirm password reset",
    description="Reset password using the reset token"
)
async def confirm_password_reset(
    reset_data: PasswordResetConfirmDTO,
    background_tasks: BackgroundTasks,
    request: Request,
    db: AsyncSession = Depends(get_db),
    redis_client = Depends(get_redis_client)
) -> dict:
    """
    Confirm password reset.
    
    This endpoint:
    - Validates the reset token
    - Updates the user's password
    - Invalidates all existing sessions
    - Sends confirmation email
    """
    from jidelnicek.auth.models import AuditLog, AuthPasswordResetToken, AuthSession
    from jidelnicek.auth.utils.password import PasswordHasher, PasswordValidator
    
    user_service = UserService(db)
    email_service = EmailService()
    token_service = TokenService(db, redis_client)
    
    # Get client info for logging
    client_ip = request.client.host if request.client else "unknown"
    user_agent = request.headers.get("User-Agent", "unknown")
    
    try:
        # Find the reset token
        result = await db.execute(
            select(AuthPasswordResetToken)
            .where(AuthPasswordResetToken.token == reset_data.token)
            .options(selectinload(AuthPasswordResetToken.user))
        )
        reset_token = result.scalar_one_or_none()
        
        if not reset_token:
            # Log invalid token attempt
            audit_log = AuditLog(
                action="password_reset_failed",
                entity_type="password_reset",
                entity_id=UUID("00000000-0000-0000-0000-000000000000"),
                ip_address=client_ip,
                user_agent=user_agent,
                changes={"reason": "invalid_token"}
            )
            db.add(audit_log)
            await db.commit()
            
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or expired password reset token"
            )
        
        # Check if token is already used
        if reset_token.is_used:
            # Log reuse attempt
            audit_log = AuditLog(
                user_id=reset_token.user_id,
                action="password_reset_failed",
                entity_type="password_reset",
                entity_id=reset_token.id,
                ip_address=client_ip,
                user_agent=user_agent,
                changes={"reason": "token_already_used"}
            )
            db.add(audit_log)
            await db.commit()
            
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This password reset token has already been used"
            )
        
        # Check if token is expired
        if reset_token.is_expired:
            # Log expired token attempt
            audit_log = AuditLog(
                user_id=reset_token.user_id,
                action="password_reset_failed",
                entity_type="password_reset",
                entity_id=reset_token.id,
                ip_address=client_ip,
                user_agent=user_agent,
                changes={"reason": "token_expired"}
            )
            db.add(audit_log)
            await db.commit()
            
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Password reset token has expired. Please request a new one."
            )
        
        # Get the user
        user = reset_token.user
        
        # Validate new password
        is_valid, errors = PasswordValidator.validate_strength(
            reset_data.new_password.get_secret_value(),
            user.email
        )
        if not is_valid:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"errors": errors}
            )
        
        # Hash the new password
        new_password_hash = PasswordHasher.hash_password(
            reset_data.new_password.get_secret_value()
        )
        
        # Update user's password
        user.password_hash = new_password_hash
        user.updated_at = datetime.now(timezone.utc)
        
        # Mark token as used
        reset_token.used_at = datetime.now(timezone.utc)
        reset_token.used_ip = client_ip
        
        # Invalidate ALL user sessions for security
        result = await db.execute(
            select(AuthSession)
            .where(
                and_(
                    AuthSession.user_id == user.id,
                    AuthSession.is_valid == True
                )
            )
        )
        sessions = result.scalars().all()
        
        sessions_invalidated = 0
        for session in sessions:
            session.is_valid = False
            sessions_invalidated += 1
            
            # Also revoke the refresh tokens in Redis if available
            if redis_client:
                await token_service.revoke_session(session.id)
        
        # Log successful password reset
        audit_log = AuditLog(
            user_id=user.id,
            action=AuditLog.PASSWORD_RESET_COMPLETE,
            entity_type="user",
            entity_id=user.id,
            ip_address=client_ip,
            user_agent=user_agent,
            changes={
                "reset_token_id": str(reset_token.id),
                "sessions_invalidated": sessions_invalidated
            }
        )
        db.add(audit_log)
        
        # Commit all changes
        await db.commit()
        
        # Send confirmation email in background
        background_tasks.add_task(
            email_service.send_password_reset_confirmation_email,
            user.email,
            user.language
        )
        
        logger.info(
            f"Password reset completed for user: {user.email} from IP: {client_ip}. "
            f"Invalidated {sessions_invalidated} sessions."
        )
        
        return {
            "status": "success",
            "message": "Password has been reset successfully. Please login with your new password."
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Password reset confirmation error: {str(e)}")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred during password reset"
        )


@router.post(
    "/refresh",
    response_model=TokenResponseDTO,
    summary="Refresh access token",
    description="Get new access token using refresh token"
)
async def refresh_token(
    token_data: RefreshTokenDTO,
    request: Request,
    db: AsyncSession = Depends(get_db),
    redis_client = Depends(get_redis_client)
) -> TokenResponseDTO:
    """
    Refresh access token.
    
    This endpoint:
    - Validates the refresh token
    - Checks if session is still valid
    - Issues a new access token
    - Optionally rotates the refresh token for enhanced security
    """
    from jidelnicek.auth.models import AuditLog
    
    user_service = UserService(db)
    token_service = TokenService(db, redis_client)
    
    # Get client info for logging
    client_ip = request.client.host if request.client else "unknown"
    user_agent = request.headers.get("User-Agent", "unknown")
    
    try:
        # Validate refresh token and get session
        session = await token_service.validate_session(token_data.refresh_token)
        
        # Get user from session
        user = session.user
        
        # Check if user is still active
        if not user.is_active:
            # Log failed refresh attempt
            audit_log = AuditLog(
                user_id=user.id,
                action="token_refresh_failed",
                entity_type="session",
                entity_id=session.id,
                ip_address=client_ip,
                user_agent=user_agent,
                changes={"reason": "user_inactive"}
            )
            db.add(audit_log)
            await db.commit()
            
            raise AccountInactiveError()
        
        # Check if user is locked
        if user.is_locked:
            # Log failed refresh attempt
            audit_log = AuditLog(
                user_id=user.id,
                action="token_refresh_failed",
                entity_type="session",
                entity_id=session.id,
                ip_address=client_ip,
                user_agent=user_agent,
                changes={"reason": "account_locked"}
            )
            db.add(audit_log)
            await db.commit()
            
            raise AccountLockedError()
        
        # Generate new access token
        access_token, access_expires = token_service.generate_access_token(user)
        
        # Optionally rotate refresh token for enhanced security
        refresh_token = token_data.refresh_token
        refresh_expires = session.expires_at
        
        if settings.rotate_refresh_tokens:
            # Generate new refresh token
            refresh_token, refresh_expires = token_service.generate_refresh_token(user)
            
            # Invalidate old session
            await token_service.revoke_session(session.id)
            
            # Create new session
            session = await token_service.create_session(
                user=user,
                refresh_token=refresh_token,
                expires_at=refresh_expires,
                ip_address=client_ip,
                user_agent=user_agent
            )
        
        # Log successful token refresh
        audit_log = AuditLog(
            user_id=user.id,
            action="token_refreshed",
            entity_type="session",
            entity_id=session.id,
            ip_address=client_ip,
            user_agent=user_agent,
            changes={
                "session_id": str(session.id),
                "rotated": settings.rotate_refresh_tokens
            }
        )
        db.add(audit_log)
        await db.commit()
        
        logger.info(
            f"Token refreshed for user {user.email} from IP: {client_ip}"
        )
        
        # Return new tokens
        return TokenResponseDTO(
            access_token=access_token,
            refresh_token=refresh_token,
            token_type="Bearer",
            expires_in=token_service.get_token_expiry_seconds(),
            user=user_service.to_response_dto(user)
        )
        
    except (SessionInvalidError, SessionExpiredError):
        # Log failed refresh attempt
        audit_log = AuditLog(
            action="token_refresh_failed",
            entity_type="session",
            entity_id=UUID("00000000-0000-0000-0000-000000000000"),
            ip_address=client_ip,
            user_agent=user_agent,
            changes={"reason": "invalid_or_expired_session"}
        )
        db.add(audit_log)
        await db.commit()
        
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token"
        )
    except (AccountInactiveError, AccountLockedError) as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Token refresh error: {str(e)}")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred during token refresh"
        )


@router.post(
    "/logout",
    response_model=dict,
    summary="Logout user",
    description="Invalidate user session and tokens"
)
async def logout(
    logout_data: LogoutDTO,
    request: Request,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
    redis_client = Depends(get_redis_client)
) -> dict:
    """
    Logout user.
    
    This endpoint:
    - Invalidates the current session or all user sessions
    - Blacklists the access token in Redis
    - Logs the logout event in audit log
    """
    from jidelnicek.auth.models import AuditLog
    from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
    
    token_service = TokenService(db, redis_client)
    
    # Get client info for logging
    client_ip = request.client.host if request.client else "unknown"
    user_agent = request.headers.get("User-Agent", "unknown")
    
    try:
        # Get the access token from the request
        authorization = request.headers.get("Authorization", "")
        if authorization.startswith("Bearer "):
            access_token = authorization[7:]
        else:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="No access token provided"
            )
        
        # Blacklist the current access token
        await token_service.revoke_token(access_token)
        
        # Handle session invalidation
        revoked_count = 0
        if logout_data.all_sessions:
            # Invalidate all user sessions
            revoked_count = await token_service.revoke_all_user_sessions(current_user.id)
            
            # Log logout all sessions event
            audit_log = AuditLog(
                user_id=current_user.id,
                action=AuditLog.LOGOUT,
                entity_type="user",
                entity_id=current_user.id,
                ip_address=client_ip,
                user_agent=user_agent,
                changes={
                    "all_sessions": True,
                    "sessions_revoked": revoked_count
                }
            )
            db.add(audit_log)
            
            logger.info(
                f"User {current_user.email} logged out from all {revoked_count} sessions "
                f"from IP: {client_ip}"
            )
            
            message = f"Successfully logged out from all {revoked_count} sessions"
            
        else:
            # Find and invalidate only the current session
            # We need to find the session associated with the current access token
            # Since we don't store access tokens, we'll find the most recent valid session
            result = await db.execute(
                select(AuthSession)
                .where(
                    and_(
                        AuthSession.user_id == current_user.id,
                        AuthSession.is_valid == True,
                        AuthSession.ip_address == client_ip
                    )
                )
                .order_by(AuthSession.last_accessed.desc())
                .limit(1)
            )
            session = result.scalar_one_or_none()
            
            if session:
                await token_service.revoke_session(session.id)
                revoked_count = 1
                
                # Log single session logout event
                audit_log = AuditLog(
                    user_id=current_user.id,
                    action=AuditLog.LOGOUT,
                    entity_type="session",
                    entity_id=session.id,
                    ip_address=client_ip,
                    user_agent=user_agent,
                    changes={
                        "all_sessions": False,
                        "session_id": str(session.id)
                    }
                )
                db.add(audit_log)
            else:
                # No session found, but still log the logout
                audit_log = AuditLog(
                    user_id=current_user.id,
                    action=AuditLog.LOGOUT,
                    entity_type="user",
                    entity_id=current_user.id,
                    ip_address=client_ip,
                    user_agent=user_agent,
                    changes={
                        "all_sessions": False,
                        "session_found": False
                    }
                )
                db.add(audit_log)
            
            logger.info(
                f"User {current_user.email} logged out from current session "
                f"from IP: {client_ip}"
            )
            
            message = "Successfully logged out"
        
        # Commit all changes
        await db.commit()
        
        return {
            "status": "success",
            "message": message,
            "sessions_revoked": revoked_count
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Logout error: {str(e)}")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred during logout"
        )


@router.get(
    "/me",
    response_model=UserResponseDTO,
    summary="Get current user",
    description="Get authenticated user's information"
)
async def get_current_user_info(
    current_user: CurrentUser
) -> UserResponseDTO:
    """
    Get current authenticated user information.
    
    This endpoint requires a valid access token and returns
    the user's profile information.
    """
    user_service = UserService(None)  # No DB needed for DTO conversion
    return user_service.to_response_dto(current_user)


@router.get(
    "/sessions",
    response_model=SessionListResponseDTO,
    summary="List active sessions",
    description="Get all active sessions for the current user"
)
async def list_user_sessions(
    request: Request,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
    redis_client = Depends(get_redis_client)
) -> SessionListResponseDTO:
    """
    List all active sessions for the authenticated user.
    
    This endpoint:
    - Returns all valid sessions with device information
    - Marks the current session based on IP and User-Agent
    - Shows session metadata and last activity
    """
    token_service = TokenService(db, redis_client)
    
    # Get all active sessions
    sessions = await token_service.get_user_sessions(current_user.id)
    
    # Get current request info to identify current session
    current_ip = request.client.host if request.client else None
    current_user_agent = request.headers.get("User-Agent", "")
    
    # Convert to response DTOs
    session_dtos = []
    for session in sessions:
        is_current = (
            session.ip_address == current_ip and
            session.user_agent == current_user_agent
        )
        
        session_dto = SessionResponseDTO(
            id=session.id,
            device_name=session.device_name or "Unknown Device",
            device_type=session.device_type or "unknown",
            browser=session.browser or "Unknown",
            os=session.os or "Unknown",
            ip_address=session.ip_address,
            location=session.location,
            created_at=session.created_at,
            last_accessed=session.last_accessed,
            expires_at=session.expires_at,
            is_current=is_current
        )
        session_dtos.append(session_dto)
    
    # Determine max allowed sessions
    is_admin = current_user.role == "admin"
    max_allowed = -1 if is_admin else settings.max_sessions_per_user
    
    return SessionListResponseDTO(
        sessions=session_dtos,
        total=len(session_dtos),
        max_allowed=max_allowed
    )


@router.delete(
    "/sessions/{session_id}",
    response_model=dict,
    summary="Revoke session",
    description="Revoke a specific session"
)
async def revoke_session(
    session_id: UUID,
    request: Request,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
    redis_client = Depends(get_redis_client)
) -> dict:
    """
    Revoke a specific session.
    
    This endpoint:
    - Validates the session belongs to the current user
    - Invalidates the session
    - Returns success status
    """
    from jidelnicek.auth.models import AuditLog
    
    token_service = TokenService(db, redis_client)
    
    # Attempt to revoke the session
    success = await token_service.revoke_session_by_id(session_id, current_user.id)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found or already revoked"
        )
    
    # Log the session revocation
    audit_log = AuditLog(
        user_id=current_user.id,
        action="session_revoked",
        entity_type="session",
        entity_id=session_id,
        ip_address=request.client.host if request.client else "unknown",
        user_agent=request.headers.get("User-Agent", "unknown"),
        changes={"revoked_session_id": str(session_id)}
    )
    db.add(audit_log)
    await db.commit()
    
    logger.info(f"Session {session_id} revoked for user {current_user.email}")
    
    return {
        "status": "success",
        "message": "Session revoked successfully",
        "session_id": str(session_id)
    }


@router.get(
    "/sessions/active-count",
    response_model=SessionCountResponseDTO,
    summary="Get active session count",
    description="Get the count of active sessions for current user"
)
async def get_session_count(
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
    redis_client = Depends(get_redis_client)
) -> SessionCountResponseDTO:
    """
    Get count of active sessions.
    
    This endpoint provides a quick way to check:
    - Number of active sessions
    - Maximum allowed sessions
    - Whether the user has admin privileges (unlimited sessions)
    """
    token_service = TokenService(db, redis_client)
    
    # Get session count
    active_count = await token_service.get_session_count(current_user.id)
    
    # Check if admin
    is_admin = current_user.role == "admin"
    max_allowed = -1 if is_admin else settings.max_sessions_per_user
    
    return SessionCountResponseDTO(
        active_sessions=active_count,
        max_allowed=max_allowed,
        is_admin=is_admin
    )