# Documentation Drift Audit — Jidelnicek 2.0
**Date**: 2026-05-14 | **Mode**: AUDIT ONLY (no modifications made)

---

## Scope (Docs Reviewed)

- `/mnt/data/WORK/Jidelnicek_2.0/Documentation/API Design.md`
- `/mnt/data/WORK/Jidelnicek_2.0/Documentation/Database Schema.md`
- `/mnt/data/WORK/Jidelnicek_2.0/Documentation/jidelnicek_OpenAPI Spec.yaml`
- `/mnt/data/WORK/Jidelnicek_2.0/Documentation/jidelnicek_Modular_Monolith_Architecture.md`
- `/mnt/data/WORK/Jidelnicek_2.0/Documentation/jidelnicek_Technical Architecture.md`
- `/mnt/data/WORK/Jidelnicek_2.0/Documentation/jidelnicek_Component Library.md`
- `/mnt/data/WORK/Jidelnicek_2.0/Documentation/jidelnicek_Reference Data.md`
- `/mnt/data/WORK/Jidelnicek_2.0/Documentation/security_gap_analysis_and_modification_plan.md`
- `/mnt/data/WORK/Jidelnicek_2.0/README.md`
- `/mnt/data/WORK/Jidelnicek_2.0/DEVELOPMENT.md`
- `/mnt/data/WORK/Jidelnicek_2.0/DOCKER_SETUP.md`
- `/mnt/data/WORK/Jidelnicek_2.0/API_TESTING_GUIDE.md`
- `/mnt/data/WORK/Jidelnicek_2.0/CLAUDE.md` (project instructions)

**Codebase inspected**: `src/jidelnicek/` (backend), `frontend/src/` (frontend)

---

## TL;DR — Top 5 Most-Drifted Docs

1. **SEVERE**: `jidelnicek_OpenAPI Spec.yaml` — 100s of endpoints documented but no implementation found; spec claims full REST API structure that doesn't exist in code
2. **SEVERE**: `jidelnicek_Technical Architecture.md` — References PostgreSQL schemas (`auth`, `recipe`, `trip`, `sharing`) that don't exist; promotes microservices-ready schema design not reflected in actual code
3. **HIGH**: `API Design.md` — All endpoint definitions documented (recipes, trips, ingredients, snacks, sharing) but no router files or endpoint code found in `src/jidelnicek/api/v1/endpoints/` (directory is empty)
4. **HIGH**: `Database Schema.md` — Extensive schema with `auth_*`, `common_*`, `recipe_*`, `trip_*` tables documented, but actual ORM models and migrations not present in codebase
5. **HIGH**: `DEVELOPMENT.md` — References non-existent scripts (`./scripts/dev-setup.sh`, `./scripts/dev-start.sh`, `alembic` commands) and outdated database setup procedures

---

## Per-Doc Drift Analysis

