-- Initialize database for development
-- This script runs when the PostgreSQL container is first created

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "unaccent";

-- Set default configuration
ALTER DATABASE jidelnicek SET timezone TO 'Europe/Prague';

-- Create application user if not exists (for additional security)
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

-- Create Alembic version table (will be used by migrations)
CREATE TABLE IF NOT EXISTS alembic_version (
    version_num VARCHAR(32) NOT NULL,
    CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num)
);

-- Grant permissions on alembic table
GRANT ALL ON TABLE alembic_version TO jidelnicek_app;

-- Add development-specific settings
SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;