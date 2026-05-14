# Security Review
**Date:** 2026-05-14
**Reviewer:** Security Reviewer Agent (claude-sonnet-4-6)
**Project:** Jidelnicek 2.0 — FastAPI backend + React/Vite frontend

---

## Scope

Files and artifacts examined:

- All `.env*` files committed or present on disk (`.env`, `.env.dev`, `.env.local`, `.env.example`, `.env.ci`, `.env.backup.20250710_035025`)
- `config/development.env`, `config/production.env`, `config/staging.env`
- `docker-compose.yml`, `docker-compose.dev.yml`, `docker-compose.dev-noauth.yml`
- `docker/nginx/nginx.conf`, `docker/nginx/nginx.dev.conf`
- `docker/Dockerfile`
- `alembic/versions/001_enhance_auth_schema.py` through `005_add_trip_day_snacks_table.py`
- `tests/conftest.py`
- `create_admin_user.py`, `generate_auth_token.py`, `test_csrf_debug.py`, `test_rate_limit_debug.py`, `test_sharing_implementation.py`
- `frontend/package.json`, `frontend/vite.config.ts`, `frontend/.eslintrc.js`
- `frontend/.env.development`, `frontend/.env.local`
- `pyproject.toml`, `poetry.lock`
- Prior security artifacts: `Documentation/security_gap_analysis_and_modification_plan.md`, `Documentation/jidelnicek_Security Threat Model.md`, `Documentation/jidelnicek_Data Validation Rules.md`
- `scripts/validate-config.py`, `scripts/seed_data.py`

**Important limitation:** The backend Python source files under `src/jidelnicek/` contain no `.py` source files — only empty `__pycache__` directory stubs. The application logic (routes, services, middleware, models, dependencies) cannot be directly reviewed. Findings therefore derive from: migration schemas, configuration files, test code, debug scripts, and documentation. The backend runtime behaviour must be validated separately once source files are accessible.

---

## TL;DR — Top 5 Risks

| # | Risk | Severity | Evidence |
|---|------|----------|----------|
| 1 | **Leaked JWT signing key in committed env files** | CRITICAL | `SECRET_KEY=u0gMPCF7mFpQ4tqMxFNUNmXVH2PK6xEN9D06Z7OCiPE` appears in `.env`, `.env.dev`, `.env.local`, and `.env.example` — the same real key across all four files |
| 2 | **Hardcoded admin password in source file** | CRITICAL | `create_admin_user.py:38` sets `admin_password = "admin123"` and logs it to stdout |
| 3 | **ACCESS_TOKEN_EXPIRE_MINUTES=1440 (24 hours) in default and dev env files** | HIGH | Overly long-lived access tokens mean a stolen JWT cannot be expired for a full day |
| 4 | **CORS wildcard `CORS_ALLOW_HEADERS=*` combined with `CORS_ALLOW_CREDENTIALS=true`** | HIGH | `.env.example` and `.env.local` pair credential-bearing CORS with wildcard allowed headers |
| 5 | **Overly permissive CSP in nginx: `unsafe-inline` and `unsafe-eval` directives on all responses** | HIGH | `nginx.conf:89` renders Content Security Policy ineffective against XSS |

---

## Status of Prior Gap-Analysis Findings

The following maps findings from `Documentation/security_gap_analysis_and_modification_plan.md` and `Documentation/jidelnicek_Security Threat Model.md` (both dated 2025-01-08) against the current codebase state.

