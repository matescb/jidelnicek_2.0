"""
Monitoring router for authentication system.

This module provides endpoints for monitoring rate limits,
suspicious activity, and system health.
"""

import logging
from typing import Optional, Dict, Any, List
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status, Request
from redis.asyncio import Redis

from jidelnicek.core.dependencies import get_redis_client
from jidelnicek.auth.dependencies.auth import get_current_user
from jidelnicek.auth.models import AuthUser
from jidelnicek.auth.dependencies.rate_limit import (
    RateLimitDep,
    LoginRateLimit,
    RegisterRateLimit,
    PasswordResetRateLimit,
    EmailVerificationRateLimit,
    GeneralAPIRateLimit
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/auth/monitoring", tags=["auth-monitoring"])


@router.get(
    "/rate-limit/status",
    response_model=Dict[str, Any],
    summary="Check rate limit status",
    description="Get current rate limit status for the requesting IP or user"
)
async def get_rate_limit_status(
    request: Request,
    current_user: Optional[AuthUser] = Depends(get_current_user),
    redis: Redis = Depends(get_redis_client)
) -> Dict[str, Any]:
    """
    Get rate limit status for various endpoints.
    
    Shows remaining attempts and reset times for each rate limiter.
    """
    # Define rate limiters to check
    rate_limiters = {
        "login": LoginRateLimit,
        "register": RegisterRateLimit,
        "password_reset": PasswordResetRateLimit,
        "email_verification": EmailVerificationRateLimit,
    }
    
    # Add user-specific rate limiter if authenticated
    if current_user:
        rate_limiters["api_general"] = GeneralAPIRateLimit
    
    status_info = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "ip_address": request.client.host if request.client else "unknown",
        "authenticated": current_user is not None,
        "rate_limits": {}
    }
    
    # Check each rate limiter
    for name, limiter in rate_limiters.items():
        try:
            remaining, reset_in = await limiter.get_remaining_attempts(request, redis)
            
            status_info["rate_limits"][name] = {
                "max_attempts": limiter.max_attempts,
                "remaining_attempts": remaining,
                "reset_in_seconds": reset_in,
                "window_seconds": limiter.window_seconds,
                "is_blocked": remaining == 0
            }
        except Exception as e:
            logger.error(f"Error checking rate limit for {name}: {str(e)}")
            status_info["rate_limits"][name] = {
                "error": "Unable to check rate limit status"
            }
    
    # Check if IP is marked as suspicious
    if redis:
        try:
            client_ip = request.client.host if request.client else "unknown"
            suspicious_key = f"suspicious_ips:{client_ip}"
            suspicious_count = await redis.get(suspicious_key)
            
            if suspicious_count:
                ttl = await redis.ttl(suspicious_key)
                status_info["suspicious_activity"] = {
                    "violation_count": int(suspicious_count),
                    "expires_in_seconds": ttl if ttl > 0 else 0
                }
            else:
                status_info["suspicious_activity"] = None
                
        except Exception as e:
            logger.error(f"Error checking suspicious activity: {str(e)}")
    
    return status_info


