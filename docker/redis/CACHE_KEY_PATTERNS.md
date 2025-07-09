# Redis Cache Key Patterns Documentation

## Overview

This document defines the standardized key patterns used in the Jídelníček 2.0 Redis cache implementation. Following these patterns ensures consistency, maintainability, and efficient cache management.

## Database Allocation

Redis is configured with 4 databases for different purposes:

- **DB 0**: Session storage
- **DB 1**: Cache data
- **DB 2**: Rate limiting
- **DB 3**: Background job queues (future use)

## Key Pattern Conventions

### General Format
```
{prefix}:{namespace}:{identifier}:{optional_suffix}
```

### Naming Rules
- Use lowercase letters
- Separate words with underscores within a segment
- Separate segments with colons
- Use meaningful, descriptive names
- Include version suffixes where applicable

## Key Patterns by Category

### 1. Session Keys (DB 0)

#### User Sessions
```
session:user:{user_id}:{session_id}
```
- **TTL**: 30 minutes (extends on activity)
- **Example**: `session:user:12345:a1b2c3d4e5f6`

#### Admin Sessions
```
session:admin:{admin_id}:{session_id}
```
- **TTL**: 2 hours (security requirement)
- **Example**: `session:admin:1:xyz789abc`

#### Session Metadata
```
session:meta:{session_id}
```
- **TTL**: Same as parent session
- **Example**: `session:meta:a1b2c3d4e5f6`

### 2. Cache Keys (DB 1)

#### User Profile Cache
```
cache:user:profile:{user_id}
```
- **TTL**: 1 hour
- **Example**: `cache:user:profile:12345`

#### Menu Cache
```
cache:menu:daily:{restaurant_id}:{date}
cache:menu:weekly:{restaurant_id}:{year}:{week}
```
- **TTL**: 1 hour for daily, 6 hours for weekly
- **Examples**: 
  - `cache:menu:daily:101:2024-01-09`
  - `cache:menu:weekly:101:2024:2`

#### Meal Cache
```
cache:meal:detail:{meal_id}
cache:meal:nutrition:{meal_id}
```
- **TTL**: 2 hours
- **Examples**: 
  - `cache:meal:detail:5678`
  - `cache:meal:nutrition:5678`

#### Order Cache
```
cache:order:user:{user_id}:recent
cache:order:detail:{order_id}
```
- **TTL**: 30 minutes
- **Examples**: 
  - `cache:order:user:12345:recent`
  - `cache:order:detail:98765`

#### Restaurant Cache
```
cache:restaurant:list:active
cache:restaurant:detail:{restaurant_id}
cache:restaurant:menu_categories:{restaurant_id}
```
- **TTL**: 6 hours for list, 2 hours for details
- **Examples**: 
  - `cache:restaurant:list:active`
  - `cache:restaurant:detail:101`
  - `cache:restaurant:menu_categories:101`

#### Allergen Cache
```
cache:allergen:list:all
cache:allergen:detail:{allergen_id}
```
- **TTL**: 24 hours
- **Examples**: 
  - `cache:allergen:list:all`
  - `cache:allergen:detail:3`

#### Statistics Cache
```
cache:stats:meal:popular:{restaurant_id}:{period}
cache:stats:order:summary:{restaurant_id}:{date}
```
- **TTL**: 1 hour
- **Examples**: 
  - `cache:stats:meal:popular:101:daily`
  - `cache:stats:order:summary:101:2024-01-09`

### 3. Rate Limiting Keys (DB 2)

#### API Rate Limits
```
ratelimit:api:{endpoint}:{identifier}:{window}
```
- **TTL**: Based on window (1min, 1hour, 1day)
- **Examples**: 
  - `ratelimit:api:login:ip:192.168.1.1:1min`
  - `ratelimit:api:order:user:12345:1hour`

#### Login Attempts
```
ratelimit:login:attempts:{email}
ratelimit:login:lockout:{email}
```
- **TTL**: 15 minutes for attempts, 30 minutes for lockout
- **Examples**: 
  - `ratelimit:login:attempts:user@example.com`
  - `ratelimit:login:lockout:user@example.com`

### 4. Background Job Queues (DB 3) - Future Use

#### Job Queue Keys
```
queue:job:{priority}:{job_type}
queue:job:processing:{job_id}
queue:job:failed:{job_id}
```
- **Examples**: 
  - `queue:job:high:email`
  - `queue:job:processing:job123`
  - `queue:job:failed:job456`

## Cache Invalidation Patterns

### Invalidation Groups
```
invalidate:group:{entity_type}:{entity_id}
```
- Used to track related cache keys for bulk invalidation
- **Example**: `invalidate:group:restaurant:101`

### Common Invalidation Scenarios

1. **User Profile Update**
   - Invalidate: `cache:user:profile:{user_id}`
   - Invalidate: `session:user:{user_id}:*`

2. **Menu Update**
   - Invalidate: `cache:menu:daily:{restaurant_id}:*`
   - Invalidate: `cache:menu:weekly:{restaurant_id}:*`
   - Invalidate: `cache:meal:detail:*` (for affected meals)

3. **Order Placement**
   - Invalidate: `cache:order:user:{user_id}:recent`
   - Update: `cache:stats:order:summary:{restaurant_id}:{date}`

## Best Practices

1. **Always use prefixes** to categorize keys
2. **Include identifiers** to make keys unique
3. **Set appropriate TTLs** based on data volatility
4. **Use Redis transactions** for multi-key operations
5. **Monitor key patterns** for performance optimization
6. **Document new patterns** when adding features

## Monitoring and Maintenance

### Key Metrics to Monitor
- Key count per database
- Memory usage per key pattern
- Hit/miss ratios
- Eviction rates
- TTL distribution

### Maintenance Tasks
- Regular analysis of unused patterns
- TTL optimization based on usage patterns
- Memory usage optimization
- Key pattern performance review