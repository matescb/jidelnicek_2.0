#!/bin/bash
# Run database migrations

set -e

echo "🔄 Running Database Migrations"
echo "============================="

# Check if virtual environment exists
if [ ! -d .venv ]; then
    echo "❌ Virtual environment not found! Run ./scripts/dev-setup.sh first."
    exit 1
fi

# Activate virtual environment
source .venv/bin/activate

# Load environment variables
source .env

# Export database URL for Alembic
export DATABASE_URL="postgresql://${DB_USER:-jidelnicek}:${DB_PASSWORD:?DB_PASSWORD must be set in .env}@localhost:5432/${DB_NAME:-jidelnicek}"

# Check if database is running
echo "🔍 Checking database connection..."
if ! docker-compose ps | grep -q "jidelnicek_db.*Up"; then
    echo "❌ Database is not running! Start it with: ./scripts/dev-start.sh"
    exit 1
fi

# Run migrations
echo "🚀 Running migrations..."
alembic upgrade head

# Show current migration status
echo ""
echo "📊 Current migration status:"
alembic current

echo ""
echo "✅ Migrations complete!"