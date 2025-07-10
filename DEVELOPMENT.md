# Jídelníček 2.0 - Development Guide

This guide will help you set up and run the Jídelníček 2.0 application for local development.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Quick Start](#quick-start)
3. [Development Setup](#development-setup)
4. [Running the Application](#running-the-application)
5. [Database Management](#database-management)
6. [Testing](#testing)
7. [Common Tasks](#common-tasks)
8. [Troubleshooting](#troubleshooting)

## Prerequisites

### Required Software

- **Python 3.11+**
- **Docker & Docker Compose** (for containerized setup)
- **PostgreSQL 15+** (if running without Docker)
- **Redis 7+** (if running without Docker)
- **Poetry** (Python dependency management)
- **Git**

### Recommended Tools

- **pgAdmin** or **DBeaver** - Database GUI
- **Redis Commander** - Redis GUI
- **Postman** or **Insomnia** - API testing
- **VS Code** or **PyCharm** - IDE

## Quick Start

### Option 1: Using Docker (Recommended)

```bash
# 1. Clone the repository
git clone https://github.com/yourusername/jidelnicek-2.0.git
cd jidelnicek-2.0

# 2. Set up environment
cp .env.example .env
# Edit .env and set your passwords

# 3. Run setup script
./scripts/dev-setup.sh

# 4. Start development environment
./scripts/dev-start.sh
```

### Option 2: Local Setup (Without Docker)

```bash
# 1. Clone and set up environment
git clone https://github.com/yourusername/jidelnicek-2.0.git
cd jidelnicek-2.0
cp .env.example .env

# 2. Install PostgreSQL and Redis locally
# Ubuntu/Debian:
sudo apt-get install postgresql postgresql-contrib redis-server

# macOS:
brew install postgresql@15 redis
brew services start postgresql@15
brew services start redis

# 3. Create database
sudo -u postgres psql
CREATE DATABASE jidelnicek;
CREATE USER jidelnicek WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE jidelnicek TO jidelnicek;
\q

# 4. Update .env with your database credentials

# 5. Run the application
./scripts/dev-local.sh --migrate
```

## Development Setup

### Environment Configuration

The `.env` file contains all configuration options. Key settings for development:

```env
# Environment
ENVIRONMENT=development
DEBUG=true
LOG_LEVEL=DEBUG

# Database
DB_HOST=localhost  # or 'db' when using Docker
DB_PORT=5432
DB_NAME=jidelnicek
DB_USER=jidelnicek
DB_PASSWORD=your_secure_password

# Redis
REDIS_HOST=localhost  # or 'redis' when using Docker
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password

# Security (generate a new secret key!)
SECRET_KEY=your-32-character-secret-key
```

### Project Structure

```
jidelnicek-2.0/
├── src/jidelnicek/       # Application source code
│   ├── auth/            # Authentication module
│   ├── common/          # Shared models and utilities
│   ├── recipe/          # Recipe management
│   ├── trip/            # Trip planning
│   ├── admin/           # Admin functionality
│   └── core/            # Core configuration
├── migrations/          # Database migrations
├── tests/              # Test suite
├── docker/             # Docker configuration
├── scripts/            # Helper scripts
├── frontend/           # React frontend (separate)
└── docs/              # Documentation
```

## Running the Application

### With Docker

```bash
# Start all services
./scripts/dev-start.sh

# Start with additional tools (pgAdmin, Redis Commander)
./scripts/dev-start.sh --with-tools

# Stop all services
./scripts/dev-stop.sh

# Reset everything (WARNING: deletes all data!)
./scripts/dev-reset.sh
```

### Without Docker

```bash
# Start the application
./scripts/dev-local.sh

# Run with migrations
./scripts/dev-local.sh --migrate
```

### Accessing Services

- **API**: http://localhost:8000
- **API Documentation**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc
- **Mailhog** (email testing): http://localhost:8025
- **pgAdmin**: http://localhost:5050 (when using --with-tools)
- **Redis Commander**: http://localhost:8081 (when using --with-tools)

## Database Management

### Running Migrations

```bash
# Run all pending migrations
./scripts/dev-migrate.sh

# Or manually with Alembic
source .venv/bin/activate
alembic upgrade head

# Create a new migration
alembic revision --autogenerate -m "Description of changes"

# Downgrade one revision
alembic downgrade -1
```

### Database Schema

The database schema is managed through Alembic migrations. The initial schema creates:

- Authentication tables (users, sessions, tokens)
- Common tables (ingredients, snacks)
- Recipe tables (recipes, ingredients, images, categories, tags)
- Trip tables (trips, participants, days, meals)
- Admin tables (roles, permissions)

### Accessing the Database

```bash
# With Docker
docker-compose exec db psql -U jidelnicek

# Locally
psql -h localhost -U jidelnicek -d jidelnicek
```

## Testing

### Running Tests

```bash
# Run all tests
pytest

# Run with coverage
pytest --cov=src/jidelnicek

# Run specific test file
pytest tests/auth/test_user.py

# Run with verbose output
pytest -v

# Run only unit tests
pytest tests/unit

# Run only integration tests
pytest tests/integration
```

### Test Database

Tests use a separate database that's created and destroyed for each test run. Configure in `pytest.ini` or through environment variables.

## Common Tasks

### Creating a Superuser

```python
# Run in Python shell
from src.jidelnicek.auth.models import AuthUser
from src.jidelnicek.core.database import SessionLocal
from src.jidelnicek.auth.utils import hash_password

db = SessionLocal()
user = AuthUser(
    email="admin@example.com",
    password_hash=hash_password("your_password"),
    is_active=True,
    is_verified=True,
    role="admin"
)
db.add(user)
db.commit()
```

### Seeding Sample Data

```bash
# Run seed script
python scripts/seed_data.py

# Or use the management command
python -m jidelnicek seed
```

### Checking Logs

```bash
# Docker logs
docker-compose logs -f app

# Local logs
tail -f logs/app.log
```

### Clearing Cache

```bash
# Clear Redis cache
redis-cli -a your_redis_password FLUSHALL

# Or through Docker
docker-compose exec redis redis-cli -a your_redis_password FLUSHALL
```

## Troubleshooting

### Common Issues

#### Port Already in Use

```bash
# Find process using port 8000
lsof -i :8000

# Kill the process
kill -9 <PID>
```

#### Database Connection Failed

1. Check if PostgreSQL is running:
   ```bash
   # Docker
   docker-compose ps
   
   # Local
   sudo systemctl status postgresql
   ```

2. Verify credentials in `.env` match your database

3. Check if database exists:
   ```bash
   psql -U postgres -c "\l"
   ```

#### Migration Errors

1. Check current migration state:
   ```bash
   alembic current
   ```

2. If stuck, stamp the database:
   ```bash
   alembic stamp head
   ```

3. For complete reset:
   ```bash
   alembic downgrade base
   alembic upgrade head
   ```

#### Docker Issues

1. Clean up Docker:
   ```bash
   docker system prune -a
   docker volume prune
   ```

2. Rebuild containers:
   ```bash
   docker-compose build --no-cache
   ```

### Getting Help

1. Check the logs first
2. Review the [API documentation](http://localhost:8000/docs)
3. Check existing [GitHub issues](https://github.com/yourusername/jidelnicek-2.0/issues)
4. Create a new issue with:
   - Steps to reproduce
   - Error messages
   - Environment details

## Development Workflow

### Feature Development

1. Create a new branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. Make your changes

3. Run tests:
   ```bash
   pytest
   ```

4. Run linters:
   ```bash
   black src tests
   flake8 src tests
   mypy src
   ```

5. Commit and push:
   ```bash
   git add .
   git commit -m "feat: description of your feature"
   git push origin feature/your-feature-name
   ```

### Code Style

- Use **Black** for formatting
- Follow **PEP 8** guidelines
- Write docstrings for all public functions
- Add type hints where possible
- Keep functions small and focused

### Git Commit Convention

Follow conventional commits:
- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation changes
- `style:` Code style changes
- `refactor:` Code refactoring
- `test:` Test changes
- `chore:` Build/tool changes

## Additional Resources

- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [SQLAlchemy Documentation](https://docs.sqlalchemy.org/)
- [Alembic Documentation](https://alembic.sqlalchemy.org/)
- [Pydantic Documentation](https://docs.pydantic.dev/)
- [Docker Documentation](https://docs.docker.com/)

## License

This project is licensed under the MIT License - see the LICENSE file for details.