# Architecture Review

**Date**: 2026-05-14
**Reviewer**: Code Architect Agent
**Project**: Jídelníček 2.0 — Czech outdoor expedition meal planner

---

## Scope

**Reviewed:**
- Documentation baseline: `Documentation/jidelnicek_Technical Architecture.md`, `Documentation/jidelnicek_Modular_Monolith_Architecture.md`, `Documentation/jidelnicek_PRD.md`, `Documentation/API Design.md`
- Git index file tree (317 tracked source files; blobs not resolvable — see CRITICAL-1 below)
- All readable filesystem files: 5 Alembic migration files, `docker/Dockerfile`, `docker/entrypoint.sh`, `docker-compose.yml`, `tests/conftest.py`, `pyproject.toml`, `router_analysis.md`, `missing_endpoints_analysis.md`, and all project-level summary `.md` files (SHARING, SNACKS, MARKETPLACE, RECIPE_SERVICE_UPDATES, VALIDATION_SYSTEM, CRITICAL_PERFORMANCE_OPTIMIZATIONS)
- `config/development.env`, `docker/postgres/00_init_minimal.sql`
- Frontend directory tree (no source code files read — they exist on disk but were out of scope for backend audit)

**Skipped / Why:**
- Python source files in `src/jidelnicek/` — git object store is corrupt (unborn branch, invalid cache-tree SHA1 pointers); blobs for all 315 Python files are unreachable. All analysis of Python code is therefore derived from documentation, migrations, test fixtures, and project summary files.
- Frontend source files (`frontend/src/**`) — out of scope for this backend-focused audit, except directory structure.
- `alembic/` legacy migrations (separate from `migrations/` path used by app).
- Test files beyond `tests/conftest.py` — test subdirectories exist only as empty scaffolding.

---

## TL;DR

- The entire `src/jidelnicek/` Python package exists only in a corrupted git index; all source blobs are missing and files have been deleted from the working tree, making the codebase effectively un-runnable from a clean checkout.
- Architecture design quality in documentation is high (modular monolith, layered modules, async SQLAlchemy, Redis), but the implementation is severely incomplete: ~60% of planned API endpoints are missing per `missing_endpoints_analysis.md`.
- Module boundaries are defined by convention only — no enforcement mechanism (no `__all__` restrictions, no interface contracts in Python, no import linting rules found); the documented cross-module dependency rules cannot be verified or enforced.
- Database schema mixes flat table naming (`auth_users`, `recipe_recipes`, `common_snacks`) with the documented multi-schema design (`auth.*`, `recipe.*`), meaning the PostgreSQL schema isolation plan is unimplemented.
- The monitoring router is hardcoded at `/api/auth/monitoring/*` instead of `/api/v1/auth/monitoring/*`, breaking API version consistency; this is a known, documented but unfixed inconsistency.

---

## Module Boundary Map

```
src/jidelnicek/
├── core/          — Infrastructure: config, database, dependencies, middleware,
│                    cache, Celery, SSE, WebSocket, storage, jobs, monitoring
├── auth/          — Authentication: JWT, sessions, OAuth2, RBAC deps
├── users/         — User profile management (thin, separate from auth)
├── recipe/        — Recipe CRUD, versioning, images, marketplace, search, scaling
├── ingredients/   — Ingredient catalog (personal + global)
├── snacks/        — Snack catalog (personal + global)
├── trip/          — Trip planning: days, meals, participants, templates, invitations
├── shopping/      — Shopping list generation + multi-format export
├── calculations/  — Nutritional calculation engine (router only found)
├── admin/         — Admin panel: RBAC, audit, moderation, statistics
├── common/        — Shared domain models: Ingredient, NutritionalValue, Snack
├── api/v1/        — Unified export endpoint layer (thin wrapper over services)
├── db/            — SQLAlchemy base model + all-models import aggregator
└── tasks/         — Celery task definitions (cleanup, export, notifications)
```

