#!/bin/bash
# Minimal PostgreSQL initialization for Jídelníček 2.0 — production stack.
# Only handles database infrastructure setup; application tables are managed
# by Alembic migrations.
#
# Reads from container env:
#   POSTGRES_USER         (already set by the image — superuser)
#   POSTGRES_DB           (already set by the image — initial database)
#   POSTGRES_PASSWORD     (already set by the image — superuser password)
#   APP_DB_PASSWORD       (required: password for the jidelnicek_app role;
#                          falls back to POSTGRES_PASSWORD)
#   READONLY_DB_PASSWORD  (optional: password for the jidelnicek_readonly role;
#                          falls back to APP_DB_PASSWORD)
#
# Replaces the deprecated 00_init_minimal.sql which had hardcoded dev passwords.
set -euo pipefail

APP_DB_PASSWORD="${APP_DB_PASSWORD:-${POSTGRES_PASSWORD:?POSTGRES_PASSWORD or APP_DB_PASSWORD must be set in the container env}}"
READONLY_DB_PASSWORD="${READONLY_DB_PASSWORD:-$APP_DB_PASSWORD}"

psql \
  --username "${POSTGRES_USER:-postgres}" \
  --dbname   "${POSTGRES_DB:-jidelnicek}" \
  --no-password --no-psqlrc \
  -v ON_ERROR_STOP=1 \
  -v app_password="$APP_DB_PASSWORD" \
  -v readonly_password="$READONLY_DB_PASSWORD" \
  <<-'EOSQL'

-- Required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";     -- text search
CREATE EXTENSION IF NOT EXISTS "unaccent";    -- accent-insensitive search
CREATE EXTENSION IF NOT EXISTS "pgcrypto";    -- encryption functions

-- Database-level configuration
ALTER DATABASE jidelnicek SET timezone TO 'Europe/Prague';
ALTER DATABASE jidelnicek SET statement_timeout = '30s';
ALTER DATABASE jidelnicek SET lock_timeout = '10s';
ALTER DATABASE jidelnicek SET idle_in_transaction_session_timeout = '5min';

-- Application user (least-privilege follow-up tracked in issue #C-9)
DO $do$
BEGIN
   IF NOT EXISTS (SELECT FROM pg_catalog.pg_user WHERE usename = 'jidelnicek_app') THEN
      EXECUTE format('CREATE USER jidelnicek_app WITH PASSWORD %L', :'app_password');
   END IF;
END
$do$;

GRANT ALL PRIVILEGES ON DATABASE jidelnicek TO jidelnicek_app;
GRANT ALL ON SCHEMA public TO jidelnicek_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES    TO jidelnicek_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO jidelnicek_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO jidelnicek_app;

-- Read-only user (for backups)
DO $do$
BEGIN
   IF NOT EXISTS (SELECT FROM pg_catalog.pg_user WHERE usename = 'jidelnicek_readonly') THEN
      EXECUTE format('CREATE USER jidelnicek_readonly WITH PASSWORD %L', :'readonly_password');
   END IF;
END
$do$;

GRANT CONNECT ON DATABASE jidelnicek TO jidelnicek_readonly;
GRANT USAGE ON SCHEMA public TO jidelnicek_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO jidelnicek_readonly;

-- Alembic will create its own version table when migrations run

EOSQL

echo "✓ jidelnicek_app + jidelnicek_readonly roles configured from env"
