# Jídelníček 2.0 — Deep Review Synthesis

**Date:** 2026-05-14
**Reviewers:** 17 specialist subagents (see `Per-report index` below)
**Reviewed against:** working tree + git index + prior review artifacts (security gap analysis, threat model, OpenAPI spec, etc.)

---

## How to read this report

This is a synthesis. Each finding lists which reviewers raised it (cross-reviewer consensus is a strong signal). Open the individual reports for code excerpts and full reasoning.

**Severity scale:**
- 🔴 **BLOCKER** — fix before any `git commit`. Secret leaks, data-loss risks, deploy-time crashes.
- 🟠 **CRITICAL** — fix before any pre-production deployment. Correctness bugs, missing auth/authz, broken migrations.
- 🟡 **HIGH** — fix before scaling. Performance hotspots, behavioral test gaps, deferred technical debt with compounding cost.
- 🟢 **MEDIUM/LOW** — see individual reports.

**Caveat — review coverage is uneven.** The working tree has a corrupted git state (see Blocker B-1). Several reviewers (python, comments, type-design, docs-drift, partially: security/database) could not read `src/jidelnicek/` source and worked only from peripheral files (migrations, tests, scripts, configs). The flow-tracer found and used a `Jidelnicek_2.0.zip` archive in the repo, so its findings DO cover the real backend code. The architecture, code-explorer, dead-code, performance, and silent-failure reviewers also reached deeper than the file-path level. Findings that depend on actual source content are labeled accordingly. **Once the git state is restored (Blocker B-1), re-running python-reviewer and comment-analyzer would meaningfully widen coverage.**

---

## TL;DR

1. **Do not run `git commit` on the current staging set.** It would publish a live JWT signing key, plaintext DB and Redis passwords across 4+ files, live access/refresh JWTs (`auth_token.txt` and 8 `*_payload.json` files), an `admin_password = "admin123"` constant, and a backup directory `migrations_backup_20250710_031019/`. Once committed, all of these must be rotated and the history rewritten.
2. **The repo's git state is broken but recoverable.** `master` has zero commits and 1,768 staged paths, of which ~1,398 are `AD` (in index, deleted from worktree). Staged blob SHAs are not present in `.git/objects/`. The remote (`git@gitlab.com:matescb/jidelnicek_2.0.git`) almost certainly has the real blobs — **`git fetch origin` is non-destructive and should be your first action.**
3. **The application has working code but multiple production-fatal correctness bugs.** A trigger in migration 004 references columns that were never added — every rating write will throw. The Alembic config points at an empty migrations directory, so `alembic upgrade head` does nothing on a fresh database. The legacy PDF export embeds hardcoded stubs (`calories: 2000`, `total_items: 0`) regardless of trip contents. The `GET /api/v1/share/my-links` route is permanently shadowed by `GET /{shareToken}` and always 404s.
4. **Documented architecture significantly exceeds implementation.** PostgreSQL schema isolation (`auth.*`, `recipe.*`, …) is documented as the modular-monolith boundary mechanism but never built — all tables are flat in `public`. ~60% of API endpoints documented in the OpenAPI spec are unimplemented (or returning 501). The OpenAPI YAML is heavily drifted from `core/routers/` and the parallel `api/v1/endpoints/` surface is mostly empty.
5. **The calculation engine has 3 confirmed accuracy bugs** caught by existing tests (`tests/recipe/test_scaling_accuracy.py`): 100% error on near-zero scaling, 12.76% on participant-coefficient meal path, 33% on aggressive piece rounding. The product claims 99.9% accuracy. These are real bugs in real tests — the test suite is right, the engine is wrong.

---

## 🔴 Pre-commit blockers

Order them as: stop, fix, then commit.

### B-1 — Git object store is broken; do not destructive-git-ops
**Reviewers:** repo-map, architecture, dead-code, code-quality, every reviewer (caveat)
**State:** `master` has zero commits. ~1,398 of 1,768 indexed paths are `AD`. `git cat-file` cannot resolve any staged blob SHA. A `git stash`, `git reset --hard`, or `git clean` could destroy uncommitted local-only work. The remote at `git@gitlab.com:matescb/jidelnicek_2.0.git` should have the real blobs.
**Action:**
```bash
# Non-destructive — restores blobs into .git/objects/, leaves worktree alone
git fetch origin
# Then reconcile worktree against origin/main or origin/master:
git status
git diff --cached --name-only | head    # confirm staged file list looks expected
```
Do NOT `git reset --hard`, `git clean -fd`, or `git stash drop` until origin has been verified.

