"""
Tests for two-factor authentication.
"""

import pytest
import pytest_asyncio
from datetime import datetime, timedelta
from uuid import uuid4
import pyotp
import json

from jidelnicek.admin.security.two_factor import (
    TwoFactorAuth,
    TwoFactorMethod,
    TwoFactorConfig
)
from jidelnicek.auth.models import AuthUser
from jidelnicek.core.utils import get_utc_now
from jidelnicek.core.exceptions import (
    SecurityException,
    InvalidCodeException,
    TwoFactorRequiredException
)


@pytest.fixture
def admin_user():
    """Create test admin user."""
    return AuthUser(
        id=uuid4(),
        email="admin@test.com",
        role="admin",
        is_active=True,
        email_verified=True
    )


@pytest.fixture
def mock_sms_service():
    """Mock SMS service."""
    class MockSMSService:
        def __init__(self):
            self.sent_messages = []
        
        async def send(self, phone: str, message: str) -> bool:
            self.sent_messages.append({
                'phone': phone,
                'message': message,
                'timestamp': get_utc_now()
            })
            return True
    
    return MockSMSService()


@pytest_asyncio.fixture(scope="function")
async def two_factor_auth(async_db, redis_client, mock_sms_service):
    """Create two-factor auth instance."""
    return TwoFactorAuth(async_db, mock_sms_service, redis_client)


class TestTOTPAuthentication:
    """Test TOTP-based 2FA."""
    
    async def test_totp_setup(self, two_factor_auth, admin_user):
        """Test TOTP setup process."""
        # Setup TOTP
        secret, qr_code, backup_codes = await two_factor_auth.setup_totp(admin_user)
        
        # Verify returns
        assert len(secret) == 32  # Base32 encoded
        assert qr_code.startswith("data:image/png;base64,")
        assert len(backup_codes) == TwoFactorConfig.BACKUP_CODES_COUNT
        
        # Verify backup code format
        for code in backup_codes:
            assert len(code) == 9  # 8 chars + 1 dash
            assert code[4] == '-'
    
    async def test_totp_verification(self, two_factor_auth, admin_user):
        """Test TOTP code verification."""
        # Setup TOTP
        secret, _, _ = await two_factor_auth.setup_totp(admin_user)
        
        # Generate valid code
        totp = pyotp.TOTP(secret)
        valid_code = totp.now()
        
        # Verify setup
        verified = await two_factor_auth.verify_totp_setup(
            admin_user,
            valid_code,
            secret
        )
        assert verified is True
        
        # Now verify normal authentication
        auth_result = await two_factor_auth.verify_totp(admin_user, valid_code)
        assert auth_result is True
    
    async def test_totp_invalid_code(self, two_factor_auth, admin_user):
        """Test TOTP with invalid code."""
        # Setup TOTP
        secret, _, _ = await two_factor_auth.setup_totp(admin_user)
        totp = pyotp.TOTP(secret)
        valid_code = totp.now()
        
        # Complete setup
        await two_factor_auth.verify_totp_setup(admin_user, valid_code, secret)
        
        # Try invalid code
        auth_result = await two_factor_auth.verify_totp(admin_user, "000000")
        assert auth_result is False
    
    async def test_totp_rate_limiting(self, two_factor_auth, admin_user):
        """Test TOTP rate limiting after failed attempts."""
        # Setup TOTP
        secret, _, _ = await two_factor_auth.setup_totp(admin_user)
        totp = pyotp.TOTP(secret)
        valid_code = totp.now()
        
        # Complete setup
        await two_factor_auth.verify_totp_setup(admin_user, valid_code, secret)
        
        # Make many failed attempts
        for _ in range(TwoFactorConfig.MAX_FAILED_ATTEMPTS):
            await two_factor_auth.verify_totp(admin_user, "000000")
        
        # Next attempt should be rate limited
        with pytest.raises(SecurityException, match="Too many failed attempts"):
            await two_factor_auth.verify_totp(admin_user, valid_code)


class TestSMSAuthentication:
    """Test SMS-based 2FA."""
    
    async def test_send_sms_code(
        self,
        two_factor_auth,
        admin_user,
        mock_sms_service
    ):
        """Test sending SMS verification code."""
        phone = "+1234567890"
        
        # Send code
        sent = await two_factor_auth.send_sms_code(admin_user, phone)
        assert sent is True
        
        # Check SMS was sent
        assert len(mock_sms_service.sent_messages) == 1
        sms = mock_sms_service.sent_messages[0]
        assert sms['phone'] == phone
        assert "verification code" in sms['message']
    
    async def test_verify_sms_code(
        self,
        two_factor_auth,
        admin_user,
        redis_client
    ):
        """Test SMS code verification."""
        phone = "+1234567890"
        
        # Send code
        await two_factor_auth.send_sms_code(admin_user, phone)
        
        # Get the code from Redis (in real scenario, user would receive via SMS)
        key = f"admin:2fa:sms:code:{admin_user.id}"
        data = await redis_client.get(key)
        code_data = json.loads(data)
        code = code_data['code']
        
        # Verify correct code
        verified = await two_factor_auth.verify_sms_code(admin_user, code)
        assert verified is True
        
        # Code should be consumed
        data = await redis_client.get(key)
        assert data is None
    
    async def test_sms_rate_limiting(
        self,
        two_factor_auth,
        admin_user
    ):
        """Test SMS rate limiting."""
        phone = "+1234567890"
        
        # Send first code
        await two_factor_auth.send_sms_code(admin_user, phone)
        
        # Try to send another immediately
        with pytest.raises(SecurityException, match="Please wait"):
            await two_factor_auth.send_sms_code(admin_user, phone)
    
    async def test_sms_max_attempts(
        self,
        two_factor_auth,
        admin_user,
        redis_client
    ):
        """Test SMS max verification attempts."""
        phone = "+1234567890"
        
        # Send code
        await two_factor_auth.send_sms_code(admin_user, phone)
        
        # Make max failed attempts
        for _ in range(TwoFactorConfig.SMS_MAX_ATTEMPTS):
            try:
                await two_factor_auth.verify_sms_code(admin_user, "000000")
            except:
                pass
        
        # Next attempt should fail
        with pytest.raises(SecurityException, match="Maximum attempts exceeded"):
            await two_factor_auth.verify_sms_code(admin_user, "000000")


