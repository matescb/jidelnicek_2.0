#!/bin/bash
# Test the new database setup with Alembic migrations

set -e

echo "=== Testing New Database Setup ==="
echo

echo "1. Stopping existing containers..."
docker-compose down

echo
echo "2. Removing old database volume..."
docker-compose down -v

echo
echo "3. Starting fresh database..."
docker-compose up -d db redis

echo
echo "4. Waiting for database to be ready..."
sleep 5

echo
echo "5. Checking database is accessible..."
docker-compose exec db psql -U jidelnicek -d jidelnicek -c "SELECT version();"

echo
echo "6. Starting app (will run migrations and seed data)..."
docker-compose up app