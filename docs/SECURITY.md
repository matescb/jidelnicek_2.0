# Security Implementation Guide

## Overview

This document describes the security features implemented in Jídelníček 2.0, including security headers, CORS policies, CSRF protection, and request sanitization.

## Security Headers

The application implements comprehensive security headers through the `SecurityMiddleware`:

### HTTP Strict Transport Security (HSTS)
- **Header**: `Strict-Transport-Security`
- **Value**: `max-age=31536000; includeSubDomains; preload`
- **Purpose**: Forces HTTPS connections for 1 year, including subdomains
- **Production Only**: Yes

### Content Security Policy (CSP)
- **Header**: `Content-Security-Policy`
- **Purpose**: Prevents XSS attacks by controlling resource loading
- **Configuration**: 
  - Production: Restrictive policy allowing only trusted sources
  - Development: More permissive for local development

### Other Security Headers
- `X-Content-Type-Options: nosniff` - Prevents MIME type sniffing
- `X-Frame-Options: DENY` - Prevents clickjacking attacks
- `X-XSS-Protection: 1; mode=block` - Enables XSS filtering
- `Referrer-Policy: strict-origin-when-cross-origin` - Controls referrer information
- `Permissions-Policy` - Restricts browser features
- `X-Permitted-Cross-Domain-Policies: none` - Prevents cross-domain data loading
- `X-Download-Options: noopen` - Prevents file execution on download
- `X-DNS-Prefetch-Control: off` - Disables DNS prefetching

## CORS Configuration

Cross-Origin Resource Sharing (CORS) is configured with:

### Allowed Origins
Configure in `.env`:
```env
CORS_ORIGINS=http://localhost:3000,https://app.jidelnicek.cz
```

### CORS Settings
- **Credentials**: Enabled for cookie-based authentication
- **Methods**: GET, POST, PUT, DELETE, PATCH, OPTIONS
- **Headers**: All headers allowed (configurable)
- **Max Age**: 3600 seconds (1 hour)

### Exposed Headers
The following headers are exposed to JavaScript:
- `X-Request-ID` - For request tracking
- `X-CSRF-Token` - For CSRF protection
- `X-RateLimit-*` - Rate limiting information
- `API-Version` - API versioning information

## CSRF Protection

Cross-Site Request Forgery protection using double-submit cookie pattern:

### Implementation
- **Cookie Name**: `jidelnicek_csrf`
- **Header Name**: `X-CSRF-Token`
- **Token Length**: 32 bytes
- **Max Age**: 24 hours

### Usage
1. GET request sets CSRF cookie and returns token in header
2. State-changing requests (POST/PUT/DELETE) must include:
   - CSRF cookie
   - CSRF token in `X-CSRF-Token` header

### Excluded Endpoints
- `/auth/login` - Initial authentication
- `/auth/register` - User registration
- `/auth/token` - Token endpoints
- `/health` - Health checks
- Documentation endpoints

## Rate Limiting

Distributed rate limiting using Redis:

### Configuration
```env
RATE_LIMIT_ENABLED=true
RATE_LIMIT_REQUESTS=100
RATE_LIMIT_WINDOW=60
RATE_LIMIT_BURST=10
```

### Features
- Sliding window algorithm
- Per-user rate limiting (authenticated)
- Per-IP rate limiting (anonymous)
- Rate limit headers in responses

### Headers
- `X-RateLimit-Limit` - Request limit
- `X-RateLimit-Remaining` - Remaining requests
- `X-RateLimit-Reset` - Reset timestamp
- `Retry-After` - Seconds until retry (429 responses)

## Request Sanitization

### Request Size Limits
- Default: 10MB
- Configurable via `MAX_UPLOAD_SIZE`
- Returns 413 for oversized requests

### Input Sanitization
- Null byte removal from headers and parameters
- Control character filtering
- Path traversal prevention

### File Upload Security
- Filename sanitization
- Extension validation
- Path traversal prevention
- Length limits

### Allowed Extensions
Configure in `.env`:
```env
ALLOWED_UPLOAD_EXTENSIONS=.jpg,.jpeg,.png,.gif,.pdf,.doc,.docx
```

## API Versioning

### Version Headers
- `API-Version` - Current API version
- `API-Supported-Versions` - List of supported versions
- `API-Deprecation` - Deprecation status
- `API-Deprecation-Date` - Deprecation timeline

### Version Negotiation
- Request header: `API-Version: 2.0.0`
- Default: Current version (2.0.0)
- Returns 406 for unsupported versions

## Security Best Practices

### Development vs Production

#### Development
- More permissive CSP
- Debug information in errors
- Documentation endpoints enabled
- HTTP allowed

#### Production
- Strict CSP policy
- Generic error messages
- Documentation disabled
- HTTPS enforced
- Secure cookies required

### Configuration Checklist

1. **Secret Key**
   - Minimum 32 characters
   - Unique per environment
   - Never commit to version control

2. **HTTPS**
   - Enable `SESSION_COOKIE_SECURE` in production
   - Configure HSTS headers
   - Use TLS 1.2 or higher

3. **CORS**
   - Explicitly list allowed origins
   - Avoid wildcard origins in production
   - Configure specific methods and headers

4. **Rate Limiting**
   - Adjust limits based on usage patterns
   - Monitor for false positives
   - Implement bypass for trusted sources

5. **File Uploads**
   - Restrict file types
   - Implement virus scanning
   - Store outside web root
   - Generate unique filenames

## Testing Security

Run security tests:
```bash
pytest tests/core/test_security.py -v
```

Test coverage includes:
- Security header validation
- CSRF protection
- Rate limiting
- Request sanitization
- CORS configuration

## Security Monitoring

### Logging
- All security violations logged
- Request IDs for tracking
- Rate limit violations
- CSRF failures
- Invalid file uploads

### Metrics
- Rate limit hit rates
- CSRF token failures
- API version usage
- Security header compliance

### Alerts
Configure alerts for:
- Repeated rate limit violations
- CSRF attack patterns
- Unusual file upload patterns
- Deprecated API usage

## Incident Response

### Security Headers
1. Review CSP violations
2. Adjust policies as needed
3. Monitor for false positives

### Rate Limiting
1. Identify legitimate traffic
2. Adjust limits or whitelist
3. Block malicious sources

### CSRF Attacks
1. Review token validation logs
2. Check for compromised sessions
3. Rotate secrets if needed

## Compliance

The security implementation supports:
- GDPR requirements
- OWASP Top 10 protection
- PCI DSS (when payment enabled)
- SOC 2 compliance

## Updates and Maintenance

### Regular Tasks
- Review security headers quarterly
- Update CSP for new features
- Rotate secrets annually
- Review rate limits monthly

### Security Updates
- Monitor FastAPI security advisories
- Update dependencies regularly
- Review OWASP guidelines
- Conduct security audits