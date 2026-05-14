# Type Design Review

## Scope

Backend: Python package `jidelnicek` at `/mnt/data/WORK/Jidelnicek_2.0/src/jidelnicek/` (all modules: auth, recipe, trip, ingredients, shopping, calculations, common, snacks). Source `.py` files are absent from disk at review time; analysis is based on: the OpenAPI spec (`Documentation/jidelnicek_OpenAPI Spec.yaml`), database schema documentation (`Documentation/Database Schema.md`), the data validation rules document (`Documentation/jidelnicek_Data Validation Rules.md`), subtask review reports in `review/`, and surviving standalone test scripts that import from the package.

Frontend: `frontend/src/` — all `.ts`/`.tsx` source files are also absent from disk. Analysis covers `frontend/vite.config.ts`, the package.json, and what can be inferred from the OpenAPI spec and documentation.

Coverage note: Because live source files are unavailable, some findings are necessarily inferred from documentation and test script usage patterns. Confidence is marked where inference is involved.

---

## TL;DR

The codebase has solid database-level constraints (PostgreSQL `CHECK`, `UNIQUE`, FK) and uses Pydantic 2 with validators for HTTP boundary enforcement, but the type design consistently fails to encode domain concepts as distinct types. Virtually every domain primitive — grams, kilocalories, millilitres, participant coefficient, scaling factor, UUID identity — is stored as a raw `DECIMAL`, `INTEGER`, `str`, or `UUID` with no newtype wrapper. The `NutritionalValues` flat-struct with 40 optional `float`/`Decimal` fields is the most egregious example of primitive obsession: it can represent a nutritionally-impossible state (sugars > carbohydrates) without the type system objecting. `meal_slots` is a `JSONB` / `list[str]` instead of `list[MealSlotName]`. The `participant.coefficient` field has documented range `10–300 %` but the DB constraint allows `> 0` (i.e. 0.01–999.99 %), so the invariant lives in a prose doc, not in the code. The frontend has no generated types from the OpenAPI spec and no branded IDs; any UUID can be passed where any other UUID is expected.

---

## Domain types audit