| Prior Finding | Document | Status | Notes |
|---------------|----------|--------|-------|
| SQL injection: "Custom queries may bypass ORM" | Threat Model sec 3.2 | UNVERIFIABLE — source absent | Backend `.py` source unavailable; cannot confirm all queries use ORM. Schema uses SQLAlchemy UUID types, suggesting ORM usage, but raw SQL in services cannot be ruled out. |
| IDOR: "Authorization checks on all endpoints" | Gap Analysis sec 1.2.3 | UNVERIFIABLE — source absent | No route code available to audit ownership checks on `/trips/{id}`, `/recipes/{id}`, etc. |
| Rate limit bypass: "Distributed request handling, sliding window" | Gap Analysis sec 1.2.4 | PARTIALLY ADDRESSED | nginx.conf defines `limit_req_zone` for `login` (5r/m) and `api` (10r/s). Application-level rate limit via Redis middleware exists (see `test_rate_limit_debug.py`). Distributed/per-user+IP combination and CAPTCHA remain unimplemented per documentation. |
| XSS prevention: "Markdown rendering, image alt text" | Threat Model sec 3.2 | UNVERIFIABLE — source absent | Frontend source files absent. No `eslint-plugin-security` or DOMPurify found in `package.json`. |
| File upload security: "File type validation, content scanning" | Gap Analysis sec 2.4 | PARTIALLY ADDRESSED | `ALLOWED_UPLOAD_EXTENSIONS` env var exists; `SECURE_UPLOADS=true` flag present. Extension list includes `.gif`, `.pdf`, `.doc`, `.docx` — non-image types that should not be accepted for recipe images per the threat model. Magic-byte verification (python-magic) not confirmed in source. |
| Authorization matrix / granular permissions | Gap Analysis sec 2.2 | UNVERIFIABLE — source absent | `tests/conftest.py` shows `role="user"` and `role="admin"` in AuthUser model; no granular RBAC code visible. |
| Audit logging | Gap Analysis sec 2.5 | UNVERIFIABLE — source absent | No log model or audit table in any migration. The threat model explicitly deferred this for MVP. |
| CSRF protection | Threat Model sec 5.1 | IMPLEMENTED (config) | `CSRF_ENABLED=true` in all envs; middleware confirmed working via `test_csrf_debug.py`; token length=32 bytes. Cookie is `SameSite=lax` (not `strict`). |
| Bcrypt hashing | Threat Model sec 8 checklist | CONFIRMED | `BCRYPT_ROUNDS=12` in dev (rounds=14 in prod config). `passlib[bcrypt]` 1.7.4 in poetry.lock. `PasswordHasher` imported in conftest. |
| Password reset token lifetime not specified | Threat Model sec 3.1 | PARTIALLY ADDRESSED | Migration 001 creates `auth_password_reset_tokens` table with `expires_at` column. Value set by application code (source unavailable). |
| Session management | Threat Model sec 5.1 | PARTIALLY ADDRESSED | `auth_sessions` table has `is_valid` boolean (migration 001), `expires_at`, and device info (migration 002). `MAX_SESSIONS_PER_USER=5` configured. |
| Share link expiry / revocation | Data Validation Rules sec 5.2 | SCHEMA COMPLETE | Migration 003 creates `share_links` table with `expires_at` and DB-level `CHECK (expires_at > created_at)`. Revocation tested in `test_sharing_implementation.py` via `service.revoke_share_link()`. |
| Refresh token rotation | Threat Model sec 3.1 | STILL UNFIXED | `ROTATE_REFRESH_TOKENS=false` in `.env`, `.env.dev`, `.env.local`, `.env.example`. |
| Input validation — strict Pydantic models | Data Validation Rules | UNVERIFIABLE — source absent | Validation rules document is comprehensive. Cannot confirm models implement them. |
| Security headers in nginx | Gap Analysis sec 3.1 | PARTIALLY ADDRESSED — CSP too loose | X-Frame-Options, X-Content-Type-Options, X-XSS-Protection set. CSP uses `unsafe-inline` and `unsafe-eval` directives (see Finding H-03). HSTS not in nginx config (only in app env vars). |
| Dependency scanning | Gap Analysis sec 3.2 | NOT DONE | `python-jose` has known CVE-2024-33664 (algorithm confusion). No `pip-audit` or `npm audit` step visible in `.gitlab-ci.yml`. |
| Admin access / hardcoded admin check | Threat Model sec 4.6 | STILL UNFIXED | `create_admin_user.py` hardcodes `admin_password = "admin123"`. The threat model shows an email-based admin check pattern — migration shows a `role` column instead (better), but hardcoded admin password script remains. |
| Rate limiting on register/password-reset | Gap Analysis sec 2.3 | UNVERIFIABLE — source absent | `nginx.conf` defines `zone=login` but application-level register/password-reset rate limits require source code review. |
| Error message leaking user existence | Threat Model sec 3.4 | UNVERIFIABLE — source absent | Cannot confirm login endpoint returns generic error for non-existent users. |

