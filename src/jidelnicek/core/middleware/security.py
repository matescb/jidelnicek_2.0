"""
Security middleware for Jídelníček 2.0.

Provides comprehensive security headers, CSRF protection, request sanitization,
and API versioning middleware.
"""

import os
import re
import secrets
import uuid
import time
from typing import Dict, Optional, Set, Callable, List, Tuple
from datetime import datetime, timedelta

from fastapi import Request, Response, HTTPException, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.types import ASGIApp

from jidelnicek.core.config import settings
from jidelnicek.core.cache_utils.cache import get_redis_client


class SecurityMiddleware(BaseHTTPMiddleware):
    """
    Comprehensive security middleware that adds security headers,
    handles request sanitization, and implements security policies.
    """
    
    def __init__(
        self,
        app: ASGIApp,
        *,
        hsts_max_age: int = 31536000,  # 1 year
        hsts_include_subdomains: bool = True,
        hsts_preload: bool = True,
        csp_policy: Optional[str] = None,
        referrer_policy: str = "strict-origin-when-cross-origin",
        permissions_policy: Optional[str] = None,
        max_request_size: int = 10 * 1024 * 1024,  # 10MB
        api_version: str = "2.0.0",
        supported_versions: Optional[List[str]] = None,
    ):
        super().__init__(app)
        self.hsts_max_age = hsts_max_age
        self.hsts_include_subdomains = hsts_include_subdomains
        self.hsts_preload = hsts_preload
        self.csp_policy = csp_policy or self._get_default_csp()
        self.referrer_policy = referrer_policy
        self.permissions_policy = permissions_policy or self._get_default_permissions_policy()
        self.max_request_size = max_request_size
        self.api_version = api_version
        self.supported_versions = supported_versions or ["1.0.0", "2.0.0"]
        
        # Compile regex patterns for sanitization
        self.null_byte_pattern = re.compile(r'\x00')
        self.control_char_pattern = re.compile(r'[\x00-\x1F\x7F]')
    
    def _get_default_csp(self) -> str:
        """Get default Content Security Policy."""
        # More restrictive in production
        if settings.is_production:
            return (
                "default-src 'self'; "
                "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://unpkg.com; "
                "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net; "
                "font-src 'self' https://fonts.gstatic.com data:; "
                "img-src 'self' data: https: blob:; "
                "connect-src 'self' https://api.jidelnicek.cz wss://api.jidelnicek.cz; "
                "media-src 'self'; "
                "object-src 'none'; "
                "child-src 'self'; "
                "frame-src 'self'; "
                "frame-ancestors 'none'; "
                "form-action 'self'; "
                "base-uri 'self'; "
                "manifest-src 'self'; "
                "worker-src 'self' blob:; "
                "upgrade-insecure-requests;"
            )
        else:
            # More permissive in development
            return (
                "default-src 'self'; "
                "script-src 'self' 'unsafe-inline' 'unsafe-eval' http://localhost:* https://cdn.jsdelivr.net; "
                "style-src 'self' 'unsafe-inline' http://localhost:* https://fonts.googleapis.com; "
                "font-src 'self' http://localhost:* https://fonts.gstatic.com data:; "
                "img-src 'self' data: http: https: blob:; "
                "connect-src 'self' http://localhost:* ws://localhost:* https: wss:; "
                "media-src 'self'; "
                "object-src 'none'; "
                "child-src 'self'; "
                "frame-src 'self' http://localhost:*; "
                "form-action 'self'; "
                "base-uri 'self';"
            )
    
    def _get_default_permissions_policy(self) -> str:
        """Get default Permissions Policy (formerly Feature Policy)."""
        return (
            "accelerometer=(), "
            "ambient-light-sensor=(), "
            "autoplay=(self), "
            "battery=(), "
            "camera=(), "
            "cross-origin-isolated=(self), "
            "display-capture=(), "
            "document-domain=(), "
            "encrypted-media=(self), "
            "execution-while-not-rendered=(), "
            "execution-while-out-of-viewport=(), "
            "fullscreen=(self), "
            "geolocation=(), "
            "gyroscope=(), "
            "keyboard-map=(), "
            "magnetometer=(), "
            "microphone=(), "
            "midi=(), "
            "navigation-override=(), "
            "payment=(), "
            "picture-in-picture=(self), "
            "publickey-credentials-get=(), "
            "screen-wake-lock=(), "
            "sync-xhr=(), "
            "usb=(), "
            "web-share=(), "
            "xr-spatial-tracking=()"
        )
    
    async def dispatch(
        self,
        request: Request,
        call_next: RequestResponseEndpoint
    ) -> Response:
        """Process request and add security headers to response."""
        
        # Request sanitization
        await self._sanitize_request(request)
        
        # Add request ID if not present
        if not hasattr(request.state, "request_id"):
            request.state.request_id = str(uuid.uuid4())
        
        # API version negotiation
        requested_version = request.headers.get("API-Version", self.api_version)
        if requested_version not in self.supported_versions:
            return JSONResponse(
                status_code=status.HTTP_406_NOT_ACCEPTABLE,
                content={
                    "detail": f"Unsupported API version: {requested_version}",
                    "supported_versions": self.supported_versions,
                    "current_version": self.api_version
                }
            )
        
        # Store API version in request state
        request.state.api_version = requested_version
        
        # Process request
        start_time = time.time()
        response = await call_next(request)
        process_time = time.time() - start_time
        
        # Add security headers
        self._add_security_headers(response, request, process_time)
        
        # Add API version headers
        response.headers["API-Version"] = self.api_version
        response.headers["API-Supported-Versions"] = ", ".join(self.supported_versions)
        
        # Add deprecation warning for old API versions
        if requested_version != self.api_version:
            response.headers["API-Deprecation"] = "true"
            response.headers["API-Deprecation-Date"] = "2025-12-31"
            response.headers["API-Deprecation-Info"] = (
                f"Version {requested_version} is deprecated. "
                f"Please upgrade to {self.api_version}"
            )
        
        return response
    
    async def _sanitize_request(self, request: Request) -> None:
        """Sanitize incoming request."""
        
        # Check request size
        content_length = request.headers.get("content-length")
        if content_length and int(content_length) > self.max_request_size:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"Request size exceeds maximum allowed size of {self.max_request_size} bytes"
            )
        
        # Validate content type for POST/PUT/PATCH requests
        if request.method in ["POST", "PUT", "PATCH"]:
            content_type = request.headers.get("content-type", "")
            if not content_type:
                raise HTTPException(
                    status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                    detail="Content-Type header is required for this request"
                )
        
        # Sanitize headers
        for header_name, header_value in request.headers.items():
            if isinstance(header_value, str):
                # Remove null bytes
                if self.null_byte_pattern.search(header_value):
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Invalid characters in header: {header_name}"
                    )
        
        # Sanitize path parameters
        if hasattr(request, "path_params"):
            for param_name, param_value in request.path_params.items():
                if isinstance(param_value, str):
                    # Remove null bytes and control characters
                    if self.control_char_pattern.search(param_value):
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail=f"Invalid characters in path parameter: {param_name}"
                        )
    
    def _add_security_headers(
        self,
        response: Response,
        request: Request,
        process_time: float
    ) -> None:
        """Add comprehensive security headers to response."""
        
        # HSTS (HTTP Strict Transport Security)
        if settings.is_production or request.url.scheme == "https":
            hsts_header = f"max-age={self.hsts_max_age}"
            if self.hsts_include_subdomains:
                hsts_header += "; includeSubDomains"
            if self.hsts_preload:
                hsts_header += "; preload"
            response.headers["Strict-Transport-Security"] = hsts_header
        
        # Security headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = self.referrer_policy
        response.headers["Content-Security-Policy"] = self.csp_policy
        response.headers["Permissions-Policy"] = self.permissions_policy
        
        # Additional headers
        response.headers["X-Permitted-Cross-Domain-Policies"] = "none"
        response.headers["X-Download-Options"] = "noopen"
        response.headers["X-DNS-Prefetch-Control"] = "off"
        
        # Server timing header (useful for debugging, can be disabled in production)
        if not settings.is_production:
            response.headers["Server-Timing"] = f"app;dur={process_time * 1000:.2f}"
        
        # Remove server header for security
        if "server" in response.headers:
            del response.headers["server"]
        
        # Cache control for security-sensitive responses
        if request.url.path.startswith("/auth/") or request.url.path.startswith("/api/users/"):
            response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, private"
            response.headers["Pragma"] = "no-cache"
            response.headers["Expires"] = "0"


