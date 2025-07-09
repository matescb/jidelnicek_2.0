# Jidelnicek 2.0 Database Schema Documentation

## Overview

Jidelnicek 2.0 uses PostgreSQL as its primary database with SQLAlchemy ORM for database interactions. The schema is designed with performance, scalability, and data integrity in mind.

## Entity Relationship Diagram

```mermaid
erDiagram
    AuthUser ||--o{ AuthSession : has
    AuthUser ||--o{ AuthToken : has
    AuthUser ||--o{ AuthPasswordResetToken : has
    AuthUser ||--o{ AuthEmailVerificationToken : has
    AuthUser ||--o{ Recipe : creates
    AuthUser ||--o{ AuditLog : generates
    
    Recipe ||--o{ RecipeIngredient : contains
    Recipe ||--o{ RecipeImage : has
    Recipe ||--o{ RecipeCategory : belongs_to
    Recipe ||--o{ RecipeTag : has
    Recipe ||--o{ RecipeVersion : tracks
    Recipe ||--o{ Recipe : forks_from
    
    Ingredient ||--o{ RecipeIngredient : used_in
    Ingredient ||--|| NutritionalValue : has
    
    RecipeIngredient }o--|| Recipe : belongs_to
    RecipeIngredient }o--|| Ingredient : uses
    
    Category ||--o{ RecipeCategory : categorizes
    Tag ||--o{ RecipeTag : tags
    
    Snack ||--|| NutritionalValue : has
    
    NutritionalValue ||--o{ Ingredient : provides_data
    NutritionalValue ||--o{ Snack : provides_data
```

## Table Definitions

### Authentication Module

#### auth_users
Primary user table with comprehensive security features.

| Column | Type | Constraints | Description | Index |
|--------|------|-------------|-------------|-------|
| id | UUID | PRIMARY KEY | Unique user identifier | ✓ |
| email | VARCHAR(255) | UNIQUE, NOT NULL | User email (lowercase) | ✓ |
| password_hash | VARCHAR(255) | | Bcrypt password hash | |
| email_verified | BOOLEAN | NOT NULL, DEFAULT false | Email verification status | |
| email_verified_at | TIMESTAMP | | Verification timestamp | |
| is_active | BOOLEAN | NOT NULL, DEFAULT true | Account active status | |
| failed_login_attempts | INTEGER | NOT NULL, DEFAULT 0 | Failed login counter | |
| locked_until | TIMESTAMP | | Account lockout expiry | |
| last_login | TIMESTAMP | | Last successful login | |
| language | VARCHAR(2) | NOT NULL, DEFAULT 'cs' | UI language (en/cs) | |
| unit_system | VARCHAR(10) | NOT NULL, DEFAULT 'metric' | metric/imperial | |
| energy_unit | VARCHAR(10) | NOT NULL, DEFAULT 'kcal' | kcal/kJ | |
| has_pku | BOOLEAN | NOT NULL, DEFAULT false | PKU diet flag | |
| timezone | VARCHAR(50) | NOT NULL, DEFAULT 'Europe/Prague' | User timezone | |
| role | VARCHAR(20) | NOT NULL, DEFAULT 'user' | user/admin | |
| is_archived | BOOLEAN | NOT NULL, DEFAULT false | Soft delete flag | ✓ |
| recipe_count | INTEGER | NOT NULL, DEFAULT 0 | Recipe counter | |
| trip_count | INTEGER | NOT NULL, DEFAULT 0 | Trip counter | |
| created_at | TIMESTAMP | NOT NULL | Creation timestamp | |
| updated_at | TIMESTAMP | NOT NULL | Last update timestamp | |

**Indexes:**
- Primary: `id`
- Unique: `email`
- Functional: `lower(email)` for case-insensitive lookups
- Bitmap: `is_archived`

