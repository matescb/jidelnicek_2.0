# Jídelníček Technical Architecture Document

## 1. System Architecture Overview

### High-Level Architecture

The Jídelníček application follows a **modular monolith architecture** pattern optimized for solo developer productivity while maintaining clear boundaries for future scalability. For detailed architecture design, see [[jidelnicek_Modular_Monolith_Architecture]].

```mermaid
graph TB
    subgraph "Client Layer"
        WEB[Web Application<br/>Next.js PWA]
    end
    
    subgraph "Single VPS (4GB RAM)"
        NGINX[Nginx<br/>Reverse Proxy & Static Files]
        
        subgraph "Docker Compose Stack"
            API[FastAPI Application<br/>Modular Monolith]
            POSTGRES[(PostgreSQL<br/>Single Database)]
            REDIS[(Redis<br/>Optional Cache)]
        end
        
        FILES[/uploads<br/>Local Volume]
    end
    
    WEB -->|HTTPS| NGINX
    NGINX -->|proxy_pass| API
    API -->|asyncpg| POSTGRES
    API -->|Optional| REDIS
    API -->|File I/O| FILES
    
    style REDIS stroke-dasharray: 5 5
```

### Architecture Principles

- **Modular Monolith**: Single deployable unit with clear module boundaries
- **API-First**: RESTful API design with FastAPI
- **Module Independence**: Each module owns its database schema
- **Simple Deployment**: Docker Compose on single VPS
- **Pragmatic Caching**: In-memory cache for MVP, Redis optional for production scaling
- **Local Storage**: No cloud dependencies for MVP

## 2. Data Models and Database Schema

### Core Entity Relationship Diagram

```mermaid
erDiagram
    USER ||--o{ TRIP : creates
    USER ||--o{ RECIPE : owns
    USER ||--o{ INGREDIENT : owns
    USER ||--o{ SNACK : owns
    USER ||--o{ RECIPE_RATING : rates
    USER ||--o{ RECIPE_REVIEW : writes
    
    TRIP ||--|{ TRIP_DAY : contains
    TRIP ||--|| STOVE : has
    TRIP ||--|{ PARTICIPANT : includes
    TRIP ||--o{ TRIP_TEMPLATE : "saved as"
    
    TRIP_DAY ||--|{ MEAL : contains
    TRIP_DAY ||--|{ DAY_SNACK : includes
    TRIP_DAY ||--|{ DAY_DRINK : includes
    
    MEAL }o--|| RECIPE_SNAPSHOT : uses
    RECIPE ||--|{ RECIPE_VERSION : "has versions"
    RECIPE ||--|{ RECIPE_INGREDIENT : contains
    RECIPE ||--o{ RECIPE_IMAGE : "has images"
    RECIPE ||--o{ RECIPE_FORK : "forked to"
    
    RECIPE_INGREDIENT }o--|| INGREDIENT : uses
    DAY_SNACK }o--|| SNACK : references
    DAY_DRINK }o--|| INGREDIENT : uses
    
    INGREDIENT ||--|| NUTRITIONAL_VALUE : has
    SNACK ||--|| NUTRITIONAL_VALUE : has
    RECIPE_SNAPSHOT ||--|| NUTRITIONAL_VALUE : "calculated"
```

### Detailed Database Schema

The database uses PostgreSQL schemas for logical organization within a single database. This provides clear module boundaries without the complexity of multiple databases. All schemas exist in the same PostgreSQL instance.

#### Module Schema Organization

```sql
-- Create module-specific schemas
CREATE SCHEMA auth;
CREATE SCHEMA recipe;
CREATE SCHEMA trip;
CREATE SCHEMA sharing;
CREATE SCHEMA common;  -- For shared/cross-cutting data
```

#### Auth Module Schema (auth.*)

```sql
-- Users table
CREATE TABLE auth.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    email_verified BOOLEAN DEFAULT FALSE,
    verification_token VARCHAR(255),
    reset_token VARCHAR(255),
    reset_token_expires TIMESTAMP,
    
    -- 2FA fields (Phase 1.1 - Post-MVP, prepared but not used in MVP)
    totp_secret VARCHAR(255), -- Encrypted TOTP secret
    two_factor_enabled BOOLEAN DEFAULT FALSE,
    recovery_codes TEXT[], -- Array of encrypted recovery codes
    
    -- User preferences
    language VARCHAR(2) DEFAULT 'en' CHECK (language IN ('en', 'cs')),
    unit_system VARCHAR(10) DEFAULT 'metric' CHECK (unit_system IN ('metric', 'imperial')),
    energy_unit VARCHAR(10) DEFAULT 'kcal' CHECK (energy_unit IN ('kcal', 'kJ')),
    has_pku BOOLEAN DEFAULT FALSE, -- PHE tracking flag
    language_code CHAR(2) DEFAULT 'en', -- ISO 639-1
    timezone VARCHAR(50) DEFAULT 'UTC',
    
    -- Account management
    role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    last_login TIMESTAMP,
    deleted_at TIMESTAMP,
    
    -- Account limits
    recipe_count INTEGER DEFAULT 0,
    trip_count INTEGER DEFAULT 0
);

-- OAuth providers
CREATE TABLE auth.oauth_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL,
    provider_account_id VARCHAR(255) NOT NULL,
    access_token TEXT,
    refresh_token TEXT,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(provider, provider_account_id)
);
```

#### Recipe Module Schema (recipe.*)

```sql
-- Recipes table
CREATE TABLE recipe.recipes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
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
    original_recipe_id UUID REFERENCES recipes(id),
    
    -- Tracking
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP,
    current_version_id UUID,
    
    -- Fork protection constraint
    CONSTRAINT unpublish_protection CHECK (
        NOT is_published OR fork_count <= 5 OR fork_count IS NULL
    )
);

-- Recipe versions for history tracking
CREATE TABLE recipe.recipe_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipe_id UUID REFERENCES recipes(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    
    -- Snapshot of recipe data
    name VARCHAR(100) NOT NULL,
    description TEXT,
    instructions TEXT,
    prep_time_minutes INTEGER,
    cook_time_minutes INTEGER,
    water_ml INTEGER,
    
    -- Version metadata
    created_at TIMESTAMP DEFAULT NOW(),
    created_by UUID REFERENCES users(id),
    change_type VARCHAR(50), -- 'major' (>1% nutrition), 'minor' (text only)
    
    UNIQUE(recipe_id, version_number)
);

-- Recipe ingredients
CREATE TABLE recipe.recipe_ingredients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipe_version_id UUID REFERENCES recipe_versions(id) ON DELETE CASCADE,
    ingredient_id UUID REFERENCES ingredients(id),
    quantity_g DECIMAL(10,1) NOT NULL CHECK (quantity_g > 0),
    
    UNIQUE(recipe_version_id, ingredient_id)
);

-- Recipe images
CREATE TABLE recipe.recipe_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    image_url VARCHAR(500) NOT NULL,
    display_order INTEGER NOT NULL DEFAULT 0,
    caption VARCHAR(200),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_recipe_image_order UNIQUE (recipe_id, display_order)
);
```

