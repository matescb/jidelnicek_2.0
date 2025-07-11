#!/bin/sh
set -e

echo "Starting Jídelníček 2.0..."

# Wait for database to be ready
echo "Waiting for database..."
while ! nc -z db 5432; do
  sleep 1
done
echo "Database is ready!"

# Run database migrations
echo "Running database migrations..."
echo "DATABASE_URL: ${DATABASE_URL}"
# Export environment variables for alembic
export DB_HOST=${DB_HOST:-db}
export DB_PORT=${DB_PORT:-5432}
export DB_USER=${DB_USER:-jidelnicek}
export DB_PASSWORD=${DB_PASSWORD}
export DB_NAME=${DB_NAME:-jidelnicek}
alembic upgrade head

# Initialize database and seed data if needed
echo "Initializing database..."
# Ensure DATABASE_URL uses asyncpg for the Python app
# Get password from environment or use default
DB_PASSWORD=${DB_PASSWORD:-jidelnicek_dev_2024}
export DATABASE_URL="postgresql+asyncpg://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}"
echo "Using DATABASE_URL for seeding: ${DATABASE_URL}"

python -c "
import asyncio
from jidelnicek.core.dependencies import init_db, close_db
from jidelnicek.core.seed_data import check_and_seed

async def initialize():
    await init_db()
    try:
        seeded = await check_and_seed()
        if seeded:
            print('Successfully seeded initial categories and tags')
        else:
            print('Seed data already exists')
    except Exception as e:
        print(f'Seeding failed (non-fatal): {e}')
    finally:
        await close_db()

asyncio.run(initialize())
"

# Start the application
echo "Starting application..."
exec uvicorn jidelnicek.main:app --host 0.0.0.0 --port 8000 --workers 2