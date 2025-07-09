"""
Audit middleware for automatic logging of administrative actions.

This middleware intercepts all admin API requests and automatically
logs them to the audit system with full context.
"""

import time
import json
from typing import Optional, Dict, Any, Callable
from uuid import UUID
import traceback

from fastapi import Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp

from jidelnicek.admin.services.audit_system import AdvancedAuditSystem
from jidelnicek.admin.models import AdminAction
from jidelnicek.core.dependencies import DatabaseSession


class AuditLoggingMiddleware(BaseHTTPMiddleware):
    """
    Middleware that automatically logs all administrative actions.
    
    Captures request/response data and logs it to the audit system
    with performance metrics and error tracking.
    """
    
    def __init__(self, app: ASGIApp):
        super().__init__(app)
        
        # Map URL patterns to admin actions
        self.action_mapping = {
            # User management
            ("GET", "/admin/users"): AdminAction.USER_LIST,
            ("GET", "/admin/users/{user_id}"): AdminAction.USER_VIEW,
            ("POST", "/admin/users"): AdminAction.USER_CREATE,
            ("PUT", "/admin/users/{user_id}"): AdminAction.USER_UPDATE,
            ("DELETE", "/admin/users/{user_id}"): AdminAction.USER_DELETE,
            ("POST", "/admin/users/{user_id}/suspend"): AdminAction.USER_SUSPEND,
            ("POST", "/admin/users/{user_id}/activate"): AdminAction.USER_ACTIVATE,
            ("POST", "/admin/users/{user_id}/reset-password"): AdminAction.USER_RESET_PASSWORD,
            ("POST", "/admin/users/{user_id}/force-logout"): AdminAction.USER_FORCE_LOGOUT,
            ("POST", "/admin/users/bulk"): None,  # Determined by operation type
            ("GET", "/admin/users/export"): AdminAction.USER_EXPORT,
            
            # Ingredient management
            ("GET", "/admin/ingredients"): AdminAction.INGREDIENT_LIST,
            ("GET", "/admin/ingredients/{ingredient_id}"): AdminAction.INGREDIENT_VIEW,
            ("POST", "/admin/ingredients"): AdminAction.INGREDIENT_CREATE,
            ("PUT", "/admin/ingredients/{ingredient_id}"): AdminAction.INGREDIENT_UPDATE,
            ("DELETE", "/admin/ingredients/{ingredient_id}"): AdminAction.INGREDIENT_DELETE,
            ("POST", "/admin/ingredients/merge"): AdminAction.INGREDIENT_MERGE,
            ("POST", "/admin/ingredients/{ingredient_id}/approve"): AdminAction.INGREDIENT_APPROVE,
            ("POST", "/admin/ingredients/{ingredient_id}/reject"): AdminAction.INGREDIENT_REJECT,
            ("POST", "/admin/ingredients/import"): AdminAction.INGREDIENT_BULK_IMPORT,
            ("GET", "/admin/ingredients/export"): AdminAction.INGREDIENT_BULK_EXPORT,
            ("POST", "/admin/ingredients/quality-check"): AdminAction.INGREDIENT_QUALITY_CHECK,
            
            # System operations
            ("GET", "/admin/config"): AdminAction.SYSTEM_CONFIG_VIEW,
            ("PUT", "/admin/config"): AdminAction.SYSTEM_CONFIG_UPDATE,
            ("GET", "/admin/audit/logs"): AdminAction.AUDIT_LOG_VIEW,
            ("GET", "/admin/audit/export"): AdminAction.AUDIT_LOG_EXPORT,
            ("POST", "/admin/audit/archive"): AdminAction.DATA_CLEANUP,
        }
        
        # Paths to exclude from audit logging
        self.excluded_paths = {
            "/admin/health",
            "/admin/metrics",
            "/admin/dashboard",  # Read-only dashboard
        }
        
        # Sensitive fields to redact from logs
        self.sensitive_fields = {
            "password", "new_password", "current_password",
            "token", "api_key", "secret", "credit_card"
        }
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """
        Process the request and log administrative actions.
        
        Args:
            request: The incoming request
            call_next: The next middleware/handler
            
        Returns:
            The response
        """
        # Skip non-admin paths
        if not request.url.path.startswith("/admin/"):
            return await call_next(request)
        
        # Skip excluded paths
        if any(request.url.path.startswith(path) for path in self.excluded_paths):
            return await call_next(request)
        
        # Skip if no authenticated user (auth middleware should handle this)
        if not hasattr(request.state, "user") or not request.state.user:
            return await call_next(request)
        
        # Start timing
        start_time = time.time()
        
        # Capture request data
        request_data = await self._capture_request_data(request)
        
        # Store original body for comparison
        original_body = None
        if request.method in ["POST", "PUT", "PATCH"]:
            original_body = await self._get_request_body(request)
        
        # Call the actual handler
        response = None
        error_message = None
        success = True
        
        try:
            response = await call_next(request)
            success = response.status_code < 400
            
            if not success:
                # Capture error response
                error_body = await self._get_response_body(response)
                error_message = error_body.get("detail", f"HTTP {response.status_code}")
                
        except Exception as e:
            # Handle unexpected errors
            success = False
            error_message = f"Internal error: {str(e)}"
            traceback.print_exc()
            
            response = JSONResponse(
                status_code=500,
                content={"detail": "Internal server error"}
            )
        
        # Calculate response time
        response_time_ms = (time.time() - start_time) * 1000
        
        # Determine the action type
        action = self._determine_action(request)
        
        if action:
            # Log the action
            await self._log_action(
                request=request,
                response=response,
                action=action,
                request_data=request_data,
                original_body=original_body,
                success=success,
                error_message=error_message,
                response_time_ms=response_time_ms
            )
        
        return response
    
    def _determine_action(self, request: Request) -> Optional[AdminAction]:
        """
        Determine the admin action from the request.
        
        Args:
            request: The request object
            
        Returns:
            The admin action or None
        """
        method = request.method
        path = request.url.path
        
        # Remove path parameters for matching
        path_pattern = path
        for part in path.split("/"):
            if part and (part.startswith("{") or part[0].isdigit() or "-" in part):
                path_pattern = path_pattern.replace(f"/{part}", "/{param}")
        
        # Try exact match first
        action = self.action_mapping.get((method, path_pattern))
        
        # Special handling for bulk operations
        if path == "/admin/users/bulk" and method == "POST":
            # Determine from request body
            if hasattr(request, "_body"):
                try:
                    body = json.loads(request._body)
                    operation = body.get("operation")
                    if operation == "suspend":
                        action = AdminAction.BULK_SUSPEND
                    elif operation == "activate":
                        action = AdminAction.BULK_ACTIVATE
                    elif operation == "delete":
                        action = AdminAction.BULK_DELETE
                    elif operation == "export":
                        action = AdminAction.BULK_EXPORT
                except:
                    pass
        
        return action
    
    async def _capture_request_data(self, request: Request) -> Dict[str, Any]:
        """
        Capture relevant request data for audit logging.
        
        Args:
            request: The request object
            
        Returns:
            Dictionary of request data
        """
        # Get headers (excluding sensitive ones)
        headers = dict(request.headers)
        sensitive_headers = {"authorization", "cookie", "x-api-key"}
        headers = {
            k: v for k, v in headers.items()
            if k.lower() not in sensitive_headers
        }
        
        # Get client info
        client_host = None
        if request.client:
            client_host = request.client.host
        
        # Build request data
        data = {
            "method": request.method,
            "path": request.url.path,
            "query_params": dict(request.query_params),
            "path_params": request.path_params,
            "client_host": client_host,
            "user_agent": headers.get("user-agent"),
            "request_id": headers.get("x-request-id")
        }
        
        return data
    
    async def _get_request_body(self, request: Request) -> Optional[Dict[str, Any]]:
        """
        Get and parse request body.
        
        Args:
            request: The request object
            
        Returns:
            Parsed body or None
        """
        try:
            # Read body if not already read
            if not hasattr(request, "_body"):
                request._body = await request.body()
            
            if request._body:
                return json.loads(request._body)
        except:
            pass
        
        return None
    
    async def _get_response_body(self, response: Response) -> Dict[str, Any]:
        """
        Get and parse response body.
        
        Args:
            response: The response object
            
        Returns:
            Parsed body or empty dict
        """
        try:
            # For streaming responses, we need to consume the body
            body_bytes = b""
            async for chunk in response.body_iterator:
                body_bytes += chunk
            
            # Create new response with the consumed body
            response.body_iterator = self._async_iterator(body_bytes)
            
            if body_bytes:
                return json.loads(body_bytes)
        except:
            pass
        
        return {}
    
    async def _async_iterator(self, data: bytes):
        """Helper to create async iterator from bytes."""
        yield data
    
    def _extract_target_info(
        self,
        request: Request,
        action: AdminAction
    ) -> Dict[str, Any]:
        """
        Extract target information from the request.
        
        Args:
            request: The request object
            action: The admin action
            
        Returns:
            Target info dictionary
        """
        target_info = {
            "target_type": None,
            "target_id": None,
            "target_ids": None
        }
        
        # Determine target type from action
        if "USER" in action.value:
            target_info["target_type"] = "user"
        elif "INGREDIENT" in action.value:
            target_info["target_type"] = "ingredient"
        elif "AUDIT" in action.value:
            target_info["target_type"] = "audit_log"
        elif "SYSTEM" in action.value:
            target_info["target_type"] = "system"
        else:
            target_info["target_type"] = "unknown"
        
        # Extract target ID from path
        if "user_id" in request.path_params:
            target_info["target_id"] = request.path_params["user_id"]
        elif "ingredient_id" in request.path_params:
            target_info["target_id"] = request.path_params["ingredient_id"]
        elif "id" in request.path_params:
            target_info["target_id"] = request.path_params["id"]
        
        # Extract bulk IDs from body
        if "BULK" in action.value and hasattr(request, "_body"):
            try:
                body = json.loads(request._body)
                if "user_ids" in body:
                    target_info["target_ids"] = [str(id) for id in body["user_ids"]]
                elif "ingredient_ids" in body:
                    target_info["target_ids"] = [str(id) for id in body["ingredient_ids"]]
                elif "ids" in body:
                    target_info["target_ids"] = [str(id) for id in body["ids"]]
            except:
                pass
        
        return target_info
    
    def _redact_sensitive_data(self, data: Any) -> Any:
        """
        Redact sensitive information from data.
        
        Args:
            data: Data to redact
            
        Returns:
            Redacted data
        """
        if isinstance(data, dict):
            redacted = {}
            for key, value in data.items():
                if any(sensitive in key.lower() for sensitive in self.sensitive_fields):
                    redacted[key] = "[REDACTED]"
                else:
                    redacted[key] = self._redact_sensitive_data(value)
            return redacted
        elif isinstance(data, list):
            return [self._redact_sensitive_data(item) for item in data]
        else:
            return data
    
    async def _log_action(
        self,
        request: Request,
        response: Response,
        action: AdminAction,
        request_data: Dict[str, Any],
        original_body: Optional[Dict[str, Any]],
        success: bool,
        error_message: Optional[str],
        response_time_ms: float
    ):
        """
        Log the administrative action to the audit system.
        
        Args:
            request: The request object
            response: The response object
            action: The admin action
            request_data: Captured request data
            original_body: Original request body
            success: Whether the action succeeded
            error_message: Error message if failed
            response_time_ms: Response time in milliseconds
        """
        try:
            # Get database session
            async with DatabaseSession() as db:
                audit_system = AdvancedAuditSystem(db)
                
                # Extract target information
                target_info = self._extract_target_info(request, action)
                
                # Prepare metadata
                metadata = {
                    "request": self._redact_sensitive_data(request_data),
                    "response_status": response.status_code if response else None
                }
                
                # Get reason from request body if present
                reason = None
                if original_body and isinstance(original_body, dict):
                    reason = original_body.get("reason")
                
                # Prepare change tracking
                changes = None
                if original_body and request.method in ["PUT", "PATCH"]:
                    # For updates, the body contains the changes
                    changes = self._redact_sensitive_data(original_body)
                
                # Log the action
                await audit_system.log_action(
                    admin_id=UUID(str(request.state.user.id)),
                    action=action,
                    target_type=target_info["target_type"],
                    target_id=UUID(target_info["target_id"]) if target_info["target_id"] else None,
                    target_ids=target_info["target_ids"],
                    changes=changes,
                    ip_address=request_data.get("client_host"),
                    user_agent=request_data.get("user_agent"),
                    request_id=request_data.get("request_id"),
                    reason=reason,
                    metadata=metadata,
                    success=success,
                    error_message=error_message,
                    response_time_ms=response_time_ms
                )
                
                await db.commit()
                
        except Exception as e:
            # Log error but don't fail the request
            print(f"Failed to log audit action: {str(e)}")
            traceback.print_exc()


def get_audit_middleware() -> AuditLoggingMiddleware:
    """
    Factory function to create audit middleware instance.
    
    Returns:
        Configured audit middleware
    """
    return AuditLoggingMiddleware