#### Common Schema (common.*)

```sql
-- Ingredients table (shared across modules)
CREATE TABLE common.ingredients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    category VARCHAR(50),
    is_global BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(user_id, name)
);

-- Nutritional values (per 100g)
CREATE TABLE common.nutritional_values (
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

-- Link ingredients to nutritional values
ALTER TABLE ingredients ADD COLUMN nutritional_value_id UUID REFERENCES nutritional_values(id);

-- Snacks (separate from ingredients)
CREATE TABLE common.snacks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    measurement_type VARCHAR(20) CHECK (measurement_type IN ('piece', 'per_100g')),
    piece_weight_g DECIMAL(10,2), -- If measured by piece
    nutritional_value_id UUID REFERENCES nutritional_values(id),
    is_global BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);
```

#### Trip Module Schema (trip.*)

```sql
-- Trips table
CREATE TABLE trip.trips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    
    -- Configuration
    meal_slots JSONB DEFAULT '["Breakfast", "Lunch", "Dinner"]', -- Flexible array, no hard limit
    track_recipe_changes BOOLEAN DEFAULT FALSE,
    
    -- Trip metadata
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP,
    
    CHECK (end_date >= start_date),
    CHECK ((SELECT COUNT(*) FROM trips WHERE user_id = user_id AND deleted_at IS NULL) <= 100)
);

-- Trip participants
CREATE TABLE trip.participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
    name VARCHAR(100),
    number INTEGER,
    coefficient DECIMAL(5,2) DEFAULT 100.00 CHECK (coefficient > 0),
    
    CHECK ((name IS NOT NULL) OR (number IS NOT NULL))
    -- Participant limit enforced by trigger below
);

-- Trip days
CREATE TABLE trip_days (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
    day_number INTEGER NOT NULL,
    date DATE NOT NULL,
    notes TEXT,
    
    UNIQUE(trip_id, day_number)
);

-- Meals (scaled recipes)
CREATE TABLE meals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_day_id UUID REFERENCES trip_days(id) ON DELETE CASCADE,
    meal_slot VARCHAR(50) NOT NULL, -- Matches name from trip.meal_slots JSONB array
    recipe_snapshot_id UUID,
    target_calories_per_person DECIMAL(10,2),
    scaling_factor DECIMAL(10,4) DEFAULT 1.0000,
    
    -- Ratings and notes
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    notes TEXT,
    
    UNIQUE(trip_day_id, meal_slot)
);

-- Note: meal_slots stored as JSONB array allows unlimited slots
-- UI is optimized for 1-10 slots but backend has no hard limit
-- Example: '["Breakfast", "Second Breakfast", "Lunch", "Afternoon Snack", "Dinner", "Evening Meal"]'

-- Recipe snapshots (for trip storage)
CREATE TABLE recipe_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    original_recipe_id UUID REFERENCES recipes(id),
    recipe_version_id UUID REFERENCES recipe_versions(id),
    
    -- Complete recipe data snapshot
    recipe_data JSONB NOT NULL, -- Full recipe with ingredients
    nutritional_value_id UUID REFERENCES nutritional_values(id),
    
    created_at TIMESTAMP DEFAULT NOW()
);

-- Day snacks
CREATE TABLE day_snacks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_day_id UUID REFERENCES trip_days(id) ON DELETE CASCADE,
    snack_id UUID REFERENCES snacks(id),
    quantity_per_person DECIMAL(10,2) NOT NULL,
    total_quantity DECIMAL(10,2) NOT NULL
);

-- Day drinks
CREATE TABLE day_drinks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_day_id UUID REFERENCES trip_days(id) ON DELETE CASCADE,
    ingredient_id UUID REFERENCES ingredients(id),
    quantity_per_person DECIMAL(10,2) NOT NULL,
    total_quantity DECIMAL(10,2) NOT NULL,
    water_ml INTEGER DEFAULT 0
);

-- Camping stoves
CREATE TABLE stoves (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
    name VARCHAR(100),
    efficiency_g_per_liter DECIMAL(10,2) NOT NULL,
    altitude_adjustment_percent DECIMAL(5,2) DEFAULT 0,
    
    UNIQUE(trip_id) -- One stove per trip
);
```

#### Marketplace and Sharing

```sql
-- Recipe ratings
CREATE TABLE recipe_ratings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipe_id UUID REFERENCES recipes(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(recipe_id, user_id)
);

-- Recipe reviews
CREATE TABLE recipe_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipe_id UUID REFERENCES recipes(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    review_text TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(recipe_id, user_id)
);

-- Recipe forks tracking
CREATE TABLE recipe_forks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    original_recipe_id UUID REFERENCES recipes(id),
    forked_recipe_id UUID REFERENCES recipes(id),
    forked_by UUID REFERENCES users(id),
    forked_at TIMESTAMP DEFAULT NOW()
);

-- Shareable links
CREATE TABLE share_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type VARCHAR(20) CHECK (entity_type IN ('recipe', 'trip')),
    entity_id UUID NOT NULL,
    share_token VARCHAR(255) UNIQUE NOT NULL,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP,
    view_count INTEGER DEFAULT 0
);
```

#### Templates

