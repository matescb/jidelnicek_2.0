"""
Security middleware for admin interface.

Integrates all security components:
- Session management
- Two-factor authentication
- IP whitelisting
- Rate limiting
- CSRF protection
"""

from typing import Optional, Dict, Any, List, Callable
from datetime import datetime, timedelta
import secrets
import json
from functools import wraps

from fastapi import Request, Response, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.types import ASGIApp

from jidelnicek.core.utils import get_utc_now
from jidelnicek.core.exceptions import (
    SecurityException,
    SessionExpiredException,
    TwoFactorRequiredException,
    IPBlockedException
)
from jidelnicek.admin.security import (
    SessionManager,
    TwoFactorAuth,
    IPWhitelistService,
    AdminSession
)


class AdminSecurityConfig:
    """Configuration for admin security middleware."""
    
    # Session settings
    REQUIRE_2FA = True
    ENFORCE_IP_WHITELIST = True
    
    # Rate limiting
    RATE_LIMIT_WINDOW = timedelta(minutes=15)
    RATE_LIMIT_MAX_REQUESTS = 100
    RATE_LIMIT_LOCKOUT = timedelta(hours=1)
    
    # CSRF settings
    CSRF_TOKEN_LENGTH = 32
    CSRF_HEADER_NAME = "X-CSRF-Token"
    CSRF_COOKIE_NAME = "csrf_token"
    CSRF_COOKIE_SECURE = True
    CSRF_COOKIE_HTTPONLY = True
    CSRF_COOKIE_SAMESITE = "strict"
    
    # Security headers
    SECURITY_HEADERS_ENABLED = True
    
    # Paths that don't require authentication
    PUBLIC_PATHS = [
        "/admin/login",
        "/admin/logout",
        "/admin/2fa/verify",
        "/admin/health"
    ]
    
    # Paths that don't require CSRF
    CSRF_EXEMPT_PATHS = [
        "/admin/login",
        "/admin/api/webhook"
    ]


