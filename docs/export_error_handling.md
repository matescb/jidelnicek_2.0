# Export Error Handling and Recovery System

## Overview

The Jidelnicek export system includes comprehensive error handling and recovery mechanisms to ensure reliable export operations even when dependencies are missing or system resources are constrained.

## Key Features

### 1. Graceful Degradation
- Automatic fallback to alternative export formats when dependencies are missing
- Format mapping: PDF → HTML → TXT, XLSX → CSV → JSON
- All fallback formats use only Python standard library

### 2. Error Recovery Strategies
- **Fallback Format**: Switch to alternative format when dependency missing
- **Resource Reduction**: Reduce batch sizes and quality for resource constraints
- **Async Processing**: Queue large exports for background processing
- **Retry with Backoff**: Automatic retry for transient failures

### 3. Circuit Breaker Pattern
- Prevents cascading failures
- Automatically opens after threshold failures
- Self-healing with configurable recovery timeout

### 4. Comprehensive Error Logging
- Detailed error context capture
- Pattern detection for recurring issues
- Automatic admin notifications for critical errors
- Error tracking with unique IDs for debugging

### 5. Resource Management
- Concurrent export limiting
- Memory usage monitoring
- Automatic resource cleanup
- Graceful handling of resource exhaustion

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Export Request                           │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                 ExportServiceWrapper                         │
│  - Dependency checking                                       │
│  - Timeout handling                                          │
│  - Circuit breaker                                          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Export Service                            │
│  - Business logic                                           │
│  - Data processing                                          │
└─────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │                   │
                    ▼                   ▼
            ┌───────────┐       ┌───────────┐
            │  Success  │       │   Error   │
            └───────────┘       └───────────┘
                                       │
                                       ▼
                          ┌─────────────────────┐
                          │ ErrorRecoveryService │
                          │ - Analyze error      │
                          │ - Select strategy    │
                          │ - Execute recovery   │
                          └─────────────────────┘
                                       │
                          ┌────────────┴────────────┐
                          │                         │
                          ▼                         ▼
                   ┌─────────────┐          ┌─────────────┐
                   │  Recovered  │          │   Failed    │
                   └─────────────┘          └─────────────┘
```

## Usage

### Basic Integration

```python
from jidelnicek.recipe.services.export_service_enhanced import EnhancedRecipeExportService

# Initialize service
export_service = EnhancedRecipeExportService(session)

# Export with automatic error handling
try:
    result = await export_service.export_recipes_to_pdf(
        recipes,
        output_file,
        user_id=current_user.id
    )
except ExportException as e:
    # Error already logged and recovery attempted
    return {
        "error": e.error_code,
        "message": str(e),
        "recoverable": e.recoverable
    }
```

### Custom Error Handling

```python
from jidelnicek.core.services.export_service_wrapper import with_export_error_handling

class CustomExportService:
    @with_export_error_handling("custom", ["custom_dependency"])
    async def export_custom_format(self, data):
        # Your export logic here
        pass
```

### Fallback Formats

```python
from jidelnicek.core.services.export_fallback import FallbackExporter

# Always available exports
json_data = await FallbackExporter.export_to_json(data)
csv_data = await FallbackExporter.export_to_csv(data)
html_data = await FallbackExporter.export_to_html(data, title="Export")
txt_data = await FallbackExporter.export_to_txt(data)
```

## Configuration

### Environment Variables

```env
# Export Settings
EXPORT_TIMEOUT=300  # Timeout in seconds
MAX_EXPORT_ITEMS=10000  # Maximum items per export
MAX_CONCURRENT_EXPORTS=10  # Concurrent export limit

# Error Handling
EXPORT_RETRY_MAX_ATTEMPTS=3
EXPORT_RETRY_BACKOFF_FACTOR=2.0
CIRCUIT_BREAKER_FAILURE_THRESHOLD=5
CIRCUIT_BREAKER_RECOVERY_TIMEOUT=60