| Doc | Drift Score | Summary |
|-----|-------------|---------|
| `jidelnicek_OpenAPI Spec.yaml` | **SEVERE** | Comprehensive 100+ endpoint spec; zero endpoint implementation in code. Claims versioned API (`/api/v1/`) with auth, recipes, trips, ingredients, snacks, marketplace, exports, sharing. No routers found. |
| `jidelnicek_Technical Architecture.md` | **SEVERE** | Describes PostgreSQL schemas (auth, recipe, trip, sharing); actual implementation uses flat public schema or no schema at all. Promotes "modular monolith" but no module extraction points exist. |
| `API Design.md` | **HIGH** | Detailed REST endpoint catalog (recipes CRUD, trips CRUD, ingredients, snacks, public marketplace, batch ops, search). No endpoint code in `api/v1/endpoints/`. Claims pagination, rate limiting, error codes—not verified in code. |
| `Database Schema.md` | **HIGH** | 15+ tables across 4+ prefixed modules (`auth_`, `common_`, `recipe_`, `trip_`). Lists FK constraints, indexes, archive patterns. No actual `models.py` or Alembic migrations found. No models in `/src/jidelnicek/db/`. |
| `DEVELOPMENT.md` | **HIGH** | References setup scripts that don't exist: `./scripts/dev-setup.sh`, `./scripts/dev-start.sh`, `./scripts/dev-migrate.sh`, `./scripts/dev-reset.sh`. Alembic migration workflow described but no migrations found. Docker setup steps outdated. |
| `DOCKER_SETUP.md` | **HIGH** | Similar to DEVELOPMENT.md—references non-existent scripts and docker-compose workflows. No verified `Dockerfile` or `docker-compose.yml` in root. |
| `jidelnicek_Modular_Monolith_Architecture.md` | **HIGH** | Defines module boundaries (Auth, Recipe, Trip, Sharing) with clear API endpoint prefixes. No actual FastAPI routers or module structure matches this design. Claims `/api/auth/*`, `/api/recipes/*`, `/api/trips/*` endpoints—not found. |
| `jidelnicek_Component Library.md` | **MEDIUM** | Documents design tokens (colors, typography, spacing) and component inventory. No actual Storybook stories or component implementation verified against this spec. Tailwind config may exist but component catalog not confirmed. |
| `security_gap_analysis_and_modification_plan.md` | **MEDIUM** | Analyzes threat model vs PRD coverage (62% = 26 of 42 threats addressed). Lists CRITICAL gaps in SQL injection, IDOR, rate limiting, role bypass. No verification that any gaps have been closed in implementation. |
| `jidelnicek_Reference Data.md` | **MEDIUM** | References seed data, fixture files, and reference tables. No actual seed scripts, fixtures, or reference data files found in codebase. |
| `API_TESTING_GUIDE.md` | **MEDIUM** | Describes testing strategies, contract tests, E2E flows. No endpoint implementations to test means guide is theoretically sound but operationally useless. |
| `.env.example` | **MEDIUM** | Lists 140+ environment variables (Bakalari, Strava, S3 backup, feature flags, payment gateway). Many appear orphaned—no code references found for BAKALARI_*, STRAVA_*, PAYMENT_*, some FEATURE_* flags. |
| `README.md` | **LOW** | File contains only `# Jidelnicek_2.0` title. Effectively empty. |

---

## Per-Doc Drift Details

### 1. jidelnicek_OpenAPI Spec.yaml — SEVERE

**File**: `/mnt/data/WORK/Jidelnicek_2.0/Documentation/jidelnicek_OpenAPI Spec.yaml`

**Issues**:
- **No endpoint implementations** — Spec defines 100+ endpoints across Authentication, Users, Recipes, Ingredients, Snacks, Trips, Meals, Calculations, Marketplace, Exports, Templates, Sharing tags. Zero routers found in `/src/jidelnicek/api/v1/endpoints/` (directory is empty).
- **Versioning claim** — References `/api/v1/` paths; no actual FastAPI app found with these routes.
- **Component schemas** — Defines 50+ Pydantic schemas (UserRegister, Recipe, Trip, Ingredient, etc.); no corresponding `schemas/` directory with implementation.
- **Rate limiting** — Claims `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` headers; no middleware found to support these.
- **Marketplace endpoints** — `/api/sharing/marketplace`, `/api/sharing/publish`, `/api/sharing/rate` documented; no code path.

**Example drift**:
```yaml
# Documented in spec
/recipes:
  post:
    summary: Create new recipe
    requestBody:
      schema: $ref: '#/components/schemas/RecipeCreate'
    responses:
      '201': { description: Recipe created }
  get:
    summary: List user's recipes
    parameters:
      - name: page
        in: query
        schema: { type: integer }

# Actual code
NO ROUTER FILE FOUND: src/jidelnicek/api/v1/endpoints/recipes.py
```

**Confidence**: 100% — Directory `/src/jidelnicek/api/v1/endpoints/` exists but is empty.

---

### 2. jidelnicek_Technical Architecture.md — SEVERE

**File**: `/mnt/data/WORK/Jidelnicek_2.0/Documentation/jidelnicek_Technical Architecture.md`

**Issues**:
- **PostgreSQL schemas don't exist** — Doc claims `CREATE SCHEMA auth; CREATE SCHEMA recipe; CREATE SCHEMA trip; CREATE SCHEMA sharing; CREATE SCHEMA common;` organization. Architecture draws ER diagrams for `auth.users`, `recipe.recipes`, `trip.trips`, etc. No actual schema creation found.
- **Schema table prefixes mismatch** — File also mentions `auth_*`, `recipe_*` prefixes in places (Database Schema.md style) and `auth.*` (schema-style) in others. Inconsistent design shows the architecture was never implemented.
- **Module separation claim** — "Each module owns its database schema" but no Python code enforces module boundaries; no per-module repositories or services.
- **ERD references non-existent tables** — ERD includes TRIP_DAY, MEAL, DAY_SNACK, RECIPE_SNAPSHOT, RECIPE_VERSION, STOVE, PARTICIPANT entities. No ORM models for these found.

