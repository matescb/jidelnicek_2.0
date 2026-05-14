# Flow Traces

## Scope

Four flows traced from the FastAPI backend in `src/jidelnicek/`.  
Source was read from the git-tracked zip archive (`Jidelnicek_2.0.zip`) because the working tree
contains no `.py` files — only `__pycache__` directories; the git object store is empty (no blobs).
All file paths below are relative to `src/jidelnicek/`.

Flows selected: Login → token issuance → token refresh (Flow 1), Recipe create → share
(Flow 2), Trip planning — stove / days / reorder (Flow 3), Shopping list generation → PDF
export (Flow 4).  Marketplace browse + trending is treated as a sub-section of Flow 5.

---

## Flow 1: Login → Token Issuance → Token Refresh

**Entry points**
- `POST /api/v1/auth/login` — `auth/routers/auth.py:214`
- `POST /api/v1/auth/refresh` — `auth/routers/auth.py:1239`

### Layer hops — login

```
POST /api/v1/auth/login
  → auth/routers/auth.py :: login()
      RateLimitDep(key_prefix="login_ip", max_attempts=5, window_hours=1)  [Redis incr]
      UserService.get_user_by_email()      → SELECT auth_users WHERE email = $1
      CaptchaService.should_require_captcha()  → Redis GET "captcha_failed:login:{ip}"
      RateLimitDep(key_prefix="login_account", …) [Redis incr per email]
      CaptchaService.verify_response()     → Redis GET challenge key  (conditional)
      PasswordHasher.verify_password()     → bcrypt.checkpw  (CPU-bound, no I/O)
      UserService.increment_failed_login_attempts()  → UPDATE auth_users
          OR
      UserService.reset_failed_login_attempts()      → UPDATE auth_users
      TokenService.check_session_limit()   → SELECT COUNT(*) FROM auth_sessions
      TokenService.revoke_oldest_session() → SELECT + UPDATE auth_sessions  (conditional)
      TokenService.generate_access_token() → jwt.encode  (in-process)
      TokenService.generate_refresh_token() → jwt.encode  (in-process)
      TokenService.create_session()        → INSERT auth_sessions
      UserService.update_last_login()      → UPDATE auth_users
      db.add(AuditLog) + db.commit()       → INSERT audit_logs
      EmailService.send_verification_email() — NOT called on login, only on registration
```

### DB queries triggered (login success path)
1. SELECT auth_users WHERE lower(email) = lower($1)
2. UPDATE auth_users SET failed_login_attempts = 0 … WHERE id = $1
3. SELECT COUNT(*) FROM auth_sessions WHERE user_id=$1 AND is_valid=true AND expires_at>now()
4. SELECT auth_sessions … ORDER BY created_at ASC LIMIT 1  (only if session limit hit)
5. UPDATE auth_sessions SET is_valid=false WHERE id=$1  (conditional)
6. INSERT INTO auth_sessions (user_id, token_hash, …)
7. UPDATE auth_users SET last_login_at = now() WHERE id=$1
8. INSERT INTO audit_logs (…)

### External calls
- Redis: rate-limit counters (`login_ip:{ip}`, `login_account:{email}`), CAPTCHA state
- SMTP / aiosmtplib: NOT called on login (called on register via BackgroundTasks)

### Auth / authz
- IP-level rate-limit via `RateLimitDep` dependency (Redis)
- Per-account rate-limit re-instantiated inline at runtime — **not a FastAPI dependency**,
  called with `await account_rate_limiter(request, redis_client)` — if Redis is unavailable
  this raises an uncaught exception instead of degrading gracefully
- No `require_email_verified` guard on login — users can log in without verifying email

### Layer hops — token refresh

```
POST /api/v1/auth/refresh
  → auth/routers/auth.py :: refresh_token()
      TokenService.validate_session(refresh_token)
          → jwt.decode  (in-process, verifies signature + type)
          → hashlib.sha256(token)  (in-process)
          → SELECT auth_sessions WHERE token_hash=$1 AND is_valid=true
              selectinload(AuthSession.user)
          → Redis GET "blacklist:token:{hash}"  (conditional, if redis available)
          → UPDATE auth_sessions SET last_accessed=now()
      check user.is_active / user.is_locked
      TokenService.generate_access_token()
      [If rotate_refresh_tokens=True]:
          TokenService.revoke_session()     → UPDATE auth_sessions SET is_valid=false
          TokenService.create_session()     → INSERT auth_sessions
      db.add(AuditLog) + db.commit()
```