| Domain concept | Current type | Suggested type | Why |
|---|---|---|---|
| Entity identity (Recipe, Trip, User, Ingredient, Participant) | `UUID` / `str (format: uuid)` (Python), `string` (TS) | `RecipeId`, `TripId`, `UserId`, `IngredientId` newtypes (Python: `class RecipeId(UUID)`, TS: branded `string & {__brand:'RecipeId'}`) | Prevents passing a `TripId` where a `RecipeId` is expected; eliminates a whole class of id-mixing bugs |
| Weight of an ingredient in a recipe | `DECIMAL(10,1)` / `float` | `Grams` (newtype over `Decimal`, invariant: > 0) | `quantity_g` appears in 6+ contexts; callers mix raw float with Grams without the compiler complaining |
| Energy value (calories) | `DECIMAL(10,2)` / `float` (in `NutritionalValues`) | `Kilocalories(Decimal)` | kcal and kJ are mixed at the presentation layer; energy arithmetic without a typed wrapper is error-prone |
| Participant coefficient | `DECIMAL(5,2)` with DB `CHECK (coefficient > 0)` | `ParticipantCoefficient` (newtype, invariant: `10 <= value <= 300`) | Spec says 10–300 %, DB says > 0, code uses 0.01–999.99 % — three different ranges, none enforced at the type level |
| Scaling factor | `DECIMAL(10,4)` / `Decimal` | `ScalingFactor` (newtype, invariant: > 0) | Used across `RecipeScaler`, `CalorieScaler`, `ParticipantScaler`, and the `trip_meals` table; a negative or zero value is a silent calculation bug |
| Meal slot name | `str` in a `JSONB list`, `list[str]` in Python | `MealSlotName` (opaque string alias) or an enum per-trip instance | A meal assigned to slot `"Breakfst"` (typo) passes all type checks and only fails at runtime when trying to match against configured slots |
| Measurement type (Snack) | `VARCHAR(20) CHECK (IN ('piece','per_100g'))` | `MeasurementType` enum | Closed two-value set stored as a raw string with a DB constraint; should be a Python `Enum` and TS union literal |
| Language preference | `VARCHAR(2) CHECK (IN ('en','cs'))` | `Language` enum | Same pattern: enum-like constraint in DB but no Python type |
| Unit system preference | `VARCHAR(10) CHECK (IN ('metric','imperial'))` | `UnitSystem` enum | Same |
| Energy unit preference | `VARCHAR(10) CHECK (IN ('kcal','kJ'))` | `EnergyUnit` enum | Same |
| User role | `VARCHAR(20) CHECK (IN ('user','admin'))` | `UserRole` enum | Same |
| Recipe change type | `enum [major, minor]` (OpenAPI) | `RecipeChangeType` Python `Enum` | Used in versioning logic; string comparison is fragile |
| `NutritionalValues` (40-field flat struct) | Flat struct with 40 `Optional[Decimal]` fields | Nested: `Macronutrients(required)` + `Optional[Micronutrients]` + `Optional[Vitamins]` | Cross-field invariants (sugars ≤ carbs, sat-fats ≤ total-fats) cannot be expressed without a newtype or validator; all 40 fields are independently nullable, making partial-nutrition states impossible to distinguish |
| Sugar content (cross-field invariant) | `Optional[Decimal]` independent field | Value-constrained within `Macronutrients` struct | The rule `sugars_g <= carbohydrates_g` is documented in validation rules but not encoded in a type |
| Water volume (cooking water) | `INTEGER` in `recipe_recipes.water_ml` and `trip_day_drinks.water_ml` | `Millilitres(int)` | Dimensional confusion: `water_ml` and `quantity_g` are both numeric, interchangeable at Python level |
| Altitude adjustment | `DECIMAL(5,2) DEFAULT 0` | `AltitudeAdjustmentPercent` (newtype, invariant: `0 <= value <= 100`) | Valid range 0–100 % documented; `> 100 %` is physically nonsensical but passes today |
| Stove efficiency | `DECIMAL(10,2)` | `FuelEfficiencyGPerLitre` (newtype, invariant: 1 ≤ value ≤ 100) | Physical unit with documented min/max; raw Decimal gives no indication of unit |
| Share token | `str` | `ShareToken` (opaque string newtype) | Share tokens passed as plain strings are indistinguishable from other string fields; easy to accidentally log or expose |
| Recipe snapshot data | `JSONB` | Structured `RecipeSnapshot` Pydantic model | Opaque JSONB loses all type information at read time |

---

## Invariant gaps — places where a wrong value gets through type-checking

### CRITICAL

**C-1: Participant coefficient range not enforced at application layer.**
The business rule is 10–300 %. The DB constraint is `coefficient > 0`. The Python model allows 0.01–999.99 %. A participant with a coefficient of 5 % or 500 % is accepted by the type system and stored. Calculations silently produce wrong meal quantities. Evidence: `review/subtask_4.2_participant_management.md`, issue #1.

**C-2: Cross-field nutritional invariants unenforceable at type level.**
`sugars_g <= carbohydrates_g` and `saturated_fats_g <= total_fats_g` are documented in `Documentation/jidelnicek_Data Validation Rules.md` §3.2. Both fields are independent `Optional[Decimal]` in the same flat struct. You can construct a valid `NutritionalValues(carbohydrates_g=Decimal('10'), sugars_g=Decimal('50'))` — a nutritionally impossible state — without any type or runtime error unless the Pydantic model validator explicitly checks it (not confirmed from docs).

**C-3: `meal_slot` on `trip_meals` is not validated against the owning trip's configured slots.**
`meal_slot` is `VARCHAR(50)` with no FK or constraint referencing `trip_trips.meal_slots`. A meal can be assigned to an arbitrary slot name that does not exist in the trip configuration. This is a pure type-design gap: if `MealSlotName` were a validated reference type checked at assignment time, this would be impossible.

