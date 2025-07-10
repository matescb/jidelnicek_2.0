#!/bin/bash
# Start development environment

set -e

echo "🚀 Starting Jídelníček 2.0 Development Environment"
echo "================================================="

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ .env file not found! Run ./scripts/dev-setup.sh first."
    exit 1
fi

# Load environment variables
source .env

# Start core services (db, redis, mailhog)
echo "🔄 Starting core services..."
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d db redis mailhog

# Wait for database to be ready
echo "⏳ Waiting for PostgreSQL to be ready..."
for i in {1..30}; do
    if docker-compose exec db pg_isready -U ${DB_USER:-jidelnicek} > /dev/null 2>&1; then
        echo "✅ PostgreSQL is ready!"
        break
    fi
    echo -n "."
    sleep 1
done

# Check if we should run migrations
if [ "$1" = "--migrate" ]; then
    echo "🔄 Running migrations..."
    source .venv/bin/activate
    alembic upgrade head
fi

# Start the FastAPI application locally (not in Docker for better debugging)
echo "🚀 Starting FastAPI application..."
source .venv/bin/activate

# Export environment variables for local development
export DATABASE_URL="postgresql://${DB_USER:-jidelnicek}:${DB_PASSWORD:-jidelnicek_dev_2024}@localhost:5432/${DB_NAME:-jidelnicek}"
export REDIS_URL="redis://:${REDIS_PASSWORD:-redis_dev_password_2024}@localhost:6379/0"

echo ""
echo "✅ Development environment started!"
echo ""
echo "📍 Services:"
echo "   - API: http://localhost:8000"
echo "   - API Docs: http://localhost:8000/docs"
echo "   - PostgreSQL: localhost:5432"
echo "   - Redis: localhost:6379"
echo "   - Mailhog: http://localhost:8025"
echo ""
echo "💡 Tips:"
echo "   - Check logs: docker-compose logs -f"
echo "   - Stop all: ./scripts/dev-stop.sh"
echo "   - Reset database: ./scripts/dev-reset.sh"
echo "   - Run with tools: ./scripts/dev-start.sh --with-tools"
echo ""

# Check if we should start additional tools
if [ "$1" = "--with-tools" ] || [ "$2" = "--with-tools" ]; then
    echo "🔧 Starting additional tools..."
    docker-compose -f docker-compose.yml -f docker-compose.dev.yml --profile tools up -d
    echo "   - pgAdmin: http://localhost:5050 (admin@jidelnicek.local / pgadmin_dev_2024)"
    echo "   - Redis Commander: http://localhost:8081"
fi

# Start the FastAPI server
echo ""
echo "Starting FastAPI server (press Ctrl+C to stop)..."
uvicorn src.jidelnicek.main:app --host 0.0.0.0 --port 8000 --reload --log-level debug