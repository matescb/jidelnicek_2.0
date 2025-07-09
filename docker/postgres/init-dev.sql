-- Development database initialization script
-- This script runs only in development environment

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- For text search

-- Create development user with full privileges
-- Note: In production, use more restricted permissions
DO
$do$
BEGIN
   IF NOT EXISTS (
      SELECT FROM pg_catalog.pg_user
      WHERE usename = 'jidelnicek_dev'
   ) THEN
      CREATE USER jidelnicek_dev WITH PASSWORD 'development';
   END IF;
END
$do$;

-- Grant all privileges to development user
GRANT ALL PRIVILEGES ON DATABASE jidelnicek TO jidelnicek_dev;
GRANT ALL ON SCHEMA public TO jidelnicek_dev;

-- Create test database for running tests
CREATE DATABASE jidelnicek_test WITH OWNER jidelnicek;
GRANT ALL PRIVILEGES ON DATABASE jidelnicek_test TO jidelnicek_dev;

-- Set default privileges
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO jidelnicek_dev;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO jidelnicek_dev;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO jidelnicek_dev;

-- Add comment
COMMENT ON DATABASE jidelnicek IS 'Jídelníček 2.0 - School cafeteria meal ordering system';
COMMENT ON DATABASE jidelnicek_test IS 'Test database for Jídelníček 2.0';