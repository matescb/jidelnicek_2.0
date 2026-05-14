# Silent Failure Hunt

## Scope

- **Backend**: All Python files present in the repo — Alembic migrations (`alembic/versions/`), scripts (`scripts/`), test/debug scripts at root level, and `tests/conftest.py` / `tests/test_openapi_contract.py`.
- **Frontend**: `frontend/src/` directory tree (only config files present; no `.ts`/`.tsx` source files were found — the directory scaffold exists but is empty).
- **Status note**: The canonical application source (`src/jidelnicek/`) is a directory-only scaffold with no `.py` files present on disk. The analysis therefore covers all code that actually exists.

---

## TL;DR — Top 5 Worst

1. **`tests/conftest.py:79` — triple-nested `except Exception: pass`** silently discards any schema-drop failure during test teardown; leftover tables accumulate across test runs causing phantom data and false-positive passes.
2. **`test_storage_minimal.py:279` and `test_storage_direct.py:249` — `except Exception: continue`** inside `list_files()` / `get_usage_stats()` swallows every I/O and JSON parse error silently; a corrupt metadata file causes the file to be invisible with no signal.
3. **`create_admin_user.py:72` — `except Exception as e: return False`** in the admin-creation path logs the error but returns a boolean `False`; the caller (`main()`) exits with code 1 but the *caller's* caller (a CI script, Docker entrypoint, etc.) receives no structured error and cannot distinguish "user already exists in wrong state" from "DB is down".
4. **`tests/conftest.py:340-354` — bare `except:` in `other_user_token` fixture** catches *every* exception including `KeyboardInterrupt` and `SystemExit`, masking fixture-resolution failures and potentially leaving the session in an unknown auth state.
5. **`tests/test_openapi_contract.py:41` — `except Exception: return False`** in the server liveness check ignores all non-`ConnectionError` failures (TLS errors, DNS errors, timeouts) and reports the server as "down", silently skipping the entire contract test suite.

---

## Findings

### CRITICAL (failures that mask data corruption or auth bypass)

#### C-1 — `tests/conftest.py:67-81` — Nested silent cleanup swallows schema corruption

```python
except Exception:
    # Fallback: Use direct PostgreSQL CASCADE ...
    try:
        async with engine.begin() as conn:
            await conn.execute(text("DROP SCHEMA IF EXISTS public CASCADE"))
            ...
    except Exception:
        # Final fallback: ignore cleanup errors to avoid test failures
        pass
```

**Why dangerous**: The outermost `except Exception: pass` (line 79) silently ignores any failure in the last-resort schema-reset path. If the connection is dead, the schema drop never happens, tables accumulate across test runs, and subsequent tests read stale auth/session data. A test asserting "user has no sessions" can pass because it reads a session row created by a *previous* test run — making security tests unreliable in the worst possible way.

**Fix**: Log the error at `ERROR` level and set a flag that fails the test suite at the end of the session. Never suppress cleanup exceptions completely.

**Effort**: Low.

---

#### C-2 — `create_admin_user.py:72` — DB error converts to silent `False`

```python
    except Exception as e:
        logger.error(f"❌ Error creating admin user: {e}")
        return False
```

**Why dangerous**: The exception is logged but the stack trace is discarded (`%e` only serialises the message, not the traceback). If the DB connection string is wrong, the admin user silently does not exist, but `main()` logs "Failed to create admin user" and exits 1. In automated deployment (Docker entrypoint), the container may keep running without an admin user — and no monitoring alert fires because `sys.exit(1)` is only reached if the caller checks the return value, which `main()` does, but a script wrapping it may not.

**Fix**: `raise` after logging, or use `logger.exception(...)` to preserve the traceback, then let the caller's `sys.exit(1)` propagate cleanly.

**Effort**: Low.

---

### HIGH (failures that mask user-facing brokenness)

#### H-1 — `tests/conftest.py:339-354` — Bare `except:` in fixture creation

```python
        try:
            other = request.getfixturevalue("other_user")
        except:
            # Create a new user if other_user fixture not available
```

