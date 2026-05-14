# Python Review

## Scope

Reviewed all readable Python files in the repository. The `src/jidelnicek/` package source files are staged in the git index but the git object store is corrupt/inaccessible — no `.py` files are present on disk under `src/`. Files actually reviewed:

- `tests/conftest.py` — full test fixture setup
- `tests/test_openapi_contract.py` — contract test runner
- `tests/split.py` — OpenAPI spec splitter
- `alembic/versions/001–005_*.py` — all 5 Alembic migrations
- `migrations/env.py`, `migrations_backup_*/env.py` — two Alembic env files
- `scripts/run_celery_worker.py`, `scripts/run_celery_beat.py` — process launchers
- `scripts/seed_data.py`, `scripts/validate-config.py` — admin scripts
- Root-level debug/test scripts: `create_admin_user.py`, `generate_auth_token.py`, `debug_config.py`, `debug_participant_calculation.py`, `test_csrf_debug.py`, `test_rounding_accuracy.py`, `test_storage_simple.py`, `test_progress_minimal.py`, `test_sharing_implementation.py`, `test_rate_limit_debug.py`, `test_middleware_format.py`, `test_validation_simple.py`, `test_scaling_accuracy_standalone.py`, and several others
- `pyproject.toml` — dependency configuration

The src package was not reviewable from source. Findings from the peripheral files are representative but cannot cover models, routers, services, or schemas directly. The missing object store is itself a critical operational finding (noted as MEDIUM).

**Total readable Python files:** ~35

---

## TL;DR (5 bullets)

- A hardcoded default password `"admin123"` appears in `create_admin_user.py` with only a comment warning; this is checked into git and ships in the repository. CRITICAL.
- `tests/conftest.py` uses `from jidelnicek.db.base import *` (star import) and then resolves `AuthUser = globals()['AuthUser']` via string lookup — a brittle, undiscoverable pattern that will silently break if the import order changes.
- `datetime.utcnow()` is called in multiple places in test fixtures and test scripts without timezone info, contrary to the `datetime.now(timezone.utc)` pattern used elsewhere in the same file, creating inconsistency that bleeds into production serialisation.
- `revision` and `down_revision` in migration files 004 and 005 lack type annotations (`str | None`) while migrations 001–003 use them — inconsistency signals copy-paste without cross-check.
- All root-level `test_*.py` and `debug_*.py` scripts live outside `tests/` and bypass pytest discovery/isolation entirely; they use `sys.path.insert(0, 'src')` with relative paths, which breaks when run from any directory other than the project root.

---

## Findings

### CRITICAL

---

**CRITICAL — Hardcoded credential in committed script**
File: `create_admin_user.py:35`
Issue: `admin_password = "admin123"` is hardcoded in a committed script. The comment says "Change this in production!" but the credential is visible in git history forever and may be executed against any environment. Any developer who runs this script against a staging or production database creates a known-password admin account.
Fix: Remove the hardcoded password entirely. Accept it as a required CLI argument (`argparse`) or read it from an environment variable. Raise `ValueError` if not provided.
Effort: 15 minutes
[NEW]

---

**CRITICAL — Star import with `globals()` lookup defeats static analysis**
File: `tests/conftest.py:34–36`
```python
from jidelnicek.db.base import *  # noqa: F401, F403
AuthUser = globals()['AuthUser']  # AuthUser imported via db.base
```
Issue: Wildcard import into conftest followed by runtime `globals()` string lookup makes `AuthUser` invisible to mypy, IDEs, and any static analysis. If `db.base` ever stops re-exporting `AuthUser` (e.g., import refactor), this silently raises `KeyError` at test collection time with a confusing error message rather than an `ImportError`.
Fix: Replace with an explicit import: `from jidelnicek.auth.models import AuthUser` (or wherever the model actually lives). Remove the star import.
Effort: 5 minutes
[NEW]

---

### HIGH

---

