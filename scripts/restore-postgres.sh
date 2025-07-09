#!/bin/bash
# PostgreSQL restore script for Jídelníček 2.0

# Configuration
BACKUP_DIR="/backups/postgres"
DB_NAME="${DB_NAME:-jidelnicek}"
DB_USER="${DB_USER:-jidelnicek}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"

# Check if backup file is provided
if [ -z "$1" ]; then
    echo "Usage: $0 <backup_file>"
    echo "Available backups:"
    ls -lh "$BACKUP_DIR"/backup_*.sql.gz 2>/dev/null | tail -20
    exit 1
fi

BACKUP_FILE="$1"

# Check if backup file exists
if [ ! -f "$BACKUP_FILE" ]; then
    # Try to find in backup directory
    if [ -f "$BACKUP_DIR/$BACKUP_FILE" ]; then
        BACKUP_FILE="$BACKUP_DIR/$BACKUP_FILE"
    else
        echo "Backup file not found: $BACKUP_FILE"
        exit 1
    fi
fi

echo "Restoring database $DB_NAME from $BACKUP_FILE"
echo "WARNING: This will DROP and recreate the database!"
read -p "Are you sure? (yes/no): " -r
if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
    echo "Restore cancelled"
    exit 0
fi

# Create temporary uncompressed file if needed
TEMP_FILE=""
if [[ "$BACKUP_FILE" == *.gz ]]; then
    TEMP_FILE=$(mktemp)
    echo "Decompressing backup..."
    gunzip -c "$BACKUP_FILE" > "$TEMP_FILE"
    BACKUP_FILE="$TEMP_FILE"
fi

# Drop and recreate database
echo "Dropping existing database..."
PGPASSWORD=$DB_PASSWORD dropdb -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$DB_NAME" --if-exists

echo "Creating new database..."
PGPASSWORD=$DB_PASSWORD createdb -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$DB_NAME"

# Restore the backup
echo "Restoring backup..."
PGPASSWORD=$DB_PASSWORD psql \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    -f "$BACKUP_FILE"

# Check if restore was successful
if [ $? -eq 0 ]; then
    echo "Restore completed successfully"
    
    # Run any post-restore scripts
    if [ -f "./docker/postgres/post-restore.sql" ]; then
        echo "Running post-restore scripts..."
        PGPASSWORD=$DB_PASSWORD psql \
            -h "$DB_HOST" \
            -p "$DB_PORT" \
            -U "$DB_USER" \
            -d "$DB_NAME" \
            -f "./docker/postgres/post-restore.sql"
    fi
else
    echo "Restore failed!"
    exit 1
fi

# Clean up temporary file
if [ -n "$TEMP_FILE" ]; then
    rm -f "$TEMP_FILE"
fi

echo "Restore process completed at $(date)"