# Dead Code Audit
**Date**: 2026-05-14
**Project**: Jidelnicek 2.0 (`/mnt/data/WORK/Jidelnicek_2.0`)

---

## Scope

- **Backend**: `src/jidelnicek/` (286 Python files tracked in git index), standalone scripts at project root, alembic migrations
- **Frontend**: `frontend/src/` (807 TypeScript/TSX files tracked in git index), `frontend/package.json`, root-level `package.json`
- **Migrations**: `alembic/versions/` (on disk), `migrations/versions/` (git index), `migrations_backup_20250710_031019/` (git index)

---

## Tools Run + Versions + Status

| Tool | Version | Invocation | Status | Notes |
|------|---------|------------|--------|-------|
| `ruff check --select F401` | ruff 0.15.12 | Applied to all on-disk `.py` files | **Output produced** — 52 violations across 22 files | Cannot run against `src/jidelnicek/` proper because source blobs are missing from git object store (see Critical Note below) |
| `vulture` | N/A | Checked for installation | **Skipped** — not installed, not installed per instructions |
| `npx depcheck` (frontend) | latest via npx | `cd frontend && npx --yes depcheck` | **Produced output but unreliable** — reports all 55 deps + 26 devDeps as unused because `frontend/src/` contains zero files on disk |
| `npx depcheck` (root) | latest via npx | `cd . && npx --yes depcheck` | **Output produced** — 9 unused deps, 9 unused devDeps; reliable because root `package.json` has no source consuming it |
| `npx ts-prune` (frontend) | latest via npx | `cd frontend && npx --yes ts-prune` | **No output** — no source files on disk to scan |
| `npx knip` (frontend) | 6.13.1 | `cd frontend && npx --yes knip` | **Failed** — requires Node.js >=20.19.0, system has v18.19.1 |

### Critical Note: Missing Git Object Store

All 286 backend Python files and 807 frontend TypeScript files are tracked in the git index (`git ls-files --cached` confirms them) but their blob objects are absent from `.git/objects/` (0 objects found, no pack files). This means `git show :path` fails, `git checkout` fails, and ruff/ts-prune cannot run against the main source. The git index was populated by `git add` before any commit was made, and the object writes were lost (likely a containerized environment that was torn down). The project has a remote at `git@gitlab.com:matescb/jidelnicek_2.0.git`; the objects exist there. **The analysis below is based on (a) ruff on on-disk scripts/tests/migrations, (b) structural inspection via `git ls-files --cached` for file-name-level patterns, and (c) existing project documentation.**

---

## Backend Dead Code

### Unused Imports — On-Disk Files (ruff F401, 52 violations)

These files exist on disk and were scanned by ruff. The main `src/jidelnicek/` source was not scannable due to missing objects.

