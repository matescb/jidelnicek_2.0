-- Production database initialization script for Jídelníček 2.0
-- This script sets up the production database with proper security and performance settings

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";      -- For UUID generation
CREATE EXTENSION IF NOT EXISTS "pg_trgm";        -- For text search and similarity
CREATE EXTENSION IF NOT EXISTS "pgcrypto";       -- For encryption functions

-- Create application user with limited privileges
DO
$do$
BEGIN
   IF NOT EXISTS (
      SELECT FROM pg_catalog.pg_user
      WHERE usename = 'jidelnicek_app'
   ) THEN
      CREATE USER jidelnicek_app WITH PASSWORD 'CHANGE_ME_IN_PRODUCTION';
   END IF;
END
$do$;

-- Grant connection privilege
GRANT CONNECT ON DATABASE jidelnicek TO jidelnicek_app;

-- Grant schema privileges
GRANT USAGE ON SCHEMA public TO jidelnicek_app;

-- Grant table privileges (will be applied to future tables too)
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO jidelnicek_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO jidelnicek_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO jidelnicek_app;

-- Create read-only user for backups and reporting
DO
$do$
BEGIN
   IF NOT EXISTS (
      SELECT FROM pg_catalog.pg_user
      WHERE usename = 'jidelnicek_readonly'
   ) THEN
      CREATE USER jidelnicek_readonly WITH PASSWORD 'CHANGE_ME_IN_PRODUCTION';
   END IF;
END
$do$;

-- Grant read-only access
GRANT CONNECT ON DATABASE jidelnicek TO jidelnicek_readonly;
GRANT USAGE ON SCHEMA public TO jidelnicek_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO jidelnicek_readonly;

-- Set statement timeout for application user (30 seconds)
ALTER ROLE jidelnicek_app SET statement_timeout = '30s';

-- Set lock timeout for application user (10 seconds)
ALTER ROLE jidelnicek_app SET lock_timeout = '10s';

-- Set idle in transaction timeout (5 minutes)
ALTER ROLE jidelnicek_app SET idle_in_transaction_session_timeout = '5min';

-- Add database comment
COMMENT ON DATABASE jidelnicek IS 'Jídelníček 2.0 - School cafeteria meal ordering system';

-- Create initial schema version tracking table
CREATE TABLE IF NOT EXISTS schema_version (
    version VARCHAR(50) PRIMARY KEY,
    applied_at TIMESTAMP DEFAULT NOW(),
    description TEXT
);

-- Insert initial version
INSERT INTO schema_version (version, description)
VALUES ('1.0.0', 'Initial schema creation')
ON CONFLICT (version) DO NOTHING;