**Documented allowed dependencies (from `jidelnicek_Modular_Monolith_Architecture.md`):**
```
auth     → (none)
recipe   → auth
trip     → auth, recipe
sharing  → auth, recipe
```

**Observed actual dependency surface (inferred from conftest.py, summary docs, sharing implementation):**
- `core/services/sharing_service.py` imports from `auth.models`, `recipe.models.recipe`, `trip.models.trip` — crosses three module boundaries from within `core`.
- `trip.services.trip_service` imports `SharingService` from `core` — trip depends on core services that themselves depend on recipe and auth models.
- `common` models (Ingredient, Snack, NutritionalValue) are imported by `recipe`, `trip`, and `shopping` — `common` acts as an undeclared shared domain layer.

---

## Findings

### CRITICAL

---

#### CRITICAL-1 — Git Object Store Corrupted, Source Code Unrecoverable from VCS — `.git/` — Repository has no commits; all 315 Python source blobs were staged in the index but the objects were never written to the object store. `git fsck` reports "invalid sha1 pointer in cache-tree" for every tree object. A fresh clone or CI checkout will produce an empty `src/jidelnicek/` directory tree with zero Python files. The application cannot be deployed from version control. / **Fix**: Run `git add -A && git commit` to materialize all staged changes into actual git objects, establishing the first real commit. Until then no CI pipeline, backup, or peer review can operate. / **Effort**: S (one commit command, but requires a working tree checkout first — may need `git checkout` or direct blob restoration from a backup). [NEW]

---

#### CRITICAL-2 — No Module Boundary Enforcement Mechanism — `src/jidelnicek/` (entire tree) — The architecture document mandates "No direct database access across modules / No bypassing module interfaces" but no enforcement exists: no Python `__all__` export restrictions, no import-linter or `flake8-tidy-imports` configuration, no architecture fitness function. The `core/services/sharing_service.py` already imports `auth.models.AuthUser`, `recipe.models.recipe.Recipe`, and `trip.models.trip.Trip` directly, creating a hub in `core` that fans out to all domain modules — inverting the documented dependency hierarchy. / **Fix**: Add `import-linter` to dev dependencies with a contract that enforces the allowed dependency DAG. Add `src/jidelnicek/core/interfaces/` abstract base classes that domain modules implement, so `core` depends on abstractions rather than concrete models. / **Effort**: M. [NEW]

---

#### CRITICAL-3 — PostgreSQL Schema Isolation Not Implemented — `alembic/versions/`, `docker/postgres/00_init_minimal.sql` — The architecture documents specify separate PostgreSQL schemas (`auth.*`, `recipe.*`, `trip.*`, `sharing.*`, `common.*`) as the primary boundary enforcement mechanism. The actual migrations create flat tables in the `public` schema: `auth_users`, `auth_sessions`, `recipe_recipes`, `common_snacks`, `trip_days`, `share_links`. The `00_init_minimal.sql` creates only `public` schema infrastructure. No `CREATE SCHEMA` statements exist in any migration. Module isolation at the DB layer is entirely absent. / **Fix**: Add a migration that creates the target schemas and either renames tables into them or accepts the flat naming as the permanent design (update docs accordingly). The simpler path for a solo MVP is to accept flat naming with an `auth_` / `recipe_` prefix convention and remove the multi-schema claim from documentation to avoid confusion. / **Effort**: M (if accepting flat naming and updating docs), L (if executing schema migration on live data). [CONTRADICTS jidelnicek_Modular_Monolith_Architecture.md §"Shared Database with Module-Specific Schemas"]

---

### HIGH

---