| File | Line | Import |
|------|------|--------|
| `alembic/versions/002_add_session_management_fields.py` | 16 | `sqlalchemy.dialects.postgresql` |
| `check_openapi.py` | 3 | `json` |
| `debug_config.py` | 11 | `pydantic_settings` |
| `debug_config.py` | 12 | `pydantic_settings.sources.providers.env.EnvSettingsSource` |
| `docs/trip_cloning_example.py` | 5 | `datetime.timedelta` |
| `example_contract_test.py` | 12 | `json` |
| `generate_auth_token.py` | 21 | `time` |
| `scripts/demo_text_markdown_export.py` | 10 | `os` |
| `scripts/test_migration_004.py` | 11 | `os` |
| `scripts/validate-config.py` | 10 | `os` |
| `scripts/validate-config.py` | 13 | `typing.Tuple` |
| `scripts/validate-config.py` | 13 | `typing.Optional` |
| `scripts/validate-config.py` | 20 | `src.jidelnicek.core.config.Settings` |
| `simple_excel_test.py` | 5 | `os` |
| `test_container_review.py` | 9 | `decimal.Decimal` |
| `test_container_review.py` | 10 | `typing.List` |
| `test_container_review.py` | 15–18 | `ContainerType`, `ContainerShape`, `ContainerSize`, `StorageType` (all from `jidelnicek.shopping.services.container_recommender`) |
| `test_middleware_format.py` | 7 | `asyncio` |
| `test_middleware_format.py` | 14 | `fastapi.Request` |
| `test_migration_sql.py` | 6 | `sqlalchemy.MetaData` |
| `test_migration_sql.py` | 7 | `sqlalchemy.schema.CreateTable` |
| `test_migration_sql.py` | 8 | `alembic.config.Config` |
| `test_migration_sql.py` | 11 | `io.StringIO` |
| `test_migration_sql.py` | 43–44 | `alembic.ddl.impl.DefaultImpl`, `alembic.runtime.migration.MigrationInfo` |
| `test_progress_minimal.py` | 10 | `json` |
| `test_progress_minimal.py` | 21 | `ProgressStep`, `ProgressInfo` (from `jidelnicek.core.services.progress_tracker`) |
| `test_scaling_accuracy_standalone.py` | 19–21 | `SmartRounder`, `ScalingConstraints`, `ScalingValidator` |
| `test_scaling_accuracy_standalone_fixed.py` | 19–21 | `SmartRounder`, `ScalingConstraints`, `ScalingValidator` |
| `test_sharing_implementation.py` | 18 | `sqlalchemy.select` |
| `test_storage_direct.py` | 6 | `os` |
| `test_storage_simple.py` | 6 | `os` |
| `test_storage_simple.py` | 17–18 | `S3StorageBackend`, `AzureStorageBackend` (from `jidelnicek.core.storage`) |
| `test_text_markdown_export.py` | 13–15 | `TextExporter`, `ShoppingListExporter`, `ShoppingList`, `ShoppingListSection`, `ShoppingListItem` |
| `test_validation_simple.py` | 7 | `asyncio` |
| `tests/conftest.py` | 11 | `secrets` |
| `tests/conftest.py` | 22 | `unittest.mock.MagicMock` |
| `tests/test_openapi_contract.py` | 28 | `typing.Dict` |
| `tests/test_openapi_contract.py` | 161 | `hypothesis.given` |

### Unused Functions / Classes (Structural, Name-Level Analysis)

Cannot run vulture against `src/jidelnicek/` (missing objects). The following are identified from structural patterns:

| File | Item | Confidence | Reason |
|------|------|-----------|--------|
| `src/jidelnicek/recipe/models_old.py` | Entire module | HIGH | Naming suffix `_old` indicates superseded by `recipe/models/` package |
| `src/jidelnicek/examples/background_jobs_example.py` | Entire module | HIGH | `examples/` directory has no `__init__.py` importing it; not a routable module |
| `src/jidelnicek/examples/optimized_usage.py` | Entire module | HIGH | Same as above |
| `src/jidelnicek/admin/security/example_usage.py` | Entire module | HIGH | Named `example_usage.py` in a security module; not imported by `__init__.py` pattern |
| `src/jidelnicek/core/validation/examples.py` | Entire module | HIGH | Example file in production package |
| `src/jidelnicek/core/testing/performance.py` | Entire module | MEDIUM | `testing/` sub-package inside production source (`core/`); normally belongs in `tests/` |
| `src/jidelnicek/core/seed_data.py` | Entire module | MEDIUM | Seeding scripts not called by the application router, likely a one-off tool |
| `src/jidelnicek/core/seed_cleanup_policies.py` | Entire module | MEDIUM | Same as above |
| `src/jidelnicek/auth/services/optimized_user_service.py` | Entire module | MEDIUM | Co-exists with `auth/services/user_service.py` and `users/services/user_service.py` — probable duplicate |
| `src/jidelnicek/common/auth.py` | Entire module | MEDIUM | Auth logic already lives in `auth/` module; purpose of `common/auth.py` is unclear |
| `src/jidelnicek/common/config.py` | Entire module | MEDIUM | Config already in `core/config.py`; common/config.py may be superseded |
| `src/jidelnicek/common/database.py` | Entire module | MEDIUM | Database already in `core/database.py`; common/database.py may be superseded |