class AdminSecurityMiddleware(BaseHTTPMiddleware):
    """Main security middleware for admin interface."""
    
    def __init__(
        self,
        app: ASGIApp,
        session_manager: SessionManager,
        two_factor_auth: TwoFactorAuth,
        ip_whitelist_service: IPWhitelistService,
        config: Optional[AdminSecurityConfig] = None,
        redis_client=None
    ):
        super().__init__(app)
        self.session_manager = session_manager
        self.two_factor_auth = two_factor_auth
        self.ip_whitelist = ip_whitelist_service
        self.config = config or AdminSecurityConfig()
        self.redis = redis_client
        self.bearer_scheme = HTTPBearer(auto_error=False)
    
    async def dispatch(
        self,
        request: Request,
        call_next: RequestResponseEndpoint
    ) -> Response:
        """Process request through security pipeline."""
        # Skip non-admin paths
        if not request.url.path.startswith("/admin"):
            return await call_next(request)
        
        # Check if path is public
        if self._is_public_path(request.url.path):
            return await call_next(request)
        
        try:
            # 1. Check IP whitelist
            client_ip = self._get_client_ip(request)
            await self._check_ip_access(client_ip)
            
            # 2. Check rate limiting
            await self._check_rate_limit(client_ip, request.url.path)
            
            # 3. Validate session
            session = await self._validate_session(request)
            if not session:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid or expired session"
                )
            
            # 4. Check 2FA if required
            if self.config.REQUIRE_2FA and not session.two_factor_verified:
                # Allow 2FA verification endpoint
                if request.url.path != "/admin/2fa/verify":
                    raise TwoFactorRequiredException("Two-factor authentication required")
            
            # 5. Verify CSRF token for state-changing operations
            if request.method not in ["GET", "HEAD", "OPTIONS"]:
                await self._verify_csrf_token(request)
            
            # 6. Attach security context to request
            request.state.admin_session = session
            request.state.client_ip = client_ip
            
            # 7. Process request
            response = await call_next(request)
            
            # 8. Update session activity
            await self.session_manager.update_activity(session)
            
            # 9. Add CSRF token to response if needed
            if request.method == "GET":
                await self._add_csrf_token(request, response)
            
            return response
            
        except HTTPException:
            raise
        except TwoFactorRequiredException as e:
            return Response(
                status_code=status.HTTP_403_FORBIDDEN,
                content=json.dumps({
                    "error": "two_factor_required",
                    "message": str(e)
                }),
                media_type="application/json"
            )
        except IPBlockedException as e:
            await self.ip_whitelist.track_failed_attempt(client_ip)
            return Response(
                status_code=status.HTTP_403_FORBIDDEN,
                content=json.dumps({
                    "error": "ip_blocked",
                    "message": str(e)
                }),
                media_type="application/json"
            )
        except SecurityException as e:
            return Response(
                status_code=status.HTTP_403_FORBIDDEN,
                content=json.dumps({
                    "error": "security_violation",
                    "message": str(e)
                }),
                media_type="application/json"
            )
        except Exception as e:
            # Log security error
            return Response(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=json.dumps({
                    "error": "internal_error",
                    "message": "Security check failed"
                }),
                media_type="application/json"
            )
    
    async def _check_ip_access(self, ip: str) -> None:
        """Check if IP is allowed to access admin."""
        allowed, reason = await self.ip_whitelist.check_ip_access(
            ip=ip,
            enforce_whitelist=self.config.ENFORCE_IP_WHITELIST
        )
        
        if not allowed:
            raise IPBlockedException(reason or "Access denied")
    
    async def _check_rate_limit(self, ip: str, path: str) -> None:
        """Check rate limiting for IP."""
        if not self.redis:
            return
        
        # Create rate limit key
        window = int(get_utc_now().timestamp() // self.config.RATE_LIMIT_WINDOW.total_seconds())
        key = f"admin:rate_limit:{ip}:{window}"
        
        # Increment counter
        count = await self.redis.incr(key)
        await self.redis.expire(key, int(self.config.RATE_LIMIT_WINDOW.total_seconds()))
        
        # Check limit
        if count > self.config.RATE_LIMIT_MAX_REQUESTS:
            # Block IP temporarily
            await self.ip_whitelist.block_ip(
                ip=ip,
                reason="Rate limit exceeded",
                duration=self.config.RATE_LIMIT_LOCKOUT
            )
            raise SecurityException("Rate limit exceeded")
    
    async def _validate_session(self, request: Request) -> Optional[AdminSession]:
        """Validate session from request."""
        # Try to get token from Authorization header
        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            return None
        
        token = auth_header[7:]  # Remove "Bearer " prefix
        
        # Get client info
        client_ip = self._get_client_ip(request)
        user_agent = request.headers.get("User-Agent", "")
        
        # Validate session
        session = await self.session_manager.validate_session(
            token=token,
            ip_address=client_ip,
            user_agent=user_agent
        )
        
        return session
    
    async def _verify_csrf_token(self, request: Request) -> None:
        """Verify CSRF token for state-changing operations."""
        # Skip if path is exempt
        if self._is_csrf_exempt(request.url.path):
            return
        
        # Get token from header
        csrf_token = request.headers.get(self.config.CSRF_HEADER_NAME)
        if not csrf_token:
            raise SecurityException("CSRF token missing")
        
        # Get expected token from session
        if hasattr(request.state, "admin_session"):
            session = request.state.admin_session
            expected_token = await self._get_csrf_token(session.session_id)
            
            if not secrets.compare_digest(csrf_token, expected_token):
                raise SecurityException("Invalid CSRF token")
        else:
            raise SecurityException("No session for CSRF validation")
    
    async def _add_csrf_token(self, request: Request, response: Response) -> None:
        """Add CSRF token to response."""
        if hasattr(request.state, "admin_session"):
            session = request.state.admin_session
            csrf_token = await self._get_or_create_csrf_token(session.session_id)
            
            # Add to response header for API clients
            response.headers[self.config.CSRF_HEADER_NAME] = csrf_token
            
            # Add cookie for browser clients
            response.set_cookie(
                key=self.config.CSRF_COOKIE_NAME,
                value=csrf_token,
                secure=self.config.CSRF_COOKIE_SECURE,
                httponly=self.config.CSRF_COOKIE_HTTPONLY,
                samesite=self.config.CSRF_COOKIE_SAMESITE,
                max_age=3600  # 1 hour
            )
    
    async def _get_csrf_token(self, session_id: str) -> Optional[str]:
        """Get CSRF token for session."""
        if self.redis:
            key = f"admin:csrf:{session_id}"
            return await self.redis.get(key)
        return None
    
    async def _get_or_create_csrf_token(self, session_id: str) -> str:
        """Get or create CSRF token for session."""
        token = await self._get_csrf_token(session_id)
        
        if not token:
            token = secrets.token_urlsafe(self.config.CSRF_TOKEN_LENGTH)
            if self.redis:
                key = f"admin:csrf:{session_id}"
                await self.redis.setex(key, 3600, token)  # 1 hour
        
        return token
    
    def _get_client_ip(self, request: Request) -> str:
        """Get client IP address from request."""
        # Check X-Forwarded-For header first (for proxies)
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            # Take the first IP in the chain
            return forwarded.split(",")[0].strip()
        
        # Check X-Real-IP header
        real_ip = request.headers.get("X-Real-IP")
        if real_ip:
            return real_ip
        
        # Fall back to direct connection
        if request.client:
            return request.client.host
        
        return "unknown"
    
    def _is_public_path(self, path: str) -> bool:
        """Check if path doesn't require authentication."""
        return any(path.startswith(p) for p in self.config.PUBLIC_PATHS)
    
    def _is_csrf_exempt(self, path: str) -> bool:
        """Check if path is exempt from CSRF protection."""
        return any(path.startswith(p) for p in self.config.CSRF_EXEMPT_PATHS)


def require_admin_auth(
    require_2fa: bool = True,
    permissions: Optional[List[str]] = None
) -> Callable:
    """
    Decorator for endpoints that require admin authentication.
    
    Args:
        require_2fa: Whether 2FA is required
        permissions: List of required permissions
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def wrapper(request: Request, *args, **kwargs):
            # Check if session exists
            if not hasattr(request.state, "admin_session"):
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Authentication required"
                )
            
            session = request.state.admin_session
            
            # Check 2FA if required
            if require_2fa and not session.two_factor_verified:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Two-factor authentication required"
                )
            
            # Check permissions if specified
            if permissions:
                # TODO: Implement permission checking
                pass
            
            return await func(request, *args, **kwargs)
        
        return wrapper
    
    return decorator