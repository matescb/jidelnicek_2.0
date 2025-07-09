"""
Secure session management for admin users.

Provides:
- Session timeouts (30 min inactivity)
- Concurrent session limits (max 3)
- Device fingerprinting
- Session invalidation
- Activity tracking
"""

from datetime import datetime, timedelta, timezone
from typing import Optional, List, Dict, Any
from uuid import UUID, uuid4
import hashlib
import json
import secrets
from ipaddress import ip_address, ip_network

from sqlalchemy import select, delete, and_, or_, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from jidelnicek.core.database import Base
from jidelnicek.core.utils import get_utc_now
from jidelnicek.auth.models import AuthUser
from jidelnicek.admin.models import AdminAuditLog, AdminAction
from jidelnicek.core.exceptions import (
    SecurityException,
    SessionExpiredException,
    ConcurrentSessionLimitException
)


class AdminSessionConfig:
    """Configuration for admin session management."""
    INACTIVITY_TIMEOUT = timedelta(minutes=30)
    ABSOLUTE_TIMEOUT = timedelta(hours=8)
    MAX_CONCURRENT_SESSIONS = 3
    SESSION_TOKEN_LENGTH = 64
    FINGERPRINT_SALT = "jidelnicek-admin-session-fingerprint"


class AdminSession:
    """Represents an active admin session."""
    
    def __init__(
        self,
        session_id: UUID,
        user_id: UUID,
        token: str,
        created_at: datetime,
        last_activity: datetime,
        ip_address: str,
        user_agent: str,
        fingerprint: str,
        device_info: Optional[Dict[str, Any]] = None,
        two_factor_verified: bool = False
    ):
        self.session_id = session_id
        self.user_id = user_id
        self.token = token
        self.created_at = created_at
        self.last_activity = last_activity
        self.ip_address = ip_address
        self.user_agent = user_agent
        self.fingerprint = fingerprint
        self.device_info = device_info or {}
        self.two_factor_verified = two_factor_verified
    
    @property
    def is_expired(self) -> bool:
        """Check if session has expired due to inactivity or absolute timeout."""
        now = get_utc_now()
        
        # Check inactivity timeout
        if now - self.last_activity > AdminSessionConfig.INACTIVITY_TIMEOUT:
            return True
        
        # Check absolute timeout
        if now - self.created_at > AdminSessionConfig.ABSOLUTE_TIMEOUT:
            return True
        
        return False
    
    @property
    def remaining_time(self) -> timedelta:
        """Get remaining time before session expires."""
        now = get_utc_now()
        
        # Calculate based on inactivity
        inactivity_remaining = (
            AdminSessionConfig.INACTIVITY_TIMEOUT - 
            (now - self.last_activity)
        )
        
        # Calculate based on absolute timeout
        absolute_remaining = (
            AdminSessionConfig.ABSOLUTE_TIMEOUT - 
            (now - self.created_at)
        )
        
        # Return the minimum
        return min(inactivity_remaining, absolute_remaining)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert session to dictionary representation."""
        return {
            'session_id': str(self.session_id),
            'user_id': str(self.user_id),
            'created_at': self.created_at.isoformat(),
            'last_activity': self.last_activity.isoformat(),
            'ip_address': self.ip_address,
            'user_agent': self.user_agent,
            'device_info': self.device_info,
            'two_factor_verified': self.two_factor_verified,
            'is_expired': self.is_expired,
            'remaining_time_seconds': int(self.remaining_time.total_seconds())
        }


class SessionManager:
    """Manages admin sessions with security features."""
    
    def __init__(self, db: AsyncSession, redis_client=None):
        self.db = db
        self.redis = redis_client
    
    @staticmethod
    def generate_fingerprint(
        ip_address: str,
        user_agent: str,
        device_info: Optional[Dict[str, Any]] = None
    ) -> str:
        """Generate a device fingerprint for session tracking."""
        data = {
            'ip': ip_address,
            'user_agent': user_agent,
            'device': device_info or {}
        }
        
        # Create deterministic fingerprint
        fingerprint_data = json.dumps(data, sort_keys=True)
        fingerprint = hashlib.sha256(
            f"{fingerprint_data}{AdminSessionConfig.FINGERPRINT_SALT}".encode()
        ).hexdigest()
        
        return fingerprint
    
    async def create_session(
        self,
        user: AuthUser,
        ip_address: str,
        user_agent: str,
        device_info: Optional[Dict[str, Any]] = None
    ) -> AdminSession:
        """Create a new admin session."""
        # Check if user is admin
        if user.role != 'admin':
            raise SecurityException("Only admin users can create admin sessions")
        
        # Check concurrent session limit
        await self._check_concurrent_sessions(user.id)
        
        # Generate session data
        session_id = uuid4()
        token = secrets.token_urlsafe(AdminSessionConfig.SESSION_TOKEN_LENGTH)
        fingerprint = self.generate_fingerprint(ip_address, user_agent, device_info)
        now = get_utc_now()
        
        # Create session object
        session = AdminSession(
            session_id=session_id,
            user_id=user.id,
            token=token,
            created_at=now,
            last_activity=now,
            ip_address=ip_address,
            user_agent=user_agent,
            fingerprint=fingerprint,
            device_info=device_info,
            two_factor_verified=False
        )
        
        # Store in cache if available
        if self.redis:
            await self._store_session_in_cache(session)
        
        # Log session creation
        await self._log_session_event(
            user_id=user.id,
            action="session_create",
            session_id=session_id,
            ip_address=ip_address,
            metadata={
                'user_agent': user_agent,
                'fingerprint': fingerprint
            }
        )
        
        return session
    
    async def validate_session(
        self,
        token: str,
        ip_address: str,
        user_agent: str
    ) -> Optional[AdminSession]:
        """Validate and return an active session."""
        # Try to get from cache first
        if self.redis:
            session = await self._get_session_from_cache(token)
            if session:
                # Validate and update
                if await self._validate_and_update_session(
                    session, ip_address, user_agent
                ):
                    return session
        
        # Fall back to database lookup
        # In a real implementation, we'd have a sessions table
        # For now, we'll use the audit log to track sessions
        return None
    
    async def update_activity(self, session: AdminSession) -> None:
        """Update session's last activity timestamp."""
        session.last_activity = get_utc_now()
        
        if self.redis:
            await self._store_session_in_cache(session)
    
    async def verify_two_factor(self, session: AdminSession) -> None:
        """Mark session as 2FA verified."""
        session.two_factor_verified = True
        
        if self.redis:
            await self._store_session_in_cache(session)
        
        await self._log_session_event(
            user_id=session.user_id,
            action="2fa_verified",
            session_id=session.session_id,
            ip_address=session.ip_address
        )
    
    async def invalidate_session(self, session: AdminSession) -> None:
        """Invalidate a session."""
        if self.redis:
            await self._remove_session_from_cache(session.token)
        
        await self._log_session_event(
            user_id=session.user_id,
            action="session_invalidate",
            session_id=session.session_id,
            ip_address=session.ip_address
        )
    
    async def invalidate_all_sessions(self, user_id: UUID) -> int:
        """Invalidate all sessions for a user."""
        count = 0
        
        if self.redis:
            # Get all user sessions from cache
            pattern = f"admin:session:user:{user_id}:*"
            cursor = 0
            
            while True:
                cursor, keys = await self.redis.scan(
                    cursor, match=pattern, count=100
                )
                
                for key in keys:
                    await self.redis.delete(key)
                    count += 1
                
                if cursor == 0:
                    break
        
        await self._log_session_event(
            user_id=user_id,
            action="session_invalidate_all",
            metadata={'count': count}
        )
        
        return count
    
    async def get_active_sessions(self, user_id: UUID) -> List[AdminSession]:
        """Get all active sessions for a user."""
        sessions = []
        
        if self.redis:
            pattern = f"admin:session:user:{user_id}:*"
            cursor = 0
            
            while True:
                cursor, keys = await self.redis.scan(
                    cursor, match=pattern, count=100
                )
                
                for key in keys:
                    session_data = await self.redis.get(key)
                    if session_data:
                        session = self._deserialize_session(session_data)
                        if not session.is_expired:
                            sessions.append(session)
                
                if cursor == 0:
                    break
        
        return sessions
    
    async def cleanup_expired_sessions(self) -> int:
        """Remove expired sessions from storage."""
        count = 0
        
        if self.redis:
            pattern = "admin:session:*"
            cursor = 0
            
            while True:
                cursor, keys = await self.redis.scan(
                    cursor, match=pattern, count=100
                )
                
                for key in keys:
                    session_data = await self.redis.get(key)
                    if session_data:
                        session = self._deserialize_session(session_data)
                        if session.is_expired:
                            await self.redis.delete(key)
                            count += 1
                
                if cursor == 0:
                    break
        
        return count
    
    # Private helper methods
    
    async def _check_concurrent_sessions(self, user_id: UUID) -> None:
        """Check if user has reached concurrent session limit."""
        active_sessions = await self.get_active_sessions(user_id)
        
        if len(active_sessions) >= AdminSessionConfig.MAX_CONCURRENT_SESSIONS:
            # Find the oldest session
            oldest_session = min(active_sessions, key=lambda s: s.last_activity)
            
            # Invalidate it
            await self.invalidate_session(oldest_session)
    
    async def _validate_and_update_session(
        self,
        session: AdminSession,
        ip_address: str,
        user_agent: str
    ) -> bool:
        """Validate session and update activity."""
        # Check if expired
        if session.is_expired:
            await self.invalidate_session(session)
            return False
        
        # Check IP address change
        if session.ip_address != ip_address:
            # Log suspicious activity
            await self._log_session_event(
                user_id=session.user_id,
                action="session_ip_change",
                session_id=session.session_id,
                ip_address=ip_address,
                metadata={
                    'old_ip': session.ip_address,
                    'new_ip': ip_address
                }
            )
        
        # Update activity
        await self.update_activity(session)
        
        return True
    
    async def _store_session_in_cache(self, session: AdminSession) -> None:
        """Store session in Redis cache."""
        if not self.redis:
            return
        
        # Store by token
        token_key = f"admin:session:token:{session.token}"
        await self.redis.setex(
            token_key,
            int(session.remaining_time.total_seconds()),
            self._serialize_session(session)
        )
        
        # Store reference by user ID
        user_key = f"admin:session:user:{session.user_id}:{session.session_id}"
        await self.redis.setex(
            user_key,
            int(session.remaining_time.total_seconds()),
            session.token
        )
    
    async def _get_session_from_cache(self, token: str) -> Optional[AdminSession]:
        """Get session from Redis cache."""
        if not self.redis:
            return None
        
        key = f"admin:session:token:{token}"
        data = await self.redis.get(key)
        
        if data:
            return self._deserialize_session(data)
        
        return None
    
    async def _remove_session_from_cache(self, token: str) -> None:
        """Remove session from Redis cache."""
        if not self.redis:
            return
        
        # Get session first to find user reference
        session = await self._get_session_from_cache(token)
        if session:
            # Remove token key
            await self.redis.delete(f"admin:session:token:{token}")
            
            # Remove user reference
            user_key = f"admin:session:user:{session.user_id}:{session.session_id}"
            await self.redis.delete(user_key)
    
    def _serialize_session(self, session: AdminSession) -> str:
        """Serialize session to JSON."""
        data = {
            'session_id': str(session.session_id),
            'user_id': str(session.user_id),
            'token': session.token,
            'created_at': session.created_at.isoformat(),
            'last_activity': session.last_activity.isoformat(),
            'ip_address': session.ip_address,
            'user_agent': session.user_agent,
            'fingerprint': session.fingerprint,
            'device_info': session.device_info,
            'two_factor_verified': session.two_factor_verified
        }
        return json.dumps(data)
    
    def _deserialize_session(self, data: str) -> AdminSession:
        """Deserialize session from JSON."""
        session_data = json.loads(data)
        
        return AdminSession(
            session_id=UUID(session_data['session_id']),
            user_id=UUID(session_data['user_id']),
            token=session_data['token'],
            created_at=datetime.fromisoformat(session_data['created_at']),
            last_activity=datetime.fromisoformat(session_data['last_activity']),
            ip_address=session_data['ip_address'],
            user_agent=session_data['user_agent'],
            fingerprint=session_data['fingerprint'],
            device_info=session_data.get('device_info', {}),
            two_factor_verified=session_data.get('two_factor_verified', False)
        )
    
    async def _log_session_event(
        self,
        user_id: UUID,
        action: str,
        session_id: Optional[UUID] = None,
        ip_address: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> None:
        """Log session-related events to audit log."""
        # This would typically log to the AdminAuditLog table
        # Implementation depends on your audit logging strategy
        pass