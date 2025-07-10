"""
Test security middleware and headers.
"""

import pytest
import httpx
from httpx import AsyncClient
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
import secrets

from jidelnicek.core.middleware.security import (
    SecurityMiddleware,
    CSRFProtectMiddleware,
    RateLimitMiddleware,
    RequestSanitizationMiddleware
)
from jidelnicek.core.config import settings


class TestSecurityMiddleware:
    """Test security headers middleware."""
    
    @pytest.mark.asyncio
    async def test_security_headers_added(self, authenticated_client: AsyncClient):
        """Test that security headers are added to responses."""
        response = await authenticated_client.get("/health")
        
        # Check security headers
        assert response.headers.get("X-Content-Type-Options") == "nosniff"
        assert response.headers.get("X-Frame-Options") == "DENY"
        assert response.headers.get("X-XSS-Protection") == "1; mode=block"
        assert response.headers.get("Referrer-Policy") == "strict-origin-when-cross-origin"
        assert "Content-Security-Policy" in response.headers
        assert "Permissions-Policy" in response.headers
        assert response.headers.get("X-Permitted-Cross-Domain-Policies") == "none"
        assert response.headers.get("X-Download-Options") == "noopen"
        assert response.headers.get("X-DNS-Prefetch-Control") == "off"
    
    @pytest.mark.asyncio
    async def test_hsts_header_in_production(self, monkeypatch):
        """Test HSTS header is added in production."""
        # Create a test app with security middleware
        app = FastAPI()
        app.add_middleware(
            SecurityMiddleware,
            hsts_max_age=31536000,
            hsts_include_subdomains=True,
            hsts_preload=True
        )
        
        @app.get("/test")
        async def test_endpoint():
            return {"status": "ok"}
        
        # Mock production environment
        monkeypatch.setattr(settings, "environment", "production")
        
        async with AsyncClient(transport=httpx.ASGITransport(app=app), base_url="https://test.com") as client:
            response = await client.get("/test")
            
            hsts_header = response.headers.get("Strict-Transport-Security")
            assert hsts_header is not None
            assert "max-age=31536000" in hsts_header
            assert "includeSubDomains" in hsts_header
            assert "preload" in hsts_header
    
    @pytest.mark.asyncio
    async def test_api_version_headers(self, authenticated_client: AsyncClient):
        """Test API versioning headers."""
        response = await authenticated_client.get("/health")
        
        assert response.headers.get("API-Version") == "2.0.0"
        assert "1.0.0" in response.headers.get("API-Supported-Versions", "")
        assert "2.0.0" in response.headers.get("API-Supported-Versions", "")
    
    @pytest.mark.asyncio
    async def test_api_version_negotiation(self, authenticated_client: AsyncClient):
        """Test API version negotiation."""
        # Request with supported version
        response = await authenticated_client.get("/health", headers={"API-Version": "1.0.0"})
        assert response.status_code == 200
        assert response.headers.get("API-Deprecation") == "true"
        assert "API-Deprecation-Date" in response.headers
        assert "API-Deprecation-Info" in response.headers
        
        # Request with unsupported version
        response = await authenticated_client.get("/health", headers={"API-Version": "0.9.0"})
        assert response.status_code == 406
        assert "Unsupported API version" in response.json()["detail"]
    
    @pytest.mark.asyncio
    async def test_request_id_header(self, authenticated_client: AsyncClient):
        """Test that request ID is added to responses."""
        response = await authenticated_client.get("/health")
        
        assert "X-Request-ID" in response.headers
        request_id = response.headers["X-Request-ID"]
        
        # Validate UUID format
        import uuid
        uuid.UUID(request_id)  # Should not raise
    
    @pytest.mark.asyncio
    async def test_server_header_removed(self, authenticated_client: AsyncClient):
        """Test that server header is removed for security."""
        response = await authenticated_client.get("/health")
        assert "server" not in response.headers
        assert "Server" not in response.headers
    
    @pytest.mark.asyncio
    async def test_cache_control_for_auth_endpoints(self, authenticated_client: AsyncClient):
        """Test cache control headers for security-sensitive endpoints."""
        # Login endpoint should have no-cache headers
        response = await authenticated_client.post(
            "/auth/login",
            json={"username": "test", "password": "test"}
        )
        
        assert response.headers.get("Cache-Control") == "no-store, no-cache, must-revalidate, private"
        assert response.headers.get("Pragma") == "no-cache"
        assert response.headers.get("Expires") == "0"