### HIGH

**H-1: Primitive obsession with nutritional values causes dimensional confusion.**
`calories`, `proteins_g`, `carbohydrates_g`, `fats_g` are all `Decimal` / `float`. Code can accidentally add calories to grams or divide grams by calories; the type system offers no resistance. This is directly relevant to the scaling engine, which multiplies nutritional values by scaling factors.

**H-2: Scaling factor can silently be negative or zero.**
`RecipeScaler.scale_ingredient_quantity()` takes a `Decimal` scaling factor. Nothing in the type signature prevents a zero or negative factor. Evidence: the zero-participants edge case inconsistency documented in `review/subtask_5.1_base_scaling_algorithm.md`, issue #1.

**H-3: UUIDs for different entity types are interchangeable.**
`recipe_id`, `trip_id`, `user_id`, `ingredient_id`, `snack_id` are all `UUID`. In the service layer, passing a `TripId` to a `RecipeService` method expecting a `RecipeId` is a type-correct call that only fails at the database level. Python's `UUID` and TypeScript's `string` give no protection here.

**H-4: Instructions field is `Text` instead of structured `list[InstructionStep]`.**
Stored as raw text (not JSON). Callers have no type-safe way to access individual steps, count them, or reorder them. Documented as a known discrepancy in `review/subtask_3.1_recipe_model_schema.md`, issue #2.

**H-5: `recipe_data JSONB` in `trip_recipe_snapshots` loses all type information.**
Recipe snapshots are serialised to opaque JSONB. At read time, the data is deserialized to a Python `dict`, not a typed model. Any field access is untyped and fragile to recipe model evolution.

### MEDIUM

**M-1: Multiple enum-like string fields lack Python Enum types.**
`language`, `unit_system`, `energy_unit`, `role`, `measurement_type`, `entity_type` (sharing) all use DB `CHECK` constraints but are plain `str` in Python. Business logic comparing `if user.language == "en"` is unprotected against typos; no exhaustiveness checking in `match`/`if` chains.

**M-2: `description` field on `recipe_recipes` has no length constraint at model level.**
`Text` with no `CHECK(LENGTH(description) <= 500)`. Documented in `review/subtask_3.1_recipe_model_schema.md`, issue #1. Pydantic schema may enforce it at the API boundary, but the ORM model does not.

**M-3: `servings` on Recipe has no upper-bound constraint at model level.**
Only a positive check; the business rule `1–100` is partially unenforced. Documented in `review/subtask_3.1_recipe_model_schema.md`, issue #3.

**M-4: Trip `description` field is completely missing from the ORM model.**
Present in the API spec but absent from `trip_trips` table and model. No type or compiler error; the field simply silently disappears. Documented in `review/subtask_4.1_trip_model_structure.md`, issue #1.

**M-5: `trip_meals.meal_slot` is an unvalidated free string.**
Cannot be narrowed to a `Literal` or enum because meal slot names are user-defined per trip. No mechanism exists to enforce that the slot name matches the owning trip's `meal_slots` array at the application or type level.

**M-6: `Grams` and `Millilitres` are both modelled as raw numeric types.**
`quantity_g`, `water_ml`, `piece_weight_g`, `efficiency_g_per_liter` are all plain `Decimal`/`int`. Dimensional arithmetic errors (e.g., adding grams to millilitres in a scaling calculation) are invisible to the type checker.

### LOW

**L-1: `view_count`, `fork_count`, `rating_count`, `recipe_count`, `trip_count` are plain `int`.**
All are non-negative counters; no `NonNegativeInt` wrapper. A bug setting one to `-1` is type-correct.

