# Code Quality Review

## Scope

**Backend**: `src/jidelnicek/` (286 `.py` files tracked in git index — all source `.py` files are absent from disk due to a corrupt git object store; every index entry has dangling blob hashes). Reviewable backend code: `tests/conftest.py`, `tests/test_openapi_contract.py`, `alembic/versions/001-002_*.py`, `migrations/env.py`, root-level scripts (`create_admin_user.py`, `generate_auth_token.py`, `debug_*.py`, `test_*.py`, `check_*.py`), and `scripts/`.

**Frontend**: `frontend/src/` (666 `.ts`/`.tsx` files tracked in git index — all source files are absent from disk for the same reason). Reviewable frontend code: `frontend/tsconfig.json`, `frontend/vite.config.ts`, `frontend/.eslintrc.js`, `frontend/package.json`.

**Config / infra**: `config/*.env`, `.env`, `.env.example`, `docker-compose*.yml`, `alembic.ini`, `pyproject.toml`.

**Deduplication note**: Language-specific findings already reported in `04-python.md` (hardcoded `admin123`, star import in conftest) and `05-typescript.md` (ESLint `jest:true`, missing tsconfig flags) are referenced below with [CONFIRMS X] but not repeated in full.

---

## TL;DR

1. CRITICAL -- Credential artifacts staged for commit: `auth_token.txt`, `auth_response.json`, `login.json`, `login_payload.json`, `register_payload.json`, and four `test_*_payload.json` files -- all containing real or realistic JWT tokens and plaintext passwords -- are in the git index and will ship in the first commit.
2. CRITICAL -- `config/development.env` and `config/test.env` contain real plaintext credentials (SECRET_KEY, DB_PASSWORD, REDIS_PASSWORD) and are staged for commit; neither file is excluded by `.gitignore`.
3. HIGH -- Three independent `LocalStorageBackend` class definitions exist across `test_storage_minimal.py`, `test_storage_direct.py`, and `test_storage_simple.py` -- structurally near-identical (700/554/243 lines) and diverging silently; any fix to one does not propagate.
4. HIGH -- 15+ root-level `test_*.py` and `debug_*.py` files bypass pytest discovery, use `sys.path.insert(0, 'src')` with a relative path, and will be included in the staged commit as production-adjacent code.
5. MEDIUM -- `conftest.py` hardcodes `TEST_DATABASE_URL` with a plaintext password at line 41 and sets `os.environ["DB_PASSWORD"] = "test_password"` at module level, leaking a password into any process that imports conftest.

---

## Worst Offenders (3 tables)

### Largest files (top 10)

All sizes are for files physically present on disk.

| # | File | Lines | Status |
|---|------|-------|--------|
| 1 | `test_storage_minimal.py` | 700 | Exceeds 500-line guideline; 3x duplicated |
| 2 | `test_storage_direct.py` | 554 | Exceeds 500-line guideline; 2x duplicated |
| 3 | `simple_export_test.py` | 470 | Root-level script, no pytest integration |
| 4 | `tests/conftest.py` | 452 | Acceptable; 22 fixtures -- consider splitting |
| 5 | `test_container_review.py` | 416 | Root-level, no pytest integration |
| 6 | `generate_auth_token.py` | 352 | Staged for commit; contains credential output logic |
| 7 | `test_scaling_accuracy_standalone_fixed.py` | 341 | Near-duplicate of `_standalone.py` |
| 8 | `test_scaling_accuracy_standalone.py` | 340 | Root-level; duplicated |
| 9 | `test_rounding_accuracy.py` | 293 | Root-level; no pytest integration |
| 10 | `test_categorization_accuracy.py` | 268 | Root-level; no pytest integration |

Note: All 286 backend `src/jidelnicek/` source files and all 666 frontend `frontend/src/` source files are absent from disk; their sizes cannot be measured.

---

### Longest functions (top 10)

Measured in files physically present on disk.

