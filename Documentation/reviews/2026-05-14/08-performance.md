# Performance Review

**Date:** 2026-05-14
**Reviewer:** Performance Optimizer Agent
**Revision:** 1.0

---

## Scope

This audit covers the Jídelníček 2.0 project at `/mnt/data/WORK/Jidelnicek_2.0`.

**Source availability caveat:** The `src/jidelnicek/` module directory tree exists as empty scaffolding only — no `.py` application source files are committed (the git history has no commits yet, all files are staged). The audit is therefore based on:

- `pyproject.toml` (backend dependency manifest)
- `frontend/package.json` and `frontend/vite.config.ts` (frontend build config)
- All five Alembic migration files (schema + index picture)
- `docker/Dockerfile`, `docker/entrypoint.sh`, `docker/postgres/postgresql.conf` (runtime config)
- `docker-compose.yml`, `docker-compose.dev.yml` (deployment topology)
- `frontend/nginx.conf` (reverse proxy config)
- `Documentation/jidelnicek_Technical Architecture.md` (API contracts, ORM patterns, caching design)
- `Documentation/API Design.md` (endpoint surface)
- `tests/conftest.py`, `scripts/` (implementation intent evidence)
- `CRITICAL_PERFORMANCE_OPTIMIZATIONS_SUMMARY.md`, `REDIS_FIX.md` (prior performance work)
- `.env.example` (configuration defaults)

Where no source file was available the finding is derived from the documented architecture design or configuration artifact. Each finding notes its evidence source.

---

## TL;DR — Top 5 Wins by ROI

| # | Win | Effort | Estimated Impact |
|---|-----|--------|-----------------|
| 1 | **Offload PDF/Excel exports to Celery** — exports are synchronous in HTTP handlers, blocking the uvicorn worker thread for up to 30 s | Low (Celery is already installed) | Removes worst-case 30 s request blocks; frees 1 of 2 uvicorn workers per export |
| 2 | **Add `selectinload` / `joinedload` to all trip-detail and recipe-detail queries** — the architecture documents lazy ORM relationships across a deep object graph (trip → days → meals → recipe_snapshot → recipe_version → recipe_ingredients → ingredient → nutritional_values) without specifying eager loading strategy | Medium | Eliminates 10–40+ implicit synchronous SELECT round-trips per trip-detail response |
| 3 | **Cache marketplace/trending and public recipe listings in Redis** — a Redis cluster is deployed and the env example documents `CACHE_TTL_SECONDS=300`, but the documented architecture defaults to a Python-dict in-process cache with no stampede protection | Low | High-traffic read-heavy path served from memory instead of repeated DB aggregations |
| 4 | **Replace three icon libraries with one** — `react-icons`, `lucide-react`, and `@mui/icons-material` are all present; together they contribute the largest single chunk class at build time | Low | ~150–300 KB gzip reduction; faster TTI |
| 5 | **Increase uvicorn workers from 2 to `2 * CPU + 1`** — the entrypoint hardcodes `--workers 2` on a 4 GB VPS | Trivial (one-line change) | Doubles throughput under concurrent load at zero resource cost on a 2-core VPS |

---

## Backend Findings

### CRITICAL

#### BE-C1 — Synchronous export generation blocks uvicorn workers

**File:** `docker/entrypoint.sh:55`, `Documentation/jidelnicek_Technical Architecture.md` (export endpoints, export_service.py)

**What:** Export endpoints (`GET /api/v1/trips/:id/export/summary`, `/shopping-list`, `/nutrition`, etc.) are documented as synchronous HTTP handlers. The app runs with `--workers 2`. ReportLab PDF generation and openpyxl Excel generation are CPU-bound and I/O-heavy operations. The architecture document explicitly states "Task Queue: None for MVP (synchronous operations)" and places export generation under `GET` endpoints.

**Why it matters:** With 2 uvicorn workers, a single large trip export (documented target: < 30 s) can consume 50% of total request-handling capacity for the duration. A second simultaneous export saturates the server entirely. Even "small" exports will block other requests because asyncio event loops are not pre-emptible for CPU-bound work.

