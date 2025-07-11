#!/bin/bash
# Start all services for development

set -e

echo "🚀 Starting Jídelníček 2.0 Development Environment"
echo

# Check if .env file exists
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found"
    echo "Please copy .env.example to .env and configure it"
    exit 1
fi

# Function to wait for a service
wait_for_service() {
    local service=$1
    local url=$2
    local max_attempts=30
    local attempt=1

    echo -n "⏳ Waiting for $service..."
    while [ $attempt -le $max_attempts ]; do
        if curl -s -o /dev/null -w "%{http_code}" "$url" | grep -q "200\|302\|404"; then
            echo " ✅"
            return 0
        fi
        echo -n "."
        sleep 2
        attempt=$((attempt + 1))
    done
    echo " ❌ Failed to connect to $service"
    return 1
}

# Start backend services
echo "📦 Starting backend services..."
docker-compose up -d db redis app

# Wait for services to be ready
echo "⏳ Waiting for services to start..."
sleep 5  # Give services time to initialize

# Check if services are healthy using docker-compose
echo -n "⏳ Checking Database health..."
if docker-compose exec -T db pg_isready -U jidelnicek >/dev/null 2>&1; then
    echo " ✅"
else
    echo " ❌ (non-critical)"
fi

echo -n "⏳ Checking Redis health..."
if docker-compose exec -T redis redis-cli ping >/dev/null 2>&1; then
    echo " ✅"
else
    echo " ❌ (non-critical)"
fi

# Wait for backend API
wait_for_service "Backend API" "http://localhost:8000/docs"

# Start frontend
echo "🎨 Starting frontend..."
docker-compose up -d frontend

# Wait for frontend
wait_for_service "Frontend" "http://localhost:3001"

echo
echo "✅ All services started successfully!"
echo
echo "🌐 Access points:"
echo "   Frontend:    http://localhost:3001"
echo "   Backend API: http://localhost:8000"
echo "   API Docs:    http://localhost:8000/docs"
echo "   Database:    localhost:5432"
echo "   Redis:       localhost:6379"
echo
echo "📋 Useful commands:"
echo "   View logs:       docker-compose logs -f [service]"
echo "   Stop all:        docker-compose down"
echo "   Restart service: docker-compose restart [service]"
echo "   Shell access:    docker-compose exec [service] sh"
echo
echo "💡 Services: db, redis, app, frontend"