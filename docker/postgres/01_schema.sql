-- Initial schema creation for Jídelníček 2.0
-- This file creates all tables with proper structure and constraints

-- =====================================================
-- Authentication Module (auth_*)
-- =====================================================

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
    language VARCHAR(2) DEFAULT 'cs' CHECK (language IN ('en', 'cs')),
    unit_system VARCHAR(10) DEFAULT 'metric' CHECK (unit_system IN ('metric', 'imperial')),
    energy_unit VARCHAR(10) DEFAULT 'kcal' CHECK (energy_unit IN ('kcal', 'kJ')),
    has_pku BOOLEAN DEFAULT FALSE,
    timezone VARCHAR(50) DEFAULT 'Europe/Prague',
    
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

-- Sessions table for secure session management
CREATE TABLE auth_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
    session_token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    last_accessed TIMESTAMP DEFAULT NOW()
);

-- API tokens for mobile/external access
CREATE TABLE auth_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(100),
    last_used TIMESTAMP,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE
);

-- Create indexes for auth tables
CREATE INDEX idx_auth_users_email ON auth_users(email);
CREATE INDEX idx_auth_users_archived ON auth_users(is_archived);
CREATE INDEX idx_auth_sessions_token ON auth_sessions(session_token);
CREATE INDEX idx_auth_sessions_user ON auth_sessions(user_id);
CREATE INDEX idx_auth_sessions_expires ON auth_sessions(expires_at);
CREATE INDEX idx_auth_tokens_hash ON auth_tokens(token_hash);
CREATE INDEX idx_auth_tokens_user ON auth_tokens(user_id);

-- =====================================================
-- Common Module (common_*)
-- =====================================================

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

-- Create indexes for common tables
CREATE INDEX idx_ingredients_user ON common_ingredients(user_id) WHERE NOT is_archived;
CREATE INDEX idx_ingredients_global ON common_ingredients(is_global) WHERE is_global AND NOT is_archived;
CREATE INDEX idx_ingredients_name ON common_ingredients(name);
CREATE INDEX idx_snacks_user ON common_snacks(user_id) WHERE NOT is_archived;
CREATE INDEX idx_snacks_name ON common_snacks(name);

-- =====================================================
-- Recipe Module (recipe_*)
-- =====================================================

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
CREATE TABLE recipe_recipe_ingredients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipe_id UUID NOT NULL REFERENCES recipe_recipes(id) ON DELETE CASCADE,
    ingredient_id UUID NOT NULL REFERENCES common_ingredients(id),
    quantity_g DECIMAL(10,1) NOT NULL CHECK (quantity_g > 0),
    display_order INTEGER DEFAULT 0,
    
    UNIQUE(recipe_id, ingredient_id)
);

-- Create indexes for recipe tables
CREATE INDEX idx_recipes_user ON recipe_recipes(user_id) WHERE NOT is_archived;
CREATE INDEX idx_recipes_public ON recipe_recipes(is_published) WHERE is_published AND NOT is_archived;
CREATE INDEX idx_recipes_original ON recipe_recipes(original_recipe_id);
CREATE INDEX idx_recipes_name ON recipe_recipes(name);
CREATE INDEX idx_recipe_ingredients_recipe ON recipe_recipe_ingredients(recipe_id);
CREATE INDEX idx_recipe_ingredients_ingredient ON recipe_recipe_ingredients(ingredient_id);

-- =====================================================
-- Trip Module (trip_*)
-- =====================================================

-- Trips table
CREATE TABLE trip_trips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    
    -- Configuration
    meal_slots JSONB DEFAULT '["Snídaně", "Oběd", "Večeře"]',
    
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

-- Create indexes for trip tables
CREATE INDEX idx_trips_user ON trip_trips(user_id) WHERE NOT is_archived;
CREATE INDEX idx_trips_dates ON trip_trips(start_date, end_date) WHERE NOT is_archived;
CREATE INDEX idx_trip_participants_trip ON trip_participants(trip_id);
CREATE INDEX idx_trip_days_trip ON trip_days(trip_id);
CREATE INDEX idx_trip_days_date ON trip_days(date);
CREATE INDEX idx_trip_meals_day ON trip_meals(trip_day_id);
CREATE INDEX idx_trip_meals_snapshot ON trip_meals(recipe_snapshot_id);

-- =====================================================
-- Sharing Module (sharing_*)
-- =====================================================

-- Reviews for published recipes
CREATE TABLE sharing_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipe_id UUID NOT NULL REFERENCES recipe_recipes(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    review_text TEXT CHECK (LENGTH(review_text) <= 1000),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(recipe_id, user_id)
);

-- Recipe forks tracking
CREATE TABLE sharing_forks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    original_recipe_id UUID NOT NULL REFERENCES recipe_recipes(id),
    forked_recipe_id UUID NOT NULL REFERENCES recipe_recipes(id),
    forked_by UUID NOT NULL REFERENCES auth_users(id),
    forked_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(forked_recipe_id)
);

-- Create indexes for sharing tables
CREATE INDEX idx_reviews_recipe ON sharing_reviews(recipe_id);
CREATE INDEX idx_reviews_user ON sharing_reviews(user_id);
CREATE INDEX idx_reviews_rating ON sharing_reviews(rating);
CREATE INDEX idx_forks_original ON sharing_forks(original_recipe_id);
CREATE INDEX idx_forks_user ON sharing_forks(forked_by);

-- =====================================================
-- Audit Module (audit_*)
-- =====================================================

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

-- Create indexes for audit
CREATE INDEX idx_audit_log_user ON audit_log(user_id);
CREATE INDEX idx_audit_log_entity ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_log_created ON audit_log(created_at);

-- =====================================================
-- Text Search Indexes
-- =====================================================

-- Recipe name search
CREATE INDEX idx_recipe_name_search ON recipe_recipes 
USING gin(to_tsvector('simple', name)) WHERE NOT is_archived;

-- Ingredient name search
CREATE INDEX idx_ingredient_name_search ON common_ingredients 
USING gin(to_tsvector('simple', name));

-- Recipe instructions search
CREATE INDEX idx_recipe_instructions_search ON recipe_recipes 
USING gin(to_tsvector('simple', COALESCE(instructions, ''))) WHERE NOT is_archived;