#!/bin/bash
# Reset development environment (WARNING: This will delete all data!)

set -e

echo "⚠️  WARNING: This will delete all development data!"
echo "=================================================="
echo ""
read -p "Are you sure you want to reset the development environment? (y/N) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Reset cancelled."
    exit 1
fi

echo ""
echo "🔄 Resetting development environment..."

# Stop all containers
echo "🛑 Stopping all containers..."
docker-compose -f docker-compose.yml -f docker-compose.dev.yml --profile tools down

# Remove volumes
echo "🗑️  Removing Docker volumes..."
docker volume rm jidelnicek_postgres_data_dev || true
docker volume rm jidelnicek_redis_data_dev || true
docker volume rm jidelnicek_pgadmin_data_dev || true

# Clean up local directories
echo "🧹 Cleaning up local directories..."
rm -rf logs/* static/* media/* uploads/*

# Recreate directories
mkdir -p logs static media uploads

echo ""
echo "✅ Development environment reset complete!"
echo ""
echo "📝 Next steps:"
echo "1. Run ./scripts/dev-setup.sh to set up fresh environment"
echo "2. Run ./scripts/dev-start.sh to start services"