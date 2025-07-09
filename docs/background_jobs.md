# Background Job Processing System

The Jídelníček 2.0 application includes a comprehensive background job processing system built on Celery for handling long-running operations, particularly export tasks.

## Overview

The background job system provides:

- **Asynchronous Processing**: Handle time-consuming operations without blocking the API
- **Job Tracking**: Monitor job progress, status, and results
- **Retry Logic**: Automatic retry with exponential backoff for failed jobs
- **Priority Queues**: Different priority levels for job execution
- **Export Operations**: Support for various export formats (PDF, Excel, CSV, JSON, etc.)
- **Cleanup Tasks**: Automatic cleanup of old jobs and export files
- **Notifications**: Optional notifications on job completion or failure

## Architecture

### Components

1. **Celery Application** (`core/celery_app.py`)
   - Configures Celery with Redis as broker and result backend
   - Defines task queues with different priorities
   - Sets up periodic tasks for cleanup operations

2. **Job Models** (`core/models/job.py`)
   - `Job`: Main model for tracking background jobs
   - `JobNotification`: Tracks notifications sent for jobs
   - Supports various job types and statuses

3. **Job Service** (`core/services/job_service.py`)
   - Manages job lifecycle (create, submit, track, cancel, retry)
   - Provides job statistics and cleanup operations
   - Integrates with Celery for task execution

4. **Export Tasks** (`tasks/export_tasks.py`)
   - Shopping list exports
   - Trip data exports
   - Recipe exports
   - Large dataset exports
   - Cleanup tasks

5. **API Endpoints** (`core/routers/jobs.py`)
   - RESTful API for job management
   - Export-specific endpoints
   - File download endpoints

## Job Types

### Export Jobs

1. **Shopping List Export** (`EXPORT_SHOPPING_LIST`)
   - Exports shopping lists for trips
   - Supports grouping by category
   - Optional price inclusion

2. **Trip Data Export** (`EXPORT_TRIP_DATA`)
   - Complete trip data export
   - Includes meal plans, shopping lists, participants
   - Optional QR code generation

3. **Recipe Export** (`EXPORT_RECIPES`)
   - Export individual or all recipes
   - Include images and nutritional information
   - Multiple format support

4. **Dataset Export** (`EXPORT_DATASET`)
   - Large dataset exports with chunked processing
   - Suitable for reports and analytics

## Usage

### Starting Workers

```bash
# Start Celery worker
python scripts/run_celery_worker.py --loglevel=info --concurrency=4

# Start Celery beat scheduler (for periodic tasks)
python scripts/run_celery_beat.py --loglevel=info

# Start Flower for monitoring (optional)
celery -A jidelnicek.core.celery_app flower
```

### Creating Export Jobs

#### Via API

```bash
# Export shopping list
curl -X POST http://localhost:8000/api/v1/jobs/export/shopping-list \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "trip_id": 123,
    "format": "pdf",
    "group_by_category": true,
    "priority": "high",
    "notify_on_completion": true
  }'

# Check job status
curl http://localhost:8000/api/v1/jobs/1 \
  -H "Authorization: Bearer $TOKEN"

# Download export when complete
curl http://localhost:8000/api/v1/exports/{export_id}/download \
  -H "Authorization: Bearer $TOKEN" \
  -o shopping_list.pdf
```

#### Via Code

```python
from jidelnicek.core.services.job_service import JobService
from jidelnicek.core.models.job import JobType, JobPriority

# Create job
job_service = JobService(db)
job = await job_service.create_job(
    job_type=JobType.EXPORT_SHOPPING_LIST,
    name="Export Shopping List for Summer Camp",
    parameters={
        "trip_id": 123,
        "format": "pdf",
        "options": {"group_by_category": True}
    },
    user_id=current_user.id,
    priority=JobPriority.HIGH,
    notify_on_completion=True
)

# Submit job
job = await job_service.submit_job(job)

# Check status
job = await job_service.get_job(job.id)
print(f"Job status: {job.status}, Progress: {job.progress}%")
```

## Configuration