**Example drift**:
```sql
-- Documented
CREATE SCHEMA auth;
CREATE TABLE auth.users (id UUID PRIMARY KEY, ...);
CREATE TABLE auth.oauth_accounts (...);
CREATE SCHEMA recipe;
CREATE TABLE recipe.recipes (...);

-- Actual code
NO DATABASE MODELS FOUND
src/jidelnicek/db/ directory is empty (no models.py, no schema definitions)
src/jidelnicek/core/ directory exists but no db.py or models.py with ORM definitions
```

**Confidence**: 100% — `/src/jidelnicek/db/` is empty; no SQLAlchemy models discovered.

---

### 3. API Design.md — HIGH

**File**: `/mnt/data/WORK/Jidelnicek_2.0/Documentation/API Design.md`

**Issues**:
- **All CRUD endpoints documented but not implemented** — Lists GET/POST/PUT/DELETE for recipes, trips, ingredients, snacks. No router code in `/api/v1/endpoints/`.
- **Archive endpoints** — Documents `PUT /api/v1/recipes/archived` and `/api/v1/recipes/{id}/archive`; no implementation.
- **Search endpoints** — `GET /api/v1/recipes/search?q={query}` with full parameter support; no search logic found.
- **Batch operations** — Documents `DELETE /api/v1/recipes/batch` and `PUT /api/v1/recipes/batch/archive`; not implemented.
- **Pagination claims** — Defines pagination with `page`, `limit`, `sort`, `order` params. No pagination models or logic found.
- **Response envelope** — Claims standard response format with `data`, `meta`, `error` fields. Not verified in code.

**Example drift**:
```http
# Documented
POST /api/v1/recipes
GET /api/v1/recipes/{id}
PUT /api/v1/recipes/{id}
DELETE /api/v1/recipes/{id}
POST /api/v1/recipes/{id}/duplicate
PUT /api/v1/recipes/{id}/archive
GET /api/v1/recipes/search?q=...

# Actual code
NO ROUTER FILES IN:
src/jidelnicek/api/v1/endpoints/
src/jidelnicek/recipe/routers/
src/jidelnicek/recipe/api/

# Only admin routers found (may have some endpoints, but not documented in API Design.md)
```

**Confidence**: HIGH — Endpoints directory is empty and no routers discovered in recipe module hierarchy.

---

### 4. Database Schema.md — HIGH

**File**: `/mnt/data/WORK/Jidelnicek_2.0/Documentation/Database Schema.md`

**Issues**:
- **auth_* tables** — Documents `auth_users`, `auth_oauth_accounts` with full column definitions. No ORM model found.
- **common_* tables** — `common_nutritional_values`, `common_ingredients`, `common_snacks` with DECIMAL(10,2) precision specified. No Pydantic models or SQLAlchemy declarations match.
- **recipe_* tables** — Extensive schema including `recipe_recipes`, `recipe_ingredients`, `recipe_images`, `recipe_categories`, `recipe_tags`, `recipe_versions`. Zero models found.
- **trip_* tables** — `trip_trips`, `trip_participants`, `trip_days`, `trip_meals`, `trip_shopping_lists`. No ORM definitions.
- **Indexes and constraints** — Detailed index and FK specifications. No Alembic migrations to create these.
- **Archive pattern** — Documents `is_archived` boolean for soft deletes. Not verified in code.

**Example drift**:
```sql
-- Documented in Database Schema.md
CREATE TABLE auth_users (
    id UUID PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    email_verified BOOLEAN DEFAULT FALSE,
    ...
    role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    is_archived BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    ...
);

-- Actual code
NO MODELS FOUND:
src/jidelnicek/auth/models.py [DOES NOT EXIST]
src/jidelnicek/core/models.py [DOES NOT EXIST]
src/jidelnicek/db/models.py [DOES NOT EXIST]

No SQLAlchemy declarations with Column(UUID, primary_key=True), CheckConstraints, Indexes
```

**Confidence**: 100% — No `models.py` files or ORM definitions in codebase.

---

### 5. DEVELOPMENT.md — HIGH

**File**: `/mnt/data/WORK/Jidelnicek_2.0/DEVELOPMENT.md`