**Impact estimate:** Under 2 concurrent exports, API p99 latency for all other endpoints spikes to match export duration. A 100-participant, 14-day trip could exceed the 30 s target with openpyxl sheet building.

**Fix:** Move all export generation to Celery background tasks (Celery is already a declared dependency at `celery[redis] ^5.4.0`). Return a `202 Accepted` with a job ID, and expose a `GET /api/v1/trips/:id/export/:jobId` polling endpoint. For small in-memory text/markdown exports this is less urgent — wrap only PDF and Excel.

**Effort:** Medium (2–4 days; Celery worker already scaffolded in `scripts/run_celery_worker.py`).

---

#### BE-C2 — N+1 query risk on trip-detail and recipe-detail responses

**File:** `Documentation/jidelnicek_Technical Architecture.md` (RecipeResponse schema, trip schema), `docs/trip_cloning_example.py`

**What:** The `RecipeResponse` schema includes nested `ingredients: List[RecipeIngredientResponse]` and `images: List[RecipeImageResponse]`. The `TripService.clone_trip` example loads `cloned_trip.participants`, `cloned_trip.meal_slots` etc. as attribute accesses post-commit. SQLAlchemy 2.0 with async sessions raises `MissingGreenlet` if lazy loads are attempted inside an async context — meaning developers are forced to either add `selectinload`/`joinedload` up-front or perform separate explicit queries per relationship. The architecture document does not specify any eager-loading strategy for these relationships.

Trip detail response graph:
```
Trip
  → [N] TripDay
      → [N] Meal
          → RecipeSnapshot → RecipeVersion → [N] RecipeIngredient → Ingredient → NutritionalValues
      → [N] TripDaySnack → Snack → NutritionalValues
  → [N] Participant
```

Loading this lazily = O(days × meals × ingredients) SELECT statements.

**Impact estimate:** For a 7-day trip with 3 meals/day and 8 ingredients/meal: 1 + 7 + 21 + 168 + 168 = ~365 round-trips to PostgreSQL per `GET /api/v1/trips/:id`. At 0.5 ms/query internal latency = ~180 ms just in DB I/O, with no connection contention.

**Fix:** Add `selectinload` chains on trip and recipe service queries. Flag for database-reviewer for full query plan analysis.

**Effort:** Medium (per-service, 1 day each for trip and recipe).

---

### HIGH

#### BE-H1 — `echo=settings.DEBUG` risks SQL query logging in production

**File:** `Documentation/jidelnicek_Technical Architecture.md` (database.py snippet, line ~1181)

**What:** The engine is created with `echo=settings.DEBUG`. The `DEBUG` environment variable defaults to `"true"` in `docker-compose.dev.yml` and is not explicitly set to `false` in the production `docker-compose.yml` (it uses `${DEBUG:-false}`, so it relies on the `.env` file being correct). In DEBUG mode, SQLAlchemy logs every SQL statement to stdout. Uvicorn captures stdout.

**Why it matters:** SQL echoing creates a log entry per query. At the N+1 scale described in BE-C2, this generates hundreds of log lines per request on hot paths, adding measurable latency to async coroutines and filling disk.

**Fix:** Ensure `DEBUG=false` is set explicitly in the production compose file environment section (not just as a default), and audit `settings.DEBUG` usage to ensure it is not accidentally `True` in production.

**Effort:** Trivial (configuration change).

---

#### BE-H2 — Unbounded default list result of 100 for recipe listing endpoint

**File:** `Documentation/jidelnicek_Technical Architecture.md` (list_recipes, line ~741)

**What:** The documented `list_recipes` endpoint signature is:
```python
async def list_recipes(skip: int = 0, limit: int = 100, ...):
```
The default `limit=100` is not enforced as a maximum — a caller can pass `limit=500`. With the described `RecipeResponse` schema (includes ingredients list and images list), returning 100 recipes with 10 ingredients each means 100 × (recipe + ingredient sublist + image sublist) = ~300–1100 ORM object hydrations per response. The marketplace `GET /api/marketplace/recipes` endpoint has the same unbounded concern for public recipes.

**Impact estimate:** A crafted request with `limit=500` against a large user's recipe list could trigger 500+ JOIN hydrations or N+1 queries, generating a response body exceeding 1 MB of JSON.