### DB queries triggered (refresh)
1. SELECT auth_sessions JOIN auth_users WHERE token_hash=$1 AND is_valid=true
2. UPDATE auth_sessions SET last_accessed=now() WHERE id=$1
3. UPDATE auth_sessions SET is_valid=false  (conditional, rotation)
4. INSERT INTO auth_sessions  (conditional, rotation)
5. INSERT INTO audit_logs

### Error paths
- Invalid/expired JWT: `TokenExpiredError` / `TokenInvalidError` → 401
- Session not found or blacklisted: `SessionInvalidError` → 401
- Inactive/locked user: 403
- Unhandled exception: `db.rollback()` then 500

### Observability
- `logger.info` on success / `logger.error` on exception — stdlib logging only
- No structured fields beyond f-string interpolation
- No spans/metrics/tracing hooks
- Request-ID added by `add_request_id` middleware and surfaced in response headers

### Hidden coupling
- `AuditLog` imported inside function body at runtime (`from jidelnicek.auth.models import AuditLog`) —
  repeated in every login/logout/refresh handler. Import failures are silent until request time.
- `PasswordHasher` also imported inside login handler body.
- Refresh endpoint creates a new session object but the old session is revoked **before** the new
  one is committed — a crash between the two writes leaves the user logged out with no valid session.
  No transaction wrapping the rotate-revoke-create sequence.

---

## Flow 2: Recipe Create → Recipe Share

**Entry points**
- `POST /api/v1/recipes/` — `recipe/routers/recipes.py:740`
- `POST /api/v1/share/recipe/{recipeId}` — `core/routers/sharing.py:42`
- `GET /api/v1/share/{shareToken}` — `core/routers/sharing.py:124`

### Layer hops — recipe create

```
POST /api/v1/recipes/
  → recipe/routers/recipes.py :: create_recipe()
      PermissionValidator('recipes:create')  [dependency, checks user role]
      validate_recipe_data_consistency()     [in-process pydantic validation]
      db.add(Recipe) + db.flush()            → INSERT recipes
      [for each ingredient]:
          SELECT ingredients WHERE id=$1
          db.execute(sql_text("INSERT INTO recipe_recipe_ingredients …"))  ← raw SQL
      validate_recipe_nutrition()            [in-process, no DB]
      [for each image]:
          db.add(RecipeImage)
      db.commit()
      db.refresh(recipe)
      return RecipeResponse(ingredients=[], images=[])  ← always empty lists!
```

### DB queries triggered (recipe create)
1. SELECT ingredients WHERE id=$1  (N queries, one per ingredient — N+1 pattern)
2. INSERT INTO recipes (…)
3. N × INSERT INTO recipe_recipe_ingredients via raw sql_text
4. M × INSERT INTO recipe_images (if images provided)

### Recipe share flow

```
POST /api/v1/share/recipe/{recipeId}
  → core/routers/sharing.py :: create_recipe_share_link()
      get_current_user  [JWT + SELECT auth_users]
      SharingService.create_share_link(EntityType.RECIPE, …)
          SELECT recipes WHERE id=$1 AND user_id=$2 AND is_archived=false
          secrets.token_urlsafe(32)
          SELECT share_links WHERE share_token=$1  [collision check, almost always empty]
          INSERT INTO share_links (entity_type, entity_id, user_id, share_token, expires_at)
          db.commit() + db.refresh()
      return ShareResponse(share_token, share_url, expires_at)
```

### DB queries triggered (recipe share)
1. SELECT auth_users WHERE id=$1  (via get_current_user)
2. SELECT recipes WHERE id=$1 AND user_id=$2 AND is_archived=false
3. SELECT share_links WHERE share_token=$1  (collision check)
4. INSERT INTO share_links

### Auth / authz
- Recipe create: requires valid JWT + `PermissionValidator('recipes:create')`.
  `PermissionValidator` is instantiated as a module-level singleton
  (`recipe_permission_validator = PermissionValidator('recipes:create')`).
  On login it checks `user.role` permissions — but the actual permission matrix
  is not visible in the recipe router; it delegates to `core/validation/validation.py`.
