#!/bin/bash
# Run the application locally without Docker
# Assumes PostgreSQL and Redis are installed locally or available

set -e

echo "🚀 Starting Jídelníček 2.0 (Local Development)"
echo "============================================="

# Check if virtual environment exists
if [ ! -d .venv ]; then
    echo "❌ Virtual environment not found! Creating one..."
    python3 -m venv .venv
    source .venv/bin/activate
    pip install --upgrade pip
    pip install poetry
    poetry install
else
    source .venv/bin/activate
fi

# Load environment variables
if [ -f .env ]; then
    source .env
else
    echo "❌ .env file not found! Creating from template..."
    cp .env.example .env
    echo "⚠️  Please edit .env and configure your database connection!"
    exit 1
fi

# Check if we should run migrations
if [ "$1" = "--migrate" ]; then
    echo "🔄 Running migrations..."
    alembic upgrade head
fi

# Create necessary directories
mkdir -p logs static media uploads

echo ""
echo "✅ Starting FastAPI application..."
echo ""
echo "📍 Services:"
echo "   - API: http://localhost:8000"
echo "   - API Docs: http://localhost:8000/docs"
echo "   - API Redoc: http://localhost:8000/redoc"
echo ""
echo "⚠️  Make sure PostgreSQL and Redis are running!"
echo "   PostgreSQL: $DB_HOST:$DB_PORT"
echo "   Redis: $REDIS_HOST:$REDIS_PORT"
echo ""
echo "Press Ctrl+C to stop..."
echo ""

# Start the FastAPI server
uvicorn src.jidelnicek.main:app --host 0.0.0.0 --port 8000 --reload --log-level debug