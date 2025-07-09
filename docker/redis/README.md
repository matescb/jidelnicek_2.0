# Redis Configuration for Jídelníček 2.0

This directory contains Redis configuration and utility scripts for the Jídelníček 2.0 application.

## Configuration

### redis.conf

The main Redis configuration file with production-ready settings:

- **Memory limit**: 512MB with `allkeys-lru` eviction policy
- **Persistence**: Both RDB snapshots and AOF enabled for data safety
- **Security**: Password authentication required, dangerous commands disabled
- **Databases**: 4 databases configured for different purposes
  - DB 0: Session storage
  - DB 1: Cache data
  - DB 2: Rate limiting
  - DB 3: Background job queues (future use)

### Environment Variables

Required environment variables in `.env`:

```bash
REDIS_PASSWORD=your_secure_password_here
REDIS_PORT=6379
```

## Cache Key Patterns

See `CACHE_KEY_PATTERNS.md` for detailed documentation on:
- Key naming conventions
- Pattern examples for each data type
- TTL strategies
- Invalidation patterns

## Utility Scripts

### scripts/cache_warming.py

Preloads frequently accessed data into Redis cache:

```bash
# Warm all cache components
python scripts/cache_warming.py

# Warm specific components
python scripts/cache_warming.py --components restaurants menus

# Available components: restaurants, menus, allergens, popular
```

### scripts/cache_invalidation.py

Manages cache invalidation with various patterns:

```bash
# Show cache information
python scripts/cache_invalidation.py info

# Invalidate by pattern
python scripts/cache_invalidation.py pattern "cache:menu:*" --dry-run

# Invalidate specific entities
python scripts/cache_invalidation.py user 12345
python scripts/cache_invalidation.py restaurant 101
python scripts/cache_invalidation.py menu --restaurant-id 101 --date 2024-01-09

# Invalidate all cache (use with caution!)
python scripts/cache_invalidation.py all --dry-run
```

### scripts/session_cleanup.py

Manages session cleanup and provides session statistics:

```bash
# Show session statistics
python scripts/session_cleanup.py stats

# Show active users
python scripts/session_cleanup.py active

# Clean up expired sessions
python scripts/session_cleanup.py expired --dry-run

# Perform full cleanup
python scripts/session_cleanup.py full

# Force logout a user
python scripts/session_cleanup.py logout 12345
```

## Docker Integration

The Redis service is configured in `docker-compose.yml` with:
- Custom configuration file mounted
- Data persistence volume
- Health checks
- Memory limits
- Password authentication

To connect to Redis CLI:

```bash
# Connect with password
docker exec -it jidelnicek_redis redis-cli -a $REDIS_PASSWORD

# Select database
redis> SELECT 1  # For cache database

# View keys
redis> SCAN 0 MATCH cache:*
```

## Monitoring

Key metrics to monitor:
- Memory usage: `INFO memory`
- Hit/miss ratio: `INFO stats`
- Connected clients: `INFO clients`
- Key distribution: `INFO keyspace`

## Best Practices

1. **Always use the utility scripts** for cache management instead of direct Redis commands
2. **Test with --dry-run** before performing bulk operations
3. **Monitor memory usage** regularly to ensure efficient eviction
4. **Use appropriate TTLs** based on data volatility
5. **Document new cache patterns** in CACHE_KEY_PATTERNS.md

## Backup and Recovery

Redis data is persisted in two ways:
1. **RDB snapshots**: Automatic snapshots based on save rules
2. **AOF (Append Only File)**: Every write operation logged

Backup location: Docker volume `jidelnicek_redis_data`

To backup:
```bash
docker exec jidelnicek_redis redis-cli -a $REDIS_PASSWORD BGSAVE
docker cp jidelnicek_redis:/data ./redis-backup
```

To restore:
```bash
docker cp ./redis-backup/dump.rdb jidelnicek_redis:/data/
docker restart jidelnicek_redis
```