#!/bin/bash
# Stop development environment

echo "🛑 Stopping Jídelníček 2.0 Development Environment"
echo "================================================="

# Stop all containers
echo "🔄 Stopping all containers..."
docker-compose -f docker-compose.yml -f docker-compose.dev.yml --profile tools down

# Kill any local uvicorn processes
echo "🔄 Stopping any local FastAPI processes..."
pkill -f "uvicorn src.jidelnicek.main:app" || true

echo ""
echo "✅ Development environment stopped!"
echo ""
echo "💡 Note: Database data is preserved in Docker volumes."
echo "   To completely reset, run: ./scripts/dev-reset.sh"