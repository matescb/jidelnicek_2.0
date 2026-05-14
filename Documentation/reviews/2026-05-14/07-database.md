# Database Review

## Scope

Reviewed artifacts (actual Python source files in `src/jidelnicek/` are empty stub directories — the real implementation lives elsewhere or is not committed):

- `/mnt/data/WORK/Jidelnicek_2.0/docker/postgres/01_schema.sql` — authoritative DDL
- `/mnt/data/WORK/Jidelnicek_2.0/docker/postgres/02_functions.sql` — triggers and functions
- `/mnt/data/WORK/Jidelnicek_2.0/docker/postgres/00_init.sql` / `00_init_minimal.sql` — init scripts
- `/mnt/data/WORK/Jidelnicek_2.0/alembic/versions/001–005_*.py` — five Alembic migrations (secondary chain)
- `/mnt/data/WORK/Jidelnicek_2.0/migrations/env.py` — Alembic runtime config
- `/mnt/data/WORK/Jidelnicek_2.0/tests/conftest.py` — session factory / test lifecycle
- `/mnt/data/WORK/Jidelnicek_2.0/config/development.env`, `production.env` — pool config
- `/mnt/data/WORK/Jidelnicek_2.0/docker/postgres/postgresql.conf` — server config
- `Documentation/Database Schema.md`, `jidelnicek_Data Validation Rules.md`, `jidelnicek_Modular_Monolith_Architecture.md` — design intent docs
- `/mnt/data/WORK/Jidelnicek_2.0/review/` — previous sub-task reviews (code-level detail)

**Important caveat:** The `migrations/versions/` directory is empty (only `__pycache__`) and `alembic.ini` points `script_location = migrations`, meaning `alembic upgrade head` currently finds nothing to run. The five migrations in `alembic/versions/` assume a base schema already exists (migration 001 sets `down_revision = None` and immediately modifies existing tables). The source of the base schema is the raw SQL files in `docker/postgres/`.

---

## TL;DR

Six high or critical issues require attention before this schema enters production.

1. **CRITICAL — Dual disconnected migration trees:** `alembic.ini` points at `migrations/` (empty) while the base schema is raw SQL and incremental migrations are in a separate `alembic/` directory. Running `alembic upgrade head` currently does nothing. A single coherent, runnable migration chain from scratch does not exist.

2. **CRITICAL — Migration 004 trigger references columns that never get added:** `update_recipe_rating_stats()` UPDATEs `recipe_recipes.rating_average` and `recipe_recipes.rating_count`, but migration 004 never adds those columns via `op.add_column`. The trigger will throw a runtime error on every rating insert/update/delete.

3. **HIGH — `GRANT ALL` to the application user:** `jidelnicek_app` receives `GRANT ALL PRIVILEGES ON DATABASE`, `GRANT ALL ON SCHEMA public`, and `ALTER DEFAULT PRIVILEGES … GRANT ALL ON TABLES` — including DDL rights. If the application is compromised, an attacker can drop or alter tables.

4. **HIGH — All `TIMESTAMP` columns lack time zone awareness:** Every `created_at`, `updated_at`, `expires_at`, `last_login`, `published_at` is `TIMESTAMP` (no timezone). The server timezone is set to `Europe/Prague` in `00_init.sql` / `00_init_minimal.sql`, so wall-clock ambiguity exists at DST transitions and across environments.

5. **HIGH — `cascade_recipe_archive` trigger corrupts review data:** On archive, it runs `UPDATE sharing_reviews SET recipe_id = NULL WHERE recipe_id = NEW.id`. `recipe_id` on `sharing_reviews` has `NOT NULL` (implied by the `ON DELETE CASCADE` FK), so this will fail at runtime or — if the column is somehow nullable — destroys the foreign key relationship rather than archiving the reviews.

6. **HIGH — `validate_trip_dates` trigger silently contradicts product requirements:** The trigger raises `EXCEPTION 'Trip duration cannot exceed 30 days'`, but `jidelnicek_Data Validation Rules.md` §4 states trips have "No limit, but warn if > 365 days". A 30-day hard block is an undocumented breaking constraint that will surprise users.

---

## Schema Findings

### CRITICAL