### B-2 — Live secrets staged for commit (rotate ALL of these before commit)
**Reviewers:** security (C-01, C-02), code-quality (C-1, C-2, C-3), python (CRIT), harness (C1, C2), database (LOW-01)
**Concrete secrets in the staging set:**
- JWT signing key `u0gMPCF7mFpQ4tqMxFNUNmXVH2PK6xEN9D06Z7OCiPE` — in `.env`, `.env.dev`, `.env.local`, **and `.env.example`**.
- `DB_PASSWORD=jidelnicek_dev_2024` — in `.env*` AND in `.claude/settings.local.json` permission rules (lines 158-159).
- `REDIS_PASSWORD=redis_dev_password_2024`.
- `admin_password = "admin123"` — `create_admin_user.py:35`, **and logged at INFO level** on line 67-69.
- `config/development.env` and `config/test.env` — `.gitignore` excludes `.env.*` but **not** `config/*.env`.
- `auth_token.txt`, `auth_response.json`, `login.json`, `login_payload.json`, `register_payload.json`, `test_login_payload.json`, `test_register.json`, `test_register_payload.json` — 8 files containing live JWT access+refresh tokens with a real user UUID and plaintext passwords (`ValidPassword123!`, `SecurePass@2024!`, etc.).
- `PGADMIN_DEFAULT_PASSWORD: pgadmin_dev_2024` — `docker-compose.dev.yml:109`.
- DB role `jidelnicek_app` has `GRANT ALL` in `docker/postgres/00_init.sql:25-30` (privilege escalation risk on compromise).

**Action sequence:**
```bash
# 1. Untrack the leaks (worktree files preserved):
git rm --cached \
  .env .env.dev .env.local \
  config/development.env config/test.env \
  .claude/settings.local.json .claude/.settings.local.json.kate-swp \
  auth_token.txt auth_response.json login.json \
  login_payload.json register_payload.json \
  test_login_payload.json test_register.json test_register_payload.json \
  migrations_backup_20250710_031019/

# 2. Extend .gitignore (NEW patterns):
# .claude/settings.local.json
# .claude/*.kate-swp
# config/*.env
# !config/*.env.example
# auth_token.txt
# auth_response.json
# login.json
# *_payload.json
# *_response.json
# test_register*.json
# migrations_backup_*/
# .remember/

# 3. Replace .env.example value with a placeholder:
# SECRET_KEY=CHANGE_ME_generate_with_python_secrets_token_urlsafe_32
# DB_PASSWORD=CHANGE_ME
# REDIS_PASSWORD=CHANGE_ME

# 4. Rotate JWT signing key in production environments (do not just delete from .env).
# 5. Rotate admin/dev DB passwords.
# 6. Remove the admin_password constant from create_admin_user.py and require an env var or CLI arg.
```

### B-3 — `.claude/settings.local.json` has 3 invalid permission rules + ~28 dead fragments + 13 duplicates
**Reviewers:** harness (M1/M2), `/doctor` diagnostic from earlier in the session
This is what `/doctor` originally flagged. Beyond the 3 unparseable `python -c "..."` blocks at lines 159/184/192, the file has shell-loop fragments (`Bash(do echo ...)`, `Bash(done)`, `Bash(fi)`) that never match anything, 13 exact duplicates, and 6 `sudo *` wildcard rules (`Bash(sudo usermod:*)`, `Bash(sudo docker:*)`, etc.) that grant unprompted elevated execution. **Once B-2 unstages this file, audit and reduce 214 rules to ~170 before re-adding it (or, better, keep it gitignored permanently).**

---

## 🟠 Critical findings (correctness / deploy-time crashes)

