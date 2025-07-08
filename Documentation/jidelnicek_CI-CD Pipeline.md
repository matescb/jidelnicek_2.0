# Jídelníček CI/CD Pipeline Configuration

## 1. Pipeline Overview

### Git Workflow Strategy

The Jídelníček project follows a simplified **GitHub Flow** workflow:

```
main (production)
├── feature/recipe-editor
├── feature/trip-planner
├── feature/marketplace
├── fix/bug-description
└── hotfix/critical-issue
```

### Environment Setup

```mermaid
graph LR
    LOCAL[Local Development] --> TEST[GitHub Actions<br/>Testing]
    TEST --> BUILD[Docker Build]
    BUILD --> DEPLOY[SSH Deploy<br/>to VPS]
    
    style LOCAL fill:#f9f,stroke:#333,stroke-width:2px
    style TEST fill:#ff9,stroke:#333,stroke-width:2px
    style BUILD fill:#9ff,stroke:#333,stroke-width:2px
    style DEPLOY fill:#9f9,stroke:#333,stroke-width:2px
```

### Branch Protection Rules

- **main**: Requires PR, all tests passing, no direct commits
- **feature/***: No restrictions, but CI runs on every push

## 2. CI Pipeline Stages

### 2.1 Code Checkout & Environment Setup

```yaml
# .github/workflows/ci.yml
name: CI Pipeline

on:
  push:
    branches: [ main, develop, 'feature/**', 'release/**' ]
  pull_request:
    branches: [ main, develop ]

env:
  PYTHON_VERSION: '3.11'
  NODE_VERSION: '18'
  POSTGRES_VERSION: '15'
  REDIS_VERSION: '7'

jobs:
  code-quality:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    
    steps:
    - name: Checkout code
      uses: actions/checkout@v4
      with:
        fetch-depth: 0  # Full history for better analysis

    - name: Set up Python
      uses: actions/setup-python@v4
      with:
        python-version: ${{ env.PYTHON_VERSION }}
        cache: 'pip'

    - name: Cache dependencies
      uses: actions/cache@v3
      with:
        path: |
          ~/.cache/pip
          ~/.cache/pre-commit
        key: ${{ runner.os }}-pip-${{ hashFiles('**/requirements/*.txt') }}
        restore-keys: |
          ${{ runner.os }}-pip-
```

### 2.2 Dependency Installation

```yaml
    - name: Install dependencies
      run: |
        python -m pip install --upgrade pip
        pip install -r requirements/dev.txt
        pip install -r requirements/test.txt

    - name: Verify installations
      run: |
        python --version
        pip --version
        black --version
        flake8 --version
        mypy --version
        pytest --version
```

### 2.3 Linting & Code Quality

```yaml
  linting:
    needs: code-quality
    runs-on: ubuntu-latest
    
    steps:
    - name: Run Black formatter check
      run: |
        black --check --diff app/ tests/
      continue-on-error: false

    - name: Run isort import checker
      run: |
        isort --check-only --diff app/ tests/
      continue-on-error: false

    - name: Run Flake8 linter
      run: |
        flake8 app/ tests/ --config=.flake8
      continue-on-error: false

    - name: Run pylint
      run: |
        pylint app/ --rcfile=.pylintrc --exit-zero
      continue-on-error: true  # Warning only
```

### 2.4 Type Checking

```yaml
  type-checking:
    needs: code-quality
    runs-on: ubuntu-latest
    
    steps:
    - name: Run mypy type checker
      run: |
        mypy app/ --config-file=mypy.ini
      env:
        MYPYPATH: ${{ github.workspace }}
```

### 2.5 Unit Tests with Coverage

```yaml
  unit-tests:
    needs: [linting, type-checking]
    runs-on: ubuntu-latest
    database: sqlite:memory
    
    # No external services needed for unit tests - SQLite in-memory only
    
    steps:
    - name: Run unit tests with coverage
      run: |
        pytest tests/unit \
          --cov=app \
          --cov-report=xml \
          --cov-report=html \
          --cov-report=term-missing \
          --cov-fail-under=80 \
          -v \
          --tb=short \
          --maxfail=10
      env:
        DATABASE_URL: sqlite:///:memory:
        SECRET_KEY: test-secret-key-for-ci
        TESTING: true

    - name: Nutritional Accuracy Tests
      run: |
        pytest tests/test_nutritional_accuracy.py -v
        # Must maintain 99.9% accuracy as per PRD requirement
        pytest tests/test_calculations.py --accuracy-threshold=99.9
        # Test decimal precision handling
        pytest tests/test_precision.py --decimal-places=1
        # Verify rounding is display-only
        pytest tests/test_internal_precision.py

    - name: Upload coverage reports
      uses: codecov/codecov-action@v3
      with:
        file: ./coverage.xml
        flags: unittests
        name: codecov-umbrella
        fail_ci_if_error: true
```

### 2.6 Integration Tests

```yaml
  integration-tests:
    needs: unit-tests
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:${{ env.POSTGRES_VERSION }}
        env:
          POSTGRES_USER: test_user
          POSTGRES_PASSWORD: test_password
          POSTGRES_DB: test_jidelnicek
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432
      
      redis:
        image: redis:${{ env.REDIS_VERSION }}
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 6379:6379

    steps:
    - name: Run database migrations
      run: |
        alembic upgrade head
      env:
        DATABASE_URL: postgresql://test_user:test_password@localhost:5432/test_jidelnicek

    - name: Seed test data
      run: |
        python scripts/seed_test_data.py
      env:
        DATABASE_URL: postgresql://test_user:test_password@localhost:5432/test_jidelnicek

    - name: Run integration tests
      run: |
        pytest tests/integration \
          -v \
          --tb=short \
          --maxfail=5
      env:
        DATABASE_URL: postgresql://test_user:test_password@localhost:5432/test_jidelnicek
        TESTING: true
        
    - name: API Performance Tests
      run: |
        # Test API response time requirement (<200ms)
        pytest tests/performance/test_api_response_time.py \
          --benchmark-min-rounds=10 \
          --benchmark-max-time=0.2
      env:
        DATABASE_URL: postgresql://test_user:test_password@localhost:5432/test_jidelnicek
        PERFORMANCE_THRESHOLD_MS: 200
```

### 2.7 Security Scanning

```yaml
  security-scan:
    needs: code-quality
    runs-on: ubuntu-latest
    
    steps:
    - name: Run Bandit security linter
      run: |
        bandit -r app/ -ll  # Only show medium and high severity issues
      continue-on-error: true

    - name: Run Safety check for dependencies
      run: |
        safety check
      continue-on-error: true
```

### 2.8 Build Docker Images

```yaml
  build-docker:
    needs: [unit-tests, integration-tests, security-scan]
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    
    steps:
    - name: Set up Docker Buildx
      uses: docker/setup-buildx-action@v3

    - name: Build Docker images
      run: |
        # Build the application image
        docker build -t jidelnicek-app:latest .
        
        # Tag with commit SHA for versioning
        docker tag jidelnicek-app:latest jidelnicek-app:${{ github.sha }}
        
        # Save images as tar files for deployment
        docker save jidelnicek-app:latest jidelnicek-app:${{ github.sha }} | gzip > jidelnicek-images.tar.gz
    
    - name: Upload Docker images
      uses: actions/upload-artifact@v3
      with:
        name: docker-images
        path: jidelnicek-images.tar.gz
        retention-days: 7
```

## 3. CD Pipeline - SSH Deployment

### 3.1 Deploy to VPS

```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [ main ]
  workflow_dispatch:

jobs:
  deploy:
    needs: build-docker
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    
    steps:
    - name: Checkout code
      uses: actions/checkout@v4

    - name: Download Docker images
      uses: actions/download-artifact@v3
      with:
        name: docker-images
        
    - name: Setup SSH
      run: |
        mkdir -p ~/.ssh
        echo "${{ secrets.VPS_SSH_KEY }}" > ~/.ssh/id_rsa
        chmod 600 ~/.ssh/id_rsa
        ssh-keyscan -H ${{ secrets.VPS_HOST }} >> ~/.ssh/known_hosts

    - name: Copy files to VPS
      run: |
        # Copy docker-compose file
        scp docker-compose.prod.yml ${{ secrets.VPS_USER }}@${{ secrets.VPS_HOST }}:/opt/jidelnicek/docker-compose.yml
        
        # Copy environment file template
        scp .env.production ${{ secrets.VPS_USER }}@${{ secrets.VPS_HOST }}:/opt/jidelnicek/.env
        
        # Copy docker images
        scp jidelnicek-images.tar.gz ${{ secrets.VPS_USER }}@${{ secrets.VPS_HOST }}:/tmp/

    - name: Deploy on VPS
      run: |
        ssh ${{ secrets.VPS_USER }}@${{ secrets.VPS_HOST }} << 'EOF'
          # Load docker images
          cd /tmp
          gunzip -c jidelnicek-images.tar.gz | docker load
          rm jidelnicek-images.tar.gz
          
          # Go to app directory
          cd /opt/jidelnicek
          
          # Backup current deployment
          docker-compose ps > deployment-backup-$(date +%Y%m%d-%H%M%S).log
          
          # Pull down current containers
          docker-compose down
          
          # Run database migrations
          docker-compose run --rm app alembic upgrade head
          
          # Start new containers
          docker-compose up -d
          
          # Clean up old images
          docker image prune -f
        EOF

    - name: Health check
      run: |
        echo "Waiting for service to start..."
        sleep 30
        
        for i in {1..10}; do
          if curl -f https://${{ secrets.VPS_HOST }}/api/health; then
            echo "Health check passed"
            break
          fi
          echo "Waiting for service to be ready... (attempt $i/10)"
          sleep 10
        done
```

### 3.2 Simple Rollback

```yaml
  rollback:
    runs-on: ubuntu-latest
    if: failure()
    needs: deploy
    
    steps:
    - name: Setup SSH
      run: |
        mkdir -p ~/.ssh
        echo "${{ secrets.VPS_SSH_KEY }}" > ~/.ssh/id_rsa
        chmod 600 ~/.ssh/id_rsa
        ssh-keyscan -H ${{ secrets.VPS_HOST }} >> ~/.ssh/known_hosts

    - name: Rollback deployment
      run: |
        ssh ${{ secrets.VPS_USER }}@${{ secrets.VPS_HOST }} << 'EOF'
          cd /opt/jidelnicek
          
          # Rollback to previous version
          docker-compose down
          docker tag jidelnicek-app:previous jidelnicek-app:latest
          docker-compose up -d
          
          echo "Rollback completed"
        EOF
```

## 4. Configuration Files

### 4.1 GitHub Actions Workflow - Complete CI/CD

```yaml
# .github/workflows/ci-cd.yml
name: CI/CD Pipeline

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      # All test steps from section 2
      
  build:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      # Build steps from section 2.8
      
  deploy:
    needs: build
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      # Deploy steps from section 3.1
```

### 4.2 Docker Compose for Production

```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  app:
    image: jidelnicek-app:latest
    restart: always
    ports:
      - "127.0.0.1:8000:8000"
    environment:
      DATABASE_URL: ${DATABASE_URL}
      REDIS_URL: ${REDIS_URL}
      SECRET_KEY: ${SECRET_KEY}
      DEBUG: "false"
      ALLOWED_HOSTS: ${ALLOWED_HOSTS}
      S3_ENDPOINT_URL: ${S3_ENDPOINT_URL}
      S3_ACCESS_KEY: ${S3_ACCESS_KEY}
      S3_SECRET_KEY: ${S3_SECRET_KEY}
      S3_BUCKET_NAME: ${S3_BUCKET_NAME}
    volumes:
      - ./media:/app/media
      - ./logs:/app/logs
    depends_on:
      - postgres
      - redis
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  postgres:
    image: postgres:15-alpine
    restart: always
    environment:
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: ${DB_NAME}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "127.0.0.1:5432:5432"

  redis:
    image: redis:7-alpine
    restart: always
    command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    ports:
      - "127.0.0.1:6379:6379"

  nginx:
    image: nginx:alpine
    restart: always
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
      - ./media:/var/www/media:ro
    depends_on:
      - app

volumes:
  postgres_data:
  redis_data:
```

### 4.3 Dockerfile for Python Application

```dockerfile
# Dockerfile
# Multi-stage build for optimized image size
FROM python:3.11-slim as builder

# Install build dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    python3-dev \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy requirements
COPY requirements/prod.txt .

# Install Python dependencies
RUN pip install --user --no-cache-dir -r prod.txt

# Final stage
FROM python:3.11-slim

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    libpq5 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN useradd -m -u 1000 appuser

# Set working directory
WORKDIR /app

# Copy Python dependencies from builder
COPY --from=builder /root/.local /home/appuser/.local

# Copy application code
COPY --chown=appuser:appuser . .

# Switch to non-root user
USER appuser

# Update PATH
ENV PATH=/home/appuser/.local/bin:$PATH

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:8000/api/health || exit 1

# Run with gunicorn
CMD ["gunicorn", "app.main:app", \
     "-k", "uvicorn.workers.UvicornWorker", \
     "-w", "4", \
     "-b", "0.0.0.0:8000", \
     "--access-logfile", "-", \
     "--error-logfile", "-", \
     "--log-level", "info"]
```

### 4.4 Docker Compose for Local Development

```yaml
# docker-compose.yml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: ${DB_USER:-jidelnicek}
      POSTGRES_PASSWORD: ${DB_PASSWORD:-localpassword}
      POSTGRES_DB: ${DB_NAME:-jidelnicek_dev}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./scripts/init_db.sql:/docker-entrypoint-initdb.d/init.sql
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER:-jidelnicek}"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  minio:
    image: minio/minio:latest
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: ${S3_ACCESS_KEY:-minioadmin}
      MINIO_ROOT_PASSWORD: ${S3_SECRET_KEY:-minioadmin}
    volumes:
      - minio_data:/data
    ports:
      - "9000:9000"
      - "9001:9001"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
      interval: 30s
      timeout: 20s
      retries: 3

  app:
    build:
      context: .
      dockerfile: Dockerfile
      target: builder
    command: |
      bash -c "
        alembic upgrade head &&
        uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
      "
    volumes:
      - ./app:/app/app
      - ./tests:/app/tests
      - ./alembic:/app/alembic
    ports:
      - "8000:8000"
    environment:
      DATABASE_URL: postgresql://${DB_USER:-jidelnicek}:${DB_PASSWORD:-localpassword}@postgres:5432/${DB_NAME:-jidelnicek_dev}
      REDIS_URL: redis://redis:6379
      S3_ENDPOINT_URL: http://minio:9000
      S3_ACCESS_KEY: ${S3_ACCESS_KEY:-minioadmin}
      S3_SECRET_KEY: ${S3_SECRET_KEY:-minioadmin}
      S3_BUCKET_NAME: ${S3_BUCKET_NAME:-jidelnicek-dev}
      SECRET_KEY: ${SECRET_KEY:-dev-secret-key-change-in-production}
      DEBUG: ${DEBUG:-true}
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
      minio:
        condition: service_healthy

  celery-worker:
    build:
      context: .
      dockerfile: Dockerfile
    command: celery -A app.tasks worker --loglevel=info
    volumes:
      - ./app:/app/app
    environment:
      DATABASE_URL: postgresql://${DB_USER:-jidelnicek}:${DB_PASSWORD:-localpassword}@postgres:5432/${DB_NAME:-jidelnicek_dev}
      REDIS_URL: redis://redis:6379
      CELERY_BROKER_URL: redis://redis:6379/0
      CELERY_RESULT_BACKEND: redis://redis:6379/1
    depends_on:
      - app
      - redis

  celery-beat:
    build:
      context: .
      dockerfile: Dockerfile
    command: celery -A app.tasks beat --loglevel=info
    volumes:
      - ./app:/app/app
    environment:
      DATABASE_URL: postgresql://${DB_USER:-jidelnicek}:${DB_PASSWORD:-localpassword}@postgres:5432/${DB_NAME:-jidelnicek_dev}
      REDIS_URL: redis://redis:6379
      CELERY_BROKER_URL: redis://redis:6379/0
      CELERY_RESULT_BACKEND: redis://redis:6379/1
    depends_on:
      - app
      - redis

  mailhog:
    image: mailhog/mailhog:latest
    ports:
      - "1025:1025"  # SMTP server
      - "8025:8025"  # Web UI
    environment:
      MH_STORAGE: memory

volumes:
  postgres_data:
  redis_data:
  minio_data:
```

## 5. Simplified Quality Gates

### 5.1 Test Coverage Requirements

```yaml
# .coveragerc
[run]
source = app
omit = 
    */tests/*
    */migrations/*
    */__init__.py