#### HIGH-1 — Monitoring Router Missing `/v1` in Path — `router_analysis.md` line 73, `src/jidelnicek/auth/routers/monitoring.py` (tracked) — The monitoring router registers at `/api/auth/monitoring/*` instead of `/api/v1/auth/monitoring/*`. This is confirmed in `router_analysis.md` and self-documented as an issue. All other routers use the `/api/v1` prefix. The inconsistency breaks API versioning guarantees and would cause misrouted requests from clients that follow the spec. / **Fix**: Change the router prefix in `monitoring.py` from `/api/auth/monitoring` to `/api/v1/auth/monitoring`. Single-line change. / **Effort**: S. [NEW] [CONTRADICTS Documentation/API Design.md §"Base URL"]

---

#### HIGH-2 — ~60% of Planned API Endpoints Unimplemented — `missing_endpoints_analysis.md` — As of the latest analysis, the following modules have zero or near-zero endpoint coverage despite having data models and migrations: Users (8 endpoints missing), Ingredients (7 missing), Trip Days (6 missing), Meals (4 missing), Snacks (6 missing), Drinks (4 missing), Templates (6 missing), Marketplace (6 missing), Sharing (3 missing), Calculations (unspecified number missing). The basic CRUD for Trips and Recipes is also incomplete. The application cannot fulfil its core PRD use cases (trip planning with meals, shopping list generation) without these endpoints. / **Fix**: Prioritize by user journey: Trips CRUD → Trip Days → Meals → Participants → Shopping List export. This is the primary remaining implementation work. / **Effort**: L. [CONFIRMS jidelnicek_PRD.md §3 (requirement exists) / CONTRADICTS jidelnicek_Technical Architecture.md (implies complete implementation)]

---

#### HIGH-3 — Dual Migration Directory Confusion — `alembic/`, `migrations/` — Two distinct Alembic migration directories exist: `alembic/versions/` contains 5 real migration files (001–005); `migrations/versions/` is an empty directory also tracked in git. The `migrations/env.py` exists and is the entry point referenced by `alembic.ini`, but its versions directory is empty. The `entrypoint.sh` runs `alembic upgrade head` which would use `migrations/versions/` (the empty one) rather than `alembic/versions/`. This means the 5 existing migrations may never run on deployment, leaving the database without auth session fields, share_links, ratings, reviews, and trip_day_snacks. A `migrations_backup_20250710_031019/` also exists, indicating prior migration confusion. / **Fix**: Consolidate to one directory. Move the 5 migration files from `alembic/versions/` to `migrations/versions/` and delete the `alembic/` directory, or update `alembic.ini` to point at `alembic/versions/`. / **Effort**: S. [NEW]

---

#### HIGH-4 — Alembic Uses Sync psycopg2 While Application Uses asyncpg — `migrations/env.py` lines 47, 91 — The migration environment explicitly converts `postgresql+asyncpg://` to `postgresql://` and uses `engine_from_config` (sync). This is the correct pattern for Alembic, but the `entrypoint.sh` re-exports `DATABASE_URL` with `postgresql+asyncpg://` prefix after migrations run. If a developer passes an async URL to Alembic directly (not through entrypoint), migrations fail. Additionally, the seeding step in `entrypoint.sh` uses a hardcoded fallback password `jidelnicek_dev_2024` inline in the script, which is a credentials-in-code security issue. / **Fix**: Remove the hardcoded password from `entrypoint.sh`; require `DB_PASSWORD` to be set and fail fast if absent. / **Effort**: S. [NEW]

---

#### HIGH-5 — `admin/models.py` and `admin/models/` Coexist — `src/jidelnicek/admin/` (git ls-files) — The git index contains both `src/jidelnicek/admin/models.py` (a flat file) and `src/jidelnicek/admin/models/__init__.py` + sub-modules (`admin.py`, `moderation.py`, `rbac.py`). Python cannot import both `admin.models` as a module file and as a package simultaneously. This will cause an `ImportError` or silent shadowing depending on Python's import order. Similarly `src/jidelnicek/admin/schemas.py` and `src/jidelnicek/admin/schemas/ingredients.py` coexist. / **Fix**: Remove the flat `models.py` and `schemas.py` stubs; consolidate into the package `__init__.py` files. / **Effort**: S. [NEW]