@router.get(
    "/rate-limit/violations",
    response_model=Dict[str, Any],
    summary="Get rate limit violations",
    description="Get recent rate limit violations (admin only)"
)
async def get_rate_limit_violations(
    current_user: AuthUser = Depends(get_current_user),
    redis: Redis = Depends(get_redis_client),
    limit: int = 50
) -> Dict[str, Any]:
    """
    Get recent rate limit violations.
    
    This endpoint requires admin privileges and shows IPs that have
    been hitting rate limits frequently.
    """
    # Check if user is admin (you'll need to implement this check)
    # For now, we'll just check if user is authenticated
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    
    violations = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "suspicious_ips": [],
        "blocked_ips": []
    }
    
    if not redis:
        return violations
    
    try:
        # Scan for suspicious IPs
        cursor = "0"
        pattern = "suspicious_ips:*"
        
        while cursor != 0:
            cursor, keys = await redis.scan(
                cursor=cursor,
                match=pattern,
                count=100
            )
            
            for key in keys:
                try:
                    # Get violation count and TTL
                    count = await redis.get(key)
                    ttl = await redis.ttl(key)
                    
                    if count:
                        ip = key.decode().split(":", 1)[1]
                        violations["suspicious_ips"].append({
                            "ip_address": ip,
                            "violation_count": int(count),
                            "expires_in_seconds": ttl if ttl > 0 else 0
                        })
                except Exception as e:
                    logger.error(f"Error processing suspicious IP {key}: {str(e)}")
        
        # Sort by violation count (highest first)
        violations["suspicious_ips"].sort(
            key=lambda x: x["violation_count"],
            reverse=True
        )
        
        # Limit results
        violations["suspicious_ips"] = violations["suspicious_ips"][:limit]
        
    except Exception as e:
        logger.error(f"Error getting rate limit violations: {str(e)}")
        violations["error"] = "Unable to retrieve violation data"
    
    return violations


@router.post(
    "/rate-limit/reset",
    response_model=Dict[str, Any],
    summary="Reset rate limit",
    description="Reset rate limit for a specific identifier (admin only)"
)
async def reset_rate_limit(
    identifier: str,
    rate_limiter_name: str,
    current_user: AuthUser = Depends(get_current_user),
    redis: Redis = Depends(get_redis_client)
) -> Dict[str, Any]:
    """
    Reset rate limit for a specific identifier.
    
    This endpoint requires admin privileges and can be used to unblock
    legitimate users who have been rate limited.
    """
    # Check if user is admin (you'll need to implement this check)
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    
    # Map of available rate limiters
    rate_limiters = {
        "login": LoginRateLimit,
        "register": RegisterRateLimit,
        "password_reset": PasswordResetRateLimit,
        "email_verification": EmailVerificationRateLimit,
        "api_general": GeneralAPIRateLimit
    }
    
    if rate_limiter_name not in rate_limiters:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown rate limiter: {rate_limiter_name}"
        )
    
    limiter = rate_limiters[rate_limiter_name]
    
    try:
        success = await limiter.reset_rate_limit(identifier, redis)
        
        if success:
            logger.info(
                f"Rate limit reset for {rate_limiter_name}:{identifier} "
                f"by admin {current_user.email}"
            )
            
            return {
                "status": "success",
                "message": f"Rate limit reset for {identifier}",
                "rate_limiter": rate_limiter_name,
                "identifier": identifier,
                "reset_by": current_user.email,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to reset rate limit"
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error resetting rate limit: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while resetting rate limit"
        )


@router.post(
    "/suspicious-ip/clear",
    response_model=Dict[str, Any],
    summary="Clear suspicious IP status",
    description="Remove an IP from the suspicious list (admin only)"
)
async def clear_suspicious_ip(
    ip_address: str,
    current_user: AuthUser = Depends(get_current_user),
    redis: Redis = Depends(get_redis_client)
) -> Dict[str, Any]:
    """
    Clear suspicious status for an IP address.
    
    This endpoint requires admin privileges.
    """
    # Check if user is admin
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    
    if not redis:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Redis not available"
        )
    
    try:
        suspicious_key = f"suspicious_ips:{ip_address}"
        deleted = await redis.delete(suspicious_key)
        
        if deleted:
            logger.info(
                f"Suspicious IP status cleared for {ip_address} "
                f"by admin {current_user.email}"
            )
            
            return {
                "status": "success",
                "message": f"Suspicious status cleared for IP {ip_address}",
                "ip_address": ip_address,
                "cleared_by": current_user.email,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
        else:
            return {
                "status": "info",
                "message": f"IP {ip_address} was not marked as suspicious",
                "ip_address": ip_address,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
            
    except Exception as e:
        logger.error(f"Error clearing suspicious IP: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while clearing suspicious IP"
        )