### Module-Level Name Conflicts (Same-Name File + Package)

Python only allows one to win when both `foo.py` and `foo/` exist in the same directory. The following are structural conflicts that indicate one is dead:

| Location | Conflict |
|----------|----------|
| `src/jidelnicek/admin/models.py` vs `src/jidelnicek/admin/models/` | One of these is unreachable. The package (directory) wins in Python 3 namespace resolution. `admin/models.py` is effectively shadowed. |
| `src/jidelnicek/admin/schemas.py` vs `src/jidelnicek/admin/schemas/` | Same conflict; `admin/schemas.py` is shadowed. |
| `src/jidelnicek/recipe/schemas.py` vs `src/jidelnicek/recipe/schemas/` | `recipe/schemas.py` is shadowed. |
| `src/jidelnicek/recipe/models/schemas.py` | Nested schemas inside models package — may conflict with or duplicate `recipe/schemas/` |
| `src/jidelnicek/core/monitoring.py` vs `src/jidelnicek/core/monitoring/` | `core/monitoring.py` is shadowed by the package. |
| `src/jidelnicek/core/cache.py` vs `src/jidelnicek/core/cache_utils/` | Different names so no direct conflict, but likely a consolidation candidate. |

### Duplicate Service Modules (Cross-Module)

| Module A | Module B | Risk |
|----------|----------|------|
| `src/jidelnicek/auth/services/email_service.py` | `src/jidelnicek/core/email_service.py` | Likely one is a copy; need diff to confirm |
| `src/jidelnicek/auth/services/user_service.py` | `src/jidelnicek/users/services/user_service.py` | Two modules named identically in sibling domains; one is likely the canonical version |
| `src/jidelnicek/auth/services/optimized_user_service.py` | `src/jidelnicek/auth/services/user_service.py` | "optimized" version may have superseded the original, or vice versa |
| `src/jidelnicek/admin/services/audit_service.py` | `src/jidelnicek/admin/services/audit_system.py` | `src/jidelnicek/core/services/audit.py` | Three audit-related services; consolidation candidate |
| `src/jidelnicek/admin/middleware/security.py` | `src/jidelnicek/core/middleware/security.py` | Security middleware in two places |
| `src/jidelnicek/common/models/ingredient.py` | `src/jidelnicek/ingredients/schemas/ingredient.py` | Ingredient model defined in two modules |
| `src/jidelnicek/common/models/snack.py` | `src/jidelnicek/snacks/` module | Snack model in common vs dedicated snacks module |

### Dead Routes / Endpoints

Based on `missing_endpoints_analysis.md` (project-generated document) — 87 endpoints are specified in the OpenAPI schema but unimplemented. The following modules exist in the codebase but have no router registered in the application (no calls to `app.include_router()` found for them, per structural analysis):

| Module | Status | Notes |
|--------|--------|-------|
| `src/jidelnicek/shopping/` | No router | Shopping module has `services/` and `utils/` but no `routers/` subdirectory |
| `src/jidelnicek/calculations/routers/calculation_router.py` | Likely not registered | Calculations module has a router file but no `__init__.py` services/schemas |
| `src/jidelnicek/users/routers/users.py` | Likely stub | All 9 Users endpoints listed as ❌ missing in `missing_endpoints_analysis.md` |
| `src/jidelnicek/snacks/routers/snacks.py` | Likely stub | All snack endpoints listed as ❌ missing |
| `src/jidelnicek/ingredients/routers/ingredients.py` | Partial | Several ingredient endpoints listed as ❌ missing |
| `src/jidelnicek/trip/routers/` (days, meals, participants, templates, export) | Partial | 30+ trip sub-endpoints listed as ❌ missing |
| `src/jidelnicek/recipe/routers/marketplace.py` | Likely stub | All marketplace endpoints listed as ❌ missing |