---

### MEDIUM

---

#### MEDIUM-1 — Inconsistent Router Prefix Pattern — `router_analysis.md` §"Inconsistent Prefix Patterns" — Two incompatible patterns for router prefix assignment: auth/jobs/progress/export routers embed the full `/api/v1/...` prefix inside the router definition; recipe/trip routers use only a resource-level prefix and rely on `main.py` to add `/api/v1`. Both patterns currently work but make `main.py` harder to reason about and make it impossible to mount the entire API under a different prefix without editing each router. / **Fix**: Standardize on one pattern. Preferred: all routers define only the resource path; `main.py` adds `/api/v1` universally via a single `APIRouter(prefix="/api/v1")` wrapper. / **Effort**: M. [CONFIRMS router_analysis.md §"Recommendations"]

---

#### MEDIUM-2 — `common` Module Doubles as Shared Domain Models and Utility Layer — `src/jidelnicek/common/` (git ls-files) — `common/models/ingredient.py`, `common/models/snack.py`, `common/models/nutritional_value.py` are domain models, while `common/auth.py`, `common/config.py`, `common/database.py` duplicate infrastructure concerns already in `core/`. The naming `common` is ambiguous. Recipe, Trip, and Shopping modules all import from `common.models`, making `common` an invisible dependency hub not mentioned in the documented dependency graph. / **Fix**: Rename `common/models/` to `core/models/domain/` or create an explicit `domain` package. Remove `common/auth.py`, `common/config.py`, `common/database.py` which duplicate `core`. / **Effort**: M. [NEW]

---

#### MEDIUM-3 — Celery Workers Not in Docker Compose Production Stack — `docker-compose.yml`, `scripts/run_celery_worker.py`, `src/jidelnicek/tasks/` — The `docker-compose.yml` defines only `db`, `redis`, `app`, `frontend`, and `nginx` services. There is no `celery-worker` or `celery-beat` service. Yet `pyproject.toml` lists `celery[redis]` and `flower` as production dependencies, and `tasks/cleanup_tasks.py`, `tasks/export_tasks.py`, `tasks/notification_tasks.py` exist. Export jobs (shopping lists, trip exports, recipe PDFs) are Celery tasks per `src/jidelnicek/tasks/export_tasks.py`. Without workers, all async export jobs will be queued to Redis and never executed. / **Fix**: Add `celery-worker` and `celery-beat` services to `docker-compose.yml` using the existing `scripts/run_celery_worker.py` as the command. / **Effort**: S. [NEW]

---

#### MEDIUM-4 — Rate Limiting Disabled in Development, No Verification in Staging — `config/development.env` line 72, `config/staging.env` (not read in detail) — `RATE_LIMIT_ENABLED=false` in development.env. The auth router applies rate limiting conditionally on this flag. There is no CI step that verifies rate limiting is active in production configuration. Account lockout after 5 failed login attempts (PRD §3.1.1) depends on this being enabled. / **Fix**: Enable rate limiting in staging.env as minimum; add a startup assertion that rejects `RATE_LIMIT_ENABLED=false` in non-development environments. / **Effort**: S. [NEW]

---

#### MEDIUM-5 — Recipe Rating Maintained by PostgreSQL Trigger, Not Application Layer — `alembic/versions/004_add_marketplace_ratings_reviews.py` lines 63–108 — A `update_recipe_rating_stats()` trigger updates `recipe_recipes.rating_average` and `rating_count` on every insert/update/delete of `recipe_ratings`. This is fragile: the trigger is defined in an Alembic migration (not in a managed schema file), `downgrade()` drops the trigger, and the application-layer `MarketplaceService.rate_recipe()` also calls `recalculate_rating()`. Dual-write creates a race condition: the trigger fires synchronously on the DB, but the service also issues an UPDATE. This can cause stale reads if the service's UPDATE lags the trigger's result. / **Fix**: Remove the trigger; maintain rating stats exclusively in the application layer via the service's `recalculate_rating()` method. If trigger-based consistency is required, remove the application-layer recalculation. / **Effort**: S. [NEW]

