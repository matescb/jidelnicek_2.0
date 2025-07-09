# Configuration Guide for Jídelníček 2.0

This guide explains how to configure the Jídelníček 2.0 application for different environments.

## Overview

The application uses environment variables for configuration, managed through:
- `.env` files for local development
- Environment-specific configuration files in `/config/`
- Pydantic Settings for type-safe validation
- Docker environment variables for containerized deployments

## Quick Start

1. **Copy the example configuration:**
   ```bash
   cp .env.example .env
   ```

2. **Update required values:**
   - Change `SECRET_KEY` to a secure random string (minimum 32 characters)
   - Set database credentials (`DB_PASSWORD`)
   - Configure Redis password (`REDIS_PASSWORD`)
   - Add API keys for external services if needed

3. **Validate configuration:**
   ```bash
   python scripts/validate-config.py
   ```

## Configuration Files

### `.env.example`
Template file with all available configuration options. Copy this to `.env` for local development.

### `/config/` Directory
Environment-specific configurations:
- `development.env` - Local development settings
- `staging.env` - Staging environment
- `production.env` - Production settings
- `test.env` - Test runner configuration

### `docker-compose.override.yml`
Local development overrides for Docker services, including:
- Volume mounts for hot reload
- Debug ports
- Development tools (Mailhog, Adminer, Redis Commander)

## Core Configuration Sections

### Environment & Debugging
```env
ENVIRONMENT=development  # development | staging | production | test
DEBUG=true              # Enable debug mode (false in production)
LOG_LEVEL=INFO         # DEBUG | INFO | WARNING | ERROR | CRITICAL
```

### Application Settings
```env
SECRET_KEY=your-secret-key-here  # Minimum 32 characters
ALGORITHM=HS256                  # JWT algorithm
ACCESS_TOKEN_EXPIRE_MINUTES=30   # Access token lifetime
REFRESH_TOKEN_EXPIRE_DAYS=7      # Refresh token lifetime
```

### Database Configuration
```env
# Connection settings
DB_HOST=localhost
DB_PORT=5432
DB_NAME=jidelnicek
DB_USER=jidelnicek
DB_PASSWORD=secure-password

# Connection pool settings
DB_POOL_SIZE=20              # Number of connections
DB_POOL_MAX_OVERFLOW=0       # Additional connections when needed
DB_POOL_TIMEOUT=30.0         # Connection timeout in seconds
DB_ECHO=false                # Log SQL queries (debug only)
```

### Redis Configuration
```env
# Connection settings
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=0
REDIS_PASSWORD=redis-password

# Pool settings
REDIS_POOL_MAX_CONNECTIONS=50
REDIS_SOCKET_TIMEOUT=5
REDIS_SOCKET_CONNECT_TIMEOUT=5
```

### Security Settings
```env
# Password hashing
BCRYPT_ROUNDS=12              # Complexity (4-31, higher = more secure)

# Password requirements
PASSWORD_MIN_LENGTH=8
PASSWORD_REQUIRE_UPPERCASE=true
PASSWORD_REQUIRE_LOWERCASE=true
PASSWORD_REQUIRE_DIGITS=true
PASSWORD_REQUIRE_SPECIAL=true

# Login security
MAX_LOGIN_ATTEMPTS=5
LOCKOUT_DURATION_MINUTES=15
```

### Email Configuration
```env
EMAIL_HOST=localhost         # SMTP server
EMAIL_PORT=1025             # SMTP port
EMAIL_USERNAME=             # SMTP username (if required)
EMAIL_PASSWORD=             # SMTP password (if required)
EMAIL_FROM=noreply@jidelnicek.cz
EMAIL_FROM_NAME=Jídelníček 2.0
EMAIL_USE_TLS=false
EMAIL_USE_SSL=false
```

### CORS Settings
```env
CORS_ORIGINS=http://localhost:3000,http://localhost:8080
CORS_ALLOW_CREDENTIALS=true
CORS_ALLOW_METHODS=GET,POST,PUT,DELETE,PATCH,OPTIONS
CORS_ALLOW_HEADERS=*
CORS_MAX_AGE=3600
```

### File Upload Settings
```env
MAX_UPLOAD_SIZE=10485760     # 10MB in bytes
ALLOWED_UPLOAD_EXTENSIONS=.jpg,.jpeg,.png,.gif,.pdf,.doc,.docx
UPLOAD_PATH=uploads          # Upload directory
SECURE_UPLOADS=true          # Enable security checks
```

### API Rate Limiting
```env
RATE_LIMIT_ENABLED=true
RATE_LIMIT_REQUESTS=100      # Requests per window
RATE_LIMIT_WINDOW=60         # Window in seconds
RATE_LIMIT_BURST=10          # Burst allowance
```

### External Services
```env
# Bakaláři School System
BAKALARI_API_URL=https://api.bakalari.cz
BAKALARI_API_KEY=your-api-key
BAKALARI_TIMEOUT=30

# Strava Meal Service
STRAVA_API_URL=https://api.strava.cz
STRAVA_API_KEY=your-api-key
STRAVA_TIMEOUT=30

# Payment Gateway
PAYMENT_GATEWAY_ENABLED=false
PAYMENT_GATEWAY_URL=https://payment-gateway.cz
PAYMENT_GATEWAY_MERCHANT_ID=merchant-id
PAYMENT_GATEWAY_SECRET_KEY=secret-key
```