| # | Finding | Reviewers | Source |
|---|---------|-----------|--------|
| C-1 | **Migration 004 trigger references non-existent columns.** `update_recipe_rating_stats()` updates `recipe_recipes.rating_average` and `rating_count`, but `op.add_column` for those is missing in 004. Every INSERT/UPDATE/DELETE on `recipe_ratings` throws. The entire rating system is non-functional out of the gate. | database (CRIT-01), architecture (MEDIUM-5), performance (BE-M1) | `alembic/versions/004_add_marketplace_ratings_reviews.py:63-108` |
| C-2 | **Migrations are configured to run against the empty directory.** `alembic.ini` sets `script_location = migrations`; the 5 real migrations live in `alembic/versions/`. `entrypoint.sh` runs `alembic upgrade head` and finds nothing. **On a fresh DB, the container starts without any of the 5 enhancement migrations applied** (sessions, share_links, ratings, snacks). Bootstrap relies on un-tracked `docker/postgres/01_schema.sql` instead. | architecture (HIGH-3), database (CRIT-02), comments, dead-code, performance, repo-map | `alembic.ini`, `migrations/versions/` (empty), `alembic/versions/001-005_*.py` |
| C-3 | **Calculation engine has 3 confirmed precision failures** that violate the 99.9% accuracy claim. Tests already catch them: `test_extreme_precision_cases` (100% error at 0.000001), `test_participant_coefficient_accuracy` (12.76% on lunch coefficient), `test_rounding_impact_on_accuracy` (33% on piece rounding). The tests are correct — the engine is wrong. | tests (H-1), type-design (C-1 invariant range) | `tests/recipe/test_scaling_accuracy.py:87,267,394`, `RecipeScaler`, `ParticipantScaler`, `SmartRounder` |
| C-4 | **`ParticipantCoefficient` has three conflicting ranges.** PRD/docs say 10–300%; DB CHECK constraint says `> 0`; the Python model accepts 0.01–999.99%. A value of 5% or 500% is accepted and silently corrupts every meal-quantity calculation. | type-design (C-1), database, tests (H-1 related) | `trip_participants.coefficient`, models, validators |
| C-5 | **Token refresh rotation is non-atomic.** `revoke_session` and `create_session` are two separate commits in `auth/services/token_service.py:1321-1331` with no wrapping transaction. A crash between them permanently logs the user out of that device. | flow-trace (HIGH), python | `auth/services/token_service.py:1321-1331` |
| C-6 | **Route ordering bug: `GET /api/v1/share/my-links` is dead.** `GET /{shareToken}` is declared 140 lines earlier in `core/routers/sharing.py`. FastAPI matches the parameterized route first; every call to `/my-links` becomes a token lookup → 404. | flow-trace (CRITICAL) | `core/routers/sharing.py:124 vs :264` |
| C-7 | **Legacy PDF export ships hardcoded stubs.** `GET /trips/{id}/export/pdf` calls `_prepare_trip_data_for_export`, which sets `shopping_list = {"categories": {}, "total_items": 0}` and `nutrition = {"calories": 2000, "proteins": 75, ...}` — independent of actual trip contents. `ShoppingListGenerator` is instantiated and its result discarded. Users receive misleading PDFs. The canonical `/export/shopping-list` correctly returns 501 instead. | flow-trace (CRITICAL) | `trip/routers/export.py:141-163, :335` |
| C-8 | **Postgres connection pool sized 70 vs `max_connections = 10`.** `config/production.env` sets `DB_POOL_SIZE=50, DB_POOL_MAX_OVERFLOW=20`; `docker/postgres/postgresql.conf` sets `max_connections=10` (8 usable). Connection exhaustion under any non-trivial load → `FATAL: sorry, too many clients already` on login. No pgBouncer is configured. | database (TX-03), performance (BE-H6) | `docker/postgres/postgresql.conf:7`, `config/production.env`, app engine config |
| C-9 | **DB role `jidelnicek_app` has `GRANT ALL` including DDL.** `docker/postgres/00_init.sql:25-30`. If the app is compromised, the attacker has `CREATE TABLE`, `DROP TABLE`, full schema rights. Docs explicitly call out the need for separate users for app vs admin — never implemented. | database (HIGH-03), security | `docker/postgres/00_init.sql:25-30` |
| C-10 | **PostgreSQL schema isolation never implemented.** Docs (`jidelnicek_Modular_Monolith_Architecture.md`) mandate per-module schemas (`auth.*`, `recipe.*`, …) as the boundary mechanism. All 5 migrations create flat tables in `public` (`auth_users`, `recipe_recipes`, …). The isolation layer the whole architecture rests on does not exist. | architecture (CRITICAL-3), docs-drift, database | migrations + `Documentation/jidelnicek_Modular_Monolith_Architecture.md` |
| C-11 | **CI tests "pass" regardless of pytest results.** `unit-tests` and `integration-tests` append `\|\| true` to pytest invocations. Coverage gate set to `--cov-fail-under=70` against a documented 80% requirement. Security scan has `allow_failure: true`. CI is theatrical, not enforcing. | harness (H2/H3/M3), tests | `.gitlab-ci.yml` |
| C-12 | **All test files except `conftest.py`, `test_openapi_contract.py`, and `split.py` have been deleted from disk.** 121 frontend test files and the bulk of `tests/{auth,recipe,trip,admin,api,core,…}/` are gone. Last recorded run had 1,148 setup errors due to a single FK error (`content_reports.reporter_id` references `users` before the table is registered) — 59% of all collected tests cannot run. | tests (C-1, C-3), repo-map, code-quality | `tests/conftest.py:62`, `frontend/src/**/__tests__/` |
| C-13 | **JWT algorithm-confusion CVE unfixed.** `python-jose==3.5.0` carries CVE-2024-33664 (algorithm confusion) and CVE-2024-33663 (DoS). Library is unmaintained since 2022. Mitigation depends on whether decode calls pass `algorithms=["HS256"]` explicitly — cannot verify without reading the source. | security (H-07), python | `pyproject.toml:17` |
| C-14 | **`recipe_recipes.cascade_recipe_archive` trigger writes NULL into a NOT NULL FK.** `UPDATE sharing_reviews SET recipe_id = NULL` violates the NOT NULL constraint and will throw on archive. The intended cascade is already handled by the FK's `ON DELETE CASCADE`; the trigger body is wrong. | database (HIGH-01) | `docker/postgres/02_functions.sql:207-216` |
| C-15 | **`validate_trip_dates` trigger imposes undocumented 30-day hard limit.** Validation docs say "no limit, warn if > 365 days". Trigger raises `EXCEPTION 'Trip duration cannot exceed 30 days'`. Long expeditions silently break with no UI affordance. | database (HIGH-04) | `docker/postgres/02_functions.sql:295-310` |
| C-16 | **bcrypt verify (~250-400 ms) is synchronous inside the async login handler.** Each login blocks the event loop for the full hash duration. Two simultaneous logins saturate one of the two uvicorn workers entirely. | flow-trace (HIGH), performance (BE-L3) | `auth/routers/auth.py:399-401` |
| C-17 | **Refresh token rotation disabled in every environment** including production template. `ROTATE_REFRESH_TOKENS=false`. A stolen refresh token remains valid for 7-30 days. | security (H-04) | `.env`, `.env.dev`, `.env.local`, `.env.example`, `config/production.env` |
| C-18 | **24h access token lifetime in default env** (`ACCESS_TOKEN_EXPIRE_MINUTES=1440`). Production overrides to 15 but the staged dev defaults will ship into any developer's setup. | security (H-01) | `.env`, `.env.dev`, `.env.local` |
| C-19 | **Production CSP allows `unsafe-inline` and `unsafe-eval`.** `docker/nginx/nginx.conf:89` renders the CSP entirely ineffective against XSS. Also permits `http:` in `default-src`. | security (H-03) | `docker/nginx/nginx.conf:89` |
| C-20 | **Postgres and Redis ports exposed to host in production compose.** `docker-compose.yml` maps `5432:5432` and `6379:6379`. Combined with weak dev password and empty Redis password in dev env, **Redis is reachable unauthenticated from anyone with network access to the host.** | security (H-06) | `docker-compose.yml:15-20, :37-42` |
| C-21 | **nginx `conf.d/` is empty — rate-limit zones defined but never applied.** `nginx.conf` declares `limit_req_zone` for login/api/upload but no `location` block references it. Application-level rate limiting exists in code but the nginx layer is decorative. | security (L-04) | `docker/nginx/nginx.conf:101-103`, `docker/nginx/conf.d/` |