**Why dangerous**: Bare `except:` catches `KeyboardInterrupt`, `SystemExit`, and `GeneratorExit`. If the `other_user` fixture fails with a real error (e.g., DB constraint violation), the test silently creates a *different* user and continues. A test that should fail because user isolation broke will instead pass with an accidentally-created user, hiding the bug.

**Fix**: Catch `pytest.FixtureLookupError` specifically.

**Effort**: Low.

---

#### H-2 — `test_storage_minimal.py:248-251`, `test_storage_direct.py:218-222`, `test_storage_direct.py:273-277` — Metadata read errors silently skipped

```python
            except Exception:
                continue
```

**Why dangerous** (appears in `list_files()` and `get_usage_stats()`): A corrupt or partially written `.meta.json` file causes those entries to vanish silently from all listings and statistics. A user whose export job failed mid-write will never see those files and cannot retry or clean up. The file still occupies disk space but is invisible to the application.

**Fix**: At minimum `logger.warning("Skipping corrupt metadata %s: %s", metadata_file, e)`. In production code the exception should be recorded in a dead-letter structure or monitoring counter.

**Effort**: Low.

---

#### H-3 — `tests/test_openapi_contract.py:41-42` — Non-connection exceptions hide server status

```python
    except Exception:
        return False
```

**Why dangerous**: The `is_server_running` helper catches *all* exceptions after `ConnectionError`. A `requests.exceptions.Timeout` (server overloaded), an `SSLError` (misconfigured TLS), or a JSON decode error all return `False` and silently skip every contract test via `pytest.skip(...)`. The CI run shows "skipped" rather than "failed", masking real server problems.

**Fix**: Catch only `requests.exceptions.ConnectionError` for the "server is down" case. Let other exceptions propagate or at minimum log them and return a distinct sentinel.

**Effort**: Low.

---

#### H-4 — `test_text_markdown_export.py:180-182`, `test_text_markdown_export.py:231-233` — Export failures logged but test continues

```python
    except Exception as e:
        print(f"✗ Text export failed: {e}")
        return False
```

**Why dangerous**: These test functions return `False` on failure but the main runner does not propagate them to a non-zero exit code in every path — notably `test_template_flexibility` (line 274) and `test_encoding_and_line_endings` (line 312) catch all exceptions with `print + return False`, which means a stack-trace-worthy bug (e.g. `AttributeError` in the exporter) surfaces only as a printed message. No stack trace is preserved, making the failure hard to diagnose.

**Fix**: Use `logger.exception(...)` or re-raise. If this is production code the pattern should raise, not return a boolean.

**Effort**: Low.

---

#### H-5 — `scripts/validate-config.py:121-122`, `scripts/validate-config.py:128-130` — Path validation errors swallowed into `self.errors`

```python
            except Exception as e:
                self.errors.append(f"Cannot create upload directory: {e}")
```

**Why dangerous**: These two cases are acceptable *in intent* (they accumulate errors for display), but the broad `except Exception` hides the exception type. A `PermissionError` and an `OSError: [Errno 28] No space left on device` both produce the same generic message. In production, the distinction matters for remediation.

**Fix**: Use `f"Cannot create upload directory ({type(e).__name__}): {e}"` at minimum. Separate handlers for `PermissionError` vs `OSError` are better.

**Effort**: Low.

---

#### H-6 — `scripts/seed_data.py:49-51` — Exception logged at ERROR but stack trace lost

```python
    except Exception as e:
        logger.error(f"❌ Error during seeding: {e}")
        sys.exit(1)
```

**Why dangerous**: `logger.error(f"...{e}")` formats only the exception *message*, not the traceback. A `SQLAlchemyError` buried three frames deep will surface only as "SQLAlchemyError: ...", stripping the line numbers that identify *which* query failed. In a seed script that runs at deploy time, this makes production outages harder to diagnose.

**Fix**: Replace with `logger.exception("Error during seeding")` which automatically includes the traceback.

**Effort**: Trivial.

---

### MEDIUM (failures that complicate debugging)

#### M-1 — `test_migration_sql.py:74-79` — Migration upgrade failure prints but does not abort cleanly

