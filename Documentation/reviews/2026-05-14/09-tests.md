# Test Quality Review

## Scope (test files counted: backend 23 in report + 20 top-level scripts, frontend 0 executable)

**Backend:** The `tests/` directory currently contains only `conftest.py`, `test_openapi_contract.py`, and `split.py`. The actual test modules (23 unique files visible in `full_testRep.txt`) have been deleted from disk; only compiled `__pycache__` bytecode stubs and the source of the directories remain. Analysis is based on `full_testRep.txt`, the most recent captured run, plus the 20 surviving top-level `test_*.py` scripts scattered at the repo root.

**Frontend:** 121 test files are documented in `COMPREHENSIVE_FRONTEND_COVERAGE_ANALYSIS.md` and `FRONTEND_TEST_METRICS_REPORT.md`, but all `__tests__` directories are empty on disk (every sub-directory under `frontend/src/components/*/` and `frontend/src/__tests__/*/` is empty). The frontend test files have also been deleted. Zero executable frontend tests exist.

**Contract tests:** `tests/test_openapi_contract.py` exists but requires a live server; it cannot run in CI without one.

---

## TL;DR

The project has a documentation-heavy, execution-light test suite. Documented coverage percentages (95% responsive, 85% state management, etc.) reflect files that no longer exist on disk. The last recorded backend run (`full_testRep.txt`, 2025-07-11) had 1,148 errors, 110 failures, and only 696 passes out of ~1,954 collected items — a 36% error/failure rate. The dominant failure mode is a `sqlalchemy.exc.NoReferencedTableError` on `content_reports.reporter_id` that blocks the `test_engine` fixture for every test in the `auth`, `admin`, `trip`, `api`, and other modules, making 1,148 tests unevaluable. The surviving top-level scripts are ad-hoc debugging tools, not pytest-collected unit tests, and the contract tests require a running server.

The core calculation logic (scaling, rounding, categorization) has reasonable standalone scripts but they use a custom print-and-assert harness instead of pytest, contain no edge-case grouping under pytest markers, and cannot contribute to coverage reports.

---

## Coverage shape per module (table)

| Module | Test files (last run) | Passed | Failed | Errors | Behavioral quality |
|--------|----------------------|--------|--------|--------|-------------------|
| auth | ~12 files inferred | ~200 | 0 | ~142 | All blocked by FK error — zero behavioral signal |
| admin | 3 files confirmed | ~150 | 22 | ~224 | Mixed: audit middleware tests assert mock calls rather than observable state |
| recipe | 8 files confirmed | ~180 | 48 | ~358 | Precision/accuracy tests are behaviorally strong but several fail; search service tests all fail |
| trip | 5 files confirmed | ~100 | 12 | ~366 | Export tests fail due to missing optional deps; many blocked by FK error |
| core | 4 files confirmed | ~50 | 23 | ~61 | Rate-limit and sanitization tests fail against real behavior |
| shopping | 0 files in `tests/` | — | — | — | Only a standalone root script; not in pytest |
| ingredients | 0 files in `tests/` | — | — | — | No tests at all |
| users | 0 files in `tests/` | — | — | — | No tests at all |
| snacks | 0 files in `tests/` | — | — | — | No tests at all |
| calculations | 0 files in `tests/` | — | — | — | No tests at all |
| frontend | 0 files (deleted) | — | — | — | Documented but non-existent |
| contract | 1 file (server-dep) | — | — | — | Requires live server; not CI-runnable |

---

## Behavioral vs implementation test ratio

From the surviving test content and the failure traces:

- **Strong behavioral assertions** (HTTP status + body payload, numeric accuracy within tolerance): ~40% of confirmed test code. Examples: `test_scaling_accuracy.py` (asserts Decimal precision), `test_rounding.py`, `test_categorization_accuracy.py`.
- **Implementation / mock-call assertions** (verify that `mock.log_action.assert_called_once()`): ~35%. The admin audit middleware tests (`test_audit_middleware.py`) consistently assert that internal mocks were called rather than checking observable outcomes like audit log records in the DB.
- **No-op / structural assertions** (checks that objects were created, migrations have callable `upgrade()`): ~25%. Examples: `test_migration.py`, `test_validation_simple.py` (checks `hasattr`, not behavior).

The mock-call category is the most problematic for behavioral coverage. `TestMiddlewareIntegration.test_successful_action_logging` at `tests/admin/test_audit_middleware.py:248` asserts `mock_audit_instance.log_action.assert_called_once()` — it cannot detect that the middleware routes to the wrong code path because the mock itself is what is being measured, not the actual audit record written to the database.