---

## 🟡 High-severity themes (fix before scaling)

### Architecture & module coupling
- **`core/` is becoming a god module.** Sharing service, job manager, SSE/WebSocket, storage abstraction, monitoring, export wrappers, cleanup policies, notification service — `core/` now imports from `auth.models`, `recipe.models`, `trip.models` directly, inverting the documented dependency DAG. No `import-linter` or boundary enforcement exists. (architecture CRITICAL-2)
- **`common/` doubles as domain + infrastructure.** `common/models/{ingredient,snack,nutritional_value}.py` plus `common/{auth,config,database}.py` — the latter duplicating `core/`. `common.models` is an undeclared dependency hub. (architecture MEDIUM-2, dead-code)
- **Dual API surface.** `core/routers/` AND `api/v1/endpoints/` both exist; the latter is mostly empty (per dead-code + flow-trace). At least one is dead. (repo-map, architecture)
- **Module name shadowing.** Flat `admin/models.py`, `admin/schemas.py`, `recipe/schemas.py`, `core/monitoring.py` coexist with same-named packages. Python's package-vs-module resolution silently shadows the flat files. (architecture HIGH-5, dead-code)
- **No interface contracts, no `__all__`, no fitness functions.** The "modular monolith" is convention-only. (architecture CRITICAL-2)

### Data layer
- **All `TIMESTAMP` columns are timezone-naive.** Server tz is `Europe/Prague` in init scripts but `postgresql.conf` says UTC. SQLAlchemy migrations use `DateTime(timezone=True)` (correct → `TIMESTAMPTZ`), but `docker/postgres/01_schema.sql` doesn't — the two are out of sync. DST transitions and cross-env runs will silently drift timestamps. (database HIGH-02)
- **`alembic_migrations` chain non-runnable.** No migration creates the base schema — `01_schema.sql` is the only bootstrap and is not tracked. CI cannot verify migrations against a clean DB. (database CRIT-02, architecture HIGH-3)
- **N+1 queries everywhere it matters.** Trip detail ≈ 365 SELECTs (1 + 7 + 21 + 168 + 168). Marketplace browse: 2 + 2N (default limit 20 = 42). Recipe create issues raw `sql_text("INSERT INTO recipe_recipe_ingredients …")` per ingredient. No documented eager-load strategy. (performance BE-C2, flow-trace HIGH, code-explorer)
- **Recipe rating maintained by both trigger AND application layer.** Migration 004 installs `update_recipe_rating_stats()`, and `MarketplaceService.rate_recipe()` also calls `recalculate_rating()`. Race condition; double-write. (architecture MEDIUM-5, performance BE-M1)
- **Index gaps.** No partial unique index for global ingredients (`UNIQUE(name) WHERE user_id IS NULL`). No partial composite on `recipe_recipes(user_id) WHERE deleted_at IS NULL`. Missing FK index on `trip_recipe_snapshots(original_recipe_id)`. `audit_log` has B-tree on `created_at` where BRIN is appropriate for append-only. (database MED-01, LOW-04, performance BE-M2)
- **Two parallel sharing mechanisms.** `share_links` table (new) and legacy `recipe.share_token`/`recipe.share_expires_at` columns. Both have code paths. No deprecation plan. (architecture, database MED-05, flow-trace)