| # | Function | File | Est. Lines | Issue |
|---|----------|------|-----------|-------|
| 1 | `test_security_features` | `test_storage_minimal.py:557` | ~94 | Monolithic test covering 5 concerns |
| 2 | `generate_token` | `generate_auth_token.py:193` | ~93 | Mixes IO, business logic, and console output |
| 3 | `test_file_naming_conventions` | `test_storage_minimal.py:467` | ~90 | Single function covering all naming edge cases |
| 4 | `test_local_storage` | `test_storage_minimal.py:314` | ~88 | All CRUD assertions in one block |
| 5 | `test_local_storage` (dup) | `test_storage_direct.py:285` | ~80 | Same structure, slightly different config |
| 6 | `test_compression_types` | `test_storage_minimal.py:402` | ~65 | Iterates all compression types inline |
| 7 | `create_test_user` | `generate_auth_token.py:57` | ~52 | Includes all response parsing and printing |
| 8 | `store` | `test_storage_minimal.py:125` | ~52 | Full compress + write + metadata in one method |
| 9 | `test_engine` fixture | `tests/conftest.py:53` | ~30 | Includes two try/except cleanup chains |
| 10 | `other_user_token` fixture | `tests/conftest.py:335` | ~26 | Inline user creation embedded in fixture |

---

### Deepest nesting (top 5)

| # | File | Max depth | Location |
|---|------|-----------|----------|
| 1 | `test_storage_minimal.py` | 6 | `list_files()`: for -> try -> if prefix -> if user_id -> if job_id -> construct |
| 2 | `test_storage_direct.py` | 6 | Same pattern as `test_storage_minimal.py:list_files` |
| 3 | `generate_auth_token.py` | 5 | `generate_token` -> if not success -> try -> if args.quiet -> try |
| 4 | `tests/conftest.py` | 4 | `test_engine` cleanup: try -> except -> try -> except |
| 5 | `test_scaling_accuracy_standalone.py` | 4 | Test loop: for -> try -> if error > -> raise |

---

## Findings

### CRITICAL

---

C-1 -- Credential artifacts staged for git commit
Files: `auth_token.txt:1`, `auth_response.json:1-3`, `login.json:1`, `login_payload.json:1`, `register_payload.json:1`, `test_login_payload.json:1`, `test_register.json:1`, `test_register_payload.json:1`

Issue: All eight files are in the git index (confirmed via `git ls-files --cached`) and none are excluded in `.gitignore`. They contain a live JWT access token, a second live access+refresh JWT pair with a real user ID (58fcea3e-...), and plaintext passwords across the remaining files: ValidPassword123!, SecurePass@2024!, VeryStr0ngP@ssw0rd!, StrongPass482!.

Fix: Remove all eight files from the index:
  git rm --cached auth_token.txt auth_response.json login.json login_payload.json register_payload.json test_login_payload.json test_register.json test_register_payload.json
Add them to `.gitignore`. Rotate any JWT tokens that may have been used against real systems. Never write live tokens or credentials to working-directory files.
Effort: 30 minutes
[NEW]

---

C-2 -- `config/development.env` and `config/test.env` staged with plaintext credentials
`config/development.env:14-15,37`, `config/test.env:14,31`

Issue: SECRET_KEY, DB_PASSWORD=dev-password-123, REDIS_PASSWORD=dev-redis-password in development.env; DB_PASSWORD=test_password in test.env. Both files appear in `git ls-files --cached`. The `.gitignore` excludes `.env.*` patterns but NOT `config/`-prefixed paths. Any developer who clones this repository runs the dev stack with known credentials by default.

Fix: Add `config/development.env`, `config/test.env`, and `config/staging.env` to `.gitignore`. Keep only `*.example.env` or `*.template.env` files in git. Move actual credentials to local-only `.env` files.
Effort: 1 hour
[NEW]

---

C-3 -- `create_admin_user.py:35` hardcoded password staged for commit

  admin_password = "admin123"  # Change this in production!