---

## NEW Findings

### CRITICAL

#### C-01 — JWT Signing Key Committed to Repository in Multiple Env Files
- **Location:** `.env:6`, `.env.dev:6`, `.env.local:6`, `.env.example:10`
- **What:** `SECRET_KEY=u0gMPCF7mFpQ4tqMxFNUNmXVH2PK6xEN9D06Z7OCiPE` is the same real-looking base64 key in `.env`, `.env.dev`, `.env.local`. The `.env.example` file — which is explicitly meant to be committed as a template — contains this same value rather than a placeholder string.
- **Why:** If `.env`, `.env.dev`, or `.env.local` are committed (currently staged per `git status`), anyone with repo read access can forge any JWT for any user including admins. `.env.example` is committed and contains the real key.
- **Fix:** Rotate the key immediately. Replace `.env.example` value with `SECRET_KEY=CHANGE_ME_generate_with_python_secrets_token_urlsafe_32`. Ensure `.env`, `.env.dev`, `.env.local` are in `.gitignore` — currently `.gitignore` has `.env.*` but note `.env` itself may still be tracked. Run `git rm --cached .env .env.dev .env.local` to untrack them.
- **CVSS-ish:** 9.8 (AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H)
- **Effort:** Low (key rotation + env cleanup)

#### C-02 — Hardcoded Admin Password "admin123" in Committed Script
- **Location:** `create_admin_user.py:38`
- **What:** `admin_password = "admin123"` followed by `logger.info(f"   Password: {admin_password}")` — the password is both hardcoded and printed to logs.
- **Why:** Anyone running this script in any environment creates an admin account with a trivially guessable password. The comment `# Change this in production!` does not constitute a security control.
- **Fix:** Remove the hardcoded password. Accept it as a CLI argument or generate a random password with `secrets.token_urlsafe(16)` and print the generated value once at creation time.
- **CVSS-ish:** 9.1 (AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:N)
- **Effort:** Low

### HIGH

#### H-01 — 24-Hour Access Token Lifetime in Default Configuration
- **Location:** `.env:9`, `.env.dev:9`, `.env.local:9`
- **What:** `ACCESS_TOKEN_EXPIRE_MINUTES=1440` (24 hours). The production env file overrides to 15 minutes, but the default files that are actually present and potentially used are all set to 24 hours.
- **Why:** A stolen access token is valid for 24 hours with no revocation mechanism aside from the `is_valid` flag in `auth_sessions`. If the implementation validates JWTs purely from the token payload without a DB lookup, stolen tokens cannot be invalidated before expiry.
- **Fix:** Set `ACCESS_TOKEN_EXPIRE_MINUTES=15` as the default. Confirm the backend validates session `is_valid` on every request.
- **Effort:** Low (config change) — Medium if DB lookup must be added to token validation path.

#### H-02 — CORS: `credentials: true` with Wildcard `CORS_ALLOW_HEADERS=*`
- **Location:** `.env.example:34-36`, `.env.local:33-34`
- **What:** `CORS_ALLOW_CREDENTIALS=true` is paired with `CORS_ALLOW_HEADERS=*` (or `["*"]`).
- **Why:** The Fetch spec prohibits returning `Access-Control-Allow-Origin: *` with `Access-Control-Allow-Credentials: true`, but a server misconfigured to echo the request Origin combined with wildcard headers allows cross-site requests to carry cookies and auth headers. This enables CSRF-bypass attacks.
- **Fix:** Enumerate required headers explicitly: `CORS_ALLOW_HEADERS=Content-Type,Authorization,X-CSRF-Token`. Do not use `*` when credentials are enabled.
- **CVSS-ish:** 8.1 (AV:N/AC:L/PR:N/UI:R/S:U/C:H/I:H/A:N)
- **Effort:** Low

