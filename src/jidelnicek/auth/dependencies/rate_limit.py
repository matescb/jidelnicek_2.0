"""
Rate limiting dependency for API endpoints.

This module provides configurable rate limiting using Redis
to prevent abuse and ensure fair API usage.
"""

import hashlib
from datetime import datetime, timedelta
from typing import Optional, Callable
import logging

from fastapi import HTTPException, status, Request, Depends
from redis.asyncio import Redis

from jidelnicek.core.dependencies import get_redis_client
from jidelnicek.core.config import settings

logger = logging.getLogger(__name__)


class RateLimitExceeded(HTTPException):
    """Exception raised when rate limit is exceeded."""
    
    def __init__(self, retry_after: int, detail: Optional[str] = None):
        super().__init__(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=detail or "Rate limit exceeded. Please try again later.",
            headers={"Retry-After": str(retry_after)}
        )


class RateLimitDep:
    """
    Dependency class for rate limiting API endpoints.
    
    Uses Redis to track request counts per IP address with configurable
    limits and time windows.
    """
    
    def __init__(
        self,
        key_prefix: str,
        max_attempts: int = 10,
        window_minutes: int = 0,
        window_hours: int = 0,
        window_days: int = 0,
        get_identifier: Optional[Callable[[Request], str]] = None,
        custom_error_message: Optional[str] = None,
        enable_suspicious_tracking: bool = False
    ):
        """
        Initialize rate limiter.
        
        Args:
            key_prefix: Prefix for Redis keys (e.g., "login", "register")
            max_attempts: Maximum number of attempts allowed
            window_minutes: Time window in minutes
            window_hours: Time window in hours
            window_days: Time window in days
            get_identifier: Optional function to extract identifier from request
                           (defaults to IP address)
            custom_error_message: Optional custom error message for rate limit exceeded
            enable_suspicious_tracking: Enable tracking of suspicious IPs
        """
        self.key_prefix = key_prefix
        self.max_attempts = max_attempts
        self.custom_error_message = custom_error_message
        self.enable_suspicious_tracking = enable_suspicious_tracking
        
        # Calculate window in seconds
        self.window_seconds = (
            window_minutes * 60 +
            window_hours * 3600 +
            window_days * 86400
        )
        
        if self.window_seconds == 0:
            self.window_seconds = 3600  # Default to 1 hour
        
        self.get_identifier = get_identifier or self._get_ip_address
    
    def _get_ip_address(self, request: Request) -> str:
        """
        Extract client IP address from request.
        
        Handles X-Forwarded-For and X-Real-IP headers for reverse proxy setups.
        """
        # Check for forwarded IP headers (reverse proxy)
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            # Take the first IP in the chain
            return forwarded_for.split(",")[0].strip()
        
        real_ip = request.headers.get("X-Real-IP")
        if real_ip:
            return real_ip
        
        # Fall back to direct client IP
        if request.client:
            return request.client.host
        
        return "unknown"
    
    def _get_redis_key(self, identifier: str) -> str:
        """
        Generate Redis key for rate limiting.
        
        Uses SHA256 hash of identifier for privacy.
        """
        # Hash the identifier for privacy
        identifier_hash = hashlib.sha256(identifier.encode()).hexdigest()[:16]
        return f"rate_limit:{self.key_prefix}:{identifier_hash}"
    
    async def __call__(
        self,
        request: Request,
        redis: Redis = Depends(get_redis_client)
    ) -> None:
        """
        Check rate limit for the current request.
        
        Raises:
            RateLimitExceeded: If rate limit is exceeded
        """
        # Skip rate limiting if disabled
        if not settings.rate_limit_enabled:
            return
        
        # Get identifier (IP address by default)
        identifier = self.get_identifier(request)
        redis_key = self._get_redis_key(identifier)
        
        try:
            # Get current attempt count
            current_attempts = await redis.get(redis_key)
            
            if current_attempts is None:
                # First attempt - set counter with expiration
                await redis.setex(
                    redis_key,
                    self.window_seconds,
                    1
                )
                logger.debug(
                    f"Rate limit: First attempt for {self.key_prefix} "
                    f"from {identifier}"
                )
                return
            
            # Check if limit exceeded
            attempts = int(current_attempts)
            if attempts >= self.max_attempts:
                # Get remaining TTL for retry-after header
                ttl = await redis.ttl(redis_key)
                if ttl < 0:
                    # Key expired between operations - reset
                    await redis.setex(
                        redis_key,
                        self.window_seconds,
                        1
                    )
                    return
                
                logger.warning(
                    f"Rate limit exceeded for {self.key_prefix} "
                    f"from {identifier}: {attempts}/{self.max_attempts} attempts"
                )
                
                # Track suspicious IPs if enabled
                if self.enable_suspicious_tracking:
                    await self._track_suspicious_ip(redis, identifier)
                
                raise RateLimitExceeded(
                    retry_after=ttl,
                    detail=self.custom_error_message
                )
            
            # Increment counter
            await redis.incr(redis_key)
            logger.debug(
                f"Rate limit: Attempt {attempts + 1}/{self.max_attempts} "
                f"for {self.key_prefix} from {identifier}"
            )
            
        except RateLimitExceeded:
            # Re-raise rate limit exceptions
            raise
        except Exception as e:
            # Log Redis errors but don't block requests
            logger.error(f"Rate limiting error: {str(e)}")
            # Continue without rate limiting on Redis errors
    
    async def get_remaining_attempts(
        self,
        request: Request,
        redis: Redis
    ) -> tuple[int, int]:
        """
        Get remaining attempts and time until reset.
        
        Returns:
            Tuple of (remaining_attempts, seconds_until_reset)
        """
        identifier = self.get_identifier(request)
        redis_key = self._get_redis_key(identifier)
        
        try:
            current_attempts = await redis.get(redis_key)
            if current_attempts is None:
                return self.max_attempts, 0
            
            attempts = int(current_attempts)
            remaining = max(0, self.max_attempts - attempts)
            
            # Get TTL for reset time
            ttl = await redis.ttl(redis_key)
            if ttl < 0:
                return self.max_attempts, 0
            
            return remaining, ttl
        except Exception as e:
            logger.error(f"Error getting remaining attempts: {str(e)}")
            return self.max_attempts, 0
    
    async def reset_rate_limit(
        self,
        identifier: str,
        redis: Redis
    ) -> bool:
        """
        Reset rate limit for a specific identifier.
        
        Args:
            identifier: The identifier to reset (e.g., IP address, email)
            redis: Redis client
            
        Returns:
            True if reset successful, False otherwise
        """
        redis_key = self._get_redis_key(identifier)
        
        try:
            await redis.delete(redis_key)
            logger.info(f"Rate limit reset for {self.key_prefix}:{identifier}")
            return True
        except Exception as e:
            logger.error(f"Error resetting rate limit: {str(e)}")
            return False
    
    async def _track_suspicious_ip(
        self,
        redis: Redis,
        identifier: str
    ) -> None:
        """
        Track IPs that repeatedly hit rate limits.
        
        This can be used for identifying potential attackers.
        """
        suspicious_key = f"suspicious_ips:{identifier}"
        
        try:
            # Increment suspicious counter
            count = await redis.incr(suspicious_key)
            
            # Set expiry of 24 hours if first violation
            if count == 1:
                await redis.expire(suspicious_key, 86400)
            
            # Log if this IP is repeatedly suspicious
            if count >= 5:
                logger.warning(
                    f"SUSPICIOUS ACTIVITY: IP {identifier} has hit rate limits "
                    f"{count} times in the last 24 hours"
                )
        except Exception as e:
            logger.error(f"Error tracking suspicious IP: {str(e)}")


