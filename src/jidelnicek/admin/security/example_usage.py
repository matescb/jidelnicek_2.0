"""
Example usage of the admin security system.

This demonstrates how to integrate and use all security features.
"""

from fastapi import FastAPI, Request, Response, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
import redis.asyncio as redis

from jidelnicek.core.database import get_async_db
from jidelnicek.admin.config.security_config import SecurityConfig
from jidelnicek.admin.security.integration import create_admin_security_system
from jidelnicek.admin.middleware.security import require_admin_auth


# Initialize FastAPI app
app = FastAPI(title="Jidelnicek Admin API")

# Initialize Redis
redis_client = redis.from_url("redis://localhost:6379", decode_responses=True)

# Create security system
security_system = None


@app.on_event("startup")
async def startup_event():
    """Initialize security system on startup."""
    global security_system
    
    # Get database session
    async with get_async_db() as db:
        # Create security system
        security_system = create_admin_security_system(
            db=db,
            redis_client=redis_client,
            sms_service=None,  # Would initialize real SMS service
            config=SecurityConfig.from_env()
        )
        
        # Setup middleware
        security_system.setup_middleware(app)
        
        # Start background tasks
        await security_system.start_background_tasks()


@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown."""
    if security_system:
        await security_system.stop_background_tasks()
    
    await redis_client.close()


# Authentication endpoints

@app.post("/admin/login")
async def admin_login(
    request: Request,
    email: str,
    password: str,
    db: AsyncSession = Depends(get_async_db)
):
    """Admin login endpoint."""
    # Get client info
    client_ip = request.client.host if request.client else "unknown"
    user_agent = request.headers.get("User-Agent", "")
    
    # Authenticate
    session, error = await security_system.authenticate_admin(
        email=email,
        password=password,
        ip_address=client_ip,
        user_agent=user_agent,
        device_info={
            "browser": user_agent.split("/")[0] if "/" in user_agent else "unknown"
        }
    )
    
    if error:
        raise HTTPException(status_code=401, detail=error)
    
    # Return session token
    return {
        "token": session.token,
        "requires_2fa": security_system.config.require_2fa,
        "session_timeout": session.remaining_time.total_seconds()
    }


@app.post("/admin/2fa/verify")
async def verify_2fa(
    request: Request,
    code: str,
    method: str = "totp"
):
    """Verify 2FA code."""
    # Get session token from header
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing session token")
    
    token = auth_header[7:]
    
    # Verify 2FA
    success, error = await security_system.verify_2fa(
        session_token=token,
        code=code,
        method=method
    )
    
    if error:
        raise HTTPException(status_code=401, detail=error)
    
    return {"verified": success}


@app.post("/admin/logout")
@require_admin_auth()
async def admin_logout(request: Request):
    """Admin logout endpoint."""
    if hasattr(request.state, "admin_session"):
        session = request.state.admin_session
        await security_system.session_manager.invalidate_session(session)
    
    return {"message": "Logged out successfully"}


# 2FA Management endpoints

@app.post("/admin/2fa/setup/totp")
@require_admin_auth(require_2fa=False)  # Allow setup without 2FA
async def setup_totp(
    request: Request,
    db: AsyncSession = Depends(get_async_db)
):
    """Setup TOTP for current user."""
    # Get user from session
    user_id = request.state.admin_session.user_id
    # Would fetch user from database
    user = None  # Placeholder
    
    # Setup TOTP
    secret, qr_code, backup_codes = await security_system.two_factor.setup_totp(user)
    
    return {
        "secret": secret,
        "qr_code": qr_code,
        "backup_codes": backup_codes
    }


@app.post("/admin/2fa/setup/verify")
@require_admin_auth(require_2fa=False)
async def verify_totp_setup(
    request: Request,
    code: str,
    secret: str,
    db: AsyncSession = Depends(get_async_db)
):
    """Verify TOTP setup."""
    user_id = request.state.admin_session.user_id
    # Would fetch user from database
    user = None  # Placeholder
    
    # Verify setup
    verified = await security_system.two_factor.verify_totp_setup(
        user=user,
        code=code,
        secret=secret
    )
    
    if not verified:
        raise HTTPException(status_code=400, detail="Invalid code")
    
    return {"verified": True}


# Security Management endpoints

@app.get("/admin/security/dashboard")
@require_admin_auth()
async def security_dashboard(request: Request):
    """Get security dashboard."""
    dashboard = await security_system.get_security_dashboard()
    return dashboard


@app.post("/admin/security/audit")
@require_admin_auth()
async def run_security_audit(request: Request):
    """Run security audit."""
    user_id = request.state.admin_session.user_id
    
    result = await security_system.run_security_audit(
        initiated_by=user_id
    )
    
    return result


@app.get("/admin/security/events")
@require_admin_auth()
async def get_security_events(
    request: Request,
    event_type: Optional[str] = None,
    hours: int = 24
):
    """Get recent security events."""
    events = await security_system.monitor.get_recent_events(
        event_type=event_type,
        hours=hours
    )
    
    return {
        "events": [e.to_dict() for e in events],
        "count": len(events)
    }


# IP Whitelist Management

@app.get("/admin/security/whitelist")
@require_admin_auth()
async def get_ip_whitelist(request: Request):
    """Get IP whitelist entries."""
    entries = await security_system.ip_whitelist.list_whitelist_entries()
    
    return {
        "entries": [
            {
                "id": str(e.id),
                "ip_address": e.ip_address,
                "cidr": e.cidr,
                "description": e.description,
                "created_at": e.created_at.isoformat(),
                "expires_at": e.expires_at.isoformat() if e.expires_at else None
            }
            for e in entries
        ]
    }


@app.post("/admin/security/whitelist")
@require_admin_auth()
async def add_ip_whitelist(
    request: Request,
    ip_or_cidr: str,
    description: str,
    expires_in_hours: Optional[int] = None
):
    """Add IP to whitelist."""
    user_id = request.state.admin_session.user_id
    
    expires_in = timedelta(hours=expires_in_hours) if expires_in_hours else None
    
    entry = await security_system.ip_whitelist.add_whitelist_entry(
        ip_or_cidr=ip_or_cidr,
        description=description,
        created_by=user_id,
        expires_in=expires_in
    )
    
    return {
        "id": str(entry.id),
        "message": "IP added to whitelist"
    }


@app.delete("/admin/security/whitelist/{entry_id}")
@require_admin_auth()
async def remove_ip_whitelist(
    request: Request,
    entry_id: str
):
    """Remove IP from whitelist."""
    user_id = request.state.admin_session.user_id
    
    removed = await security_system.ip_whitelist.remove_whitelist_entry(
        entry_id=UUID(entry_id),
        removed_by=user_id
    )
    
    if not removed:
        raise HTTPException(status_code=404, detail="Entry not found")
    
    return {"message": "IP removed from whitelist"}


# Session Management

@app.get("/admin/sessions")
@require_admin_auth()
async def get_user_sessions(request: Request):
    """Get all sessions for current user."""
    user_id = request.state.admin_session.user_id
    
    sessions = await security_system.session_manager.get_active_sessions(user_id)
    
    return {
        "sessions": [s.to_dict() for s in sessions],
        "count": len(sessions)
    }


@app.delete("/admin/sessions/{session_id}")
@require_admin_auth()
async def invalidate_session(
    request: Request,
    session_id: str
):
    """Invalidate a specific session."""
    # Would verify user owns the session
    # For now, just invalidate it
    
    # Get session
    sessions = await security_system.session_manager.get_active_sessions(
        request.state.admin_session.user_id
    )
    
    for session in sessions:
        if str(session.session_id) == session_id:
            await security_system.session_manager.invalidate_session(session)
            return {"message": "Session invalidated"}
    
    raise HTTPException(status_code=404, detail="Session not found")


@app.delete("/admin/sessions")
@require_admin_auth()
async def invalidate_all_sessions(request: Request):
    """Invalidate all sessions for current user."""
    user_id = request.state.admin_session.user_id
    
    count = await security_system.session_manager.invalidate_all_sessions(user_id)
    
    return {
        "message": f"Invalidated {count} sessions",
        "count": count
    }


# Example protected endpoint

@app.get("/admin/users")
@require_admin_auth()
async def list_users(
    request: Request,
    db: AsyncSession = Depends(get_async_db)
):
    """Example protected endpoint - list users."""
    # This would implement the actual user listing logic
    # For now, just return a placeholder
    
    return {
        "users": [],
        "total": 0,
        "page": 1,
        "per_page": 50
    }


# Security configuration endpoint

@app.get("/admin/security/config")
@require_admin_auth()
async def get_security_config(request: Request):
    """Get current security configuration (sanitized)."""
    config = security_system.config
    
    # Return sanitized config (no secrets)
    return {
        "environment": config.environment,
        "session": {
            "inactivity_timeout": config.session_inactivity_timeout.total_seconds(),
            "absolute_timeout": config.session_absolute_timeout.total_seconds(),
            "max_concurrent": config.max_concurrent_sessions
        },
        "two_factor": {
            "required": config.require_2fa,
            "methods": ["totp", "sms", "backup_codes"]
        },
        "ip_security": {
            "whitelist_enforced": config.enforce_ip_whitelist,
            "allow_vpn": config.allow_vpn_connections,
            "allow_tor": config.allow_tor_connections
        },
        "rate_limiting": {
            "window_seconds": config.rate_limit_window.total_seconds(),
            "max_requests": config.rate_limit_max_requests
        },
        "password_policy": {
            "min_length": config.min_password_length,
            "require_uppercase": config.require_uppercase,
            "require_numbers": config.require_numbers,
            "expiry_days": config.password_expiry_days
        }
    }


# Import required modules
from typing import Optional
from uuid import UUID
from datetime import timedelta


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)