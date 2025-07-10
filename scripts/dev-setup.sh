#!/bin/bash
# Development environment setup script
# Run this once to set up your development environment

set -e

echo "🚀 Jídelníček 2.0 Development Setup"
echo "==================================="

# Check prerequisites
echo "📋 Checking prerequisites..."

if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is not installed. Please install Python 3.11+ first."
    exit 1
fi

echo "✅ All prerequisites installed"

# Check if .env exists
if [ ! -f .env ]; then
    echo "📝 Creating .env file from template..."
    cp .env.example .env
    echo "⚠️  Please edit .env and set your database passwords!"
    exit 1
fi

# Create necessary directories
echo "📁 Creating necessary directories..."
mkdir -p logs static media uploads

# Set up virtual environment
if [ ! -d .venv ]; then
    echo "🐍 Creating Python virtual environment..."
    python3 -m venv .venv
fi

echo "📦 Installing Python dependencies..."
source .venv/bin/activate
pip install --upgrade pip
pip install poetry
poetry install

# Stop any existing containers
echo "🔄 Stopping any existing containers..."
docker-compose down

# Start database and Redis only
echo "🚀 Starting PostgreSQL and Redis..."
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d db redis

# Wait for database to be ready
echo "⏳ Waiting for PostgreSQL to be ready..."
for i in {1..30}; do
    if docker-compose exec db pg_isready -U jidelnicek > /dev/null 2>&1; then
        echo "✅ PostgreSQL is ready!"
        break
    fi
    echo -n "."
    sleep 1
done

# Run migrations
echo "🔄 Running database migrations..."
docker-compose -f docker-compose.yml -f docker-compose.dev.yml run --rm app alembic upgrade head

echo ""
echo "✅ Development setup complete!"
echo ""
echo "📝 Next steps:"
echo "1. Start the development server: ./scripts/dev-start.sh"
echo "2. Access the API at: http://localhost:8000"
echo "3. Access API docs at: http://localhost:8000/docs"
echo "4. Access Mailhog at: http://localhost:8025"
echo ""
echo "📚 For more information, see DEVELOPMENT.md"