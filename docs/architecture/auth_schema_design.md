# Authentication Schema Design

## Overview

The authentication system for Jídelníček 2.0 is designed with security, scalability, and user experience as primary concerns. This document outlines the key design decisions made for the authentication database schema.

## Schema Structure

### 1. auth_users Table

The core user table contains all user account information and preferences.

**Key Design Decisions:**

- **UUID Primary Keys**: Using UUIDs instead of sequential integers prevents enumeration attacks and makes the system more suitable for distributed environments.

- **Email Normalization**: Emails are stored in lowercase with a functional index on `lower(email)` for case-insensitive lookups while preserving the original case.

- **Separate Security Fields**: Added `is_active`, `failed_login_attempts`, and `locked_until` for comprehensive account security management.

- **Role-Based Access**: Using a simple `role` field with CHECK constraint (user/admin) instead of a complex permissions system, as per PRD requirements for only two roles.

- **Preference Storage**: User preferences (language, units, timezone) are stored directly in the user table for quick access without joins.

### 2. auth_sessions Table

Manages JWT refresh tokens and session tracking.

**Key Design Decisions:**

- **Token Hashing**: Storing `token_hash` instead of plain tokens prevents token theft if the database is compromised.

- **Session Fingerprinting**: Storing IP address and user agent allows detection of session hijacking attempts.

- **Soft Invalidation**: The `is_valid` field allows immediate session invalidation without deletion, maintaining audit trail.

- **Expiration Index**: Index on `expires_at` enables efficient cleanup of expired sessions.

### 3. Separate Token Tables

Created dedicated tables for password reset and email verification tokens instead of storing them in the users table.

**Key Design Decisions:**

- **Single Responsibility**: Each table has a clear purpose, making the code more maintainable.

- **Token History**: Keeping token records allows detection of suspicious patterns (e.g., multiple reset attempts).

- **IP Tracking**: Recording request and usage IPs helps identify potential attacks.

- **Expiration Management**: Separate tables make it easier to implement different expiration policies (1 hour for password reset, 24 hours for email verification).

### 4. audit_log Table

Comprehensive logging of security-relevant events.

**Key Design Decisions:**

- **Generic Structure**: Using `entity_type` and `entity_id` allows logging events for any entity type.

- **JSONB for Changes**: The `changes` field uses PostgreSQL's JSONB type for flexible storage of before/after values.

- **User Association**: `user_id` is nullable to allow logging of anonymous events (e.g., failed login attempts with non-existent email).

## Security Considerations

### 1. Password Storage

- Using bcrypt with cost factor 12 (configurable)
- Password hash storage only, never plain text
- Timing-safe comparison in application layer

### 2. Account Lockout

- Progressive delays: 5 minutes, 15 minutes, 1 hour
- Lockout after 5 failed attempts
- Automatic unlock after lockout period
- Failed attempt counter reset on successful login

### 3. Token Security

- Cryptographically secure token generation
- Single-use enforcement for all tokens
- Automatic expiration
- Token hashing for session tokens

### 4. Session Management

- Maximum 5 concurrent sessions per user
- Session binding to IP/User-Agent fingerprint
- Automatic cleanup of expired sessions
- Force logout capability

## Performance Optimizations

### 1. Indexes

Strategic indexes for common queries:
- Email lookup (case-insensitive)
- Active user queries
- Session token lookup
- Token expiration queries
- Audit log queries by user, entity, and timestamp

### 2. Archival Strategy

Using `is_archived` flag instead of soft deletes:
- Keeps referential integrity intact
- Allows easy restoration
- Filtered indexes exclude archived records

### 3. Constraint Design

Database-level constraints ensure data integrity:
- CHECK constraints for enums (language, units, role)
- Foreign key constraints with appropriate CASCADE rules
- Unique constraints on emails and tokens

## Migration Strategy

The schema enhancement is implemented as an Alembic migration that:
1. Adds missing columns to existing tables
2. Creates new token tables
3. Migrates existing token data (if any)
4. Adds all necessary indexes
5. Maintains backward compatibility during migration

## Future Considerations

### 1. Two-Factor Authentication (Phase 2)

The schema is prepared for 2FA addition:
- Can add TOTP secret to users table
- Can create recovery codes table
- Session elevation tracking ready

### 2. OAuth Integration

Current schema supports OAuth by:
- Allowing null passwords for OAuth-only accounts
- Email as primary identifier
- Provider mapping table can be added

### 3. API Tokens

The `auth_tokens` table is designed for future API access:
- Long-lived tokens for mobile apps
- Named tokens for management
- Usage tracking built-in

## Compliance

The schema supports GDPR compliance through:
- Data minimization (only necessary fields)
- Right to erasure (archival system)
- Audit trail for accountability
- Secure token storage

## Testing Considerations

Key areas for testing:
1. Email uniqueness with case variations
2. Token expiration and single-use enforcement
3. Account lockout logic
4. Session fingerprint validation
5. Concurrent session limits
6. Migration rollback scenarios