---

## Findings

### CRITICAL

**C-1 — `tests/conftest.py:62` — Global test engine broken by unresolved FK**
Path: `tests/conftest.py:62`
What: `Base.metadata.create_all` raises `sqlalchemy.exc.NoReferencedTableError: Foreign key associated with column 'content_reports.reporter_id' could not find table 'users'` because `content_reports` references a `users` table but the models import via `jidelnicek.db.base.*` brings in the admin `ContentReport` model before the `users` table is registered. This single error surfaces as 1,148 `ERROR at setup` entries — roughly 59% of all collected tests cannot run at all.
Fix: Ensure `users` table model is imported before any model that references it in `jidelnicek/db/base.py`; add an explicit import ordering test or use `declared_attr` for the FK. Effort: low (1–2 hours).
[NEW]

**C-2 — `tests/core/test_security.py:342` — Rate-limit test passes when it should block**
Path: `tests/core/test_security.py:342`
What: `assert response.status_code == 429` receives 200. The test injects a `mock_redis` that returns `[None, 0, None, None]` from `pipeline().execute()` — indicating 0 requests in window — so the middleware always allows the request through. The test was written expecting the mock to simulate a full bucket, but the fixture state never flips to the exceeded state. This is a behavioral regression: the rate-limiting middleware is not tested under realistic load.
Fix: Configure `mock_redis.execute.return_value` to return `[None, 6, None, None]` (count >= limit) before the assertion, or use a real Redis instance. Effort: low.
[NEW]

**C-3 — All frontend test infrastructure deleted; 0 executable tests**
Path: `frontend/src/components/*/tests__/` (all empty)
What: Every component, store, hook, i18n, and integration test directory exists as an empty folder. The documentation claims 121 test files with 95% responsive coverage and 90% accessibility coverage. None of this is runnable. The Vitest config in `frontend/vite.config.ts` references `src/**/*.{test,spec}.{...}` but there are no such files. The frontend is entirely untested.
Fix: Restore or rewrite tests for at minimum the critical business logic: recipe scaling display, participant coefficient UI, trip summary calculations, and auth flows. Effort: high (multi-week).
[NEW]

### HIGH

**H-1 — `tests/recipe/test_scaling_accuracy.py:87` — Core calculation engine has real precision failures**
Path: `tests/recipe/test_scaling_accuracy.py:87`, `:267`, `:394`
What: Three failures indicate the core scaling engine does not meet the 99.9% accuracy requirement it was designed for:
- `test_extreme_precision_cases`: scaling 0.000001 gives 0.0000 (100% error — likely a rounding floor issue)
- `test_participant_coefficient_accuracy`: lunch coefficient gives 5.98 instead of 6.855 (12.76% error — meal-specific override logic is broken)
- `test_rounding_impact_on_accuracy`: rounding 1.5 piece gives 3 instead of 2.25 (33.3% error — SmartRounder rounds up aggressively)

These are not test-quality problems; they are real bugs in the calculation engine that the tests are correctly catching. The underlying business requirement (accurate nutrition calculations) is at risk.
Fix: Fix the three bugs in `RecipeScaler`, `ParticipantScaler` (meal-coefficient path), and `SmartRounder`. Effort: medium.
[NEW]

**H-2 — `tests/admin/test_audit_middleware.py:248,298` — Audit middleware tests assert mock calls, not audit records**
Path: `tests/admin/test_audit_middleware.py:248` and `:298`
What: `TestMiddlewareIntegration.test_successful_action_logging` patches `AuditService` with a mock, then calls the middleware, then asserts `mock.log_action.assert_called_once()` — which fails because the middleware does not call the mock at all (0 calls). The test design means neither a passing nor a failing result tells you whether an audit record would actually be written to the database. Patching the service at the wrong level defeats the integration intent.
Fix: Use the real `db_session` fixture and assert that an audit row exists in the DB after the request. Effort: medium.
[NEW]

**H-3 — `tests/core/test_security.py` — Sanitization tests fail against live behavior**
Path: `tests/core/test_security.py` (multiple `TestRequestSanitization` failures)
What: `test_request_size_limit`, `test_null_byte_sanitization`, `test_filename_sanitization`, `test_content_type_validation` all fail. These are security-critical tests. The middleware either is not wired correctly in the test app, or the implementation diverged. The `test_filename_debug*.py` root scripts confirm there was active debugging of filename handling.
Fix: Wire `ValidationMiddleware` into the test FastAPI app the same way it is wired in production; verify content-type and null-byte routes. Effort: medium.
[NEW]