**HIGH — `datetime.utcnow()` mixed with `datetime.now(timezone.utc)` in same file**
File: `test_storage_simple.py:49`, `test_storage_simple.py:138`, `test_storage_simple.py:193`; also `test_progress_minimal.py:125`
Issue: `datetime.utcnow()` returns a naive datetime (no tzinfo). It is deprecated in Python 3.12 and removed semantics differ across SQLAlchemy, Pydantic v2, and asyncpg — all of which expect timezone-aware datetimes by default. The same files use `datetime.now(timezone.utc)` elsewhere. Mixing produces subtle bugs when comparing or storing timestamps.
Fix: Replace all `datetime.utcnow()` with `datetime.now(timezone.utc)`. Add a ruff/flake8 rule `DTZ003` to enforce this globally.
Effort: 30 minutes (grep-and-replace + CI rule)
[NEW]

---

**HIGH — Bare `except:` in conftest and generate_auth_token**
File: `tests/conftest.py:341,370`; `generate_auth_token.py:102,150`
Issue: Multiple bare `except:` (or `except Exception:` without re-raise) silently swallow errors. In conftest:
```python
try:
    other = request.getfixturevalue("other_user")
except:   # line 341 — bare except
    # creates a new user inline
```
This catches `KeyboardInterrupt`, `SystemExit`, and any `BaseException`, masking real failures. In `generate_auth_token.py`, `except:` around JSON parsing and string formatting hides response parsing bugs.
Fix: Catch specific exceptions — `pytest.FixtureLookupError` in conftest, `json.JSONDecodeError` / `requests.RequestException` in the token script. Never use bare `except:`.
Effort: 20 minutes
[NEW]

---

**HIGH — Swallowed exceptions in test engine cleanup**
File: `tests/conftest.py:78–81`
```python
except Exception:
    # Final fallback: ignore cleanup errors to avoid test failures
    pass
```
Issue: Silently ignoring cleanup failures means test database state corruption goes unnoticed. Subsequent test runs may fail with mysterious foreign-key violations, and the root cause is hidden.
Fix: At minimum log the exception with `logging.warning("Test DB cleanup failed", exc_info=True)`. Consider failing loudly if `pytest.ini` sets `--strict-markers` (it does).
Effort: 5 minutes
[NEW]

---

**HIGH — Missing type annotations on public functions in scripts**
Files: `migrations/env.py:41`, `create_admin_user.py:32`, `generate_auth_token.py:57,109,158,193`; `scripts/validate-config.py` (all methods)
Issue: `get_url()` has a return type but `create_admin_user()`, `login_user()`, `create_test_user()` etc. have type annotations on return values but not on all parameters. `ConfigValidator` methods are fully unannotated. `pyproject.toml` configures `mypy` with `disallow_untyped_defs = true`, so these files will fail mypy.
Fix: Add complete type annotations. For `login_user`: `def login_user(self, email: str, password: str) -> tuple[bool, str | None, dict[str, Any] | None]`.
Effort: 1 hour
[NEW]

---

**HIGH — `sys.stdout = open(os.devnull, 'w')` without context manager / error-safe close**
File: `generate_auth_token.py:325–342`
Issue: `sys.stdout` is redirected to `open(os.devnull, 'w')`. If an exception occurs between the open and the `sys.stdout.close()` call, the file handle leaks and stdout is never restored. The `try/except` does call close/restore, but the pattern is fragile and non-Pythonic.
Fix: Use `contextlib.redirect_stdout` with `open(os.devnull, 'w')` as a context manager, or use `subprocess`/separate process isolation.
Effort: 10 minutes
[NEW]

---

**HIGH — `session`-scoped `event_loop` fixture is deprecated in pytest-asyncio >= 0.22**
File: `tests/conftest.py:44–49`
```python
@pytest.fixture(scope="session")
def event_loop() -> Generator:
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()
```
Issue: Overriding `event_loop` at session scope was deprecated in pytest-asyncio 0.22 and produces a `DeprecationWarning` with `asyncio_mode = "auto"`. The project pins `pytest-asyncio = "^0.25.0"` where this emits warnings and is scheduled for removal.
Fix: Remove the custom `event_loop` fixture. Use `@pytest.mark.asyncio(loop_scope="session")` on the fixtures/tests that need a shared session loop, or configure `asyncio_mode = "auto"` with `loop_scope = "session"` in `pytest.ini_options`.
Effort: 30 minutes
[NEW]

---

