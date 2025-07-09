#!/bin/bash
# PostgreSQL backup script for Jídelníček 2.0

# Configuration
BACKUP_DIR="/backups/postgres"
DB_NAME="${DB_NAME:-jidelnicek}"
DB_USER="${DB_USER:-jidelnicek}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=30

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Perform backup
echo "Starting backup of database $DB_NAME at $(date)"

# Use .pgpass file for authentication or set PGPASSWORD environment variable
pg_dump \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    -f "$BACKUP_DIR/backup_${DB_NAME}_${DATE}.sql" \
    --verbose \
    --no-owner \
    --no-privileges

# Check if backup was successful
if [ $? -eq 0 ]; then
    echo "Backup completed successfully"
    
    # Compress the backup
    gzip "$BACKUP_DIR/backup_${DB_NAME}_${DATE}.sql"
    echo "Backup compressed: backup_${DB_NAME}_${DATE}.sql.gz"
    
    # Remove old backups
    echo "Removing backups older than $RETENTION_DAYS days"
    find "$BACKUP_DIR" -name "backup_${DB_NAME}_*.sql.gz" -mtime +$RETENTION_DAYS -delete
    
    # List remaining backups
    echo "Current backups:"
    ls -lh "$BACKUP_DIR"/backup_${DB_NAME}_*.sql.gz | tail -10
else
    echo "Backup failed!"
    exit 1
fi

# Optional: Upload to cloud storage
# Uncomment and configure as needed
# if command -v aws &> /dev/null; then
#     echo "Uploading to S3..."
#     aws s3 cp "$BACKUP_DIR/backup_${DB_NAME}_${DATE}.sql.gz" \
#         "s3://your-backup-bucket/postgres/${DB_NAME}/" \
#         --storage-class GLACIER
# fi

echo "Backup process completed at $(date)"