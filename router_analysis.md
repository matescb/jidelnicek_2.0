# FastAPI Router Implementation Analysis

## Current Router Structure in main.py

### Authentication Routers
- **auth_router**: Imported from `jidelnicek.auth.routers`
  - Router prefix: `/api/v1/auth` (defined in auth.py)
  - Included with NO prefix in main.py
  - **Result**: Routes available at `/api/v1/auth/*`

- **monitoring_router**: Imported from `jidelnicek.auth.routers`
  - Router prefix: `/api/auth/monitoring` (defined in monitoring.py)
  - Included with NO prefix in main.py
  - **Result**: Routes available at `/api/auth/monitoring/*`

### Recipe Module Routers
- **categories_router**: 
  - Router prefix: `/categories` (defined in categories.py)
  - Included with prefix `/api/v1/recipes` in main.py
  - **Result**: Routes available at `/api/v1/recipes/categories/*`

- **tags_router**:
  - Router prefix: `/tags` (defined in tags.py)
  - Included with prefix `/api/v1/recipes` in main.py
  - **Result**: Routes available at `/api/v1/recipes/tags/*`

- **recipes_router**:
  - Router prefix: `/recipes` (defined in recipes.py)
  - Included with prefix `/api/v1` in main.py
  - **Result**: Routes available at `/api/v1/recipes/*`

- **search_router**:
  - Router prefix: `/search` (defined in search.py)
  - Included with prefix `/api/v1` in main.py
  - **Result**: Routes available at `/api/v1/search/*`

- **scaling_router**:
  - Router prefix: `/scaling` (defined in scaling.py)
  - Included with prefix `/api/v1` in main.py
  - **Result**: Routes available at `/api/v1/scaling/*`

### Trip Module Routers
- **trips_router**:
  - Router prefix: `/trips` (defined in trips.py)
  - Included with prefix `/api/v1` in main.py
  - **Result**: Routes available at `/api/v1/trips/*`

### Core Module Routers
- **jobs_router**:
  - Router prefix: `/api/v1/jobs` (defined in jobs.py)
  - Included with NO prefix in main.py
  - **Result**: Routes available at `/api/v1/jobs/*`

- **export_router**:
  - Router prefix: `/api/v1/exports` (defined in jobs.py)
  - Included with NO prefix in main.py
  - **Result**: Routes available at `/api/v1/exports/*`

- **progress_router**:
  - Router prefix: `/api/v1/progress` (defined in progress.py)
  - Included with NO prefix in main.py
  - **Result**: Routes available at `/api/v1/progress/*`

## Identified Issues

### 1. Double Prefixing
No double prefixing issues found. The routers are correctly configured:
- Routers that define `/api/v1/*` prefix are included without additional prefix
- Routers that define only resource prefix are included with `/api/v1` prefix

### 2. Inconsistent Prefix Patterns
- **auth_router**: Uses full `/api/v1/auth` prefix in router definition
- **monitoring_router**: Uses `/api/auth/monitoring` prefix (missing v1)
- **jobs_router**, **export_router**, **progress_router**: Use full `/api/v1/*` prefix in router definition
- **Recipe and Trip routers**: Use only resource prefix, rely on main.py for `/api/v1`

### 3. Monitoring Router Path Issue
The monitoring router is at `/api/auth/monitoring/*` instead of `/api/v1/auth/monitoring/*`

## OpenAPI Specification vs Implementation Comparison

| OpenAPI Expected Path | Implemented Path | Status | Notes |
|----------------------|------------------|--------|-------|
| `/api/v1/auth/register` | `/api/v1/auth/register` | ✅ Correct | |
| `/api/v1/auth/login` | `/api/v1/auth/login` | ✅ Correct | |
| `/api/v1/auth/refresh` | `/api/v1/auth/refresh` | ✅ Correct | |
| `/api/v1/auth/logout` | `/api/v1/auth/logout` | ✅ Correct | |
| `/api/v1/auth/verify-email` | `/api/v1/auth/verify-email` | ✅ Correct | |
| `/api/v1/auth/me` | `/api/v1/auth/me` | ✅ Correct | Additional endpoint |
| `/api/v1/auth/sessions` | `/api/v1/auth/sessions` | ✅ Correct | Additional endpoint |
| N/A | `/api/auth/monitoring/*` | ❌ Wrong | Missing v1 in path |
| `/api/v1/recipes/*` | `/api/v1/recipes/*` | ✅ Correct | |
| `/api/v1/recipes/categories/*` | `/api/v1/recipes/categories/*` | ✅ Correct | |
| `/api/v1/recipes/tags/*` | `/api/v1/recipes/tags/*` | ✅ Correct | |
| `/api/v1/trips/*` | `/api/v1/trips/*` | ✅ Correct | |
| `/api/v1/jobs/*` | `/api/v1/jobs/*` | ✅ Correct | Additional endpoints |
| `/api/v1/exports/*` | `/api/v1/exports/*` | ✅ Correct | Additional endpoints |
| `/api/v1/progress/*` | `/api/v1/progress/*` | ✅ Correct | Additional endpoints |

## Additional Implemented Endpoints Not in OpenAPI Spec

### Authentication
- `/api/v1/auth/captcha/challenge` - CAPTCHA support
- `/api/v1/auth/resend-verification` - Resend email verification
- `/api/v1/auth/forgot-password` - Password reset request
- `/api/v1/auth/reset-password` - Password reset confirmation
- `/api/v1/auth/sessions/{session_id}` - Session management
- `/api/v1/auth/sessions/active-count` - Session counting

### Monitoring (Currently at wrong path)
- `/api/auth/monitoring/rate-limit/status`
- `/api/auth/monitoring/rate-limit/violations`
- `/api/auth/monitoring/rate-limit/reset`
- `/api/auth/monitoring/suspicious-ip/clear`

### Jobs & Exports
- `/api/v1/jobs/` - Job management
- `/api/v1/jobs/{job_id}`
- `/api/v1/jobs/{job_id}/cancel`
- `/api/v1/jobs/{job_id}/retry`
- `/api/v1/jobs/statistics/summary`
- `/api/v1/jobs/export/shopping-list`
- `/api/v1/jobs/export/trip`
- `/api/v1/jobs/export/recipes`
- `/api/v1/exports/{export_id}/download`

### Progress Tracking
- `/api/v1/progress/ws` - WebSocket endpoint
- `/api/v1/progress/sse/{event_type}/{event_id}` - SSE endpoint
- `/api/v1/progress/export/{export_id}/sse`
- `/api/v1/progress/export/{export_id}`

## Recommendations

1. **Fix Monitoring Router Path**: Update the monitoring router prefix from `/api/auth/monitoring` to `/api/v1/auth/monitoring` for consistency.

2. **Standardize Router Prefix Pattern**: Consider adopting a consistent pattern:
   - Option A: All routers define full `/api/v1/*` paths (current pattern for auth, jobs, export, progress)
   - Option B: All routers define only resource paths and main.py adds `/api/v1` (current pattern for recipes, trips)

3. **Update OpenAPI Specification**: The implemented API has many additional endpoints not documented in the OpenAPI spec. These should be added to the specification.

4. **Consider Router Organization**: Group related routers together (e.g., all auth-related routers including monitoring could be in a single module).