**Fix:** Enforce a hard cap (e.g. `limit: int = Query(default=20, le=100)`). Use cursor-based pagination for marketplace. Return lightweight list items (id, name, thumbnail, prep_time, nutrition summary) and reserve full ingredient/image expansion for single-record `GET /recipes/{id}`.

**Effort:** Low (1 day).

---

#### BE-H3 — `psycopg2-binary` sync driver installed alongside `asyncpg`

**File:** `pyproject.toml:14`

**What:** `psycopg2-binary ^2.9.10` is listed as a production dependency alongside `asyncpg ^0.30.0`. The app uses asyncpg for the main async engine. The only legitimate use of psycopg2 is in Alembic migrations (`migrations/env.py` correctly strips `+asyncpg` from the URL for the sync Alembic context).

**Why it matters:** psycopg2-binary has no runtime role in the async FastAPI app. Its presence is a maintenance hazard: any code that accidentally imports it (e.g., in a service layer) and calls it synchronously from an async route handler would block the event loop for the duration of the DB call. This is a silent correctness risk.

**Fix:** Move `psycopg2-binary` to a `[dev]` or `[migrations]` optional group, or to a separate `alembic-requirements.txt`. The runtime Docker image should not install it.

**Effort:** Trivial (dependency manifest change).

---

#### BE-H4 — Uvicorn hardcoded to 2 workers

**File:** `docker/entrypoint.sh:55`

**What:**
```sh
exec uvicorn jidelnicek.main:app --host 0.0.0.0 --port 8000 --workers 2
```
The VPS is sized at 4 GB RAM with resources allocated as: PostgreSQL 1.5 GB, Redis 512 MB, app 1.5 GB, nginx 256 MB. With a modern 2-core VPS the conventional rule is `2 * CPU_count + 1 = 5` workers. Running only 2 workers means any blocking operation (see BE-C1) or slow coroutine saturates 50% of request capacity.

**Fix:** Use an environment variable: `--workers ${UVICORN_WORKERS:-4}`. Also consider adding `--limit-concurrency 100` and `--backlog 128` to protect against connection floods.

**Effort:** Trivial.

---

#### BE-H5 — In-process Python dict cache is not shared across workers

**File:** `Documentation/jidelnicek_Technical Architecture.md` (Cache Configuration, SimpleCache), `docker/entrypoint.sh:55`

**What:** The architecture describes a `SimpleCache` (Python dict) as the primary cache for session data, user preferences, recipe calculations, and public recipes. With 2+ uvicorn workers, each worker has its own process and therefore its own dict. A cache hit in worker-1 is a miss in worker-2. Cache invalidation from worker-1 (e.g., user updates recipe) does not propagate to worker-2's dict.

**Why it matters:** With 2 workers, ~50% of cache lookups will miss even for recently-cached data. Cache invalidation becomes eventually-inconsistent or non-functional.

**Fix:** Redis is already deployed and connected (`REDIS_URL` is set). Migrate all `SimpleCache` usages to Redis calls. The `redis` Python library (`redis ^5.2.1`) and `asyncpg` are already installed. Use `await redis_client.setex(key, ttl, value)` for async-safe writes.

**Effort:** Medium (1–2 days; the Redis client is already injected via `get_redis_client` dependency as seen in `tests/conftest.py`).

---

#### BE-H6 — `max_connections = 10` in PostgreSQL with pool_size = 20

**File:** `docker/postgres/postgresql.conf:7`, `Documentation/jidelnicek_Technical Architecture.md` (database.py engine config)

**What:** PostgreSQL is configured with `max_connections = 10` (leaving 2 for superuser = 8 usable app connections). The documented engine configuration sets `pool_size=20, max_overflow=0`. This means asyncpg will attempt to open up to 20 connections but PostgreSQL will refuse connections 9–10+ with `FATAL: sorry, too many clients`. Under any real load this causes connection acquisition failures.

**Fix:** Align the pool and server: set `pool_size=8, max_overflow=2` (10 max) to match PostgreSQL's `max_connections=10`, or increase `max_connections` to 50 and set `pool_size=15, max_overflow=5` per worker instance. With 4 workers, total pool = `4 × (pool_size + max_overflow)` — this must be ≤ `max_connections - 2`.

