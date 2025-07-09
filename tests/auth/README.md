# Authentication Testing Documentation

## Overview

This directory contains comprehensive tests for the Jidelnicek 2.0 authentication system. The test suite covers unit tests, integration tests, security tests, penetration tests, and load tests to ensure the authentication system is robust, secure, and performant.

## Test Structure

### Core Test Files

1. **test_tokens.py** - JWT token functionality tests
   - Token generation and validation
   - Session management
   - Token blacklisting
   - Claim extraction
   - Session cleanup

2. **test_registration.py** - User registration tests
   - Valid registration flows
   - Email validation
   - Duplicate email handling
   - Password strength validation
   - Rate limiting

3. **test_login.py** - Login functionality tests
   - Valid login scenarios
   - Invalid credentials handling
   - Account status checks (locked, inactive)
   - CAPTCHA integration
   - Progressive delays
   - Session limit enforcement

4. **test_logout_refresh.py** - Logout and token refresh tests
   - Single session logout
   - All sessions logout
   - Token refresh flows
   - Refresh token rotation
   - Token blacklisting

5. **test_password_reset.py** - Password reset functionality
   - Reset request flow
   - Token validation
   - Password update
   - Session invalidation
   - Email notifications

6. **test_email_verification.py** - Email verification tests
   - Verification token generation
   - Token expiration
   - Resend functionality
   - Already verified handling

7. **test_rate_limiting.py** - Rate limiting tests
   - IP-based limiting
   - Account-based limiting
   - Distributed attack protection
   - Rate limit recovery

8. **test_session_management.py** - Session management tests
   - Session creation and validation
   - Device tracking
   - Concurrent session limits
   - Session revocation
   - Session metadata

### Security Test Files

9. **test_security_comprehensive.py** - Comprehensive security tests
   - SQL injection prevention
   - XSS prevention
   - CSRF protection
   - Authorization bypass attempts
   - Token manipulation
   - Session hijacking scenarios

10. **test_penetration.py** - Penetration testing scenarios
    - Brute force attacks
    - Timing attacks
    - Password enumeration
    - User enumeration
    - Token prediction
    - Session fixation

11. **test_load.py** - Load testing scenarios
    - Concurrent user registration
    - Simultaneous login attempts
    - Token refresh under load
    - Rate limiting effectiveness
    - Database connection pool testing

## Running Tests

### Run All Authentication Tests
```bash
pytest tests/auth/ -v
```

### Run Specific Test Categories

#### Security Tests Only
```bash
pytest tests/auth/test_security_comprehensive.py tests/auth/test_penetration.py -v
```

#### Load Tests Only
```bash
pytest tests/auth/test_load.py -v
```

#### Core Functionality Tests
```bash
pytest tests/auth/test_login.py tests/auth/test_registration.py tests/auth/test_tokens.py -v
```

### Run with Coverage
```bash
pytest tests/auth/ --cov=jidelnicek.auth --cov-report=html
```

## Test Coverage Goals

- **Target Coverage**: >90% for all authentication modules
- **Critical Paths**: 100% coverage for:
  - Token generation and validation
  - Password hashing and verification
  - Session management
  - Rate limiting

## Security Testing Checklist

### ✅ Injection Attacks
- [x] SQL injection on all input fields
- [x] NoSQL injection prevention
- [x] Command injection protection
- [x] Header injection prevention

### ✅ Authentication Attacks
- [x] Brute force protection
- [x] Credential stuffing defense
- [x] Password spray detection
- [x] Account lockout mechanisms

### ✅ Session Attacks
- [x] Session fixation prevention
- [x] Session hijacking detection
- [x] Concurrent session limits
- [x] Token replay protection

### ✅ Information Disclosure
- [x] User enumeration prevention
- [x] Timing attack mitigation
- [x] Error message sanitization
- [x] No password/token logging

### ✅ Token Security
- [x] JWT algorithm confusion
- [x] Token signature validation
- [x] Token expiration enforcement
- [x] Refresh token rotation

## Performance Benchmarks

### Expected Performance Metrics

| Operation | Target | Load Test Result |
|-----------|--------|------------------|
| Login | <500ms | Verified ✓ |
| Registration | <1s | Verified ✓ |
| Token Refresh | <200ms | Verified ✓ |
| Session Query | <100ms | Verified ✓ |

### Load Capacity

| Scenario | Target | Test Result |
|----------|--------|-------------|
| Concurrent Registrations | 50+ | Handles 50 ✓ |
| Concurrent Logins | 100+ | Handles 100 ✓ |
| Sessions per User | 5 (configurable) | Enforced ✓ |
| Rate Limit Accuracy | >95% | Verified ✓ |

## Known Limitations

1. **Email Enumeration**: Registration endpoint reveals if email exists (409 Conflict). This is a business decision for better UX.

2. **IP-Based Rate Limiting**: Can be bypassed with distributed IPs. Mitigated by account-based limits.

3. **Token Binding**: Access tokens are not bound to IP/device for flexibility. Monitoring recommended.

4. **Captcha**: Currently using simple math captcha. Consider upgrading to reCAPTCHA for production.

## Test Environment Setup

### Required Services
- PostgreSQL with test database
- Redis for caching and rate limiting
- SMTP server (can use mock in tests)

### Environment Variables
```bash
DATABASE_URL="postgresql+asyncpg://user:pass@localhost/test_db"
REDIS_URL="redis://localhost:6379/1"
SECRET_KEY="test-secret-key-do-not-use-in-production"
TESTING=true
```

## Continuous Integration

Tests are configured to run in CI/CD pipeline with:
- Parallel test execution
- Coverage reporting
- Security scanning
- Performance regression detection

## Maintenance

### Adding New Tests

When adding new authentication features:
1. Add unit tests for the feature
2. Add integration tests for API endpoints
3. Add security tests for potential vulnerabilities
4. Update this documentation

### Updating Security Tests

Security tests should be reviewed and updated:
- After security audits
- When new attack vectors are discovered
- Before major releases
- Quarterly security review

## Contact

For questions about authentication tests, contact the security team or refer to the main project documentation.