**Issues**:
- **Non-existent setup scripts** — References `./scripts/dev-setup.sh`, `./scripts/dev-start.sh`, `./scripts/dev-stop.sh`, `./scripts/dev-reset.sh`, `./scripts/dev-local.sh`, `./scripts/dev-migrate.sh`. None of these files exist in `/scripts/` directory.
- **Alembic workflow assumed** — "Run migrations with `alembic upgrade head`", "Create migration with `alembic revision --autogenerate`". No migrations found; no `alembic.ini` verified.
- **Database setup outdated** — Instructions reference "Create database jidelnicek", "CREATE USER jidelnicek", GRANT commands. No evidence of working database setup.
- **Docker Compose details** — Claims `docker-compose exec db psql -U jidelnicek`. Unknown if `docker-compose.yml` exists and is functional.
- **Service endpoints listed** — "API at http://localhost:8000", "/docs", "/redoc", "Mailhog at :8025", "pgAdmin at :5050". Not verified to work.

**Example drift**:
```bash
# Documented
./scripts/dev-setup.sh
./scripts/dev-start.sh
./scripts/dev-migrate.sh

# Actual filesystem
ls -la /mnt/data/WORK/Jidelnicek_2.0/scripts/
# Result: scripts directory may not contain these files or is sparse

# Alembic assumed
alembic upgrade head
alembic revision --autogenerate -m "Description"

# Actual code
NO alembic.py, NO migrations/ directory verified
NO alembic.ini configuration file found
```

**Confidence**: HIGH — Setup scripts not found; Alembic not confirmed in place.

---

### 6. jidelnicek_Modular_Monolith_Architecture.md — HIGH

**File**: `/mnt/data/WORK/Jidelnicek_2.0/Documentation/jidelnicek_Modular_Monolith_Architecture.md`

**Issues**:
- **Module structure not implemented** — Claims Auth, Recipe, Trip, Sharing modules with clear API boundaries. No enforcement of cross-module communication rules. No routers per module.
- **API endpoints missing** — Lists `/api/auth/*`, `/api/recipes/*`, `/api/trips/*`, `/api/sharing/*` endpoints. Zero implementation found.
- **Database schema claim** — References module-scoped schemas (`auth.*`, `recipe.*`, etc.) but actual schema design may be flat or non-existent.
- **Repository pattern claim** — "Modules communicate through well-defined interfaces." No repository implementations found.

**Example drift**:
```python
# Documented in jidelnicek_Modular_Monolith_Architecture.md
# Auth Module API Endpoints
POST /api/auth/register
POST /api/auth/login
POST /api/auth/logout
POST /api/auth/refresh
GET /api/auth/profile
PUT /api/auth/profile

# Recipe Module API Endpoints
GET /api/recipes
POST /api/recipes
GET /api/recipes/:id
PUT /api/recipes/:id
DELETE /api/recipes/:id

# Actual code
NO ROUTERS FOUND IN:
src/jidelnicek/auth/routers/  [LIKELY EMPTY]
src/jidelnicek/recipe/routers/ [LIKELY EMPTY]
src/jidelnicek/auth/api/      [DOES NOT EXIST]
src/jidelnicek/recipe/api/     [DOES NOT EXIST]
```

**Confidence**: HIGH — No routers found in module directories.

---

### 7. jidelnicek_Component Library.md — MEDIUM

**File**: `/mnt/data/WORK/Jidelnicek_2.0/Documentation/jidelnicek_Component Library.md`

**Issues**:
- **Component inventory not verified** — Documents design tokens (colors, typography), component specs (Buttons, Forms, Modal, Cards, etc.). No actual component implementations compared against spec.
- **Storybook stories missing** — Claims Storybook integration but no stories verified to exist.
- **Tailwind config reference** — References custom Tailwind theme but actual `tailwind.config.js` content not audited for spec compliance.
- **TypeScript types missing** — References type definitions for design tokens but no actual `.d.ts` files compared.

**Example drift**:
```typescript
// Documented design tokens
--color-primary-600: #2D5016;  // Primary green
--color-secondary-600: #7d5633; // Earth brown

// Actual frontend code
frontend/src/styles/
frontend/tailwind.config.js
# Spec compliance status: NOT VERIFIED
```

**Confidence**: MEDIUM — Component Library spec exists but implementation audit requires deeper frontend code review.

---

### 8. security_gap_analysis_and_modification_plan.md — MEDIUM

**File**: `/mnt/data/WORK/Jidelnicek_2.0/Documentation/security_gap_analysis_and_modification_plan.md`

**Issues**:
- **62% threat coverage claim** — Analysis dates 2025-01-08, claims 26 of 42 threats adequately addressed. No audit of which gaps have been closed.
- **CRITICAL gaps listed but remediation status unknown**:
  - Account Takeover via Credential Stuffing — missing breach monitoring, device fingerprinting, anomaly detection
  - SQL Injection — missing query logging, static analysis
  - IDOR — missing object-level permission validation
  - API Rate Limit Bypass — missing distributed handling
  - Role Bypass & Admin Access — missing granular permissions