[report]
precision = 2
show_missing = true

# pytest.ini
[tool:pytest]
minversion = 7.0
testpaths = tests
addopts = 
    --verbose
    --tb=short
    --cov=app
    --cov-report=term-missing
    --cov-fail-under=70  # Reasonable for solo developer
markers =
    unit: marks tests as unit tests
    integration: marks tests as integration tests
```

### 5.2 Basic Linting Configuration

```ini
# .flake8
[flake8]
max-line-length = 88
extend-ignore = E203, W503
exclude = 
    .git,
    __pycache__,
    .venv,
    venv,
    migrations
per-file-ignores = 
    __init__.py:F401
    tests/*:F401,F811

# mypy.ini
[mypy]
python_version = 3.11
warn_return_any = True
disallow_untyped_defs = True
ignore_missing_imports = True

[mypy-tests.*]
ignore_errors = True
```

## 6. Simplified Deployment Scripts

### 6.1 VPS Setup Script

```bash
#!/bin/bash
# scripts/setup-vps.sh

# Create application directory
sudo mkdir -p /opt/jidelnicek
sudo chown $USER:$USER /opt/jidelnicek

# Install Docker and Docker Compose
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Setup firewall
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable

# Create necessary directories
mkdir -p /opt/jidelnicek/{logs,media,ssl}

echo "VPS setup complete. Please log out and back in for Docker permissions."
```

### 6.2 Environment Configuration

```bash
# .env.production (template)
# Database
DATABASE_URL=postgresql://jidelnicek:password@localhost:5432/jidelnicek
DB_USER=jidelnicek
DB_PASSWORD=secure_password
DB_NAME=jidelnicek

# Redis
REDIS_URL=redis://:redis_password@localhost:6379/0
REDIS_PASSWORD=secure_redis_password

# Application
SECRET_KEY=your-secret-key-here
DEBUG=false
ALLOWED_HOSTS=your-domain.cz,www.your-domain.cz

# S3 Storage (optional)
S3_ENDPOINT_URL=https://s3.amazonaws.com
S3_ACCESS_KEY=your-access-key
S3_SECRET_KEY=your-secret-key
S3_BUCKET_NAME=jidelnicek-media
```

### 6.3 Nginx Configuration

```nginx
# nginx.conf
server {
    listen 80;
    server_name your-domain.cz www.your-domain.cz;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.cz www.your-domain.cz;

    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;

    client_max_body_size 10M;

    location / {
        proxy_pass http://app:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /static/ {
        alias /var/www/static/;
    }

    location /media/ {
        alias /var/www/media/;
    }
}
```

## 7. Simple Monitoring

### 7.1 Basic Health Check Script

```bash
#!/bin/bash
# scripts/health-check.sh

URL="https://your-domain.cz/api/health"

# Simple health check
if curl -f -s "$URL" > /dev/null; then
    echo "✅ Health check passed"
    exit 0
else
    echo "❌ Health check failed"
    exit 1
fi
```

### 7.2 Log Monitoring

```bash
#!/bin/bash
# scripts/check-logs.sh

# Check for errors in the last hour
ERRORS=$(docker-compose logs --tail=1000 app | grep -i error | wc -l)

if [ "$ERRORS" -gt 10 ]; then
    echo "⚠️  High error count in logs: $ERRORS errors"
    # Send notification (email, Discord webhook, etc.)
fi

# Check disk space
DISK_USAGE=$(df -h /opt/jidelnicek | awk 'NR==2 {print $5}' | sed 's/%//')
if [ "$DISK_USAGE" -gt 80 ]; then
    echo "⚠️  High disk usage: $DISK_USAGE%"
fi
```

### 7.3 Simple Backup Script

```bash
#!/bin/bash
# scripts/backup.sh

BACKUP_DIR="/backup/jidelnicek"
DATE=$(date +%Y%m%d_%H%M%S)

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Backup database
docker-compose exec -T postgres pg_dump -U jidelnicek jidelnicek | gzip > "$BACKUP_DIR/db_$DATE.sql.gz"

# Backup media files
tar -czf "$BACKUP_DIR/media_$DATE.tar.gz" /opt/jidelnicek/media/

# Keep only last 7 days of backups
find "$BACKUP_DIR" -name "*.gz" -mtime +7 -delete

echo "✅ Backup completed: $DATE"
```

## 8. Simple Rollback Strategy

### 8.1 Manual Rollback Procedure

```bash
#!/bin/bash
# scripts/rollback-manual.sh

# SSH into VPS
ssh user@your-vps.cz

# Go to app directory
cd /opt/jidelnicek

# Stop current deployment
docker-compose down

# Restore previous version
docker tag jidelnicek-app:previous jidelnicek-app:latest

# Start services
docker-compose up -d

# Verify health
curl https://your-domain.cz/api/health
```

### 8.2 Database Backup and Restore

```bash
#!/bin/bash
# scripts/db-restore.sh

# Restore from backup
BACKUP_FILE=$1

if [ -z "$BACKUP_FILE" ]; then
    echo "Usage: ./db-restore.sh <backup-file>"
    exit 1
fi

# Stop application
docker-compose stop app

# Restore database
gunzip -c "$BACKUP_FILE" | docker-compose exec -T postgres psql -U jidelnicek

# Start application
docker-compose start app

echo "✅ Database restored from $BACKUP_FILE"
```

## 9. Best Practices for Solo Development

### 9.1 Simple Git Workflow

```bash
# Feature development
git checkout -b feature/new-recipe-editor
# Make changes
git add .
git commit -m "Add recipe editor functionality"
git push origin feature/new-recipe-editor
# Create PR on GitHub

# Hotfix
git checkout -b hotfix/fix-calculation
# Fix issue
git add .
git commit -m "Fix nutrition calculation bug"
git push origin hotfix/fix-calculation
# Merge directly to main after testing
```

### 9.2 Pre-deployment Checklist

```markdown
## Before Deploying to Production

- [ ] All tests passing locally
- [ ] No console errors in browser
- [ ] Database migrations tested
- [ ] Environment variables updated
- [ ] Recent backup exists
- [ ] SSL certificate valid
- [ ] Monitoring scripts ready
```

### 9.3 GitHub Secrets Setup

Required secrets in GitHub repository settings:

```
VPS_HOST          # Your VPS IP or domain
VPS_USER          # SSH username
VPS_SSH_KEY       # Private SSH key for deployment
```

## 10. Quick Troubleshooting

### Common Issues

1. **Deployment fails with SSH error**
   ```bash
   # Check SSH key permissions
   chmod 600 ~/.ssh/id_rsa
   # Test SSH connection
   ssh user@vps-host
   ```

2. **Docker compose fails**
   ```bash
   # Check logs
   docker-compose logs -f app
   # Restart services
   docker-compose restart
   ```

3. **Database connection errors**
   ```bash
   # Check if postgres is running
   docker-compose ps
   # Check database logs
   docker-compose logs postgres
   ```

4. **Disk space issues**
   ```bash
   # Check disk usage
   df -h
   # Clean up Docker
   docker system prune -a
   ```

## Phase 2 Considerations - PWA Support

When implementing PWA functionality in Phase 2, the CI/CD pipeline will need:

1. **Service Worker Build Step**:
   ```yaml
   - name: Build Service Worker
     run: |
       npm run build:sw
       # Generate SW with workbox
   ```

2. **Manifest.json Generation**:
   ```yaml
   - name: Generate PWA Manifest
     run: |
       npm run generate:manifest
   ```

3. **Offline Testing**:
   ```yaml
   - name: Test Offline Functionality
     run: |
       npm run test:offline
       # Test service worker caching
       # Test IndexedDB sync
   ```

4. **Lighthouse CI for PWA**:
   ```yaml
   - name: Run Lighthouse PWA Audit
     uses: treosh/lighthouse-ci-action@v9
     with:
       urls: |
         https://staging.jidelnicek.cz
       uploadArtifacts: true
       temporaryPublicStorage: true
   ```

## Conclusion

This simplified CI/CD pipeline provides:

1. **Automated testing** on every push
2. **Docker-based deployment** for consistency
3. **SSH deployment** to single VPS
4. **Simple rollback** mechanism
5. **Basic monitoring** and backup scripts

Perfect for solo developers deploying to vpsFree or similar VPS providers. The pipeline balances automation with simplicity, avoiding over-engineering for a single-developer project. PWA features and their associated build steps are intentionally deferred to Phase 2.