**Check Constraints:**
- `language IN ('en', 'cs')`
- `unit_system IN ('metric', 'imperial')`
- `energy_unit IN ('kcal', 'kJ')`
- `role IN ('user', 'admin')`

#### auth_sessions
JWT refresh token storage with session fingerprinting.

| Column | Type | Constraints | Description | Index |
|--------|------|-------------|-------------|-------|
| id | UUID | PRIMARY KEY | Session identifier | ✓ |
| user_id | UUID | NOT NULL, FK(auth_users) | User reference | ✓ |
| token_hash | VARCHAR(255) | UNIQUE, NOT NULL | Hashed refresh token | ✓ |
| expires_at | TIMESTAMP | NOT NULL | Session expiry | ✓ |
| ip_address | VARCHAR(45) | | Client IP (IPv4/IPv6) | |
| user_agent | VARCHAR(500) | | Client user agent | |
| device_name | VARCHAR(255) | | Parsed device name | |
| device_type | VARCHAR(50) | | desktop/mobile/tablet | |
| browser | VARCHAR(100) | | Browser name | |
| os | VARCHAR(100) | | Operating system | |
| location | VARCHAR(255) | | Geolocation (City, Country) | |
| is_valid | BOOLEAN | NOT NULL, DEFAULT true | Session validity | |
| created_at | TIMESTAMP | NOT NULL | Creation timestamp | |
| last_accessed | TIMESTAMP | NOT NULL | Last activity | |

**Indexes:**
- Primary: `id`
- Foreign Key: `user_id`
- Unique: `token_hash`
- Bitmap: `expires_at` for cleanup queries

#### audit_log
Security and compliance audit trail.

| Column | Type | Constraints | Description | Index |
|--------|------|-------------|-------------|-------|
| id | UUID | PRIMARY KEY | Log entry identifier | ✓ |
| user_id | UUID | FK(auth_users), NULL OK | User reference | ✓ |
| action | VARCHAR(50) | NOT NULL | Action type | ✓ |
| entity_type | VARCHAR(50) | NOT NULL | Entity type | ✓ |
| entity_id | UUID | NOT NULL | Entity identifier | ✓ |
| changes | JSONB | | Change details | |
| ip_address | VARCHAR(45) | | Client IP | |
| user_agent | VARCHAR(500) | | Client user agent | |
| created_at | TIMESTAMP | NOT NULL | Event timestamp | ✓ |

**Indexes:**
- Primary: `id`
- Composite: `(user_id, created_at)`
- Composite: `(action, created_at)`
- Composite: `(entity_type, entity_id)`

### Recipe Module

#### recipe_recipes
Main recipe table with publishing and forking support.

| Column | Type | Constraints | Description | Index |
|--------|------|-------------|-------------|-------|
| id | UUID | PRIMARY KEY | Recipe identifier | ✓ |
| user_id | UUID | NOT NULL, FK(auth_users) | Recipe owner | ✓ |
| name | VARCHAR(100) | NOT NULL | Recipe name | ✓ |
| description | TEXT | | Recipe description | |
| instructions | TEXT | | Cooking instructions | |
| difficulty_level | VARCHAR(20) | | easy/medium/hard | |
| view_count | INTEGER | NOT NULL, DEFAULT 0 | View counter | |
| rating_average | NUMERIC(3,2) | | Average rating (0-5) | |
| rating_count | INTEGER | NOT NULL, DEFAULT 0 | Number of ratings | |
| prep_time_minutes | INTEGER | | Preparation time | |
| cook_time_minutes | INTEGER | | Cooking time | |
| water_ml | INTEGER | NOT NULL, DEFAULT 0 | Water needed (camping) | |
| servings | INTEGER | NOT NULL, DEFAULT 1 | Number of servings | |
| is_public | BOOLEAN | NOT NULL, DEFAULT false | Public visibility | |
| is_published | BOOLEAN | NOT NULL, DEFAULT false | Published status | ✓ |
| published_at | TIMESTAMP | | Publication timestamp | |
| fork_count | INTEGER | NOT NULL, DEFAULT 0 | Fork counter | |
| original_recipe_id | UUID | FK(recipe_recipes) | Fork source | ✓ |
| is_archived | BOOLEAN | NOT NULL, DEFAULT false | Soft delete | ✓ |
| current_version | INTEGER | NOT NULL, DEFAULT 1 | Version number | |
| created_at | TIMESTAMP | NOT NULL | Creation timestamp | |
| updated_at | TIMESTAMP | NOT NULL | Last update | |

