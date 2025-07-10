# Integration Testing Manual - Jidelnicek 2.0

This guide explains how to run integration tests locally for the Jidelnicek 2.0 application.

## Prerequisites

- Python 3.9+ with Poetry installed
- Docker (for PostgreSQL testing)
- Redis (optional, for full integration tests)

## Testing Methods

### 1. Using Poetry (Quick Testing)

```bash
# Run all tests
poetry run pytest

# Run specific test categories
poetry run pytest tests/auth/                    # Auth tests only
poetry run pytest tests/recipe/                 # Recipe tests only
poetry run pytest tests/trip/                   # Trip tests only
poetry run pytest tests/core/                   # Core functionality tests

# Run specific test files
poetry run pytest tests/auth/test_login.py
poetry run pytest tests/core/test_seed_data.py
poetry run pytest tests/recipe/test_recipe_endpoints.py

# Run with verbose output
poetry run pytest -v

# Run with short traceback for cleaner output
poetry run pytest --tb=short

# Run tests matching a pattern
poetry run pytest -k "test_login"
poetry run pytest -k "integration"
poetry run pytest -k "auth"
```

### 2. With Docker PostgreSQL (Recommended - CI-like Environment)

This method most closely matches the CI environment and will catch PostgreSQL-specific issues.

```bash
# Start PostgreSQL container for testing
docker run -d \
  --name jidelnicek-test-db \
  -p 5433:5432 \
  -e POSTGRES_USER=jidelnicek \
  -e POSTGRES_PASSWORD=testpassword \
  -e POSTGRES_DB=jidelnicek_test \
  postgres:15-alpine

# Set environment variables for tests
export DATABASE_URL="postgresql+asyncpg://jidelnicek:testpassword@localhost:5433/jidelnicek_test"
export SECRET_KEY="test-secret-key-for-integration-testing-minimum-32-chars"
export REDIS_URL="redis://localhost:6379/1"

# Run tests
poetry run pytest

# Clean up when done
docker stop jidelnicek-test-db
docker rm jidelnicek-test-db
```

### 3. Using Docker Compose (Full CI Environment)

```bash
# Start the complete CI environment
docker-compose -f docker-compose.ci.yml up -d

# Wait for services to start
sleep 10

# Run tests with CI environment variables
export SECRET_KEY="test-secret-key-for-ci-integration-testing-32chars"
export DATABASE_URL="postgresql+asyncpg://jidelnicek:testpassword@localhost:5432/jidelnicek_test"
export REDIS_URL="redis://localhost:6379/0"

poetry run pytest

# Stop the environment
docker-compose -f docker-compose.ci.yml down
```

### 4. Quick Environment Test Script

Create a simple script to verify your setup:

```bash
# Save as test_setup.py
cat > test_setup.py << 'EOF'
import asyncio
import os
from src.jidelnicek.core.database import init_db, close_db

async def test_setup():
    try:
        print("🔍 Testing database connection...")
        await init_db()
        print("✅ Database connection successful")
        await close_db()
        print("✅ Database cleanup successful")
        
        # Test environment variables
        if os.getenv('SECRET_KEY'):
            print("✅ SECRET_KEY environment variable set")
        else:
            print("⚠️  SECRET_KEY not set - some tests may fail")
            
        if os.getenv('DATABASE_URL'):
            print(f"✅ DATABASE_URL set: {os.getenv('DATABASE_URL')}")
        else:
            print("⚠️  DATABASE_URL not set - using default SQLite")
            
        print("\n🎉 Setup verification complete!")
        
    except Exception as e:
        print(f"❌ Setup failed: {e}")

if __name__ == "__main__":
    asyncio.run(test_setup())
EOF

# Run the setup test
python test_setup.py
```

## Environment Variables

### Required Variables