**HIGH — Inconsistent Alembic migration type annotations**
File: `alembic/versions/004_add_marketplace_ratings_reviews.py:13–16`; `alembic/versions/005_add_trip_day_snacks_table.py:13–16`
Issue: Migrations 004 and 005 declare revision variables without type annotations:
```python
revision = '004_add_marketplace_ratings_reviews'
down_revision = '003_add_share_links_table'
```
While migrations 001–003 use the typed form:
```python
revision: str = '001_enhance_auth_schema'
down_revision: Union[str, None] = None
```
This is inconsistent and will fail mypy strict mode on the untyped files. More importantly, `down_revision` in 004/005 should be typed `str | None` since it can be `None` in the base migration.
Fix: Add `from typing import Sequence, Union` and annotate all four revision variables consistently across all migration files. Enforce via a migration linting check or pre-commit hook.
Effort: 10 minutes
[NEW]

---

### MEDIUM

---

**MEDIUM — Root-level `test_*.py` and `debug_*.py` scripts use relative `sys.path` insertion**
Files: `test_rounding_accuracy.py:7`, `test_storage_simple.py:14`, `test_scaling_accuracy_standalone.py:13`, `debug_participant_calculation.py:11`, `test_progress_minimal.py:7`, and ~15 others
Issue: `sys.path.insert(0, 'src')` or `sys.path.insert(0, str(Path(__file__).parent / "src"))` modifies the Python path at runtime. Scripts only work correctly when run from the project root directory. They also bypass pytest entirely — no fixture isolation, no coverage, no CI integration. With `testpaths = ["tests"]` in `pytest.ini_options`, these files are excluded from the official test run.
Fix: Move scripts that are real tests into `tests/` with proper pytest fixtures. Move scripts that are debugging utilities into `scripts/` and document them as developer tools, not tests. Remove the `test_` prefix from non-pytest files to avoid confusion.
Effort: Half-day refactor
[NEW]

---

**MEDIUM — `psycopg2-binary` listed alongside `asyncpg` without clear purpose separation**
File: `pyproject.toml:14`
Issue: Both `psycopg2-binary = "^2.9.10"` (sync) and `asyncpg = "^0.30.0"` (async) are in production dependencies. If the application is fully async (FastAPI + SQLAlchemy async), `psycopg2-binary` is only needed for Alembic migrations (sync). Listing it as a main dependency rather than a dev/migration dependency bloats the production image.
Fix: Move `psycopg2-binary` to a `[tool.poetry.group.migration.dependencies]` group, or use `asyncpg` in Alembic with `run_sync` (SQLAlchemy 2.x supports this). Document the separation.
Effort: 30 minutes
[NEW]

---

**MEDIUM — `python-jose` is unmaintained; `PyJWT` preferred**
File: `pyproject.toml:17`
Issue: `python-jose = {extras = ["cryptography"], version = "^3.3.0"}` — the `python-jose` library has had no releases since 2022, has open CVEs (notably CVE-2024-33664 related to algorithm confusion), and the upstream maintainer is inactive. The FastAPI docs now recommend `PyJWT` or `authlib`.
Fix: Replace `python-jose` with `PyJWT >= 2.8.0` or `authlib`. Update all JWT encode/decode calls (typically `jose.jwt.encode/decode` → `jwt.encode/decode`). Pin to a version with active maintenance.
Effort: 2–4 hours depending on JWT usage breadth
[NEW]

---

**MEDIUM — `passlib` is effectively unmaintained; use `bcrypt` directly**
File: `pyproject.toml:18`
Issue: `passlib = {extras = ["bcrypt"], version = "^1.7.4"}` — passlib has had no release since 2020 and generates `DeprecationWarning` with `bcrypt >= 4.0` due to API changes. The project also directly pins `bcrypt = "^4.3.0"`. The combination produces runtime warnings and duplicated hashing logic. `create_admin_user.py:22` uses `from jidelnicek.auth.utils.password import hash_password` (not visible from source) but conftest uses `PasswordHasher.hash_password`.
Fix: Remove `passlib`. Use `bcrypt` directly: `bcrypt.hashpw(password.encode(), bcrypt.gensalt())` / `bcrypt.checkpw(password.encode(), stored_hash)`. Wrap in a thin `PasswordHasher` utility class for testability.
Effort: 2–3 hours
[NEW]

---