**H-4 — `tests/trip/test_qr_codes_router.py:76` — Unhandled PIL error returns 500 instead of 400**
Path: `tests/trip/test_qr_codes_router.py:76`
What: `assert response.status_code == status.HTTP_400_BAD_REQUEST` receives 500. `PIL.UnidentifiedImageError` is propagated unhandled from the QR code endpoint. The test is correct; the implementation is missing a try/except around unsupported format requests.
Fix: Catch `PIL.UnidentifiedImageError` (and `ValueError` for bad format strings) in the QR endpoint and return 400 with a user-readable message. Effort: low.
[NEW]

**H-5 — No tests exist for `ingredients`, `users`, `snacks`, `calculations` modules**
Path: `tests/` directory (absent subdirectories)
What: Four backend modules have zero tests. `ingredients` and `users` are CRUD-heavy API modules that would cover a large fraction of real user traffic. `calculations` contains the nutritional engine services. `snacks` is a standalone meal-adjacent module.
Fix: Write integration tests for at minimum the happy-path CRUD and the auth boundary (own-resource vs other-user resource) for each. Effort: high.
[NEW]

### MEDIUM

**M-1 — `tests/recipe/test_scaling_validator.py:103` — Validator does not emit warnings it is expected to emit**
Path: `tests/recipe/test_scaling_validator.py:103`
What: `assert len(result.warnings) > 0` fails (0 warnings returned). The test expects the `ScalingValidator` to warn when servings exceed a threshold, but the validator silently accepts the input. Either the threshold logic is missing or the warnings list is never populated.
Fix: Implement the missing warning path in `ScalingValidator.validate_servings()`. Effort: low.
[NEW]

**M-2 — `tests/recipe/test_search_service.py` — All 11 search service tests fail**
Path: `tests/recipe/test_search_service.py`
What: Every search-related test fails (ingredient filter, nutrition range, dietary restriction, time filter, sorting, facets, caching, analytics, pagination, concurrency). The error traces are truncated in the report but the pattern suggests either the `RecipeSearchService` class signature changed or the DB fixtures it needs are broken. The entire recipe search feature is untested in a passing state.
Fix: Diagnose root cause (likely the `test_engine` FK error cascading into search service fixtures), then fix. Effort: low to medium depending on root cause.
[NEW]

**M-3 — Top-level `test_*.py` scripts are not collected by pytest**
Path: `/mnt/data/WORK/Jidelnicek_2.0/test_*.py` (20 files)
What: `pyproject.toml` sets `testpaths = ["tests"]`, so all 20 root-level scripts (`test_rounding_accuracy.py`, `test_scaling_accuracy_standalone.py`, `test_categorization_accuracy.py`, `test_validation_simple.py`, etc.) are invisible to `pytest`. They use a custom `print("✓ passed")` harness that cannot be tracked in coverage reports, cannot be parallelized, and cannot use fixtures. Several represent the only tests for shopping rounding and ingredient categorization.
Fix: Convert to proper pytest test functions and move to `tests/shopping/`, `tests/recipe/` etc. Effort: medium.
[NEW]

**M-4 — `tests/conftest.py` — `event_loop` fixture uses deprecated session scope with pytest-asyncio**
Path: `tests/conftest.py:44`
What: The `event_loop` session-scoped fixture is deprecated in `pytest-asyncio >= 0.21` and produces 481 warnings in the run. The correct approach is `asyncio_mode = "auto"` (already set) with per-function scope. The session-scoped loop can cause cross-test state leakage and is the likely source of ordering-dependent failures.
Fix: Remove the custom `event_loop` fixture; rely on `asyncio_mode = "auto"` with the default per-function loop. Effort: low.
[NEW]

**M-5 — `test_csrf_debug.py` and `test_rate_limit_debug.py` — Debug scripts contain no pytest assertions**
Path: `/mnt/data/WORK/Jidelnicek_2.0/test_csrf_debug.py`, `test_rate_limit_debug.py`
What: Both files run the app in an asyncio `main()` function and print results. They do not use `assert` statements tied to pytest. They would pass even if the middleware were completely broken (as long as no exception is thrown). These are developer exploration tools masquerading as test files.
Fix: Convert the behavioral expectations into proper `assert` statements and add pytest markers, or delete and rely on `tests/core/test_security.py`. Effort: low.
[NEW]