- Recipe share: requires valid JWT; ownership verified by `user_id=$2` in the query.
  No RBAC beyond ownership check.

### Error paths
- Ingredient not found: 400 + rollback
- Pydantic validation failure: 422
- Share: recipe not found/not owned → ValueError → 404

### Observability
- `logger.warning` for nutrition validation failures; `logger.error` for exceptions
- No version tracking triggered by `create_recipe` — `RecipeVersionService` is present
  in the file but `create_recipe` does NOT call it; versioning is only on updates
- `increment_view_count_sync` is a stub: it only logs a message and does not write to DB

### Hidden coupling
- `create_recipe` uses `sql_text(…)` raw INSERT for `recipe_recipe_ingredients`
  with table name `recipe_recipe_ingredients` hardcoded as a string. Any table rename
  breaks silently at runtime.
- Response always returns `ingredients=[]` and `images=[]` — the client cannot confirm
  what was stored without a subsequent GET.
- `SharingService` also has a `create_trip_share_token` method that additionally updates
  `trip.share_token` and `trip.share_expires_at` columns directly on the Trip model
  (legacy fields), while `create_share_link` only writes to `share_links`.
  The trip router's `share_trip` endpoint (`POST /trips/{id}/share`) calls
  `TripService.share_trip` which writes those legacy Trip fields, while
  `POST /api/v1/share/trip/{tripId}` in the sharing router calls
  `SharingService.create_trip_share_token`. Two separate code paths produce
  different share mechanisms for the same trip.

---

## Flow 3: Trip Planning — Stove / Days / Days Reorder

**Entry points**
- `PUT /api/v1/trips/{trip_id}/stove` — `trip/routers/trips.py:2912`
- `POST /api/v1/trips/{trip_id}/days` — `trip/routers/trips.py:2958`
- `PUT /api/v1/trips/{trip_id}/days/reorder` — `trip/routers/trips.py:3031`

### Layer hops — set stove

```
PUT /api/v1/trips/{trip_id}/stove
  → trip/routers/trips.py :: set_trip_stove()
      get_current_user  [JWT + SELECT auth_users]
      TripService.get_trip(trip_id, current_user.id)
          SELECT trips WHERE id=$1 AND user_id=$2  [ownership check]
      StoveService.set_trip_stove(trip_id, stove_config)
          [upsert logic in StoveService — sets stove record for trip]
      StoveResponse.from_orm(stove)
```

`StoveService` code is at `trip/services/stove_service.py`. Not read in full, but the import is present and the call is straightforward upsert.

### DB queries triggered (set stove)
1. SELECT auth_users WHERE id=$1
2. SELECT trips WHERE id=$1 AND user_id=$2
3. INSERT or UPDATE trip_stoves (upsert via StoveService)

### Layer hops — add day

```
POST /api/v1/trips/{trip_id}/days
  → trip/routers/trips.py :: add_trip_day()
      get_current_user
      TripService.get_trip_with_details(trip_id, current_user.id)
          SELECT trips + selectinload(participants, days, stove)
      [inline validation: date within range, day not duplicate]
      db.add(TripDayModel) + db.commit() + db.refresh()
      TripDay.model_validate(new_day)
```

### DB queries triggered (add day)
1. SELECT auth_users WHERE id=$1
2. SELECT trips + eager-load participants/days/stove
3. INSERT INTO trip_days (trip_id, day_number, date, notes)

### Layer hops — reorder days

```
PUT /api/v1/trips/{trip_id}/days/reorder
  → trip/routers/trips.py :: reorder_days()
      get_current_user
      TripService.get_trip_with_details(trip_id, current_user.id)
      [set comparison: provided_day_ids == existing_day_ids]
      [for each day_id in reorder_data.day_order]:
          UPDATE trip_days SET day_number=$1 WHERE id=$2
      db.commit()
```

### DB queries triggered (reorder)
1. SELECT auth_users WHERE id=$1
2. SELECT trips + eager-load
3. N × UPDATE trip_days SET day_number=? WHERE id=?  (one per day, in a loop)

### Auth / authz
- All three endpoints require JWT and verify `trip.user_id == current_user.id`.
- No admin bypass for trip modification.