### Performance hot paths
- **PDF/Excel exports run synchronously in HTTP handlers.** Celery is already in dependencies but no worker is in `docker-compose.yml`. 2 concurrent exports saturate the 2-worker uvicorn. (performance BE-C1, architecture MEDIUM-3)
- **In-process `SimpleCache` (Python dict) shared across 2+ uvicorn workers → ~50% miss rate, no cross-worker invalidation.** Redis is deployed and wired into DI; just unused for this. (performance BE-H5)
- **`echo=settings.DEBUG` on the SQLAlchemy engine.** Combined with N+1 patterns, generates hundreds of log lines per request when `DEBUG=true` leaks into prod. (performance BE-H1)
- **uvicorn hardcoded to 2 workers** in `docker/entrypoint.sh:55`. (performance BE-H4)

### Frontend
- **`frontend/src/` has zero source files** (only directory scaffolding). `index.html` references a non-existent `main.tsx`. The app is non-runnable in the current worktree. Likely recoverable from `origin` (see B-1). (a11y CRITICAL, ts-review, dead-code, doc-drift, multiple)
- **`.eslintrc.js` declares `jest: true` on a Vitest project.** This masks "jest is not defined" runtime errors in 20+ test files — the lint passes silently while tests crash. (ts-review C-1)
- **Dual state authority for auth/theme.** Both `AuthContext`/`ThemeContext` (React Context) and `authStore`/`uiStore` (Zustand) are described as active. Two sources of truth for the same data. (ts-review H-4)
- **`"dependency": "^0.0.1"` and `@google/gemini-cli` listed as production deps.** The first is a stub npm package with no functionality. The second is a CLI tool. Smells like nobody reviews `package.json`. (ts-review H-6, M-6, dead-code, performance FE-M2)
- **Three competing UI libraries** (Radix + Headless UI + MUI) and **three icon libraries** (`react-icons` + `lucide-react` + `@mui/icons-material`). Bundle inflation, inconsistent a11y semantics, three different focus models. (a11y H-04, performance FE-H1/FE-H2, ts-review M-4)
- **`lang="en"` on `index.html` of a Czech app** (WCAG 3.1.1 A). Screen readers will phonetically butcher all Czech text. (a11y CRITICAL A-C-01)
- **Drag-and-drop day cards** (`@hello-pangea/dnd`) ship without a single-pointer alternative (WCAG 2.2 SC 2.5.7 AA, new in 2.2). (a11y CRITICAL A-C-04)

### Type design
- **No branded ID newtypes anywhere.** `RecipeId`, `TripId`, `UserId`, `IngredientId` are all interchangeable `UUID` / `string`. Passing a `TripId` where a `RecipeId` is expected is type-correct. (type-design H-3)
- **`NutritionalValues` is a 40-field flat struct with all-optional fields and no cross-field validators.** A valid `NutritionalValues(carbohydrates_g=10, sugars_g=50)` — nutritionally impossible — is accepted. The `sugars <= carbs` and `sat-fats <= total fats` invariants live in prose docs only. (type-design C-2, H-2)
- **No discriminated unions** for: Snack (piece vs per_100g), MealContent (assigned vs empty), Ingredient (global vs user). All modelled as nullable fields with runtime conditionals. (type-design)
- **`meal_slot` on `trip_meals` is unvalidated free string** — no FK or membership check against the owning trip's `meal_slots` config. Typos like `"Breakfst"` pass silently. (type-design C-3)

### Tests & quality gates
- **Test infrastructure has decayed.** Last run had 1,148 ERROR-at-setup (59%), 110 failures, 696 passes out of 1,954 collected. Frontend test directories all empty. Test naming, AAA structure, and `freeze_time` discipline missing. Many "behavioral" tests assert mock calls rather than observable state. (tests, code-quality)
- **Contract test treats 501 as success** — `tests/test_openapi_contract.py:145`. Permanently hides the gap between OpenAPI spec and implementation. (tests L-1)
- **Three independent `LocalStorageBackend` reimplementations** at repo root (`test_storage_minimal.py:700L`, `test_storage_direct.py:554L`, `test_storage_simple.py:243L`). Already diverged silently. (code-quality H-1, silent-failure L-1)

