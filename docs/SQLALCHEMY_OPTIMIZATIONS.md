# SQLAlchemy Query Optimizations

This document describes the comprehensive SQLAlchemy optimizations implemented for the Jidelnicek 2.0 application.

## Overview

The optimizations focus on:
1. **Relationship configurations** with proper lazy loading strategies
2. **Cascade delete rules** for data integrity
3. **Query optimization utilities** for better performance
4. **N+1 query detection** and prevention
5. **Performance monitoring** and profiling
6. **Pagination helpers** for large datasets
7. **Caching strategies** for frequently accessed data

## Model Relationship Optimizations

### 1. Lazy Loading Strategies

All model relationships have been optimized with appropriate lazy loading strategies:

```python
# Before: Default dynamic loading
sessions: Mapped[List["AuthSession"]] = relationship(
    "AuthSession",
    back_populates="user",
    cascade="all, delete-orphan",
    lazy="dynamic"  # Creates additional queries
)

# After: Select loading with ordering
sessions: Mapped[List["AuthSession"]] = relationship(
    "AuthSession",
    back_populates="user",
    cascade="all, delete-orphan",
    lazy="select",
    order_by="AuthSession.created_at.desc()",
    passive_deletes=True
)
```

### 2. Cascade Delete Rules

Proper cascade rules ensure data integrity:

```python
# Cascade options used:
# - "all, delete-orphan": For one-to-many relationships
# - "save-update, merge": For many-to-many relationships
# - passive_deletes=True: For better performance with foreign keys
```

### 3. Back-references

All relationships have proper back-references for bidirectional navigation:

```python
# Recipe model
original_recipe: Mapped[Optional["Recipe"]] = relationship(
    "Recipe",
    remote_side=[id],
    back_populates="forks",
    lazy="select"
)

# Forks of this recipe
forks: Mapped[List["Recipe"]] = relationship(
    "Recipe",
    foreign_keys=[original_recipe_id],
    back_populates="original_recipe",
    lazy="select"
)
```

## Query Optimization Utilities

### 1. Query Helper Classes

#### QueryOptimizer
```python
from jidelnicek.core.query_helpers import QueryOptimizer

optimizer = QueryOptimizer()

# Create eager loading query
query = optimizer.create_eager_loading_query(
    model=Recipe,
    relationships=['ingredients', 'images'],
    session=session
)
```

#### PaginationHelper
```python
from jidelnicek.core.query_helpers import PaginationHelper

helper = PaginationHelper()

# Offset-based pagination
result = await helper.paginate(
    session=session,
    query=query,
    page=1,
    page_size=20
)

# Cursor-based pagination (for large datasets)
result = await helper.paginate_with_cursor(
    session=session,
    query=query,
    cursor_field='created_at',
    page_size=20
)
```

### 2. Base Service Classes

#### BaseService
Provides common CRUD operations with optimizations:

```python
from jidelnicek.core.services.base import BaseService

class MyService(BaseService):
    @property
    def model(self):
        return MyModel
    
    async def get_with_relationships(self, id: UUID):
        return await self.get_by_id(
            id,
            relationships=['related_model1', 'related_model2']
        )
```

#### SearchableService
Adds search capabilities:

```python
from jidelnicek.core.services.base import SearchableService

class MySearchableService(SearchableService):
    @property
    def model(self):
        return MyModel
    
    @property
    def search_fields(self):
        return ['name', 'description']
    
    async def search_items(self, query: str):
        return await self.search(query, page=1, page_size=20)
```

## Performance Monitoring

### 1. Query Profiling

```python
from jidelnicek.core.query_helpers import query_profiling_context

# Profile a section of code
with query_profiling_context() as profiler:
    recipes = await recipe_service.get_user_recipes(user_id)
    
# Get statistics
stats = profiler.get_stats()
print(f"Executed {stats['query_count']} queries in {stats['total_time']:.3f}s")
```

### 2. N+1 Query Detection

```python
from jidelnicek.core.query_helpers import QueryOptimizer

@QueryOptimizer.detect_n_plus_one
async def get_recipes_with_ingredients(recipe_ids: List[UUID]):
    # This will warn if N+1 pattern is detected
    recipes = []
    for recipe_id in recipe_ids:
        recipe = await get_recipe(recipe_id)
        # This would cause N+1 if not optimized
        ingredients = recipe.ingredients
        recipes.append(recipe)
    return recipes
```