#### H-03 — CSP Allows Inline Scripts and Dynamic Code Execution on All Responses
- **Location:** `docker/nginx/nginx.conf:89`
- **What:** `Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline' 'unsafe-eval'; frame-ancestors 'self';"` — applied globally to all nginx responses.
- **Why:** The `unsafe-inline` directive permits injected `<script>` tags and inline event handlers. The `unsafe-eval` directive permits `Function()` constructor and `setTimeout(string)` patterns. Together they make the CSP entirely ineffective against XSS. Additionally `http:` in `default-src` permits loading content over insecure HTTP.
- **Fix:** Switch to nonce-based CSP. At minimum remove `unsafe-eval` and `http:`. Use `strict-dynamic` with a per-request nonce for scripts. Move `data:` and `blob:` only to `img-src`.
- **CVSS-ish:** 7.5 (enables full XSS exploitation)
- **Effort:** Medium (requires CSP audit of frontend code to identify which inline patterns need migrating)

#### H-04 — Refresh Token Rotation Disabled Across All Environments
- **Location:** `.env:12`, `.env.dev:12`, `.env.local:12`, `.env.example:14`
- **What:** `ROTATE_REFRESH_TOKENS=false` in every env file including production template.
- **Why:** Without refresh token rotation, a stolen refresh token remains valid indefinitely (7–30 days per config). Rotation ensures a stolen token is detected when the original owner tries to refresh, because the old token will have already been rotated and invalidated.
- **Fix:** Set `ROTATE_REFRESH_TOKENS=true`. This is a low-risk change with high security benefit.
- **CVSS-ish:** 7.3 (extended session persistence after credential theft)
- **Effort:** Low (if backend rotation code path exists; requires source confirmation)

#### H-05 — Upload Extension Allowlist Includes Non-Image Types
- **Location:** `.env:68`, `.env.local:70`, `.env.example:75`
- **What:** `ALLOWED_UPLOAD_EXTENSIONS=.jpg,.jpeg,.png,.gif,.pdf,.doc,.docx` — recipe image uploads permit PDF, Word documents, and GIF files.
- **Why:** The threat model and data validation document both specify only JPEG, PNG, WebP as valid recipe image types. Accepting `.pdf`, `.doc`, `.docx` creates multiple risks: these are common malware delivery vectors; they will not be processed through the image pipeline (Pillow re-encode), so EXIF stripping and dimension checks may not apply; animated GIF processing can trigger image-library vulnerabilities.
- **Fix:** Restrict to `.jpg,.jpeg,.png,.webp` only in all environments.
- **Effort:** Low

#### H-06 — DB and Redis Ports Exposed to Host in Production docker-compose.yml
- **Location:** `docker-compose.yml:15-20`, `docker-compose.yml:37-42`
- **What:** The production `docker-compose.yml` maps `${DB_PORT:-5432}:5432` and `${REDIS_PORT:-6379}:6379` to the host network.
- **Why:** PostgreSQL and Redis should only be accessible within the `backend` Docker network. Exposing them to the host means that if deployed on a VPS with an open firewall, both services are directly accessible from the internet. Redis in `.env.dev` has `REDIS_PASSWORD=` (empty), making it an unauthenticated Redis endpoint.
- **Fix:** Remove the `ports:` mappings for `db` and `redis` from the production compose file. Use a dev-only compose override for local database access.
- **CVSS-ish:** 8.1 for Redis without password; 7.5 for PostgreSQL with weak password
- **Effort:** Low