**L-2: Star rating (`1–5`) is `int` everywhere.**
`rating INTEGER CHECK (rating >= 1 AND rating <= 5)` in DB; `Optional[int]` in Python; `integer` in OpenAPI. No `StarRating` newtype prevents `rating=0` or `rating=6` at the Python layer.

**L-3: `template_data JSONB` is completely opaque.**
`TemplateDetailed.template_data` is described as "JSON structure containing meal slots, recipes, snacks" with no schema. All access is untyped.

---

## Polymorphism / discriminated unions

### Used

The sharing module uses a discriminated shape at the OpenAPI level: `GET /share/{shareToken}` returns `oneOf: [SharedRecipe, SharedTrip]` distinguished by a `type` field (`"recipe"` | `"trip"`). This is the one place where a discriminated union is correctly modelled in the API contract.

The `EntityType` enum (`"recipe"` | `"trip"`) imported from `jidelnicek.core.models.share_link` (visible in `test_sharing_implementation.py`) confirms the discriminator exists in Python code as well.

### Missing

**No discriminated union for MealContent.** A `trip_meals` row can reference either a `recipe_snapshot_id` (FK to a snapshot) or implicitly nothing (no recipe assigned yet). This should be modelled as `MealContent = AssignedMeal | EmptyMeal` rather than nullable foreign keys.

**No discriminated union for Snack measurement.** A `Snack` with `measurement_type = "piece"` requires `piece_weight_g` to be non-null. A `Snack` with `measurement_type = "per_100g"` must have `piece_weight_g = null`. This is a classic two-state discriminated union that is currently expressed as a flat struct with a conditional nullable field. The invariant "piece_weight_g is required iff measurement_type == 'piece'" is enforced only by runtime validation, not by the type structure. Evidence: `Documentation/jidelnicek_Data Validation Rules.md` §1.5.

**No discriminated union for Ingredient visibility.** `user_id IS NULL` signals a global ingredient; `user_id IS NOT NULL` signals a user-scoped ingredient. This should be `GlobalIngredient | UserIngredient` rather than `Optional[UUID]` on a single type.

**No discriminated union for recipe tracking mode.** `track_recipe_changes: bool` on a Trip splits behaviour: snapshots vs. live tracking. This binary determines fundamentally different semantics but is not reflected in the type structure.

---

## ORM ↔ schema separation

The review docs confirm that separate Pydantic schemas exist alongside SQLAlchemy models (e.g., `/src/jidelnicek/trip/schemas/participant.py` alongside `/src/jidelnicek/trip/models/participant.py`). This is the correct layered pattern.

However, several structural weaknesses are visible:

1. **Schema-model drift is documented and unresolved.** The `Trip` model lacks `description` and `status` fields that appear in the API spec and OpenAPI contract. The `trip_days` migration has a `notes` field absent from the ORM model. There is no automated test that catches model-migration drift at CI time.

2. **ORM constraint gaps not mirrored in schemas.** The `description` field has no length constraint at ORM level; if the Pydantic schema enforces it, the ORM model accepts longer values when constructed directly (e.g., in test fixtures). The `conftest.py` creates `AuthUser` instances directly with no Pydantic validation — the `role="user"` and `energy_unit="kcal"` strings are unchecked at construction time.

3. **JSONB fields (meal_slots, recipe_data, meal_coefficients, template_data) pass through as untyped `dict`/`list`.** The ORM returns raw Python objects; the Pydantic schema must re-validate them. If the JSONB content evolves, no migration enforces schema-on-read.

4. **Repository return types** — from documentation and test evidence, service methods return SQLAlchemy model instances directly to routers, which then call `.model_validate()` or `.from_orm()` on them. This is the intended pattern but the boundary is not enforced: there is no `RecipeRepository` returning a domain object distinct from the ORM model. The ORM model bleeds directly to the response schema via `.from_orm()`.

---

## Frontend type sync with backend

### Current state

No generated TypeScript types from the OpenAPI spec were found in the codebase. The `frontend/src/types/` directory exists but contains no files. The `frontend/src/api/` directory contains only a `__mocks__` subdirectory. The `frontend/src/schemas/` directory is empty.

