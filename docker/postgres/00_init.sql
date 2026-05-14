-- DEPRECATED: docker-compose now mounts docker/postgres/00_init.sh instead.
-- This file is retained only as an explanatory stub for fresh-clone users
-- who may still see references to it.  See 00_init.sh for the live init.
-- The literal-password version below is no longer executed in compose
-- (mount paths in docker-compose.yml / docker-compose.dev.yml were updated
-- in the same commit).  Issue #C-9 tracks the full least-privilege follow-up.

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
      -- Password creation moved to 00_init.sh (env-driven). This file is no
      -- longer mounted at /docker-entrypoint-initdb.d/ — the line below
      -- intentionally uses a placeholder so that any accidental run fails fast
      -- instead of installing a guessable credential.
      CREATE USER jidelnicek_app WITH PASSWORD 'CHANGE_ME_use_00_init_sh';
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