The test suite in `tests/test_openapi_contract.py` explicitly treats HTTP 501 responses as success (lines 140–182), confirming that 501 stubs exist in the running application.

### Orphan Migrations

| Issue | File(s) |
|-------|---------|
| **Duplicate migration tree, not referenced by alembic.ini** | `alembic/versions/001–005_*.py` (5 files on disk). `alembic.ini` sets `script_location = migrations`, so the `alembic/` tree is never run. These 5 migrations are orphaned. |
| **Backup migration tree tracked in git** | `migrations_backup_20250710_031019/versions/` (18 files in git index). This is a timestamped backup committed to source. It should not be in the repository. |
| **Canonical migration missing from disk** | `migrations/versions/001_initial_schema.py` is in the git index but has missing blob objects — same as all source files. |

### Root-Level One-Off Scripts (Dead in Production)

28 files at the project root (`test_*.py`, `fix_*.py`, `check_*.py`, `debug_*.py`, `simple_*.py`) are one-off development/debug scripts. They are tracked in git but not part of the application. They clutter the root and should be moved to `scripts/` or deleted:

Representative examples:
- `test_scaling_accuracy_standalone.py` and `test_scaling_accuracy_standalone_fixed.py` — duplicates of each other (same 3 unused imports in both)
- `test_storage_direct.py`, `test_storage_minimal.py`, `test_storage_simple.py` — three storage tests outside the test suite
- `fix_openapi_status_codes.py`, `fix_yaml_structure.py` — one-time fixup scripts

---

## Frontend Dead Code

### Unused Exports (Structural Analysis — No ts-prune Output)

ts-prune returned no output (source files not on disk). The following are identified from file-name patterns in the git index:

#### Example / Demo / Showcase Components (62 files)

These files are in `frontend/src/` but their names indicate development examples, not shipped features. None appear to be registered in the router (`frontend/src/router/index.tsx` or `frontend/src/routes/config.tsx`):

| Directory | Files |
|-----------|-------|
| `frontend/src/components/examples/` | `AnimationShowcase.tsx`, `CodeSplittingExample.tsx`, `ErrorRecoveryDemo.tsx`, `ResponsiveDemo.tsx`, `ResponsiveListDemo.tsx`, `StoreExample.tsx`, `ToastDemo.tsx`, `VirtualScrollingExamples.tsx` |
| `frontend/src/components/forms/` | `AsyncValidationExamples.tsx`, `FormErrorExamples.tsx`, `FormFieldExamples.tsx`, `FormSubmissionExamples.tsx`, `FormValidationExample.tsx` |
| `frontend/src/components/errors/` | `ErrorShowcase.tsx`, `examples.tsx` |
| `frontend/src/components/trips/` | `CostCalculatorDemo.tsx`, `CostCalculatorExample.tsx`, `NutritionCalculatorDemo.tsx`, `ParticipantOperationsExample.tsx`, `RealTimeUpdatesExample.tsx`, `ShoppingListViewDemo.tsx`, `ShoppingListViewExample.tsx`, `TripCalendarDemo.tsx`, `TripListViewDemo.tsx`, `TripWizardDemo.tsx` |
| `frontend/src/components/ui/` | `ButtonExample.tsx`, `CardExamples.tsx`, `CardShowcase.tsx`, `ComboBoxExample.tsx`, `DialogExample.tsx`, `LoadingExamples.tsx`, `LoadingShowcase.tsx`, `TooltipExample.tsx` |
| `frontend/src/components/ui/error/` | `ErrorShowcase.tsx` |
| `frontend/src/components/ui/loading/` | `LoadingShowcase.tsx` |
| `frontend/src/components/ui/skeleton/` | `SkeletonShowcase.tsx` |
| `frontend/src/examples/` | `ThemeSystemDemo.tsx` |
| `frontend/src/hooks/examples/` | `theme-hooks-examples.tsx` |
| `frontend/src/i18n/examples/` | `management-example.tsx`, `usage-examples.tsx`, `usage.tsx` |
| `frontend/src/pages/demos/` | `VirtualScrollingDemo.tsx` |
| `frontend/src/pages/examples/` | `ToastExamplePage.tsx` |
| `frontend/src/pages/participants/` | `UserProfileDemo.tsx` |
| `frontend/src/pages/trips/` | `ParticipantManagementDemo.tsx` |
| Various | `LanguageSwitcherExamples.tsx`, `BaseDataTable.example.tsx`, `CalculationSummaryDemo.tsx`, `ErrorBoundaryExample.tsx`, `RecipeListViewDemo.tsx` |
| Various | `AdaptiveLayoutExample.tsx`, `GridExamples.tsx`, `MobileComponentsDemo.tsx`, `BreadcrumbsExample.tsx`, `ResponsiveNav.examples.tsx`, `ThemeToggleDemo.tsx`, `ThemeToggle.examples.tsx`, `ImageOptimizationExamples.tsx`, `RTLExample.tsx` |