### Error paths
- Trip not found / not owned: `NotFoundError` / `PermissionError` → 404 / 403
- Invalid date range for new day: 400
- Day already exists for date: 400
- Mismatched day IDs in reorder: 400
- DB error: `db.rollback()` then 500

### Observability
- `logger.error` on exceptions
- No transaction isolation noted for the reorder N-update loop — if interrupted
  mid-loop, days will have partially updated numbers with no rollback triggered
  by the loop itself (the `except` block around the commit does rollback)

### Hidden coupling
- `reorder_days` fires N individual UPDATE statements instead of a batch —
  for a 14-day trip this is 14 round trips.
- `add_trip_day` calculates `day_number = (date - start_date).days + 1`. If days
  are reordered after creation, the auto-calculated `day_number` for new days will
  conflict with the reordered positions.
- Multiple TODOs in the trip response builder: `total_calories`, `total_weight_g`,
  `total_water_ml`, `total_fuel_g` are hardcoded `None` with TODO comments.
  `calculate_completion_percentage` is called but fuel is never calculated even
  though `StoveService` exists.

---

## Flow 4: Shopping List Generation → Export (PDF)

**Entry points**
- `GET /api/v1/trips/{tripId}/export/shopping-list` — `trip/routers/export.py:214`
- `GET /api/v1/trips/{trip_id}/export/pdf` — `trip/routers/export.py:335` (legacy)

### Layer hops — shopping list export (canonical)

```
GET /api/v1/trips/{tripId}/export/shopping-list
  → trip/routers/export.py :: export_shopping_list()
      get_current_user  [JWT + SELECT]
      TripService.get_trip(tripId, current_user.id)  [ownership check]
      IMMEDIATELY raises HTTP 501 NOT_IMPLEMENTED
```

This endpoint is a declared stub. The `ShoppingListGenerator` class exists in
`shopping/services/shopping_list_generator.py` and is imported in `export.py` (line 27),
but is never called from within any live export endpoint. The generator imports
`IngredientAggregator`, `ShoppingRounder`, `IngredientCategorizer` from
`shopping/utils/` — these are implemented — but the bridge from trip data to the
generator is not wired.

The same applies to `export/summary`, `export/packing-list`, and `export/nutrition`.
All four return 501.

### Layer hops — legacy PDF export (functional path)

```
GET /api/v1/trips/{trip_id}/export/pdf
  → trip/routers/export.py :: export_trip_pdf()
      get_current_user
      _prepare_trip_data_for_export(trip_id, user_id, db, …)
          TripService.get_trip()            [ownership check SELECT]
          SELECT trips WHERE id=$1 AND user_id=$2
              selectinload(participants, days→meals→recipe_snapshot, days→snacks,
                           days→drinks, stove)
          [shopping list block]: ShoppingListGenerator() instantiated but NOT called:
              trip_data["shopping_list"] = { "categories": {}, … }   ← stub
          [nutrition block]:  hardcoded values: calories=2000, proteins=75 …  ← stub
      TripExportManager()
          _initialize_exporters():  dynamic import of TripPDFExporter (reportlab)
      export_manager.is_format_available(ExportFormat.PDF)
      TripExportManager.export(trip_data, ExportOptions)
          TripPDFExporter(options).export(trip_data)
              reportlab: SimpleDocTemplate, Paragraph, Table, …
              → BytesIO  (in-process)
      StreamingResponse(BytesIO(pdf_content), media_type="application/pdf")
```

### DB queries triggered (legacy PDF)
1. SELECT auth_users WHERE id=$1
2. SELECT trips WHERE id=$1 AND user_id=$2
3. SELECT trips + selectinload(participants, days+meals+recipe_snapshot, days+snacks, days+drinks, stove)

### External calls
- reportlab (in-process PDF generation via BytesIO — no file I/O)
- No S3/Azure calls; `core/storage/` service exists but is not used in this path

### Auth / authz
- JWT required + ownership enforced at two points: `get_trip` and the explicit query in `_prepare_trip_data_for_export`
- Double ownership check is redundant but not harmful

### Error paths
- reportlab not installed: `is_format_available` returns False → 503
- Trip not found: 404
- ValueError from exporter: 500
- Any other exception: 500