Issue: The script is in the git index and will be committed. The comment does not prevent execution. Any developer who runs the script against staging or production creates a known-password admin account. The password is also emitted at INFO log level (lines 67-69). [CONFIRMS 04-python.md C-1]
Fix: Accept password via required CLI argument or ADMIN_PASSWORD env var. Fail with a clear error if neither is provided. Remove all log lines that print the password.
Effort: 15 minutes

---

### HIGH

---

H-1 -- Three independent `LocalStorageBackend` implementations across root-level test files
`test_storage_minimal.py:60-311`, `test_storage_direct.py:~1-280`, `test_storage_simple.py:~20-160`

Issue: All three files define their own LocalStorageBackend, StorageMetadata, and CompressionType. The minimal (700 lines) and direct (554 lines) variants are near-identical but divergence has already occurred: `test_storage_direct.py` uses `import json` inside the method body instead of at module level. Any bug fix must be applied to all three.
Fix: Import directly from `jidelnicek.core.storage.local` or extract a single shared test helper. Reduce the three files to test functions only.
Effort: 2 hours
[NEW]

---

H-2 -- Duplicate test utility functions across scaling test files
`test_scaling_accuracy_standalone.py:1-340` / `test_scaling_accuracy_standalone_fixed.py:1-341`

Issue: Both files contain identical `calculate_relative_error`, `assert_accuracy`, and `test_basic_scaling_precision` functions. The _fixed variant was created as a one-line patch without removing the original. Both are staged for commit. Any accuracy requirement change must be applied twice.
Fix: Consolidate into a single `tests/test_scaling_accuracy.py`. Delete both root-level files.
Effort: 1 hour
[NEW]

---

H-3 -- `tests/conftest.py:41` hardcoded database URL with plaintext password

  TEST_DATABASE_URL = "postgresql+asyncpg://jidelnicek:testpassword@localhost:5433/jidelnicek_test"
  os.environ["DB_PASSWORD"] = "test_password"  # line 26

Issue: Two different passwords hardcoded at module level. Port 5433 conflicts with config/test.env which specifies 5432. The os.environ assignment at module level leaks the password into any process that imports conftest, including CI runners. [CONFIRMS 04-python.md credential observations]
Fix: Read TEST_DATABASE_URL from os.environ.get("TEST_DATABASE_URL") and raise ValueError if absent. Move all os.environ assignments inside setup_test_environment as monkeypatch.setenv calls.
Effort: 30 minutes

---

H-4 -- 15+ root-level debug and test scripts outside `tests/` staged for commit

Files: debug_config.py, debug_participant_calculation.py, test_csrf_debug.py, test_rate_limit_debug.py, test_filename_debug.py, test_filename_debug2.py, test_filename_debug3.py, test_middleware_format.py, test_validation_simple.py, test_progress_minimal.py, test_sharing_implementation.py, test_migration.py, test_migration_sql.py, check_openapi.py, check_schemathesis.py, simple_excel_test.py, simple_export_test.py

Issue: All use sys.path.insert(0, 'src') relative path bootstrap that silently breaks outside the project root. No fixture isolation, no cleanup, unstructured print() output. Not discovered by pytest, will never appear in CI coverage reports.
Fix: Delete scripts with no lasting value before the first commit. Port real test logic to tests/. Add debug_*.py and test_*_debug.py patterns to .gitignore.
Effort: 2 hours
[NEW]

---

H-5 -- `conftest.py:341` bare `except:` catches `KeyboardInterrupt`
`tests/conftest.py:341`

Issue: Bare except: (no type) catches KeyboardInterrupt and SystemExit in the other_user_token fixture. A Ctrl-C interrupt during fixture setup silently creates a fallback user and continues -- hiding the interrupt entirely. [CONFIRMS 10-silent-failures.md finding on bare except in conftest]
Fix: Replace with `except Exception:`. If only missing fixtures are intended, catch `pytest.FixtureLookupError` specifically.
Effort: 5 minutes

---

### MEDIUM

---