class TestBackupCodes:
    """Test backup code functionality."""
    
    async def test_backup_code_generation(self, two_factor_auth, admin_user):
        """Test backup code generation."""
        # Setup TOTP (which includes backup codes)
        secret, _, backup_codes = await two_factor_auth.setup_totp(admin_user)
        
        # Verify backup codes
        assert len(backup_codes) == TwoFactorConfig.BACKUP_CODES_COUNT
        
        # Check uniqueness
        assert len(set(backup_codes)) == len(backup_codes)
        
        # Check format
        for code in backup_codes:
            assert len(code) == 9  # XXXX-XXXX
            assert code[4] == '-'
            # Should be alphanumeric
            assert all(c.isalnum() or c == '-' for c in code)
    
    async def test_backup_code_verification(
        self,
        two_factor_auth,
        admin_user
    ):
        """Test using backup codes."""
        # Setup TOTP
        secret, _, backup_codes = await two_factor_auth.setup_totp(admin_user)
        totp = pyotp.TOTP(secret)
        
        # Complete setup
        await two_factor_auth.verify_totp_setup(
            admin_user,
            totp.now(),
            secret
        )
        
        # Use a backup code
        verified = await two_factor_auth.verify_backup_code(
            admin_user,
            backup_codes[0]
        )
        assert verified is True
        
        # Same code should not work again
        verified = await two_factor_auth.verify_backup_code(
            admin_user,
            backup_codes[0]
        )
        assert verified is False
    
    async def test_backup_code_regeneration(
        self,
        two_factor_auth,
        admin_user
    ):
        """Test regenerating backup codes."""
        # Setup TOTP
        secret, _, original_codes = await two_factor_auth.setup_totp(admin_user)
        totp = pyotp.TOTP(secret)
        
        # Complete setup
        await two_factor_auth.verify_totp_setup(
            admin_user,
            totp.now(),
            secret
        )
        
        # Regenerate codes
        new_codes = await two_factor_auth.regenerate_backup_codes(admin_user)
        
        # Should be different
        assert set(new_codes) != set(original_codes)
        assert len(new_codes) == TwoFactorConfig.BACKUP_CODES_COUNT
        
        # Old codes should not work
        verified = await two_factor_auth.verify_backup_code(
            admin_user,
            original_codes[0]
        )
        assert verified is False
        
        # New codes should work
        verified = await two_factor_auth.verify_backup_code(
            admin_user,
            new_codes[0]
        )
        assert verified is True


class TestTwoFactorManagement:
    """Test 2FA management functions."""
    
    async def test_get_2fa_status(self, two_factor_auth, admin_user):
        """Test getting 2FA status."""
        # Check status before setup
        status = await two_factor_auth.get_2fa_status(admin_user)
        assert status['enabled'] is False
        assert status['method'] is None
        
        # Setup TOTP
        secret, _, _ = await two_factor_auth.setup_totp(admin_user)
        totp = pyotp.TOTP(secret)
        await two_factor_auth.verify_totp_setup(
            admin_user,
            totp.now(),
            secret
        )
        
        # Check status after setup
        status = await two_factor_auth.get_2fa_status(admin_user)
        assert status['enabled'] is True
        assert status['method'] == TwoFactorMethod.TOTP
        assert status['backup_codes_count'] == TwoFactorConfig.BACKUP_CODES_COUNT
    
    async def test_disable_2fa(self, two_factor_auth, admin_user):
        """Test disabling 2FA."""
        # Setup TOTP
        secret, _, _ = await two_factor_auth.setup_totp(admin_user)
        totp = pyotp.TOTP(secret)
        await two_factor_auth.verify_totp_setup(
            admin_user,
            totp.now(),
            secret
        )
        
        # Verify it's enabled
        status = await two_factor_auth.get_2fa_status(admin_user)
        assert status['enabled'] is True
        
        # Disable it
        disabled = await two_factor_auth.disable_2fa(admin_user)
        assert disabled is True
        
        # Verify it's disabled
        status = await two_factor_auth.get_2fa_status(admin_user)
        assert status['enabled'] is False
        
        # TOTP should no longer work
        with pytest.raises(SecurityException, match="TOTP not configured"):
            await two_factor_auth.verify_totp(admin_user, totp.now())