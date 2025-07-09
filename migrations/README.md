# Database Migrations

This directory contains Alembic migrations for the Jídelníček 2.0 database schema.

## Migration Files

### 001_initial_schema.py
- Creates the initial database schema
- Sets up all core tables (auth, common, recipe, trip, sharing, audit modules)
- Adds basic indexes for foreign keys and primary lookups
- Includes full-text search indexes for recipes and ingredients

### 002_add_categories_tags.py
- Adds recipe categories and tags system
- Creates junction tables for many-to-many relationships
- Includes triggers for tag usage counting and category hierarchy validation
- Adds text search indexes for categories and tags

### 003_add_recipe_versions.py
- Adds recipe versioning system
- Tracks changes to recipes over time
- Includes change type classification and metadata
- Adds indexes for version history queries

### 004_add_performance_indexes.py
- **NEW**: Comprehensive performance optimization indexes
- Covers all major query patterns in the application
- Includes GIN indexes for full-text search
- Adds partial indexes for filtered queries
- Optimizes common JOIN operations

## Running Migrations

### Prerequisites
- PostgreSQL 12+ with required extensions:
  - `uuid-ossp` (UUID generation)
  - `pg_trgm` (trigram search)
  - `pgcrypto` (encryption functions)

### Commands
```bash
# Check current migration status
python -m alembic current

# Show migration history
python -m alembic history

# Upgrade to latest migration
python -m alembic upgrade head

# Upgrade to specific migration
python -m alembic upgrade 004_add_performance_indexes

# Downgrade one migration
python -m alembic downgrade -1

# Generate new migration
python -m alembic revision -m "Description of changes"

# Auto-generate migration from model changes
python -m alembic revision --autogenerate -m "Description of changes"
```

### Testing Migrations
Before running migrations in production:

1. **Test migration 004**: Run the validation script
   ```bash
   python scripts/test_migration_004.py
   ```

2. **Validate database**: Check that all indexes are created
   ```bash
   psql -f scripts/check_index_usage.sql
   ```

3. **Monitor performance**: After migration, monitor query performance
   ```bash
   # Check index usage
   SELECT * FROM pg_stat_user_indexes WHERE schemaname = 'public';
   
   # Check table sizes
   SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) 
   FROM pg_tables WHERE schemaname = 'public';
   ```

## Migration 004 Details

### Performance Improvements
The 004 migration adds 50+ indexes optimized for:

- **Recipe search**: Full-text and fuzzy matching
- **Filtering**: Categories, tags, nutritional values, timing
- **Sorting**: Date-based, popularity, ratings
- **User queries**: Personal content, activity tracking
- **Joins**: Relationship tables optimization

### Index Types Used
- **GIN indexes**: For full-text search and trigram matching
- **Partial indexes**: For filtered queries (e.g., non-archived records)
- **Composite indexes**: For multi-column query patterns
- **Expression indexes**: For calculated values

### Expected Performance Gains
- Search queries: 50-90% faster
- Filter operations: 70-95% faster
- Sort operations: 60-80% faster
- User queries: 80-95% faster
- Join operations: 40-70% faster

### Storage Impact
- Additional storage: ~10-20% of table size
- Index maintenance overhead: Minimal for read-heavy workloads
- Query planning time: Slightly increased but negligible

## Best Practices

### Before Migration
1. **Backup database**: Always backup before running migrations
2. **Test in staging**: Run migrations in staging environment first
3. **Check disk space**: Ensure sufficient space for new indexes
4. **Monitor connections**: Migrations may briefly lock tables

### After Migration
1. **Run VACUUM ANALYZE**: Update table statistics
2. **Monitor index usage**: Check `pg_stat_user_indexes`
3. **Watch for bloat**: Monitor index size growth
4. **Update application**: Deploy application code that uses new indexes

### Rollback Strategy
- All migrations include proper `downgrade()` functions
- Test rollback procedures in staging environment
- Monitor application after rollback for performance impacts

## Troubleshooting

### Common Issues
1. **Extension not available**: Ensure `pg_trgm` extension is installed
2. **Insufficient permissions**: Database user needs CREATE INDEX privileges
3. **Lock timeouts**: Long-running migrations may time out
4. **Disk space**: Large tables require significant space for indexes

### Recovery Steps
1. **Check migration status**: `python -m alembic current`
2. **Review migration logs**: Check application and database logs
3. **Manual cleanup**: Remove partially created indexes if needed
4. **Retry migration**: Re-run after fixing issues

## File Structure
```
migrations/
├── README.md                           # This file
├── env.py                             # Alembic environment configuration
├── script.py.mako                     # Migration template
├── 004_performance_indexes_summary.md # Detailed migration 004 documentation
├── versions/
│   ├── 001_initial_schema.py
│   ├── 002_add_categories_tags.py
│   ├── 003_add_recipe_versions.py
│   └── 004_add_performance_indexes.py
└── ../scripts/
    ├── check_index_usage.sql          # Index monitoring queries
    └── test_migration_004.py          # Migration validation script
```