"""
Two-factor authentication implementation for admin users.

Supports:
- TOTP (Time-based One-Time Password)
- SMS verification
- Backup codes
- Recovery options
"""

from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any, Tuple
from uuid import UUID, uuid4
import secrets
import qrcode
import io
import base64
from enum import Enum

import pyotp
from sqlalchemy import select, update, and_
from sqlalchemy.ext.asyncio import AsyncSession

from jidelnicek.core.utils import get_utc_now
from jidelnicek.auth.models import AuthUser
from jidelnicek.admin.models import AdminAuditLog, AdminAction
from jidelnicek.core.exceptions import (
    SecurityException,
    InvalidCodeException,
    TwoFactorRequiredException
)


class TwoFactorMethod(str, Enum):
    """Available 2FA methods."""
    TOTP = "totp"
    SMS = "sms"
    BACKUP_CODE = "backup_code"


class TwoFactorConfig:
    """Configuration for two-factor authentication."""
    TOTP_ISSUER = "Jidelnicek Admin"
    TOTP_PERIOD = 30  # seconds
    TOTP_DIGITS = 6
    
    SMS_CODE_LENGTH = 6
    SMS_CODE_EXPIRY = timedelta(minutes=10)
    SMS_MAX_ATTEMPTS = 3
    SMS_RATE_LIMIT = timedelta(minutes=1)
    
    BACKUP_CODES_COUNT = 10
    BACKUP_CODE_LENGTH = 8
    
    MAX_FAILED_ATTEMPTS = 5
    LOCKOUT_DURATION = timedelta(minutes=30)


