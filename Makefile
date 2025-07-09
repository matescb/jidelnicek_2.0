# Jídelníček 2.0 - Docker Management Makefile

.PHONY: help build up down logs shell test clean migrate backup restore

# Default environment
ENV ?= development
COMPOSE_FILE = docker-compose.yml
ifeq ($(ENV),development)
	COMPOSE_FILE += -f docker-compose.dev.yml
endif

# Colors for output
GREEN = \033[0;32m
YELLOW = \033[0;33m
RED = \033[0;31m
NC = \033[0m # No Color

help: ## Show this help message
	@echo "Jídelníček 2.0 - Docker Management Commands"
	@echo ""
	@echo "Usage: make [command] [ENV=development|production]"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

build: ## Build Docker images
	@echo "$(GREEN)Building Docker images for $(ENV) environment...$(NC)"
	docker-compose -f $(COMPOSE_FILE) build

up: ## Start all services
	@echo "$(GREEN)Starting services for $(ENV) environment...$(NC)"
	docker-compose -f $(COMPOSE_FILE) up -d
	@echo "$(GREEN)Services started successfully!$(NC)"
	@echo "$(YELLOW)Application: http://localhost:8000$(NC)"
ifeq ($(ENV),development)
	@echo "$(YELLOW)Adminer: http://localhost:8081$(NC)"
	@echo "$(YELLOW)RedisInsight: http://localhost:8082$(NC)"
	@echo "$(YELLOW)Mailhog: http://localhost:8025$(NC)"
endif

down: ## Stop all services
	@echo "$(YELLOW)Stopping services...$(NC)"
	docker-compose -f $(COMPOSE_FILE) down

logs: ## Show logs for all services
	docker-compose -f $(COMPOSE_FILE) logs -f

logs-app: ## Show logs for app service only
	docker-compose -f $(COMPOSE_FILE) logs -f app

shell: ## Open shell in app container
	docker-compose -f $(COMPOSE_FILE) exec app sh

shell-db: ## Open PostgreSQL shell
	docker-compose -f $(COMPOSE_FILE) exec db psql -U jidelnicek -d jidelnicek

test: ## Run tests in container
	@echo "$(GREEN)Running tests...$(NC)"
	docker-compose -f $(COMPOSE_FILE) exec app pytest -v

migrate: ## Run database migrations
	@echo "$(GREEN)Running database migrations...$(NC)"
	docker-compose -f $(COMPOSE_FILE) exec app alembic upgrade head

migrate-create: ## Create new migration (usage: make migrate-create name="migration_name")
	@echo "$(GREEN)Creating new migration: $(name)$(NC)"
	docker-compose -f $(COMPOSE_FILE) exec app alembic revision --autogenerate -m "$(name)"

migrate-status: ## Show current migration status
	@echo "$(GREEN)Current migration status:$(NC)"
	docker-compose -f $(COMPOSE_FILE) exec app alembic current

migrate-history: ## Show migration history
	@echo "$(GREEN)Migration history:$(NC)"
	docker-compose -f $(COMPOSE_FILE) exec app alembic history

migrate-test: ## Test migration 004 (performance indexes)
	@echo "$(GREEN)Testing migration 004...$(NC)"
	docker-compose -f $(COMPOSE_FILE) exec app python scripts/test_migration_004.py

migrate-check-indexes: ## Check index usage after migration
	@echo "$(GREEN)Checking index usage...$(NC)"
	docker-compose -f $(COMPOSE_FILE) exec db psql -U jidelnicek -d jidelnicek -f scripts/check_index_usage.sql

migrate-downgrade: ## Downgrade one migration
	@echo "$(YELLOW)Downgrading one migration...$(NC)"
	docker-compose -f $(COMPOSE_FILE) exec app alembic downgrade -1

clean: ## Clean up Docker resources
	@echo "$(RED)Cleaning up Docker resources...$(NC)"
	docker-compose -f $(COMPOSE_FILE) down -v
	docker system prune -f

backup: ## Backup database
	@echo "$(GREEN)Backing up database...$(NC)"
	@mkdir -p backups
	docker-compose -f $(COMPOSE_FILE) exec -T db pg_dump -U jidelnicek jidelnicek | gzip > backups/jidelnicek_$(shell date +%Y%m%d_%H%M%S).sql.gz
	@echo "$(GREEN)Backup completed: backups/jidelnicek_$(shell date +%Y%m%d_%H%M%S).sql.gz$(NC)"

restore: ## Restore database from backup (usage: make restore file=backup_file.sql.gz)
	@echo "$(YELLOW)Restoring database from $(file)...$(NC)"
	@gunzip -c $(file) | docker-compose -f $(COMPOSE_FILE) exec -T db psql -U jidelnicek jidelnicek
	@echo "$(GREEN)Database restored successfully!$(NC)"

status: ## Show status of all services
	@echo "$(GREEN)Service Status:$(NC)"
	docker-compose -f $(COMPOSE_FILE) ps

restart: ## Restart all services
	@echo "$(YELLOW)Restarting services...$(NC)"
	$(MAKE) down
	$(MAKE) up

restart-app: ## Restart only the app service
	@echo "$(YELLOW)Restarting app service...$(NC)"
	docker-compose -f $(COMPOSE_FILE) restart app

exec: ## Execute command in app container (usage: make exec cmd="command")
	docker-compose -f $(COMPOSE_FILE) exec app $(cmd)

prod-build: ## Build for production
	@echo "$(GREEN)Building production images...$(NC)"
	ENV=production docker-compose -f docker-compose.yml build

prod-up: ## Start production services
	@echo "$(GREEN)Starting production services...$(NC)"
	ENV=production docker-compose -f docker-compose.yml up -d

health: ## Check health of all services
	@echo "$(GREEN)Checking service health...$(NC)"
	@docker-compose -f $(COMPOSE_FILE) ps | grep -E "Up.*healthy" > /dev/null && echo "$(GREEN)All services are healthy!$(NC)" || echo "$(RED)Some services are not healthy!$(NC)"
	@docker-compose -f $(COMPOSE_FILE) ps