### Observability
- `logger.error` on exceptions
- No timing metrics for PDF generation (can be slow for large trips)

### Hidden coupling
- Shopping list and nutrition are hardcoded stubs in `_prepare_trip_data_for_export`
  lines 141-163, so even the legacy PDF export omits real shopping data.
- `ShoppingListGenerator` is instantiated on line 142 but its return value is discarded.
- The canonical endpoint (`/{tripId}/export/shopping-list`) checks trip ownership
  correctly then throws 501, but the legacy endpoint (`/{trip_id}/export/pdf`) does the
  same check twice with different variable naming (camelCase `tripId` vs snake `trip_id`),
  suggesting these were written independently.

---

## Flow 5: Marketplace Browse + Trending

**Entry point**
- `GET /api/v1/marketplace/recipes` — `recipe/routers/marketplace.py:69`
- `GET /api/v1/marketplace/trending` — `recipe/routers/marketplace.py:343`

### Layer hops — browse

```
GET /api/v1/marketplace/recipes
  → recipe/routers/marketplace.py :: browse_public_recipes()
      get_current_user_optional  [JWT optional, no DB hit if no token]
      MarketplaceService.browse_public_recipes(user_id, …)
          SELECT recipes WHERE is_published=true AND is_archived=false
              [optional JOINs for category/tag filters]
          SELECT COUNT(*) [subquery for total]
          ORDER BY sort_field [ASC|DESC]
          LIMIT/OFFSET
          selectinload(ingredients, images, recipe_categories→category, recipe_tags→tag)
          [for each recipe]:  ← N+1 PATTERN
              SELECT recipe_ratings WHERE recipe_id=$1 AND user_id=$2
              SELECT recipe_reviews WHERE recipe_id=$1 AND user_id=$2
```

### DB queries triggered (browse, N recipes returned)
1. SELECT COUNT(*) subquery
2. SELECT recipes + eager-loads (1 query with joined loads)
3. N × SELECT recipe_ratings  (one per recipe in Python loop)
4. N × SELECT recipe_reviews  (one per recipe in Python loop)

Total: 2 + 2N queries for N recipes. With default limit=20, this is 42 queries per request.

### Layer hops — trending

```
GET /api/v1/marketplace/trending
  → recipe/routers/marketplace.py :: get_trending_recipes()
      MarketplaceService.get_trending_recipes(limit, days)
          [subquery]: SELECT recipe_id, COUNT(*) AS recent_ratings
              FROM recipe_ratings WHERE created_at >= threshold GROUP BY recipe_id
          SELECT recipes OUTER JOIN subquery
              WHERE is_published AND NOT is_archived AND created_at >= threshold
          ORDER BY (view_count*0.1 + coalesce(recent_ratings,0)*2 + fork_count*3
                    + coalesce(rating_average,0)*10) DESC
          LIMIT limit
          selectinload(ingredients, images, recipe_categories→category, recipe_tags→tag)
```

The trending filter `created_at >= threshold_date` means only recipes created within the
trending window appear. A popular recipe from 2 months ago cannot trend in the "week" period
even if it receives new ratings, because the `WHERE created_at >= threshold_date` clause
excludes it. This is likely a logic bug — rating/view activity should be windowed, not
recipe creation date.

### Auth / authz
- Browse: optional auth; anonymous users pass `UUID('00000000-…')` as user_id
- Trending: no auth required; no personalization

### Error paths
- No explicit error handling in browse or trending — falls through to global 500 handler

### Observability
- None beyond global request-ID middleware

### Hidden coupling
- `recipe.view_count += 1` in `get_public_recipe_details` is an in-memory mutation
  followed by `db.commit()`. Under concurrent requests for the same recipe, this
  will produce a read-modify-write race (last-write-wins, silently dropping increments).
- `increment_view_count_sync` in `recipes.py` (background task) is a stub that only logs.

---

## Cross-flow Findings

### CRITICAL

**sharing.py:124 — `GET /{shareToken}` shadows `GET /my-links`**
`GET /api/v1/share/{shareToken}` is declared at line 124, while `GET /api/v1/share/my-links`
is declared at line 264. FastAPI resolves routes in declaration order. Any request to
`GET /api/v1/share/my-links` will be handled by the `view_shared_content` handler with
`shareToken="my-links"`, returning 404 instead of the user's share link list. The
`/my-links` endpoint is permanently dead.
Fix: Move `GET /my-links` declaration above `GET /{shareToken}`. Effort: 1 line of code.
[NEW]