**CRIT-01** — `docker/postgres/02_functions.sql` / `alembic/versions/004_add_marketplace_ratings_reviews.py` lines 64–109 — **`update_recipe_rating_stats()` trigger references non-existent columns**

The trigger body references `recipe_recipes.rating_average` and `recipe_recipes.rating_count`, but neither `01_schema.sql` nor migration 004 ever adds those columns to `recipe_recipes`. Migration 004 creates `recipe_ratings` and `recipe_reviews`, then immediately attaches `AFTER INSERT/UPDATE/DELETE` triggers that will fail with `ERROR: column "rating_average" of relation "recipe_recipes" does not exist` on every write to `recipe_ratings`.

Fix: Add `op.add_column('recipe_recipes', sa.Column('rating_average', sa.Numeric(4, 2), nullable=True))` and `op.add_column('recipe_recipes', sa.Column('rating_count', sa.Integer(), server_default='0', nullable=False))` in migration 004's `upgrade()` before the trigger creation, and mirror in `downgrade()`.

Effort: Low. [NEW]

---

**CRIT-02** — `alembic.ini` + `migrations/versions/` + `alembic/versions/` — **No runnable end-to-end migration chain**

`alembic.ini` sets `script_location = migrations`, but `migrations/versions/` is empty. The five incremental migrations live in `alembic/versions/` (a separate directory with its own `versions/` sub-path not configured in `alembic.ini`). Migration 001 in `alembic/` sets `down_revision = None` but immediately runs `ALTER TABLE auth_users ADD COLUMN …`, `ALTER TABLE auth_sessions RENAME COLUMN …` — all of which assume the base schema from `docker/postgres/01_schema.sql` already exists. There is no migration that creates the base schema.

Result: A developer cannot set up a fresh database using Alembic alone. The `docker/postgres/` SQL files and the Alembic chain are two parallel, uncoordinated mechanisms.

Fix: Either (a) create a migration 000 that encodes the full `01_schema.sql` DDL and wire it as the root, or (b) move the five `alembic/versions/*.py` files into `migrations/versions/` and configure `alembic.ini` appropriately. Add CI step `alembic upgrade head` against a fresh database to prevent regression.

Effort: Medium. [NEW]

---

### HIGH

**HIGH-01** — `docker/postgres/02_functions.sql` lines 207–216 — **`cascade_recipe_archive` nullifies a NOT NULL FK column**

```sql
UPDATE sharing_reviews SET recipe_id = NULL WHERE recipe_id = NEW.id;
```

`sharing_reviews.recipe_id` is declared `NOT NULL REFERENCES recipe_recipes(id) ON DELETE CASCADE`. Setting it to `NULL` will raise a NOT NULL violation. Even if the column were made nullable, this destroys the integrity of reviews by detaching them from their recipe. The intended behavior (cascade archive) is already handled by the `ON DELETE CASCADE` on the FK; the trigger body is incorrect.

Fix: Remove the `UPDATE sharing_reviews …` line from `cascade_recipe_archive()`. Reviews are automatically removed on hard delete via the FK cascade; for archiving, they should either remain intact or have their own `is_archived` flag if soft-archive is required.

Effort: Low. [NEW]

---

**HIGH-02** — `docker/postgres/01_schema.sql` lines 6–380, `alembic/versions/001–005_*.py` — **All timestamp columns are `TIMESTAMP` without time zone**

Every `created_at`, `updated_at`, `expires_at`, `last_login`, `published_at`, `forked_at`, `reset_token_expires`, etc. is `TIMESTAMP` (no timezone). The server default timezone is set to `'Europe/Prague'` in init scripts, but `postgresql.conf` sets `timezone = 'UTC'`. This inconsistency means timestamps stored by the application and timestamps stored by triggers (`NOW()`) may disagree during DST transitions. Cross-environment differences (dev vs. CI vs. prod) will produce silent data drift.

SQLAlchemy `DateTime(timezone=True)` (used in migrations 001, 003, 004, 005) correctly maps to `TIMESTAMPTZ` — but the base DDL in `01_schema.sql` used for Docker init does not. The base schema and the ORM model types are out of sync.

