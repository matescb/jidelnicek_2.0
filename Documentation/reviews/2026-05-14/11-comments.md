# Comment Audit

## Scope

**Date:** 2026-05-14
**Auditor:** Comment Analyzer Agent (claude-sonnet-4-6)

**Files audited** (all Python + relevant JS/TS that exist on disk — the `src/jidelnicek/` and `frontend/src/` directory trees contain only empty skeleton directories with no source files):

| Area | Files |
|------|-------|
| Alembic migrations | `alembic/versions/001–005_*.py` |
| Migration env | `migrations/env.py`, `migrations_backup_20250710_031019/env.py` |
| Test fixtures | `tests/conftest.py` |
| Test utilities | `tests/split.py`, `tests/test_openapi_contract.py` |
| Scripts | `scripts/seed_data.py`, `scripts/run_celery_worker.py`, `scripts/run_celery_beat.py`, `scripts/validate-config.py`, `scripts/demo_text_markdown_export.py` |
| Ad-hoc test/debug scripts | `test_*.py`, `debug_*.py`, `simple_*.py`, `create_admin_user.py`, `generate_auth_token.py`, `fix_*.py`, `check_openapi.py`, `validate_migration.py` |
| Frontend config | `frontend/vite.config.ts`, `frontend/vite-console-plugin.js`, `frontend/tailwind.config.js`, `frontend/.eslintrc.js` |

**Important note:** Because `src/jidelnicek/` contains no `.py` files (only empty `__pycache__` directories), this audit covers only infrastructure, migration, test, and script code. The main application source is absent from the working tree.

---

## TL;DR

The comments that exist are generally clear and mostly consistent with the code. The project has no TODO/FIXME/HACK debt whatsoever. The most significant problems are:

1. **Stale boilerplate** — Alembic template comments (`# my_important_option`, `# ... etc.`) still appear in both `migrations/env.py` and the backup copy.
2. **Inaccurate docstrings** — `create_admin_user.py` imports `User` (not `AuthUser`) and `hash_password` (not `PasswordHasher.hash_password`), diverging from how every other file in the project names these symbols; the module docstring does not flag this inconsistency.
3. **Commented-out code** — One disabled function call in `fix_yaml_structure.py` with no explanation of when or why it should be re-enabled.
4. **Language mixing** — One Czech word in comments (`Bakaláři`) while all other inline comments are English; module docstrings use `Jídelníček` (Czech product name) throughout, which is fine.
5. **Missing WHY-comments** — Several non-obvious invariants, especially in `conftest.py`, have no rationale.

---

## TODO/FIXME/HACK inventory

No TODO, FIXME, HACK, or XXX tags appear anywhere in the audited files.

| file:line | tag | text | stale-confidence |
|-----------|-----|------|-----------------|
| _(none found)_ | — | — | — |

---

## Comment rot findings

### Boilerplate Alembic template comments

`/mnt/data/WORK/Jidelnicek_2.0/migrations/env.py:35–38`

```python
# other values from the config, defined by the needs of env.py,
# can be acquired:
# my_important_option = config.get_main_option("my_important_option")
# ... etc.
```

**Reality:** The file is fully customised (`get_url()` replaces the default `sqlalchemy.url` mechanism). These four lines are verbatim Alembic template boilerplate that was never removed. They describe a hypothetical pattern already superseded by the actual implementation.

**Fix:** Delete lines 35–38 from `migrations/env.py`.

---

`/mnt/data/WORK/Jidelnicek_2.0/migrations_backup_20250710_031019/env.py:33–36`

Same boilerplate, same situation. The backup also has the older `from src.jidelnicek.core.database import Base` import path (without the `sys.path` insertion that adds the `src/` component), which would fail at runtime.

**Fix:** The backup directory is for reference only; if it is ever promoted back into service, remove the boilerplate and fix the import path.

---

### Stale path comment in `test_migration.py`

`/mnt/data/WORK/Jidelnicek_2.0/test_migration.py:14`

```python
migration_path = Path("migrations/versions/001_initial_schema.py")
```

The comment above this is `# Load the migration module`. The path references `001_initial_schema.py` which does not exist; the actual first migration is `alembic/versions/001_enhance_auth_schema.py`. The script will always print "Migration file not found" and return `False`.