class TestCSRFProtection:
    """Test CSRF protection middleware."""
    
    @pytest.mark.asyncio
    async def test_csrf_token_generated_on_safe_methods(self, authenticated_client: AsyncClient):
        """Test CSRF token is generated on GET requests."""
        response = await authenticated_client.get("/health")
        
        # Check CSRF token in headers
        assert "X-CSRF-Token" in response.headers
        csrf_token = response.headers["X-CSRF-Token"]
        
        # Check CSRF cookie
        cookies = response.cookies
        assert "jidelnicek_csrf" in cookies
        assert cookies["jidelnicek_csrf"] == csrf_token
    
    @pytest.mark.asyncio
    async def test_csrf_protection_on_state_changing_methods(self):
        """Test CSRF protection on POST/PUT/DELETE requests."""
        app = FastAPI()
        app.add_middleware(CSRFProtectMiddleware, cookie_name="test_csrf")
        
        @app.post("/test")
        async def test_post():
            return {"status": "ok"}
        
        async with AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
            # First GET to get CSRF token
            get_response = await client.get("/")
            csrf_token = get_response.headers.get("X-CSRF-Token")
            
            # POST without CSRF token should fail
            post_response = await client.post("/test", json={"data": "test"})
            assert post_response.status_code == 403
            assert "CSRF token missing" in post_response.json()["detail"]
            
            # POST with wrong CSRF token should fail
            post_response = await client.post(
                "/test",
                json={"data": "test"},
                headers={"X-CSRF-Token": "wrong-token"},
                cookies={"test_csrf": csrf_token}
            )
            assert post_response.status_code == 403
            assert "CSRF token invalid" in post_response.json()["detail"]
            
            # POST with correct CSRF token should succeed
            post_response = await client.post(
                "/test",
                json={"data": "test"},
                headers={"X-CSRF-Token": csrf_token},
                cookies={"test_csrf": csrf_token}
            )
            assert post_response.status_code == 200
    
    @pytest.mark.asyncio
    async def test_csrf_excluded_paths(self):
        """Test CSRF protection is skipped for excluded paths."""
        app = FastAPI()
        app.add_middleware(
            CSRFProtectMiddleware,
            excluded_paths={"/auth/login", "/auth/register"}
        )
        
        @app.post("/auth/login")
        async def login():
            return {"status": "ok"}
        
        @app.post("/protected")
        async def protected():
            return {"status": "ok"}
        
        async with AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
            # Excluded path should work without CSRF
            response = await client.post("/auth/login", json={"data": "test"})
            assert response.status_code == 200
            
            # Non-excluded path should require CSRF
            response = await client.post("/protected", json={"data": "test"})
            assert response.status_code == 403


class TestRateLimiting:
    """Test rate limiting middleware."""
    
    @pytest.mark.asyncio
    async def test_rate_limit_headers(self, authenticated_client: AsyncClient):
        """Test rate limit headers are added to responses."""
        if not settings.rate_limit_enabled:
            pytest.skip("Rate limiting is disabled")
        
        response = await authenticated_client.get("/health")
        
        assert "X-RateLimit-Limit" in response.headers
        assert "X-RateLimit-Remaining" in response.headers
        assert "X-RateLimit-Reset" in response.headers
        
        limit = int(response.headers["X-RateLimit-Limit"])
        remaining = int(response.headers["X-RateLimit-Remaining"])
        
        assert limit == settings.rate_limit_requests
        assert remaining < limit
    
    @pytest.mark.asyncio
    async def test_rate_limit_exceeded(self, monkeypatch):
        """Test rate limiting when limit is exceeded."""
        # Create app with strict rate limit
        app = FastAPI()
        app.add_middleware(
            RateLimitMiddleware,
            requests_per_window=5,
            window_seconds=60,
            burst_size=1
        )
        
        @app.get("/test")
        async def test_endpoint():
            return {"status": "ok"}
        
        async with AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
            # Make requests up to the limit
            for i in range(5):
                response = await client.get("/test")
                assert response.status_code == 200
                
                remaining = int(response.headers["X-RateLimit-Remaining"])
                assert remaining == 4 - i
            
            # Next request should be rate limited
            response = await client.get("/test")
            assert response.status_code == 429
            assert "Rate limit exceeded" in response.json()["detail"]
            assert "Retry-After" in response.headers
    
    @pytest.mark.asyncio
    async def test_rate_limit_excluded_paths(self):
        """Test rate limiting is skipped for excluded paths."""
        app = FastAPI()
        app.add_middleware(
            RateLimitMiddleware,
            requests_per_window=1,
            window_seconds=60,
            excluded_paths={"/health"}
        )
        
        @app.get("/health")
        async def health():
            return {"status": "ok"}
        
        @app.get("/limited")
        async def limited():
            return {"status": "ok"}
        
        async with AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
            # Excluded path should not be rate limited
            for _ in range(5):
                response = await client.get("/health")
                assert response.status_code == 200
            
            # Non-excluded path should be rate limited
            response = await client.get("/limited")
            assert response.status_code == 200
            
            response = await client.get("/limited")
            assert response.status_code == 429