Fix: Change all `TIMESTAMP` to `TIMESTAMPTZ` in `01_schema.sql`. Add `ALTER COLUMN … TYPE TIMESTAMPTZ` migration for any deployed schema. Use `TIMESTAMPTZ` in all future column definitions.

Effort: Medium. [NEW — confirms concern noted in subtask_3.1_recipe_model_schema.md without explicit action taken]

---

**HIGH-03** — `docker/postgres/00_init.sql` / `00_init_minimal.sql` lines 25–30 — **`GRANT ALL` to application user including DDL rights**

```sql
GRANT ALL PRIVILEGES ON DATABASE jidelnicek TO jidelnicek_app;
GRANT ALL ON SCHEMA public TO jidelnicek_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO jidelnicek_app;
```

`GRANT ALL ON SCHEMA public` includes `CREATE`, enabling the application user to create new tables. `GRANT ALL ON DATABASE` includes `CREATE` (new schema creation). If the application is compromised via SQL injection or a dependency vulnerability, an attacker has full DDL access. The `Database Schema.md` security notes explicitly say "Create separate database users for app vs admin tasks" but this is not implemented.

Fix: Replace with least-privilege grants:
```sql
GRANT CONNECT ON DATABASE jidelnicek TO jidelnicek_app;
GRANT USAGE ON SCHEMA public TO jidelnicek_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO jidelnicek_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO jidelnicek_app;
```

Effort: Low. [CONFIRMS concern in Database Schema.md §Security Notes point 5]

---

**HIGH-04** — `docker/postgres/02_functions.sql` lines 295–310 — **`validate_trip_dates` imposes undocumented 30-day hard limit**

```sql
IF (NEW.end_date - NEW.start_date) > 30 THEN
    RAISE EXCEPTION 'Trip duration cannot exceed 30 days';
END IF;
```

`jidelnicek_Data Validation Rules.md` §2.2 specifies "No limit, but warn if > 365 days." The 30-day exception silently overrides the product specification and will break long-haul trips without any UI-level indication.

Fix: Remove the duration check from `validate_trip_dates()`, or replace it with a 365-day soft warning via application code (not a database exception). Keep the `CHECK (end_date >= start_date)` constraint which is correct.

Effort: Low. [NEW]

---

**HIGH-05** — `Documentation/Database Schema.md` lines 387–391 — **Subquery in `CHECK` constraint on `sharing_links` is invalid in PostgreSQL**

The documentation schema for `sharing_links` includes:
```sql
CONSTRAINT check_entity_exists CHECK (
    (entity_type = 'recipe' AND EXISTS (SELECT 1 FROM recipe_recipes WHERE id = entity_id)) OR
    ...
)
```

PostgreSQL does not allow subqueries in `CHECK` constraints (this is standard SQL behavior). This constraint cannot be created and would cause `ERROR: cannot use subquery in check constraint`. If this DDL is ever executed it will fail at table-creation time.

Note: The actual `03_add_share_links_table.py` migration does NOT include this constraint (it was removed), so this issue applies only if someone attempts to apply the documentation DDL directly.

Fix: Remove the `check_entity_exists` constraint from the documentation example. Enforce entity existence via application logic or a trigger instead.

Effort: Low. [NEW]

---

### MEDIUM

**MED-01** — `docker/postgres/01_schema.sql` line 116 — **`common_ingredients.user_id` is nullable without compensating constraint for global ingredients**

`user_id UUID REFERENCES auth_users(id) ON DELETE CASCADE` is nullable (to represent global ingredients). However, the `UNIQUE(user_id, name)` constraint does not prevent two global ingredients from having the same name (NULLs are not equal in UNIQUE constraints — two rows with `user_id = NULL` and `name = 'Salt'` are allowed). This means the global ingredient namespace has no uniqueness enforcement.

Fix: Add a partial unique index:
```sql
CREATE UNIQUE INDEX uq_global_ingredients_name
ON common_ingredients(name) WHERE user_id IS NULL;
```

Effort: Low. [NEW]

---

**MED-02** — `docker/postgres/02_functions.sql` lines 22–29 — **`check_recipe_limit` trigger reads a denormalized counter rather than counting rows**

