# TypeScript / React Review

## Scope (frontend path you found)

`/mnt/data/WORK/Jidelnicek_2.0/frontend/`

React 18 + Vite 5 + TypeScript 5.3 SPA. State: Zustand 4. Data fetching: TanStack Query 5 + Axios. Forms: react-hook-form 7 + Zod. Routing: React Router 6. i18n: i18next. UI: Radix UI + Headless UI + MUI (mixed). Testing: Vitest 3 + RTL.

**Critical repo note**: The git object store is entirely empty — all 256 `objects/XX/` directories exist but contain zero blob files. The working tree `src/` directory tree (166 dirs) also contains zero source files on disk. All 681 source files are only referenced in the git index with dangling object hashes. TypeScript compilation and ESLint cannot be run. All findings below are derived from: `tsconfig.json`, `vite.config.ts`, `.eslintrc.js`, `package.json`, and the four documentation files present on disk (`FRONTEND_STATE.md`, `FRONTEND_ISSUE_REGISTER.md`, `STATE_MANAGEMENT_TEST_REPORT.md`, `FRONTEND_TEST_FIX_SESSION_SUMMARY.md`, `FRONTEND_TEST_FIX_PROGRESS.md`, `NAVIGATION_ANALYSIS.md`). Live `tsc` and `eslint` runs were skipped because no source is readable.

---

## TL;DR

The configuration layer is mostly sound but has three immediately actionable problems: (1) `tsconfig.json` omits `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`, leaving a class of runtime crashes undetected at compile time; (2) ESLint downgrades `react-hooks/exhaustive-deps` to a warning instead of an error, so stale-closure bugs silently pass lint; (3) the `eslintrc.js` enables a `jest: true` environment globally even though the project uses Vitest — this suppresses "jest is not defined" lint errors that are genuine test breakages, as confirmed by the roadmap documents reporting 20+ tests failing with exactly that error. Beyond configuration, the documentation reveals HIGH-severity issues in test infrastructure, state management coupling, and form validation consistency.

---

## tsconfig audit

File: `/mnt/data/WORK/Jidelnicek_2.0/frontend/tsconfig.json`

| Option | Present | Value | Assessment |
|---|---|---|---|
| `strict` | YES | `true` | Good — enables strictNullChecks, strictFunctionTypes, etc. |
| `noUnusedLocals` | YES | `true` | Good |
| `noUnusedParameters` | YES | `true` | Good |
| `noFallthroughCasesInSwitch` | YES | `true` | Good |
| `noUncheckedIndexedAccess` | NO | — | **Missing** — array/object index access returns `T` not `T | undefined` |
| `exactOptionalPropertyTypes` | NO | — | **Missing** — `undefined` can be assigned to optional props without this |
| `noImplicitReturns` | NO | — | **Missing** — functions can return nothing in branches without a type error |
| `noPropertyAccessFromIndexSignature` | NO | — | **Missing** — silent access on index-signed objects |
| `isolatedModules` | YES | `true` | Required for Vite/esbuild — good |
| `skipLibCheck` | YES | `true` | Acceptable for project size |
| `strictNullChecks` | YES (via strict) | `true` | Good |

`tsconfig.node.json` covers only `vite.config.ts` and is minimal — no `strict` flag. This is acceptable since it is a build-config file, not application code.

**Test exclusion**: `"exclude": ["src/__tests__/**/*"]` means test files are not type-checked. Combined with the missing blob objects this currently makes tsc entirely non-actionable, but structurally this exclusion means that type errors in test helpers and shared test utilities go undetected.

---

## Findings

### CRITICAL

#### C-1: `frontend/.eslintrc.js:7` — `jest: true` global masks real Vitest breakages
**What**: `env.jest: true` injects all Jest globals (`jest`, `describe`, `it`, `expect`, etc.) as valid identifiers in ESLint's scope. The project uses Vitest, not Jest. The roadmap documents explicitly confirm 20+ test files fail at runtime with "jest is not defined" — this is because tests call `jest.mock()`, `jest.fn()`, etc. which do not exist in a Vitest environment. By declaring the `jest` environment in ESLint, all such calls pass lint without error, hiding the bug.
**Why it is CRITICAL**: Tests that reference `jest.*` silently pass linting and then crash at test runtime. This is a root cause of the confirmed 20+ failing test files. Masking runtime failures inside test infrastructure means any coverage metric is unreliable.
**Fix**: Remove `jest: true` from `.eslintrc.js`. Add `globals: { vitest: true }` or use the `eslint-plugin-vitest` recommended config. Replace all `jest.fn()` with `vi.fn()`, `jest.mock()` with `vi.mock()`, etc. across the test suite.
**Effort**: Medium (2–4 days to audit and replace all 681 git-indexed files).
**[CONFIRMS]** FRONTEND_TESTING_ROADMAP.md "Priority 1: Fix Test Configuration" / STATE_MANAGEMENT_TEST_REPORT.md "Jest Configuration Issues (CRITICAL)".