```sql
-- Trip templates
CREATE TABLE trip_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    template_data JSONB NOT NULL, -- Stores meal slots, recipes, snacks
    is_day_template BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Flexible Meal Slot Design
-- The meal_slots field in trips table uses JSONB to store an array of meal slot names
-- This design provides complete flexibility:
--   - No hard limit on number of meal slots (backend supports unlimited)
--   - UI is optimized for 1-10 slots for best user experience
--   - Each slot is simply a string name in the array
--   - Meals table references slots by name (VARCHAR) rather than index
--   - This allows dynamic meal structures for different trip types
-- Example meal_slots values:
--   - Hiking: '["Breakfast", "Trail Snack", "Lunch", "Afternoon Fuel", "Dinner"]'
--   - Ultralight: '["Morning", "Midday", "Evening"]'
--   - Expedition: '["Breakfast", "Second Breakfast", "Elevenses", "Lunch", "Tea", "Dinner", "Supper"]'

-- Triggers for constraint enforcement

-- Participant limit trigger
CREATE OR REPLACE FUNCTION check_participant_limit()
RETURNS TRIGGER AS $$
BEGIN
    IF (SELECT COUNT(*) FROM participants WHERE trip_id = NEW.trip_id) >= 20 THEN
        RAISE EXCEPTION 'Maximum 20 participants per trip';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER participant_limit_check
BEFORE INSERT ON participants
FOR EACH ROW EXECUTE FUNCTION check_participant_limit();

-- Recipe limit trigger
CREATE OR REPLACE FUNCTION check_recipe_limit()
RETURNS TRIGGER AS $$
BEGIN
    IF (SELECT COUNT(*) FROM recipes WHERE user_id = NEW.user_id) >= 500 THEN
        RAISE EXCEPTION 'Maximum 500 recipes per user';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER recipe_limit_check
BEFORE INSERT ON recipes
FOR EACH ROW EXECUTE FUNCTION check_recipe_limit();

-- Fork tracking trigger
CREATE OR REPLACE FUNCTION increment_fork_count()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE recipes 
    SET fork_count = fork_count + 1 
    WHERE id = NEW.original_recipe_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER fork_counter
AFTER INSERT ON recipes
FOR EACH ROW 
WHEN (NEW.original_recipe_id IS NOT NULL)
EXECUTE FUNCTION increment_fork_count();

-- Recipe version retention trigger
-- MVP: Keep last 5 versions (configurable to 10 post-launch)
CREATE OR REPLACE FUNCTION cleanup_old_recipe_versions()
RETURNS TRIGGER AS $$
DECLARE
    version_limit INTEGER := 5; -- MVP: 5 versions, can be changed to 10 post-launch
BEGIN
    DELETE FROM recipe_versions
    WHERE recipe_id = NEW.recipe_id
    AND version_number < (
        SELECT version_number - version_limit + 1
        FROM recipe_versions
        WHERE recipe_id = NEW.recipe_id
        ORDER BY version_number DESC
        LIMIT 1
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER recipe_version_cleanup
AFTER INSERT ON recipe_versions
FOR EACH ROW EXECUTE FUNCTION cleanup_old_recipe_versions();
```

## 3. API Design

### Primary API (Phase 1-3)
The application uses RESTful API with OpenAPI 3.0 specification:
- Base path: `/api/v1`
- JSON request/response format
- JWT Bearer authentication
- Comprehensive error handling

### API Design Philosophy
The application uses a RESTful API with OpenAPI 3.0 specification. This approach provides simplicity, predictability, and excellent tooling support while avoiding unnecessary complexity for the MVP.

### REST API Endpoints

#### Authentication Endpoints

```python
# Example FastAPI router for authentication
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, EmailStr
from typing import Optional
import jwt

router = APIRouter(prefix="/api/auth", tags=["authentication"])

class UserRegister(BaseModel):
    email: EmailStr
    password: str
    language: Optional[str] = "en"
    unit_system: Optional[str] = "metric"

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"

@router.post("/register", response_model=Token)
async def register(user_data: UserRegister, db: AsyncSession = Depends(get_db)):
    # Implementation here
    pass

@router.post("/login", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends(), db: AsyncSession = Depends(get_db)):
    # Implementation here
    pass

@router.post("/logout")
async def logout(current_user: User = Depends(get_current_user)):
    # Implementation here
    pass

@router.post("/refresh", response_model=Token)
async def refresh_token(refresh_token: str):
    # Implementation here
    pass

@router.get("/me", response_model=UserResponse)
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    return current_user

@router.put("/preferences")
async def update_preferences(
    preferences: UserPreferences,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Implementation here
    pass
```

#### Recipe Management

### Recipe Versioning Calculation

Nutritional change percentage is calculated as:
```python
def calculate_nutritional_change(old_recipe, new_recipe):
    """
    Returns True if nutritional change > 1%
    """
    old_calories = old_recipe.total_calories
    new_calories = new_recipe.total_calories
    
    if old_calories == 0:
        return new_calories > 0
    
    change_percent = abs((new_calories - old_calories) / old_calories) * 100
    
    # Also check macros
    for macro in ['protein', 'carbs', 'fat']:
        old_val = getattr(old_recipe, f'total_{macro}')
        new_val = getattr(new_recipe, f'total_{macro}')
        if old_val > 0:
            macro_change = abs((new_val - old_val) / old_val) * 100
            change_percent = max(change_percent, macro_change)
    
    return change_percent > 1.0
```

### Recipe Search Implementation

Search uses PostgreSQL full-text search with weighted fields:
```sql
-- Add to recipes table
search_vector tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(instructions, '')), 'C') ||
    setweight(to_tsvector('english', coalesce(tags::text, '')), 'B')
) STORED;

CREATE INDEX idx_recipe_search ON recipes USING GIN(search_vector);

-- Search query example
SELECT * FROM recipes 
WHERE search_vector @@ plainto_tsquery('english', 'pasta camping')
ORDER BY ts_rank(search_vector, plainto_tsquery('english', 'pasta camping')) DESC;
```

Search filters:
- Category (breakfast, lunch, dinner, snack)
- Dietary tags (vegetarian, vegan, gluten-free)
- Calorie range
- Preparation time
- Number of ingredients

```python
# Example FastAPI router for recipes
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
from uuid import UUID

router = APIRouter(prefix="/api/recipes", tags=["recipes"])

class RecipeCreate(BaseModel):
    name: str
    description: Optional[str]
    instructions: Optional[str]
    prep_time_minutes: Optional[int]
    cook_time_minutes: Optional[int]
    water_ml: Optional[int] = 0
    servings: Optional[int] = 1
    ingredients: List[RecipeIngredientInput]

class RecipeUpdate(BaseModel):
    name: Optional[str]
    description: Optional[str]
    instructions: Optional[str]
    prep_time_minutes: Optional[int]
    cook_time_minutes: Optional[int]
    water_ml: Optional[int]
    servings: Optional[int]
    ingredients: Optional[List[RecipeIngredientInput]]

class RecipeResponse(BaseModel):
    id: UUID
    name: str
    description: Optional[str]
    instructions: Optional[str]
    prep_time_minutes: Optional[int]
    cook_time_minutes: Optional[int]
    water_ml: int
    servings: int
    is_public: bool
    fork_count: int
    created_at: datetime
    updated_at: datetime
    nutrition: NutritionalValueResponse
    ingredients: List[RecipeIngredientResponse]
    images: List[RecipeImageResponse]

    class Config:
        from_attributes = True

@router.get("/", response_model=List[RecipeResponse])
async def list_recipes(
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Implementation here
    pass

@router.post("/", response_model=RecipeResponse, status_code=status.HTTP_201_CREATED)
async def create_recipe(
    recipe: RecipeCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Check recipe count limit
    if current_user.recipe_count >= 500:
        raise HTTPException(status_code=400, detail="Recipe limit reached")
    # Implementation here
    pass

@router.get("/{recipe_id}", response_model=RecipeResponse)
async def get_recipe(
    recipe_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Implementation here
    pass

@router.put("/{recipe_id}", response_model=RecipeResponse)
async def update_recipe(
    recipe_id: UUID,
    recipe_update: RecipeUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Implementation here
    pass

@router.delete("/{recipe_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_recipe(
    recipe_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Implementation here
    pass

@router.post("/{recipe_id}/duplicate", response_model=RecipeResponse)
async def duplicate_recipe(
    recipe_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Implementation here
    pass

@router.post("/{recipe_id}/images", response_model=RecipeImageResponse)
async def upload_recipe_image(
    recipe_id: UUID,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Validate file type and size
    if file.size > 5 * 1024 * 1024:  # 5MB limit
        raise HTTPException(status_code=400, detail="File too large")
    # Implementation here
    pass
```

