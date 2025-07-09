"""
JWT Token Service for Jidelnicek 2.0.

This module provides JWT token generation, validation, and management
for user authentication with access and refresh tokens.
"""

import secrets
import hashlib
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any, Tuple
from uuid import UUID

import jwt
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from redis.asyncio import Redis

from jidelnicek.core.config import settings
from jidelnicek.auth.models import AuthUser, AuthSession
from jidelnicek.auth.exceptions import (
    TokenExpiredError,
    TokenInvalidError,
    SessionInvalidError,
    SessionExpiredError,
    UnauthorizedError
)
from jidelnicek.core.utils import get_utc_now


class TokenService:
    """Service for JWT token operations."""
    
    def __init__(self, db: AsyncSession, redis_client: Optional[Redis] = None):
        """
        Initialize token service.
        
        Args:
            db: Database session
            redis_client: Redis client for token blacklisting
        """
        self.db = db
        self.redis = redis_client
        self.algorithm = settings.algorithm
        self.secret_key = settings.secret_key
        
    def generate_access_token(self, user: AuthUser) -> Tuple[str, datetime]:
        """
        Generate JWT access token for user.
        
        Args:
            user: User model instance
            
        Returns:
            Tuple of (token, expiration_datetime)
        """
        now = get_utc_now()
        expire = now + settings.access_token_expire_timedelta
        
        payload = {
            "sub": str(user.id),  # Subject (user ID)
            "email": user.email,
            "role": user.role,
            "iat": now,
            "exp": expire,
            "type": "access"
        }
        
        token = jwt.encode(payload, self.secret_key, algorithm=self.algorithm)
        return token, expire
    
    def generate_refresh_token(self, user: AuthUser) -> Tuple[str, datetime]:
        """
        Generate JWT refresh token for user.
        
        Args:
            user: User model instance
            
        Returns:
            Tuple of (token, expiration_datetime)
        """
        now = get_utc_now()
        expire = now + settings.refresh_token_expire_timedelta
        
        # Generate unique token ID for tracking
        token_id = secrets.token_urlsafe(32)
        
        payload = {
            "sub": str(user.id),  # Subject (user ID)
            "email": user.email,
            "jti": token_id,  # JWT ID for tracking
            "iat": now,
            "exp": expire,
            "type": "refresh"
        }
        
        token = jwt.encode(payload, self.secret_key, algorithm=self.algorithm)
        return token, expire
    
    async def create_session(
        self,
        user: AuthUser,
        refresh_token: str,
        expires_at: datetime,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None
    ) -> AuthSession:
        """
        Create session record for refresh token.
        
        Args:
            user: User model instance
            refresh_token: The refresh token
            expires_at: Token expiration time
            ip_address: Client IP address
            user_agent: Client user agent
            
        Returns:
            Created session instance
        """
        from jidelnicek.auth.utils.user_agent import parse_user_agent
        
        # Hash the token for secure storage
        token_hash = self._hash_token(refresh_token)
        
        # Parse user agent for device info
        device_info = parse_user_agent(user_agent or "")
        
        session = AuthSession(
            user_id=user.id,
            token_hash=token_hash,
            expires_at=expires_at,
            ip_address=ip_address,
            user_agent=user_agent,
            device_name=device_info.get("device_name"),
            device_type=device_info.get("device_type"),
            browser=device_info.get("browser"),
            os=device_info.get("os")
        )
        
        self.db.add(session)
        await self.db.commit()
        await self.db.refresh(session)
        
        return session
    
    def validate_token(self, token: str, token_type: str = "access") -> Dict[str, Any]:
        """
        Validate and decode JWT token.
        
        Args:
            token: JWT token string
            token_type: Expected token type ("access" or "refresh")
            
        Returns:
            Decoded token payload
            
        Raises:
            TokenExpiredError: If token is expired
            TokenInvalidError: If token is invalid
        """
        try:
            payload = jwt.decode(
                token,
                self.secret_key,
                algorithms=[self.algorithm]
            )
            
            # Verify token type
            if payload.get("type") != token_type:
                raise TokenInvalidError(f"Invalid {token_type} token")
            
            return payload
            
        except jwt.ExpiredSignatureError:
            raise TokenExpiredError(token_type)
        except jwt.InvalidTokenError as e:
            raise TokenInvalidError(token_type)
    
    def extract_claims(self, token: str) -> Dict[str, Any]:
        """
        Extract claims from token without full validation.
        
        This is useful for getting claims from expired tokens
        for logging or debugging purposes.
        
        Args:
            token: JWT token string
            
        Returns:
            Token claims (may be from expired token)
        """
        try:
            # Decode without verification
            payload = jwt.decode(
                token,
                options={"verify_signature": False}
            )
            return payload
        except jwt.InvalidTokenError:
            return {}
    
    async def validate_session(self, refresh_token: str) -> AuthSession:
        """
        Validate refresh token session.
        
        Args:
            refresh_token: Refresh token to validate
            
        Returns:
            Valid session instance
            
        Raises:
            SessionInvalidError: If session not found or invalid
            SessionExpiredError: If session is expired
        """
        # First validate the token structure
        payload = self.validate_token(refresh_token, "refresh")
        
        # Hash token to find session
        token_hash = self._hash_token(refresh_token)
        
        # Find session with user relationship
        from sqlalchemy.orm import selectinload
        
        result = await self.db.execute(
            select(AuthSession)
            .where(
                and_(
                    AuthSession.token_hash == token_hash,
                    AuthSession.is_valid == True
                )
            )
            .options(selectinload(AuthSession.user))
        )
        session = result.scalar_one_or_none()
        
        if not session:
            raise SessionInvalidError()
        
        # Check expiration
        if session.is_expired:
            raise SessionExpiredError()
        
        # Check if token is blacklisted in Redis
        if self.redis and await self.is_token_blacklisted(refresh_token):
            raise SessionInvalidError()
        
        # Update last accessed time
        session.last_accessed = get_utc_now()
        await self.db.commit()
        
        return session
    
    async def revoke_token(self, token: str) -> None:
        """
        Revoke a token by adding it to blacklist.
        
        Args:
            token: Token to revoke
        """
        if not self.redis:
            return
        
        try:
            # Extract expiration from token
            claims = self.extract_claims(token)
            exp = claims.get("exp", 0)
            
            if exp > datetime.now(timezone.utc).timestamp():
                # Calculate TTL
                ttl = int(exp - datetime.now(timezone.utc).timestamp())
                
                # Add to blacklist with TTL
                await self.redis.setex(
                    f"blacklist:token:{self._hash_token(token)}",
                    ttl,
                    "1"
                )
        except Exception:
            # Silently fail if token is invalid
            pass
    
    async def revoke_session(self, session_id: UUID) -> None:
        """
        Revoke a session by ID.
        
        Args:
            session_id: Session ID to revoke
        """
        result = await self.db.execute(
            select(AuthSession).where(AuthSession.id == session_id)
        )
        session = result.scalar_one_or_none()
        
        if session:
            session.is_valid = False
            await self.db.commit()
    
    async def revoke_all_user_sessions(self, user_id: UUID) -> int:
        """
        Revoke all sessions for a user.
        
        Args:
            user_id: User ID whose sessions to revoke
            
        Returns:
            Number of sessions revoked
        """
        result = await self.db.execute(
            select(AuthSession).where(
                and_(
                    AuthSession.user_id == user_id,
                    AuthSession.is_valid == True
                )
            )
        )
        sessions = result.scalars().all()
        
        count = 0
        for session in sessions:
            session.is_valid = False
            count += 1
        
        if count > 0:
            await self.db.commit()
        
        return count
    
    async def cleanup_expired_sessions(self) -> int:
        """
        Clean up expired sessions from database.
        
        Returns:
            Number of sessions cleaned up
        """
        now = get_utc_now()
        
        result = await self.db.execute(
            select(AuthSession).where(
                AuthSession.expires_at < now
            )
        )
        expired_sessions = result.scalars().all()
        
        count = 0
        for session in expired_sessions:
            await self.db.delete(session)
            count += 1
        
        if count > 0:
            await self.db.commit()
        
        return count
    
    def _hash_token(self, token: str) -> str:
        """
        Create secure hash of token for storage.
        
        Args:
            token: Token to hash
            
        Returns:
            SHA256 hash of token
        """
        return hashlib.sha256(token.encode()).hexdigest()
    
    async def is_token_blacklisted(self, token: str) -> bool:
        """
        Check if token is blacklisted in Redis.
        
        Args:
            token: Token to check
            
        Returns:
            True if blacklisted, False otherwise
        """
        if not self.redis:
            return False
        
        key = f"blacklist:token:{self._hash_token(token)}"
        result = await self.redis.get(key)
        return result is not None
    
    def get_token_expiry_seconds(self) -> int:
        """
        Get access token expiry in seconds for response.
        
        Returns:
            Expiry time in seconds
        """
        return int(settings.access_token_expire_timedelta.total_seconds())
    
    async def get_user_sessions(self, user_id: UUID) -> list[AuthSession]:
        """
        Get all active sessions for a user.
        
        Args:
            user_id: User ID to get sessions for
            
        Returns:
            List of active sessions
        """
        result = await self.db.execute(
            select(AuthSession)
            .where(
                and_(
                    AuthSession.user_id == user_id,
                    AuthSession.is_valid == True,
                    AuthSession.expires_at > get_utc_now()
                )
            )
            .order_by(AuthSession.last_accessed.desc())
        )
        return result.scalars().all()
    
    async def get_session_count(self, user_id: UUID) -> int:
        """
        Get count of active sessions for a user.
        
        Args:
            user_id: User ID to count sessions for
            
        Returns:
            Number of active sessions
        """
        from sqlalchemy import func
        
        result = await self.db.execute(
            select(func.count(AuthSession.id))
            .where(
                and_(
                    AuthSession.user_id == user_id,
                    AuthSession.is_valid == True,
                    AuthSession.expires_at > get_utc_now()
                )
            )
        )
        return result.scalar() or 0
    
    async def revoke_session_by_id(self, session_id: UUID, user_id: UUID) -> bool:
        """
        Revoke a specific session by ID, verifying it belongs to the user.
        
        Args:
            session_id: Session ID to revoke
            user_id: User ID to verify ownership
            
        Returns:
            True if session was revoked, False if not found or not owned by user
        """
        result = await self.db.execute(
            select(AuthSession)
            .where(
                and_(
                    AuthSession.id == session_id,
                    AuthSession.user_id == user_id,
                    AuthSession.is_valid == True
                )
            )
        )
        session = result.scalar_one_or_none()
        
        if session:
            session.is_valid = False
            await self.db.commit()
            return True
        
        return False
    
    async def check_session_limit(self, user_id: UUID, is_admin: bool = False) -> bool:
        """
        Check if user has reached session limit.
        
        Args:
            user_id: User ID to check
            is_admin: Whether user is admin (unlimited sessions)
            
        Returns:
            True if within limit, False if limit exceeded
        """
        if is_admin:
            return True
        
        current_count = await self.get_session_count(user_id)
        return current_count < settings.max_sessions_per_user
    
    async def revoke_oldest_session(self, user_id: UUID) -> Optional[UUID]:
        """
        Revoke the oldest session for a user.
        
        Args:
            user_id: User ID whose oldest session to revoke
            
        Returns:
            ID of revoked session if any, None otherwise
        """
        result = await self.db.execute(
            select(AuthSession)
            .where(
                and_(
                    AuthSession.user_id == user_id,
                    AuthSession.is_valid == True
                )
            )
            .order_by(AuthSession.created_at.asc())
            .limit(1)
        )
        oldest_session = result.scalar_one_or_none()
        
        if oldest_session:
            oldest_session.is_valid = False
            await self.db.commit()
            return oldest_session.id
        
        return None