---

### HIGH

#### H-1: `frontend/tsconfig.json` — missing `noUncheckedIndexedAccess`
**What**: Array element access (`arr[i]`) and index-signature access (`map[key]`) both return `T` instead of `T | undefined`. This is the single most common source of silent `undefined` dereferences that strict mode otherwise prevents.
**Why HIGH**: The store architecture (Zustand slices with array data — recipes, trips, participants, meals) and the data table components (`BaseDataTable`, `VirtualizedDataTable`) are the highest-risk consumers. Accessing `recipes[0].name` without a guard will produce a runtime crash on empty arrays that tsc would never flag.
**Fix**: Add `"noUncheckedIndexedAccess": true` to `tsconfig.json`. Expect 50–200 new type errors to triage; most are genuine safety gaps.
**Effort**: Medium (1–3 days to fix resulting errors).

#### H-2: `frontend/tsconfig.json` — missing `exactOptionalPropertyTypes`
**What**: Without this flag, `{ foo?: string }` accepts `{ foo: undefined }` as a valid assignment, which is semantically different and can cause downstream crashes when optional props are distinguished from explicitly `undefined` ones. The extensive prop-passing in the form system (`EnhancedFormField`, `CheckboxField`, `DateField`, etc.) and Radix UI wrapper components are the primary risk area.
**Why HIGH**: Subtle type corruption in prop passing that strict mode does not catch, leading to incorrect rendering or unhandled undefined branches in component logic.
**Fix**: Add `"exactOptionalPropertyTypes": true` to `tsconfig.json`.
**Effort**: Low-medium (0.5–1 day to fix resulting errors after enabling).

#### H-3: `frontend/.eslintrc.js:35` — `react-hooks/exhaustive-deps` downgraded to `warn`
**What**: The rule is set to `'warn'` instead of `'error'`. This means stale-closure bugs and missing dependency arrays in `useEffect`, `useCallback`, and `useMemo` pass CI without blocking a build. The documentation confirms this is actively causing test failures in `TripCalendarView` (2/27 tests passing) and component lifecycle issues more broadly.
**Why HIGH**: Stale closures in effects are a leading cause of subtle data-fetching races, stale UI state, and memory leaks. Downgrading to a warning means they are routinely ignored.
**Fix**: Change `'react-hooks/exhaustive-deps': 'warn'` to `'react-hooks/exhaustive-deps': 'error'` in `.eslintrc.js`. Fix all resulting violations before re-enabling.
**Effort**: Medium (depends on violation count across 681 files).

#### H-4: State management — dual context + store pattern without clear boundary
**What**: The architecture documentation (`FRONTEND_STATE.md`) confirms both a `context/` directory (AuthContext, ThemeContext) and a Zustand `store/slices/` directory (authStore, uiStore for theme). This is confirmed by the navigation analysis referencing both systems. Having authentication state in both `AuthContext` and `authStore` creates two sources of truth for the same data. The test fix session confirms this is causing component lifecycle issues and inconsistent test failures.
**Why HIGH**: Dual sources of truth for auth/theme state is a mutable shared state anti-pattern. It causes race conditions when one store updates but the other does not, and makes it impossible to guarantee consistency without understanding which system is authoritative.
**Fix**: Choose one system. Given the sophisticated Zustand middleware already built (circuit breaker, optimistic updates, cross-tab sync, encrypted persistence), the Context-based stores are redundant. Migrate AuthContext and ThemeContext consumers to the Zustand slices and remove the Context layer.
**Effort**: High (architectural change, ~3–5 days).
**[CONFIRMS]** FRONTEND_STATE.md "AuthProvider/Router hierarchy issue" + STATE_MANAGEMENT_TEST_REPORT.md "Cross-store state dependencies".

