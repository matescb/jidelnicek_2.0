"""
IP whitelisting and geolocation for admin access control.

Provides:
- IP whitelist management
- CIDR support
- Geolocation tracking
- Suspicious activity detection
- Automatic blocking
"""

from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any, Tuple
from uuid import UUID, uuid4
from ipaddress import ip_address, ip_network, IPv4Address, IPv6Address
import asyncio
import json
from dataclasses import dataclass, asdict

import httpx
from sqlalchemy import select, update, delete, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession

from jidelnicek.core.utils import get_utc_now
from jidelnicek.auth.models import AuthUser
from jidelnicek.admin.models import AdminAuditLog, AdminAction
from jidelnicek.core.exceptions import (
    SecurityException,
    IPBlockedException,
    UnauthorizedLocationException
)


@dataclass
class IPWhitelistEntry:
    """Represents an IP whitelist entry."""
    id: UUID
    ip_address: Optional[str] = None  # Single IP
    cidr: Optional[str] = None  # CIDR range
    description: str = ""
    created_at: datetime = None
    created_by: Optional[UUID] = None
    expires_at: Optional[datetime] = None
    is_active: bool = True
    metadata: Dict[str, Any] = None
    
    def __post_init__(self):
        if self.created_at is None:
            self.created_at = get_utc_now()
        if self.metadata is None:
            self.metadata = {}
    
    def matches(self, ip: str) -> bool:
        """Check if given IP matches this entry."""
        try:
            test_ip = ip_address(ip)
            
            if self.ip_address:
                return test_ip == ip_address(self.ip_address)
            
            if self.cidr:
                return test_ip in ip_network(self.cidr)
            
            return False
        except ValueError:
            return False
    
    @property
    def is_expired(self) -> bool:
        """Check if entry has expired."""
        if self.expires_at:
            return get_utc_now() > self.expires_at
        return False


@dataclass
class GeolocationInfo:
    """IP geolocation information."""
    ip: str
    country: Optional[str] = None
    country_code: Optional[str] = None
    region: Optional[str] = None
    city: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    isp: Optional[str] = None
    is_vpn: bool = False
    is_proxy: bool = False
    is_tor: bool = False
    risk_score: int = 0  # 0-100
    
    @property
    def is_suspicious(self) -> bool:
        """Check if location is suspicious."""
        return (
            self.is_vpn or 
            self.is_proxy or 
            self.is_tor or 
            self.risk_score > 50
        )


class IPWhitelistConfig:
    """Configuration for IP whitelisting."""
    # Geolocation API (using ipapi.co as example)
    GEOLOCATION_API_URL = "https://ipapi.co/{ip}/json/"
    GEOLOCATION_CACHE_TTL = timedelta(days=7)
    
    # Security settings
    ALLOW_VPN = False
    ALLOW_TOR = False
    ALLOW_PROXY = False
    MAX_RISK_SCORE = 50
    
    # Rate limiting
    MAX_FAILED_ATTEMPTS = 5
    BLOCK_DURATION = timedelta(hours=24)
    
    # Automatic blocking
    AUTO_BLOCK_SUSPICIOUS = True
    AUTO_BLOCK_COUNTRIES = []  # List of country codes to auto-block