**Fix:** Update the path to point to an existing migration, or remove the script.

---

### Stale `admin_regular_user_headers` docstring

`/mnt/data/WORK/Jidelnicek_2.0/tests/conftest.py:282`

```python
"""Create authentication headers for regular user (non-admin) to test admin access restrictions."""
```

The fixture is named `admin_regular_user_headers`. The docstring is accurate in meaning but the fixture name is misleading — it suggests an admin fixture while the docstring clarifies it is a non-admin user. However, the implementation is identical to `auth_headers` (both use `existing_user` with no difference). If they are truly interchangeable, one of them is redundant; if they serve different purposes, the docstring of one is wrong.

**Fix:** Either consolidate the two fixtures and update call sites, or add a WHY-comment explaining why `admin_regular_user_headers` exists separately from `auth_headers`.

---

### Divergent symbol names in `create_admin_user.py`

`/mnt/data/WORK/Jidelnicek_2.0/create_admin_user.py:19–20`

```python
from jidelnicek.auth.models import User
from jidelnicek.auth.utils.password import hash_password
```

`conftest.py` imports `AuthUser` (not `User`) and `PasswordHasher.hash_password` (not the bare `hash_password`). The module-level docstring gives no hint that this script uses a different variant of the same model. It is possible one of these import paths is wrong (perhaps a refactor renamed `User` → `AuthUser`), in which case the comment "Script to create an admin user for testing admin functionality" is not wrong, but the inline comment `# Add project root to Python path` on line 13 is the only path comment, omitting the `src/` insertion that other scripts include.

**Fix:** Audit which import path is canonical. Add an inline comment if `User` is intentionally a different class from `AuthUser`.

---

## Misleading docstrings

### `conftest.py` — `event_loop` fixture

`/mnt/data/WORK/Jidelnicek_2.0/tests/conftest.py:44–49`

```python
@pytest.fixture(scope="session")
def event_loop() -> Generator:
    """Create an instance of the default event loop for the test session."""
```

With `pytest-asyncio ^0.25.0` and `asyncio_mode = "auto"` (as configured in `pyproject.toml`), overriding `event_loop` is deprecated and will raise a `DeprecationWarning` at runtime. The docstring says "for the test session" but in asyncio_mode=auto the session-scoped event loop is managed by the framework. This docstring implies the fixture is necessary when it may in fact be removed.

**Fix:** Verify whether this fixture is still needed or remove it and update the docstring accordingly.

---

### `simple_export_test.py` module comment

`/mnt/data/WORK/Jidelnicek_2.0/simple_export_test.py:11`

```python
# Simple stub for the text exporter functionality
class SimpleTextExporter:
```

The line-level comment reads "Simple stub for the text exporter functionality", but `SimpleTextExporter` is not a stub — it is a full reimplementation of export logic. A stub implies it delegates or no-ops; this class actually writes output. The comment misleads readers about test design.

---

### `vite.config.ts` — `chunkFileNames` callback

`/mnt/data/WORK/Jidelnicek_2.0/frontend/vite.config.ts:297–299`

```typescript
chunkFileNames: (chunkInfo) => {
  const facadeModuleId = chunkInfo.facadeModuleId ? chunkInfo.facadeModuleId.split('/').pop() : 'chunk'
  return `assets/js/${chunkInfo.name}-[hash].js`
},
```

`facadeModuleId` is computed but never used — the return value ignores it. There is no comment explaining why it was retained. This looks like an incomplete refactor. No comment explains the discarded local variable.

---

## Commented-out code blocks

### `fix_yaml_structure.py:192`

`/mnt/data/WORK/Jidelnicek_2.0/fix_yaml_structure.py:192`

```python
# content = fix_missing_status_codes(content)  # Commenting out for now
```

The function `fix_missing_status_codes` is presumably defined in this file or was intended to be. "For now" gives no indication of when the code should be re-enabled or what precondition needs to be met first. This is the only commented-out executable line found across all files.

**Recommendation:** Either delete this line and the corresponding function definition (if it exists), or replace with a comment explaining the blocking reason and the GitHub issue/task tracking it.

---

### `tests/split.py` — no module-level docstring, no comments

`/mnt/data/WORK/Jidelnicek_2.0/tests/split.py`

