"""
Tests for audit logging middleware.

Tests that the middleware correctly intercepts and logs administrative actions.
"""

import pytest
from unittest.mock import Mock, AsyncMock, patch
from uuid import uuid4
import json

from fastapi import FastAPI, Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import RequestResponseEndpoint

from jidelnicek.admin.middleware.audit_middleware import AuditLoggingMiddleware
from jidelnicek.admin.models import AdminAction
from jidelnicek.auth.models import AuthUser


@pytest.fixture
def app():
    """Create a test FastAPI app."""
    return FastAPI()


@pytest.fixture
def middleware(app):
    """Create audit middleware instance."""
    return AuditLoggingMiddleware(app)


@pytest.fixture
def mock_user():
    """Create a mock authenticated user."""
    user = Mock(spec=AuthUser)
    user.id = uuid4()
    user.email = "admin@test.com"
    user.role = "admin"
    return user


class TestActionMapping:
    """Test action determination from requests."""
    
    def test_determine_user_list_action(self, middleware):
        """Test mapping GET /admin/users to USER_LIST action."""
        request = Mock(spec=Request)
        request.method = "GET"
        request.url.path = "/admin/users"
        
        action = middleware._determine_action(request)
        assert action == AdminAction.USER_LIST
    
    def test_determine_user_create_action(self, middleware):
        """Test mapping POST /admin/users to USER_CREATE action."""
        request = Mock(spec=Request)
        request.method = "POST"
        request.url.path = "/admin/users"
        
        action = middleware._determine_action(request)
        assert action == AdminAction.USER_CREATE
    
    def test_determine_user_update_action(self, middleware):
        """Test mapping PUT /admin/users/{id} to USER_UPDATE action."""
        request = Mock(spec=Request)
        request.method = "PUT"
        request.url.path = "/admin/users/123e4567-e89b-12d3-a456-426614174000"
        
        action = middleware._determine_action(request)
        assert action == AdminAction.USER_UPDATE
    
    def test_determine_bulk_operation(self, middleware):
        """Test determining bulk operation from request body."""
        request = Mock(spec=Request)
        request.method = "POST"
        request.url.path = "/admin/users/bulk"
        request._body = json.dumps({"operation": "suspend"}).encode()
        
        action = middleware._determine_action(request)
        assert action == AdminAction.BULK_SUSPEND
    
    def test_unknown_path_returns_none(self, middleware):
        """Test that unknown paths return None."""
        request = Mock(spec=Request)
        request.method = "GET"
        request.url.path = "/admin/unknown/endpoint"
        
        action = middleware._determine_action(request)
        assert action is None


class TestTargetExtraction:
    """Test extraction of target information from requests."""
    
    def test_extract_user_target(self, middleware):
        """Test extracting user target information."""
        request = Mock(spec=Request)
        request.path_params = {"user_id": str(uuid4())}
        
        target_info = middleware._extract_target_info(
            request,
            AdminAction.USER_UPDATE
        )
        
        assert target_info["target_type"] == "user"
        assert target_info["target_id"] == request.path_params["user_id"]
    
    def test_extract_bulk_targets(self, middleware):
        """Test extracting bulk operation targets."""
        user_ids = [str(uuid4()) for _ in range(3)]
        
        request = Mock(spec=Request)
        request.path_params = {}
        request._body = json.dumps({"user_ids": user_ids}).encode()
        
        target_info = middleware._extract_target_info(
            request,
            AdminAction.BULK_SUSPEND
        )
        
        assert target_info["target_type"] == "user"
        assert target_info["target_ids"] == user_ids
    
    def test_extract_ingredient_target(self, middleware):
        """Test extracting ingredient target information."""
        request = Mock(spec=Request)
        request.path_params = {"ingredient_id": str(uuid4())}
        
        target_info = middleware._extract_target_info(
            request,
            AdminAction.INGREDIENT_UPDATE
        )
        
        assert target_info["target_type"] == "ingredient"
        assert target_info["target_id"] == request.path_params["ingredient_id"]


