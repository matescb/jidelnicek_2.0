# Repo Map

> Scope: `/mnt/data/WORK/Jidelnicek_2.0` — Czech meal-planner web app (jidelnicek).
> Date: 2026-05-14.
>
> **Caveat (critical for downstream reviewers):** the repository is in a severely disturbed state.
> The branch `master` has **zero commits**, with 1,768 paths staged for an initial commit.
> Of those, **1,398 entries carry the `AD` flag** (added-to-index, deleted-in-worktree), i.e. the
> source tree has been wiped from disk after staging. The staged blob SHAs are also missing from
> the object database, so the code **cannot be recovered from git either**. Counts below come
> from the git index (path list) where the worktree is empty; LOC measurements are unavailable
> for backend / frontend source. See "Surprising observations" for full details.

## Backend

- Root: `src/jidelnicek/` (Poetry package `jidelnicek`, defined in `/mnt/data/WORK/Jidelnicek_2.0/pyproject.toml`)
- Entry point (uvicorn target): `src.jidelnicek.main:app`
  - Confirmed in `scripts/dev-start.sh`, `scripts/dev-local.sh`, `docker-compose.dev.yml`.
  - `docker/entrypoint.sh` uses the in-container variant `jidelnicek.main:app`.
- Python: `^3.11`. Framework: FastAPI `^0.115.0`, SQLAlchemy `^2.0.35`, Alembic `^1.14.0`, asyncpg `^0.30.0`, Redis `^5.2.1`, Celery `^5.4.0`, Pydantic `^2.10.4`.
- Module list (file counts from git index — LOC unavailable, see caveat):

| Module        | Files (indexed) |
|---------------|-----------------|
| admin         | 48              |
| api           | 10              |
| auth          | 21              |
| calculations  | 2               |
| common        | 9               |
| core          | 68              |
| db            | 2               |
| examples      | 2               |
| ingredients   | 7               |
| recipe        | 42              |
| shopping      | 19              |
| snacks        | 2               |
| tasks         | 4               |
| trip          | 45              |
| users         | 7               |
| **total**     | **290**         |

- `core/` contains: `cache_utils`, `exceptions`, `middleware`, `models`, `monitoring`, `routers`, `schemas`, `services`, `sse`, `storage`, `testing`, `validation`, `websockets`.
- `api/` contains a nested `v1/{endpoints,models,schemas,services}` layout — i.e. a second API surface in addition to `core/routers/`.

## Frontend

- Root: `/mnt/data/WORK/Jidelnicek_2.0/frontend/` (the `frontend/` subdirectory is the React app).
- A second `package.json` exists at repo root, but it only carries Playwright + Storybook deps and is **not** a React app root.
- Framework / key versions (`frontend/package.json`):
  - React `^18.2.0`, React-DOM `^18.2.0`
  - Build: Vite `^5.0.10` + `@vitejs/plugin-react ^4.2.1`, TypeScript `^5.3.3`
  - Test: Vitest `^3.2.4`, Testing Library React `^14.1.2`, jsdom `^26.1.0`, Lighthouse `^11.0.0`
  - Routing: react-router-dom `^6.21.1`
  - State / data: Zustand `^4.4.7`, React Query `^5.17.0`, Immer `^10.1.1`, React Hook Form `^7.48.2` + Zod `^3.22.4`
  - UI: Tailwind `^3.4.0`, MUI `^7.2.0` + `@mui/lab` + `@mui/icons-material`, Radix-UI primitives, Headless UI, Emotion, Framer Motion `^12.23.1`, lucide-react, react-icons
  - i18n: i18next `^23.7.16` + react-i18next `^14.0.0` (with custom extract/sync/validate scripts)
  - PWA: `vite-plugin-pwa ^0.19.0`
  - Storybook `^9.0.16`
- Directory layout (`frontend/src/`):
  `api/`, `components/`, `config/`, `context/`, `contexts/`, `docs/`, `examples/`, `hooks/`, `i18n/`, `lib/`, `__mocks__/`, `pages/`, `router/`, `routes/`, `schemas/`, `scripts/`, `services/`, `stories/`, `store/`, `styles/`, `__tests__/`, `test-utils/`, `types/`, `utils/`.
- Component count (`.tsx` files excluding tests / stories / mocks, from git index): **412** (out of 500 total `.tsx` files; remaining 88 are tests, stories, or test utilities).
- Total indexed frontend source files: **878**.

## Database