**Indexes:**
- Primary: `id`
- Composite: `(user_id)` WHERE `NOT is_archived`
- Bitmap: `is_published` WHERE `is_published AND NOT is_archived`
- Foreign Key: `original_recipe_id`
- Full-text: `name` and `description` (PostgreSQL GIN)

**Check Constraints:**
- `LENGTH(instructions) <= 2000`
- `NOT is_published OR fork_count <= 5` (unpublish protection)
- `servings > 0`
- `water_ml >= 0`
- `current_version > 0`

#### recipe_ingredients
Ingredient master data with nutritional information.

| Column | Type | Constraints | Description | Index |
|--------|------|-------------|-------------|-------|
| id | UUID | PRIMARY KEY | Ingredient identifier | ✓ |
| name | VARCHAR(200) | NOT NULL | Ingredient name | ✓ |
| brand | VARCHAR(100) | | Brand name | |
| barcode | VARCHAR(50) | | EAN/UPC barcode | ✓ |
| nutritional_data | JSONB | NOT NULL | Nutrition per 100g | |
| unit_conversions | JSONB | NOT NULL | Unit conversion factors | |
| allergens | JSONB | | Allergen list | |
| dietary_flags | JSONB | NOT NULL | Dietary properties | |
| created_at | TIMESTAMP | NOT NULL | Creation timestamp | |
| updated_at | TIMESTAMP | NOT NULL | Last update | |

**Indexes:**
- Primary: `id`
- B-tree: `name` with pg_trgm for similarity search
- B-tree: `barcode` for barcode lookups
- GIN: `nutritional_data` for JSON queries
- GIN: `allergens` for allergen filtering

#### recipe_recipe_ingredients
Junction table linking recipes to ingredients.

| Column | Type | Constraints | Description | Index |
|--------|------|-------------|-------------|-------|
| id | UUID | PRIMARY KEY | Link identifier | ✓ |
| recipe_id | UUID | NOT NULL, FK(recipe_recipes) | Recipe reference | ✓ |
| ingredient_id | UUID | NOT NULL, FK(recipe_ingredients) | Ingredient reference | ✓ |
| quantity | NUMERIC(10,3) | NOT NULL | Amount | |
| unit | VARCHAR(10) | NOT NULL, DEFAULT 'g' | Unit of measure | |
| preparation_notes | VARCHAR(200) | | Prep instructions | |
| is_optional | BOOLEAN | NOT NULL, DEFAULT false | Optional flag | |
| display_order | INTEGER | NOT NULL, DEFAULT 0 | Display position | |

**Indexes:**
- Primary: `id`
- Unique: `(recipe_id, ingredient_id)`
- Foreign Key: `recipe_id`
- Foreign Key: `ingredient_id`

**Check Constraints:**
- `quantity > 0`
- `unit IN ('g', 'kg', 'ml', 'l', 'cup', 'tbsp', 'tsp', 'piece')`

### Common Module

#### common_nutritional_values
Comprehensive nutritional data storage.

