# Redis Connection Error Fix

## Problem
The application was failing with Redis authentication error:
```
invalid username-password pair or user is disabled
```

## Root Cause
The Redis configuration file (`docker/redis/redis.conf`) contained:
```
requirepass ${REDIS_PASSWORD}
```

Redis doesn't support environment variable substitution in configuration files, so it was literally using `${REDIS_PASSWORD}` as the password string instead of the actual password value.

## Solution Implemented

### 1. Modified Docker Compose Files
Updated `docker-compose.yml` and `docker-compose.dev.yml` to pass the password via command line:

```yaml
redis:
  command: >
    sh -c 'redis-server /usr/local/etc/redis/redis.conf
    --requirepass "$${REDIS_PASSWORD}"'
```

### 2. Updated Redis Configuration
Removed the `requirepass` directive from `redis.conf` since it's now set dynamically.

### 3. Created Development Configuration
Added `redis.dev.conf` without authentication for easier local development.

### 4. Added No-Auth Override
Created `docker-compose.dev-noauth.yml` for development without Redis authentication.

### 5. Updated Application Code
Modified `src/jidelnicek/core/config.py` to handle empty Redis passwords properly.

## Usage

### Option 1: Development with Authentication (Default)
```bash
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up
```

### Option 2: Development without Authentication
```bash
docker-compose -f docker-compose.yml -f docker-compose.dev-noauth.yml up
```

### Option 3: Set Empty Password in .env.dev
```bash
# Edit .env.dev
REDIS_PASSWORD=

# Then run normally
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up
```

## Testing the Fix

After applying the changes:

1. Stop existing containers:
   ```bash
   docker-compose down
   ```

2. Remove Redis volume (to clear old data):
   ```bash
   docker volume rm jidelnicek_redis_data_dev
   ```

3. Start with your preferred configuration:
   ```bash
   # With authentication
   docker-compose -f docker-compose.yml -f docker-compose.dev.yml up
   
   # Or without authentication
   docker-compose -f docker-compose.yml -f docker-compose.dev-noauth.yml up
   ```

4. The Redis connection should now work properly without authentication errors.