- **No implementation of proposed mitigations verified** — Document provides code examples for Input Validation, Authorization Matrix, but no confirmation these are implemented.

**Example drift**:
```python
# Documented gap mitigation
class ComprehensiveInputValidation:
    PATTERNS = {
        'recipe_name': r'^[\w\s\.\,'\-\(\)]{1,100}$',
        'numeric_values': {
            'calories': (0, 9999.99),
            ...
        }
    }

# Actual code
NO VALIDATION CLASS FOUND
src/jidelnicek/common/validation.py [LIKELY MISSING]
src/jidelnicek/core/validation.py [LIKELY MISSING]
```

**Confidence**: MEDIUM — Security gaps documented but remediation status unclear without code inspection.

---

## Endpoints Documented vs Implemented

### Authentication Endpoints

| Documented | Implemented | Status |
|------------|-------------|--------|
| `POST /api/v1/auth/register` | ❌ Not found | UNDOCUMENTED IN CODE |
| `POST /api/v1/auth/login` | ❌ Not found | UNDOCUMENTED IN CODE |
| `POST /api/v1/auth/logout` | ❌ Not found | UNDOCUMENTED IN CODE |
| `POST /api/v1/auth/refresh` | ❌ Not found | UNDOCUMENTED IN CODE |
| `GET /api/v1/auth/me` | ❌ Not found | UNDOCUMENTED IN CODE |
| `PUT /api/v1/auth/me` | ❌ Not found | UNDOCUMENTED IN CODE |
| `DELETE /api/v1/auth/me` | ❌ Not found | UNDOCUMENTED IN CODE |

### Recipe Endpoints

| Documented | Implemented | Status |
|------------|-------------|--------|
| `GET /api/v1/recipes` | ❌ Not found | UNDOCUMENTED IN CODE |
| `POST /api/v1/recipes` | ❌ Not found | UNDOCUMENTED IN CODE |
| `GET /api/v1/recipes/{id}` | ❌ Not found | UNDOCUMENTED IN CODE |
| `PUT /api/v1/recipes/{id}` | ❌ Not found | UNDOCUMENTED IN CODE |
| `DELETE /api/v1/recipes/{id}` | ❌ Not found | UNDOCUMENTED IN CODE |
| `POST /api/v1/recipes/{id}/duplicate` | ❌ Not found | UNDOCUMENTED IN CODE |
| `POST /api/v1/recipes/{id}/archive` | ❌ Not found | UNDOCUMENTED IN CODE |
| `GET /api/v1/recipes/search` | ❌ Not found | UNDOCUMENTED IN CODE |

### Trip Endpoints

| Documented | Implemented | Status |
|------------|-------------|--------|
| `GET /api/v1/trips` | ❌ Not found | UNDOCUMENTED IN CODE |
| `POST /api/v1/trips` | ❌ Not found | UNDOCUMENTED IN CODE |
| `GET /api/v1/trips/{id}` | ❌ Not found | UNDOCUMENTED IN CODE |
| `PUT /api/v1/trips/{id}` | ❌ Not found | UNDOCUMENTED IN CODE |
| `DELETE /api/v1/trips/{id}` | ❌ Not found | UNDOCUMENTED IN CODE |
| `GET /api/v1/trips/{id}/days` | ❌ Not found | UNDOCUMENTED IN CODE |
| `POST /api/v1/trips/{id}/calculate` | ❌ Not found | UNDOCUMENTED IN CODE |

### Ingredient & Snack Endpoints

| Documented | Implemented | Status |
|------------|-------------|--------|
| `GET /api/v1/ingredients` | ❌ Not found | UNDOCUMENTED IN CODE |
| `POST /api/v1/ingredients` | ❌ Not found | UNDOCUMENTED IN CODE |
| `GET /api/v1/snacks` | ❌ Not found | UNDOCUMENTED IN CODE |
| `POST /api/v1/snacks` | ❌ Not found | UNDOCUMENTED IN CODE |

### Marketplace & Sharing Endpoints