**MEDIUM — `PyPDF2` in dev dependencies is abandoned**
File: `pyproject.toml:52`
Issue: `PyPDF2 = "^3.0.1"` — PyPDF2 was deprecated in 2023 in favour of `pypdf` (its own successor). The PyPDF2 package itself now just re-exports `pypdf` with a deprecation warning. Using it in CI/tests creates noise.
Fix: Replace `PyPDF2` with `pypdf >= 4.0.0`. Update any `import PyPDF2` to `import pypdf`.
Effort: 15 minutes
[NEW]

---

**MEDIUM — `schemathesis` contract tests use `strategy.example()` anti-pattern**
File: `tests/test_openapi_contract.py:165–186`
Issue: `strategy.example()` is a Hypothesis internal method intended only for interactive exploration, not for test suites. The Hypothesis docs explicitly warn: "Do not use `.example()` in tests — it does not produce diverse examples and may not find edge cases." The test calls it in a loop `for _ in range(10)` which gives the illusion of testing 10 cases but actually generates low-quality examples and defeats the purpose of property-based testing.
Fix: Use `@schema.parametrize()` properly with `@settings(max_examples=50)` from Hypothesis, or use `schemathesis.runner` for CLI-based contract testing. The `run_test_case` inner function defined but called via outer loop should be replaced.
Effort: 2 hours
[NEW]

---

**MEDIUM — f-string interpolation in `get_url()` constructs database URL from env vars**
File: `migrations/env.py:49–55`; `migrations_backup_20250710_031019/env.py:41–47`
Issue: While not SQL injection (this is a connection URL, not a query), constructing a URL from env vars via f-string with no validation or encoding means special characters in `DB_PASSWORD` (e.g., `@`, `/`, `:`) will silently corrupt the URL and produce misleading connection errors. This is also the backup copy of the env that still uses `src.jidelnicek` import path (legacy).
Fix: Use `urllib.parse.quote_plus(password)` for the password component, or use `sqlalchemy.engine.URL.create()` which handles encoding properly.
Effort: 20 minutes
[NEW]

---

**MEDIUM — `test_container_review.py`, `test_migration_sql.py` etc. contain no pytest markers and live at root**
File: Multiple root-level files
Issue: Files named `test_*.py` at the project root are not in `testpaths = ["tests"]` and so are silently excluded from `pytest` runs. However, if a developer runs `pytest` from the root with explicit paths or changes `testpaths`, they will be collected and may fail due to missing imports, side effects on stdout, or calls to `asyncio.run()` inside test functions (which conflicts with `asyncio_mode = "auto"`).
Fix: Either move to `tests/` with proper fixtures, or rename them to `scripts/debug_*.py` to prevent accidental collection.
Effort: 1 hour
[NEW]

---

**MEDIUM — `tests/split.py` uses unsafe `yaml.safe_load` (acceptable) but writes without atomic rename**
File: `tests/split.py:34–36`
Issue: YAML loading uses `safe_load` (correct). However, the file write loop opens each output file without a temporary file + rename pattern — if the process is interrupted mid-write, a partially-written YAML file will silently remain. In a CI pipeline this causes `schemathesis` to fail with confusing parse errors.
Fix: Write to a temp file first (`tempfile.NamedTemporaryFile`) and `os.replace()` to the final path.
Effort: 15 minutes
[NEW]

---

### LOW

---

**LOW — `from typing import Sequence, Union` used instead of built-in generics**
File: `alembic/versions/001_enhance_auth_schema.py:14–15`; `002_add_session_management_fields.py:14–15`; `003_add_share_links_table.py:14–15`
Issue: `Union[str, None]` and `Union[str, Sequence[str], None]` are the Python 3.9 form. Since `pyproject.toml` requires `python = "^3.11"`, the modern syntax `str | None` and `str | Sequence[str] | None` is preferred (PEP 604/585).
Fix: Replace `Union[str, None]` with `str | None` and remove the `Union` import. This is cosmetic on 3.11+ but aligns with the project's Python version.
Effort: 5 minutes
[NEW]

---

**LOW — `--pidfile=/tmp/celerybeat.pid` hardcoded in beat script**
File: `scripts/run_celery_beat.py:48`
Issue: `/tmp` is world-writable and may be cleared between reboots. In containerised deployments (the project has a `docker-compose.yml`) a PID file in `/tmp` inside the container is fine, but if beat runs as a system service, using `/tmp` allows PID file spoofing (symlink attacks).
Fix: Default to `./celerybeat.pid` (relative to working directory, configurable at runtime), or use a dedicated runtime directory from config.
Effort: 5 minutes
[NEW]