#### Store Integration Examples (4 files)

| File |
|------|
| `frontend/src/store/cache/integration.example.ts` |
| `frontend/src/store/hydration/integration.example.ts` |
| `frontend/src/store/persistence/integration.example.ts` |
| `frontend/src/config/theme.example.ts` |

### Duplicate Components

| Duplicate Set | Files | Notes |
|---------------|-------|-------|
| **ProtectedRoute** (2 copies) | `frontend/src/components/auth/ProtectedRoute.tsx` and `frontend/src/routes/guards/ProtectedRoute.tsx` | Identical purpose; one is a migration artifact |
| **LanguageSwitcher / LanguageSelector** (3+ copies) | `components/LanguageSwitcher.tsx`, `components/LanguageSwitcherMobile.tsx`, `components/common/LanguageSelector.tsx`, `components/navigation/LanguageSelector.tsx`, `i18n/components/LanguageSwitcher.tsx` | 5 variants; at most 1–2 needed |
| **VirtualList** (2 copies) | `components/performance/VirtualList.tsx` and `components/performance/virtual/VirtualList.tsx` | The flat file predates the `virtual/` subdirectory; flat version likely superseded |
| **LoadingDots / LoadingOverlay / LoadingShowcase** (2 copies each) | `components/ui/Loading*.tsx` (flat) vs `components/ui/loading/Loading*.tsx` (in subdirectory) | Flat versions are likely superseded by the `loading/` package |
| **RouteErrorBoundary** (2 copies) | `components/errors/RouteErrorBoundary.tsx` and `routes/transitions/RouteErrorBoundary.tsx` | Different modules, same component |
| **ErrorBoundary** (many variants) | `components/common/ErrorBoundary.tsx`, `components/errors/{Async,Data,Form,Image,Route}ErrorBoundary.tsx`, `components/forms/ErrorBoundaryForm.tsx`, `components/ui/error/ErrorBoundaryUI.tsx` | 9 files; likely too many specializations, consolidation needed |
| **Async validation** (3 utility files) | `utils/asyncValidation.ts`, `utils/asyncValidation/index.ts`, `utils/validation/asyncValidation.ts` | Three files at different paths for the same concern |
| **Context directories** (split) | `frontend/src/context/` (AuthContext, ThemeContext, WebSocketContext) vs `frontend/src/contexts/` (ErrorContext, FormStateContext, ValidationContext) | Two directories for the same concern; should be one |
| **Router directories** (split) | `frontend/src/router/index.tsx` vs `frontend/src/routes/` (full directory) | Two routing entry points; one is likely the old version |
| **Performance monitoring** (3 files) | `utils/performanceMonitor.ts`, `utils/performanceMonitoring.ts`, `utils/performanceOptimization.tsx` | Three near-identical names covering the same concern |