class TestRequestSanitization:
    """Test request sanitization middleware."""
    
    @pytest.mark.asyncio
    async def test_request_size_limit(self):
        """Test request size limit enforcement."""
        app = FastAPI()
        app.add_middleware(
            SecurityMiddleware,
            max_request_size=1024  # 1KB limit for testing
        )
        
        @app.post("/upload")
        async def upload(request: Request):
            return {"status": "ok"}
        
        async with AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
            # Small request should pass
            response = await client.post(
                "/upload",
                content=b"x" * 512,
                headers={"Content-Length": "512"}
            )
            assert response.status_code == 200
            
            # Large request should fail
            response = await client.post(
                "/upload",
                content=b"x" * 2048,
                headers={"Content-Length": "2048"}
            )
            assert response.status_code == 413
            assert "Request size exceeds maximum" in response.json()["detail"]
    
    @pytest.mark.asyncio
    async def test_null_byte_sanitization(self):
        """Test null byte removal from headers."""
        app = FastAPI()
        app.add_middleware(SecurityMiddleware)
        
        @app.get("/test")
        async def test(request: Request):
            return {"header": request.headers.get("X-Test", "")}
        
        async with AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
            # Request with null byte in header should fail
            response = await client.get(
                "/test",
                headers={"X-Test": "value\x00with\x00nulls"}
            )
            assert response.status_code == 400
            assert "Invalid characters in header" in response.json()["detail"]
    
    @pytest.mark.asyncio
    async def test_filename_sanitization(self):
        """Test filename sanitization for uploads."""
        middleware = RequestSanitizationMiddleware(
            app=None,
            sanitize_filenames=True,
            max_filename_length=50
        )
        
        # Test various malicious filenames
        test_cases = [
            ("../../../etc/passwd", "etc_passwd"),
            ("file\x00name.txt", "file_name.txt"),
            ("file   with   spaces.pdf", "file_with_spaces.pdf"),
            ("....hidden....file....", "hidden_file"),
            ("very" + "long" * 20 + "name.txt", "verylonglonglonglonglonglonglonglon.txt"),
            ("", "unnamed"),
            ("COM1.txt", "COM1.txt"),  # Windows reserved name
            ("file<>:|?*.txt", "file______.txt"),
        ]
        
        for input_name, expected_name in test_cases:
            sanitized = middleware._sanitize_filename(input_name)
            assert sanitized == expected_name
    
    @pytest.mark.asyncio
    async def test_content_type_validation(self):
        """Test content type validation for POST/PUT/PATCH requests."""
        app = FastAPI()
        app.add_middleware(SecurityMiddleware)
        
        @app.post("/test")
        async def test():
            return {"status": "ok"}
        
        async with AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
            # POST without Content-Type should fail
            response = await client.request(
                "POST",
                "/test",
                content=b"test",
                headers={k: v for k, v in client.headers.items() if k.lower() != "content-type"}
            )
            assert response.status_code == 415
            assert "Content-Type header is required" in response.json()["detail"]


class TestCORSConfiguration:
    """Test CORS configuration."""
    
    @pytest.mark.asyncio
    async def test_cors_headers(self, authenticated_client: AsyncClient):
        """Test CORS headers are properly configured."""
        # Preflight request
        response = await authenticated_client.options(
            "/api/test",
            headers={
                "Origin": settings.cors_origins[0] if settings.cors_origins else "http://localhost:3000",
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "Content-Type, X-CSRF-Token"
            }
        )
        
        # Check CORS headers
        assert "Access-Control-Allow-Origin" in response.headers
        assert "Access-Control-Allow-Methods" in response.headers
        assert "Access-Control-Allow-Headers" in response.headers
        assert "Access-Control-Max-Age" in response.headers
        
        if settings.cors_allow_credentials:
            assert response.headers.get("Access-Control-Allow-Credentials") == "true"
    
    @pytest.mark.asyncio
    async def test_cors_exposed_headers(self, authenticated_client: AsyncClient):
        """Test CORS exposed headers configuration."""
        origin = settings.cors_origins[0] if settings.cors_origins else "http://localhost:3000"
        
        response = await authenticated_client.get(
            "/health",
            headers={"Origin": origin}
        )
        
        # Check exposed headers
        exposed_headers = response.headers.get("Access-Control-Expose-Headers", "")
        expected_headers = [
            "X-Request-ID",
            "X-CSRF-Token",
            "X-RateLimit-Limit",
            "API-Version"
        ]
        
        for header in expected_headers:
            assert header in exposed_headers