```python
        try:
            migration.upgrade()
            print("✅ Migration upgrade() executed successfully")
        except Exception as e:
            print(f"❌ Migration upgrade() failed: {e}")
            return False
```

**Why dangerous**: When `migration.upgrade()` fails mid-run, some Alembic operations may have already executed (partial schema changes). The exception is caught, `False` is returned, and `main()` prints a failure message — but it does not raise, so the Python process exits 0 if the calling harness does not check `sys.exit`. A CI pipeline can silently pass even though migrations partially applied.

**Fix**: Call `sys.exit(1)` on failure, or let the exception propagate.

**Effort**: Low.

---

#### M-2 — `tests/test_openapi_contract.py:157-186` — Contract test errors swallowed into `errors` list, test passes unless `failed > 0`

```python
                except Exception as e:
                    # Check if this is a 501 response that failed validation
                    if hasattr(e, 'response') and e.response and e.response.status_code == 501:
                        passed += 1
                        continue
                    failed += 1
                    errors.append(...)
```

**Why dangerous**: The `hasattr(e, 'response')` guard silently promotes *any exception without a `response` attribute* (e.g., `AttributeError`, `TypeError` in the test harness itself) to `failed` without detail. The `errors` list receives only a string representation. If Hypothesis/Schemathesis raises an internal error, it looks identical to a legitimate contract violation in the output.

**Fix**: Re-raise unknown exception types after logging them. Distinguish harness errors from contract violations.

**Effort**: Medium.

---

#### M-3 — `scripts/validate-config.py:395-404` — Top-level `except Exception` in `main()` discards validator state

```python
    except Exception as e:
        console.print(f"\n[red]Unexpected error: {e}[/red]")
        sys.exit(1)
```

**Why dangerous**: An unexpected exception in `validate_all()` after some checks have run (e.g., DB connected but Redis raised) is printed without a traceback and the partial results are never displayed. An operator running this sees a single red line and cannot tell which check was in progress.

**Fix**: Use `console.print_exception()` (Rich API) or `traceback.print_exc()` to show the full traceback.

**Effort**: Low.

---

#### M-4 — `test_migration.py:21-26` — Import error swallowed with `return False`

```python
    try:
        spec = importlib.util.spec_from_file_location("migration", migration_path)
        migration = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(migration)
    except Exception as e:
        print(f"❌ Failed to import migration: {e}")
        return False
```

**Why dangerous**: `spec.loader.exec_module(migration)` can raise `SyntaxError`, `ImportError`, or `AttributeError`. All are caught identically. A `SyntaxError` in the migration file and a missing `alembic` dependency produce indistinguishable output, making the error harder to fix.

**Fix**: Separate `except SyntaxError`, `except ImportError`, `except Exception` handlers with distinct messages.

**Effort**: Low.

---

#### M-5 — `migrations/env.py` — No error handling around `run_migrations_online()`

```python
if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
```

**Why dangerous**: If the DB connection fails inside `run_migrations_online()`, the exception propagates to Alembic's top-level handler which prints a traceback and exits non-zero. This is acceptable, but the custom `get_url()` function silently falls back to hardcoded defaults (`password`, `localhost:5432`) when env vars are missing (lines 44-55). A misconfigured deployment with no `DATABASE_URL` will attempt to connect to the fallback URL, fail, and the error message will reference the fallback URL — obscuring the real problem (missing env var).

**Fix**: Add a check at the top of `get_url()`: if neither `DATABASE_URL` nor all component vars are set, raise `RuntimeError("DATABASE_URL or DB_* variables must be set")`.

**Effort**: Low.

---

### LOW (defensive try/except that should be tightened or removed)

#### L-1 — `test_storage_direct.py:219`, `test_storage_minimal.py:279` — Broad `except Exception: continue` in utility methods copied from production

These implementations are labelled as "test" files but are faithful copies of the planned production `LocalStorageBackend`. The `except Exception: continue` pattern in `list_files()` should at minimum emit a warning log in the real backend.