#### H-07 — python-jose Dependency Has Known Algorithm Confusion CVE
- **Location:** `pyproject.toml` — resolved to `python-jose==3.5.0` in `poetry.lock`
- **What:** `python-jose` carries CVE-2024-33664 (algorithm confusion: a JWT signed with an RS/EC key can be verified using HMAC if `alg` is not strictly validated) and CVE-2024-33663 (DoS via malformed JWT). This is the latest available version; the vulnerabilities are unfixed upstream.
- **Why:** If the application does not explicitly restrict accepted algorithms (passing only `algorithms=["HS256"]` and rejecting `none` and all RS*/ES* variants), CVE-2024-33664 allows forging tokens that pass signature verification.
- **Fix:** Migrate to `PyJWT >= 2.4.0`, which has explicit algorithm enforcement built in. In the interim, ensure the token verification call passes `algorithms=["HS256"]` explicitly. Cannot confirm current implementation without source code.
- **CVSS-ish:** 8.1 (critical if algorithm none or RS/EC confusion is exploitable)
- **Effort:** Medium (library migration)

### MEDIUM

#### M-01 — `SESSION_COOKIE_SAMESITE=lax` (Not `strict`) in Default Config
- **Location:** `.env:84`, `.env.dev:84`, `.env.local:85`; production config correctly sets `strict`
- **What:** The default and development env files use `SameSite=lax`. Production correctly uses `strict`, but `.env.example` (template for new setups) has `lax`.
- **Why:** `SameSite=lax` permits cookies to be sent on top-level GET navigations from cross-origin links, weakening CSRF protection.
- **Fix:** Set `SameSite=strict` as the default in `.env.example`.
- **Effort:** Trivial

#### M-02 — `SESSION_COOKIE_SECURE=false` in Multiple Env Files
- **Location:** `.env:83`, `.env.dev:83`, `.env.local:84`
- **What:** Cookies without the `Secure` flag can be transmitted over plain HTTP.
- **Why:** Even if HTTPS is enforced by nginx, a non-`Secure` cookie can leak if any HTTP page is accessible or if a network attacker performs SSL stripping.
- **Fix:** Set `SESSION_COOKIE_SECURE=true` even in development. Use mkcert or a self-signed cert for local HTTPS.
- **Effort:** Low

#### M-03 — `PASSWORD_MIN_LENGTH=8` in Active `.env` and `.env.dev`
- **Location:** `.env:48`, `.env.dev:48`
- **What:** Active development env files set minimum password length to 8. Data validation document and `config/production.env` specify 10–12.
- **Why:** The `.env` file is potentially used as the default when no env-specific file is loaded. An 8-character minimum is below NIST SP 800-63B recommendations.
- **Fix:** Set `PASSWORD_MIN_LENGTH=12` consistently.
- **Effort:** Trivial

#### M-04 — No `eslint-plugin-security` in Frontend ESLint Config
- **Location:** `frontend/.eslintrc.js`, `frontend/package.json`
- **What:** The frontend uses `eslint:recommended`, `plugin:react/recommended`, and `@typescript-eslint/recommended` but no security-specific plugin.
- **Why:** Security issues such as `innerHTML` assignment, `Function()` constructor usage, and regex denial-of-service patterns are not automatically flagged during development.
- **Fix:** Add `eslint-plugin-security` and `eslint-plugin-no-unsanitized` to `devDependencies` and extend the ESLint config.
- **Effort:** Low

#### M-05 — Fake Sentry DSN Committed in CI Config and Test File
- **Location:** `.env.ci:53` (`SENTRY_DSN=https://test@sentry.io/123456`), `tests/conftest.py:28`
- **What:** A Sentry DSN in the format `https://<key>@sentry.io/<project>` is committed. While this appears synthetic, Sentry DSNs in this format are real credentials that can be used to submit events.
- **Why:** If this was ever a real DSN (or is accidentally a valid one), it can be used to inject false error data into a Sentry project. The project ID `123456` is very low and could correspond to an early Sentry project.
- **Fix:** Replace with clearly invalid value `https://invalid@example.invalid/0` or use a Sentry test project DSN that is confirmed non-functional.
- **Effort:** Trivial