#### H-5: `vite.config.ts:382` — `setupFiles` references `'./src/setupTests.ts'` which does not exist on disk
**What**: Vitest's `setupFiles` points to `./src/setupTests.ts`. This file is not present in the working tree (confirmed by `find` showing zero source files). The git index references it but the blob is missing.
**Why HIGH**: Without a setup file, `@testing-library/jest-dom` matchers (`toBeInTheDocument`, etc.) are never registered, causing test failures at the assertion level rather than at the component level. This is a second root cause, alongside H-3/C-1, for the confirmed widespread test failures.
**Fix**: Restore `src/setupTests.ts` from version history (when git objects are recovered) or recreate it. Minimum content: `import '@testing-library/jest-dom'`.
**Effort**: Low once source files are accessible.
**[CONFIRMS]** FRONTEND_ISSUE_REGISTER.md "Multiple failing tests requiring immediate attention".

#### H-6: `package.json` — `"dependency": "^0.0.1"` in production dependencies
**What**: The `dependencies` list includes `"dependency": "^0.0.1"`, which is a placeholder npm package with no useful functionality. Its presence in production dependencies means it is bundled into the production build.
**Why HIGH**: This is almost certainly a copy-paste error or accidental inclusion. It adds a spurious dependency and may cause `npm audit` warnings. More importantly it indicates the dependencies list has not been reviewed, which raises the question of whether other unused or incorrect packages are present.
**Fix**: Remove `"dependency": "^0.0.1"` from `package.json` and run `npm install`.
**Effort**: Trivial (minutes).

#### H-7: `frontend/.env.local` and `frontend/.env.development` — committed environment files
**What**: Both `.env.local` and `.env.development` are committed to the git index (confirmed by `git ls-files`). Even though the current values are only localhost URLs, the Vite documentation explicitly states `.env.local` is intended to be gitignored because it contains machine-specific secrets. Future additions of real API keys or credentials to these files will be silently committed.
**Why HIGH**: Security — these files being tracked sets a precedent and provides a path for secret leakage. `.env.local` is in Vite's official gitignore template for a reason.
**Fix**: Add `.env.local` and `.env.development` to `.gitignore`. Keep `.env.example` with placeholder values as documentation. Remove the tracked files from the index with `git rm --cached`.
**Effort**: Trivial.

---

### MEDIUM

#### M-1: `vite.config.ts:163,165` — production `console.log` purge is incomplete
**What**: `terserOptions.compress.pure_funcs` only lists `['console.log', 'console.info']`. `console.warn`, `console.error`, `console.debug`, and `console.table` are not purged in production builds.
**Why MEDIUM**: Diagnostic and debug output remains in production bundles. A structured logger (e.g., pino-browser) should be used instead, with log levels controlled by environment.
**Fix**: Either extend `pure_funcs` to cover all `console.*` variants, or adopt a proper logging library and replace all console calls in source.
**Effort**: Low (config change is trivial; replacing calls in source is medium).

#### M-2: `vite.config.ts:296–299` — unused `facadeModuleId` variable in chunk naming
**What**: In `chunkFileNames`, `facadeModuleId` is computed and then not used — the return value always produces `assets/js/${chunkInfo.name}-[hash].js` regardless of the facade. The variable computation is dead code.
**Why MEDIUM**: Dead code in build configuration is a maintainability concern and misleads future readers into thinking the facade ID affects chunk naming.
**Fix**: Remove the `facadeModuleId` line.
**Effort**: Trivial.

#### M-3: `vite.config.ts:364` — `force: true` in `optimizeDeps` in development mode
**What**: `force: mode === 'development'` causes Vite to re-optimize all pre-bundled dependencies on every dev server start, even when they have not changed.
**Why MEDIUM**: This significantly increases cold-start time in development. The `force` flag is intended for debugging dep optimization issues, not for permanent enablement.
**Fix**: Remove `force: mode === 'development'` or gate it behind an explicit `FORCE_DEP_OPTIMIZATION=true` environment variable.
**Effort**: Trivial.

#### M-4: `package.json` — mixed UI library strategy (Radix UI + Headless UI + MUI + Tailwind CSS)
**What**: The `dependencies` list includes `@radix-ui/*` (13 packages), `@headlessui/react`, and `@mui/material` + `@mui/lab` simultaneously. These serve overlapping purposes (unstyled accessible primitives vs. fully styled Material components). The `@emotion/react` + `@emotion/styled` packages are MUI's CSS-in-JS runtime and conflict with the Tailwind-first approach documented in the component library spec.
**Why MEDIUM**: Bundle size inflation (Emotion + MUI adds ~150KB gzipped). Inconsistent styling paradigms (CSS-in-JS vs utility classes) make it hard to enforce design tokens consistently. The `__mocks__/@mui/lab.ts` file confirms MUI is being mocked in tests, suggesting it may be partially or incorrectly integrated.
**Fix**: Choose a single UI primitive layer. Given the Tailwind/Radix UI combination is already the primary design system (per the component library spec and Tailwind config), deprecate MUI. If MUI components are actually used, document which ones and why.
**Effort**: High if MUI is in active use; low if it is only a leftover dependency.