### 3. Performance Monitoring Endpoints

Monitor database performance via API:

```
GET /monitoring/health - Overall health check
GET /monitoring/database/queries - Query statistics
GET /monitoring/database/slow-queries - Slow query analysis
GET /monitoring/database/n-plus-one - N+1 detection
GET /monitoring/database/recommendations - Optimization suggestions
```

## Optimized Query Patterns

### 1. Eager Loading for Related Data

```python
# Bad: Causes N+1 queries
recipes = await session.execute(select(Recipe))
for recipe in recipes.scalars():
    print(f"Recipe {recipe.name} has {len(recipe.ingredients)} ingredients")

# Good: Use eager loading
stmt = (
    select(Recipe)
    .options(selectinload(Recipe.ingredients))
    .where(Recipe.user_id == user_id)
)
recipes = await session.execute(stmt)
```

### 2. Batch Operations

```python
# Bad: Multiple round trips
for recipe_id in recipe_ids:
    recipe = await get_recipe(recipe_id)
    # Process recipe

# Good: Single query
recipes = await get_recipes_batch(recipe_ids)
for recipe in recipes:
    # Process recipe
```

### 3. Optimized Pagination

```python
# Bad: OFFSET becomes slow for large datasets
query = select(Recipe).offset(10000).limit(20)

# Good: Use cursor-based pagination
query = select(Recipe).where(Recipe.created_at > cursor_value).limit(20)
```

### 4. Efficient Counting

```python
# Bad: Loads all data for counting
total = len(await session.execute(select(Recipe)).scalars().all())

# Good: Use COUNT query
total = await session.execute(select(func.count(Recipe.id))).scalar()
```

## Service Layer Optimizations

### 1. Optimized Recipe Service

```python
from jidelnicek.recipe.services.optimized_recipe_service import OptimizedRecipeService

service = OptimizedRecipeService(session)

# Get recipe with all details in single query
recipe = await service.get_recipe_with_full_details(recipe_id, user_id)

# Batch operations
recipes = await service.get_recipes_with_ingredients_batch(recipe_ids)
nutrition_data = await service.get_nutrition_for_recipes_batch(recipe_ids)
```

### 2. Optimized User Service

```python
from jidelnicek.auth.services.optimized_user_service import OptimizedUserService

service = OptimizedUserService(session)

# Get user with active sessions
user = await service.get_user_with_sessions(user_id)

# Batch user statistics
user_stats = await service.get_users_with_stats_batch(user_ids)
```

## Caching Strategy

### 1. Query Result Caching

```python
from jidelnicek.core.query_helpers import cached_query

@cached_query(cache_key="popular_recipes", ttl=300)
async def get_popular_recipes():
    return await session.execute(
        select(Recipe)
        .where(Recipe.is_published == True)
        .order_by(Recipe.view_count.desc())
        .limit(10)
    )
```

### 2. Model Instance Caching

```python
# Use cacheable service
recipe = await service.get_cached(recipe_id, relationships=['ingredients'])

# Cache is automatically invalidated on updates
await service.update(recipe_id, update_data)  # Invalidates cache
```

## Database Connection Optimization

### 1. Connection Pool Configuration

```python
# In settings.py
db_pool_size: int = 20
db_pool_max_overflow: int = 0
db_pool_timeout: float = 30.0
db_pool_recycle: int = 3600  # Recycle connections after 1 hour
```

### 2. Connection Pool Monitoring

```python
from jidelnicek.core.monitoring import pool_monitor

# Monitor connection pool health
health = pool_monitor.get_pool_health()
print(f"Active connections: {health['events']['checkout']}")
```

## Index Optimization

### 1. Database Indexes

Key indexes for performance:

```sql
-- User lookups
CREATE INDEX idx_auth_users_email_lower ON auth_users (lower(email));
CREATE INDEX idx_auth_users_active ON auth_users (is_active) WHERE NOT is_archived;

-- Recipe searches
CREATE INDEX idx_recipes_user ON recipe_recipes (user_id) WHERE NOT is_archived;
CREATE INDEX idx_recipes_public ON recipe_recipes (is_published) WHERE is_published AND NOT is_archived;

-- Session management
CREATE INDEX idx_auth_sessions_user_valid ON auth_sessions (user_id, is_valid, expires_at);
CREATE INDEX idx_auth_sessions_token_hash ON auth_sessions (token_hash);
```