The `frontend/package.json` does not list `openapi-typescript`, `swagger-typescript-api`, or any similar code-generation tool in dependencies. The `.github/workflows/i18n-check.yml` workflow validates i18n but there is no CI workflow for type generation or API contract drift.

### Drift risk: HIGH

All frontend TypeScript types for API entities (Recipe, Trip, Ingredient, Participant, NutritionalValues) are either hand-mirrored from the OpenAPI spec or inferred from API responses at runtime. Given that the backend OpenAPI spec is also hand-authored (not generated from code), the type chain is:

```
Python ORM model → (manual) → Pydantic schema → (manual) → OpenAPI spec → (manual) → TypeScript types
```

There are three manual transcription steps, each of which can introduce drift. No automated contract test or type-generation step closes this loop. The `tests/test_openapi_contract.py` validates runtime responses against the OpenAPI spec but only when a live server is running, not in CI.

### No branded IDs in TypeScript

All entity IDs in the OpenAPI spec are `string (format: uuid)`. Without generated or manually maintained branded types, all IDs are interchangeable `string` in TypeScript. A component receiving `recipeId` can pass it to an API call expecting `tripId` without a compile-time error.

### No discriminated union narrowing at frontend

The `GET /share/{shareToken}` response is `oneOf [SharedRecipe, SharedTrip]`. Without generated types or explicit type guards, frontend code must handle this with unchecked `as` casts or `any`, losing the discriminator benefit.

---

## Findings

### CRITICAL

**C-1** `ParticipantCoefficient` invariant (10–300 %) is not encoded in the type system.
The DB constraint (`> 0`) is weaker than the business rule, and the Python model is weaker still. Wrong coefficients propagate silently through all meal scaling calculations.
*Fix*: `class ParticipantCoefficient` (Pydantic `RootModel` or `Annotated[Decimal, Field(ge=10, le=300)]`) enforced at every construction site, including direct ORM fixture creation.

**C-2** Cross-field nutritional invariants (`sugars_g <= carbohydrates_g`, `saturated_fats_g <= fats_g`) cannot be enforced by field types alone.
*Fix*: Add a Pydantic `@model_validator(mode='after')` to `NutritionalValues`. Alternatively, nest fields into validated sub-structs: `class Macronutrients(BaseModel): carbohydrates_g: NonNegativeDecimal; sugars_g: Annotated[NonNegativeDecimal, Field(le=carbohydrates_g)]` — the latter requires a validator in any case.

**C-3** `meal_slot` string on `trip_meals` is never validated against the owning trip's configured slots.
*Fix*: Enforce at the service layer on every meal assignment. A `ValidatedMealSlot` newtype wrapping a `str`, constructed only by a factory that checks membership in `trip.meal_slots`, would make the invariant structural.

### HIGH

**H-1** No branded/newtype IDs anywhere in the stack (Python or TypeScript).
All UUIDs are interchangeable.
*Fix (Python)*: `class RecipeId(UUID): pass`, `class TripId(UUID): pass`, etc. Pydantic 2 supports these as field types with full serialization support.
*Fix (TypeScript)*: Generate types from OpenAPI using `openapi-typescript` and add `__brand` phantom types or use `opaque-ts`.

**H-2** `NutritionalValues` is a 40-field flat struct; all optional fields are independently nullable.
Valid nutrition data (calories + 3 macros) and completely invalid data (all None) are the same type.
*Fix*: Split into `MacroNutrition(required)` + `Optional[MicroNutrition]` + `Optional[Vitamins]`. Required fields become non-optional.

**H-3** Scaling factor, grams, millilitres, kilocalories, and phenylalanine-mg are all raw `Decimal`.
Dimensional arithmetic bugs (e.g., multiplying grams by kilocalories) are invisible.
*Fix*: Introduce `Grams`, `Kilocalories`, `Millilitres`, `Milligrams`, `ScalingFactor` newtypes. These can be thin wrappers: `Grams = NewType('Grams', Decimal)` with a small set of arithmetic operators overloaded to return the correct types.