# Notifications
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USERNAME=notifications@example.com
SMTP_PASSWORD=secret
SMTP_USE_TLS=true
ADMIN_EMAILS=admin@example.com,ops@example.com
NOTIFICATION_FROM_EMAIL=noreply@example.com
```

### Fallback Mapping Configuration

```python
# In settings or configuration
EXPORT_FALLBACK_MAPPING = {
    "pdf": ["html", "txt"],
    "xlsx": ["csv", "json"],
    "docx": ["html", "txt"],
    "ics": ["json", "csv"]
}
```

## Error Types

### Recoverable Errors

1. **DependencyMissingError**: Missing optional dependency
   - Automatic fallback to alternative format
   - User notified of format change

2. **ExportResourceError**: Resource constraints
   - Reduce quality/batch size
   - Queue for async processing

3. **ExportTimeoutError**: Operation timeout
   - Queue for background processing
   - Notify user when complete

4. **ExportNetworkError**: Network issues
   - Retry with exponential backoff
   - Circuit breaker protection

### Non-Recoverable Errors

1. **ExportPermissionError**: Insufficient permissions
   - Clear error message to user
   - Audit log entry

2. **ExportDataError**: Invalid/corrupted data
   - Detailed error for debugging
   - Request data validation

3. **ExportValidationError**: Input validation failed
   - Specific validation errors
   - Guide user to fix issues

## Monitoring and Metrics

### Available Metrics

- `exports_started`: Export operations initiated
- `exports_completed`: Successful exports
- `exports_failed`: Failed exports
- `export_duration`: Time taken for exports
- `export_fallbacks`: Fallback formats used
- `export_errors_logged`: Errors logged
- `export_recovery_success`: Successful recoveries

### Error Patterns

The system automatically detects error patterns:
- High frequency errors (10+ in time window)
- Rapid succession errors (5+ in 5 minutes)
- Resource exhaustion patterns
- Dependency failure patterns

### Monitoring Dashboard

Access export statistics:

```python
stats = await export_service.get_export_statistics(hours=24)
# Returns:
# {
#     "exports": {
#         "total": 1234,
#         "failed": 12,
#         "by_format": {"pdf": 500, "xlsx": 400, ...}
#     },
#     "performance": {
#         "average_duration_ms": {"pdf": 1500, ...},
#         "p95_duration_ms": {"pdf": 3000, ...}
#     },
#     "errors": {...},
#     "fallbacks_used": 45
# }
```

## Best Practices

1. **Always Use Enhanced Export Service**
   - Provides automatic error handling
   - Tracks metrics and performance
   - Manages resources efficiently

2. **Configure Appropriate Timeouts**
   - Set based on expected data sizes
   - Consider network conditions
   - Allow headroom for recovery

3. **Monitor Error Patterns**
   - Review error logs regularly
   - Address recurring issues
   - Update fallback strategies

4. **Test Fallback Scenarios**
   - Verify fallback formats work correctly
   - Test with missing dependencies
   - Validate error messages

5. **Resource Planning**
   - Set appropriate concurrent limits
   - Monitor memory usage patterns
   - Plan for peak usage

## Troubleshooting

### Common Issues

1. **"Export format not available"**
   - Check if dependency is installed
   - Verify fallback format is acceptable
   - Review error logs for details

2. **"Export timed out"**
   - Check data size and complexity
   - Increase timeout if needed
   - Consider async processing

3. **"Circuit breaker open"**
   - Multiple failures detected
   - Wait for recovery timeout
   - Check system health

4. **"Resource limit exceeded"**
   - Too many concurrent exports
   - Insufficient memory
   - Reduce batch sizes

### Debug Mode

Enable detailed logging:

```python
import logging
logging.getLogger("jidelnicek.export").setLevel(logging.DEBUG)
```

### Error Recovery Testing

```python
# Force specific error scenarios
from jidelnicek.core.exceptions.export_exceptions import DependencyMissingError

# Test fallback
raise DependencyMissingError("test_lib", "pdf", "html")

# Test resource limits
raise ExportResourceError("memory", "500MB")
```

## API Reference

See the following modules for detailed API documentation:
- `jidelnicek.core.exceptions.export_exceptions`
- `jidelnicek.core.middleware.error_handler`
- `jidelnicek.core.services.error_recovery`
- `jidelnicek.core.services.export_fallback`
- `jidelnicek.core.services.export_service_wrapper`