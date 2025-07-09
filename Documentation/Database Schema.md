# Jídelníček Database Schema

## Overview

This document describes the PostgreSQL database schema for the Jídelníček application. The schema uses a **single public schema** with table name prefixes for logical organization, making it simple to deploy and maintain for a solo developer.

## Design Principles

- **Single Schema**: All tables in the `public` schema with logical prefixes (`auth_`, `recipe_`, `trip_`, etc.)
- **Proper Foreign Keys**: All relationships enforced with foreign key constraints
- **Archive Pattern**: Use `is_archived` boolean instead of soft deletes for "trash bin" functionality
- **Simple Audit**: Basic audit logging with JSONB for flexibility
- **No Complexity**: No event sourcing, CQRS, or complex versioning

## Table Structure

### Authentication Module (auth_*)

```sql
-- Users table
CREATE TABLE auth_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    email_verified BOOLEAN DEFAULT FALSE,
    verification_token VARCHAR(255),
    reset_token VARCHAR(255),
    reset_token_expires TIMESTAMP,
    
    -- User preferences
    language VARCHAR(2) DEFAULT 'en' CHECK (language IN ('en', 'cs')),
    unit_system VARCHAR(10) DEFAULT 'metric' CHECK (unit_system IN ('metric', 'imperial')),
    energy_unit VARCHAR(10) DEFAULT 'kcal' CHECK (energy_unit IN ('kcal', 'kJ')),
    has_pku BOOLEAN DEFAULT FALSE,
    timezone VARCHAR(50) DEFAULT 'UTC',
    
    -- Account management
    role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    is_archived BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    last_login TIMESTAMP,
    
    -- Account limits
    recipe_count INTEGER DEFAULT 0,
    trip_count INTEGER DEFAULT 0
);

-- OAuth providers (for future social login)
CREATE TABLE auth_oauth_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL,
    provider_account_id VARCHAR(255) NOT NULL,
    access_token TEXT,
    refresh_token TEXT,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(provider, provider_account_id)
);

-- Indexes
CREATE INDEX idx_auth_users_email ON auth_users(email);
CREATE INDEX idx_auth_users_archived ON auth_users(is_archived);
CREATE INDEX idx_auth_oauth_provider ON auth_oauth_accounts(provider, provider_account_id);
```

### Common Module (common_*)

```sql
-- Nutritional values (per 100g)
CREATE TABLE common_nutritional_values (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Required macros
    calories DECIMAL(10,2) NOT NULL,
    proteins_g DECIMAL(10,2) NOT NULL,
    carbohydrates_g DECIMAL(10,2) NOT NULL,
    fats_g DECIMAL(10,2) NOT NULL,
    
    -- Optional detailed breakdown
    sugars_g DECIMAL(10,2),
    saturated_fats_g DECIMAL(10,2),
    trans_fats_g DECIMAL(10,2),
    monounsaturated_fats_g DECIMAL(10,2),
    polyunsaturated_fats_g DECIMAL(10,2),
    cholesterol_mg DECIMAL(10,2),
    fiber_g DECIMAL(10,2),
    salt_g DECIMAL(10,2),
    calcium_mg DECIMAL(10,2),
    sodium_mg DECIMAL(10,2),
    water_g DECIMAL(10,2),
    phe_mg DECIMAL(10,2), -- For PKU tracking
    
    -- Vitamins (all optional)
    vitamin_a_ug DECIMAL(10,2),
    vitamin_b1_mg DECIMAL(10,2),
    vitamin_b2_mg DECIMAL(10,2),
    vitamin_b3_mg DECIMAL(10,2),
    vitamin_b5_mg DECIMAL(10,2),
    vitamin_b6_mg DECIMAL(10,2),
    vitamin_b7_ug DECIMAL(10,2),
    vitamin_b9_ug DECIMAL(10,2),
    vitamin_b12_ug DECIMAL(10,2),
    vitamin_c_mg DECIMAL(10,2),
    vitamin_d_ug DECIMAL(10,2),
    vitamin_e_mg DECIMAL(10,2),
    vitamin_k_ug DECIMAL(10,2)
);

-- Ingredients table
CREATE TABLE common_ingredients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth_users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    category VARCHAR(50),
    nutritional_value_id UUID REFERENCES common_nutritional_values(id),
    is_global BOOLEAN DEFAULT FALSE,
    is_archived BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(user_id, name)
);

-- Snacks (separate from ingredients)
CREATE TABLE common_snacks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    measurement_type VARCHAR(20) CHECK (measurement_type IN ('piece', 'per_100g')),
    piece_weight_g DECIMAL(10,2), -- If measured by piece
    nutritional_value_id UUID REFERENCES common_nutritional_values(id),
    is_global BOOLEAN DEFAULT FALSE,
    is_archived BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(user_id, name)
);

-- Indexes
CREATE INDEX idx_ingredients_user ON common_ingredients(user_id) WHERE NOT is_archived;
CREATE INDEX idx_ingredients_global ON common_ingredients(is_global) WHERE is_global AND NOT is_archived;
CREATE INDEX idx_snacks_user ON common_snacks(user_id) WHERE NOT is_archived;
```