- Alembic dir on disk: `/mnt/data/WORK/Jidelnicek_2.0/alembic/versions/` (5 migrations present).
- However, `alembic.ini` sets `script_location = migrations`, pointing at `/mnt/data/WORK/Jidelnicek_2.0/migrations/` (with an empty `versions/` directory on disk — see "Surprising observations").
- Latest 5 migrations (in chronological order, from `alembic/versions/`):
  1. `001_enhance_auth_schema.py` — Enhance authentication schema (Create Date: 2025-01-08; base revision)
  2. `002_add_session_management_fields.py` — Add session management fields (Revises 001; 2025-01-09)
  3. `003_add_share_links_table.py` — Add share_links table (Revises 002; 2025-01-13)
  4. `004_add_marketplace_ratings_reviews.py` — Add marketplace ratings and reviews tables (Revises 003; 2025-01-13)
  5. `005_add_trip_day_snacks_table.py` — Add trip_day_snacks table (Revises 004; 2025-01-13)

## Tests

- Backend test dir: `/mnt/data/WORK/Jidelnicek_2.0/tests/`
  - Indexed subdirs: `admin/`, `api/`, `auth/`, `cleanup/`, `common/`, `core/`, `recipe/`, `shopping/`, `split_contract/`, `trip/`, plus root-level `conftest.py`, `split.py`, `test_openapi_contract.py`.
  - Indexed `test_*.py` files: **114**.
  - On disk: only 5 files remain (`conftest.py`, `split.py`, `test_openapi_contract.py`, `README.md`, `jidelnicek_OpenAPI Spec.yaml`) — the rest are `AD`.
  - Plus ~25 stray `test_*.py` files at the **repo root** (e.g. `test_csrf_debug.py`, `test_storage_minimal.py`, `test_rounding_accuracy.py`) — these survive on disk and are not under `tests/`.
- Frontend test dirs: 20+ `__tests__` folders under `frontend/src/` (see Frontend section).
  - Indexed `*.test.{ts,tsx}` / `*.spec.{ts,tsx}` files: **120**.
  - `pyproject.toml` `[tool.pytest.ini_options]` declares markers: `slow`, `integration`, `performance`, `stress`.

## CI/CD

| File | Purpose |
|------|---------|
| `.gitlab-ci.yml` | GitLab CI/CD pipeline (12 KB; "Based on Documentation/jidelnicek_CI-CD Pipeline.md"). Defines `build` stage and presumably full lint/test/deploy flow. |
| `.github/workflows/i18n-check.yml` | Translation check workflow ("Translation Check"). Only GitHub Actions workflow present. |
| `README_GITLAB_CI.md` | Top-level documentation describing the GitLab CI configuration. |

## Docker

| File | Purpose |
|------|---------|
| `docker-compose.yml` | Production-style stack. Services: `db`, `redis`, `app`, `frontend`, `nginx`, `backend`, volumes `postgres_data`, `redis_data`, `nginx_logs`, `letsencrypt_data`. |
| `docker-compose.dev.yml` | Dev stack. Services: `db`, `redis`, `app`, `nginx`, `mailhog`, `pgadmin`, `redis-commander`, volumes `postgres_data_dev`, `redis_data_dev`. |
| `docker-compose.dev-noauth.yml` | Auth-disabled dev variant. |
| `docker-compose.override.yml` | Local override (auto-merged by docker compose). |
| `docker-compose.ci.yml` | CI stack. Services: `postgres`, `redis`, `app`, `celery-worker`, volume `postgres_test_data`, network `default`. |
| `docker/Dockerfile` | Backend image. `entrypoint.sh` runs `uvicorn jidelnicek.main:app --host 0.0.0.0 --port 8000 --workers 2`. |
| `docker/{nginx,postgres,redis}/` | Per-service configuration dirs. |
| `frontend/Dockerfile`, `frontend/Dockerfile.dev` | Frontend images (prod + dev). |
| `.dockerignore` | Build context filter. |

## Harness / Tooling

- `.claude/` — Claude Code project config. Files: `settings.json`, `settings.local.json` (allowlist, hooks, MCP wiring).
- `.cursor/` — Cursor editor configuration. Contains `mcp.json` (MCP server registrations) and `rules/` (most `AD` — staged rule files were deleted on disk; remaining live `.mdc` files are absent).
- `.clinerules/` — Cline agent rules. Files: `cline_rules.md`, `dev_workflow.md`, `self_improve.md`, `taskmaster.md` (mirrors the deleted Cursor rule set).
- `.taskmaster/` — Task Master AI workflow state. Contains `config.json` (AI model selection), `state.json` (current task pointer), `docs/prd.txt` (the PRD), `reports/task-complexity-report.json`, `tasks/tasks.json` (task graph), `templates/example_prd.txt`. Drives the daily dev loop documented in `CLAUDE.md`.