**Effort:** Low (configuration change to both postgresql.conf and engine init).

---

### MEDIUM

#### BE-M1 — Trigger-based rating stats update on recipe_ratings lacks stampede protection

**File:** `alembic/versions/004_add_marketplace_ratings_reviews.py:69–82`

**What:** A PostgreSQL trigger updates `recipe_recipes.rating_average` and `rating_count` on every INSERT/UPDATE/DELETE to `recipe_ratings` by running a live `AVG()` and `COUNT()` query against the full `recipe_ratings` table for that recipe. On a popular marketplace recipe with thousands of ratings, this aggregation runs on every single new vote — potentially locking the `recipe_recipes` row.

**Fix:** The trigger approach is functionally correct for low volume. For popular recipes, replace the per-trigger `AVG()`/`COUNT()` with an incremental update (`SET rating_average = ((rating_average * rating_count) + NEW.rating) / (rating_count + 1), rating_count = rating_count + 1`) or switch to a Celery task that recomputes every 5 minutes and stores the result in Redis.

**Effort:** Medium.

---

#### BE-M2 — Missing composite index on `recipe_recipes(user_id, deleted_at)` and `trip_trips(user_id, deleted_at)`

**File:** Migration files (no base schema migration — only enhancement migrations exist in `/alembic/versions/`)

**What:** The most common query pattern documented is "list all recipes for a user that are not deleted" and "list all trips for a user that are not archived". The indexes seen in migrations are on individual columns or foreign keys. There is no composite `(user_id, deleted_at)` index on the main recipe or trip tables. PostgreSQL will scan all rows for the user then filter on `deleted_at IS NULL`.

**Fix:** Add partial composite indexes:
```sql
CREATE INDEX idx_recipe_recipes_user_active ON recipe_recipes(user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_trip_trips_user_active ON trip_trips(user_id) WHERE deleted_at IS NULL;
```
Flag for database-reviewer for full selectivity analysis.

**Effort:** Low (migration file).

---

#### BE-M3 — No GZip middleware on FastAPI app

**File:** `Documentation/jidelnicek_Technical Architecture.md` (middleware setup), nginx.conf

**What:** Nginx has gzip enabled but only for the `location /api` proxy path with `proxy_read_timeout 60s`. FastAPI itself has no `GZipMiddleware`. In development (direct FastAPI access without nginx) and in load-testing scenarios where nginx is bypassed, responses are uncompressed. Large recipe listing responses (100 recipes × ingredients × images) are particularly impacted.

**Fix:** Add `from fastapi.middleware.gzip import GZipMiddleware; app.add_middleware(GZipMiddleware, minimum_size=1000)`. This is a one-liner.

**Effort:** Trivial.

---

#### BE-M4 — `recipe_count`/`trip_count` counters on `auth_users` are not atomically maintained

**File:** `Documentation/jidelnicek_Technical Architecture.md` (schema, auth.users)

**What:** Denormalized `recipe_count` and `trip_count` columns exist on the users table, and the recipe limit check reads `current_user.recipe_count >= 500`. There is no migration-level trigger maintaining these counters. If the service layer does not use an atomic `UPDATE auth_users SET recipe_count = recipe_count + 1 WHERE id = :id` (which requires a separate UPDATE statement, adding a query), then under concurrent recipe creation the counter can drift.

**Fix:** Use `SELECT COUNT(*) FROM recipe_recipes WHERE user_id = :uid AND deleted_at IS NULL` for the limit check (costs one query but is always correct), or use a PostgreSQL trigger to maintain the counter atomically. Remove the denormalized counter if triggers are not in place.

**Effort:** Low.

---

#### BE-M5 — Token expiry hardcoded at 1440 minutes (24 h) in `.env.example`

**File:** `.env.example:12` (`ACCESS_TOKEN_EXPIRE_MINUTES=1440`)

**What:** Long-lived access tokens mean the token introspection/blacklist check on the Redis blocklist runs for longer. The Redis rate-limit key TTL is 1 minute, but the session key is 24 hours. This is primarily a security concern but has a caching performance implication: the Redis session key set will grow proportionally with active users × 24 h × token size.