#### M-5: Test retry configuration `retry: 2` in `vite.config.ts:455`
**What**: Vitest is configured to retry flaky tests up to 2 times. This masks intermittent failures rather than fixing their root causes.
**Why MEDIUM**: Retries hide timing-sensitive bugs in effects, race conditions in async state updates, and test isolation problems. The test fix session confirms that many failures are caused by actual bugs (stale closures, mock resolution) that retrying will occasionally paper over.
**Fix**: Remove `retry: 2`. Fix underlying flakiness. Retries are acceptable only in E2E tests where external factors (network, browser timing) are genuinely non-deterministic.
**Effort**: Low (config change) + medium (fixing underlying flakiness).

#### M-6: `package.json` — `@google/gemini-cli` in production `dependencies`
**What**: `"@google/gemini-cli": "^0.1.9"` is listed under `dependencies`, not `devDependencies`. A CLI tool for interacting with Google Gemini has no place in a production web app bundle.
**Why MEDIUM**: This is either a mistake (should be in devDependencies or not at all) or indicates AI-generated code was incorporated without dependency hygiene. It contributes to bundle size and is confusing.
**Fix**: Move to `devDependencies` if it is used in development scripts; remove it if not used at all.
**Effort**: Trivial.

#### M-7: ESLint does not use `@typescript-eslint/recommended-type-checked` ruleset
**What**: `.eslintrc.js` extends `@typescript-eslint/recommended` rather than `@typescript-eslint/recommended-type-checked` (or `strict-type-checked`). The typed-aware rules require `parserOptions.project` to be set and enable rules like `no-floating-promises`, `no-misused-promises`, `await-thenable`, and `no-unsafe-*`. None of these are active.
**Why MEDIUM**: Async pattern mistakes (unhandled promises, `async forEach`) pass lint without detection. Given the Zustand store has async action creators and the API layer uses Axios with interceptors, unhandled promise rejections are a genuine risk.
**Fix**: Extend `@typescript-eslint/recommended-type-checked`. Add `parserOptions.project: ['./tsconfig.json']` to `.eslintrc.js`. Fix the resulting violations.
**Effort**: Medium (1–2 days for violations).

---

### LOW

#### L-1: `vite.config.ts` — source maps enabled in production (`sourcemap: true`)
**What**: When `mode !== 'development'`, `sourcemap` is set to `true` (full, not `'hidden'`). This uploads source maps to the CDN/server and makes original source code accessible to anyone who inspects network requests.
**Why LOW**: Minor security concern for proprietary code. For open source projects this is intentional.
**Fix**: Change to `sourcemap: 'hidden'` for production to retain stack-trace deobfuscation in error monitoring tools (Sentry, etc.) without exposing source to the public.
**Effort**: Trivial.

#### L-2: `tailwind.config.js` — no `safelist` for dynamically constructed class names
**Why LOW**: If any Zustand state or API response value is used to construct Tailwind class names (e.g., `text-${severity}-500`), those classes will be purged by Tailwind's content scanner. This is a medium risk given the extensive color system and the semantic color names (success, warning, error) used in notification components.
**Fix**: Audit dynamic class construction in error/notification components and add a `safelist` with appropriate patterns.
**Effort**: Low.

#### L-3: `vite.config.ts:395` — test `globals: true` without corresponding TypeScript globals declaration
**What**: `test.globals: true` makes Vitest's `describe`, `it`, `test`, `expect`, `vi` available without imports. However, the TypeScript compiler (which excludes `__tests__` via tsconfig) will not know about these globals, and editors may show type errors for them.
**Why LOW**: Developer experience issue rather than a runtime bug.
**Fix**: Add `"types": ["vitest/globals"]` to a test-specific `tsconfig.test.json` that includes the test files. Remove the `exclude` for `__tests__` from the main `tsconfig.json` so tests are type-checked, or create a separate tsconfig for tests.
**Effort**: Low.

