#!/bin/bash
# Script to reset database to clean state for development

set -e

echo "⚠️  WARNING: This will drop and recreate the database!"
echo "Press Ctrl+C to cancel, or Enter to continue..."
read

echo "Stopping application container..."
docker-compose stop app || true

echo "Dropping and recreating database..."
docker-compose exec db psql -U jidelnicek -d postgres -c "DROP DATABASE IF EXISTS jidelnicek;"
docker-compose exec db psql -U jidelnicek -d postgres -c "CREATE DATABASE jidelnicek OWNER jidelnicek;"

echo "Running minimal init script..."
docker-compose exec db psql -U jidelnicek -d jidelnicek -f /docker-entrypoint-initdb.d/00_init_minimal.sql

echo "Database reset complete. Ready for migrations."
echo "To apply migrations and seed data, run: docker-compose up app"