class TestSensitiveDataRedaction:
    """Test redaction of sensitive information."""
    
    def test_redact_password_fields(self, middleware):
        """Test that password fields are redacted."""
        data = {
            "email": "user@test.com",
            "password": "secret123",
            "new_password": "newsecret456",
            "profile": {
                "name": "Test User",
                "api_key": "sk-12345"
            }
        }
        
        redacted = middleware._redact_sensitive_data(data)
        
        assert redacted["email"] == "user@test.com"
        assert redacted["password"] == "[REDACTED]"
        assert redacted["new_password"] == "[REDACTED]"
        assert redacted["profile"]["name"] == "Test User"
        assert redacted["profile"]["api_key"] == "[REDACTED]"
    
    def test_redact_in_arrays(self, middleware):
        """Test redaction in arrays."""
        data = {
            "users": [
                {"email": "user1@test.com", "password": "pass1"},
                {"email": "user2@test.com", "password": "pass2"}
            ]
        }
        
        redacted = middleware._redact_sensitive_data(data)
        
        for user in redacted["users"]:
            assert user["password"] == "[REDACTED]"
            assert "@test.com" in user["email"]


class TestRequestCapture:
    """Test request data capture."""
    
    async def test_capture_request_data(self, middleware):
        """Test capturing request context."""
        request = Mock(spec=Request)
        request.method = "PUT"
        request.url.path = "/admin/users/123"
        request.query_params = {"include_sessions": "true"}
        request.path_params = {"user_id": "123"}
        request.headers = {
            "user-agent": "Mozilla/5.0",
            "x-request-id": "req-123",
            "authorization": "Bearer secret-token"
        }
        request.client = Mock(host="192.168.1.100")
        
        data = await middleware._capture_request_data(request)
        
        assert data["method"] == "PUT"
        assert data["path"] == "/admin/users/123"
        assert data["query_params"]["include_sessions"] == "true"
        assert data["client_host"] == "192.168.1.100"
        assert data["user_agent"] == "Mozilla/5.0"
        assert data["request_id"] == "req-123"
        # Sensitive headers should be excluded
        assert "authorization" not in data