| Column | Type | Constraints | Description | Index |
|--------|------|-------------|-------------|-------|
| id | UUID | PRIMARY KEY | Nutrition data ID | ✓ |
| calories | NUMERIC(10,2) | NOT NULL | Calories per 100g | |
| proteins_g | NUMERIC(10,2) | NOT NULL | Protein content | |
| carbohydrates_g | NUMERIC(10,2) | NOT NULL | Carbohydrate content | |
| fats_g | NUMERIC(10,2) | NOT NULL | Fat content | |
| sugars_g | NUMERIC(10,2) | | Sugar content | |
| saturated_fats_g | NUMERIC(10,2) | | Saturated fats | |
| fiber_g | NUMERIC(10,2) | | Dietary fiber | |
| sodium_mg | NUMERIC(10,2) | | Sodium content | |
| phe_mg | NUMERIC(10,2) | | Phenylalanine (PKU) | |
| ... | ... | | (Additional vitamins) | |

## Performance Optimizations

### Indexing Strategy

1. **Primary Key Indexes**
   - All tables use UUID primary keys with B-tree indexes
   - UUIDs generated server-side using `gen_random_uuid()`

2. **Foreign Key Indexes**
   - All foreign key columns are indexed for JOIN performance
   - Cascade deletes configured where appropriate

3. **Query-Specific Indexes**
   - Email lookups: Functional index on `lower(email)`
   - Recipe search: GIN index on name and description
   - Time-based queries: B-tree indexes on timestamp columns
   - Soft deletes: Partial indexes excluding archived records

4. **Composite Indexes**
   - `(user_id, is_archived)` for user content queries
   - `(entity_type, entity_id)` for audit log lookups
   - `(action, created_at)` for audit log filtering

### Query Optimization Best Practices

1. **Avoiding N+1 Queries**
   ```python
   # Bad: N+1 queries
   recipes = session.query(Recipe).all()
   for recipe in recipes:
       print(recipe.ingredients)  # Triggers query per recipe
   
   # Good: Eager loading
   recipes = session.query(Recipe)\
       .options(selectinload(Recipe.ingredients))\
       .all()
   ```

2. **Efficient Pagination**
   ```python
   # Use LIMIT/OFFSET with ordering
   recipes = session.query(Recipe)\
       .order_by(Recipe.created_at.desc())\
       .offset(page * page_size)\
       .limit(page_size)\
       .all()
   ```

3. **Bulk Operations**
   ```python
   # Bulk insert
   session.bulk_insert_mappings(Recipe, recipe_data)
   
   # Bulk update
   session.bulk_update_mappings(Recipe, updated_data)
   ```

4. **Aggregate Queries**
   ```python
   # Use database aggregation
   from sqlalchemy import func
   
   avg_rating = session.query(func.avg(Recipe.rating_average))\
       .filter(Recipe.is_published == True)\
       .scalar()
   ```

### Connection Pool Configuration

```python
from sqlalchemy import create_engine
from sqlalchemy.pool import QueuePool

engine = create_engine(
    DATABASE_URL,
    poolclass=QueuePool,
    pool_size=20,          # Number of persistent connections
    max_overflow=40,       # Maximum overflow connections
    pool_timeout=30,       # Timeout for getting connection
    pool_recycle=3600,     # Recycle connections after 1 hour
    pool_pre_ping=True,    # Test connections before use
)
```

### Database-Level Optimizations

1. **PostgreSQL Configuration**
   ```sql
   -- Shared buffers (25% of RAM)
   shared_buffers = 4GB
   
   -- Work memory for sorts
   work_mem = 16MB
   
   -- Maintenance work memory
   maintenance_work_mem = 512MB
   
   -- Effective cache size (50-75% of RAM)
   effective_cache_size = 12GB
   ```

2. **Vacuum and Analyze**
   ```sql
   -- Regular maintenance
   VACUUM ANALYZE recipe_recipes;
   
   -- Update statistics
   ANALYZE;
   ```

3. **Query Planning**
   ```sql
   -- Analyze query performance
   EXPLAIN (ANALYZE, BUFFERS) 
   SELECT * FROM recipe_recipes 
   WHERE user_id = ? AND is_archived = false;
   ```

## Data Integrity

### Constraints