### Recipe Module (recipe_*)

```sql
-- Recipes table
CREATE TABLE recipe_recipes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    instructions TEXT CHECK (LENGTH(instructions) <= 2000),
    
    -- Recipe metadata
    prep_time_minutes INTEGER,
    cook_time_minutes INTEGER,
    water_ml INTEGER DEFAULT 0,
    servings INTEGER DEFAULT 1,
    
    -- Publishing
    is_public BOOLEAN DEFAULT FALSE,
    is_published BOOLEAN DEFAULT FALSE,
    published_at TIMESTAMP,
    fork_count INTEGER DEFAULT 0,
    original_recipe_id UUID REFERENCES recipe_recipes(id),
    
    -- Tracking
    is_archived BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    -- Fork protection constraint
    CONSTRAINT unpublish_protection CHECK (
        NOT is_published OR fork_count <= 5 OR fork_count IS NULL
    )
);

-- Recipe ingredients
CREATE TABLE recipe_ingredients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipe_id UUID NOT NULL REFERENCES recipe_recipes(id) ON DELETE CASCADE,
    ingredient_id UUID NOT NULL REFERENCES common_ingredients(id),
    quantity_g DECIMAL(10,1) NOT NULL CHECK (quantity_g > 0),
    display_order INTEGER DEFAULT 0,
    
    UNIQUE(recipe_id, ingredient_id)
);

-- Recipe images
CREATE TABLE recipe_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipe_id UUID NOT NULL REFERENCES recipe_recipes(id) ON DELETE CASCADE,
    image_url VARCHAR(500) NOT NULL,
    display_order INTEGER NOT NULL DEFAULT 0,
    caption VARCHAR(200),
    created_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(recipe_id, display_order)
);

-- Recipe ratings
CREATE TABLE recipe_ratings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipe_id UUID NOT NULL REFERENCES recipe_recipes(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(recipe_id, user_id)
);

-- Recipe reviews
CREATE TABLE recipe_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipe_id UUID NOT NULL REFERENCES recipe_recipes(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
    review_text TEXT NOT NULL CHECK (LENGTH(review_text) <= 1000),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(recipe_id, user_id)
);

-- Recipe forks tracking
CREATE TABLE recipe_forks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    original_recipe_id UUID NOT NULL REFERENCES recipe_recipes(id),
    forked_recipe_id UUID NOT NULL REFERENCES recipe_recipes(id),
    forked_by UUID NOT NULL REFERENCES auth_users(id),
    forked_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(forked_recipe_id)
);

-- Indexes
CREATE INDEX idx_recipes_user ON recipe_recipes(user_id) WHERE NOT is_archived;
CREATE INDEX idx_recipes_public ON recipe_recipes(is_published) WHERE is_published AND NOT is_archived;
CREATE INDEX idx_recipes_original ON recipe_recipes(original_recipe_id);
CREATE INDEX idx_recipe_ingredients_recipe ON recipe_ingredients(recipe_id);
CREATE INDEX idx_recipe_ratings_recipe ON recipe_ratings(recipe_id);
CREATE INDEX idx_recipe_reviews_recipe ON recipe_reviews(recipe_id);
```