class TestMiddlewareIntegration:
    """Test full middleware integration."""
    
    @pytest.mark.asyncio
    async def test_successful_action_logging(self, middleware, mock_user):
        """Test logging a successful admin action."""
        # Create mock request
        request = Mock(spec=Request)
        request.url.path = "/admin/users/123"
        request.method = "PUT"
        request.state.user = mock_user
        request.headers = {"user-agent": "TestAgent"}
        request.query_params = {}
        request.path_params = {"user_id": "123"}
        request.client = Mock(host="127.0.0.1")
        request._body = json.dumps({"email": "new@test.com"}).encode()
        
        # Mock response
        response = Response(content="OK", status_code=200)
        
        # Mock call_next
        async def mock_call_next(req):
            return response
        
        # Mock database session
        with patch('jidelnicek.admin.middleware.audit_middleware.DatabaseSession') as mock_db:
            mock_session = AsyncMock()
            mock_db.return_value.__aenter__.return_value = mock_session
            
            # Mock audit system
            with patch('jidelnicek.admin.middleware.audit_middleware.AdvancedAuditSystem') as mock_audit:
                mock_audit_instance = AsyncMock()
                mock_audit.return_value = mock_audit_instance
                
                # Call middleware
                result = await middleware.dispatch(request, mock_call_next)
                
                # Verify response
                assert result.status_code == 200
                
                # Verify audit log was created
                mock_audit_instance.log_action.assert_called_once()
                call_args = mock_audit_instance.log_action.call_args.kwargs
                
                assert call_args["admin_id"] == mock_user.id
                assert call_args["action"] == AdminAction.USER_UPDATE
                assert call_args["target_type"] == "user"
                assert call_args["target_id"] == "123"
                assert call_args["success"] is True
                assert call_args["ip_address"] == "127.0.0.1"
    
    @pytest.mark.asyncio
    async def test_failed_action_logging(self, middleware, mock_user):
        """Test logging a failed admin action."""
        # Create mock request
        request = Mock(spec=Request)
        request.url.path = "/admin/users/123"
        request.method = "DELETE"
        request.state.user = mock_user
        request.headers = {}
        request.query_params = {}
        request.path_params = {"user_id": "123"}
        request.client = None
        
        # Mock error response
        error_response = JSONResponse(
            content={"detail": "User has active sessions"},
            status_code=400
        )
        
        # Mock call_next to raise error
        async def mock_call_next(req):
            return error_response
        
        # Mock database session
        with patch('jidelnicek.admin.middleware.audit_middleware.DatabaseSession') as mock_db:
            mock_session = AsyncMock()
            mock_db.return_value.__aenter__.return_value = mock_session
            
            # Mock audit system
            with patch('jidelnicek.admin.middleware.audit_middleware.AdvancedAuditSystem') as mock_audit:
                mock_audit_instance = AsyncMock()
                mock_audit.return_value = mock_audit_instance
                
                # Call middleware
                result = await middleware.dispatch(request, mock_call_next)
                
                # Verify response
                assert result.status_code == 400
                
                # Verify audit log was created with failure
                mock_audit_instance.log_action.assert_called_once()
                call_args = mock_audit_instance.log_action.call_args.kwargs
                
                assert call_args["action"] == AdminAction.USER_DELETE
                assert call_args["success"] is False
                assert "active sessions" in call_args["error_message"]
    
    @pytest.mark.asyncio
    async def test_skip_non_admin_paths(self, middleware):
        """Test that non-admin paths are skipped."""
        request = Mock(spec=Request)
        request.url.path = "/api/v1/recipes"
        
        response = Response(content="OK")
        
        async def mock_call_next(req):
            return response
        
        # No database mocking needed - should skip before that
        result = await middleware.dispatch(request, mock_call_next)
        
        assert result == response
    
    @pytest.mark.asyncio
    async def test_skip_excluded_paths(self, middleware):
        """Test that excluded admin paths are skipped."""
        request = Mock(spec=Request)
        request.url.path = "/admin/health"
        
        response = Response(content="OK")
        
        async def mock_call_next(req):
            return response
        
        result = await middleware.dispatch(request, mock_call_next)
        
        assert result == response
    
    @pytest.mark.asyncio
    async def test_handle_unexpected_error(self, middleware, mock_user):
        """Test handling of unexpected errors during request processing."""
        request = Mock(spec=Request)
        request.url.path = "/admin/users"
        request.method = "GET"
        request.state.user = mock_user
        request.headers = {}
        request.query_params = {}
        request.path_params = {}
        request.client = None
        
        # Mock call_next to raise exception
        async def mock_call_next(req):
            raise Exception("Unexpected error")
        
        with patch('jidelnicek.admin.middleware.audit_middleware.DatabaseSession') as mock_db:
            mock_session = AsyncMock()
            mock_db.return_value.__aenter__.return_value = mock_session
            
            with patch('jidelnicek.admin.middleware.audit_middleware.AdvancedAuditSystem') as mock_audit:
                mock_audit_instance = AsyncMock()
                mock_audit.return_value = mock_audit_instance
                
                # Call middleware
                result = await middleware.dispatch(request, mock_call_next)
                
                # Should return 500 error
                assert result.status_code == 500
                
                # Should still log with failure
                mock_audit_instance.log_action.assert_called_once()
                call_args = mock_audit_instance.log_action.call_args.kwargs
                
                assert call_args["success"] is False
                assert "Internal error" in call_args["error_message"]


class TestPerformanceTracking:
    """Test performance metric tracking."""
    
    @pytest.mark.asyncio
    async def test_response_time_tracking(self, middleware, mock_user):
        """Test that response time is tracked."""
        request = Mock(spec=Request)
        request.url.path = "/admin/users"
        request.method = "GET"
        request.state.user = mock_user
        request.headers = {}
        request.query_params = {}
        request.path_params = {}
        request.client = None
        
        response = Response(content="OK")
        
        # Add delay to simulate processing time
        async def mock_call_next(req):
            import asyncio
            await asyncio.sleep(0.1)  # 100ms delay
            return response
        
        with patch('jidelnicek.admin.middleware.audit_middleware.DatabaseSession') as mock_db:
            mock_session = AsyncMock()
            mock_db.return_value.__aenter__.return_value = mock_session
            
            with patch('jidelnicek.admin.middleware.audit_middleware.AdvancedAuditSystem') as mock_audit:
                mock_audit_instance = AsyncMock()
                mock_audit.return_value = mock_audit_instance
                
                # Call middleware
                await middleware.dispatch(request, mock_call_next)
                
                # Verify response time was tracked
                call_args = mock_audit_instance.log_action.call_args.kwargs
                
                assert "response_time_ms" in call_args
                assert call_args["response_time_ms"] >= 100  # At least 100ms