---

**LOW — `app.start(beat_args)` vs `app.worker_main(worker_args)` inconsistency**
File: `scripts/run_celery_beat.py:71` vs `scripts/run_celery_worker.py:104`
Issue: The beat script uses `app.start(beat_args)` while the worker script uses `app.worker_main(worker_args)`. Both work, but `app.start()` is the lower-level Celery entry point and does not set up signal handling the same way `app.worker_main()` does. This may cause graceful shutdown issues with `SIGTERM`.
Fix: Use `app.worker_main(beat_args)` in both scripts for consistent behaviour.
Effort: 2 minutes
[NEW]

---

**LOW — `logging.getLogger(settings.log_level)` pattern in scripts**
File: `scripts/run_celery_worker.py:30`, `scripts/run_celery_beat.py:30`
Issue: `getattr(logging, settings.log_level)` works correctly if `log_level` is a valid string like `"INFO"`, but if the attribute does not exist (e.g., `"VERBOSE"`, a typo), `getattr` returns the `logging` module's `VERBOSE` attribute silently — or raises `AttributeError` at startup. There is no validation.
Fix: Use `logging.getLevelName(settings.log_level)` or validate: `level = getattr(logging, settings.log_level.upper(), logging.INFO)`.
Effort: 5 minutes
[NEW]

---

## Async Hazards

The main application source files (routers, services, models) could not be read due to the corrupt git object store. The following async hazards were identified in the readable peripheral files only:

**1. `asyncio.run()` in root test scripts**
Files: `test_storage_simple.py:243`, `test_sharing_implementation.py` (line ~130), `test_rounding_accuracy.py` (sync, no async issue), `test_progress_minimal.py:165`
`asyncio.run()` at module level in scripts named `test_*.py` will conflict with pytest-asyncio's event loop management if pytest ever discovers these files. `asyncio.run()` creates and closes a new event loop, which will crash if called from within an already-running loop (the pytest-asyncio loop).
Mitigation: Keep these as non-pytest scripts (rename away from `test_` prefix) or convert to proper async pytest fixtures.

**2. `mock_redis.pipeline.return_value = mock_redis` creates a recursive mock**
File: `test_rate_limit_debug.py:19`
The mock is set up so `pipeline()` returns itself. If the `RateLimitMiddleware` calls `pipeline()` and then chained methods in a context manager (`async with pipeline as pipe`), the mock will not correctly simulate the `__aenter__`/`__aexit__` protocol. This is a test correctness hazard, not a production async hazard.

**3. `conftest.py` session-scoped `event_loop` with function-scoped async fixtures**
File: `tests/conftest.py:44–49` combined with `db_session`, `mock_redis`, etc.
Creating a session-scoped event loop but function-scoped async fixtures is valid in older pytest-asyncio but is explicitly broken in 0.25+. The engine and session fixtures run in the session loop but are function-scoped, which can cause `RuntimeError: Task attached to a different loop` when test parallelism or fixture re-use is involved.

**4. `test_sharing_implementation.py` does not close the async engine**
File: `test_sharing_implementation.py` (line ~80+)
The test creates `create_async_engine(...)` but the error path (`try/finally`) is not visible in the reviewed excerpt. Any path that raises an exception before `await engine.dispose()` will leave asyncpg connection pool threads running.

---

## Pydantic Version Audit

**Version confirmed: Pydantic v2** (`pydantic = "^2.10.4"`, `pydantic-settings = "^2.7.0"`)

Evidence from readable files:
- `debug_config.py` uses `model_config = {...}` dict syntax (Pydantic v2 `BaseSettings` pattern, replacing `class Config`).
- `debug_config.py` defines a `@classmethod parse_cors_origins` — this is NOT a Pydantic v2 validator (no `@field_validator` or `@model_validator` decorator). It is dead code: Pydantic v2's `BaseSettings` will not call a bare classmethod as a validator. This may be the source of CORS configuration bugs observed in the project.

**Pydantic v1/v2 mixing risk:**
The migration backup `env.py` imports from `src.jidelnicek.core.database` (old path) while the current `migrations/env.py` imports from `jidelnicek.core.database` (new path). This is a path inconsistency, not a Pydantic issue. No v1-style Pydantic patterns (`validator`, `root_validator`, `schema_extra`) were visible in the reviewed code.