class UserRateLimitDep(RateLimitDep):
    """
    Rate limiter that uses authenticated user ID instead of IP.
    
    Useful for endpoints that require authentication.
    """
    
    def __init__(
        self,
        key_prefix: str,
        max_attempts: int = 10,
        window_minutes: int = 0,
        window_hours: int = 0,
        window_days: int = 0
    ):
        """Initialize user-based rate limiter."""
        super().__init__(
            key_prefix=key_prefix,
            max_attempts=max_attempts,
            window_minutes=window_minutes,
            window_hours=window_hours,
            window_days=window_days,
            get_identifier=self._get_user_id
        )
    
    def _get_user_id(self, request: Request) -> str:
        """
        Extract user ID from authenticated request.
        
        This assumes the user ID is set in request state by auth middleware.
        """
        # This will be implemented when we add authentication middleware
        # For now, fall back to IP address
        return self._get_ip_address(request)


# Pre-configured rate limiters for common use cases
LoginRateLimit = RateLimitDep(
    key_prefix="login",
    max_attempts=10,
    window_minutes=15
)

RegisterRateLimit = RateLimitDep(
    key_prefix="register",
    max_attempts=5,
    window_hours=1
)

PasswordResetRateLimit = RateLimitDep(
    key_prefix="password_reset",
    max_attempts=3,
    window_hours=1
)

EmailVerificationRateLimit = RateLimitDep(
    key_prefix="email_verify",
    max_attempts=5,
    window_hours=1
)

# General API rate limit for authenticated users
GeneralAPIRateLimit = UserRateLimitDep(
    key_prefix="api_general",
    max_attempts=1000,
    window_hours=1
)

# Aggressive rate limit for suspected attackers
AggressiveRateLimit = RateLimitDep(
    key_prefix="aggressive",
    max_attempts=10,
    window_hours=24,
    custom_error_message="Your IP has been temporarily blocked due to suspicious activity. Please try again later.",
    enable_suspicious_tracking=True
)

# Strict rate limit for sensitive operations
StrictRateLimit = RateLimitDep(
    key_prefix="strict",
    max_attempts=3,
    window_hours=1,
    custom_error_message="Too many attempts. For security reasons, please wait before trying again."
)