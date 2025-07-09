"""
Security headers middleware for admin interface.

Provides comprehensive security headers including:
- Content Security Policy (CSP)
- HTTP Strict Transport Security (HSTS)
- X-Frame-Options
- X-Content-Type-Options
- Referrer Policy
- Permissions Policy
"""

from typing import Dict, Any, Optional, List, Callable
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.types import ASGIApp
import hashlib
import secrets
import base64


class SecurityHeadersConfig:
    """Configuration for security headers."""
    
    # HSTS settings
    HSTS_MAX_AGE = 31536000  # 1 year
    HSTS_INCLUDE_SUBDOMAINS = True
    HSTS_PRELOAD = True
    
    # CSP settings
    CSP_DEFAULT_SRC = ["'self'"]
    CSP_SCRIPT_SRC = ["'self'", "'strict-dynamic'"]
    CSP_STYLE_SRC = ["'self'", "'unsafe-inline'"]  # May need for admin UI
    CSP_IMG_SRC = ["'self'", "data:", "https:"]
    CSP_FONT_SRC = ["'self'", "data:"]
    CSP_CONNECT_SRC = ["'self'"]
    CSP_FRAME_SRC = ["'none'"]
    CSP_OBJECT_SRC = ["'none'"]
    CSP_BASE_URI = ["'self'"]
    CSP_FORM_ACTION = ["'self'"]
    CSP_FRAME_ANCESTORS = ["'none'"]
    CSP_UPGRADE_INSECURE_REQUESTS = True
    CSP_BLOCK_ALL_MIXED_CONTENT = True
    
    # Frame options
    X_FRAME_OPTIONS = "DENY"
    
    # Content type options
    X_CONTENT_TYPE_OPTIONS = "nosniff"
    
    # Referrer policy
    REFERRER_POLICY = "strict-origin-when-cross-origin"
    
    # Permissions policy
    PERMISSIONS_POLICY = {
        "accelerometer": "()",
        "camera": "()",
        "geolocation": "()",
        "gyroscope": "()",
        "magnetometer": "()",
        "microphone": "()",
        "payment": "()",
        "usb": "()"
    }
    
    # Custom headers
    X_POWERED_BY = None  # Remove or set to custom value
    
    # Nonce settings
    USE_CSP_NONCE = True
    NONCE_LENGTH = 32


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Middleware to add security headers to responses."""
    
    def __init__(
        self,
        app: ASGIApp,
        config: Optional[SecurityHeadersConfig] = None,
        admin_path_prefix: str = "/admin"
    ):
        super().__init__(app)
        self.config = config or SecurityHeadersConfig()
        self.admin_path_prefix = admin_path_prefix
    
    async def dispatch(
        self,
        request: Request,
        call_next: RequestResponseEndpoint
    ) -> Response:
        """Process request and add security headers to response."""
        # Only apply to admin routes
        if not request.url.path.startswith(self.admin_path_prefix):
            return await call_next(request)
        
        # Generate CSP nonce if enabled
        nonce = None
        if self.config.USE_CSP_NONCE:
            nonce = self._generate_nonce()
            request.state.csp_nonce = nonce
        
        # Process request
        response = await call_next(request)
        
        # Add security headers
        self._add_security_headers(response, nonce)
        
        return response
    
    def _add_security_headers(
        self,
        response: Response,
        nonce: Optional[str] = None
    ) -> None:
        """Add all security headers to response."""
        # HSTS
        hsts_value = f"max-age={self.config.HSTS_MAX_AGE}"
        if self.config.HSTS_INCLUDE_SUBDOMAINS:
            hsts_value += "; includeSubDomains"
        if self.config.HSTS_PRELOAD:
            hsts_value += "; preload"
        response.headers["Strict-Transport-Security"] = hsts_value
        
        # CSP
        csp_directives = self._build_csp_directives(nonce)
        response.headers["Content-Security-Policy"] = csp_directives
        
        # Frame options
        response.headers["X-Frame-Options"] = self.config.X_FRAME_OPTIONS
        
        # Content type options
        response.headers["X-Content-Type-Options"] = self.config.X_CONTENT_TYPE_OPTIONS
        
        # Referrer policy
        response.headers["Referrer-Policy"] = self.config.REFERRER_POLICY
        
        # Permissions policy
        permissions = self._build_permissions_policy()
        response.headers["Permissions-Policy"] = permissions
        
        # Remove or set X-Powered-By
        if self.config.X_POWERED_BY is None:
            response.headers.pop("X-Powered-By", None)
        else:
            response.headers["X-Powered-By"] = self.config.X_POWERED_BY
        
        # Additional security headers
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["X-DNS-Prefetch-Control"] = "off"
        response.headers["X-Download-Options"] = "noopen"
        response.headers["X-Permitted-Cross-Domain-Policies"] = "none"
    
    def _build_csp_directives(self, nonce: Optional[str] = None) -> str:
        """Build Content Security Policy directives."""
        directives = []
        
        # Default src
        directives.append(f"default-src {' '.join(self.config.CSP_DEFAULT_SRC)}")
        
        # Script src
        script_src = self.config.CSP_SCRIPT_SRC.copy()
        if nonce:
            script_src.append(f"'nonce-{nonce}'")
        directives.append(f"script-src {' '.join(script_src)}")
        
        # Style src
        style_src = self.config.CSP_STYLE_SRC.copy()
        if nonce:
            style_src.append(f"'nonce-{nonce}'")
        directives.append(f"style-src {' '.join(style_src)}")
        
        # Other sources
        directives.append(f"img-src {' '.join(self.config.CSP_IMG_SRC)}")
        directives.append(f"font-src {' '.join(self.config.CSP_FONT_SRC)}")
        directives.append(f"connect-src {' '.join(self.config.CSP_CONNECT_SRC)}")
        directives.append(f"frame-src {' '.join(self.config.CSP_FRAME_SRC)}")
        directives.append(f"object-src {' '.join(self.config.CSP_OBJECT_SRC)}")
        directives.append(f"base-uri {' '.join(self.config.CSP_BASE_URI)}")
        directives.append(f"form-action {' '.join(self.config.CSP_FORM_ACTION)}")
        directives.append(f"frame-ancestors {' '.join(self.config.CSP_FRAME_ANCESTORS)}")
        
        # Additional directives
        if self.config.CSP_UPGRADE_INSECURE_REQUESTS:
            directives.append("upgrade-insecure-requests")
        
        if self.config.CSP_BLOCK_ALL_MIXED_CONTENT:
            directives.append("block-all-mixed-content")
        
        # Report URI (if configured)
        # directives.append("report-uri /csp-report")
        
        return "; ".join(directives)
    
    def _build_permissions_policy(self) -> str:
        """Build Permissions Policy header."""
        policies = []
        
        for feature, allowlist in self.config.PERMISSIONS_POLICY.items():
            policies.append(f"{feature}={allowlist}")
        
        return ", ".join(policies)
    
    def _generate_nonce(self) -> str:
        """Generate a secure nonce for CSP."""
        random_bytes = secrets.token_bytes(self.config.NONCE_LENGTH)
        return base64.b64encode(random_bytes).decode('ascii')


class SecurityHeadersBuilder:
    """Builder for customizing security headers configuration."""
    
    def __init__(self):
        self.config = SecurityHeadersConfig()
    
    def with_hsts(
        self,
        max_age: int = 31536000,
        include_subdomains: bool = True,
        preload: bool = True
    ) -> 'SecurityHeadersBuilder':
        """Configure HSTS settings."""
        self.config.HSTS_MAX_AGE = max_age
        self.config.HSTS_INCLUDE_SUBDOMAINS = include_subdomains
        self.config.HSTS_PRELOAD = preload
        return self
    
    def with_csp(
        self,
        default_src: Optional[List[str]] = None,
        script_src: Optional[List[str]] = None,
        style_src: Optional[List[str]] = None,
        img_src: Optional[List[str]] = None,
        use_nonce: bool = True
    ) -> 'SecurityHeadersBuilder':
        """Configure CSP settings."""
        if default_src is not None:
            self.config.CSP_DEFAULT_SRC = default_src
        if script_src is not None:
            self.config.CSP_SCRIPT_SRC = script_src
        if style_src is not None:
            self.config.CSP_STYLE_SRC = style_src
        if img_src is not None:
            self.config.CSP_IMG_SRC = img_src
        self.config.USE_CSP_NONCE = use_nonce
        return self
    
    def with_frame_options(self, value: str = "DENY") -> 'SecurityHeadersBuilder':
        """Configure X-Frame-Options."""
        self.config.X_FRAME_OPTIONS = value
        return self
    
    def with_referrer_policy(self, policy: str) -> 'SecurityHeadersBuilder':
        """Configure Referrer-Policy."""
        self.config.REFERRER_POLICY = policy
        return self
    
    def with_permissions_policy(
        self,
        policies: Dict[str, str]
    ) -> 'SecurityHeadersBuilder':
        """Configure Permissions-Policy."""
        self.config.PERMISSIONS_POLICY = policies
        return self
    
    def build(self) -> SecurityHeadersConfig:
        """Build the configuration."""
        return self.config


def create_admin_security_headers() -> SecurityHeadersConfig:
    """Create security headers configuration for admin interface."""
    return (
        SecurityHeadersBuilder()
        .with_hsts(max_age=31536000, include_subdomains=True, preload=True)
        .with_csp(
            default_src=["'self'"],
            script_src=["'self'", "'strict-dynamic'"],
            style_src=["'self'", "'unsafe-inline'"],  # May need for admin UI
            img_src=["'self'", "data:", "https:"],
            use_nonce=True
        )
        .with_frame_options("DENY")
        .with_referrer_policy("strict-origin-when-cross-origin")
        .with_permissions_policy({
            "accelerometer": "()",
            "camera": "()",
            "geolocation": "()",
            "gyroscope": "()",
            "magnetometer": "()",
            "microphone": "()",
            "payment": "()",
            "usb": "()"
        })
        .build()
    )