### Silent failures
- **Top 3 worst per silent-failure-hunter:**
  - `tests/conftest.py:79` — triple-nested `except Exception: pass` swallows schema-drop failures. Tables accumulate across test runs → flaky security tests.
  - `test_storage_minimal.py:279` / `_direct.py:249` — `except Exception: continue` in `list_files()` / `get_usage_stats()` makes any file with corrupt metadata invisible silently.
  - `create_admin_user.py:72` — `except Exception as e: return False` in deploy-time path. The traceback is dropped, the boolean propagates ambiguously.
- **`logger.error(f"...{e}")` pattern** is repeated and **always loses tracebacks**. Should be `logger.exception(...)`. (silent-failure H-6)
- **`is_server_running` swallows non-ConnectionError exceptions.** Contract tests are skipped silently when the server has TLS/DNS/timeout problems. (silent-failure H-3)

### Documentation drift
- **0 of 40+ documented endpoints verified to exist in `core/routers/`** (per docs-drift agent — caveat: it couldn't read source, so may be over-stating). Flow-tracer DID find real routers via the zip archive, so actual coverage is partial, not zero. **The OpenAPI YAML `Documentation/jidelnicek_OpenAPI Spec.yaml` is severely drifted** and should be regenerated from `/openapi.json`.
- **`DEVELOPMENT.md` references 8+ setup scripts** (`./scripts/dev-setup.sh`, `./scripts/dev-start.sh`, …) that don't exist.
- **~120 of 140 env vars** are orphaned (`BAKALARI_*`, `STRAVA_*`, `PAYMENT_*`, many `FEATURE_*` flags). (docs-drift)
- **Frontend is React/Vite, docs say Next.js PWA.** Early architectural divergence never acknowledged. (architecture, docs-drift)

---

## Cross-cutting themes

1. **Documentation leads implementation by a wide margin.** Architecture docs, OpenAPI spec, gap analyses, threat model, validation rules — comprehensive and well-written. The implementation is approximately 40–50% complete and structurally inconsistent with the design. Continuing to iterate on docs while implementation debt accumulates makes the gap wider every sprint.
2. **Code reviewers, lint, and CI gates are theatrical.** `|| true` on pytest. `allow_failure: true` on security. 70% coverage gate vs 80% policy. Permission allowlist has 28 dead rules and 13 duplicates. ESLint `jest:true` on a Vitest project. Nothing in the harness actually enforces the standards everyone agrees to.
3. **Dual-system patterns repeat.** Two API surfaces (`core/routers/` + `api/v1/endpoints/`). Two migration trees (`alembic/versions/` + `migrations/versions/`). Two sharing mechanisms (`share_links` table + legacy `recipe.share_token` column). Two state systems frontend (`Context` + `Zustand`). Three UI libraries. Three icon libraries. Three `LocalStorageBackend` reimplementations. Every dual is unfinished migration.
4. **Secrets are scattered across at least 8 staging locations** — `.env`, `.env.dev`, `.env.local`, `.env.example`, `config/development.env`, `config/test.env`, `.claude/settings.local.json`, and 8 root-level `*_payload.json` / `auth_token.txt` files. There is no single "secret hygiene" pass; each location was added by a different commit/session.
5. **`core/` and `common/` grew into a god-module pair** — the documented domain modules depend on them, and they depend on the domain modules' models. Circular at the import-graph level once `core/services/sharing_service.py` imports `auth.models`, `recipe.models`, `trip.models`.
6. **Trigger-based and application-layer enforcement coexist** for the same invariants (rating stats, recipe counts, trip counts, ingredient limits). Either path alone is fine; both produces races. No single owner is documented.
7. **The 17 reviewers had uneven coverage of the same codebase** because the git state hid most of `src/jidelnicek/` from some of them. Several "no models found" / "no endpoints found" findings are artifacts of this, not the code's actual state. **Re-run the python and comment reviewers after B-1 to widen coverage.**

---

## Suggested remediation order

### Phase 0 — Get to a safe-to-commit state (today, ~30 min)
1. `git fetch origin` to restore blob objects (B-1).
2. Verify worktree against `origin` with `git status` and `git diff`. **Do not destructive-reset until you've verified.**
3. Apply the `git rm --cached` + `.gitignore` changes in B-2.
4. Rotate the JWT signing key, dev DB password, and Redis password.
5. Remove `admin_password = "admin123"` from `create_admin_user.py` (replace with `secrets.token_urlsafe(16)` or required CLI arg).
6. Make the first clean commit.

### Phase 1 — Make the deploy not crash (1-2 days)
7. Fix migration chain: either move `alembic/versions/001-005` into `migrations/versions/` or update `alembic.ini`. Add a CI step that runs `alembic upgrade head` against a fresh DB (C-2).
8. Add the missing `recipe_recipes.rating_average` / `rating_count` columns to migration 004 OR remove the rating trigger (C-1).
9. Fix the `cascade_recipe_archive` trigger (C-14) and remove the 30-day trip cap from `validate_trip_dates` (C-15).
10. Align pool size with `max_connections` (C-8) — either raise the server side or shrink the pool. Document the chosen path.
11. Add a Celery worker service to `docker-compose.yml` (BE-C1 / architecture MED-3).
12. Move PDF/Excel exports to background tasks; return `202` + polling endpoint.
13. Fix the `share/my-links` route ordering bug (C-6) — one-line reorder.
14. Rip out the hardcoded shopping/nutrition stubs in `_prepare_trip_data_for_export` or have it raise 501 like the canonical endpoints do (C-7).
15. Wrap the refresh-token rotation in a transaction (C-5).
16. Restrict `python-jose` decode to `algorithms=["HS256"]` or migrate to PyJWT (C-13).
17. Remove `|| true` from CI pytest invocations, bump coverage gate to 80%, set `allow_failure: false` on security scan (C-11).

### Phase 2 — Stop the bleeding (week 1)
18. Fix the conftest FK-order bug that nukes 1,148 tests (C-12).
19. Replace `eslintrc.js`'s `jest: true` with `vitest` env or `eslint-plugin-vitest`; replace `jest.fn()` / `jest.mock()` calls across the test suite.
20. Restrict CORS_ALLOW_HEADERS to specific values (security H-02), tighten CSP (C-19), close ports on production compose (C-20), wire nginx rate limits into actual `location` blocks (C-21).
21. Enable `ROTATE_REFRESH_TOKENS=true` (C-17), reduce access-token lifetime to 15min (C-18).
22. Restrict DB role `jidelnicek_app` to least-privilege grants (C-9).
23. Move bcrypt verify into `run_in_executor` (C-16).
24. Replace `SimpleCache` with Redis (performance BE-H5).
25. Add `selectinload`/`joinedload` to trip-detail and recipe-detail queries (performance BE-C2).
26. Fix the 3 calculation-engine precision bugs (C-3); make `ParticipantCoefficient` a validated newtype (C-4).

### Phase 3 — Architecture consolidation (weeks 2-4)
27. Pick a single API surface (`core/routers/` OR `api/v1/endpoints/`); delete the other.
28. Pick a single sharing mechanism (`share_links` table OR `recipe.share_token` columns); plan deprecation for the loser.
29. Pick a single migration tree; delete `migrations_backup_20250710_031019/`.
30. Decide whether PostgreSQL schemas (`auth.*`, `recipe.*`, …) will be built or whether the docs accept flat naming (C-10). Either path is defensible; the current limbo is not.
31. Frontend: pick one UI primitive library (recommend Radix + Tailwind), remove MUI + Headless UI; pick one icon library (recommend lucide); resolve Context-vs-Zustand auth/theme authority.
32. Add `import-linter` with a contract that enforces the module DAG; this prevents `core/` from re-becoming a god module.
33. Introduce branded ID types (`RecipeId`, `TripId`, `UserId`), `Grams`/`Kilocalories`/`Millilitres` newtypes, validated `ParticipantCoefficient`, validated `MealSlotName`.
34. Generate frontend TypeScript types from the OpenAPI spec; add a CI step that fails on drift.
35. Regenerate `Documentation/jidelnicek_OpenAPI Spec.yaml` from `/openapi.json` and treat the regenerated version as the source of truth.

### Phase 4 — Make testing actually mean something (ongoing)
36. Restore the deleted test files (from `origin` after B-1).
37. Replace mock-heavy admin/audit middleware tests with real DB assertions (tests H-2).
38. Add `freeze_time` / `time_machine` to all date-sensitive tests.
39. Migrate root-level `test_*.py` scripts into `tests/` or move them to `scripts/` (and remove `test_` prefix).
40. Add a11y testing infrastructure: `eslint-plugin-jsx-a11y` strict, `@axe-core/react` in dev, `vitest-axe` per component, `@axe-core/playwright` per critical flow, with a CI gate.

---

## Caveats and reviewer notes

- **Python reviewer reported only 35 readable files**, citing the git issue. Other reviewers (architecture, flow-trace, dead-code, performance, silent-failure) reached deeper — flow-tracer specifically read from a `Jidelnicek_2.0.zip` archive in the repo. **The python report under-states code health; re-run after B-1.**
- **Docs-drift reviewer reported 0 of 40+ endpoints implemented.** Flow-tracer confirmed real endpoints exist in `core/routers/auth.py`, `recipe/routers/recipes.py`, `recipe/routers/marketplace.py`, `trip/routers/trips.py`, `trip/routers/export.py`, `core/routers/sharing.py`. **The docs-drift agent's binary "implemented vs not implemented" verdict is therefore wrong on direction (some are implemented) but right on magnitude (the OpenAPI YAML is severely drifted, and ~60% of *documented* endpoints remain unimplemented per `missing_endpoints_analysis.md`).**
- **A11y reviewer correctly identified that `frontend/src/` is empty scaffolding.** The TS reviewer reached the same conclusion via a different route (config-files-only). After B-1 restores blobs, both reviews should be re-run.
- **Security reviewer flagged python-jose CVE but couldn't verify the mitigation** (algorithm whitelist) because the JWT decode call is in `src/jidelnicek/auth/services/token_service.py` which it couldn't read. Verify after B-1.

---

## Open questions for human review

1. **Is `origin` (`gitlab.com:matescb/jidelnicek_2.0.git`) reachable, and does it have the missing blob objects?** This is the unlock for half of these issues.
2. **Was the working-tree state intentional?** (`frontend/src/` empty, `src/jidelnicek/` empty, 121 frontend tests deleted, 23 backend tests deleted). It looks like a `git clean` or a botched cherry-pick rather than a planned wipe.
3. **Are `migrations/` and `alembic/` directories intentionally duplicated, or is this an unfinished consolidation?** (Comments analyzer, dead-code, architecture all flag this from different angles.)
4. **Is `core/services/sharing_service.py`'s cross-module reach an explicit architectural decision** (with `core/` as the cross-cutting layer) **or accidental coupling?** If accidental, an `import-linter` rule will catch the next instance.
5. **`AuthUser` vs `User` — same class or refactor artifact?** `conftest.py` imports `AuthUser`, `create_admin_user.py` imports `User`. Comments analyzer flagged this; needs a one-line check in the actual source.
6. **What is the canonical lifecycle of the legacy `recipe.share_token` column** vs the new `share_links` table? Both have live code paths in flow-traced routes.
7. **Is the OpenAPI YAML aspirational or authoritative?** If aspirational, label it as such and treat `/openapi.json` as truth. If authoritative, the 60% gap is a roadmap, not drift.
8. **Was the calculation-engine test suite passing at some point?** The 3 precision failures are caught by tests; that suggests either the engine regressed, or these tests have always failed and were tolerated. The answer changes the urgency.
9. **Is `MAX_SESSIONS_PER_USER=5` + revoke-oldest desired behaviour, or is it a placeholder?** Hidden in `auth/routers/auth.py` login path per flow-trace.
10. **`/api/v1/auth/monitoring/*` vs `/api/auth/monitoring/*`** (missing `v1`) — is the monitoring router intentionally outside the versioned API, or an oversight? Documented as a known issue but unfixed.

---

## Per-report index

| File | Reviewer | Coverage |
|------|----------|----------|
| `00-repo-map.md` | general-purpose | Repo structure, file counts, git state |
| `01-architecture.md` | ecc:code-architect | Module boundaries, layering, scalability |
| `02-flow-traces.md` | ecc:code-explorer | Login, recipe share, trip planning, export, marketplace |
| `03-code-quality.md` | ecc:code-reviewer | File sizes, duplication, secrets in working tree |
| `04-python.md` | ecc:python-reviewer | Caveat: limited coverage (35 files) |
| `05-typescript.md` | ecc:typescript-reviewer | Config-level only (no source on disk) |
| `06-security.md` | ecc:security-reviewer | OWASP + status of prior gap analysis |
| `07-database.md` | ecc:database-reviewer | Schema, triggers, migrations, query patterns |
| `08-performance.md` | ecc:performance-optimizer | Backend + frontend, caching, async hazards |
| `09-tests.md` | ecc:pr-test-analyzer | Coverage shape, behavioral vs implementation tests |
| `10-silent-failures.md` | ecc:silent-failure-hunter | Swallowed exceptions, traceback loss |
| `11-comments.md` | ecc:comment-analyzer | TODO inventory, comment rot, missing WHY |
| `12-types.md` | ecc:type-design-analyzer | Domain types, invariants, branded IDs |
| `13-a11y.md` | ecc:a11y-architect | WCAG 2.2 contract + critical-flow form a11y |
| `14-dead-code.md` | ecc:refactor-cleaner | Audit-only; ruff F401 + structural |
| `15-doc-drift.md` | ecc:doc-updater | Audit-only; severe drift on OpenAPI + setup docs |
| `16-harness.md` | ecc:harness-optimizer | `.claude/`, CI, MCP, secret hygiene |
