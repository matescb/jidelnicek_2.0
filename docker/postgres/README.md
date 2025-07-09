# PostgreSQL Configuration for Jídelníček 2.0

This directory contains PostgreSQL configuration and initialization scripts for the Jídelníček 2.0 application.

## Files

### Initialization Scripts (run in order)

1. **init.sql** - Production database initialization
   - Creates extensions (uuid-ossp, pg_trgm, pgcrypto)
   - Creates application user with limited privileges
   - Creates read-only user for backups
   - Sets up security settings and timeouts

2. **01_schema.sql** - Database schema creation
   - Creates all tables with proper structure
   - Sets up foreign key relationships
   - Creates indexes for performance
   - Implements archive pattern (is_archived) instead of soft deletes

3. **02_functions.sql** - Functions and triggers
   - User limit enforcement (500 recipes, 100 trips per user)
   - Automatic timestamp updates
   - Fork tracking for recipes
   - Audit logging
   - Session management
   - Archive cascade operations

### Configuration Files

- **postgresql.conf** - Production PostgreSQL configuration
  - Optimized for VPS with 1.5GB RAM allocation
  - Connection pooling settings (max 10 connections)
  - Performance tuning for SSD storage
  - Logging configuration
  - Autovacuum settings

### Development Files

- **init-dev.sql** - Development-only initialization
  - Creates development user with full privileges
  - Creates test database
  - Less restrictive permissions for development

## Database Schema Overview

The database uses a single public schema with table prefixes for organization:

- **auth_*** - Authentication and user management
- **common_*** - Shared resources (ingredients, nutritional values, snacks)
- **recipe_*** - Recipe management
- **trip_*** - Trip planning
- **sharing_*** - Recipe sharing and reviews
- **audit_*** - Audit logging

## Key Design Decisions

1. **UUID Primary Keys** - All tables use UUID for better distributed system compatibility
2. **Archive Pattern** - Uses `is_archived` boolean instead of soft deletes
3. **JSONB Storage** - Used for flexible data like meal slots and recipe snapshots
4. **Proper Constraints** - Check constraints, foreign keys, and unique constraints enforced
5. **Performance Indexes** - Includes text search (GIN) and standard B-tree indexes

## Security Features

- Limited application user privileges
- Statement timeout (30s) to prevent long-running queries
- Lock timeout (10s) to prevent deadlocks
- Idle transaction timeout (5min) to free resources
- Separate read-only user for backups
- Audit logging for important operations

## Maintenance

### Daily Tasks
- Run backup script: `/scripts/backup-postgres.sh`
- Archived items older than 30 days are automatically cleaned

### Performance Monitoring
- Check slow query log (queries > 1 second are logged)
- Monitor connection usage
- Review autovacuum effectiveness

### Backup and Restore

```bash
# Backup
./scripts/backup-postgres.sh

# Restore
./scripts/restore-postgres.sh backup_jidelnicek_20250108_120000.sql.gz
```

## Connection Settings

### Production
```
Host: db (within Docker network)
Port: 5432
Database: jidelnicek
User: jidelnicek_app
Password: [Set in environment]
```

### Connection Pooling
- Min connections: 10
- Max connections: 20
- Recommended to use with asyncpg in the application

## Migration Management

The application uses Alembic for database migrations:

```bash
# Create new migration
alembic revision --autogenerate -m "Description"

# Apply migrations
alembic upgrade head

# Rollback one migration
alembic downgrade -1
```

## Troubleshooting

### High Memory Usage
- Check `shared_buffers` setting (currently 384MB)
- Review query plans for missing indexes
- Check for long-running transactions

### Slow Queries
- Enable `log_min_duration_statement` (currently 1000ms)
- Check for missing indexes
- Review table statistics (ANALYZE)

### Connection Issues
- Maximum 10 connections configured
- Check for connection leaks in application
- Consider using pgBouncer for additional pooling