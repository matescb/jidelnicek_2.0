# Automated Cleanup System

## Overview

The Jídelníček 2.0 application includes a comprehensive automated cleanup system for managing old export files and temporary data. This system helps maintain optimal storage usage while providing flexibility for users to retain important files.

## Features

### 1. Configurable Retention Policies
- **Per-file-type policies**: Different retention periods for shopping lists, trip data, recipes, and datasets
- **Grace periods**: Files are marked for deletion but kept for a configurable grace period
- **User overrides**: Users can set their own retention preferences within allowed limits
- **Storage-specific policies**: Different policies for local and cloud storage

### 2. Automated Cleanup Jobs
- **Daily cleanup**: Automatically runs at 2 AM UTC to clean local export files
- **Weekly cloud cleanup**: Runs weekly at 3 AM UTC for cloud storage
- **Hourly temp cleanup**: Cleans temporary files every hour
- **Queue processing**: Processes deletion queue every 15 minutes

### 3. Audit Trail
- **Complete logging**: Every file deletion is logged with reason, timestamp, and metadata
- **File recovery**: Deleted files can be recovered within the grace period
- **User attribution**: Tracks which user created each file
- **Statistics tracking**: Daily statistics on cleanup activities

### 4. User Notifications
- **Pre-deletion alerts**: Users receive notifications before their files are deleted
- **Configurable timing**: Users can set when they want to be notified
- **Multiple reminders**: System sends reminders at 24h, 6h, and 1h before deletion
- **Opt-out option**: Users can disable notifications if desired

## Configuration

### Default Retention Periods
- Shopping lists: 7 days
- Trip data: 30 days
- Recipe exports: 90 days
- Large datasets: 180 days
- Temporary files: 1 day

### Grace Periods
- Shopping lists: 24 hours
- Trip data: 48 hours
- Recipe exports: 72 hours
- Datasets: 7 days

## API Endpoints

### Policy Management (Admin Only)
- `GET /api/v1/cleanup/policies` - List all cleanup policies
- `POST /api/v1/cleanup/policies` - Create new policy
- `PUT /api/v1/cleanup/policies/{id}` - Update policy
- `DELETE /api/v1/cleanup/policies/{id}` - Delete policy

### User Preferences
- `GET /api/v1/cleanup/preferences` - Get current user's preferences
- `PUT /api/v1/cleanup/preferences` - Update preferences

### Audit and Monitoring
- `GET /api/v1/cleanup/audit-logs` - View audit logs
- `GET /api/v1/cleanup/statistics` - View cleanup statistics
- `POST /api/v1/cleanup/report` - Generate cleanup report
- `POST /api/v1/cleanup/recover/{audit_log_id}` - Recover deleted file

### Manual Controls (Admin Only)
- `POST /api/v1/cleanup/trigger` - Manually trigger cleanup

## Celery Tasks

### Primary Cleanup Tasks
- `cleanup_export_files` - Cleans local export files
- `cleanup_cloud_storage` - Cleans cloud storage
- `cleanup_temp_files` - Cleans temporary files
- `process_deletion_queue` - Processes queued deletions
- `cleanup_old_jobs` - Cleans old job records

### Notification Tasks
- `send_deletion_notification` - Sends pre-deletion notifications
- `send_cleanup_summary` - Sends weekly cleanup summaries
- `send_storage_alert` - Sends storage-related alerts

## Database Models

### CleanupPolicy
Stores configurable retention policies for different file types.

### CleanupAuditLog
Maintains audit trail of all file deletions.

### DeletionQueue
Tracks files scheduled for deletion after grace period.

### CleanupStatistics
Stores daily aggregated cleanup statistics.

### UserCleanupPreference
Stores user-specific retention preferences.

## Implementation Details

### File Deletion Process
1. Cleanup task runs according to schedule
2. Scans directories for files older than retention period
3. Creates audit log entry for each file to delete
4. If notifications enabled, queues deletion notification
5. If within grace period, adds to deletion queue
6. If past grace period, deletes file immediately
7. Updates statistics and removes metadata

### Recovery Process
1. User requests file recovery within grace period
2. System checks if recovery information available
3. Attempts to restore file from backup location
4. Updates audit log to mark file as recovered
5. Returns recovery status to user

### Notification Flow
1. File marked for deletion
2. Notification scheduled for lead time before deletion
3. User receives email with file details and deletion time
4. Reminders sent at configured intervals
5. Final notification when file is deleted

## Security Considerations

- Only admins can manage cleanup policies
- Users can only see their own audit logs
- File recovery requires ownership or admin rights
- Deletion operations are logged for accountability
- Sensitive file metadata is not exposed in logs

## Performance Optimizations

- Batch processing of files to reduce I/O
- Asynchronous operations for better throughput
- Redis caching for export metadata
- Indexed database queries for fast lookups
- Configurable task priorities and queues

## Monitoring and Alerts

- Admin alerts for cleanup failures
- Storage quota monitoring
- Performance metrics tracking
- Error rate monitoring
- Weekly summary reports

## Best Practices

1. **Set appropriate retention periods** based on regulatory requirements
2. **Enable notifications** to avoid losing important files
3. **Monitor storage usage** to adjust policies as needed
4. **Review audit logs** regularly for unusual patterns
5. **Test recovery procedures** periodically
6. **Keep grace periods reasonable** to allow user reaction time

## Future Enhancements

- Intelligent retention based on file usage patterns
- Compression before archival
- Multi-tier storage with automatic migration
- Machine learning for optimal retention prediction
- Integration with backup systems
- User-friendly recovery interface