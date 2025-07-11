-- Minimal PostgreSQL initialization for Jídelníček 2.0
-- This file only handles database infrastructure setup
-- All application tables are managed by Alembic migrations

-- Create required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";     -- For text search
CREATE EXTENSION IF NOT EXISTS "unaccent";    -- For accent-insensitive search
CREATE EXTENSION IF NOT EXISTS "pgcrypto";    -- For encryption functions

-- Set database configuration
ALTER DATABASE jidelnicek SET timezone TO 'Europe/Prague';
ALTER DATABASE jidelnicek SET statement_timeout = '30s';
ALTER DATABASE jidelnicek SET lock_timeout = '10s';
ALTER DATABASE jidelnicek SET idle_in_transaction_session_timeout = '5min';

-- Create application user if not exists
DO
$do$
BEGIN
   IF NOT EXISTS (
      SELECT FROM pg_catalog.pg_user
      WHERE  usename = 'jidelnicek_app') THEN
      CREATE USER jidelnicek_app WITH PASSWORD 'jidelnicek_dev_2024';
   END IF;
END
$do$;

-- Grant privileges to application user
GRANT ALL PRIVILEGES ON DATABASE jidelnicek TO jidelnicek_app;
GRANT ALL ON SCHEMA public TO jidelnicek_app;

-- Set default privileges for future objects
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO jidelnicek_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO jidelnicek_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO jidelnicek_app;

-- Create read-only user for backups (optional for production)
DO
$do$
BEGIN
   IF NOT EXISTS (
      SELECT FROM pg_catalog.pg_user
      WHERE  usename = 'jidelnicek_readonly') THEN
      CREATE USER jidelnicek_readonly WITH PASSWORD 'readonly_dev_2024';
   END IF;
END
$do$;

-- Grant read-only access
GRANT CONNECT ON DATABASE jidelnicek TO jidelnicek_readonly;
GRANT USAGE ON SCHEMA public TO jidelnicek_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO jidelnicek_readonly;

-- Note: Alembic will create its own version table when migrations run