### Trip Module (trip_*)

```sql
-- Trips table
CREATE TABLE trip_trips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    
    -- Configuration
    meal_slots JSONB DEFAULT '["Breakfast", "Lunch", "Dinner"]',
    
    -- Trip metadata
    is_archived BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    CHECK (end_date >= start_date)
);

-- Trip participants
CREATE TABLE trip_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id UUID NOT NULL REFERENCES trip_trips(id) ON DELETE CASCADE,
    name VARCHAR(100),
    number INTEGER,
    coefficient DECIMAL(5,2) DEFAULT 100.00 CHECK (coefficient > 0),
    
    CHECK ((name IS NOT NULL) OR (number IS NOT NULL))
);

-- Trip days
CREATE TABLE trip_days (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id UUID NOT NULL REFERENCES trip_trips(id) ON DELETE CASCADE,
    day_number INTEGER NOT NULL,
    date DATE NOT NULL,
    notes TEXT,
    
    UNIQUE(trip_id, day_number)
);

-- Recipe snapshots (for trip storage)
CREATE TABLE trip_recipe_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    original_recipe_id UUID REFERENCES recipe_recipes(id),
    
    -- Complete recipe data snapshot
    recipe_data JSONB NOT NULL, -- Full recipe with ingredients
    nutritional_data JSONB NOT NULL, -- Calculated nutritional values
    
    created_at TIMESTAMP DEFAULT NOW()
);

-- Meals (scaled recipes)
CREATE TABLE trip_meals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_day_id UUID NOT NULL REFERENCES trip_days(id) ON DELETE CASCADE,
    meal_slot VARCHAR(50) NOT NULL,
    recipe_snapshot_id UUID REFERENCES trip_recipe_snapshots(id),
    target_calories_per_person DECIMAL(10,2),
    scaling_factor DECIMAL(10,4) DEFAULT 1.0000,
    
    -- Ratings and notes
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    notes TEXT,
    
    UNIQUE(trip_day_id, meal_slot)
);

-- Day snacks
CREATE TABLE trip_day_snacks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_day_id UUID NOT NULL REFERENCES trip_days(id) ON DELETE CASCADE,
    snack_id UUID NOT NULL REFERENCES common_snacks(id),
    quantity_per_person DECIMAL(10,2) NOT NULL,
    total_quantity DECIMAL(10,2) NOT NULL
);

-- Day drinks
CREATE TABLE trip_day_drinks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_day_id UUID NOT NULL REFERENCES trip_days(id) ON DELETE CASCADE,
    ingredient_id UUID NOT NULL REFERENCES common_ingredients(id),
    quantity_per_person DECIMAL(10,2) NOT NULL,
    total_quantity DECIMAL(10,2) NOT NULL,
    water_ml INTEGER DEFAULT 0
);

-- Camping stoves
CREATE TABLE trip_stoves (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id UUID NOT NULL REFERENCES trip_trips(id) ON DELETE CASCADE,
    name VARCHAR(100),
    efficiency_g_per_liter DECIMAL(10,2) NOT NULL,
    altitude_adjustment_percent DECIMAL(5,2) DEFAULT 0,
    
    UNIQUE(trip_id)
);

-- Trip templates
CREATE TABLE trip_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    template_data JSONB NOT NULL, -- Stores meal slots, recipes, snacks
    is_day_template BOOLEAN DEFAULT FALSE,
    is_archived BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_trips_user ON trip_trips(user_id) WHERE NOT is_archived;
CREATE INDEX idx_trips_dates ON trip_trips(start_date, end_date) WHERE NOT is_archived;
CREATE INDEX idx_trip_days_trip ON trip_days(trip_id);
CREATE INDEX idx_trip_meals_day ON trip_meals(trip_day_id);
CREATE INDEX idx_trip_templates_user ON trip_templates(user_id) WHERE NOT is_archived;
```