```bash
# Minimum required for basic testing
export SECRET_KEY="your-secret-key-minimum-32-characters-long"

# For PostgreSQL testing (recommended)
export DATABASE_URL="postgresql+asyncpg://user:pass@localhost:5432/dbname"

# For Redis-dependent tests
export REDIS_URL="redis://localhost:6379/0"
```

### Optional Variables (for full feature testing)

```bash
# AI service API keys (for advanced features)
export ANTHROPIC_API_KEY="your-anthropic-key"
export PERPLEXITY_API_KEY="your-perplexity-key"
export OPENAI_API_KEY="your-openai-key"

# Storage configuration
export STORAGE_BACKEND="local"
export STORAGE_LOCAL_PATH="/tmp/jidelnicek-test-storage"
```

## Specific Test Categories

### Authentication Tests
```bash
poetry run pytest tests/auth/ -v
poetry run pytest tests/auth/test_login.py
poetry run pytest tests/auth/test_registration.py
poetry run pytest tests/auth/test_tokens.py
```

### Recipe Management Tests
```bash
poetry run pytest tests/recipe/ -v
poetry run pytest tests/recipe/test_recipe_endpoints.py
poetry run pytest tests/recipe/test_scaling.py
poetry run pytest tests/recipe/test_search.py
```

### Trip Planning Tests
```bash
poetry run pytest tests/trip/ -v
poetry run pytest tests/trip/test_trip_endpoints.py
poetry run pytest tests/trip/test_template_endpoints.py
poetry run pytest tests/trip/test_day_plan_service.py
```

### Core Functionality Tests
```bash
poetry run pytest tests/core/ -v
poetry run pytest tests/core/test_seed_data.py
poetry run pytest tests/core/test_database_performance.py
```

### API Integration Tests
```bash
poetry run pytest tests/api/ -v
poetry run pytest tests/api/v1/endpoints/ -v
```

## Debugging Failed Tests

### Verbose Output
```bash
# Maximum verbosity with detailed tracebacks
poetry run pytest -vvv --tb=long

# Stop on first failure
poetry run pytest -x

# Run specific failing test with full details
poetry run pytest tests/specific/test_file.py::test_function -vvv --tb=long
```

### Interactive Debugging
```bash
# Drop into debugger on failure
poetry run pytest --pdb

# Capture print statements (useful for debugging)
poetry run pytest -s

# Show local variables in tracebacks
poetry run pytest --tb=auto --capture=no
```

### Test Selection
```bash
# Run only tests that failed in last run
poetry run pytest --lf

# Run failed tests first, then continue with rest
poetry run pytest --ff

# Run tests modified since last commit
poetry run pytest --testmon
```

## Performance and Coverage

### Test Performance
```bash
# Show slowest 10 tests
poetry run pytest --durations=10

# Run tests in parallel (requires pytest-xdist)
poetry run pytest -n auto
```

### Coverage Reports
```bash
# Generate coverage report
poetry run pytest --cov=src --cov-report=html --cov-report=term

# View HTML coverage report
open htmlcov/index.html  # On macOS
# Or navigate to htmlcov/index.html in your browser

# Coverage with specific threshold
poetry run pytest --cov=src --cov-fail-under=80
```

## Common Issues and Solutions

### Docker Permission Issues
If you encounter "permission denied" errors with Docker:
```bash
# Option 1: Add user to docker group (requires logout/login)
sudo usermod -aG docker $USER

# Option 2: Use sudo for Docker commands
sudo docker run -d --name jidelnicek-test-db -p 5433:5432 \
  -e POSTGRES_USER=jidelnicek -e POSTGRES_PASSWORD=testpassword \
  -e POSTGRES_DB=jidelnicek_test postgres:15-alpine

# Option 3: Use SQLite for testing (no Docker needed)
export SECRET_KEY="test-secret-key-for-integration-testing-minimum-32-chars"
poetry run pytest
```

