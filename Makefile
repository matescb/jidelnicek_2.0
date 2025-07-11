.PHONY: help start stop restart logs shell build clean test

# Default target
help:
	@echo "Jídelníček 2.0 - Development Commands"
	@echo "====================================="
	@echo "make start       - Start all services (development)"
	@echo "make start-prod  - Start all services (production)"
	@echo "make stop        - Stop all services"
	@echo "make restart     - Restart all services"
	@echo "make logs        - View logs for all services"
	@echo "make shell-app   - Access backend shell"
	@echo "make shell-front - Access frontend shell"
	@echo "make shell-db    - Access database shell"
	@echo "make build       - Build all images"
	@echo "make clean       - Clean up containers and volumes"
	@echo "make test        - Run tests"
	@echo "make reset-db    - Reset database"

# Start services
start:
	@./scripts/start-dev.sh

start-prod:
	@./scripts/start-prod.sh

# Stop services
stop:
	@echo "Stopping all services..."
	@docker-compose down

# Restart services
restart:
	@echo "Restarting all services..."
	@docker-compose restart

# View logs
logs:
	@docker-compose logs -f

logs-app:
	@docker-compose logs -f app

logs-frontend:
	@docker-compose logs -f frontend

# Shell access
shell-app:
	@docker-compose exec app sh

shell-front:
	@docker-compose exec frontend sh

shell-db:
	@docker-compose exec db psql -U jidelnicek -d jidelnicek

# Build images
build:
	@echo "Building all images..."
	@docker-compose build

build-app:
	@docker-compose build app

build-frontend:
	@docker-compose build frontend

# Clean up
clean:
	@echo "Cleaning up containers..."
	@docker-compose down -v
	@docker system prune -f

# Database operations
reset-db:
	@./scripts/reset-db-force.sh

migrate:
	@docker-compose exec app alembic upgrade head

# Testing
test:
	@echo "Running backend tests..."
	@docker-compose exec app pytest
	@echo "Running frontend tests..."
	@docker-compose exec frontend npm test

test-backend:
	@docker-compose exec app pytest

test-frontend:
	@docker-compose exec frontend npm test

# Development helpers
install-backend:
	@docker-compose exec app pip install -r requirements.txt

install-frontend:
	@docker-compose exec frontend npm install

format:
	@echo "Formatting backend code..."
	@docker-compose exec app black .
	@docker-compose exec app isort .
	@echo "Formatting frontend code..."
	@docker-compose exec frontend npm run format

lint:
	@echo "Linting backend code..."
	@docker-compose exec app flake8
	@docker-compose exec app mypy .
	@echo "Linting frontend code..."
	@docker-compose exec frontend npm run lint