#### M-06 — Missing Audit Column for Share Link Revocation
- **Location:** `alembic/versions/003_add_share_links_table.py`
- **What:** The `share_links` table has `expires_at` and a unique `share_token`, but no `revoked_at` timestamp or `is_active` boolean column.
- **Why:** Revocation in `SharingService` (tested in `test_sharing_implementation.py` via `service.revoke_share_link()`) must be implemented at the application layer via row deletion — the schema does not enforce it. Row deletion leaves no audit trail of what was shared and when it was revoked.
- **Fix:** Add `revoked_at TIMESTAMPTZ NULL` to `share_links`. Revocation sets this column rather than deleting the row. Queries for valid share links check `revoked_at IS NULL AND expires_at > now()`.
- **Effort:** Low (one migration)

#### M-07 — `MAX_UPLOAD_SIZE=10485760` (10 MB) in `.env` Exceeds Documented 5 MB Limit
- **Location:** `.env:67`, `.env.local:70`
- **What:** The active `.env` file sets `MAX_UPLOAD_SIZE` to 10 MB while the nginx config, production env, and data validation document all specify 5 MB.
- **Why:** nginx `client_max_body_size 5M` wins at the proxy layer, but if the service is deployed without nginx (direct uvicorn), 10 MB uploads reach the application.
- **Fix:** Align to `MAX_UPLOAD_SIZE=5242880` (5 MB) across all non-production env files.
- **Effort:** Trivial

#### M-08 — pgAdmin Password Hardcoded in docker-compose.dev.yml
- **Location:** `docker-compose.dev.yml:109`
- **What:** `PGADMIN_DEFAULT_PASSWORD: pgadmin_dev_2024` and `PGADMIN_CONFIG_MASTER_PASSWORD_REQUIRED: "False"` are hardcoded in a committed file.
- **Why:** `SERVER_MODE=False` combined with no master password means anyone who reaches port 5050 (exposed on `0.0.0.0:5050`) has full DB management access. The password is now publicly visible in the repository.
- **Fix:** Move the pgAdmin password to `.env.dev` which is gitignored.
- **Effort:** Low

### LOW

#### L-01 — Inline Comments in `config/development.env` May Break Value Parsing
- **Location:** `config/development.env:29` (`DB_HOST=db  # Docker service name`)
- **What:** Several values include inline `# comment` on the same line. Depending on the env parser, the comment text may be included in the value.
- **Why:** `DB_HOST=db  # Docker service name` would result in `DB_HOST` being `"db  # Docker service name"` unless the parser explicitly strips inline comments. `python-dotenv` does handle this in most modes, but it is fragile.
- **Fix:** Move comments to their own lines preceding the key.
- **Effort:** Trivial

#### L-02 — No `Cache-Control: no-store` for API Responses at nginx Level
- **Location:** `docker/nginx/nginx.conf`
- **What:** No `Cache-Control: no-store` header is applied to API location blocks.
- **Why:** Sensitive API responses (user data, nutrition info, trip plans) could be cached by intermediate caches or the browser.
- **Fix:** Add `add_header Cache-Control "no-store, no-cache" always;` in API location blocks.
- **Effort:** Low

#### L-03 — `REFRESH_TOKEN_EXPIRE_DAYS=30` in Production Config Exceeds Threat Model Specification
- **Location:** `config/production.env:18`
- **What:** Production refresh tokens live for 30 days. The threat model specifies 7 days.
- **Why:** Combined with `ROTATE_REFRESH_TOKENS=false` (H-04), a stolen refresh token can be used for up to 30 days.
- **Fix:** Set `REFRESH_TOKEN_EXPIRE_DAYS=7` in production.
- **Effort:** Trivial

#### L-04 — nginx `conf.d/` Directory Empty — Rate Limit Zones Defined but Never Applied
- **Location:** `docker/nginx/nginx.conf:101-103`, `docker/nginx/conf.d/` (empty)
- **What:** `nginx.conf` defines `limit_req_zone` zones for `login` (5r/m), `api` (10r/s), `upload` (2r/s), and `general` (20r/s), but `conf.d/` contains no virtual host configuration files. Without `location` blocks that reference `limit_req zone=login`, the rate limits are defined but never enforced.
- **Why:** This means the `/api/v1/auth/login` endpoint may have no nginx-level rate limiting applied in the current deployment configuration.
- **Fix:** Add or restore the server block and location configuration to `conf.d/`. Example:
  ```
  location /api/v1/auth/login {
      limit_req zone=login burst=5 nodelay;
      proxy_pass http://app:8000;
  }
  ```