class TwoFactorAuth:
    """Manages two-factor authentication for admin users."""
    
    def __init__(self, db: AsyncSession, sms_service=None, redis_client=None):
        self.db = db
        self.sms_service = sms_service
        self.redis = redis_client
    
    # TOTP Methods
    
    async def setup_totp(self, user: AuthUser) -> Tuple[str, str, List[str]]:
        """
        Set up TOTP for a user.
        
        Returns:
            - Secret key
            - QR code as base64 string
            - Backup codes
        """
        # Generate secret
        secret = pyotp.random_base32()
        
        # Create TOTP URI
        totp = pyotp.TOTP(
            secret,
            issuer=TwoFactorConfig.TOTP_ISSUER,
            interval=TwoFactorConfig.TOTP_PERIOD,
            digits=TwoFactorConfig.TOTP_DIGITS
        )
        provisioning_uri = totp.provisioning_uri(
            name=user.email,
            issuer_name=TwoFactorConfig.TOTP_ISSUER
        )
        
        # Generate QR code
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_L,
            box_size=10,
            border=4,
        )
        qr.add_data(provisioning_uri)
        qr.make(fit=True)
        
        # Convert to base64
        img = qr.make_image(fill_color="black", back_color="white")
        buffer = io.BytesIO()
        img.save(buffer, format='PNG')
        qr_code_base64 = base64.b64encode(buffer.getvalue()).decode()
        
        # Generate backup codes
        backup_codes = await self._generate_backup_codes()
        
        # Store in temporary cache until verified
        if self.redis:
            key = f"admin:2fa:setup:{user.id}"
            await self.redis.setex(
                key,
                3600,  # 1 hour to complete setup
                json.dumps({
                    'secret': secret,
                    'backup_codes': backup_codes,
                    'created_at': get_utc_now().isoformat()
                })
            )
        
        return secret, f"data:image/png;base64,{qr_code_base64}", backup_codes
    
    async def verify_totp_setup(
        self,
        user: AuthUser,
        code: str,
        secret: str
    ) -> bool:
        """Verify TOTP setup with user-provided code."""
        # Verify the code
        totp = pyotp.TOTP(
            secret,
            interval=TwoFactorConfig.TOTP_PERIOD,
            digits=TwoFactorConfig.TOTP_DIGITS
        )
        
        if not totp.verify(code, valid_window=1):
            return False
        
        # Get backup codes from cache
        backup_codes = []
        if self.redis:
            key = f"admin:2fa:setup:{user.id}"
            data = await self.redis.get(key)
            if data:
                setup_data = json.loads(data)
                backup_codes = setup_data.get('backup_codes', [])
        
        # Store 2FA configuration
        await self._store_2fa_config(
            user_id=user.id,
            method=TwoFactorMethod.TOTP,
            secret=secret,
            backup_codes=backup_codes
        )
        
        # Clear setup cache
        if self.redis:
            await self.redis.delete(f"admin:2fa:setup:{user.id}")
        
        # Log setup
        await self._log_2fa_event(
            user_id=user.id,
            action="2fa_setup",
            method=TwoFactorMethod.TOTP,
            success=True
        )
        
        return True
    
    async def verify_totp(self, user: AuthUser, code: str) -> bool:
        """Verify TOTP code for authentication."""
        # Get user's TOTP secret
        config = await self._get_2fa_config(user.id)
        if not config or config['method'] != TwoFactorMethod.TOTP:
            raise SecurityException("TOTP not configured for user")
        
        # Check for rate limiting
        if not await self._check_rate_limit(user.id):
            raise SecurityException("Too many failed attempts. Please try again later.")
        
        # Verify code
        totp = pyotp.TOTP(
            config['secret'],
            interval=TwoFactorConfig.TOTP_PERIOD,
            digits=TwoFactorConfig.TOTP_DIGITS
        )
        
        valid = totp.verify(code, valid_window=1)
        
        # Update attempt tracking
        await self._track_attempt(user.id, success=valid)
        
        # Log verification
        await self._log_2fa_event(
            user_id=user.id,
            action="2fa_verify",
            method=TwoFactorMethod.TOTP,
            success=valid
        )
        
        return valid
    
    # SMS Methods
    
    async def send_sms_code(self, user: AuthUser, phone_number: str) -> bool:
        """Send SMS verification code."""
        if not self.sms_service:
            raise SecurityException("SMS service not configured")
        
        # Check rate limit
        if self.redis:
            key = f"admin:2fa:sms:rate:{user.id}"
            if await self.redis.exists(key):
                raise SecurityException("Please wait before requesting another SMS code")
        
        # Generate code
        code = self._generate_sms_code()
        
        # Store code
        if self.redis:
            key = f"admin:2fa:sms:code:{user.id}"
            await self.redis.setex(
                key,
                int(TwoFactorConfig.SMS_CODE_EXPIRY.total_seconds()),
                json.dumps({
                    'code': code,
                    'phone': phone_number,
                    'attempts': 0,
                    'created_at': get_utc_now().isoformat()
                })
            )
            
            # Set rate limit
            rate_key = f"admin:2fa:sms:rate:{user.id}"
            await self.redis.setex(
                rate_key,
                int(TwoFactorConfig.SMS_RATE_LIMIT.total_seconds()),
                "1"
            )
        
        # Send SMS
        message = f"Your Jidelnicek Admin verification code is: {code}"
        success = await self.sms_service.send(phone_number, message)
        
        # Log event
        await self._log_2fa_event(
            user_id=user.id,
            action="2fa_sms_send",
            method=TwoFactorMethod.SMS,
            success=success,
            metadata={'phone_masked': self._mask_phone(phone_number)}
        )
        
        return success
    
    async def verify_sms_code(self, user: AuthUser, code: str) -> bool:
        """Verify SMS code."""
        if not self.redis:
            raise SecurityException("Redis required for SMS verification")
        
        key = f"admin:2fa:sms:code:{user.id}"
        data = await self.redis.get(key)
        
        if not data:
            raise InvalidCodeException("No active SMS verification")
        
        code_data = json.loads(data)
        
        # Check attempts
        if code_data['attempts'] >= TwoFactorConfig.SMS_MAX_ATTEMPTS:
            await self.redis.delete(key)
            raise SecurityException("Maximum attempts exceeded")
        
        # Update attempts
        code_data['attempts'] += 1
        await self.redis.setex(
            key,
            await self.redis.ttl(key),  # Keep same TTL
            json.dumps(code_data)
        )
        
        # Verify code
        valid = code_data['code'] == code
        
        if valid:
            # Clear code
            await self.redis.delete(key)
        
        # Log verification
        await self._log_2fa_event(
            user_id=user.id,
            action="2fa_sms_verify",
            method=TwoFactorMethod.SMS,
            success=valid
        )
        
        return valid
    
    # Backup Codes
    
    async def verify_backup_code(self, user: AuthUser, code: str) -> bool:
        """Verify and consume a backup code."""
        config = await self._get_2fa_config(user.id)
        if not config:
            raise SecurityException("2FA not configured for user")
        
        backup_codes = config.get('backup_codes', [])
        
        # Check if code exists
        if code not in backup_codes:
            await self._log_2fa_event(
                user_id=user.id,
                action="2fa_backup_verify",
                method=TwoFactorMethod.BACKUP_CODE,
                success=False
            )
            return False
        
        # Remove used code
        backup_codes.remove(code)
        
        # Update configuration
        await self._update_backup_codes(user.id, backup_codes)
        
        # Log usage
        await self._log_2fa_event(
            user_id=user.id,
            action="2fa_backup_verify",
            method=TwoFactorMethod.BACKUP_CODE,
            success=True,
            metadata={'remaining_codes': len(backup_codes)}
        )
        
        # Notify if running low on backup codes
        if len(backup_codes) <= 2:
            # TODO: Send notification to user
            pass
        
        return True
    
    async def regenerate_backup_codes(self, user: AuthUser) -> List[str]:
        """Generate new backup codes for user."""
        config = await self._get_2fa_config(user.id)
        if not config:
            raise SecurityException("2FA not configured for user")
        
        # Generate new codes
        backup_codes = await self._generate_backup_codes()
        
        # Update configuration
        await self._update_backup_codes(user.id, backup_codes)
        
        # Log regeneration
        await self._log_2fa_event(
            user_id=user.id,
            action="2fa_backup_regenerate",
            metadata={'count': len(backup_codes)}
        )
        
        return backup_codes
    
    # Status and Management
    
    async def get_2fa_status(self, user: AuthUser) -> Dict[str, Any]:
        """Get 2FA status for user."""
        config = await self._get_2fa_config(user.id)
        
        if not config:
            return {
                'enabled': False,
                'method': None,
                'backup_codes_count': 0
            }
        
        return {
            'enabled': True,
            'method': config['method'],
            'backup_codes_count': len(config.get('backup_codes', [])),
            'configured_at': config.get('configured_at')
        }
    
    async def disable_2fa(self, user: AuthUser, admin_override: bool = False) -> bool:
        """Disable 2FA for user."""
        config = await self._get_2fa_config(user.id)
        if not config:
            return False
        
        # Clear 2FA configuration
        await self._clear_2fa_config(user.id)
        
        # Log disabling
        await self._log_2fa_event(
            user_id=user.id,
            action="2fa_disable",
            metadata={'admin_override': admin_override}
        )
        
        return True
    
    # Private helper methods
    
    async def _generate_backup_codes(self) -> List[str]:
        """Generate backup codes."""
        codes = []
        for _ in range(TwoFactorConfig.BACKUP_CODES_COUNT):
            code = ''.join(
                secrets.choice('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789')
                for _ in range(TwoFactorConfig.BACKUP_CODE_LENGTH)
            )
            # Format as XXXX-XXXX
            formatted = f"{code[:4]}-{code[4:]}"
            codes.append(formatted)
        return codes
    
    def _generate_sms_code(self) -> str:
        """Generate SMS verification code."""
        return ''.join(
            secrets.choice('0123456789')
            for _ in range(TwoFactorConfig.SMS_CODE_LENGTH)
        )
    
    def _mask_phone(self, phone: str) -> str:
        """Mask phone number for logging."""
        if len(phone) <= 4:
            return "****"
        return f"{phone[:2]}***{phone[-2:]}"
    
    async def _check_rate_limit(self, user_id: UUID) -> bool:
        """Check if user is rate limited due to failed attempts."""
        if not self.redis:
            return True
        
        key = f"admin:2fa:lockout:{user_id}"
        return not await self.redis.exists(key)
    
    async def _track_attempt(self, user_id: UUID, success: bool) -> None:
        """Track authentication attempt."""
        if not self.redis:
            return
        
        if success:
            # Clear failed attempts
            await self.redis.delete(f"admin:2fa:attempts:{user_id}")
        else:
            # Increment failed attempts
            key = f"admin:2fa:attempts:{user_id}"
            attempts = await self.redis.incr(key)
            await self.redis.expire(key, 3600)  # Reset after 1 hour
            
            # Check if should lockout
            if attempts >= TwoFactorConfig.MAX_FAILED_ATTEMPTS:
                lockout_key = f"admin:2fa:lockout:{user_id}"
                await self.redis.setex(
                    lockout_key,
                    int(TwoFactorConfig.LOCKOUT_DURATION.total_seconds()),
                    "1"
                )
    
    async def _store_2fa_config(
        self,
        user_id: UUID,
        method: TwoFactorMethod,
        secret: str,
        backup_codes: List[str]
    ) -> None:
        """Store 2FA configuration for user."""
        # In a real implementation, this would be stored in the database
        # For now, we'll use Redis
        if self.redis:
            key = f"admin:2fa:config:{user_id}"
            config = {
                'method': method.value,
                'secret': secret,
                'backup_codes': backup_codes,
                'configured_at': get_utc_now().isoformat()
            }
            await self.redis.set(key, json.dumps(config))
    
    async def _get_2fa_config(self, user_id: UUID) -> Optional[Dict[str, Any]]:
        """Get 2FA configuration for user."""
        if not self.redis:
            return None
        
        key = f"admin:2fa:config:{user_id}"
        data = await self.redis.get(key)
        
        if data:
            config = json.loads(data)
            config['method'] = TwoFactorMethod(config['method'])
            return config
        
        return None
    
    async def _update_backup_codes(
        self,
        user_id: UUID,
        backup_codes: List[str]
    ) -> None:
        """Update backup codes for user."""
        config = await self._get_2fa_config(user_id)
        if config:
            config['backup_codes'] = backup_codes
            if self.redis:
                key = f"admin:2fa:config:{user_id}"
                await self.redis.set(key, json.dumps(config))
    
    async def _clear_2fa_config(self, user_id: UUID) -> None:
        """Clear 2FA configuration for user."""
        if self.redis:
            await self.redis.delete(f"admin:2fa:config:{user_id}")
    
    async def _log_2fa_event(
        self,
        user_id: UUID,
        action: str,
        method: Optional[TwoFactorMethod] = None,
        success: bool = True,
        metadata: Optional[Dict[str, Any]] = None
    ) -> None:
        """Log 2FA-related events."""
        # This would typically log to the AdminAuditLog table
        # Implementation depends on your audit logging strategy
        pass


# Import json at the top
import json