```sql
IF (SELECT recipe_count FROM auth_users WHERE id = NEW.user_id) >= 500 THEN
```

The counter `recipe_count` is maintained by the `update_recipe_count` AFTER trigger. If the counter diverges from the actual row count (e.g., from direct SQL inserts in admin tools, migrations, or a crash between the INSERT and the AFTER trigger), the limit check becomes inaccurate. Additionally, the data-validation docs say the limit is 200, the trigger enforces 500 — inconsistency.

Fix: Use `SELECT COUNT(*) FROM recipe_recipes WHERE user_id = NEW.user_id` in the check trigger, or reconcile the limit constant (200 vs 500) across docs and code. Consider replacing the counter column with a generated column or removing it in favor of a simple count.

Effort: Low. [NEW — limit discrepancy is NEW; counter pattern noted in docs]

---

**MED-03** — `docker/postgres/02_functions.sql` lines 69–77 — **`check_participant_limit` uses `COUNT(*)` with no index on `(trip_id)`**

The limit trigger does:
```sql
SELECT COUNT(*) FROM trip_participants WHERE trip_id = NEW.trip_id
```

`idx_trip_participants_trip` is created in `01_schema.sql` (line 283), so this is indexed. However the pattern still executes a full count on every participant insert. For 20-participant maximum, performance impact is negligible, but semantically it is better to use the same denormalized-counter approach consistent with recipe/trip, or to validate limits at the application layer.

Fix: Low priority — current approach is functionally correct.

---

**MED-04** — `alembic/versions/001_enhance_auth_schema.py` lines 41–42 — **`ALTER TABLE … RENAME COLUMN` is a table lock in PostgreSQL < 17**

```python
op.alter_column('auth_sessions', 'session_token', new_column_name='token_hash')
```

Prior to PostgreSQL 17, `RENAME COLUMN` acquires an `ACCESS EXCLUSIVE` lock for the duration of the operation (it rewrites the catalog entry). On a table with active connections, this will block all reads and writes until the lock is acquired. For a session table with high read frequency, this can cause connection pile-up.

Fix: In production, schedule this migration during a maintenance window, or use the add-column / backfill / swap / drop pattern if zero-downtime is required. Add a comment to the migration noting the lock requirement.

Effort: Low. [NEW]

---

**MED-05** — `alembic/versions/003_add_share_links_table.py` lines 56–60 — **Backward-compatibility columns added to `recipe_recipes` without clear deprecation plan**

```python
op.add_column('recipe_recipes', sa.Column('share_token', sa.String(length=255), nullable=True))
op.add_column('recipe_recipes', sa.Column('share_expires_at', sa.DateTime(timezone=True), nullable=True))
```

The comment says "for backward compatibility" but the canonical sharing mechanism is now the `share_links` table. Having two parallel sharing systems (column-on-recipe vs. dedicated table) will cause confusion and divergence. There is no migration that removes these columns, and no documentation of when they will be dropped.

Fix: Document a deprecation timeline. In the migration after backward compatibility is no longer needed, add `op.drop_column('recipe_recipes', 'share_token')` and `op.drop_column('recipe_recipes', 'share_expires_at')`.

Effort: Low. [NEW]

---

**MED-06** — `docker/postgres/01_schema.sql` lines 157–185 — **`recipe_recipes.unpublish_protection` CHECK constraint has inverted logic**

```sql
CONSTRAINT unpublish_protection CHECK (
    NOT is_published OR fork_count <= 5 OR fork_count IS NULL
)
```

This reads: "if is_published is TRUE and fork_count > 5 and fork_count IS NOT NULL, violation." The intent documented in `jidelnicek_Data Validation Rules.md` §5.3 is "cannot UNPUBLISH if fork_count > 5." The constraint enforces the opposite: it prevents publishing a recipe that has >5 forks (setting `is_published = TRUE` would violate it). It does nothing to prevent unpublishing.

Fix: Remove this CHECK constraint. Enforce the unpublish guard in the application service layer where the user intent (publish vs unpublish) can be checked contextually. Alternatively use a trigger that fires only when `is_published` transitions from `TRUE` to `FALSE`.

Effort: Low. [NEW]

---

### LOW