**Fix:** Reduce `ACCESS_TOKEN_EXPIRE_MINUTES` to 30–60 and use refresh token rotation. This is already partially designed (ROTATE_REFRESH_TOKENS flag exists).

**Effort:** Low (config + minor service change).

---

### LOW

#### BE-L1 — No Redis TTL cap or eviction policy documented

**File:** `docker-compose.yml` (redis service), `docker/redis/` (redis.conf missing — file not found)

**What:** The Redis service does not configure `maxmemory` or `maxmemory-policy`. The architecture doc comments out `--maxmemory 400mb --maxmemory-policy allkeys-lru`. Without a memory cap, Redis can grow to consume all available memory. With the 512 MB memory limit in docker-compose, OOM kills become possible.

**Fix:** Add to the redis `command`:
```
--maxmemory 400mb --maxmemory-policy allkeys-lru
```

**Effort:** Trivial.

---

#### BE-L2 — No cache stampede protection

**File:** `Documentation/jidelnicek_Technical Architecture.md` (Cache Configuration)

**What:** The cache design describes simple get/set patterns without any mutex or "lock-on-miss" protection. For the `marketplace:page:{n}` key (5-minute TTL) and `trip:summary:{trip_id}` (5-minute TTL), simultaneous cache misses from multiple workers will all execute the expensive query and all write the result back — classic stampede.

**Fix:** Use Redis `SET key value EX ttl NX` (set-if-not-exists) pattern with a short lock key to serialize the first recomputation, or implement probabilistic early expiration.

**Effort:** Low.

---

#### BE-L3 — `bcrypt_rounds=12` is intentionally slow but blocks async event loop

**File:** `.env.example:42` (`BCRYPT_ROUNDS=12`), `pyproject.toml` (`passlib[bcrypt]`, `bcrypt`)

**What:** bcrypt at cost factor 12 takes ~250–400 ms of CPU time synchronously. If `PasswordHasher.hash_password()` is called directly in an async route handler (as the architecture example shows `register` → check/create user without offloading), it blocks the event loop for ~300 ms, during which no other requests can be processed on that worker.

**Fix:** Wrap bcrypt calls in `await asyncio.get_event_loop().run_in_executor(None, hash_fn, password)` to move them to the thread pool.

**Effort:** Low (1 hour).

---

## Frontend Findings

**Note:** All `frontend/src/` subdirectories are empty — no `.tsx`/`.ts` source files exist on disk. The frontend audit is based on `package.json`, `vite.config.ts`, and `CRITICAL_PERFORMANCE_OPTIMIZATIONS_SUMMARY.md`.

### HIGH

#### FE-H1 — Triple icon library: `react-icons` + `lucide-react` + `@mui/icons-material`

**File:** `frontend/package.json:14,55,56`

**What:** All three icon libraries are production dependencies:
- `@mui/icons-material ^7.2.0` — contains ~2,000 icons; even with tree-shaking the MUI icon package pulls in SVG components wrapped in `createSvgIcon()` which includes Emotion styling overhead
- `react-icons ^5.5.0` — 50+ icon families; individual family imports (`import { FiHome } from 'react-icons/fi'`) are tree-shakeable but the package is large if used carelessly
- `lucide-react ^0.525.0` — 1,400+ icons, tree-shakeable

All three end up in `icons-vendor` chunk per `vite.config.ts`. The `CRITICAL_PERFORMANCE_OPTIMIZATIONS_SUMMARY.md` reports the `icons-vendor` chunk but does not give its size.

**Impact estimate:** `@mui/icons-material` uncompressed is ~20 MB; even with aggressive tree-shaking, any non-specific import (`import * as Icons from '@mui/icons-material'`) would be catastrophic. Three competing libraries also create bundle duplication for common icons.

**Fix:** Standardize on one icon library (recommend `lucide-react` — smallest, modern, tree-shakeable). Audit all icon imports and migrate. Remove the other two from `package.json`.

**Effort:** Medium (2–4 days depending on icon count).

---

#### FE-H2 — MUI (`@mui/material` + `@emotion/react` + `@emotion/styled`) alongside Tailwind CSS