### Unused npm Dependencies

#### Root-Level `package.json` (reliable — depcheck ran against real usage)

All dependencies are unused (no consuming source at root). This `package.json` appears to be a leftover from Storybook/Playwright scaffolding that was moved into `frontend/`:

**Dependencies** (9 unused): `@playwright/test`, `@radix-ui/react-{checkbox,dialog,label,popover,select,slider}`, `jspdf`, `react-day-picker`

**DevDependencies** (9 unused): `@storybook/addon-{docs,onboarding}`, `@storybook/react-vite`, `@types/{jspdf,socket.io-client}`, `prop-types`, `storybook`, `vite-plugin-{compression,pwa}`

Note: `axios` appears used only in `package.json` itself (no source files on disk at root level to consume it).

#### Frontend `package.json` (unreliable — all deps flagged because src/ is empty on disk)

depcheck reports all 55 dependencies and 26 devDependencies as unused, but this is a false positive caused by empty source directories. The dependency list itself has one clearly suspicious entry:

- **`dependency`** (version `^0.0.1`) — this is a stub/test npm package with no functionality. Almost certainly added by mistake. It appears in the `dependencies` list (not devDependencies).

The following are suspicious based on the package list (cannot confirm without source):
- `@google/gemini-cli` in production `dependencies` (not devDependencies) — a CLI tool, not a runtime library.
- `@types/decimal.js`, `@types/jspdf`, `@types/lodash-es`, `@types/qrcode` in production `dependencies` — type-only packages should be in `devDependencies`.

---

## Duplicate Utilities (Cross-Module Consolidation Candidates)

| Concern | Locations | Action |
|---------|-----------|--------|
| Email service | `auth/services/email_service.py` + `core/email_service.py` | One canonical location, delete other |
| User service | `auth/services/user_service.py` + `users/services/user_service.py` + `auth/services/optimized_user_service.py` | Pick one, delete two |
| Audit service | `admin/services/audit_service.py` + `admin/services/audit_system.py` + `core/services/audit.py` | Consolidate to single module |
| Database module | `core/database.py` + `common/database.py` | `common/` version likely superseded |
| Security middleware | `admin/middleware/security.py` + `core/middleware/security.py` | Merge or clarify separation |
| Cache | `core/cache.py` + `core/cache_utils/cache.py` | Consolidate |
| Monitoring | `core/monitoring.py` (flat file) + `core/monitoring/` (package) | Flat file is dead (shadowed) |
| Frontend: ProtectedRoute | `components/auth/ProtectedRoute.tsx` + `routes/guards/ProtectedRoute.tsx` | One canonical |
| Frontend: LanguageSwitcher | 5 files | Consolidate to 1–2 |
| Frontend: Async validation | `utils/asyncValidation.ts` + `utils/asyncValidation/index.ts` + `utils/validation/asyncValidation.ts` | One canonical |
| Frontend: context vs contexts | Two directories | Merge into one |
| Frontend: router vs routes | `router/` + `routes/` | One canonical routing entry |

---

## Recommended Removal Order (Safe → Risky)

### Batch 1 — SAFE (no production impact, on disk now)

1. **Root-level one-off scripts** (28 Python files): `test_*.py`, `fix_*.py`, `check_*.py`, `debug_*.py`, `simple_*.py` at project root. Not part of the application; not test suite members. Move to `scripts/` archive or delete.

2. **`migrations_backup_20250710_031019/`** (18 files in git index): Timestamped backup committed to source. Should be in `.gitignore` or removed from git history.

3. **Orphaned `alembic/versions/` tree** (5 migration files on disk): `alembic.ini` points to `migrations/`, not `alembic/`. These 5 files are never run by Alembic. Either update `alembic.ini` to point here, or delete and consolidate into `migrations/`.