**export.py:141-163 — shopping list and nutrition are stub data in legacy PDF**
`_prepare_trip_data_for_export` hard-codes `shopping_list = {"categories": {}, "total_items": 0}`
and `nutrition = {"calories": 2000, …}`. Users calling `GET /trips/{id}/export/pdf` receive
a PDF with empty shopping data and fabricated nutrition. This is a correctness bug that silently
produces misleading output.
Fix: Implement `ShoppingListGenerator` integration; stub must raise 501 or be clearly labeled.
Effort: Medium (ShoppingListGenerator exists, wiring is missing).
[NEW]

### HIGH

**marketplace_service.py:160-184 — N+1 rating/review queries in browse**
For each recipe returned in `browse_public_recipes`, two additional SELECT queries are issued
in a Python loop (lines 163-184). Default limit=20 → 42 DB round trips per browse request.
Fix: Use a single JOIN or subquery to fetch user ratings/reviews for all recipe IDs at once.
Effort: Medium.
[NEW]

**auth/routers/auth.py:399-401 — bcrypt verify inside per-request login flow with no timeout**
`PasswordHasher.verify_password` is synchronous bcrypt. Under async FastAPI this blocks the
event loop for ~200-500 ms per call. Under login flood, this can starve all other requests.
Fix: Run via `asyncio.run_in_executor`. Effort: Low.
[NEW]

**token_service.py:1321-1331 — refresh rotation is not atomic**
`revoke_session` + `create_session` in the refresh-rotation path are two separate commits
with no transaction wrapper. A crash between them leaves the user with no valid session.
Fix: Wrap both operations in a single transaction. Effort: Low.
[NEW]

**marketplace_service.py:232 — `recipe.view_count += 1` is a race condition**
In-memory read-modify-write under concurrent requests; SQL-level `UPDATE … SET view_count = view_count + 1` would be correct.
Fix: Replace with `db.execute(update(Recipe).where(…).values(view_count=Recipe.view_count + 1))`.
Effort: Low.
[NEW]

### MEDIUM

**recipes.py:813-818 — raw sql_text INSERT for recipe_ingredients with hardcoded table name**
`sql_text("INSERT INTO recipe_recipe_ingredients …")` at line 813 bypasses the ORM.
The table name is a magic string; any schema migration that renames it silently breaks recipe creation.
Additionally, the function returns `ingredients=[]` and `images=[]` always (line 886-887), so
callers cannot verify what was persisted without a subsequent GET.
Fix: Use ORM insert; return loaded ingredients/images. Effort: Medium.
[NEW]

**marketplace_service.py:524 — trending filters by recipe creation date, not activity date**
`WHERE created_at >= threshold_date` excludes older popular recipes from trending.
Fix: Remove creation date filter; use a `HAVING recent_ratings > 0 OR …` approach.
Effort: Low.
[NEW]

**trip/routers/trips.py:3074 — reorder days fires N individual UPDATE statements**
No batch update; for a 14-day trip, 14 separate round trips.
Fix: Use `UPDATE … SET day_number = CASE WHEN id=$1 THEN 1 … END` or executemany.
Effort: Low-Medium.
[NEW]

**trips.py:2988, 2995 — add_trip_day duplicates date in existing_day detection but not day_number**
`day_number` is auto-calculated as `(date - start_date).days + 1` (line 3006). After reorder,
this formula produces the original chronological number, conflicting with the reordered
`day_number` values already in the DB. Duplicate day_number on INSERT will fail at DB-level
constraint, but the error is unhandled and returns 500 instead of 409.
Fix: Query the next available `day_number` from DB instead of calculating. Effort: Low.
[NEW]

**auth/routers/auth.py:272-281 — per-account rate limiter instantiated and awaited inline**
`RateLimitDep(…)` is instantiated inside the request handler body, not as a dependency.
If Redis is down, `await account_rate_limiter(request, redis_client)` raises an unhandled
`RateLimitExceeded` exception that has an audit log written and committed before the re-raise,
but the outer `except` only catches login-specific exceptions, so Redis failures 500 the login.
Fix: Either use proper `Depends(RateLimitDep(…))` or add Redis unavailability guard. Effort: Low.
[NEW]

