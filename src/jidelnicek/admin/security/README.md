# Admin Security Module

Comprehensive security measures and permission boundaries for the Jidelnicek admin interface.

## Features

### 1. Secure Session Management (`session_manager.py`)
- **Session Timeouts**: 30-minute inactivity timeout, 8-hour absolute timeout
- **Concurrent Session Limits**: Maximum 3 concurrent sessions per admin
- **Device Fingerprinting**: Tracks device information for security
- **Session Invalidation**: Manual and automatic session cleanup
- **Activity Tracking**: Monitor session activity and IP changes

### 2. Two-Factor Authentication (`two_factor.py`)
- **TOTP Support**: Time-based one-time passwords with QR codes
- **SMS Verification**: SMS-based 2FA with rate limiting
- **Backup Codes**: 10 single-use backup codes for recovery
- **Rate Limiting**: Protection against brute force attempts
- **Flexible Methods**: Support for multiple 2FA methods

### 3. IP Whitelisting & Geolocation (`ip_whitelist.py`)
- **IP Whitelist Management**: Allow specific IPs or CIDR ranges
- **Geolocation Tracking**: Track and validate access locations
- **VPN/Proxy Detection**: Block or allow VPN/proxy connections
- **Automatic Blocking**: Block suspicious IPs automatically
- **Country Restrictions**: Block access from specific countries

### 4. Security Headers (`security_headers.py`)
- **HSTS**: HTTP Strict Transport Security
- **CSP**: Content Security Policy with nonce support
- **Frame Options**: Prevent clickjacking attacks
- **XSS Protection**: Built-in XSS protection headers
- **Permissions Policy**: Control browser features

### 5. Security Middleware (`middleware/security.py`)
- **Unified Security Pipeline**: All security checks in one place
- **CSRF Protection**: Token-based CSRF protection
- **Rate Limiting**: Request rate limiting per IP
- **Authentication Enforcement**: Require auth for admin routes
- **Request Context**: Attach security context to requests

### 6. Security Audit Service (`services/security_audit.py`)
- **Automated Audits**: Scheduled security checks
- **Vulnerability Scanning**: Check for common vulnerabilities
- **Configuration Validation**: Verify security settings
- **Compliance Checking**: GDPR and other compliance checks
- **Security Scoring**: Overall security health score

### 7. Security Monitoring (`utils/security_monitor.py`)
- **Real-time Event Tracking**: Monitor security events
- **Anomaly Detection**: Detect unusual patterns
- **Alert System**: Email and webhook alerts
- **Security Dashboard**: Real-time security status
- **Event Analysis**: Pattern recognition and threat detection

## Configuration

Security settings are managed through `config/security_config.py`:

```python
from jidelnicek.admin.config.security_config import SecurityConfig

config = SecurityConfig.from_env()
```

### Key Configuration Options

```python
# Session Management
session_inactivity_timeout = timedelta(minutes=30)
session_absolute_timeout = timedelta(hours=8)
max_concurrent_sessions = 3

# Two-Factor Authentication
require_2fa = True
totp_issuer = "Jidelnicek Admin"
backup_codes_count = 10

# IP Security
enforce_ip_whitelist = True
allow_vpn_connections = False
auto_block_suspicious_ips = True

# Rate Limiting
rate_limit_window = timedelta(minutes=15)
rate_limit_max_requests = 100
```

## Usage

### 1. Initialize Security System

```python
from jidelnicek.admin.security.integration import create_admin_security_system

security_system = create_admin_security_system(
    db=db_session,
    redis_client=redis,
    sms_service=sms_service,
    config=security_config
)

# Setup middleware on FastAPI app
security_system.setup_middleware(app)
```

### 2. Admin Authentication

```python
# Login
session, error = await security_system.authenticate_admin(
    email="admin@example.com",
    password="secure_password",
    ip_address="192.168.1.1",
    user_agent="Mozilla/5.0"
)

# Verify 2FA
success, error = await security_system.verify_2fa(
    session_token=session.token,
    code="123456",
    method="totp"
)
```

### 3. Protect Endpoints