### Sharing Module (sharing_*)

```sql
-- Shareable links
CREATE TABLE sharing_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type VARCHAR(20) CHECK (entity_type IN ('recipe', 'trip')),
    entity_id UUID NOT NULL,
    share_token VARCHAR(255) UNIQUE NOT NULL,
    created_by UUID NOT NULL REFERENCES auth_users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP,
    view_count INTEGER DEFAULT 0,
    
    -- Add constraint to ensure entity exists
    CONSTRAINT check_entity_exists CHECK (
        (entity_type = 'recipe' AND EXISTS (SELECT 1 FROM recipe_recipes WHERE id = entity_id)) OR
        (entity_type = 'trip' AND EXISTS (SELECT 1 FROM trip_trips WHERE id = entity_id))
    )
);

-- Indexes
CREATE INDEX idx_sharing_links_token ON sharing_links(share_token);
CREATE INDEX idx_sharing_links_entity ON sharing_links(entity_type, entity_id);
```

### Audit Module (audit_*)

```sql
-- Simple audit log
CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth_users(id),
    action VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    changes JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_audit_log_user ON audit_log(user_id);
CREATE INDEX idx_audit_log_entity ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_log_created ON audit_log(created_at);

-- Partition by month for performance (optional, for future)
-- CREATE TABLE audit_log_2024_01 PARTITION OF audit_log
-- FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
```

## Database Functions & Triggers

### User Limits

```sql
-- Check recipe limit (500 per user)
CREATE OR REPLACE FUNCTION check_recipe_limit()
RETURNS TRIGGER AS $$
BEGIN
    IF (SELECT recipe_count FROM auth_users WHERE id = NEW.user_id) >= 500 THEN
        RAISE EXCEPTION 'Maximum 500 recipes per user';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER recipe_limit_check
BEFORE INSERT ON recipe_recipes
FOR EACH ROW EXECUTE FUNCTION check_recipe_limit();

-- Update recipe count
CREATE OR REPLACE FUNCTION update_recipe_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE auth_users SET recipe_count = recipe_count + 1 WHERE id = NEW.user_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE auth_users SET recipe_count = recipe_count - 1 WHERE id = OLD.user_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER recipe_count_update
AFTER INSERT OR DELETE ON recipe_recipes
FOR EACH ROW EXECUTE FUNCTION update_recipe_count();

-- Check trip limit (100 per user)
CREATE OR REPLACE FUNCTION check_trip_limit()
RETURNS TRIGGER AS $$
BEGIN
    IF (SELECT trip_count FROM auth_users WHERE id = NEW.user_id) >= 100 THEN
        RAISE EXCEPTION 'Maximum 100 trips per user';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trip_limit_check
BEFORE INSERT ON trip_trips
FOR EACH ROW EXECUTE FUNCTION check_trip_limit();

-- Update trip count
CREATE OR REPLACE FUNCTION update_trip_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE auth_users SET trip_count = trip_count + 1 WHERE id = NEW.user_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE auth_users SET trip_count = trip_count - 1 WHERE id = OLD.user_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trip_count_update
AFTER INSERT OR DELETE ON trip_trips
FOR EACH ROW EXECUTE FUNCTION update_trip_count();

-- Check participant limit (20 per trip)
CREATE OR REPLACE FUNCTION check_participant_limit()
RETURNS TRIGGER AS $$
BEGIN
    IF (SELECT COUNT(*) FROM trip_participants WHERE trip_id = NEW.trip_id) >= 20 THEN
        RAISE EXCEPTION 'Maximum 20 participants per trip';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER participant_limit_check
BEFORE INSERT ON trip_participants
FOR EACH ROW EXECUTE FUNCTION check_participant_limit();
```