---

#### MEDIUM-6 — `models_old.py` in Recipe Module — `src/jidelnicek/recipe/models_old.py` (git ls-files) — A file named `models_old.py` is committed to the recipe module alongside the `models/` package. Legacy model definitions in a committed file risk being accidentally imported, silently shadowing newer models, and confusing `db/base.py`'s wildcard import aggregator. / **Fix**: Delete `models_old.py`. If needed for reference, use git history. / **Effort**: S. [NEW]

---

### LOW

---

#### LOW-1 — `src/stories/` Storybook Assets Inside Backend `src/` — `src/stories/` (git ls-files) — The `src/stories/` directory contains Storybook Button/Header/Page stories and assets. These belong in `frontend/.storybook/` or `frontend/src/stories/`. Having them in the backend source root is structurally confusing, pollutes `PYTHONPATH`, and will be included in the Docker image's `/app/src/` directory. / **Fix**: Move to `frontend/src/stories/`. / **Effort**: S. [NEW]

---

#### LOW-2 — Root-Level Debugging Scripts Not Gitignored — `.gitignore`, root directory — Approximately 20 debug/test scripts exist at the project root: `test_csrf_debug.py`, `test_filename_debug.py`, `debug_config.py`, `debug_participant_calculation.py`, `test_rate_limit_debug.py`, `generate_auth_token.py`, `create_admin_user.py`, etc. These are tracked by git and deployed into the Docker image. Some (`generate_auth_token.py`, `create_admin_user.py`) could be exploited to create admin users or generate valid tokens if the container is compromised. / **Fix**: Move utility scripts to `scripts/`, add `test_*.py` at root level to `.gitignore`, ensure the Docker image excludes root-level scripts via `.dockerignore`. / **Effort**: S. [NEW]

---

#### LOW-3 — OpenAPI Spec Diverges from Implementation — `Documentation/jidelnicek_OpenAPI Spec.yaml`, `missing_endpoints_analysis.md`, `router_analysis.md` — The spec does not document: captcha endpoints, session management endpoints, monitoring endpoints, jobs/progress/export endpoints, or any of the ~60% missing-from-implementation endpoints. The spec is both over- and under-specified relative to the actual routes. / **Fix**: Prefer FastAPI's auto-generated `/openapi.json` as the source of truth; remove the static YAML spec or treat it as an aspirational design document with explicit labeling. / **Effort**: S. [CONFIRMS router_analysis.md §"Recommendations"]

---

#### LOW-4 — `alembic/versions/` vs `migrations/versions/` Naming Confusion Also Affects `alembic.ini` — `alembic.ini` (not read but inferred from `migrations/env.py` imports) — Two `env.py` files exist: `alembic/versions/` is unused by the active Alembic config but `migrations_backup_20250710_031019/env.py` exists, suggesting prior directory restructuring without cleanup. / **Fix**: Delete `alembic/` directory and `migrations_backup_20250710_031019/` after verifying `migrations/` is the canonical path. / **Effort**: S. [CONFIRMS HIGH-3]

---

## Cross-cutting Themes

**1. Documentation leads implementation by a significant margin.** The architecture documents describe a well-designed modular monolith with schema isolation, interface contracts, and a clean dependency DAG. The implementation has approximately 40% of planned endpoints, no schema isolation, no interface enforcement, and a corrupted VCS state. The risk is that architecture documentation continues to be iterated (adding complexity) while implementation debt accumulates.

**2. `core` is becoming a God Module.** The intended role of `core` is shared infrastructure (database, config, middleware). In practice it now contains: sharing service (a domain service), job management, SSE/WebSocket handlers, storage abstraction, monitoring, export error logging, cleanup policies, and notification service. These should either belong to their respective domain modules or be extracted to a dedicated cross-cutting concern layer. As `core` grows, every module depends on it, making circular imports likely.