#### Marketplace
```
GET    /api/marketplace/recipes      # Browse public recipes
GET    /api/marketplace/recipes/:id  # View public recipe
POST   /api/marketplace/recipes/:id/fork # Fork recipe
POST   /api/marketplace/recipes/:id/rate # Rate recipe
POST   /api/marketplace/recipes/:id/review # Review recipe
GET    /api/marketplace/trending     # Get trending recipes
GET    /api/marketplace/search       # Search recipes
```

#### Trip Planning
```
GET    /api/trips                    # List user's trips
POST   /api/trips                    # Create new trip
GET    /api/trips/:id                # Get trip details
PUT    /api/trips/:id                # Update trip
DELETE /api/trips/:id                # Delete trip
POST   /api/trips/:id/days           # Add day
PUT    /api/trips/:id/days/:dayId    # Update day
DELETE /api/trips/:id/days/:dayId    # Remove day
PUT    /api/trips/:id/days/reorder   # Reorder days
POST   /api/trips/:id/participants   # Add participant
PUT    /api/trips/:id/participants/:pId # Update participant
DELETE /api/trips/:id/participants/:pId # Remove participant
PUT    /api/trips/:id/stove          # Set/update stove
```

#### Meal Management
```
POST   /api/trips/:tripId/days/:dayId/meals # Add meal
PUT    /api/trips/:tripId/days/:dayId/meals/:slot # Update meal
DELETE /api/trips/:tripId/days/:dayId/meals/:slot # Remove meal
POST   /api/trips/:tripId/days/:dayId/snacks # Add snack
PUT    /api/trips/:tripId/days/:dayId/snacks/:id # Update snack
DELETE /api/trips/:tripId/days/:dayId/snacks/:id # Remove snack
POST   /api/trips/:tripId/days/:dayId/drinks # Add drink
PUT    /api/trips/:tripId/days/:dayId/drinks/:id # Update drink
DELETE /api/trips/:tripId/days/:dayId/drinks/:id # Remove drink
```

#### Ingredients & Snacks
```
GET    /api/ingredients              # List ingredients
POST   /api/ingredients              # Create ingredient
PUT    /api/ingredients/:id          # Update ingredient
DELETE /api/ingredients/:id          # Delete ingredient
GET    /api/ingredients/global       # Get global ingredients
GET    /api/snacks                   # List snacks
POST   /api/snacks                   # Create snack
PUT    /api/snacks/:id               # Update snack
DELETE /api/snacks/:id               # Delete snack
GET    /api/snacks/global            # Get global snacks
```

#### Export & Reports
```
GET    /api/trips/:id/export/summary # Export trip summary
GET    /api/trips/:id/export/shopping-list # Export shopping list
GET    /api/trips/:id/export/packing-list # Export packing list
GET    /api/trips/:id/export/nutrition # Export nutrition report
POST   /api/trips/:id/export/custom  # Custom export with options
```

#### Templates
```
GET    /api/templates                # List templates
POST   /api/templates/from-trip/:id  # Create from trip
POST   /api/templates/from-day/:tripId/:dayId # Create from day
PUT    /api/templates/:id            # Update template
DELETE /api/templates/:id            # Delete template
POST   /api/trips/:id/apply-template/:templateId # Apply template
```

#### Sharing
```
POST   /api/share/recipe/:id         # Create recipe share link
POST   /api/share/trip/:id           # Create trip share link
GET    /api/share/:token             # View shared content
DELETE /api/share/:token             # Revoke share link
```


## 4. Technology Stack Recommendations

### Frontend
- **Framework**: Next.js 14 with App Router
- **UI Library**: React 18 with TypeScript
- **Styling**: Tailwind CSS + Shadcn/ui components
- **State Management**: Zustand (lightweight)
- **Forms**: React Hook Form + Zod validation
- **Data Fetching**: TanStack Query (React Query)
- **Mobile**: Responsive web design only
- **PWA Support**: Planned for Phase 2 (offline functionality, service workers, app-like experience)
- **i18n**: next-i18next for Czech/English support
- **Image Handling**: 
  - browser-image-compression for client-side optimization
  - react-dropzone for drag-and-drop upload
  - Progressive upload with axios for progress tracking

### Backend
- **Runtime**: Python 3.11.x (latest stable 3.11)
- **Framework**: FastAPI (efficient async framework)
- **API**: REST with OpenAPI 3.0 specification
- **ORM**: SQLAlchemy 2.0 with async support
- **Database Migrations**: Alembic
- **Validation**: Pydantic v2 (built into FastAPI)
- **Authentication**: python-jose[cryptography] with JWT + Passlib
- **File Upload**: python-multipart + Pillow for image processing
- **PDF Generation**: ReportLab (lightweight)
- **Task Queue**: Celery with Redis (single worker) - Optional for Phase 1.1
- **Testing**: pytest + pytest-asyncio + pytest-cov

### Database & Storage
- **Primary DB**: PostgreSQL 15 (Docker container)
- **Cache**: In-memory for MVP, Redis 7 optional (Phase 1.1) - see [[backend/core/cache_strategy]]
- **File Storage**: Local volume mount (no S3)
- **Search**: PostgreSQL full-text search
- **Connection Pool**: asyncpg with limited pool size (max 10 connections)