### Fork Tracking

```sql
-- Increment fork count
CREATE OR REPLACE FUNCTION increment_fork_count()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE recipe_recipes 
    SET fork_count = fork_count + 1 
    WHERE id = NEW.original_recipe_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER fork_counter
AFTER INSERT ON recipe_recipes
FOR EACH ROW 
WHEN (NEW.original_recipe_id IS NOT NULL)
EXECUTE FUNCTION increment_fork_count();
```

### Audit Logging

```sql
-- Generic audit function
CREATE OR REPLACE FUNCTION audit_trigger()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO audit_log (
        user_id,
        action,
        entity_type,
        entity_id,
        changes
    ) VALUES (
        current_setting('app.current_user_id', true)::uuid,
        TG_OP,
        TG_TABLE_NAME,
        CASE 
            WHEN TG_OP = 'DELETE' THEN OLD.id
            ELSE NEW.id
        END,
        CASE
            WHEN TG_OP = 'INSERT' THEN to_jsonb(NEW)
            WHEN TG_OP = 'UPDATE' THEN jsonb_build_object(
                'old', to_jsonb(OLD),
                'new', to_jsonb(NEW)
            )
            WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD)
        END
    );
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Apply audit to important tables
CREATE TRIGGER audit_recipes AFTER INSERT OR UPDATE OR DELETE ON recipe_recipes
FOR EACH ROW EXECUTE FUNCTION audit_trigger();

CREATE TRIGGER audit_trips AFTER INSERT OR UPDATE OR DELETE ON trip_trips
FOR EACH ROW EXECUTE FUNCTION audit_trigger();

CREATE TRIGGER audit_users AFTER UPDATE OR DELETE ON auth_users
FOR EACH ROW EXECUTE FUNCTION audit_trigger();
```

### Updated Timestamp

```sql
-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
CREATE TRIGGER update_auth_users_updated_at BEFORE UPDATE ON auth_users
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_ingredients_updated_at BEFORE UPDATE ON common_ingredients
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_snacks_updated_at BEFORE UPDATE ON common_snacks
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_recipes_updated_at BEFORE UPDATE ON recipe_recipes
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_trips_updated_at BEFORE UPDATE ON trip_trips
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_templates_updated_at BEFORE UPDATE ON trip_templates
FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

## Archive/Trash Bin Pattern

Instead of soft deletes, use the `is_archived` boolean flag for a "trash bin" functionality:

```sql
-- Example: Archive a recipe
UPDATE recipe_recipes SET is_archived = TRUE WHERE id = $1;

-- Example: Restore from archive
UPDATE recipe_recipes SET is_archived = FALSE WHERE id = $1;

-- Example: Permanently delete archived items older than 30 days
DELETE FROM recipe_recipes 
WHERE is_archived = TRUE 
AND updated_at < NOW() - INTERVAL '30 days';

-- Example: Get active recipes
SELECT * FROM recipe_recipes 
WHERE user_id = $1 AND NOT is_archived
ORDER BY created_at DESC;

-- Example: Get archived recipes (trash bin)
SELECT * FROM recipe_recipes 
WHERE user_id = $1 AND is_archived
ORDER BY updated_at DESC;
```

## Migration Examples

```sql
-- Example: Add a new column
ALTER TABLE recipe_recipes ADD COLUMN difficulty VARCHAR(20) 
CHECK (difficulty IN ('easy', 'medium', 'hard'));

-- Example: Create an index for performance
CREATE INDEX idx_recipes_name_search ON recipe_recipes 
USING gin(to_tsvector('english', name)) WHERE NOT is_archived;

-- Example: Rename a column
ALTER TABLE trip_trips RENAME COLUMN deleted_at TO archived_at;
UPDATE trip_trips SET is_archived = TRUE WHERE archived_at IS NOT NULL;
ALTER TABLE trip_trips DROP COLUMN archived_at;
```

## Index Recommendations

### Text Search Indexes

```sql
-- Recipe name search
CREATE INDEX idx_recipe_name_search ON recipe_recipes 
USING gin(to_tsvector('simple', name)) WHERE NOT is_archived;