M-1 -- `test_storage_minimal.py:145-147` in-place mutation of `StorageMetadata` inside `store()`

  metadata.size = len(compressed_data)
  metadata.original_size = original_size
  metadata.checksum = self._calculate_checksum(data)

Issue: The caller's metadata object is mutated in-place as a side effect of store(). Same pattern in test_storage_direct.py. If the same metadata object is reused, the pre-store values are silently lost.
Fix: Return a new StorageMetadata via dataclasses.replace(metadata, size=..., original_size=..., checksum=...). Do not modify the caller's object.
Effort: 30 minutes
[NEW]

---

M-2 -- `conftest.py` hardcoded localhost port conflicts with `config/test.env`

conftest.py port 5433 vs config/test.env DB_PORT=5432.
conftest.py Redis DB 0 vs config/test.env REDIS_DB=9 (for test isolation).

Issue: The two authoritative sources disagree. A developer who follows config/test.env will not match what conftest wires up.
Fix: Read all connection parameters exclusively from environment variables. config/test.env should be the single source of truth.
Effort: 1 hour
[NEW]

---

M-3 -- `generate_auth_token.py:193-286` `generate_token()` conflates token generation, printing, and file I/O

Issue: The ~93-line method performs API calls, prints human-readable instructions, saves files to disk (auth_token.txt, auth_response.json), and returns the token -- all in one function. It is untestable in isolation. The file-write side effect produces the C-1 credential artifacts.
Fix: Separate concerns: pure function generates and returns the token; a caller handles printing and optional file output behind a --save flag. Remove the unconditional file-write side effect.
Effort: 1 hour
[NEW]

---

M-4 -- `config/development.env` silently disables security controls with no documented intent

Issue: PASSWORD_MIN_LENGTH=6, PASSWORD_REQUIRE_UPPERCASE=false, PASSWORD_REQUIRE_DIGITS=false, RATE_LIMIT_ENABLED=false, SECURE_UPLOADS=false, BCRYPT_ROUNDS=4. These relaxations are reasonable for dev speed but are not annotated as intentional departures. A developer whose dev-environment password is 7 chars with no uppercase will encounter a surprising rejection when deploying to staging.
Fix: Add a SECURITY RELAXATIONS comment block in development.env listing each departure and its production equivalent. Add a startup log warning when ENVIRONMENT=development and key security controls are disabled.
Effort: 1 hour
[NEW]

---

M-5 -- `test_storage_minimal.py:235` unbounded `list_files` calls in assertions

Issue: All test calls use `await storage.list_files()` with default limit=100. If cleanup silently fails (via except Exception: continue), leftover files from prior runs inflate the count. Tests check len(files) == N without verifying file identity, enabling false-positive passes from leaked state.
Fix: Pass explicit limit values in assertions. Add an explicit cleanup step before each assertion.
Effort: 30 minutes
[NEW]

---

M-6 -- `test_scaling_accuracy_standalone_fixed.py` is a stale fork with no changelog

Issue: The _fixed.py variant (341 lines) differs from _standalone.py (340 lines) by approximately 1 line. No comment, docstring, or commit message explains what was fixed or why the original was retained. Both staged for commit.
Fix: Replace the original with the fixed version, delete the fork, document the regression in a FIXED: comment.
Effort: 15 minutes
[NEW]

---

M-7 -- `tests/conftest.py` duplicates user-creation block across 5 fixtures
`tests/conftest.py:144-166`, `170-192`, `196-217`, `221-243`, `341-355`

Issue: Five near-identical 20-line AuthUser(...) construction blocks. Any schema change to AuthUser requires updating five independent locations. [CONFIRMS 04-python.md duplication note]
Fix: Extract a _create_test_user(db_session, role, **overrides) helper and call it from all five fixtures.
Effort: 1 hour

---

### LOW

---

L-1 -- `debug_participant_calculation.py:97-99` speculative comment left in staged file

  # This should be 175% = 1.75, but maybe there's confusion about how to apply it
  # Let's check if it's being applied as a multiplier vs replacement

