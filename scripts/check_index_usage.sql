-- Script to check index usage after migration 004
-- Run this after the migration to verify indexes are being used

-- Check index usage statistics
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan AS "Index Scans",
    idx_tup_read AS "Index Tuples Read",
    idx_tup_fetch AS "Index Tuples Fetched",
    CASE 
        WHEN idx_scan = 0 THEN 'UNUSED'
        WHEN idx_scan < 10 THEN 'LOW_USAGE'
        WHEN idx_scan < 100 THEN 'MEDIUM_USAGE'
        ELSE 'HIGH_USAGE'
    END AS usage_level
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;

-- Check table sizes and index sizes
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS "Total Size",
    pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) AS "Table Size",
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) AS "Index Size"
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Check for unused indexes (after some usage)
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
    AND idx_scan = 0
ORDER BY tablename, indexname;

-- Check most expensive queries that might benefit from indexes
SELECT 
    query,
    calls,
    total_time,
    mean_time,
    rows,
    100.0 * shared_blks_hit / nullif(shared_blks_hit + shared_blks_read, 0) AS hit_percent
FROM pg_stat_statements
WHERE query LIKE '%recipe%' OR query LIKE '%ingredient%' OR query LIKE '%user%'
ORDER BY total_time DESC
LIMIT 10;

-- Check index bloat (requires pg_stat_user_indexes)
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_blks_read,
    idx_blks_hit,
    CASE 
        WHEN idx_blks_read = 0 THEN 0
        ELSE round(100.0 * idx_blks_hit / (idx_blks_read + idx_blks_hit), 2)
    END AS hit_ratio
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
    AND (idx_blks_read > 0 OR idx_blks_hit > 0)
ORDER BY hit_ratio ASC;

-- Show GIN index statistics (for text search indexes)
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
    AND indexname LIKE '%gin%' OR indexname LIKE '%trgm%' OR indexname LIKE '%search%'
ORDER BY idx_scan DESC;

-- Check for foreign key constraints that might benefit from indexes
SELECT 
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
ORDER BY tc.table_name, tc.constraint_name;