class CSRFProtectMiddleware(BaseHTTPMiddleware):
    """
    CSRF Protection middleware for state-changing operations.
    Uses double-submit cookie pattern.
    """
    
    def __init__(
        self,
        app: ASGIApp,
        *,
        cookie_name: str = "csrf_token",
        header_name: str = "X-CSRF-Token",
        safe_methods: Set[str] = {"GET", "HEAD", "OPTIONS", "TRACE"},
        excluded_paths: Optional[Set[str]] = None,
        token_length: int = 32,
        max_age: int = 86400,  # 24 hours
    ):
        super().__init__(app)
        self.cookie_name = cookie_name
        self.header_name = header_name
        self.safe_methods = safe_methods
        self.excluded_paths = excluded_paths or {
            "/auth/login",
            "/auth/register",
            "/auth/token",
            "/health",
            "/docs",
            "/redoc",
            "/openapi.json"
        }
        self.token_length = token_length
        self.max_age = max_age
    
    async def dispatch(
        self,
        request: Request,
        call_next: RequestResponseEndpoint
    ) -> Response:
        """Process CSRF protection."""
        
        # Skip CSRF check for safe methods
        if request.method in self.safe_methods:
            response = await call_next(request)
            return self._ensure_csrf_cookie(request, response)
        
        # Skip CSRF check for excluded paths
        if any(request.url.path.startswith(path) for path in self.excluded_paths):
            return await call_next(request)
        
        # Validate CSRF token
        csrf_cookie = request.cookies.get(self.cookie_name)
        csrf_header = request.headers.get(self.header_name)
        
        if not csrf_cookie or not csrf_header:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="CSRF token missing"
            )
        
        if not secrets.compare_digest(csrf_cookie, csrf_header):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="CSRF token invalid"
            )
        
        # Process request
        response = await call_next(request)
        
        # Ensure CSRF cookie is set
        return self._ensure_csrf_cookie(request, response)
    
    def _ensure_csrf_cookie(self, request: Request, response: Response) -> Response:
        """Ensure CSRF cookie is set in response."""
        
        # Check if cookie already exists
        csrf_token = request.cookies.get(self.cookie_name)
        
        # Generate new token if needed
        if not csrf_token:
            csrf_token = secrets.token_urlsafe(self.token_length)
            
            # Set cookie
            response.set_cookie(
                key=self.cookie_name,
                value=csrf_token,
                max_age=self.max_age,
                httponly=False,  # Must be readable by JavaScript
                secure=settings.session_cookie_secure,
                samesite=settings.session_cookie_samesite,
                path="/"
            )
        
        # Add CSRF token to response headers for easy access
        response.headers["X-CSRF-Token"] = csrf_token
        
        return response


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Rate limiting middleware using Redis for distributed rate limiting.
    Implements sliding window algorithm.
    """
    
    def __init__(
        self,
        app: ASGIApp,
        *,
        requests_per_window: int = 100,
        window_seconds: int = 60,
        burst_size: int = 10,
        excluded_paths: Optional[Set[str]] = None,
        get_client_id: Optional[Callable[[Request], str]] = None,
    ):
        super().__init__(app)
        self.requests_per_window = requests_per_window
        self.window_seconds = window_seconds
        self.burst_size = burst_size
        self.excluded_paths = excluded_paths or {"/health", "/docs", "/redoc", "/openapi.json"}
        self.get_client_id = get_client_id or self._default_get_client_id
    
    def _default_get_client_id(self, request: Request) -> str:
        """Get client identifier from request."""
        # Try to get authenticated user ID
        if hasattr(request.state, "user_id"):
            return f"user:{request.state.user_id}"
        
        # Fall back to IP address
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            client_ip = forwarded_for.split(",")[0].strip()
        else:
            client_ip = request.client.host if request.client else "unknown"
        
        return f"ip:{client_ip}"
    
    async def dispatch(
        self,
        request: Request,
        call_next: RequestResponseEndpoint
    ) -> Response:
        """Apply rate limiting."""
        
        # Skip rate limiting for excluded paths
        if any(request.url.path.startswith(path) for path in self.excluded_paths):
            return await call_next(request)
        
        # Skip if rate limiting is disabled
        if not settings.rate_limit_enabled:
            return await call_next(request)
        
        # Get client identifier
        client_id = self.get_client_id(request)
        
        # Check rate limit
        redis_client = await get_redis_client()
        key = f"rate_limit:{client_id}"
        
        try:
            # Get current request count
            pipe = redis_client.pipeline()
            now = time.time()
            window_start = now - self.window_seconds
            
            # Remove old entries
            pipe.zremrangebyscore(key, 0, window_start)
            
            # Count requests in current window
            pipe.zcard(key)
            
            # Add current request
            pipe.zadd(key, {str(uuid.uuid4()): now})
            
            # Set expiry
            pipe.expire(key, self.window_seconds + 1)
            
            # Execute pipeline
            results = await pipe.execute()
            request_count = results[1]
            
            # Check if rate limit exceeded
            if request_count >= self.requests_per_window:
                # Calculate retry after
                oldest_request = await redis_client.zrange(key, 0, 0, withscores=True)
                if oldest_request:
                    retry_after = int(oldest_request[0][1] + self.window_seconds - now)
                else:
                    retry_after = self.window_seconds
                
                return JSONResponse(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    content={
                        "detail": "Rate limit exceeded",
                        "retry_after": retry_after
                    },
                    headers={
                        "Retry-After": str(retry_after),
                        "X-RateLimit-Limit": str(self.requests_per_window),
                        "X-RateLimit-Remaining": "0",
                        "X-RateLimit-Reset": str(int(now + retry_after))
                    }
                )
            
            # Process request
            response = await call_next(request)
            
            # Add rate limit headers
            response.headers["X-RateLimit-Limit"] = str(self.requests_per_window)
            response.headers["X-RateLimit-Remaining"] = str(
                max(0, self.requests_per_window - request_count - 1)
            )
            response.headers["X-RateLimit-Reset"] = str(int(now + self.window_seconds))
            
            return response
            
        except Exception as e:
            # Log error but don't block request
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Rate limiting error: {e}")
            return await call_next(request)


class RequestSanitizationMiddleware(BaseHTTPMiddleware):
    """
    Advanced request sanitization middleware for file uploads and form data.
    """
    
    def __init__(
        self,
        app: ASGIApp,
        *,
        max_filename_length: int = 255,
        allowed_upload_paths: Optional[Set[str]] = None,
        sanitize_filenames: bool = True,
    ):
        super().__init__(app)
        self.max_filename_length = max_filename_length
        self.allowed_upload_paths = allowed_upload_paths or {
            "/api/upload",
            "/api/users/avatar",
            "/api/recipes/images"
        }
        self.sanitize_filenames = sanitize_filenames
        
        # Compile regex patterns
        self.filename_pattern = re.compile(r'[^\w\s.-]')
        self.multiple_dots = re.compile(r'\.{2,}')
        self.whitespace = re.compile(r'\s+')
    
    async def dispatch(
        self,
        request: Request,
        call_next: RequestResponseEndpoint
    ) -> Response:
        """Process request with advanced sanitization."""
        
        # Only process multipart/form-data requests
        content_type = request.headers.get("content-type", "")
        if not content_type.startswith("multipart/form-data"):
            return await call_next(request)
        
        # Check if this is an upload path
        if not any(request.url.path.startswith(path) for path in self.allowed_upload_paths):
            return await call_next(request)
        
        # Store original form data processor
        if hasattr(request, "_form"):
            original_form = request._form
            
            # Override form data processor to sanitize filenames
            async def sanitized_form():
                form_data = await original_form()
                
                # Sanitize filenames in form data
                for field_name, field_value in form_data.items():
                    if hasattr(field_value, "filename") and field_value.filename:
                        field_value.filename = self._sanitize_filename(field_value.filename)
                
                return form_data
            
            request._form = sanitized_form
        
        return await call_next(request)
    
    def _sanitize_filename(self, filename: str) -> str:
        """Sanitize uploaded filename."""
        if not filename:
            return "unnamed"
        
        # Get base name and extension
        name, ext = os.path.splitext(filename)
        
        # Remove path components
        name = os.path.basename(name)
        ext = os.path.basename(ext)
        
        if self.sanitize_filenames:
            # Replace non-alphanumeric characters
            name = self.filename_pattern.sub("_", name)
            
            # Replace multiple dots
            name = self.multiple_dots.sub(".", name)
            
            # Replace whitespace with single underscore
            name = self.whitespace.sub("_", name)
            
            # Remove leading/trailing dots and underscores
            name = name.strip("._")
        
        # Ensure filename is not empty
        if not name:
            name = "file"
        
        # Truncate if too long
        max_name_length = self.max_filename_length - len(ext) - 1
        if len(name) > max_name_length:
            name = name[:max_name_length]
        
        # Validate extension
        if ext and ext.lower() not in settings.allowed_upload_extensions:
            raise HTTPException(
                status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                detail=f"File type {ext} is not allowed"
            )
        
        return f"{name}{ext}"