**LOW-01** — `docker/postgres/00_init.sql` lines 21–22 — **Hardcoded dev credentials committed to repository**

```sql
CREATE USER jidelnicek_app WITH PASSWORD 'jidelnicek_dev_2024';
CREATE USER jidelnicek_readonly WITH PASSWORD 'readonly_dev_2024';
```

These are development credentials and the files are under `docker/postgres/` which is checked into git. While acceptable for a dev-only Docker setup, the pattern risks accidental reuse in staging/production if the same SQL file is run. The `documentation/jidelnicek_Security Threat Model.md` review notes credential management as a concern.

Fix: Parameterize via Docker environment variables: `CREATE USER jidelnicek_app WITH PASSWORD :'APP_DB_PASSWORD'` using `psql`'s `:variable` substitution, or generate passwords dynamically in `docker-compose.yml` secrets.

Effort: Low. [NEW]

---

**LOW-02** — `docker/postgres/01_schema.sql` lines 118, 133, 196 — **`VARCHAR(100)` / `VARCHAR(50)` used where `TEXT` is idiomatic**

`name VARCHAR(100)` on `common_ingredients`, `common_snacks`, `recipe_recipes`, `trip_trips`, `trip_templates`. In PostgreSQL there is no performance difference between `VARCHAR(n)` and `TEXT` — storage is identical, and a length constraint is enforced identically via a `CHECK(length(col) <= n)` internally. Using `TEXT` with an explicit `CHECK` constraint (or Pydantic/application-level validation) is more idiomatic.

Fix: Cosmetic — convert to `TEXT` with application-layer length validation. Not urgent. [NEW]

---

**LOW-03** — `docker/postgres/01_schema.sql` lines 9, 29–30 — **`auth_users.recipe_count` / `trip_count` are denormalized counters with divergence risk**

The counters are maintained by `AFTER INSERT OR DELETE` triggers. They are not maintained on `UPDATE`, not reconciled on startup, and can drift if rows are inserted/deleted outside the trigger path (e.g., `DELETE FROM recipe_recipes WHERE user_id = $1` via admin tooling does fire the trigger, but direct COPY or truncate does not). The `check_recipe_limit` trigger (CRIT above) relies on these counts being accurate.

Fix: Consider making these views or computed properties, or add a periodic reconciliation job. At minimum, add a trigger for `UPDATE` (e.g., if `user_id` changes, decrement old and increment new).

Effort: Low. [NEW]

---

**LOW-04** — `docker/postgres/01_schema.sql` lines 374–378 — **`trip_recipe_snapshots.original_recipe_id` FK without index**

```sql
original_recipe_id UUID REFERENCES recipe_recipes(id)
```

There is no index on `trip_recipe_snapshots(original_recipe_id)`. Queries finding all trip snapshots that reference a given recipe (e.g., "how many trips use this recipe?") or the FK constraint check on delete will do a sequential scan.

Fix: `CREATE INDEX idx_trip_recipe_snapshots_original ON trip_recipe_snapshots(original_recipe_id);`

Effort: Trivial. [NEW]

---

**LOW-05** — `docker/postgres/01_schema.sql` lines 297–314 — **`sharing_forks.original_recipe_id` FK has no `ON DELETE` behavior defined**

```sql
original_recipe_id UUID NOT NULL REFERENCES recipe_recipes(id)
```

No `ON DELETE` clause, so PostgreSQL defaults to `RESTRICT`. Attempting to delete an original recipe that has been forked will fail with a foreign key violation. This is inconsistent with the data validation rules which describe a grace period / unpublish flow. The `recipe_forks` table in the documentation schema uses the same bare FK.

Fix: Decide on intent: if forks should survive deletion of the original recipe, use `ON DELETE SET NULL` (make `original_recipe_id` nullable) or `ON DELETE NO ACTION`. If they should be cascade-deleted, use `ON DELETE CASCADE`. Document the decision.

Effort: Low. [NEW]

---

**LOW-06** — `alembic/versions/003_add_share_links_table.py` lines 43–44 — **Redundant unique constraints on `share_links`**

```python
sa.UniqueConstraint('entity_type', 'entity_id', 'share_token', name='uq_share_links_entity_token'),
sa.UniqueConstraint('share_token')
```