### 2. Composite Indexes

```sql
-- For complex queries
CREATE INDEX idx_recipes_search ON recipe_recipes (user_id, is_published, created_at) WHERE NOT is_archived;
```

## Best Practices

### 1. Query Design

- Use `select()` instead of `Query` for better performance
- Prefer `selectinload()` for collections, `joinedload()` for single relationships
- Use `contains_eager()` for complex joins
- Avoid `subqueryload()` unless necessary

### 2. Relationship Loading

```python
# Choose appropriate loading strategy
selectinload(Recipe.ingredients)    # For collections (1+N queries)
joinedload(Recipe.user)            # For single objects (1 query with JOIN)
raiseload(Recipe.images)           # Prevent accidental loading
```

### 3. Transaction Management

```python
# Use transactions for consistency
async with session.begin():
    # Multiple operations
    recipe = Recipe(...)
    session.add(recipe)
    
    for ingredient in ingredients:
        session.add(ingredient)
    
    # Commit automatically at end
```

### 4. Query Optimization

```python
# Use EXISTS for better performance
exists_query = select(Recipe.id).where(Recipe.user_id == user_id).exists()
user_has_recipes = await session.scalar(select(exists_query))

# Use CASE statements for conditional aggregation
recipe_stats = await session.execute(
    select(
        func.count(Recipe.id).label('total'),
        func.count(func.case((Recipe.is_published == True, 1))).label('published')
    )
    .where(Recipe.user_id == user_id)
)
```

## Monitoring and Debugging

### 1. Query Logging

Enable query logging in development:

```python
# In settings
db_echo: bool = True  # Log all SQL queries

# Or use profiling context
with query_profiling_context() as profiler:
    # Operations to profile
    pass
```

### 2. Performance Metrics

```python
# Get comprehensive performance data
from jidelnicek.core.monitoring import check_database_performance

health = await check_database_performance()
print(f"Database health: {health['healthy']}")
print(f"Average query time: {health['query_stats']['average_time']:.3f}s")
```

### 3. Query Analysis

```python
from jidelnicek.core.monitoring import QueryAnalyzer

analyzer = QueryAnalyzer()
analysis = analyzer.analyze_queries(query_list)

# Get optimization suggestions
suggestions = analyzer.suggest_eager_loading(query_list)
```

## Testing Optimizations

### 1. Performance Tests

```python
import pytest
from jidelnicek.core.query_helpers import query_profiling_context

@pytest.mark.asyncio
async def test_recipe_list_performance():
    with query_profiling_context() as profiler:
        recipes = await recipe_service.get_user_recipes(user_id)
    
    stats = profiler.get_stats()
    assert stats['query_count'] <= 5  # Should not exceed 5 queries
    assert stats['total_time'] <= 1.0  # Should complete within 1 second
```

### 2. N+1 Detection Tests

```python
@pytest.mark.asyncio
async def test_no_n_plus_one_in_recipe_list():
    with query_profiling_context() as profiler:
        recipes = await recipe_service.get_user_recipes_with_ingredients(user_id)
    
    # Should not have N+1 pattern
    n_plus_one = profiler.detect_n_plus_one(threshold=10)
    assert len(n_plus_one) == 0
```

## Migration Guide

### 1. Updating Existing Services

```python
# Before: Basic service
class RecipeService:
    def __init__(self, session):
        self.session = session

# After: Optimized service
class OptimizedRecipeService(SearchableService, CacheableService):
    @property
    def model(self):
        return Recipe
    
    @property
    def search_fields(self):
        return ['name', 'description']
```

### 2. Updating Query Patterns

```python
# Before: Basic query
recipes = await session.execute(select(Recipe))

# After: Optimized query with eager loading
recipes = await session.execute(
    select(Recipe)
    .options(selectinload(Recipe.ingredients))
    .where(Recipe.is_archived == False)
)
```

## Conclusion

These optimizations provide:

1. **Reduced database load** through efficient queries
2. **Better performance** via eager loading and caching
3. **Monitoring capabilities** for ongoing optimization
4. **Scalability** through proper pagination and indexing
5. **Maintainability** through consistent patterns

The optimizations are designed to be:
- **Backward compatible** with existing code
- **Incrementally adoptable** 
- **Well-documented** for team understanding
- **Thoroughly tested** for reliability

Regular monitoring and profiling will help maintain optimal performance as the application grows.