- **Effort:** Low

---

## Auth Flow Assessment

**Confirmed from migrations, configs, and test fixtures:**

- Password hashing: `passlib[bcrypt]` with rounds=12 (dev) / 14 (prod). Correct and appropriate.
- Account lockout schema exists: `failed_login_attempts INTEGER` and `locked_until TIMESTAMPTZ` columns in `auth_users` (migration 001). `MAX_LOGIN_ATTEMPTS=5`, `LOCKOUT_DURATION_MINUTES=15`.
- Session table (`auth_sessions`) has `token_hash`, `is_valid`, `expires_at`, device info, and a composite index on `(user_id, is_valid, expires_at)`.
- Password reset uses a separate `auth_password_reset_tokens` table with `expires_at`, `used_at`, and `request_ip`/`used_ip`. This is a correct design — separate table prevents token enumeration from the user table.
- Email verification uses a separate `auth_email_verification_tokens` table.
- CSRF middleware is operational (confirmed in `test_csrf_debug.py`).
- Application-level rate limiting via Redis sliding window exists (confirmed in `test_rate_limit_debug.py`).

**Unverified (source absent):**

- Whether the login endpoint returns a generic "invalid credentials" message for both wrong password AND non-existent email (login enumeration risk).
- Whether `is_valid=false` on the session row is actually checked during JWT validation. If JWTs are validated purely from the token payload (stateless), `logout` does not actually invalidate the token until expiry.
- Whether `algorithm` is restricted to `["HS256"]` in `python-jose` decode call (primary mitigation for CVE-2024-33664).
- Whether access tokens are stored in an httpOnly cookie or in `localStorage` on the frontend. The dev env sets `SESSION_COOKIE_HTTPONLY=true` but it is unknown whether access tokens specifically use this mechanism. If tokens are in `localStorage`, any XSS immediately escalates to full session takeover.
- Password reset token entropy — the column is `String(255)` but the generation function is in the absent source code.

---

## Authz / IDOR Assessment per Module

Backend source code is absent; this section is based on schema, test fixtures, and documentation.

| Module | Schema-level controls | Application-level controls | Assessment |
|--------|----------------------|---------------------------|------------|
| Recipes (`recipe_recipes`) | `user_id FK to auth_users`, UUID PK | UNVERIFIABLE | UUIDs resist sequential enumeration. Ownership check must be confirmed in router code. |
| Trips (`trip_days`, `trip_day_snacks`) | FK chain from `trip_day_snacks` to `trip_days` to `trips` to `user_id` | UNVERIFIABLE | Correct FK cascade design (migration 005). Route guards unknown. |
| Share links | `user_id FK`, `entity_type` check constraint, unique `share_token`, `expires_at` | Revocation via service confirmed | Schema correctly ties shares to owning user. No `revoked_at` column (see M-06). Rate limiting on share link access unknown. |
| Marketplace ratings/reviews | `UniqueConstraint('recipe_id', 'user_id')` prevents duplicate ratings at DB level | UNVERIFIABLE | DB-level one-rating-per-user enforcement is correct. Whether review update is restricted to the review's author is unknown. |
| Admin routes | Role `"admin"` in `auth_users.role` column | UNVERIFIABLE | Migration shows a `role` column — this is better than the email-based approach documented in the threat model. Whether all admin routes require `role=="admin"` is unverifiable. |
| Password reset tokens | Separate table with FK to user, `expires_at`, `used_at`, unique `token` | UNVERIFIABLE | Schema is correct. Application must check `used_at IS NULL` on redemption to prevent token reuse. |

**Specific IDOR risk flagged in prior documents:** Without seeing the route handlers, there is no confirmation that `GET /api/v1/trips/{id}` verifies `trip.user_id == current_user.id` before returning data. This was flagged as CRITICAL in the gap analysis (2025-01-08) and remains unverifiable today.