**File:** `frontend/package.json:7–16`

**What:** The project ships both MUI (with Emotion as CSS-in-JS runtime) and Tailwind CSS. These are fundamentally competing styling systems. MUI with Emotion adds:
- `@emotion/react` ~11 KB gzip
- `@emotion/styled` ~7 KB gzip
- `@mui/material` vendor chunk (~150–200 KB gzip typical)
- Runtime CSS-in-JS processing on every render

Simultaneously running Tailwind's static CSS is fine, but if most UI is built with Radix UI + Tailwind (as suggested by the extensive Radix imports), the MUI dependency is dead weight.

**Impact estimate:** ~200 KB gzip in the `styles-vendor` chunk (documented at 42 KB in summary — this is likely because source files are absent and MUI is not actually imported yet, but the dependency is declared).

**Fix:** Audit whether MUI is actually used. If only a handful of components use it, replace them with Radix UI or shadcn/ui equivalents and remove `@mui/material`, `@mui/lab`, `@mui/icons-material`, `@emotion/react`, `@emotion/styled` from `package.json`.

**Effort:** Medium.

---

### MEDIUM

#### FE-M1 — `react-vendor` chunk reported at 450 KB — React 18 is correct but needs auditing

**File:** `CRITICAL_PERFORMANCE_OPTIMIZATIONS_SUMMARY.md`

**What:** The prior optimization summary reports `react-vendor: React ecosystem (450kB)`. Standard React 18 + ReactDOM gzip is ~45 KB. A 450 KB chunk labeled `react-vendor` suggests non-React packages are being caught by the `id.includes('react')` match in `vite.config.ts`:

```typescript
if (id.includes('react') || id.includes('react-dom')) {
  return 'react-vendor'
}
```

Packages matching this pattern besides React itself: `react-router-dom`, `react-hook-form`, `react-hot-toast`, `react-day-picker`, `react-i18next`, `@hello-pangea/dnd` (react DnD), `embla-carousel-react`. The `react-router` check runs after `react`, so it may not catch all router modules.

**Fix:** Make the React vendor chunk match more specific: `id.includes('/react/') || id.includes('/react-dom/')` with path separators, or use exact package names. Move the other react-prefixed libraries to their appropriate vendor buckets.

**Effort:** Low (vite.config.ts change).

---

#### FE-M2 — `dependency` package in `package.json`

**File:** `frontend/package.json:48`

**What:** A package named `"dependency": "^0.0.1"` is listed in production dependencies. This is almost certainly a mistake — the package exists on npm but has no meaningful functionality. It may have been added erroneously.

**Fix:** Remove it.

**Effort:** Trivial.

---

#### FE-M3 — `jspdf` (347 KB) in `pdf-vendor` chunk is lazy but `pako` is not

**File:** `frontend/package.json:52` (`pako ^2.1.0`), `CRITICAL_PERFORMANCE_OPTIMIZATIONS_SUMMARY.md`

**What:** jsPDF depends on `pako` (zlib/deflate). If `pako` is imported directly in non-PDF code, it will be bundled into a non-lazy chunk. `pako` uncompressed is ~120 KB. The vite config excludes jsPDF from pre-bundling but does not explicitly assign `pako` to `pdf-vendor`.

**Fix:** Check if `pako` is imported anywhere outside export utilities. If only used via jsPDF, it will naturally tree-shake into `pdf-vendor`. If imported directly, add it to the `pdf-vendor` chunk condition.

**Effort:** Low (build audit).

---

#### FE-M4 — `socket.io-client` loaded for all users

**File:** `frontend/package.json:60`

**What:** `socket.io-client ^4.8.1` is a production dependency. Socket.IO client gzip is ~40 KB. If WebSocket/real-time features are only used on specific pages (trip editing, notifications), the socket.io-client import should be lazy-loaded with the feature, not bundled into the main chunk. The vite.config.ts does not assign it to any vendor chunk, so it falls into the catch-all `vendor` bundle.

**Fix:** Dynamically import `socket.io-client` only in the component/hook that needs it: `const { io } = await import('socket.io-client')`.

**Effort:** Low.

---

### LOW

