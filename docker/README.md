# Docker Configuration Directory

This directory contains Docker-related configuration files and scripts for the Jídelníček 2.0 project.

## Directory Structure

```
docker/
├── Dockerfile              # Multi-stage Dockerfile for the application
├── nginx/                  # Nginx configuration files
│   ├── nginx.conf         # Main Nginx configuration
│   ├── nginx.dev.conf     # Development Nginx configuration
│   └── conf.d/            # Server block configurations
│       ├── default.conf   # Production server configuration
│       └── dev.conf       # Development server configuration
├── postgres/              # PostgreSQL initialization scripts
│   └── init-dev.sql       # Development database initialization
└── README.md              # This file
```

## Quick Start

### Development Environment

1. Copy the environment file:
   ```bash
   cp .env.example .env
   ```

2. Start all services:
   ```bash
   make up
   # or
   docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d
   ```

3. Access the services:
   - Application: http://localhost:8000
   - Adminer (DB management): http://localhost:8081
   - RedisInsight: http://localhost:8082
   - Mailhog (email testing): http://localhost:8025

### Production Environment

1. Build production images:
   ```bash
   make prod-build
   ```

2. Start production services:
   ```bash
   make prod-up
   ```

## Services

### Core Services

1. **app** - FastAPI application
   - Python 3.11-alpine based
   - Multi-stage build for smaller image size
   - Non-root user for security
   - Health checks included
   - Memory limit: 1.5GB

2. **db** - PostgreSQL 15-alpine
   - Persistent volume for data
   - Health checks
   - Memory limit: 1.5GB

3. **redis** - Redis 7-alpine
   - Configured with memory limits
   - AOF persistence enabled
   - Memory limit: 512MB

4. **nginx** - Nginx reverse proxy
   - Rate limiting configured
   - Static file serving
   - Security headers
   - Memory limit: 256MB

### Development Services

- **adminer** - Database management UI
- **redis-insight** - Redis management UI
- **mailhog** - Email testing service

## Docker Commands

Common Docker operations are available through the Makefile:

```bash
make help          # Show all available commands
make build         # Build Docker images
make up            # Start all services
make down          # Stop all services
make logs          # Show logs for all services
make shell         # Open shell in app container
make test          # Run tests
make migrate       # Run database migrations
make backup        # Backup database
make clean         # Clean up Docker resources
```

## Environment Variables

See `.env.example` for all available environment variables. Key variables:

- `ENVIRONMENT` - Set to 'development' or 'production'
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string
- `SECRET_KEY` - Application secret key
- `DEBUG` - Enable/disable debug mode

## Resource Allocation

The Docker setup is configured for a VPS with 4GB total RAM:

- PostgreSQL: 1.5GB
- Application: 1.5GB
- Redis: 512MB
- Nginx: 256MB
- System overhead: 256MB

## Health Checks

All services include health checks:

- **app**: HTTP check on `/health` endpoint
- **db**: PostgreSQL connection check
- **redis**: Redis PING command
- **nginx**: HTTP check on `/health` endpoint

## Security Considerations

1. Non-root user in application container
2. Security headers configured in Nginx
3. Rate limiting on API endpoints
4. Separate networks for service isolation
5. Resource limits to prevent DoS

## Troubleshooting

### Services won't start
- Check logs: `make logs`
- Verify environment variables in `.env`
- Ensure ports are not already in use

### Database connection issues
- Verify PostgreSQL is healthy: `docker-compose ps db`
- Check database credentials in `.env`
- Ensure migrations have run: `make migrate`

### Memory issues
- Check current usage: `docker stats`
- Adjust memory limits in docker-compose.yml
- Ensure host has sufficient memory

## Backup and Restore

### Backup database
```bash
make backup
```

### Restore from backup
```bash
make restore file=backups/jidelnicek_20240101_120000.sql.gz
```