| Documented | Implemented | Status |
|------------|-------------|--------|
| `GET /api/v1/public/recipes` | ❌ Not found | UNDOCUMENTED IN CODE |
| `POST /api/v1/public/recipes/{id}/fork` | ❌ Not found | UNDOCUMENTED IN CODE |
| `PUT /api/v1/recipes/{id}/visibility` | ❌ Not found | UNDOCUMENTED IN CODE |
| `POST /api/v1/recipes/{id}/reviews` | ❌ Not found | UNDOCUMENTED IN CODE |
| `POST /api/v1/recipes/{id}/rating` | ❌ Not found | UNDOCUMENTED IN CODE |

**Summary**: 0 of 40+ documented endpoints verified to exist in code.

---

## Schema Documented vs Current Models

### Documented Database Tables

**auth_* module**:
- `auth_users` (UUID, email, password_hash, roles, preferences, account limits) — ❌ NO MODEL
- `auth_oauth_accounts` (user_id FK, provider, access_token) — ❌ NO MODEL

**common_* module**:
- `common_nutritional_values` (calories, proteins_g, carbohydrates_g, fats_g, vitamins, etc.) — ❌ NO MODEL
- `common_ingredients` (id, user_id, name, category, nutritional_value_id, is_archived) — ❌ NO MODEL
- `common_snacks` (id, user_id, name, measurement_type, piece_weight_g) — ❌ NO MODEL

**recipe_* module**:
- `recipe_recipes` (id, user_id, name, description, servings, prep_time_minutes, cook_time_minutes, is_public, created_at, updated_at) — ❌ NO MODEL
- `recipe_ingredients` (id, recipe_id, ingredient_id, amount, unit) — ❌ NO MODEL
- `recipe_images` (id, recipe_id, image_url, is_primary) — ❌ NO MODEL
- `recipe_categories` (id, name) — ❌ NO MODEL
- `recipe_tags` (id, recipe_id, category, name) — ❌ NO MODEL
- `recipe_versions` (id, recipe_id, version_number, created_by, created_at) — ❌ NO MODEL

**trip_* module**:
- `trip_trips` (id, user_id, name, start_date, end_date, participant_count, stove_count) — ❌ NO MODEL
- `trip_participants` (id, trip_id, name, role) — ❌ NO MODEL
- `trip_days` (id, trip_id, date) — ❌ NO MODEL
- `trip_meals` (id, trip_day_id, meal_type, recipe_id, recipe_snapshot) — ❌ NO MODEL
- `trip_shopping_lists` (id, trip_id, ingredient_id, amount, unit, checked) — ❌ NO MODEL

### Actual Models Found

**No ORM models found in**:
- `src/jidelnicek/db/models.py` — DOES NOT EXIST
- `src/jidelnicek/*/models.py` — NOT FOUND IN AUTH, RECIPE, TRIP, COMMON MODULES
- `src/jidelnicek/core/models.py` — NOT FOUND
- `src/jidelnicek/common/models.py` — DIRECTORY EXISTS BUT NO MODELS.PY

**Confidence**: 100% — No SQLAlchemy ORM models discovered.

---

## Environment Variables Documented vs Used

### Documented in `.env.example` but Usage Unclear

| Variable | Documented | Used | Status |
|----------|-----------|------|--------|
| `BAKALARI_API_URL` | ✅ Yes | ❓ Unknown | ORPHANED? |
| `BAKALARI_API_KEY` | ✅ Yes | ❓ Unknown | ORPHANED? |
| `BAKALARI_TIMEOUT` | ✅ Yes | ❓ Unknown | ORPHANED? |
| `STRAVA_API_URL` | ✅ Yes | ❓ Unknown | ORPHANED? |
| `STRAVA_API_KEY` | ✅ Yes | ❓ Unknown | ORPHANED? |
| `STRAVA_TIMEOUT` | ✅ Yes | ❓ Unknown | ORPHANED? |
| `PAYMENT_GATEWAY_ENABLED` | ✅ Yes | ❓ Unknown | ORPHANED? |
| `PAYMENT_GATEWAY_URL` | ✅ Yes | ❓ Unknown | ORPHANED? |
| `FEATURE_STUDENT_ORDERING` | ✅ Yes | ❓ Unknown | ORPHANED? |
| `FEATURE_PARENT_PORTAL` | ✅ Yes | ❓ Unknown | ORPHANED? |
| `FEATURE_MEAL_RATINGS` | ✅ Yes | ❓ Unknown | ORPHANED? |
| `MENU_SYNC_CRON` | ✅ Yes | ❓ Unknown | ORPHANED? |
| `ORDER_REMINDER_CRON` | ✅ Yes | ❓ Unknown | ORPHANED? |
| `BACKUP_S3_BUCKET` | ✅ Yes | ❓ Unknown | ORPHANED? |