class IPWhitelistService:
    """Manages IP whitelisting and geolocation."""
    
    def __init__(
        self,
        db: AsyncSession,
        redis_client=None,
        http_client: Optional[httpx.AsyncClient] = None
    ):
        self.db = db
        self.redis = redis_client
        self.http_client = http_client or httpx.AsyncClient()
    
    async def check_ip_access(
        self,
        ip: str,
        user: Optional[AuthUser] = None,
        enforce_whitelist: bool = True
    ) -> Tuple[bool, Optional[str]]:
        """
        Check if IP is allowed to access admin.
        
        Returns:
            - (allowed, reason)
        """
        # Check if IP is blocked
        if await self._is_ip_blocked(ip):
            return False, "IP address is blocked"
        
        # Check whitelist if enforced
        if enforce_whitelist:
            if not await self._is_ip_whitelisted(ip):
                return False, "IP address not in whitelist"
        
        # Get geolocation info
        geo_info = await self.get_geolocation(ip)
        
        # Check geolocation restrictions
        if geo_info:
            # Check if suspicious
            if geo_info.is_suspicious and not IPWhitelistConfig.ALLOW_VPN:
                if geo_info.is_vpn:
                    return False, "VPN connections not allowed"
                if geo_info.is_tor:
                    return False, "Tor connections not allowed"
                if geo_info.is_proxy:
                    return False, "Proxy connections not allowed"
            
            # Check country restrictions
            if geo_info.country_code in IPWhitelistConfig.AUTO_BLOCK_COUNTRIES:
                return False, f"Access from {geo_info.country} not allowed"
            
            # Check risk score
            if geo_info.risk_score > IPWhitelistConfig.MAX_RISK_SCORE:
                return False, f"Risk score too high: {geo_info.risk_score}"
        
        # Log access
        await self._log_ip_access(
            ip=ip,
            user_id=user.id if user else None,
            allowed=True,
            geo_info=geo_info
        )
        
        return True, None
    
    async def add_whitelist_entry(
        self,
        ip_or_cidr: str,
        description: str,
        created_by: UUID,
        expires_in: Optional[timedelta] = None
    ) -> IPWhitelistEntry:
        """Add IP or CIDR to whitelist."""
        # Validate IP/CIDR
        is_cidr = False
        try:
            # Try as single IP first
            ip_address(ip_or_cidr)
        except ValueError:
            try:
                # Try as CIDR
                ip_network(ip_or_cidr)
                is_cidr = True
            except ValueError:
                raise ValueError(f"Invalid IP address or CIDR: {ip_or_cidr}")
        
        # Create entry
        entry = IPWhitelistEntry(
            id=uuid4(),
            ip_address=ip_or_cidr if not is_cidr else None,
            cidr=ip_or_cidr if is_cidr else None,
            description=description,
            created_by=created_by,
            expires_at=get_utc_now() + expires_in if expires_in else None
        )
        
        # Store in cache
        await self._store_whitelist_entry(entry)
        
        # Log addition
        await self._log_whitelist_change(
            action="whitelist_add",
            entry=entry,
            user_id=created_by
        )
        
        return entry
    
    async def remove_whitelist_entry(
        self,
        entry_id: UUID,
        removed_by: UUID
    ) -> bool:
        """Remove entry from whitelist."""
        # Get entry
        entry = await self._get_whitelist_entry(entry_id)
        if not entry:
            return False
        
        # Remove from cache
        await self._remove_whitelist_entry(entry_id)
        
        # Log removal
        await self._log_whitelist_change(
            action="whitelist_remove",
            entry=entry,
            user_id=removed_by
        )
        
        return True
    
    async def list_whitelist_entries(
        self,
        include_expired: bool = False
    ) -> List[IPWhitelistEntry]:
        """List all whitelist entries."""
        entries = []
        
        if self.redis:
            pattern = "admin:whitelist:*"
            cursor = 0
            
            while True:
                cursor, keys = await self.redis.scan(
                    cursor, match=pattern, count=100
                )
                
                for key in keys:
                    data = await self.redis.get(key)
                    if data:
                        entry = self._deserialize_entry(data)
                        if include_expired or not entry.is_expired:
                            entries.append(entry)
                
                if cursor == 0:
                    break
        
        return sorted(entries, key=lambda e: e.created_at, reverse=True)
    
    async def block_ip(
        self,
        ip: str,
        reason: str,
        blocked_by: Optional[UUID] = None,
        duration: Optional[timedelta] = None
    ) -> None:
        """Block an IP address."""
        duration = duration or IPWhitelistConfig.BLOCK_DURATION
        
        if self.redis:
            key = f"admin:blocked_ip:{ip}"
            await self.redis.setex(
                key,
                int(duration.total_seconds()),
                json.dumps({
                    'reason': reason,
                    'blocked_by': str(blocked_by) if blocked_by else None,
                    'blocked_at': get_utc_now().isoformat()
                })
            )
        
        # Log blocking
        await self._log_ip_event(
            action="ip_block",
            ip=ip,
            user_id=blocked_by,
            metadata={'reason': reason, 'duration_hours': duration.total_seconds() / 3600}
        )
    
    async def unblock_ip(
        self,
        ip: str,
        unblocked_by: UUID
    ) -> bool:
        """Unblock an IP address."""
        if self.redis:
            key = f"admin:blocked_ip:{ip}"
            result = await self.redis.delete(key)
            
            if result:
                await self._log_ip_event(
                    action="ip_unblock",
                    ip=ip,
                    user_id=unblocked_by
                )
                return True
        
        return False
    
    async def get_geolocation(self, ip: str) -> Optional[GeolocationInfo]:
        """Get geolocation information for IP."""
        # Check cache first
        if self.redis:
            key = f"admin:geolocation:{ip}"
            cached = await self.redis.get(key)
            if cached:
                return self._deserialize_geolocation(cached)
        
        # Fetch from API
        try:
            url = IPWhitelistConfig.GEOLOCATION_API_URL.format(ip=ip)
            response = await self.http_client.get(url, timeout=5.0)
            
            if response.status_code == 200:
                data = response.json()
                
                geo_info = GeolocationInfo(
                    ip=ip,
                    country=data.get('country_name'),
                    country_code=data.get('country_code'),
                    region=data.get('region'),
                    city=data.get('city'),
                    latitude=data.get('latitude'),
                    longitude=data.get('longitude'),
                    isp=data.get('org'),
                    # These would come from a more advanced API
                    is_vpn=data.get('is_vpn', False),
                    is_proxy=data.get('is_proxy', False),
                    is_tor=data.get('is_tor', False),
                    risk_score=data.get('risk_score', 0)
                )
                
                # Cache result
                if self.redis:
                    await self.redis.setex(
                        f"admin:geolocation:{ip}",
                        int(IPWhitelistConfig.GEOLOCATION_CACHE_TTL.total_seconds()),
                        self._serialize_geolocation(geo_info)
                    )
                
                return geo_info
        
        except Exception as e:
            # Log error but don't fail
            pass
        
        return None
    
    async def track_failed_attempt(self, ip: str) -> int:
        """Track failed login attempt from IP."""
        if not self.redis:
            return 0
        
        key = f"admin:failed_attempts:{ip}"
        attempts = await self.redis.incr(key)
        await self.redis.expire(key, 3600)  # Reset after 1 hour
        
        # Auto-block if too many attempts
        if attempts >= IPWhitelistConfig.MAX_FAILED_ATTEMPTS:
            await self.block_ip(
                ip=ip,
                reason=f"Too many failed login attempts ({attempts})",
                duration=IPWhitelistConfig.BLOCK_DURATION
            )
        
        return attempts
    
    async def get_ip_activity(
        self,
        ip: str,
        days: int = 7
    ) -> Dict[str, Any]:
        """Get activity summary for an IP."""
        # This would query audit logs in a real implementation
        return {
            'ip': ip,
            'first_seen': None,
            'last_seen': None,
            'total_requests': 0,
            'failed_attempts': 0,
            'unique_users': 0,
            'suspicious_activity': False
        }
    
    # Private helper methods
    
    async def _is_ip_whitelisted(self, ip: str) -> bool:
        """Check if IP is in whitelist."""
        entries = await self.list_whitelist_entries(include_expired=False)
        
        for entry in entries:
            if entry.is_active and entry.matches(ip):
                return True
        
        return False
    
    async def _is_ip_blocked(self, ip: str) -> bool:
        """Check if IP is blocked."""
        if self.redis:
            key = f"admin:blocked_ip:{ip}"
            return await self.redis.exists(key)
        return False
    
    async def _store_whitelist_entry(self, entry: IPWhitelistEntry) -> None:
        """Store whitelist entry in cache."""
        if self.redis:
            key = f"admin:whitelist:{entry.id}"
            data = self._serialize_entry(entry)
            
            if entry.expires_at:
                ttl = int((entry.expires_at - get_utc_now()).total_seconds())
                await self.redis.setex(key, ttl, data)
            else:
                await self.redis.set(key, data)
    
    async def _get_whitelist_entry(self, entry_id: UUID) -> Optional[IPWhitelistEntry]:
        """Get whitelist entry from cache."""
        if self.redis:
            key = f"admin:whitelist:{entry_id}"
            data = await self.redis.get(key)
            if data:
                return self._deserialize_entry(data)
        return None
    
    async def _remove_whitelist_entry(self, entry_id: UUID) -> None:
        """Remove whitelist entry from cache."""
        if self.redis:
            key = f"admin:whitelist:{entry_id}"
            await self.redis.delete(key)
    
    def _serialize_entry(self, entry: IPWhitelistEntry) -> str:
        """Serialize whitelist entry."""
        data = asdict(entry)
        data['id'] = str(data['id'])
        data['created_by'] = str(data['created_by']) if data['created_by'] else None
        data['created_at'] = data['created_at'].isoformat()
        data['expires_at'] = data['expires_at'].isoformat() if data['expires_at'] else None
        return json.dumps(data)
    
    def _deserialize_entry(self, data: str) -> IPWhitelistEntry:
        """Deserialize whitelist entry."""
        entry_data = json.loads(data)
        entry_data['id'] = UUID(entry_data['id'])
        entry_data['created_by'] = UUID(entry_data['created_by']) if entry_data['created_by'] else None
        entry_data['created_at'] = datetime.fromisoformat(entry_data['created_at'])
        entry_data['expires_at'] = datetime.fromisoformat(entry_data['expires_at']) if entry_data['expires_at'] else None
        return IPWhitelistEntry(**entry_data)
    
    def _serialize_geolocation(self, geo: GeolocationInfo) -> str:
        """Serialize geolocation info."""
        return json.dumps(asdict(geo))
    
    def _deserialize_geolocation(self, data: str) -> GeolocationInfo:
        """Deserialize geolocation info."""
        return GeolocationInfo(**json.loads(data))
    
    async def _log_ip_access(
        self,
        ip: str,
        user_id: Optional[UUID],
        allowed: bool,
        geo_info: Optional[GeolocationInfo] = None
    ) -> None:
        """Log IP access attempt."""
        # This would typically log to audit log
        pass
    
    async def _log_whitelist_change(
        self,
        action: str,
        entry: IPWhitelistEntry,
        user_id: UUID
    ) -> None:
        """Log whitelist changes."""
        # This would typically log to audit log
        pass
    
    async def _log_ip_event(
        self,
        action: str,
        ip: str,
        user_id: Optional[UUID] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> None:
        """Log IP-related events."""
        # This would typically log to audit log
        pass