### Testing Strategy
- Unit Tests: SQLite in-memory (sqlite:///:memory:)
- Integration Tests: PostgreSQL container
- Production: PostgreSQL container on VPS

### Infrastructure
- **Container**: Docker with multi-stage builds
- **ASGI Server**: Uvicorn (single process)
- **Process Manager**: Docker Compose
- **Orchestration**: Docker Compose v2
- **CI/CD**: GitHub Actions (simple deployment)
- **Monitoring**: Health check endpoints + uptime monitoring
- **Logging**: Docker logs + logrotate
- **Error Tracking**: Sentry free tier (optional)
- **API Documentation**: Auto-generated with FastAPI + ReDoc/Swagger UI

## 5. Security Architecture

### Authentication & Authorization
- **JWT tokens** with refresh token rotation
- **OAuth2** integration (Google, Facebook)
- **Role-based access control** (RBAC)
- **API rate limiting** per user/IP
- **Password requirements**: min 8 chars, complexity rules
- **2FA support** (Phase 1.1 - Post-MVP, database fields prepared)

### Data Security
- **Encryption at rest**: Database encryption
- **Encryption in transit**: TLS 1.3
- **PII handling**: GDPR compliance
- **Input sanitization**: XSS prevention
- **SQL injection prevention**: Parameterized queries
- **File upload validation**: Type, size, content scanning

### API Security
- **CORS configuration**: FastAPI CORSMiddleware with whitelist
- **Security headers**: secure-headers or custom middleware
- **Request validation**: Pydantic schema validation
- **Authentication middleware**: FastAPI dependencies for protected routes
- **Rate limiting**: slowapi (FastAPI-compatible rate limiter)
- **Audit logging**: structlog for structured logging

## 6. Performance Considerations

### Caching Strategy

The application uses a flexible caching abstraction layer that supports in-memory caching for the MVP with a clear migration path to Redis. For detailed implementation, see [[backend/core/cache_strategy]].

```
1. Cache Layers (In-Memory for MVP, Redis for Phase 1.1):
   - Session cache (15 min TTL)
   - User preferences (1 hour TTL)
   - Recipe calculations (24 hour TTL)
   - Public recipes (1 hour TTL)
   - Ingredient database (24 hour TTL)

2. Database Optimizations:
   - Indexed columns: user_id, recipe_id, trip_id, dates
   - Materialized views for nutrition calculations
   - Partitioning for large tables (recipe_versions)
   - Connection pooling

3. API Response Caching:
   - CDN for static assets
   - API response cache headers
   - ETags for conditional requests
```

### Performance Targets
- **Page Load**: < 3s on 3G
- **API Response**: < 200ms p95
- **Export Generation**: < 30s for large trips
- **Search Results**: < 500ms
- **Concurrent Users**: 10,000+

### Optimization Techniques
- **Lazy loading** for images and components
- **Virtualization** for long lists
- **Debouncing** for search and calculations
- **Batch operations** for bulk updates
- **Background jobs** for exports and calculations
- **Database query optimization** with EXPLAIN ANALYZE

## Cache Configuration

For detailed cache implementation and migration strategy, see [[backend/core/cache_strategy]].

### Cache TTL Values (Works with both In-Memory and Redis)

| Cache Type | TTL | Key Pattern | Notes |
|------------|-----|-------------|--------|
| User session | 24 hours | session:{user_id} | Sliding expiration |
| Recipe details | 1 hour | recipe:{recipe_id} | Invalidate on update |
| Nutritional calculations | 5 minutes | nutrition:{recipe_id}:{portions} | Short due to changes |
| User preferences | 30 minutes | prefs:{user_id} | Invalidate on update |
| Shopping lists | 10 minutes | shopping:{trip_id} | Regenerate frequently |
| Public recipes list | 5 minutes | marketplace:page:{n} | High traffic |
| Ingredient search | 30 minutes | ingredients:search:{query} | Stable data |
| Trip summary | 5 minutes | trip:summary:{trip_id} | Complex calculation |
| Static assets | 7 days | static:{hash} | CDN backed |
| API rate limit | 1 minute | rate:{user_id}:{endpoint} | Sliding window |

## 7. Python Backend Project Structure (Modular Monolith)

### Recommended Project Layout

```
jidelnicek-backend/
├── alembic/                  # Database migrations
│   ├── versions/            # Migration files
│   └── alembic.ini         # Alembic configuration
├── app/
│   ├── __init__.py
│   ├── main.py             # FastAPI app initialization
│   ├── config.py           # Global configuration
│   ├── database.py         # Database connection setup
│   ├── modules/            # Modular monolith modules
│   │   ├── __init__.py
│   │   ├── auth/           # Auth Module
│   │   │   ├── __init__.py
│   │   │   ├── routes.py   # Module routes
│   │   │   ├── controllers/
│   │   │   ├── services/
│   │   │   ├── repositories/
│   │   │   ├── models/
│   │   │   ├── schemas/
│   │   │   └── interfaces/
│   │   ├── recipe/         # Recipe Module
│   │   │   ├── __init__.py
│   │   │   ├── routes.py
│   │   │   ├── controllers/
│   │   │   ├── services/
│   │   │   ├── repositories/
│   │   │   ├── models/
│   │   │   ├── schemas/
│   │   │   └── interfaces/
│   │   ├── trip/           # Trip Module
│   │   │   ├── __init__.py
│   │   │   ├── routes.py
│   │   │   ├── controllers/
│   │   │   ├── services/
│   │   │   ├── repositories/
│   │   │   ├── models/
│   │   │   ├── schemas/
│   │   │   └── interfaces/
│   │   └── sharing/        # Sharing Module
│   │       ├── __init__.py
│   │       ├── routes.py
│   │       ├── controllers/
│   │       ├── services/
│   │       ├── repositories/
│   │       ├── models/
│   │       ├── schemas/
│   │       └── interfaces/
│   ├── shared/             # Shared across modules
│   │   ├── __init__.py
│   │   ├── interfaces/     # Shared interfaces
│   │   ├── middleware/     # Common middleware
│   │   ├── events/         # Event bus
│   │   ├── utils/          # Utilities
│   │   └── types/          # Common types
│   ├── tasks/              # Background tasks
│   │   ├── __init__.py
│   │   ├── export_tasks.py
│   │   └── email_tasks.py
│   └── infrastructure/     # Infrastructure services
│       ├── __init__.py
│       ├── cache.py
│       ├── storage.py
│       └── email.py
├── tests/
│   ├── __init__.py
│   ├── conftest.py         # pytest fixtures
│   ├── test_api/
│   ├── test_models/
│   ├── test_services/
│   └── test_utils/
├── scripts/
│   ├── init_db.py          # Database initialization
│   └── seed_data.py        # Seed test data
├── docker/
│   ├── Dockerfile
│   └── docker-compose.yml
├── requirements/
│   ├── base.txt            # Core dependencies
│   ├── dev.txt             # Development dependencies
│   └── prod.txt            # Production dependencies
├── .env.example
├── .gitignore
├── docker-compose.yml      # Single file orchestration
├── Dockerfile              # Application container
├── nginx.conf              # Nginx configuration
├── pyproject.toml          # Poetry configuration (alternative)
├── pytest.ini
├── setup.cfg               # Linting configuration
└── README.md
```

### Example Main Application Setup (Modular Monolith)

```python
# app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import uvicorn

from app.config import settings
from app.database import engine
from app.modules.auth import AuthModule
from app.modules.recipe import RecipeModule
from app.modules.trip import TripModule
from app.modules.sharing import SharingModule
from app.shared.events import EventBus
from app.shared.middleware import setup_middleware

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    # Initialize event bus
    event_bus = EventBus()
    
    # Initialize modules with dependencies
    auth_module = AuthModule(event_bus)
    recipe_module = RecipeModule(event_bus, auth_module.get_service())
    trip_module = TripModule(event_bus, auth_module.get_service(), recipe_module.get_service())
    sharing_module = SharingModule(event_bus, auth_module.get_service(), recipe_module.get_service())
    
    # Store modules in app state
    app.state.modules = {
        'auth': auth_module,
        'recipe': recipe_module,
        'trip': trip_module,
        'sharing': sharing_module
    }
    
    yield
    
    # Shutdown
    await engine.dispose()
    await event_bus.shutdown()

app = FastAPI(
    title="Jídelníček API",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc"
)

# Setup common middleware
setup_middleware(app, settings)

# Register module routes
@app.on_event("startup")
async def register_routes():
    modules = app.state.modules
    
    # Register each module's routes
    app.include_router(modules['auth'].get_routes(), prefix="/api/auth", tags=["Authentication"])
    app.include_router(modules['recipe'].get_routes(), prefix="/api/recipes", tags=["Recipes"])
    app.include_router(modules['trip'].get_routes(), prefix="/api/trips", tags=["Trips"])
    app.include_router(modules['sharing'].get_routes(), prefix="/api/sharing", tags=["Sharing"])

# Health check endpoint
@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "modules": {
            name: module.health_check() 
            for name, module in app.state.modules.items()
        }
    }

if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.DEBUG
    )
```

### Database Connection with Async SQLAlchemy

```python
# app/database.py
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker, declarative_base
from app.core.config import settings

# Create async engine
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    pool_size=20,
    max_overflow=0,
    pool_pre_ping=True,
)

# Create async session factory
AsyncSessionLocal = sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

Base = declarative_base()

# Dependency to get DB session
async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
```

### Configuration Management

```python
# app/core/config.py
from pydantic_settings import BaseSettings
from typing import List, Optional
from functools import lru_cache

class Settings(BaseSettings):
    # Application
    APP_NAME: str = "Jídelníček"
    VERSION: str = "1.0.0"
    DEBUG: bool = False
    
    # Recipe settings
    RECIPE_VERSION_LIMIT: int = 5  # MVP: 5 versions, can be increased to 10 post-launch
    
    # Database
    DATABASE_URL: str  # For production PostgreSQL
    # Unit tests only
    TEST_DATABASE_URL: str = "sqlite+aiosqlite:///:memory:"
    
    # Security
    SECRET_KEY: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    ALGORITHM: str = "HS256"
    
    # CORS
    BACKEND_CORS_ORIGINS: List[str] = []
    
    # Redis (Optional - Phase 1.1)
    REDIS_URL: Optional[str] = None  # Set to "redis://localhost:6379" when using Redis
    
    # File Storage (local for MVP)
    UPLOAD_DIR: str = "/uploads"
    MAX_UPLOAD_SIZE: int = 5 * 1024 * 1024  # 5MB
    
    # Email
    SMTP_HOST: str
    SMTP_PORT: int
    SMTP_USER: str
    SMTP_PASSWORD: str
    
    class Config:
        env_file = ".env"

@lru_cache()
def get_settings():
    return Settings()

settings = get_settings()
```

### Example Dependencies

```txt
# requirements/base.txt
fastapi==0.104.1
uvicorn[standard]==0.24.0
pydantic==2.5.0
pydantic-settings==2.1.0
sqlalchemy==2.0.23
alembic==1.12.1
asyncpg==0.29.0
aiosqlite==0.19.0  # For testing with SQLite
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
python-multipart==0.0.6
pillow==10.1.0
reportlab==4.0.7
celery==5.3.4
redis==5.0.1
httpx==0.25.2
# boto3==1.29.7  # Not needed for MVP (local storage)
structlog==23.2.0
pytz==2023.3  # Timezone handling

# requirements/dev.txt
-r base.txt
pytest==7.4.3
pytest-asyncio==0.21.1
pytest-cov==4.1.0
black==23.11.0
flake8==6.1.0
mypy==1.7.1
isort==5.12.0
pre-commit==3.5.0
ipython==8.18.1

# requirements/prod.txt
-r base.txt
gunicorn==21.2.0
sentry-sdk==1.39.1
prometheus-fastapi-instrumentator==6.1.0
```

## 8. Deployment Architecture

> **Note**: The modular monolith architecture significantly simplifies deployment compared to microservices. See [[jidelnicek_Modular_Monolith_Architecture]] for module extraction strategies when scaling becomes necessary.

### MVP Deployment Architecture

```mermaid
graph TB
    subgraph "Internet"
        USERS[Users]
        CF[Cloudflare<br/>Optional CDN]
    end
    
    subgraph "Single VPS"
        subgraph "Docker Compose"
            NGINX[Nginx Container<br/>:80 :443]
            API[FastAPI Container<br/>:8000]
            POSTGRES[(PostgreSQL Container<br/>:5432)]
            REDIS[(Redis Container<br/>:6379<br/>Optional)]
        end
        
        subgraph "Docker Volumes"
            PGDATA[postgres_data]
            UPLOADS[uploads]
            CERTS[ssl_certs]
        end
    end
    
    USERS -->|HTTPS| CF
    CF -->|HTTPS| NGINX
    USERS -.->|Direct HTTPS| NGINX
    
    NGINX -->|proxy| API
    API -->|query| POSTGRES
    API -.->|cache| REDIS
    
    POSTGRES --> PGDATA
    API --> UPLOADS
    NGINX --> CERTS
    
    style CF stroke-dasharray: 5 5
    style REDIS stroke-dasharray: 5 5
```

### Deployment Strategy
- **Docker Compose** for orchestration
- **Simple rolling updates** with docker-compose up -d
- **Database migrations** with Alembic before deployment
- **Health checks** to verify deployment success
- **Backup before deployment** for rollback capability

### Python-Specific Deployment Considerations

#### Docker Configuration
```dockerfile
# Multi-stage Dockerfile optimized for VPS
FROM python:3.11-slim as builder

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

FROM python:3.11-slim

WORKDIR /app
COPY --from=builder /root/.local /root/.local
COPY . .

ENV PATH=/root/.local/bin:$PATH
ENV PYTHONUNBUFFERED=1

# Single worker for memory efficiency
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
```

#### Production Server Configuration
```nginx
# NGINX configuration for single FastAPI instance
server {
    listen 80;
    server_name jidelnicek.cz www.jidelnicek.cz;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name jidelnicek.cz www.jidelnicek.cz;
    
    ssl_certificate /etc/letsencrypt/live/jidelnicek.cz/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/jidelnicek.cz/privkey.pem;
    
    # API endpoints
    location /api {
        proxy_pass http://api:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Timeouts for large exports
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }
    
    # Static files (Next.js build)
    location / {
        root /var/www/html;
        try_files $uri $uri/ /index.html;
    }
    
    # Uploaded images
    location /uploads {
        alias /uploads;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
```

#### Docker Compose Configuration
```yaml
# docker-compose.yml
version: '3.8'

services:
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/letsencrypt
      - ./static:/var/www/html
      - uploads:/uploads
    depends_on:
      - api
    restart: unless-stopped
    mem_limit: 256m

  api:
    build: .
    environment:
      - DATABASE_URL=postgresql://user:pass@postgres/jidelnicek
      - REDIS_URL=redis://redis:6379
    volumes:
      - uploads:/app/uploads
    depends_on:
      - postgres
      - redis
    restart: unless-stopped
    mem_limit: 1g

  postgres:
    image: postgres:15-alpine
    environment:
      - POSTGRES_DB=jidelnicek
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=pass
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped
    mem_limit: 1g

  redis:
    image: redis:7-alpine
    command: redis-server --maxmemory 400mb --maxmemory-policy allkeys-lru
    restart: unless-stopped
    mem_limit: 512m

volumes:
  postgres_data:
  uploads:
```

### Scaling Strategy
- **Vertical scaling** first (upgrade VPS when needed)
- **CDN** for static assets and images
- **Database optimization** before adding complexity
- **Caching strategy** to reduce database load
- **Separate static server** when traffic grows

## 9. Data Storage Calculations

### Storage Estimates

```
Per User Storage:
- User data: ~1 KB
- Recipes (avg 500): 500 * 5 KB = 2.5 MB
- Recipe images (avg 2 per recipe): 1000 * 1 MB = 1 GB
- Trips (avg 100): 100 * 50 KB = 5 MB
- Total per user: ~1 GB

For 10,000 active users:
- Database size: ~100 GB
- Object storage: ~10 TB
- Redis cache: ~5 GB
- Backups (30 days): ~3 TB

Growth projections:
- Year 1: 10,000 users = 10 TB
- Year 2: 50,000 users = 50 TB
- Year 3: 200,000 users = 200 TB
```

### Database Performance Metrics
```
Expected Load:
- Read QPS: 1000-5000
- Write QPS: 100-500
- Concurrent connections: 100-500
- Average query time: < 10ms
- Peak traffic: 10x normal

Resource Requirements:
- CPU: 16-32 cores
- RAM: 64-128 GB
- Storage: 1-2 TB SSD
- IOPS: 10,000+
```

### Backup Strategy
- **Daily backups** with 30-day retention
- **Point-in-time recovery** for last 7 days
- **Geo-redundant storage** for backups
- **Automated backup testing** weekly
- **RPO**: 1 hour, **RTO**: 4 hours

## 10. Monitoring and Observability

### Key Metrics
```
Application Metrics:
- Request rate and latency
- Error rate by endpoint
- Active users and sessions
- Recipe creation rate
- Trip planning activity

Infrastructure Metrics:
- CPU and memory usage
- Disk I/O and space
- Network throughput
- Database connections
- Cache hit rate

Business Metrics:
- User registration rate
- Recipe publishing rate
- Feature adoption
- Export generation
- User retention
```

### Alerting Rules
- **High error rate**: > 5% for 5 minutes
- **High latency**: p95 > 1s for 10 minutes
- **Database connections**: > 80% pool usage
- **Disk space**: < 20% free
- **Memory usage**: > 90% for 15 minutes

## 11. Testing Strategy

### Python Testing Approach

#### Unit Testing with pytest
```python
# tests/conftest.py
import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from httpx import AsyncClient
from typing import AsyncGenerator

from app.main import app
from app.database import Base
from app.core.config import settings

# Use SQLite in-memory for unit tests only
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

@pytest_asyncio.fixture
async def async_session() -> AsyncGenerator[AsyncSession, None]:
    """Create a test database session."""
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    AsyncSessionLocal = sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )
    
    async with AsyncSessionLocal() as session:
        yield session
    
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    
    await engine.dispose()

@pytest_asyncio.fixture
async def client(async_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """Create a test client."""
    async with AsyncClient(app=app, base_url="http://test") as ac:
        yield ac

@pytest.fixture
def auth_headers(test_user):
    """Generate auth headers for test user."""
    token = create_access_token(test_user.id)
    return {"Authorization": f"Bearer {token}"}
```

#### Example Test Cases
```python
# tests/test_api/test_recipes.py
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

class TestRecipeAPI:
    @pytest.mark.asyncio
    async def test_create_recipe(
        self,
        client: AsyncClient,
        async_session: AsyncSession,
        auth_headers: dict
    ):
        recipe_data = {
            "name": "Test Recipe",
            "description": "Test description",
            "instructions": "Test instructions",
            "servings": 4,
            "ingredients": [
                {
                    "ingredient_id": "test-ingredient-id",
                    "quantity_g": 100
                }
            ]
        }
        
        response = await client.post(
            "/api/v1/recipes",
            json=recipe_data,
            headers=auth_headers
        )
        
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == recipe_data["name"]
        assert data["servings"] == recipe_data["servings"]
    
    @pytest.mark.asyncio
    async def test_list_recipes_pagination(
        self,
        client: AsyncClient,
        auth_headers: dict
    ):
        response = await client.get(
            "/api/v1/recipes?skip=0&limit=10",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) <= 10
```

#### Integration Testing
```python
# tests/test_services/test_calculation_service.py
import pytest
from app.services.calculation_service import CalculationService
from app.models import Recipe, Ingredient

class TestCalculationService:
    @pytest.mark.asyncio
    async def test_calculate_recipe_nutrition(self, async_session):
        # Create test ingredients with known nutritional values
        ingredient1 = Ingredient(
            name="Test Ingredient 1",
            nutritional_value={
                "calories": 200,
                "proteins_g": 10,
                "carbohydrates_g": 30,
                "fats_g": 5
            }
        )
        
        service = CalculationService(async_session)
        nutrition = await service.calculate_recipe_nutrition(recipe_id)
        
        assert nutrition.calories == expected_calories
        assert nutrition.proteins_g == expected_proteins
```

### Testing Best Practices

1. **Test Coverage Requirements**
   - Minimum 80% code coverage
   - 100% coverage for critical business logic
   - Integration tests for all API endpoints

2. **Testing Pyramid**
   - Unit tests: 70% (fast, isolated)
   - Integration tests: 20% (API and service layer)
   - E2E tests: 10% (critical user flows)

3. **Performance Testing**
   ```python
   # tests/test_performance.py
   import pytest
   from locust import HttpUser, task, between
   
   class JidelnicekUser(HttpUser):
       wait_time = between(1, 3)
       
       @task
       def browse_recipes(self):
           self.client.get("/api/v1/marketplace/recipes")
       
       @task
       def calculate_nutrition(self):
           self.client.post("/api/v1/recipes/calculate")
   ```

4. **Database Testing Strategy**
   - Use SQLite in-memory for unit tests only (fast, isolated)
   - Use PostgreSQL for integration tests (matching production)
   - Use PostgreSQL for E2E tests (with test data)
   - Transaction rollback for test isolation
   - Fixtures for common test data

## External Service Integrations

### Email Service
- **Provider**: SMTP (Gmail, SendGrid, or local mail server)
- **Templates**:
  - Welcome email
  - Email verification
  - Password reset
  - Trip shared notification
- **Rate limit**: Depends on provider
- **Error handling**: Retry with exponential backoff

### Image Storage: Local File System
- **Provider**: Local Docker volume
- **Directory Structure**:
  ```
  /uploads/
  ├── recipes/
  │   ├── {user_id}/
  │   │   └── {recipe_id}/
  │   │       ├── main.jpg
  │   │       └── step_{n}.jpg
  ├── avatars/
  │   └── {user_id}.jpg
  └── tmp/
      └── {upload_session_id}/
  ```
- **Naming**: `{uuid}_{timestamp}.{ext}`
- **Max size**: 5MB per image
- **Formats**: JPEG, PNG, WebP
- **Served by**: Nginx with caching headers
- **Upload Strategy**:
  - Client-side compression before upload (target 80% quality for JPEG)
  - Progressive upload with real-time progress indicator
  - Automatic retry on failure (max 3 attempts)
  - Browser-based image resizing to max 2048px on longest side

### API Rate Limits (MVP)
| Endpoint Type | Anonymous | Authenticated |
|--------------|-----------|---------------|
| Auth endpoints | 5/min | 20/min |
| Read endpoints | 30/min | 120/min |
| Write endpoints | 10/min | 60/min |
| Export endpoints | 2/min | 10/min |
| Search endpoints | 20/min | 60/min |

### Rate Limit Implementation
```python
# Rate limit implementation example
from fastapi import HTTPException
from fastapi_limiter import FastAPILimiter
from fastapi_limiter.depends import RateLimiter

# In endpoint definition
@router.get("/recipes", dependencies=[Depends(RateLimiter(times=120, seconds=60))])
async def get_recipes():
    # Anonymous: 30/min, Authenticated: 120/min
    pass
```

## 11. VPS Resource Constraints

### Memory Management (4GB RAM, No Swap)
```
Container Memory Allocation:
- NGINX: 256MB
- FastAPI App: 1GB
- PostgreSQL: 1GB  
- Redis: 512MB (Optional - Phase 1.1)
- Celery Worker: 512MB (Optional - Phase 1.1)
- System Reserved: 768MB
Total: 4GB (3GB for MVP without Redis/Celery)

Memory Optimization:
- Limit PostgreSQL connections to 20
- Use connection pooling aggressively
- Set Redis maxmemory policy to allkeys-lru (when using Redis)
- Limit Uvicorn workers to 1
- Disable PostgreSQL query result caching
- Use Alpine Linux images where possible
```

### Disk Space Management
```
Disk Usage Breakdown:
- OS and Docker: 5GB
- PostgreSQL data: 1GB
- Redis persistence: 100MB (Optional - Phase 1.1)
- Application code: 100MB
- Uploaded images: 3GB
- Backups: 1GB
- Logs: 500MB
- Free space buffer: 2GB
Total: ~13GB (safe for 20GB VPS)
```

### Performance Tuning
```
PostgreSQL Configuration:
- shared_buffers = 256MB
- effective_cache_size = 1GB
- work_mem = 4MB
- max_connections = 20

Redis Configuration (Optional - Phase 1.1):
- maxmemory 400mb
- maxmemory-policy allkeys-lru
- save "" (disable persistence for performance)

Python/FastAPI:
- Single Uvicorn worker
- Async everywhere
- Connection pool size: 10
- Query timeout: 30s
```

## 12. Future Considerations

### Phase 1.1 Implementation (Month 1-2 Post-Launch)
1. **Two-factor authentication (2FA)**
   - TOTP-based authentication
   - Recovery codes generation
   - QR code generation for authenticator apps
   - Security settings UI
2. **Enhanced security features**
   - Session management improvements
   - Security audit logging

### Phase 2 - PWA and Offline Support
1. **Progressive Web App (PWA)**
   - Service worker implementation
   - App manifest for installability
   - Offline-first architecture
   - Background sync for data updates
2. **Offline Functionality**
   - IndexedDB for local storage
   - Cache recipes and trips locally
   - Queue actions when offline
   - Sync when connection restored
3. **Enhanced Mobile Experience**
   - Push notifications
   - Add to home screen
   - Native app-like navigation
   - Offline recipe viewing

### Migration Path (When Needed)
1. **Vertical scaling** first (upgrade VPS to 8GB)
2. **Database optimization** before adding replicas
3. **CDN integration** for static assets
4. **Separate database VPS** when needed
5. **Load balancer** only after 500+ users

### Feature Priorities
1. **Core functionality** stability
2. **Performance optimization** 
3. **Basic social features**
4. **Enhanced export options**
5. **Mobile PWA** improvements (Phase 2)

### Maintenance Strategy
1. **Monthly security updates**
2. **Quarterly dependency updates**
3. **Database vacuum weekly**
4. **Log rotation daily**
5. **Backup verification weekly**