### Feature Flags
```env
FEATURE_STUDENT_ORDERING=true
FEATURE_PARENT_PORTAL=true
FEATURE_NUTRITION_TRACKING=true
FEATURE_ALLERGEN_ALERTS=true
FEATURE_RECIPE_SHARING=false
FEATURE_MEAL_RATINGS=true
FEATURE_MOBILE_APP=false
FEATURE_AI_RECOMMENDATIONS=false
```

### Monitoring
```env
# Sentry Error Tracking
SENTRY_DSN=https://your-sentry-dsn
SENTRY_TRACES_SAMPLE_RATE=0.1

# OpenTelemetry
OTEL_ENABLED=false
OTEL_ENDPOINT=http://localhost:4317
OTEL_SERVICE_NAME=jidelnicek-backend
```

### Backup Configuration
```env
BACKUP_ENABLED=true
BACKUP_RETENTION_DAYS=30
BACKUP_S3_BUCKET=jidelnicek-backups
BACKUP_S3_ACCESS_KEY=aws-access-key
BACKUP_S3_SECRET_KEY=aws-secret-key
BACKUP_S3_REGION=eu-central-1
BACKUP_ENCRYPTION_ENABLED=true
```

## Environment-Specific Settings

### Development
- Debug mode enabled
- Relaxed security settings
- All features enabled
- No rate limiting
- Mailhog for email testing
- SQLite supported for quick testing

### Staging
- Production-like settings
- Real email delivery
- External service integration
- Shorter backup retention
- Higher sampling rates for monitoring

### Production
- Strict security settings
- HTTPS required
- Conservative feature flags
- Full monitoring enabled
- Long backup retention
- Optimized performance settings

### Test
- In-memory databases
- Mocked external services
- All features enabled
- No rate limiting
- Fast password hashing

## Configuration Validation

The application provides comprehensive configuration validation:

### Automatic Validation
- Type checking via Pydantic
- Required field validation
- Format validation (URLs, emails, etc.)
- Range validation for numeric values

### Manual Validation Script
Run the validation script to check:
- Database connectivity
- Redis connectivity
- Email server reachability
- File permissions
- External service configuration
- Security settings

```bash
python scripts/validate-config.py
```

### Production Safeguards
- Prevents debug mode in production
- Requires secure cookies with HTTPS
- Validates secret key strength
- Checks for default passwords

## Docker Configuration

### Development with Docker Compose
```bash
# Start with development overrides
docker-compose up

# Or explicitly use override file
docker-compose -f docker-compose.yml -f docker-compose.override.yml up
```

### Production Deployment
```bash
# Use production environment file
docker-compose --env-file config/production.env up -d
```

### Environment Variables in Docker
Docker Compose supports variable substitution:
```yaml
environment:
  - DB_PASSWORD=${DB_PASSWORD}
  - SECRET_KEY=${SECRET_KEY}
```

## Configuration Best Practices

1. **Security**
   - Never commit `.env` files to version control
   - Use strong, unique passwords
   - Rotate secrets regularly
   - Enable all security features in production

2. **Performance**
   - Tune database pool size based on load
   - Configure appropriate cache TTLs
   - Set reasonable timeouts
   - Monitor resource usage

3. **Reliability**
   - Enable backups in production
   - Configure monitoring and alerting
   - Use health checks
   - Plan for service failures

4. **Development**
   - Use `.env.example` as documentation
   - Keep development settings close to production
   - Test with production-like data
   - Validate configuration changes

## Troubleshooting

### Common Issues

1. **Database Connection Failed**
   - Check host/port accessibility
   - Verify credentials
   - Ensure database exists
   - Check firewall rules

2. **Redis Connection Failed**
   - Verify Redis is running
   - Check password configuration
   - Test network connectivity
   - Review Redis logs

3. **Email Delivery Issues**
   - Verify SMTP settings
   - Check TLS/SSL configuration
   - Test with telnet/openssl
   - Review email server logs

4. **File Upload Errors**
   - Check directory permissions
   - Verify path exists
   - Review size limits
   - Check disk space

### Debug Commands

```bash
# Test database connection
psql -h localhost -U jidelnicek -d jidelnicek

# Test Redis connection
redis-cli -h localhost -a password ping

# Check email server
telnet localhost 1025

# Verify file permissions
ls -la uploads/
```

## Advanced Configuration

### Custom Settings Module
Create custom settings for specific deployments:

```python
from jidelnicek.core.config import Settings

class CustomSettings(Settings):
    # Add custom fields
    custom_field: str = "default"
    
    class Config:
        env_file = ".env.custom"
```

### Dynamic Configuration
Some settings can be changed at runtime via admin interface:
- Feature flags
- Rate limits
- Cache TTLs
- Scheduled job timings

### Configuration Profiles
Use configuration profiles for different scenarios:
```bash
# Load specific profile
JIDELNICEK_PROFILE=performance python -m jidelnicek
```

## Monitoring Configuration

### Health Checks
The application exposes health check endpoints:
- `/health` - Basic health check
- `/health/ready` - Readiness check (database, Redis)
- `/health/live` - Liveness check

### Metrics
When OpenTelemetry is enabled:
- Request duration histograms
- Database query metrics
- Cache hit/miss rates
- Error rates by endpoint

### Logging
Configure structured logging:
```env
LOG_LEVEL=INFO
LOG_FORMAT=json  # json | text
LOG_OUTPUT=stdout  # stdout | file | both
```

## Migration Guide

### From Environment Variables
When migrating from plain environment variables:
1. Copy current values to `.env`
2. Run validation script
3. Update any deprecated settings
4. Test in staging environment

### Version Upgrades
When upgrading Jídelníček versions:
1. Check release notes for configuration changes
2. Compare with new `.env.example`
3. Run validation after update
4. Monitor for deprecation warnings