**M-6 — No `freeze_time` on any date-dependent tests**
Path: Multiple (scheduling, export, sharing link expiry)
What: `test_sharing_implementation.py` creates `Trip` and `ShareLink` objects using `datetime.now(timezone.utc)` directly. Any test involving link expiry, session age, or trip dates that uses real `datetime.now()` will be time-dependent and can flip between passing and failing depending on when it runs (especially near midnight or DST transitions). No `freeze_time` or `time_machine` usage is visible in the report.
Fix: Apply `@pytest.mark.freeze_time` or `freezegun.freeze_time` decorators to all tests that touch time-sensitive logic. Effort: medium.
[NEW]

### LOW

**L-1 — Contract test silently passes 501 responses as success**
Path: `tests/test_openapi_contract.py:145`
What: The contract test treats any `501 Not Implemented` response as a pass. This means un-implemented endpoints will never fail the contract suite, permanently hiding gaps between the OpenAPI spec and the implementation.
Fix: Only skip 501 during early development; switch to fail-on-501 once endpoints are expected to be complete. Effort: low.
[NEW]

**L-2 — `test_storage_minimal.py` reimplements production classes in-test**
Path: `/mnt/data/WORK/Jidelnicek_2.0/test_storage_minimal.py`
What: The file defines `LocalStorageBackend`, `StorageMetadata`, `CompressionType`, and related classes inline (700 lines) rather than importing from the production module. If the production storage implementation changes, this test continues to pass against its own internal copy, providing false confidence.
Fix: Import from `jidelnicek.core.storage` and test the real classes. Effort: medium.
[NEW]

**L-3 — Test names do not consistently describe behavior**
Path: Multiple files
What: Names like `test_determine_user_update_action` (from the report trace) are better than nothing, but several root-level scripts use function names like `test_basic_functionality()` or `test_rounding_accuracy()` without stating what "correct" means. Preferred form: `test_scaling_factor_raises_on_zero_target_servings`.
Fix: Rename during conversion to proper pytest style. Effort: low.
[NEW]

---

## Flakiness candidates

1. `tests/conftest.py` — Session-scoped `event_loop` creates a shared asyncio loop across all function-scoped async fixtures. Teardown order is undefined, and a test that leaves DB state uncommitted can corrupt the next test's session.

2. Any test touching `datetime.now()` without `freeze_time` — sharing link expiry (`test_sharing_implementation.py`), session age checks, cleanup task scheduling.

3. `TestSearchPerformance::test_concurrent_searches` — explicitly concurrent, uses asyncio tasks without deterministic task scheduling; ordering of results not guaranteed.

4. `test_overall_accuracy_requirement` in the standalone script uses `random.seed(42)` for reproducibility — this is correct, but any change to Python's random algorithm between minor versions would invalidate the seed.

---

## Untested critical paths

1. **Recipe CRUD lifecycle** — create, update, delete, ownership check, forking — no tests in `tests/` for the actual HTTP endpoints.
2. **Trip meal assignment with participant scaling** — the most complex business rule in the app (participant coefficients × meal slots × scaling factor) has unit tests for the math engine but no end-to-end HTTP test that creates a trip, adds participants, assigns a recipe, and verifies the scaled nutritional output.
3. **Auth flows** — login, logout, token refresh, email verification, password reset — all blocked by the FK error; zero behavioral signal.
4. **Shopping list generation from a real trip** — covered only by a standalone script that uses mocked data.
5. **Sharing link expiry enforcement** — no test that creates a link, advances time past expiry, and verifies the API returns the correct error rather than serving the content.
6. **Cross-user authorization** — verified only in tests that cannot run due to the FK error; no confirmed test that a user cannot access another user's recipe or trip.
7. **Frontend** — entirely absent.

---

## Open Questions

1. Were the test files in `tests/admin/`, `tests/auth/`, `tests/recipe/`, etc. deleted intentionally as part of a refactoring, or were they accidentally removed (e.g., by a `git clean` or a failed merge)? The `__pycache__` dirs are empty too, suggesting an untracked deletion.

2. The `COMPREHENSIVE_FRONTEND_COVERAGE_ANALYSIS.md` and `FRONTEND_TEST_METRICS_REPORT.md` describe 121 test files in detail. Were these documents generated by the AI agent from source files that were then deleted, or did the files exist and were later removed? If the latter, git history should allow restoration.

3. The `full_testRep.txt` shows `venv/lib/python3.13/` paths but `pyproject.toml` specifies `python = "^3.11"`. Is Python 3.13 supported? Some behavioral differences between 3.11 and 3.13 could explain unexpected failures.

4. The contract test (`test_openapi_contract.py`) uses Schemathesis `schema.as_strategy().example()` in a loop of 10 iterations — this is not a deterministic test. What is the intended test strategy for contract validation in CI?