#### L-4: `vite.config.ts:388` — `css: true` in Vitest config without CSS module identity-proxy setup
**What**: Enabling CSS processing in Vitest requires either CSS module mocking (identity-obj-proxy is listed in devDependencies but its setup is in the missing `setupTests.ts`) or actual CSS processing. Without the setup file (H-5), CSS module imports in components will return empty objects, causing tests that assert on className to silently pass with wrong values.
**Why LOW**: Test accuracy issue; does not cause crashes but produces false positives.
**Fix**: Ensure `setupTests.ts` includes the identity-obj-proxy configuration, or configure it in `vite.config.ts` directly.
**Effort**: Low.

---

## State Management Assessment

**Architecture**: Zustand with modular slices (auth, recipe, trip, ui, participant, ingredient, toast). Advanced middleware stack: persistence (localStorage/sessionStorage/IndexedDB with encryption), cache with TTL, optimistic updates, cross-tab sync, circuit breaker, SSR hydration. This is sophisticated and over-engineered relative to the current feature set but the patterns are correct.

**Primary concern (H-4 above)**: Dual-authority for auth and theme state between Context providers and Zustand slices. The `FRONTEND_STATE.md` confirms both `AuthContext.tsx` and `authStore` exist. The navigation analysis references both `AuthProvider` and route guards that presumably read from the store. Until this is resolved, any component that happens to read from the wrong source will display stale data.

**TanStack Query**: Listed as a dependency (`@tanstack/react-query: ^5.17.0`) but the store architecture described in documentation is entirely Zustand-based with custom API middleware for caching. It is unclear whether TanStack Query is actually used for server-state management or merely installed. If it is used alongside Zustand for server state, the boundary between cache-in-Zustand and TanStack Query cache needs to be explicitly defined. If it is not used, it should be removed (it is ~13KB gzipped).

**Immer integration**: `immer` is a listed dependency and the FRONTEND_STATE.md confirms it is used for Zustand middleware. Using Immer with Zustand's `immer` middleware is correct and idiomatic.

---

## Hook Discipline Issues

Source files are not readable but the following is inferred from documentation evidence:

1. **`react-hooks/exhaustive-deps` set to warn, not error (H-3)**: Confirmed stale closures causing `TripCalendarView` failures (2/27 tests passing). This is the most reliable indicator that hook discipline is poor across the codebase.

2. **`useTranslation` mock pattern in tests**: The test fix session shows `useTranslation: () => ({ t: (key: string) => key, i18n: {...} })`. This correctly intercepts i18next but the type signature of `t` is `(key: string) => key` — returning the key as-is. If any component passes non-string keys or uses `t` with interpolation objects, the mock will silently produce incorrect output in tests.

3. **Timer management**: STATE_MANAGEMENT_TEST_REPORT.md confirms that `jest.useFakeTimers()` is needed for toast auto-removal and token refresh tests. In Vitest the equivalent is `vi.useFakeTimers()`. Given the `jest`→`vi` migration issue (C-1), these timer tests are almost certainly broken.

4. **Effect cleanup**: The store architecture uses cross-tab synchronization via BroadcastChannel or storage events. Effects that subscribe to these channels must clean up on unmount. Without `noUncheckedIndexedAccess` and with exhaustive-deps as a warning, missing cleanup in these effects will cause memory leaks and cross-component state corruption.

---

## Open Questions

1. **Is TanStack Query (`@tanstack/react-query`) actually used?** The store architecture is documented as Zustand-only. If TanStack Query is unused, removing it simplifies the codebase and reduces bundle size.

2. **What is the intended authority for auth state?** `AuthContext` vs `authStore` — which one does `ProtectedRoute` read from? The router analysis confirms route guards exist but does not specify which store they consult.

3. **Are the Zod schemas in `src/schemas/` generated from or validated against the backend Pydantic models?** The documentation references a FastAPI backend with Pydantic validation. Without a code-generation step (e.g., `openapi-typescript-codegen`), the Zod schemas and Pydantic models will drift silently.

4. **Is the `src/api/mockAuth.ts` approach intentional long-term?** The `FRONTEND_STATE.md` documents a mock auth system that accepts any credentials. This is acceptable for development but the `VITE_USE_MOCK_AUTH` env var must be confirmed to be `false` in all non-development environments. The committed `.env.local` sets it to `false` but the `.env.development` also sets it to `false`, overriding what FRONTEND_STATE.md says should be `true` for development. This is a contradiction.

5. **What is the recovery plan for the corrupt git repository?** All 681 source files exist only in the git index with missing blob objects. Until the repository is recovered from a remote or backup, no TypeScript compilation, linting, or test execution is possible on the current machine state.