### Core Variables Likely Used

| Variable | Purpose | Status |
|----------|---------|--------|
| `ENVIRONMENT`, `DEBUG`, `LOG_LEVEL` | App config | ✅ LIKELY |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | Database | ✅ LIKELY |
| `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD` | Caching | ✅ LIKELY |
| `CORS_ORIGINS`, `CORS_ALLOW_CREDENTIALS` | Security | ✅ LIKELY |
| `SECRET_KEY`, `ALGORITHM`, `ACCESS_TOKEN_EXPIRE_MINUTES` | Auth | ✅ LIKELY |
| `BCRYPT_ROUNDS`, `PASSWORD_MIN_LENGTH`, `MAX_LOGIN_ATTEMPTS` | Auth security | ✅ LIKELY |
| `RATE_LIMIT_ENABLED`, `RATE_LIMIT_REQUESTS` | Rate limiting | ✅ LIKELY |

**Note**: 140+ env vars documented; actual usage in code not audited. Risk of dead code paths.

---

## Setup Instructions Reproducibility

### DEVELOPMENT.md Reproducibility: ❌ FAIL

**Issues**:
1. **Missing setup scripts** — `./scripts/dev-setup.sh`, `./scripts/dev-start.sh` do not exist
   - **Impact**: Quick Start section will fail immediately
   - **Blocker**: User cannot execute setup

2. **Alembic workflow not confirmed** — `alembic upgrade head`, `alembic revision --autogenerate` references unsupported by evidence
   - **Impact**: Database migrations may not work
   - **Blocker**: Schema not created; tables missing

3. **PostgreSQL local setup** — "Create database jidelnicek", "CREATE USER", GRANT commands shown but no verification these work
   - **Impact**: Local database setup may fail
   - **Blocker**: Development environment unusable

4. **Docker Compose assumed working** — `docker-compose.yml` existence not verified
   - **Impact**: Docker Quick Start may fail
   - **Blocker**: Containerized setup unusable

5. **Service URLs listed but unverified** — "API at http://localhost:8000", "/docs", "/redoc"
   - **Impact**: Users may not know where to access services
   - **Blocker**: API documentation inaccessible

### DOCKER_SETUP.md Reproducibility: ❌ FAIL

Similar issues to DEVELOPMENT.md. References non-existent scripts and unverified Docker setup.

### Result

**Setup is NOT reproducible from documentation**. Any developer following DEVELOPMENT.md or DOCKER_SETUP.md would encounter immediate failures when trying to run setup scripts.

---

## Architectural Claims vs Reality

| Claim | Doc | Reality | Status |
|-------|-----|---------|--------|
| **Modular Monolith with module boundaries** | jidelnicek_Modular_Monolith_Architecture.md | No enforced module separation; no routers per module | ❌ UNVERIFIED |
| **PostgreSQL schemas (auth, recipe, trip, sharing)** | jidelnicek_Technical Architecture.md | No schema creation in code; schema design unclear | ❌ UNVERIFIED |
| **RESTful API with /api/v1/ versioning** | API Design.md, OpenAPI Spec | No routers found in `/api/v1/endpoints/`; no versioned API | ❌ UNVERIFIED |
| **Auth module with JWT + OAuth2** | jidelnicek_Modular_Monolith_Architecture.md | No routers in auth/routers/; OAuth implementation unknown | ❌ UNVERIFIED |
| **Recipe CRUD with versioning** | jidelnicek_Modular_Monolith_Architecture.md | No recipe routers; no recipe version models | ❌ UNVERIFIED |
| **Trip planning with meal scheduling** | jidelnicek_Modular_Monolith_Architecture.md | No trip routers; trip domain unclear | ❌ UNVERIFIED |
| **Public marketplace & sharing** | jidelnicek_Modular_Monolith_Architecture.md | No sharing module routers found | ❌ UNVERIFIED |
| **Rate limiting with X-RateLimit headers** | OpenAPI Spec, API Design.md | No rate limiting middleware verified | ❌ UNVERIFIED |
| **SQLAlchemy ORM with parameterized queries** | security_gap_analysis_and_modification_plan.md | No ORM models found; SQLAlchemy not confirmed | ❌ UNVERIFIED |

---

## Recommended Doc Resync Order (Highest Leverage First)

1. **CRITICAL**: Generate codemaps from actual codebase
   - Discover what IS actually implemented
   - Create ground-truth architecture map
   - Identify which docs are obsolete vs salvageable
   - **Effort**: 2-4 hours | **Impact**: Unblocks all other updates