### Database Connection Issues
```bash
# Check if PostgreSQL is running
docker ps | grep postgres
# or
sudo docker ps | grep postgres

# Test database connection manually
psql -h localhost -p 5433 -U jidelnicek -d jidelnicek_test

# Reset test database
docker stop jidelnicek-test-db
docker rm jidelnicek-test-db
# Then restart with the docker run command above
```

### Import Errors
```bash
# Reinstall dependencies
poetry install

# Clear Python cache
find . -name "*.pyc" -delete
find . -name "__pycache__" -type d -exec rm -rf {} +

# Verify Python path
poetry run python -c "import sys; print('\n'.join(sys.path))"
```

### Permission Issues
```bash
# Fix storage directory permissions
mkdir -p /tmp/jidelnicek-test-storage
chmod 755 /tmp/jidelnicek-test-storage

# Docker permission issues
sudo chmod 666 /var/run/docker.sock
```

## Test Data Management

### Seed Data Testing
```bash
# Test seed data functionality
poetry run pytest tests/core/test_seed_data.py -v

# Manual seed data run
poetry run python -c "
import asyncio
from src.jidelnicek.core.seed_data import seed_all
from src.jidelnicek.core.database import get_session

async def seed():
    async with get_session() as session:
        await seed_all(session)
        print('✅ Seed data created successfully')

asyncio.run(seed())
"
```

### Database Reset
```bash
# Reset test database (PostgreSQL)
docker exec -it jidelnicek-test-db psql -U jidelnicek -d jidelnicek_test -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

# For SQLite (default)
rm -f test.db
```

## CI Simulation

To exactly simulate the CI environment:

```bash
# 1. Start services
docker-compose -f docker-compose.ci.yml up -d

# 2. Set exact CI environment variables
export SECRET_KEY="test-secret-key-for-ci-integration-testing-32chars"
export DATABASE_URL="postgresql+asyncpg://jidelnicek:testpassword@localhost:5432/jidelnicek_test"
export REDIS_URL="redis://localhost:6379/0"
export STORAGE_BACKEND="local"
export STORAGE_LOCAL_PATH="/tmp/test-storage"

# 3. Run tests with same settings as CI
poetry run pytest \
  --cov=src \
  --cov-report=xml \
  --cov-report=term \
  --junitxml=test-results.xml \
  -v

# 4. Cleanup
docker-compose -f docker-compose.ci.yml down
```

## Quick Commands Reference

```bash
# Essential commands for daily testing
alias test-quick="poetry run pytest --tb=short"
alias test-auth="poetry run pytest tests/auth/ -v"
alias test-api="poetry run pytest tests/api/ -v"
alias test-db="poetry run pytest tests/core/test_seed_data.py -v"
alias test-cov="poetry run pytest --cov=src --cov-report=term-missing"

# Setup PostgreSQL for testing
alias pg-test-start="docker run -d --name jidelnicek-test-db -p 5433:5432 -e POSTGRES_USER=jidelnicek -e POSTGRES_PASSWORD=testpassword -e POSTGRES_DB=jidelnicek_test postgres:15-alpine"
alias pg-test-stop="docker stop jidelnicek-test-db && docker rm jidelnicek-test-db"

# Environment setup
alias test-env="export DATABASE_URL=postgresql+asyncpg://jidelnicek:testpassword@localhost:5433/jidelnicek_test SECRET_KEY=test-secret-key-for-integration-testing-minimum-32-chars"
```

## Tips for Effective Testing

1. **Start with PostgreSQL**: Use Docker PostgreSQL for the most accurate testing
2. **Test incrementally**: Run specific test files/categories as you develop
3. **Use verbose output**: `-v` flag helps understand what's being tested
4. **Check coverage**: Aim for high test coverage, especially on new code
5. **Clean environment**: Reset database between major test runs
6. **Monitor performance**: Use `--durations` to identify slow tests
7. **CI parity**: Regularly test with the exact CI environment setup

---

*Generated for Jidelnicek 2.0 - School Cafeteria Meal Ordering System*