## Top-level docs

| File | One-line purpose |
|------|------------------|
| `README.md` | Top-level readme (only 17 bytes — essentially empty). |
| `CLAUDE.md` | Task Master AI / Claude Code integration guide for this repo (13 KB). |
| `CLAUDE.local.md` | Local Claude overrides (use docker MCP, deploy-stack command). |
| `DEVELOPMENT.md` | Developer setup + workflow guide. |
| `DOCKER_SETUP.md` | Docker environment setup instructions. |
| `README_GITLAB_CI.md` | GitLab CI configuration walkthrough. |
| `API_TESTING_GUIDE.md` | Manual API testing guide. |
| `API_INTEGRATION_COMPLETE.md` | Status note that API integration is complete. |
| `VALIDATION_SYSTEM.md` / `VALIDATION_SYSTEM_SUMMARY.md` | Validation subsystem design + summary. |
| `RECIPE_SERVICE_UPDATES.md` | Recipe service change log. |
| `SHARING_IMPLEMENTATION_SUMMARY.md` | Trip-sharing feature summary. |
| `SNACKS_MODULE_SUMMARY.md` | Snacks module summary. |
| `MARKETPLACE_IMPLEMENTATION_SUMMARY.md` | Marketplace feature summary. |
| `REDIS_FIX.md` | Redis bug-fix postmortem. |
| `PROGRESS_REPORT.md` | Project progress report. |
| `CRITICAL_PERFORMANCE_OPTIMIZATIONS_SUMMARY.md` | Performance optimization tracking. |
| `COMPREHENSIVE_FRONTEND_COVERAGE_ANALYSIS.md` | Frontend test coverage analysis. |
| `FRONTEND_TESTING_ROADMAP.md` | Frontend test roadmap. |
| `FRONTEND_TEST_METRICS_REPORT.md` | Frontend test metrics. |
| `migration_test_summary.md` | DB migration test results. |
| `missing_endpoints_analysis.md` | Gap analysis vs. OpenAPI spec. |
| `router_analysis.md` | FastAPI router inventory. |
| `endpoint_implementation_tasks.md` | Endpoint implementation backlog. |

## Surprising observations

1. **The repository has no commits and the source code is gone.** Branch `master` has zero commits; 1,768 paths are staged for an initial commit, of which **1,398 are flagged `AD`** (added in index, deleted in worktree). `src/jidelnicek/` and `frontend/src/` both contain only directory shells (and a few `__pycache__` folders) — every `.py`/`.ts`/`.tsx` file under them is absent from disk. Moreover, `git cat-file` cannot retrieve the staged blob SHAs (e.g. `baabc42602c593a8758cd5c3dc0baf00eedb764b` for `src/jidelnicek/main.py` is "Not a valid object name"), so the code **is not recoverable from `.git/` either**. Any review of code behavior, security, or correctness is impossible in the current state — restoration from backup or remote is a prerequisite.
2. **Alembic configuration is inconsistent with where migrations actually live.** `alembic.ini` declares `script_location = migrations`, but the 5 real migration files sit in `alembic/versions/`. The configured `migrations/versions/` directory is empty (its `__pycache__` shell remains). There is also a `migrations_backup_20250710_031019/` parallel tree. Running Alembic against the configured location would find zero migrations.
3. **Dual API surface.** The backend has both `src/jidelnicek/core/routers/` and a parallel `src/jidelnicek/api/v1/{endpoints,schemas,services,models}/` layout. The 25+ stray `test_*.py` scripts at the repo root (debug/storage/migration probes) and root-level `simple_excel_test.py`, `example_contract_test.py` etc. suggest the codebase has been through several architectural pivots without consolidation — confirmed by `router_analysis.md`, `missing_endpoints_analysis.md`, and the various `*_IMPLEMENTATION_SUMMARY.md` retrospectives.
4. **Three overlapping AI-harness toolkits are wired up simultaneously.** `.claude/` (Claude Code), `.cursor/` (Cursor + MCP), and `.clinerules/` (Cline) all carry near-identical Task Master rule sets, plus a top-level `.taskmaster/` driving the workflow. `CLAUDE.md` is the canonical entry. This implies multi-IDE / multi-agent operation, but the duplicated rules raise drift risk.
5. **Frontend is the heavier half.** 878 indexed source files and 412 components vs. 290 backend Python files. The frontend also pulls in three competing UI libraries in parallel (MUI v7, Radix primitives, Headless UI) plus Tailwind, Emotion, and Framer Motion — a substantial design-system surface area for a single app, and a likely review hotspot once code is restored.