**3. Dual-system pattern (trigger + application layer) for derived data.** Rating statistics use both a PostgreSQL trigger and an application-layer recalculation call. Export jobs use both async Celery tasks and synchronous fallback paths. This pattern will repeat unless a single responsibility owner is designated for each derived/side-effect operation.

**4. The frontend is React/Vite (not Next.js PWA as documented).** `CRITICAL_PERFORMANCE_OPTIMIZATIONS_SUMMARY.md` references `vite.config.ts`, `frontend/Dockerfile.dev`, and `frontend/Dockerfile`, and the docker-compose `VITE_API_URL` env var. The technical architecture document specifies "Next.js PWA" but the actual implementation is Vite + React. This is an early architectural divergence worth acknowledging.

---

## Scalability Inflection Points

**Inflection Point 1 — Nutritional calculation at trip finalization (10k users × 3 trips/year × 20 participants × 14 days × 3 meals/day).** Each meal assignment triggers a full nutritional recalculation. At scale, a single "finalize trip" action could require thousands of nested aggregate queries (ingredients → recipe_ingredients → nutritional_values → meals → participants with coefficients). This path has no caching layer per the reviewed code. The `calculations/` module exists but only has a router file — the engine directory (`calculations/engines/`) exists in git but content is unknown. At 10k users this becomes the primary bottleneck.

**Inflection Point 2 — Shopping list generation as a synchronous request.** Shopping list generation aggregates all meals across all days, scales by participant coefficients, deduplicates ingredients, applies rounding, and produces multi-format exports (Excel, PDF, CSV, HTML, JSON, text). Seven export format implementations exist in `shopping/services/export/`. If this runs synchronously in the request handler, response times will exceed 30 seconds for large trips. The Celery task infrastructure exists (`tasks/export_tasks.py`) but no Celery workers are in the Docker stack (see MEDIUM-3), meaning this path is currently synchronous-only.

**Inflection Point 3 — Redis rate limiting with a single connection pool.** `config/development.env` shows `REDIS_POOL_MAX_CONNECTIONS=10`. The auth module uses Redis for rate limiting (per-IP request counting, account lockout tracking, session token storage, CAPTCHA challenges). At 10k concurrent users with aggressive brute-force attacks, the 10-connection pool saturates. Redis connection exhaustion would disable rate limiting or cause 500 errors on login, creating a choice between availability and security. Production config likely increases this, but the pool sizing is not validated at startup.

---

## Open Questions

1. **Is there a working deployment anywhere?** Given the corrupted git object store, can the application currently be built from source? Is there a container registry or artifact with a working image?

2. **What is the canonical Alembic migration path?** `alembic/versions/` (5 migrations) vs `migrations/versions/` (empty)? Which does `alembic.ini` `script_location` point to?

3. **What enforces the `is_global` flag on ingredients and snacks?** The PRD implies a global catalog managed by admins and a personal catalog per user. The admin module has `ingredient_management.py` and `ingredient_moderation.py`, but the boundary between global and personal ingredient write paths is unclear.

4. **How is the `calculations/engines/` module structured?** This is the nutritional calculation core. Its content is unknown (git blobs not accessible). Is it pure-Python or does it call the database per calculation?

5. **What triggers a Celery task vs a synchronous call for exports?** The `api/v1/services/unified_export_service.py` and `core/services/export_service_wrapper.py` both exist. Is there a strategy pattern that routes to async or sync based on size/user preference?

6. **Has the frontend's React/Vite stack been intentionally chosen over Next.js PWA (as documented), or is the documentation stale?** This affects SSR capability, SEO, and PWA implementation approach.

7. **What is the intended lifecycle of the `db/base.py` wildcard import aggregator?** `from jidelnicek.db.base import *` in `tests/conftest.py` imports all models into the global namespace. As models grow across modules, name collisions become likely. Is this pattern intentional?
