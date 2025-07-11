#!/bin/bash
# Start all services for production

set -e

echo "🚀 Starting Jídelníček 2.0 Production Environment"
echo

# Check if .env file exists
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found"
    echo "Please copy .env.example to .env and configure it"
    exit 1
fi

# Start all services including nginx
echo "📦 Starting all services..."
docker-compose --profile production up -d

echo
echo "✅ All services started successfully!"
echo
echo "🌐 Access points:"
echo "   Application: http://localhost"
echo "   (Configure your domain and SSL certificates for production)"
echo
echo "📋 Monitoring:"
echo "   docker-compose ps"
echo "   docker-compose logs -f"