`share_token` is already unique via the second constraint. The first constraint `(entity_type, entity_id, share_token)` is logically implied by `UNIQUE(share_token)` alone and adds index storage overhead with no additional integrity guarantee.

Fix: Drop `uq_share_links_entity_token`; keep `UNIQUE(share_token)`.

Effort: Trivial. [NEW]

---

## Query Patterns (N+1 and Others)

**QP-01 — Async lazy loading explosion risk (CRITICAL if ORM models use default lazy loading)**

`conftest.py` imports `from jidelnicek.db.base import *` to get all models. The session fixture uses `expire_on_commit=False` which is correct for async sessions. However, review notes in `subtask_3.9_database_relationships.md` confirm that "relationships configured with lazy loading" are used alongside selectinload/joinedload strategies in `query_helpers.py`. In `asyncio` + SQLAlchemy 2.0, accessing a lazy-loaded relationship attribute outside the `async with session` context (e.g., in a Pydantic serializer after the session closes) raises `MissingGreenlet`. If any code path accesses `recipe.ingredients` without an explicit `selectinload`, it will either raise an error or — if the session is still open — issue one SELECT per row, causing N+1 behavior.

Mitigation (what to verify in actual model code when source is restored): All relationship definitions should include `lazy="raise"` or `lazy="raise_on_sql"` in async contexts to surface N+1 issues immediately during development. All service layer queries should use explicit `selectinload` or `joinedload` options.

---

**QP-02 — `validate_recipe_ingredients` trigger runs two subqueries per ingredient insert**

```sql
SELECT 1 FROM common_ingredients 
WHERE id = NEW.ingredient_id 
AND (
    user_id = (SELECT user_id FROM recipe_recipes WHERE id = NEW.recipe_id)
    OR is_global = TRUE
)
```

This is a nested subquery executing on every ingredient insert or update. The inner `(SELECT user_id FROM recipe_recipes ...)` runs once per row. Both `common_ingredients(id)` and `recipe_recipes(id)` are PKs so the lookups are fast, but this is O(n) trigger overhead for bulk ingredient inserts on a recipe with 50 ingredients.

Mitigation: Acceptable at current scale. If batch ingredient inserts become common, move this validation to the application layer.

---

**QP-03 — `audit_trigger` captures full `to_jsonb(NEW)` and `to_jsonb(OLD)` on every write**

On UPDATE operations, the audit trigger stores the full old and new row as JSONB. For `auth_users` (which has 30+ columns including large text fields) and `common_ingredients` (with 30+ nutritional columns), every UPDATE generates a large JSONB diff written to `audit_log`. With high-frequency writes, `audit_log` will grow very fast.

Mitigation: Consider column-level filtering (only audit changed columns, not full rows). The audit trigger already has `EXCEPTION WHEN OTHERS THEN RETURN NULL` which means audit failures silently swallow errors — this means audit entries can be missing without any notification.

---

**QP-04 — Recipe/trip list queries with `skip/limit` (OFFSET pagination) noted in reviews**

`subtask_3.6_recipe_crud_operations.md` documents `get_recipes()` using `skip/limit`. OFFSET pagination on large tables requires the database to read and discard `skip` rows. At scale (e.g., user with 500 recipes, `skip=490`), this is a full scan of 490 rows before returning 10.

Fix: Switch to keyset/cursor pagination: `WHERE id > :last_seen_id ORDER BY id LIMIT :n`.

---

**QP-05 — `cleanup_expired_sessions()` performs an unindexed DELETE without LIMIT**

```sql
DELETE FROM auth_sessions WHERE expires_at < NOW();
```

`idx_auth_sessions_expires` is defined on `expires_at`, so the WHERE clause is indexed. However, on a system with many expired sessions, a single unbounded DELETE can hold locks for extended periods. No `LIMIT` is applied, and the function is called from `perform_maintenance()` in a single transaction.

Fix: Add a batch loop with `LIMIT 1000` to spread lock contention over multiple transactions.

---

## Migration Safety Audit

