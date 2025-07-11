#!/bin/bash
# Non-interactive database reset for testing

set -e

echo "=== Force Database Reset ==="

echo "Stopping application container..."
docker-compose stop app || true

echo "Dropping and recreating database..."
docker-compose exec db psql -U jidelnicek -d postgres -c "DROP DATABASE IF EXISTS jidelnicek;"
docker-compose exec db psql -U jidelnicek -d postgres -c "CREATE DATABASE jidelnicek OWNER jidelnicek;"

echo "Running minimal init script..."
docker-compose exec db psql -U jidelnicek -d jidelnicek -f /docker-entrypoint-initdb.d/00_init_minimal.sql

echo "Database reset complete. Ready for migrations."