Issue: Comment documents an open question about correct behaviour with no resolution. Staged for commit.
Fix: Document the canonical business rule in the relevant service. Remove speculative comments before committing.
Effort: 15 minutes
[NEW]

---

L-2 -- `.gitignore` does not exclude credential artifact file patterns

Issue: .gitignore excludes .env and .env.* but not auth_token.txt, *_payload.json, login.json, auth_response.json, or debug_*.py. Future runs of generate_auth_token.py will silently re-stage credential files.
Fix: Add to .gitignore:
  auth_token.txt
  auth_response.json
  login.json
  login_payload.json
  *_payload.json
  *_response.json
  test_register*.json
  debug_*.py
Effort: 10 minutes
[NEW]

---

L-3 -- `alembic/versions/` uses magic string table names throughout

All op.add_column / op.drop_column / op.create_index calls in 001_enhance_auth_schema.py hardcode 'auth_users' and 'auth_sessions'. Low-priority observation; table names are intentionally stable in migrations.
Effort: Low priority
[NEW]

---

L-4 -- `create_admin_user.py:67-70` logs plaintext password at INFO level

  logger.info(f"   Password: {admin_password}")

Issue: Plaintext admin password written to application log at INFO level; captured by any log aggregation pipeline.
Fix: Remove the password from log output. Log only the email and "password set successfully".
Effort: 5 minutes
[NEW]

---

## Duplication candidates (cross-module)

| Pattern | Files involved | Shared lines (est.) |
|---------|---------------|---------------------|
| `LocalStorageBackend` class | test_storage_minimal.py, test_storage_direct.py, test_storage_simple.py | ~280 lines across 3 files |
| `StorageMetadata` dataclass | test_storage_minimal.py, test_storage_direct.py | ~20 lines |
| `CompressionType` enum | test_storage_minimal.py, test_storage_direct.py | ~8 lines |
| `calculate_relative_error` + `assert_accuracy` helpers | test_scaling_accuracy_standalone.py, test_scaling_accuracy_standalone_fixed.py | ~15 lines identical |
| `AuthUser(...)` user-creation block | conftest.py x5 fixtures | ~18 lines per block, 5 copies |
| Token fixture body (TokenService + generate_access_token) | conftest.py x7 token fixtures | ~4 lines per fixture, 100% identical |
| `sys.path.insert(0, ...)` preamble | 15+ root-level test/debug scripts | 2-line block x15 |

The storage backend duplication is most harmful: divergence has already occurred (import json placement in test_storage_direct.py), meaning the three implementations are no longer equivalent.

---

## Open Questions

1. Why was `src/jidelnicek/` deleted from disk? The git index lists 286 Python files and 666 TypeScript files as staged (AD) but neither their blobs nor working-tree files exist. Was this accidental? The application source code is unreachable for review.

2. `test_storage_minimal.py` reimplements `LocalStorageBackend` locally instead of importing from the production module. Is `jidelnicek.core.storage.local` the canonical implementation, and if so, why are three test files reimplementing it?

3. Are `dev-password-123` and `dev-redis-password` in `config/development.env` used in the Docker Compose dev stack? If so, they become known credentials for any network-accessible dev container.

4. Two conflicting test env configurations: `config/test.env` (DB port 5432, Redis DB 9) vs `tests/conftest.py` (DB port 5433, Redis DB 0). Which is authoritative?

5. `migrations_backup_20250710_031019/` is staged for commit. Was this intentional? Backup directories are typically excluded from source control.

---

## Review Summary

| Severity | Count | Status |
|----------|-------|--------|
| CRITICAL | 3 | block |
| HIGH | 5 | warn |
| MEDIUM | 7 | info |
| LOW | 4 | note |

Verdict: BLOCK -- Three CRITICAL issues must be resolved before the first commit. C-1 (credential artifacts staged) and C-2 (plaintext env credentials staged) are the most urgent: once committed, credential rotation becomes mandatory and git history must be rewritten.