-- Ingredient name search
CREATE INDEX idx_ingredient_name_search ON common_ingredients 
USING gin(to_tsvector('simple', name));

-- Recipe instructions search (if needed)
CREATE INDEX idx_recipe_instructions_search ON recipe_recipes 
USING gin(to_tsvector('simple', instructions)) WHERE NOT is_archived;
```

### Performance Indexes

```sql
-- Commonly accessed recipe queries
CREATE INDEX idx_recipes_user_created ON recipe_recipes(user_id, created_at DESC) 
WHERE NOT is_archived;

-- Public recipe marketplace
CREATE INDEX idx_recipes_public_rating ON recipe_recipes(is_published, id) 
WHERE is_published AND NOT is_archived;

-- Trip date ranges
CREATE INDEX idx_trips_user_dates ON trip_trips(user_id, start_date, end_date) 
WHERE NOT is_archived;

-- Recipe ingredients lookup
CREATE INDEX idx_recipe_ingredients_ingredient ON recipe_ingredients(ingredient_id);

-- Nutritional value lookups
CREATE INDEX idx_ingredients_nutrition ON common_ingredients(nutritional_value_id);
```

## Database Connection & Pooling

```python
# Example database configuration for FastAPI + asyncpg
import asyncpg
from contextlib import asynccontextmanager

DATABASE_URL = "postgresql://user:password@localhost/jidelnicek"

class Database:
    def __init__(self):
        self.pool = None
    
    async def connect(self):
        self.pool = await asyncpg.create_pool(
            DATABASE_URL,
            min_size=10,
            max_size=20,
            max_queries=50000,
            max_inactive_connection_lifetime=300
        )
    
    async def disconnect(self):
        await self.pool.close()
    
    @asynccontextmanager
    async def acquire(self):
        async with self.pool.acquire() as connection:
            yield connection
    
    async def execute(self, query: str, *args):
        async with self.acquire() as connection:
            return await connection.execute(query, *args)
    
    async def fetch(self, query: str, *args):
        async with self.acquire() as connection:
            return await connection.fetch(query, *args)
    
    async def fetchrow(self, query: str, *args):
        async with self.acquire() as connection:
            return await connection.fetchrow(query, *args)

# Initialize database
db = Database()
```

## Backup Strategy

```bash
# Daily backup script
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/postgres"
DB_NAME="jidelnicek"

# Create backup
pg_dump -U postgres -d $DB_NAME -f "$BACKUP_DIR/backup_$DATE.sql"

# Compress backup
gzip "$BACKUP_DIR/backup_$DATE.sql"

# Remove backups older than 30 days
find $BACKUP_DIR -name "backup_*.sql.gz" -mtime +30 -delete

# Optional: Upload to cloud storage
# aws s3 cp "$BACKUP_DIR/backup_$DATE.sql.gz" s3://mybackups/postgres/
```

## Performance Considerations

1. **Connection Pooling**: Use asyncpg with connection pooling for optimal performance
2. **Indexes**: Create indexes on foreign keys and commonly queried fields
3. **JSONB**: Use GIN indexes on JSONB fields if querying inside JSON
4. **Partitioning**: Consider partitioning audit_log by month for large datasets
5. **VACUUM**: Set up regular VACUUM ANALYZE for optimal query planning
6. **Archive Old Data**: Regularly clean up archived items older than retention period

## Security Notes

1. **Row Level Security**: Consider implementing RLS for multi-tenant isolation
2. **Encryption**: Store sensitive data (passwords, tokens) encrypted
3. **Audit Trail**: Use audit_log table to track all important changes
4. **SQL Injection**: Always use parameterized queries
5. **Least Privilege**: Create separate database users for app vs admin tasks