```python
from jidelnicek.admin.middleware.security import require_admin_auth

@app.get("/admin/users")
@require_admin_auth()
async def list_users(request: Request):
    # Endpoint is protected
    pass

@app.post("/admin/critical-action")
@require_admin_auth(require_2fa=True, permissions=["admin.write"])
async def critical_action(request: Request):
    # Requires 2FA and specific permissions
    pass
```

### 4. Manage Security

```python
# Add IP to whitelist
entry = await security_system.ip_whitelist.add_whitelist_entry(
    ip_or_cidr="192.168.1.0/24",
    description="Office network",
    created_by=admin_id,
    expires_in=timedelta(days=30)
)

# Run security audit
audit_result = await security_system.run_security_audit()

# Get security dashboard
dashboard = await security_system.get_security_dashboard()
```

## Security Best Practices

1. **Always require 2FA in production**
   ```python
   config.require_2fa = True  # Production setting
   ```

2. **Enforce IP whitelisting for sensitive environments**
   ```python
   config.enforce_ip_whitelist = True
   ```

3. **Regular security audits**
   ```python
   # Schedule daily audits
   await security_system.audit_service.schedule_periodic_audits(interval_hours=24)
   ```

4. **Monitor security events**
   ```python
   # Check for critical events regularly
   events = await security_system.monitor.get_recent_events(
       event_type=SecurityEventType.UNAUTHORIZED_ACCESS
   )
   ```

5. **Keep sessions short**
   ```python
   config.session_inactivity_timeout = timedelta(minutes=30)
   ```

## Environment Variables

```bash
# Core Settings
ENVIRONMENT=production
DEBUG=false

# Session Settings
ADMIN_SESSION_TIMEOUT=30  # minutes
ADMIN_MAX_SESSIONS=3

# Security Features
ADMIN_REQUIRE_2FA=true
ADMIN_ENFORCE_IP_WHITELIST=true

# Rate Limiting
ADMIN_RATE_LIMIT=100  # requests per window

# Alerts
ADMIN_SECURITY_ALERT_EMAIL=security@example.com
ADMIN_SECURITY_ALERT_WEBHOOK=https://example.com/webhook

# API Keys (for 2FA SMS, geolocation, etc.)
SMS_API_KEY=your_sms_api_key
GEOLOCATION_API_KEY=your_geo_api_key
```

## Testing

The module includes comprehensive tests in `/tests/admin/security/`:

```bash
# Run security tests
pytest tests/admin/security/

# Test specific components
pytest tests/admin/security/test_session_manager.py
pytest tests/admin/security/test_two_factor.py
```

## Security Checklist

- [ ] 2FA enabled for all admin accounts
- [ ] IP whitelist configured and enforced
- [ ] Security headers properly configured
- [ ] Rate limiting active
- [ ] Session timeouts configured
- [ ] Regular security audits scheduled
- [ ] Security monitoring active
- [ ] Alert notifications configured
- [ ] Backup codes generated for admins
- [ ] CSRF protection enabled
- [ ] All endpoints properly protected
- [ ] Security config validated

## Common Issues

### 1. Session Expiry
- Sessions expire after 30 minutes of inactivity
- Absolute timeout is 8 hours
- Users need to re-authenticate after expiry

### 2. IP Blocking
- IPs are automatically blocked after 5 failed attempts
- Block duration is 24 hours by default
- Admins can manually unblock IPs

### 3. 2FA Setup
- Admins must set up 2FA on first login
- Backup codes should be stored securely
- SMS fallback requires phone number verification

### 4. Rate Limiting
- 100 requests per 15-minute window by default
- Applies per IP address
- Exceeding limit results in temporary block

## Security Incident Response

1. **Suspicious Activity Detected**
   - Check security dashboard
   - Review recent security events
   - Run immediate security audit
   - Block suspicious IPs if needed

2. **Brute Force Attack**
   - Automatic IP blocking activates
   - Review failed login patterns
   - Consider lowering rate limits temporarily
   - Alert all admins

3. **Session Hijacking Attempt**
   - Invalidate all user sessions
   - Force password reset
   - Review session logs
   - Enable stricter IP checking

4. **Configuration Breach**
   - Run full security audit
   - Review and update all security settings
   - Rotate all secrets and keys
   - Review access logs