### LOW

**trip/routers/trips.py:100, 130 — TODO: Calculate nutrition, weight, fuel from meals**
Multiple fields in `TripResponse` are hardcoded `None` with TODO comments. These affect
both the create and get trip responses. No test catches this because tests presumably
accept None values.
[NEW]

**sharing.py — no ownership check on `DELETE /{shareToken}`**
`revoke_share_link` passes `user_id=current_user.id` to `SharingService.revoke_share_link`,
which presumably filters by user_id. This is correct, but the revoke response is 404 for
"not found or access denied" — the caller cannot distinguish "token doesn't exist" from
"token exists but owned by someone else", which leaks minor information. Acceptable but
should be documented.
[NEW]

---

## Unimplemented or Dead Endpoints

| Endpoint | Status | File:Line | Notes |
|----------|--------|-----------|-------|
| `GET /api/v1/trips/{tripId}/export/summary` | 501 | export.py:167 | ShoppingListGenerator imported but unused |
| `GET /api/v1/trips/{tripId}/export/shopping-list` | 501 | export.py:214 | Core shopping export flow |
| `GET /api/v1/trips/{tripId}/export/packing-list` | 501 | export.py:251 | |
| `GET /api/v1/trips/{tripId}/export/nutrition` | 501 | export.py:290 | |
| `GET /api/v1/trips/{trip_id}/days/{day_id}/meals/{meal_slot}` | 501 | meals.py:112 | |
| `PUT /api/v1/trips/{trip_id}/days/{day_id}/drinks/{drink_id}` | 501 | meals.py:650 | |
| `GET /api/v1/share/my-links` | Dead (shadowed by `/{shareToken}`) | sharing.py:264 | Route ordering bug — always returns 404 |
| `# from jidelnicek.api.v1.endpoints.exports import router as unified_export_router` | Disabled | main.py:437 | Commented out |
| `# from jidelnicek.admin.routers import …` | Disabled | main.py:438-439 | Admin routers commented out |
| `# from jidelnicek.core.routers.cleanup import router as cleanup_router` | Disabled | main.py:34 | Cleanup router commented out |

---

## Routes with No Auth Where Auth Expected

| Endpoint | Auth | Risk |
|----------|------|------|
| `GET /api/v1/marketplace/trending` | None (public) | Acceptable — trending is public by design |
| `GET /api/v1/marketplace/recipes` | Optional | Acceptable — public browse |
| `GET /api/v1/trips/` (list_trips) | Optional (`get_current_user_optional`) | Silently returns empty list for unauthenticated; no error. LOW risk but could confuse clients |
| `GET /api/v1/share/{shareToken}` | Optional | Intentional — share links are public |

No critical auth gaps found in the traced flows. The `/auth/login`, `/auth/register`,
`/auth/refresh`, and `/auth/logout` endpoints are all in the CSRF exclusion list, which is
correct.

---

## Open Questions

1. Does `PermissionValidator('recipes:create')` allow all authenticated users to create
   recipes, or is it role-gated? The permission matrix in `core/validation/validation.py`
   was not fully traced.

2. `revoke_all_user_sessions` (token_service.py:300) loops over sessions and sets `is_valid=False`
   but does NOT blacklist the corresponding access tokens in Redis. Access tokens remain valid
   until expiry even after "logout all sessions". Is this intentional?

3. `TripService.share_trip` writes legacy `trip.share_token` / `trip.share_expires_at` columns,
   while `SharingService.create_share_link` writes to `share_links` table. Are both paths
   supposed to coexist? Is the Trip model's `share_token` field being migrated away?

4. The `ingredient_id` in `RecipeIngredient` points to `common/models/ingredient.py`, but
   `recipe/routers/recipes.py` validates via `SELECT ingredients WHERE id=$1`. The table
   name `recipe_recipe_ingredients` in the raw SQL suggests a different schema than the ORM
   model names. Is there a naming inconsistency in the migrations?

5. No shopping tests exist in `tests/` for the `shopping/` module endpoints. The
   `ShoppingListGenerator` and its utilities have no test coverage visible in the test listing.
