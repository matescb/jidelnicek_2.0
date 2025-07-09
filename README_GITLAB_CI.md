# GitLab CI/CD Pipeline Setup for Jídelníček 2.0

This document describes the GitLab CI/CD pipeline configuration for the Jídelníček 2.0 project, aligned with the strategy defined in `Documentation/jidelnicek_CI-CD Pipeline.md`.

## Pipeline Overview

The pipeline consists of 5 stages:
1. **build** - Dependency installation and Docker image building
2. **test** - Unit tests, integration tests, and performance tests
3. **quality** - Code quality checks (Black, Flake8, MyPy)
4. **security** - Security scanning (Bandit, Safety)
5. **deploy** - Production deployment to VPS

## Required GitLab Variables

Configure these variables in your GitLab project settings (`Settings > CI/CD > Variables`):

### SSH Deployment Variables
- `SSH_PRIVATE_KEY` - Private SSH key for VPS deployment
- `VPS_HOST` - Your VPS hostname or IP address
- `VPS_USER` - SSH username for VPS access

### Optional Variables
- `PERFORMANCE_THRESHOLD_MS` - API response time threshold (default: 200ms)
- `COVERAGE_THRESHOLD` - Code coverage threshold (default: 70%)

## Files Created

### 1. `.gitlab-ci.yml`
Main CI/CD pipeline configuration with:
- Python 3.11 environment
- PostgreSQL 15 and Redis 7 services
- Comprehensive test suite execution
- Code quality and security checks
- Docker image building and deployment

### 2. `docker-compose.ci.yml`
CI-specific Docker Compose configuration for:
- Integration testing with real database
- Celery worker testing
- Service health checks
- Resource limits for CI environment

### 3. `.env.ci`
Environment variables template for CI/CD pipeline with:
- Test database configuration
- Mock email settings
- Performance testing thresholds
- Feature flags for testing

## Pipeline Jobs

### Build Stage
- **build**: Install Poetry dependencies and cache them
- **docker-build**: Build Docker images (main branch only)

### Test Stage
- **unit-tests**: Run pytest with coverage reporting
- **integration-tests**: Full integration tests with PostgreSQL/Redis
- **performance-tests**: API response time validation (<200ms)

### Quality Stage
- **code-quality**: Black formatting, Flake8 linting, MyPy type checking

### Security Stage
- **security-scan**: Bandit security scanner and Safety dependency checks

### Deploy Stage
- **deploy-production**: Manual deployment to VPS (main branch only)
- **rollback-production**: Manual rollback capability

## Key Features

### Test Coverage
- Minimum 70% code coverage required
- Comprehensive test suite including auth, recipe, shopping, and trip modules
- Nutritional accuracy tests (99.9% requirement)
- Performance tests ensuring <200ms API response times

### Code Quality
- Black code formatting (100 character line length)
- Flake8 linting with extended ignore rules
- MyPy type checking with strict configuration
- Pre-commit hooks validation

### Security
- Bandit security scanning for Python code
- Safety dependency vulnerability scanning
- Secure SSH deployment with proper key management

### Deployment
- Docker-based deployment to single VPS
- Health checks after deployment
- Simple rollback mechanism
- Manual approval required for production deployment

## Usage

### Running the Pipeline

The pipeline automatically runs on:
- Pushes to any branch
- Merge requests to main branch
- Manual triggers

### Manual Deployment

Production deployment is manual and requires:
1. Successful completion of all test and quality stages
2. Main branch only
3. Manual approval via GitLab UI

### Rollback Process

If deployment fails or issues are detected:
1. Go to GitLab CI/CD > Pipelines
2. Find the latest pipeline
3. Click "Manual" on the `rollback-production` job
4. Confirm rollback execution

## Local Testing

Test the pipeline locally using Docker:

```bash
# Build and test with CI configuration
docker-compose -f docker-compose.ci.yml up --build

# Run tests manually
poetry run pytest tests/ --cov=src/jidelnicek --cov-report=term-missing

# Check code quality
poetry run black --check src/ tests/
poetry run flake8 src/ tests/
poetry run mypy src/jidelnicek
```

## Monitoring

The pipeline includes:
- Test coverage reporting
- Performance metrics collection
- Security vulnerability reporting
- Deployment health checks
- Artifact storage for debugging

## Troubleshooting

### Common Issues

1. **Test failures**: Check test logs in GitLab CI/CD job output
2. **SSH deployment issues**: Verify SSH keys and VPS access
3. **Docker build failures**: Check Dockerfile and dependencies
4. **Coverage failures**: Ensure tests cover minimum 70% of code

### Debug Commands

```bash
# Check pipeline status
curl -H "PRIVATE-TOKEN: <your_token>" \
  "https://gitlab.com/api/v4/projects/<project_id>/pipelines"

# View job logs
curl -H "PRIVATE-TOKEN: <your_token>" \
  "https://gitlab.com/api/v4/projects/<project_id>/jobs/<job_id>/trace"
```

## Best Practices

1. **Branch Protection**: Configure main branch protection rules
2. **Secret Management**: Use GitLab CI/CD variables for sensitive data
3. **Resource Limits**: Monitor CI/CD minute usage
4. **Artifact Management**: Regular cleanup of old artifacts
5. **Health Monitoring**: Monitor deployment health checks

## Next Steps

1. Configure GitLab project variables
2. Set up SSH keys for VPS deployment
3. Configure branch protection rules
4. Test pipeline with feature branch
5. Perform first production deployment

## Integration with Existing Workflow

This pipeline integrates with your existing:
- Poetry dependency management
- Docker containerization
- Makefile commands
- Test suite organization
- Database migrations (Alembic)

The pipeline maintains compatibility with your current development workflow while adding automated testing and deployment capabilities.