---

## Secrets Scan Results

| Secret / Sensitive Value | Location | Classification | Action Required |
|--------------------------|----------|---------------|----------------|
| `SECRET_KEY=u0gMPCF7mFpQ4tqMxFNUNmXVH2PK6xEN9D06Z7OCiPE` | `.env`, `.env.dev`, `.env.local`, `.env.example` | CRITICAL — real JWT signing key | Rotate immediately; use unique key per environment; never put real value in `.env.example` |
| `DB_PASSWORD=jidelnicek_dev_2024` | `.env`, `.env.dev`, `.env.local`, `.env.example` | MEDIUM — dev credential committed | Acceptable for dev if not used in prod; confirm gitignored |
| `REDIS_PASSWORD=redis_dev_password_2024` | `.env.local` | LOW — dev credential | Acceptable for dev |
| `admin_password = "admin123"` | `create_admin_user.py:38` | CRITICAL — hardcoded admin password in source | Remove from source code |
| `PGADMIN_DEFAULT_PASSWORD: pgadmin_dev_2024` | `docker-compose.dev.yml:109` | LOW — dev tool password | Move to gitignored env file |
| `SENTRY_DSN=https://test@sentry.io/123456` | `.env.ci`, `tests/conftest.py` | MEDIUM — Sentry DSN format | Verify it is not a real project DSN; rotate if ever was real |
| `postgresql+asyncpg://jidelnicek:testpassword@localhost:5433/jidelnicek_test` | `tests/conftest.py:41` | LOW — test credential, localhost only | Acceptable; note port 5433 confirms test isolation |
| `postgresql://jidelnicek:jidelnicek@localhost/jidelnicek_test` | `test_sharing_implementation.py:80` | LOW — weak test credential | Acceptable for local test only |

**Git staging concern:** `git status` shows `.env`, `.env.dev`, `.env.local` as staged files (`A` prefix). If committed in their current state, the JWT signing key and DB password will enter the git history permanently. Run `git rm --cached .env .env.dev .env.local` before the next commit.

---

## Open Questions

1. **Source code access:** The `src/jidelnicek/` directory contains no Python source files. Are they stored in a separate private repository, generated at build time, or accidentally absent? This review cannot be considered complete without examining: `auth/routers/`, `auth/services/token_service.py`, `auth/utils/password.py`, `core/middleware/security.py`, `trip/`, and `recipe/` router/service files.

2. **JWT algorithm restriction:** Does the `python-jose` `decode()` call pass `algorithms=["HS256"]` explicitly? This is the primary mitigation for CVE-2024-33664.

3. **Token storage frontend:** Are access tokens stored in httpOnly cookies or in `localStorage`? The Zustand state store and React Query setup in the frontend's build config suggests client-side state. If tokens are in `localStorage`, any XSS vulnerability immediately escalates to full session takeover.

4. **Login enumeration:** Does the login endpoint return the same error message for wrong password and non-existent user email?

5. **IDOR ownership checks pattern:** Are ownership checks implemented as reusable middleware/dependencies or inline in every route handler? Inline checks are fragile and easily missed when adding new endpoints.

6. **Share token generation entropy:** `share_token` is `String(255)` — what is the actual generation function? `secrets.token_urlsafe(32)` provides 256 bits of entropy (adequate). `uuid4()` provides 122 bits (adequate but non-standard for tokens). A shorter random string would be insufficient.

7. **nginx `conf.d/` virtual host configuration:** The `conf.d/` directory is empty. Without server block and location configuration, neither the rate limit zones nor security headers are applied to any actual requests. Where is this configuration?

8. **Payment gateway:** `config/production.env` enables `PAYMENT_GATEWAY_ENABLED=true`. A financial security review is required for any payment-related code before production deployment. This was outside the scope of the current review.

9. **`ROTATE_REFRESH_TOKENS=false` implementation status:** Is the rotation code path implemented in the backend and merely disabled by this flag, or does the feature not exist yet? The answer determines whether enabling it is a config change or a feature implementation.
