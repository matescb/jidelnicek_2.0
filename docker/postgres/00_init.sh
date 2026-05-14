#!/bin/bash
# Postgres initialization for Jídelníček 2.0 — dev/local stack.
# Runs once on a fresh /var/lib/postgresql/data volume (per official postgres image
# docker-entrypoint conventions).
#
# Reads from container env:
#   POSTGRES_USER         (already set by the image — superuser)
#   POSTGRES_DB           (already set by the image — initial database)
#   POSTGRES_PASSWORD     (already set by the image — superuser password)
#   APP_DB_PASSWORD       (required: password for the jidelnicek_app role;
#                          falls back to POSTGRES_PASSWORD if unset)
#   READONLY_DB_PASSWORD  (optional: password for the jidelnicek_readonly role;
#                          falls back to APP_DB_PASSWORD)
#
# Replaces the deprecated 00_init.sql which had hardcoded dev passwords.
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
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "unaccent";

-- Default configuration
ALTER DATABASE jidelnicek SET timezone TO 'Europe/Prague';

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

-- Alembic version table (created here so the role has it from the start)
CREATE TABLE IF NOT EXISTS alembic_version (
    version_num VARCHAR(32) NOT NULL,
    CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num)
);
GRANT ALL ON TABLE alembic_version TO jidelnicek_app;

EOSQL

echo "✓ jidelnicek_app role configured from env"