| Migration | Risk | Detail |
|---|---|---|
| `001_enhance_auth_schema.py` | MEDIUM | `ALTER TABLE auth_sessions RENAME COLUMN` takes `ACCESS EXCLUSIVE` lock. Drops `verification_token`, `reset_token`, `reset_token_expires` from `auth_users` — data loss if not migrated first. No data migration step for existing tokens. |
| `002_add_session_management_fields.py` | LOW | Additive only; nullable columns. Safe. |
| `003_add_share_links_table.py` | MEDIUM | Creates new table (safe). Adds `share_token` and `share_expires_at` to `recipe_recipes` (additive, safe). No `postgresql_concurrently=True` on the `UNIQUE` index `idx_recipe_share_token`. On a table with many rows this will lock `recipe_recipes` for the duration of index build. |
| `004_add_marketplace_ratings_reviews.py` | CRITICAL | Creates `recipe_ratings` and `recipe_reviews` then installs triggers that reference `recipe_recipes.rating_average` and `recipe_recipes.rating_count` — columns that do not exist. Migration will create the triggers successfully (DDL compiles), but they will fail at runtime on every DML on `recipe_ratings`. No `op.add_column` for these columns. Downgrade correctly drops the tables and triggers. |
| `005_add_trip_day_snacks_table.py` | LOW | Additive only. `ON DELETE RESTRICT` on `snack_id` FK is intentional and correct. No concurrent index creation. |

**General migration gaps:**
- No migration creates the base schema. The base schema is raw SQL applied by Docker init, never tracked by Alembic. Adding `alembic current` to CI is impossible without a migration-zero.
- None of the index creation operations use `postgresql_concurrently=True`. For a live production database, all index creations in migrations 001–005 will lock affected tables.
- The `alembic/versions/` migrations have no `script_location` configured in `alembic.ini` — they are invisible to `alembic` commands unless `alembic.ini` is changed or `--config` is passed manually.

---

## Transaction / Session Lifecycle

**TX-01 — `expire_on_commit=False` is correctly set in `conftest.py`**

`async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)` prevents the `MissingGreenlet` error that occurs when accessing model attributes after `await session.commit()` in async code. This setting should be confirmed in production session factory (source unavailable).

**TX-02 — Test session does rollback-based isolation (correct)**

The test `db_session` fixture yields a session and calls `await session.rollback()` on teardown. This is the correct pattern for test isolation when using a real database.

**TX-03 — Pool sizing mismatch with `max_connections = 10` on server**

`postgresql.conf` sets `max_connections = 10` (with 2 reserved for superuser = 8 available). The production `config/production.env` sets `DB_POOL_SIZE=50` with `DB_POOL_MAX_OVERFLOW=20`. At peak, the pool attempts 70 connections to a server that allows 8. This will result in `psycopg2.OperationalError: FATAL: sorry, too many clients already` under any non-trivial load. The comment in `postgresql.conf` references pgBouncer but no pgBouncer configuration is present.

Fix: Either raise `max_connections` to at least `(DB_POOL_SIZE + DB_POOL_MAX_OVERFLOW) * num_workers + 5` or deploy pgBouncer in transaction-pooling mode and reduce `DB_POOL_SIZE` in the application (2–4 is appropriate per worker with transaction pooling).

**TX-04 — No `pool_pre_ping=True` configured**

Environment config keys show only `DB_POOL_SIZE` and `DB_POOL_MAX_OVERFLOW` — no `pool_pre_ping`. Without `pool_pre_ping=True`, stale connections from a pool that survive a server restart or network drop will raise errors on first use rather than being transparently recycled.

Fix: Add `pool_pre_ping=True` to the SQLAlchemy engine creation.

**TX-05 — Triggers that do DML (audit, fork tracking, count updates) fire inside the caller's transaction**

Every write to `recipe_recipes`, `trip_trips`, or `common_ingredients` fires multiple AFTER triggers: an audit INSERT, a count UPDATE, and potentially a fork INSERT. All of these run within the same transaction as the original write. A failure in the audit trigger is silently swallowed (`EXCEPTION WHEN OTHERS THEN RETURN NULL`), but the fork and count triggers are not protected — a trigger failure will roll back the original write.

This is generally correct behavior, but the silent audit swallowing means audit entries can be dropped without any notification. Consider logging to PostgreSQL's error log at minimum.