**Recommendation:**
- Verify all `@validator` usages in the unreadable source files are migrated to `@field_validator` with `mode="before"/"after"`.
- Verify `orm_mode = True` in `Config` classes is replaced with `model_config = ConfigDict(from_attributes=True)`.
- Run `python -m pydantic.migration` scanner on the src tree once the object store is restored.

---

## Dependency Hygiene

| Package | Status | Action |
|---------|--------|--------|
| `python-jose ^3.3.0` | Unmaintained since 2022; CVE-2024-33664 | Replace with `PyJWT >= 2.8` or `authlib` |
| `passlib ^1.7.4` | Unmaintained since 2020; conflicts with `bcrypt ^4` | Remove; use `bcrypt` directly |
| `PyPDF2 ^3.0.1` (dev) | Deprecated; now just re-exports `pypdf` | Replace with `pypdf >= 4.0` |
| `aiosqlite ^0.21.0` | Listed as production dep, appears only used for testing | Move to dev/test group |
| `psycopg2-binary ^2.9.10` | Only needed for Alembic sync migrations | Move to migration group |
| `flake8 ^7.1.1` | Dev dep; `ruff` already preferred for speed | Replace with `ruff`; remove `flake8` |
| `schemathesis ^3.23.1` | Actively maintained; OK | Pin minor version in CI |
| `celery ^5.4.0` | Actively maintained; OK | — |
| `fastapi {extras=["all"]} ^0.115.0` | Actively maintained; OK | — |
| `sqlalchemy ^2.0.35` | Actively maintained; OK | — |
| `asyncpg ^0.30.0` | Actively maintained; OK | — |
| `redis ^5.2.1` | redis-py async; correct for this stack | — |

**Missing from pyproject.toml:**
- `ruff` is not listed but mypy, black, and flake8 are. The CI check `.github/workflows/i18n-check.yml` was not reviewed (YAML, not Python). Recommend adding `ruff` and removing `flake8`.
- `httpx` is used in `conftest.py` and test scripts but is not listed in dev dependencies. It comes transitively via `fastapi[all]`, but should be explicit.
- `rich` is imported in `scripts/validate-config.py` but is not in any dependency group.

**Version pinning hygiene:**
All production dependencies use caret ranges (`^`), which is appropriate for Poetry. Dev dependencies are also caret-pinned. No floating ranges (`*`) or git-source dependencies found. Good.

---

## Open Questions

1. **Git object store corruption**: The `src/jidelnicek/` package directories exist with `__pycache__` but no `.py` files on disk, and git objects cannot be read (`fatal: Not a valid object name`). Is this a `.gitignore` issue, a partial commit, or an intentional decision to keep source out of the repository? This must be resolved before any CI can run. All HIGH/CRITICAL findings in this review apply to the peripheral code only; the main application source (routers, services, models, schemas) is unreviewed.

2. **`TokenService.generate_access_token` is synchronous**: `conftest.py:262` calls `token_service.generate_access_token(existing_user)` without `await`. If this is an async method, the tests silently produce coroutine objects instead of tokens. If it is sync (unusual for an async service), it may be calling blocking JWT libraries inside an async context. Needs verification once source is accessible.

3. **`PasswordHasher.hash_password` in conftest is synchronous**: `bcrypt` hashing is CPU-intensive. Calling it synchronously in an async fixture blocks the event loop during test setup. For production code, consider `asyncio.run_in_executor` or a thread pool.

4. **CORS validator as bare classmethod**: `debug_config.py` shows a `parse_cors_origins` classmethod on a Pydantic v2 `BaseSettings` class without the `@field_validator` decorator. This would silently not run, leaving CORS misconfigured. Is this a copy from a working file, or does the actual `core/config.py` have the same bug?

5. **`aiosqlite` in production dependencies**: The project uses PostgreSQL+asyncpg in all environments including test. Why is `aiosqlite` a production dependency? If it is for SQLite-backed unit tests without a database, it should be a dev/test dependency.

6. **Duplicate migration directories**: `migrations/` and `alembic/` both exist with migration files, and `migrations_backup_20250710_031019/` is a timestamped backup committed to the repo. Which is the canonical migration directory? `alembic.ini` presumably points to one; the backup should be deleted from git history via `git rm` (it may contain sensitive schema information).