#### FE-L1 — PWA `runtimeCaching` for `/api/*` uses `NetworkFirst` with no versioning key

**File:** `frontend/vite.config.ts` (VitePWA workbox config, line ~98)

**What:** The workbox config caches API responses with `NetworkFirst`, 5-minute maxAge, 50 max entries. This is a reasonable default, but there is no cache version busting key. If an API contract changes (e.g., response shape for recipes), stale SW-cached responses may serve the old shape to users who are offline or on flaky connections.

**Fix:** Add a cache name prefix that includes the API version: `cacheName: 'api-v1-cache'`. When breaking API changes occur, bump to `api-v2-cache` and add cleanup code in the SW `activate` event.

**Effort:** Low.

---

#### FE-L2 — Nginx missing brotli compression

**File:** `frontend/nginx.conf`

**What:** The Nginx config enables gzip but not brotli, despite the Vite build generating `.br` brotli-compressed files via `vite-plugin-compression`. For brotli pre-compressed files to be served, nginx needs `brotli_static on` (requires `ngx_brotli` module) or the static file server must detect `.br` files.

**Fix:** Either add `brotli_static on` with the ngx_brotli module in the nginx Docker image, or remove brotli compression from the Vite build config to avoid shipping unused `.br` files that inflate the Docker image size.

**Effort:** Low.

---

#### FE-L3 — `force: true` pre-optimization in development mode

**File:** `frontend/vite.config.ts` (optimizeDeps, line ~238)

**What:** `force: mode === 'development'` forces Vite to re-optimize all dependencies on every dev server start, even when `node_modules` has not changed. This slows cold dev startup unnecessarily.

**Fix:** Remove `force: true` or restrict it to a dedicated `VITE_FORCE_OPT=true` environment flag.

**Effort:** Trivial.

---

## Caching Strategy Assessment

### What is designed (per documentation)

The architecture documents a two-tier caching approach:

**Tier 1 (SimpleCache — Python dict):** session, preferences, recipe calculations, public recipes, ingredient search, trip summary, marketplace pages. TTLs range from 5 minutes to 24 hours.

**Tier 2 (Redis):** rate-limit counters, session tokens for JWT revocation, share link lookups.

### Gaps and risks

| Gap | Risk | Recommended fix |
|-----|------|----------------|
| Simple dict cache is per-process; not shared across uvicorn workers | Cache coherence breaks under 2+ workers | Migrate all SimpleCache usages to Redis |
| No maxmemory policy on Redis | OOM kill of Redis container under high load | Add `--maxmemory 400mb --maxmemory-policy allkeys-lru` |
| No stampede protection on any cache layer | Popular recipe or marketplace page causes DB query storm on TTL expiry | Implement probabilistic early expiration or distributed lock-on-miss |
| Marketplace trending endpoint has no documented cache | Most expensive aggregation query runs on every request | Add `CACHE-CONTROL: max-age=300` HTTP header + Redis cache key |
| Reference data (categories, tags, global ingredients) has no cache entry | Seed data that never changes is queried per-request | Cache indefinitely with a manual invalidation key; TTL 24h is fine |
| `SimpleCache.set()` has no TTL jitter | All cached items seeded at startup expire simultaneously | Add ±10% random jitter to TTL values |

### Positive observations

- Redis is deployed in production (not optional as in the MVP architecture)
- TTL values are well-thought-out and documented
- The `GET /api/v1/marketplace/trending` path is identified as a high-traffic endpoint, suggesting awareness of the caching need
- PostgreSQL `shared_buffers=384MB` and `effective_cache_size=1152MB` are well-tuned for the VPS RAM allocation
- The GIN index on `search_vector` for full-text recipe search is correctly designed

---

## Async Hazards (Dedicated Section)

This section consolidates all synchronous I/O risks in the async FastAPI request path.

### AH-1 — bcrypt hashing (BE-L3)

bcrypt password hashing (`passlib[bcrypt]`) is synchronous CPU-bound work. Calling it directly in an `async def` endpoint blocks the entire event loop worker for ~250–400 ms. Affects: `POST /auth/register`, `POST /auth/login`, `PUT /auth/me` (password change).

**Fix:** `await asyncio.get_event_loop().run_in_executor(None, PasswordHasher.hash_password, password)`