### Environment Variables

```env
# Redis configuration for Celery
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=0
REDIS_PASSWORD=optional_password

# Worker configuration
CELERY_WORKER_CONCURRENCY=4
CELERY_WORKER_MAX_TASKS_PER_CHILD=1000
CELERY_TASK_TIME_LIMIT=3600
CELERY_TASK_SOFT_TIME_LIMIT=3300

# Export settings
EXPORT_RETENTION_DAYS=7
EXPORT_MAX_FILE_SIZE=104857600  # 100MB
```

### Queue Configuration

The system uses four queues with different priorities:

1. **default**: Regular priority tasks (priority: 5)
2. **high**: High priority tasks (priority: 10)
3. **low**: Low priority, resource-intensive tasks (priority: 1)
4. **maintenance**: Cleanup and maintenance tasks (priority: 0)

### Retry Configuration

Jobs are configured with automatic retry on failure:

- Default: 3 retries with 60-second delay
- Large exports: 2 retries with 300-second delay
- Exponential backoff available for specific tasks

## Monitoring

### Job Status Values

- `PENDING`: Job created but not yet started
- `RUNNING`: Job is currently being processed
- `COMPLETED`: Job finished successfully
- `FAILED`: Job failed after all retries
- `CANCELLED`: Job was cancelled by user
- `RETRYING`: Job is being retried after failure

### API Endpoints

- `GET /api/v1/jobs/` - List user's jobs with filtering
- `GET /api/v1/jobs/{id}` - Get job details
- `POST /api/v1/jobs/{id}/cancel` - Cancel a running job
- `POST /api/v1/jobs/{id}/retry` - Retry a failed job
- `DELETE /api/v1/jobs/{id}` - Delete a completed job
- `GET /api/v1/jobs/statistics/summary` - Get job statistics

### Flower Dashboard

Access the Flower dashboard at `http://localhost:5555` to:
- Monitor active workers
- View task execution in real-time
- Inspect task details and results
- Manage worker pool

## Error Handling

The system implements comprehensive error handling:

1. **Soft Time Limits**: Graceful task termination before hard limits
2. **Automatic Retries**: Configurable retry logic with delays
3. **Error Tracking**: Detailed error messages and tracebacks stored
4. **Failure Notifications**: Optional notifications on job failure
5. **Cleanup on Failure**: Temporary files cleaned up automatically

## Best Practices

1. **Use Appropriate Queues**: 
   - Use `high` queue for quick, user-facing exports
   - Use `low` queue for large, resource-intensive operations

2. **Set Reasonable Time Limits**:
   - Configure task time limits based on expected duration
   - Use soft time limits for graceful shutdown

3. **Monitor Resource Usage**:
   - Watch worker memory usage for large exports
   - Scale workers based on queue depth

4. **Clean Up Regularly**:
   - Configure retention periods for exports
   - Run cleanup tasks periodically

5. **Handle Failures Gracefully**:
   - Implement proper error messages
   - Provide retry options for users
   - Log errors for debugging

## Testing

Run the test suite:

```bash
# Unit tests
pytest tests/core/test_jobs/

# Integration tests with Redis
pytest tests/core/test_jobs/ --integration

# Load testing
locust -f tests/load/test_exports.py
```

## Troubleshooting

### Common Issues

1. **Jobs Stuck in PENDING**:
   - Check if workers are running
   - Verify Redis connectivity
   - Check queue routing configuration

2. **Export Files Not Found**:
   - Verify upload directory permissions
   - Check disk space
   - Confirm cleanup schedule

3. **High Memory Usage**:
   - Reduce worker concurrency
   - Enable task result compression
   - Implement chunked processing for large exports

### Debug Commands

```bash
# Check Celery connectivity
celery -A jidelnicek.core.celery_app inspect ping

# List active tasks
celery -A jidelnicek.core.celery_app inspect active

# Check registered tasks
celery -A jidelnicek.core.celery_app inspect registered

# Purge all tasks (use with caution)
celery -A jidelnicek.core.celery_app purge
```