**Fix**: Narrow to `except (json.JSONDecodeError, OSError, KeyError)` and log at WARNING.

---

#### L-2 — `test_container_review.py:95-100`, `108-113`, `116-127` — `except Exception as e: _record_test_result(name, False, str(e))` loses stack trace

In a test harness this is acceptable for isolation, but `str(e)` loses the type and traceback. A `TypeError` in the recommender and an `AssertionError` from a wrong return value look identical.

**Fix**: Append `traceback.format_exc()` to the recorded error string.

---

#### L-3 — `scripts/test_migration_004.py:21-28` — `run_command` catches all exceptions

```python
    except Exception as e:
        print(f"❌ Exception: {e}")
        return False
```

A subprocess execution raising `FileNotFoundError` (e.g., `python` not on `PATH`) is indistinguishable from a non-zero return code. In CI this can misattribute failures.

---

## Patterns to Lint For

Recommended grep patterns to add to pre-commit / CI:

```bash
# 1. Bare except clauses
grep -rn "except:" --include="*.py" src/ scripts/

# 2. Silent exception swallowing
grep -rn "except Exception.*:\s*$" --include="*.py" src/ | grep -v "# "
grep -rn "except Exception.*pass" --include="*.py" src/

# 3. Exception converted to boolean return
grep -rn "except.*return False" --include="*.py" src/ scripts/
grep -rn "except.*return None" --include="*.py" src/ scripts/
grep -rn "except.*return \[\]" --include="*.py" src/ scripts/

# 4. logger.error with f-string (loses traceback — use logger.exception)
grep -rn 'logger\.error(f"' --include="*.py" src/ scripts/

# 5. Broad exception with continue (in loops)
grep -rn "except Exception.*continue" --include="*.py" src/
```

Recommended ruff rules to enable (add to `pyproject.toml` or `ruff.toml`):

```toml
[tool.ruff.lint]
select = [
    "E722",   # bare-except
    "BLE001", # blind-exception (broad except Exception)
    "PERF203",# try-except in loop
    "TRY002", # raise-vanilla-class
    "TRY003", # raise-within-try
    "TRY201", # verbose-raise (re-raise without argument)
    "TRY300", # try-consider-else
    "TRY400", # error-instead-of-exception (logger.error instead of logger.exception)
]
```

---

## Open Questions

1. **Missing source files**: The `src/jidelnicek/` directory tree contains only empty subdirectories — no `.py` source files are present. This may indicate the application modules are stored in a Docker volume, a private submodule, or were not committed. The most dangerous silent-failure patterns (middleware, async task handlers, Redis client wrappers, Celery task definitions) are in the *absent* code. This hunt should be re-run once the application source is present.

2. **Frontend code**: The `frontend/src/` scaffold is likewise empty of `.ts`/`.tsx` files. Silent-failure patterns in React (`.catch(() => {})`, unhandled Promise rejections in `useEffect`, `!response.ok` not checked) cannot be assessed yet.

3. **Celery task error handling**: `scripts/run_celery_worker.py` references `jidelnicek.core.celery_app`. Without the task definitions, it is unknown whether Celery tasks use `bind=True` + `self.retry(exc=...)` or silently succeed on failure. This is a CRITICAL gap.

4. **Migration partial-failure atomicity**: Migrations 001–005 are DDL-only and benefit from PostgreSQL's transactional DDL, so partial failure is unlikely. Migration 004 creates PostgreSQL triggers via `op.execute()` — if the trigger body has a bug, `CREATE FUNCTION` will raise and Alembic will roll back. However, there is no `try/except` in the migration `upgrade()` functions, which is correct — but the Alembic `env.py` wraps `run_migrations()` inside `context.begin_transaction()`, so a failure mid-migration leaves the DB clean. Confirm this with a test against a live DB.

5. **`tests/conftest.py` hardcoded test DB password**: `DB_PASSWORD = "test_password"` and `TEST_DATABASE_URL` with `testpassword` in the connection string (lines 27, 41) will cause connection failures silently ignored by the triple-nested teardown handler if the test DB is not running on the expected port/host.