1. **Check Constraints**
   - Enum validations (language, unit_system, role)
   - Positive numbers (servings, quantities)
   - Text length limits (instructions)

2. **Unique Constraints**
   - User emails (case-insensitive)
   - Session tokens
   - Recipe-ingredient combinations

3. **Foreign Key Constraints**
   - CASCADE DELETE for dependent records
   - SET NULL for audit logs
   - RESTRICT for critical relationships

### Data Validation

1. **Application-Level Validation**
   ```python
   @validates('email')
   def validate_email(self, key, email):
       return email.lower() if email else email
   
   @validates('quantity')
   def validate_quantity(self, key, quantity):
       if quantity <= 0:
           raise ValueError("Quantity must be positive")
       return quantity
   ```

2. **Database-Level Defaults**
   - Timestamps: `server_default=text('now()')`
   - Counters: `server_default='0'`
   - Booleans: `server_default=text('false')`

## Migration Strategy

### Alembic Configuration

```python
# alembic.ini
[alembic]
script_location = migrations
sqlalchemy.url = postgresql://user:pass@localhost/jidelnicek

# migrations/env.py
from jidelnicek.core.database import Base
target_metadata = Base.metadata
```

### Migration Best Practices

1. **Non-Breaking Changes**
   - Add nullable columns
   - Create indexes CONCURRENTLY
   - Add tables without foreign keys first

2. **Data Migrations**
   ```python
   # In migration file
   def upgrade():
       # Schema change
       op.add_column('recipe_recipes', 
           sa.Column('difficulty_level', sa.String(20)))
       
       # Data migration
       connection = op.get_bind()
       connection.execute(
           "UPDATE recipe_recipes SET difficulty_level = 'medium' "
           "WHERE prep_time_minutes + cook_time_minutes > 60"
       )
   ```

3. **Rollback Safety**
   - Always provide downgrade functions
   - Test rollbacks in staging
   - Backup before major migrations

## Monitoring and Maintenance

### Performance Monitoring

1. **Query Performance**
   ```sql
   -- Enable query statistics
   CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
   
   -- View slow queries
   SELECT query, mean_exec_time, calls
   FROM pg_stat_statements
   ORDER BY mean_exec_time DESC
   LIMIT 10;
   ```

2. **Index Usage**
   ```sql
   -- Check index usage
   SELECT schemaname, tablename, indexname, idx_scan
   FROM pg_stat_user_indexes
   ORDER BY idx_scan;
   ```

3. **Table Statistics**
   ```sql
   -- Table sizes and activity
   SELECT 
       schemaname,
       tablename,
       pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
       n_live_tup as row_count
   FROM pg_stat_user_tables
   ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
   ```

### Regular Maintenance Tasks

1. **Daily**
   - Monitor slow query log
   - Check connection pool usage
   - Verify backup completion

2. **Weekly**
   - VACUUM ANALYZE critical tables
   - Review index usage statistics
   - Check for table bloat

3. **Monthly**
   - Full database VACUUM
   - Update table statistics
   - Review and optimize slow queries
   - Archive old audit logs

## Security Considerations

1. **Data Encryption**
   - Passwords: Bcrypt with cost factor 12
   - Tokens: SHA-256 hashing
   - Sensitive data: Application-level encryption

2. **Access Control**
   - Row-level security for multi-tenant data
   - Column-level permissions for sensitive fields
   - Prepared statements to prevent SQL injection

3. **Audit Trail**
   - All authentication events logged
   - Data modifications tracked
   - IP addresses and user agents recorded

## Scalability Considerations

1. **Horizontal Scaling**
   - Read replicas for query distribution
   - Connection pooling with pgBouncer
   - Caching layer with Redis

2. **Vertical Scaling**
   - Index optimization
   - Query optimization
   - Hardware upgrades

3. **Partitioning Strategy**
   - Time-based partitioning for audit logs
   - User-based partitioning for large tables
   - Archival strategy for old data