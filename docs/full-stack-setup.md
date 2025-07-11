# Full-Stack Setup Guide

## Overview

This guide explains how to run the complete Jídelníček 2.0 application with both frontend and backend.

## Quick Start

### Development Environment

```bash
# Start all services with one command
./scripts/start-dev.sh
```

This will start:
- PostgreSQL database (port 5432)
- Redis cache (port 6379)
- Backend API (port 8000)
- Frontend dev server (port 3000)

Access points:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Documentation**: http://localhost:8000/docs

### Production Environment

```bash
# Start production setup
./scripts/start-prod.sh
```

This uses optimized builds and nginx for serving the frontend.

## Architecture

### Development Mode
```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Browser   │────▶│  Frontend   │────▶│   Backend   │
│             │     │  (Vite)     │     │  (FastAPI)  │
└─────────────┘     └─────────────┘     └─────────────┘
                          :3000              :8000
                                               │
                                         ┌─────┴─────┐
                                         │           │
                                    ┌────▼───┐ ┌────▼───┐
                                    │   DB   │ │ Redis  │
                                    └────────┘ └────────┘
```

### Production Mode
```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Browser   │────▶│    Nginx    │────▶│   Backend   │
│             │     │  (Static)   │     │  (FastAPI)  │
└─────────────┘     └─────────────┘     └─────────────┘
                          :80                :8000
```

## Services

### Database (PostgreSQL)
- Port: 5432
- Database: jidelnicek
- User: jidelnicek
- Password: (see .env)

### Cache (Redis)
- Port: 6379
- Password: (see .env)

### Backend API (FastAPI)
- Port: 8000
- Auto-reload enabled in development
- Migrations run on startup
- Seed data applied automatically

### Frontend (React + Vite)
- Port: 3000
- Hot module replacement enabled
- Proxy configured for /api and /ws routes

## Common Commands

### View Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f app
docker-compose logs -f frontend
```

### Access Container Shell
```bash
# Backend
docker-compose exec app sh

# Frontend
docker-compose exec frontend sh

# Database
docker-compose exec db psql -U jidelnicek
```

### Restart Services
```bash
# Restart single service
docker-compose restart app

# Restart all
docker-compose restart
```

### Stop Everything
```bash
# Stop and remove containers
docker-compose down

# Stop and remove with volumes (careful!)
docker-compose down -v
```

## Development Workflow

### Backend Changes
- Code changes auto-reload via uvicorn
- Database migrations: `docker-compose exec app alembic revision -m "description"`
- Apply migrations: Restart app service

### Frontend Changes
- Code changes trigger HMR (Hot Module Replacement)
- Install packages: `docker-compose exec frontend npm install package-name`
- Build for production: `docker-compose exec frontend npm run build`

## Troubleshooting

### Port Already in Use
```bash
# Find process using port
lsof -i :3000
lsof -i :8000

# Kill process
kill -9 <PID>
```

### Database Connection Issues
```bash
# Reset database
./scripts/reset-db-force.sh

# Check database logs
docker-compose logs db
```

### Frontend Can't Connect to API
- Check CORS settings in backend
- Verify proxy configuration in vite.config.ts
- Check if backend is running: `curl http://localhost:8000/health`

### Clear Docker Cache
```bash
# Remove all stopped containers
docker container prune

# Remove unused images
docker image prune

# Full cleanup (careful!)
docker system prune -a
```

## Environment Variables

Key variables in `.env`:
- `DB_PASSWORD` - Database password
- `REDIS_PASSWORD` - Redis password
- `SECRET_KEY` - JWT secret key
- `CORS_ORIGINS` - Allowed frontend origins
- `DEBUG` - Enable debug mode
- `ENVIRONMENT` - development/production

## Production Deployment

1. Update `.env` with production values
2. Configure domain and SSL certificates
3. Update CORS_ORIGINS
4. Run migrations
5. Use `./scripts/start-prod.sh`

## Security Notes

- Change all default passwords
- Use strong SECRET_KEY
- Enable HTTPS in production
- Configure firewall rules
- Regular backups of database