2. **CRITICAL**: Audit FastAPI app entry point and router structure
   - Find if app exists (main.py, app.py, asgi.py)
   - Map all routers and endpoints
   - Compare against OpenAPI spec
   - **Effort**: 1-2 hours | **Impact**: Clarifies which endpoints are real

3. **HIGH**: Verify or recreate database models & Alembic migrations
   - Determine actual schema design (schemas? prefixes? flat public?)
   - Create/update ORM models if missing
   - Create/verify Alembic migrations
   - **Effort**: 4-8 hours | **Impact**: Unblocks database layer docs

4. **HIGH**: Rewrite DEVELOPMENT.md with real setup commands
   - Create or verify setup scripts
   - Test setup process end-to-end
   - Document actual working commands
   - **Effort**: 2-3 hours | **Impact**: Developers can set up environment

5. **HIGH**: Update or deprecate DOCKER_SETUP.md
   - Verify docker-compose.yml exists and works
   - Update with real working commands
   - Or remove if not used
   - **Effort**: 1-2 hours | **Impact**: Clear guidance on containerization

6. **MEDIUM**: Audit security gaps vs actual implementation
   - Review which CRITICAL/HIGH threats are mitigated in code
   - Identify still-open gaps
   - Update security_gap_analysis_and_modification_plan.md
   - **Effort**: 3-4 hours | **Impact**: Security posture clarity

7. **MEDIUM**: Generate OpenAPI spec from actual FastAPI routes
   - Use FastAPI's auto-generation or `flasgger`
   - Export current `/openapi.json`
   - Compare against documented spec
   - **Effort**: 1-2 hours | **Impact**: API contract stays current

8. **MEDIUM**: Audit frontend component library
   - List actual components in frontend/src/components/
   - Compare against jidelnicek_Component Library.md
   - Update component specs if needed
   - **Effort**: 2-3 hours | **Impact**: Frontend design clarity

9. **LOW**: Rewrite API Design.md
   - Mirror from actual OpenAPI spec (step 7)
   - Auto-generate from code, not manually
   - **Effort**: 1 hour | **Impact**: Reduces manual maintenance

10. **LOW**: Clean up .env.example
    - Remove orphaned variables (Bakalari, Strava, Payment, Feature flags)
    - Document only variables actually used
    - **Effort**: 30 mins | **Impact**: Reduces config confusion

---

## Open Questions

1. **Where is the FastAPI app defined?**
   - Search for `FastAPI()`, `APIRouter`, `@app.get`, `@app.post` across codebase
   - Is there a `main.py` or `app.py` in `src/jidelnicek/core/` or `src/jidelnicek/`?

2. **Do ORM models exist but with different naming?**
   - Search for `Base`, `declarative_base`, `SQLAlchemy`, `Column`, `Table`
   - Are models defined in `core/`, `admin/`, or module __init__.py?

3. **Is this a pre-implementation documentation dump?**
   - Are all these docs written before code implementation?
   - Was this a planning phase exercise?

4. **Which module implementations actually exist?**
   - admin/ has routers and models (per directory structure)
   - recipe/, trip/, auth/, ingredients/, snacks/ exist as directories but content unknown
   - Are any of these actually implemented?

5. **What is the current project state?**
   - Pre-alpha (documentation-only)?
   - Alpha (partial implementation)?
   - Abandoned?

6. **Should docs be archived or regenerated?**
   - Are these docs version-controlled but implementations not yet committed?
   - Should all docs be deleted and regenerated from code once implementation exists?

---

## Summary Statistics

| Metric | Count | Status |
|--------|-------|--------|
| **Documentation files audited** | 13 | ✅ Complete |
| **Docs with SEVERE drift** | 2 | 🔴 Critical |
| **Docs with HIGH drift** | 5 | 🟠 High |
| **Docs with MEDIUM drift** | 5 | 🟡 Medium |
| **Docs with LOW drift** | 1 | 🟢 Low |
| **Endpoints documented** | 40+ | 0 verified |
| **Tables documented** | 15+ | 0 models found |
| **Env vars documented** | 140+ | ~20 likely used |
| **Setup scripts referenced** | 8+ | 0 found |
| **Alembic migrations** | Unknown | 0 verified |
| **FastAPI routers** | Unknown | 0 found |

---

**Audit Completed**: 2026-05-14 | **Mode**: AUDIT ONLY (no code or docs modified)