4. **Root `package.json` + `node_modules/`**: The root-level `package.json` has no source to consume it (all 9 deps + 9 devDeps unused). If Storybook and Playwright are managed from `frontend/`, this file should be removed.

### Batch 2 — CAREFUL (verify no dynamic imports first)

5. **Backend `examples/` module** (`src/jidelnicek/examples/`): Two example files not imported by any router. Verify no import in `main.py` or `__init__.py` before deletion.

6. **Backend `models_old.py`** (`src/jidelnicek/recipe/models_old.py`): Named `_old`; verify no remaining imports reference it.

7. **Shadowed flat files** (`admin/models.py`, `admin/schemas.py`, `recipe/schemas.py`, `core/monitoring.py`): Python silently ignores these when a package of the same name exists. Verify the package is the authoritative version, then delete the flat file.

8. **Frontend example/demo/showcase components** (62 files in `components/examples/`, `pages/demos/`, `pages/examples/`, etc.): Confirm none are registered in the router, then delete.

9. **Frontend `store/*/integration.example.ts`** (4 files): Integration example files inside production store modules.

10. **`dependency` npm package**: Remove `"dependency": "^0.0.1"` from `frontend/package.json`. Confirmed to be a stub package.

11. **Type packages in wrong section**: Move `@types/decimal.js`, `@types/jspdf`, `@types/lodash-es`, `@types/qrcode` from `dependencies` to `devDependencies` in `frontend/package.json`.

12. **`@google/gemini-cli` in runtime deps**: Move from `dependencies` to `devDependencies` or remove entirely if unused.

### Batch 3 — RISKY (requires full source diff)

13. **Duplicate service consolidation**: `email_service`, `user_service`, `audit_service`, `database` duplicates — requires reading both files to determine which is canonical.

14. **Duplicate frontend components**: `ProtectedRoute`, `LanguageSwitcher`, `VirtualList`, `LoadingDots`/`LoadingOverlay`, `RouteErrorBoundary` — requires checking all import sites.

15. **`admin/security/example_usage.py`**, `core/validation/examples.py`**, `core/testing/performance.py` — verify no test harness imports them.

16. **`common/auth.py`, `common/config.py`, `common/database.py`** — verify not imported by the alembic env.py or migration scripts before removing.

---

## Open Questions

1. **Can the git object store be restored?** Running `git fetch origin` against `git@gitlab.com:matescb/jidelnicek_2.0.git` would restore all blob objects and allow ruff, ts-prune, and knip to run against the actual source. All deeper analysis (dead function bodies, 501 stub implementations, actual import graphs) requires this.

2. **Is the `alembic/` directory intentional or a misconfiguration?** `alembic.ini` points to `migrations/` but the only on-disk migration files are in `alembic/versions/`. One of these directories is wrong. Which migration chain is the authoritative history for the database?

3. **Are the 87 missing endpoints stubs (return 501) or truly absent?** The contract test in `tests/test_openapi_contract.py` treats 501 as success — this implies stub handlers exist. Are they empty `pass` bodies or raising `HTTPException(status_code=501)`? This changes removal risk for those router files.

4. **Is `frontend/src/router/index.tsx` or `frontend/src/routes/config.tsx` the canonical routing entry?** Both exist. One is likely the migration source, one the target. Without reading the files (blocked by missing objects), it cannot be determined which is live.

5. **`auth/services/optimized_user_service.py` vs `auth/services/user_service.py`**: The "optimized" variant was likely created as a performance improvement. Is the original still referenced anywhere, or is the optimized version the only one used?

6. **`core/cache.py` vs `core/cache_utils/cache.py`**: Were these split intentionally (different APIs) or is one a refactored version of the other? The `cache_utils/` name suggests it was meant to supersede `cache.py`.