This utility script (splits the monolithic OpenAPI spec into per-tag YAML files) has no module docstring and no inline comments. It writes files into `split_contract/` relative to the working directory, which requires the caller to run it from the repo root. This path assumption is undocumented.

---

## Missing WHY-comments

The following locations contain non-obvious decisions with no explanatory comment:

| Location | What happens | Missing WHY |
|----------|-------------|-------------|
| `tests/conftest.py:66–80` | Three-level nested try/except for table cleanup; the innermost silently passes | No comment explains that silently swallowing cleanup errors is intentional to prevent test failures caused by unrelated teardown issues |
| `tests/conftest.py:34–36` | Wildcard import from `jidelnicek.db.base` followed by `globals()['AuthUser']` dynamic lookup | No comment explains why `AuthUser` cannot be imported directly, which is the core reason for the noqa suppression |
| `migrations/env.py:46–47` | `database_url.replace('postgresql+asyncpg://', 'postgresql://')` | No comment explains that Alembic requires a synchronous driver even when the application uses asyncpg |
| `alembic/versions/001_enhance_auth_schema.py:41–42` | `session_token` column renamed to `token_hash` | No comment explains the semantic change (from a session identifier to a hash of the token), which is a security-relevant migration |
| `scripts/run_celery_worker.py:95–97` | `--pool=solo` and `--purge` added in development only | `--purge` discards all pending messages on worker start; this is a destructive operation with no comment warning that it clears the queue |
| `tests/conftest.py:251–256` | `setup_test_environment` is `autouse=True` but `TEST_DATABASE_URL` is also set as a module-level constant at line 41 | No comment explains why the database URL is set in two places with potentially conflicting values |
| `vite.config.ts:165–167` | `pure_funcs` in terser compress drops `console.log` and `console.info` in production | No comment explains that `console.warn` and `console.error` are deliberately preserved (omitted from `pure_funcs`) |
| `vite.config.ts:359–361` | `jspdf` excluded from dep optimization | No comment explains that jsPDF must remain as a dynamic import — the business reason (lazy loading for code splitting) is absent |

---

## Czech/English mixing notes

The project is Czech (Jídelníček = meal planner) but targets an international audience with an English codebase. Usage is consistent with this approach:

- **Product name in docstrings** — `"Alembic environment configuration for Jídelníček 2.0."` appears in both `migrations/env.py` and the backup. Using the Czech product name in an English docstring is appropriate and intentional.
- **Single Czech word in inline comment** — `scripts/validate-config.py:223`: `# Bakaláři integration`. This refers to the Czech school information system "Bakaláři". All surrounding comments are English. This is a minor inconsistency but acceptable given it is a proper noun / branded system name; however, noting it for consistency.
- **Demo script content** — `scripts/demo_text_markdown_export.py` contains Czech sample data (names, location "Český ráj", descriptions in Czech) in test fixtures. These are test-data strings, not comments; this is intentional and correct.
- **Module docstrings** — All English, aside from the product name.

**Verdict:** Mixing is minimal and defensible. No action required.

---

## Open Questions

1. **Is `jidelnicek.auth.models.User` distinct from `jidelnicek.auth.models.AuthUser`?** If yes, both the `create_admin_user.py` script and `conftest.py` are testing different model classes without documentation. If no, one of the imports is wrong.

2. **Why does `migrations/` exist alongside `alembic/`?** The project has two migration directories: `alembic/versions/` (contains 001–005 migrations) and `migrations/versions/` (empty, configured as the Alembic script location in `alembic.ini`). None of the existing migrations will run via `alembic upgrade head` because Alembic looks in `migrations/` and finds nothing. No comment documents this split or which directory is authoritative.

3. **Is `fix_yaml_structure.py` still needed?** It exists at project root as a one-off repair script. There is no indication whether the YAML files it was meant to fix are now clean, or whether this script should be promoted into a proper utility.

4. **What is the intended state of `test_migration.py`?** It references `migrations/versions/001_initial_schema.py` which has never existed. Was an initial consolidated migration planned and abandoned in favour of the incremental `alembic/versions/001–005_*.py` chain?

5. **`other_user_token` fixture uses a bare `except:`** (`tests/conftest.py:341`). This silently swallows all exceptions when trying to get the `other_user` fixture. Should this be narrowed to `pytest.FixtureLookupError`?