---

### AH-2 — PDF/Excel generation (BE-C1)

`reportlab` and `openpyxl` are synchronous. Both perform significant I/O (file writes) and CPU work (layout, formatting) that cannot yield to the event loop. Must be offloaded to Celery or at minimum to `run_in_executor`.

---

### AH-3 — `psycopg2-binary` accidental sync DB calls (BE-H3)

If any code path accidentally instantiates a psycopg2 connection (e.g., a utility script imported into an endpoint), it will make a blocking TCP connection. Psycopg2 does not yield to asyncio.

---

### AH-4 — `aiosmtplib` for email — verify no fallback to `smtplib`

The `aiosmtplib ^4.0.1` dependency is correct. However, the `email-validator` package and any email formatting utilities should be verified to not call `socket.getaddrinfo()` or `dns.resolver` synchronously (common in validation libraries).

---

### AH-5 — QR code generation (`qrcode[pil]`)

QR code generation using `qrcode` + Pillow is synchronous CPU/memory work. If called inline in a request handler (e.g., generating a share link QR on the fly), it should be wrapped in `run_in_executor` or pre-generated and cached.

---

### AH-6 — Alembic startup migrations block app readiness (low severity)

`entrypoint.sh` runs `alembic upgrade head` synchronously before starting uvicorn. On a fresh database this is correct. On an already-migrated database this is a no-op but still takes ~2 s to connect and check. Not a blocking async hazard (it's pre-uvicorn), but it extends cold-start time.

---

### Summary table

| Hazard | Endpoint(s) affected | Severity | Fix |
|--------|---------------------|----------|-----|
| bcrypt sync | /auth/register, /auth/login | HIGH | run_in_executor |
| PDF/Excel export sync | /trips/:id/export/* | CRITICAL | Celery background task |
| psycopg2 accidental use | Any | HIGH | Move to dev-only dependency |
| QR code generation sync | /share/:id | MEDIUM | run_in_executor or pre-generate |
| Email DNS resolution | /auth/register | LOW | Verify aiosmtplib DNS handling |

---

## Open Questions

1. **Are export endpoints implemented as streaming responses or buffered?** If buffered (entire PDF in memory before sending), a 14-day trip export with 20 participants could allocate 50–100 MB of in-process memory. Streaming with `StreamingResponse` would mitigate this.

2. **What is the recipe_recipes base schema migration?** The five Alembic migrations are all enhancement/addition migrations. There must be a base schema (migration 000 or initial schema) that defines the core tables. It was not found in the repository. Are the base tables defined in an SQL init file? The `docker/postgres/00_init_minimal.sql` file was present but not readable — verifying whether recipe/trip indexes exist there is important.

3. **Is the `SimpleCache` (Python dict) actually implemented in the deployed code?** The `src/jidelnicek/core/` directory is empty. If the application was previously deployed from a different location, the actual cache implementation and Redis integration should be verified against a running container.

4. **What is the actual `react-vendor` chunk composition?** The 450 KB figure in the optimization summary is unusually large for a React-only chunk. A build with `ANALYZE=true vite build` and inspecting `dist/stats.html` would clarify whether router/form libraries are being pulled in.

5. **Is `BCRYPT_ROUNDS=12` appropriate for the target hardware?** On the VPS, measure actual bcrypt latency: `python -c "import time, bcrypt; t=time.time(); bcrypt.hashpw(b'test', bcrypt.gensalt(12)); print(time.time()-t)"`. If > 500 ms, reduce to 10.

6. **Is there a missing composite index on `recipe_ingredients(recipe_version_id, ingredient_id)`?** The schema defines `UNIQUE(recipe_version_id, ingredient_id)` which creates an index, but the `JOIN` pattern `recipe_versions → recipe_ingredients → ingredients → nutritional_values` needs to be validated with EXPLAIN ANALYZE under realistic data volumes.

7. **Is `@google/gemini-cli` a production dependency?** `frontend/package.json` lists `"@google/gemini-cli": "^0.1.9"` as a production dependency. This is a CLI tool (~50 MB) and should not be in production builds. Verify it is not imported in any source file and move to `devDependencies` or remove.