---

## Index Recommendations

Concrete index statements for gaps identified above:

```sql
-- MED-01: Enforce uniqueness for global ingredient names
CREATE UNIQUE INDEX uq_global_ingredients_name
    ON common_ingredients(name)
    WHERE user_id IS NULL;

-- LOW-04: FK index on trip_recipe_snapshots.original_recipe_id
CREATE INDEX idx_trip_recipe_snapshots_original
    ON trip_recipe_snapshots(original_recipe_id);

-- Missing: FK index on sharing_forks.forked_recipe_id
-- (The UNIQUE constraint creates an index, but original_recipe_id also needs one for reverse lookups)
-- Already exists: idx_forks_original ON sharing_forks(original_recipe_id) -- confirmed in 01_schema.sql

-- Missing: composite user+status index for active recipe queries (query optimization)
CREATE INDEX idx_recipes_user_archived_updated
    ON recipe_recipes(user_id, is_archived, updated_at DESC)
    WHERE NOT is_archived;

-- Missing: covering index for session lookup (avoid table fetch)
CREATE INDEX idx_auth_sessions_token_hash_covering
    ON auth_sessions(token_hash)
    INCLUDE (user_id, expires_at, is_valid)
    WHERE is_valid = TRUE;

-- Missing: index on audit_log for high-volume cleanup
CREATE INDEX idx_audit_log_created_brin
    ON audit_log USING BRIN(created_at);
-- BRIN is appropriate for an append-only table ordered by insertion time.
-- Replaces or supplements idx_audit_log_created (B-tree) for range scans.

-- Missing: trip_days.date for date-range trip queries
-- Already exists: idx_trip_days_date -- confirmed in 01_schema.sql

-- Migration-safe versions (for live databases):
-- CREATE INDEX CONCURRENTLY idx_trip_recipe_snapshots_original
--     ON trip_recipe_snapshots(original_recipe_id);
-- CREATE UNIQUE INDEX CONCURRENTLY uq_global_ingredients_name
--     ON common_ingredients(name) WHERE user_id IS NULL;
```

---

## Open Questions

1. **Where is the actual SQLAlchemy ORM source?** All `src/jidelnicek/` directories are empty stubs. The models are referenced by `conftest.py` (`from jidelnicek.db.base import *`, `from jidelnicek.core.database import Base`) but the files do not exist in the working tree. Are they excluded from git (`.gitignore`), generated at build time, or stored elsewhere? This review cannot audit ORM-level relationship loading strategies, `expire_on_commit` settings, or session lifecycle management without these files.

2. **Is `docker/postgres/00_init.sql` applied in production?** The init SQL file hardcodes credentials and sets `lock_timeout = 0` / `idle_in_transaction_session_timeout = 0`. The `postgresql.conf` file sets more restrictive values. Which takes precedence depends on initialization order.

3. **What is the intended migration bootstrap for a fresh production database?** Given the dual-tree problem (CRIT-02), is the intent to always apply `docker/postgres/01_schema.sql` first and then run `alembic upgrade head` (pointing at `alembic/versions/`) as a separate step? This should be documented and automated.

4. **Is pgBouncer planned?** The connection math (50+20 pool vs 8 available connections in `postgresql.conf`) is only solvable with an external pooler or a major `max_connections` increase. The `postgresql.conf` comment mentions pgBouncer but no configuration file exists.

5. **RLS status:** The `Database Schema.md` says "Consider implementing RLS for multi-tenant isolation." Given that every table has a `user_id` FK and all access control is enforced at the application layer, RLS is not present. For a solo-user application this may be acceptable, but for any scenario where multiple application roles or direct DB access is possible, RLS on `recipe_recipes`, `trip_trips`, `common_ingredients`, and `common_snacks` would be the defense-in-depth layer.

6. **`sharing_reviews` vs `recipe_ratings` + `recipe_reviews` (migration 004):** The base schema in `01_schema.sql` creates `sharing_reviews` (combined rating + review in one table). Migration 004 creates separate `recipe_ratings` and `recipe_reviews`. These appear to model the same domain. Which is the authoritative table, and is `sharing_reviews` still in use?