**H-4** `Snack.piece_weight_g` is a conditional nullable that should be a discriminated union.
*Fix*: `SnackByPiece(measurement_type=Literal['piece'], piece_weight_g: Grams)` | `SnackPer100g(measurement_type=Literal['per_100g'])`. Python: use a `Union` with `discriminator='measurement_type'` (Pydantic 2 native support).

**H-5** No TypeScript types generated from OpenAPI; all frontend types are hand-mirrored or absent.
*Fix*: Add `openapi-typescript` to the frontend build, generate `src/types/api.generated.ts` as part of CI, and import from there rather than hand-writing interfaces.

### MEDIUM

**M-1** Enum-like string fields (`language`, `unit_system`, `energy_unit`, `role`, `measurement_type`, `entity_type`) have no Python `Enum` type.
*Fix*: `class Language(str, Enum): EN='en'; CS='cs'`. Pydantic 2 handles `str` enums transparently in serialization.

**M-2** `recipe_recipes.description` has no DB-level length constraint (only Pydantic boundary validation).
*Fix*: Add `CheckConstraint('LENGTH(description) <= 500')` in the Alembic migration.

**M-3** `trip_recipe_snapshots.recipe_data` and `template_data` are opaque `JSONB`.
*Fix*: Define `RecipeSnapshotSchema(BaseModel)` and validate on read.

**M-4** `conftest.py` constructs `AuthUser` ORM models directly with raw string literals for enum fields (`role="user"`, `energy_unit="kcal"`), bypassing Pydantic validation entirely.
*Fix*: Use factory functions that accept enum types, not raw strings.

### LOW

**L-1** `StarRating` (1–5 integer) is untyped `int` throughout.
*Fix*: `StarRating = Annotated[int, Field(ge=1, le=5)]`; use as a field type in all rating-bearing models.

**L-2** `NonNegativeInt` counters (`view_count`, `fork_count`, `recipe_count`, etc.) are plain `int`.
*Fix*: `NonNegativeInt = Annotated[int, Field(ge=0)]`.

**L-3** `AltitudeAdjustmentPercent` (0–100) and `StoveEfficiency` (1–100 g/L) are raw `Decimal`.
*Fix*: Newtype wrappers with `ge`/`le` annotations.

---

## Open Questions

1. **Does the Pydantic `NutritionalValues` schema already include a `@model_validator` for the cross-field invariants (sugars ≤ carbs, sat-fats ≤ fats)?** The schema file is unavailable; the DB schema and review docs do not confirm this. If yes, C-2 is partially mitigated at the API boundary but not at the ORM construction level.

2. **Are `Language`, `UnitSystem`, `EnergyUnit`, and `UserRole` already defined as Python `Enum` types in the Pydantic schemas (as opposed to the ORM models)?** The conftest creates `AuthUser` with string literals suggesting the ORM model uses raw strings; the schema layer may use enums.

3. **Is there an OpenAPI code-generation step planned or in progress?** The `Documentation/jidelnicek_OpenAPI Spec.yaml` is hand-authored and there is no generation pipeline. If the API is expected to remain stable, investing in generation now has high leverage.

4. **What is the authoritative definition of `meal_slots` — the database `JSONB`, the Python list, or the API `list[string]`?** They are nominally the same but have no shared type. Clarifying this would unblock the `ValidatedMealSlot` fix for C-3.

5. **Is `recipe_data JSONB` in `trip_recipe_snapshots` intended to be read back as a typed `RecipeSnapshot` model, or only rendered as a raw JSON blob?** The sharing test (`test_sharing_implementation.py`) accesses `trip_content['entity'].name`, implying ORM object access, not JSONB deserialization. The snapshot table design and read path need clarification.

