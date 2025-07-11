# Missing Endpoints Analysis - Jídelníček 2.0

## Summary
This document provides a comprehensive analysis of missing API endpoints by comparing the OpenAPI specification with the current implementation.

## Currently Implemented Endpoints

### Authentication Module (/api/v1/auth)
- ✅ POST /api/v1/auth/register
- ✅ POST /api/v1/auth/login
- ✅ GET /api/v1/auth/verify-email
- ✅ POST /api/v1/auth/resend-verification
- ✅ POST /api/v1/auth/forgot-password
- ✅ POST /api/v1/auth/reset-password
- ✅ POST /api/v1/auth/refresh
- ✅ POST /api/v1/auth/logout
- ✅ GET /api/v1/auth/me
- ✅ GET /api/v1/auth/sessions
- ✅ DELETE /api/v1/auth/sessions/{session_id}
- ✅ GET /api/v1/auth/sessions/active-count
- ✅ GET /api/v1/auth/captcha/challenge

### Recipe Module
- ✅ Categories endpoints (under /api/v1/recipes prefix)
- ✅ Tags endpoints (under /api/v1/recipes prefix)
- ✅ Basic recipe CRUD operations
- ✅ Search functionality
- ✅ Scaling preview

### Trip Module
- ✅ Basic trip operations
- ✅ Invitations

### Infrastructure
- ✅ Health check endpoint
- ✅ Jobs/Export endpoints
- ✅ Progress tracking

## Missing Endpoints by Module

### 1. **Authentication & Authorization** (Priority: HIGH)
**Status**: Partially Implemented
**Missing Endpoints**:
- ❌ POST /auth/reset-password/confirm (different from existing /auth/reset-password)
- ❌ POST /auth/verify-email (as POST method - only GET exists)

### 2. **Users Module** (Priority: HIGH)
**Status**: Completely Missing
**Missing Endpoints**:
- ❌ GET /users/me
- ❌ PUT /users/me
- ❌ GET /users/me/stats
- ❌ POST /users/me/avatar
- ❌ DELETE /users/me/avatar
- ❌ PUT /users/me/preferences
- ❌ GET /users/me/preferences
- ❌ POST /users/me/change-password
- ❌ DELETE /users/me (account deletion)

### 3. **Ingredients Module** (Priority: HIGH)
**Status**: Partially Implemented
**Missing Endpoints**:
- ❌ GET /ingredients
- ❌ POST /ingredients
- ❌ GET /ingredients/{ingredientId}
- ❌ PUT /ingredients/{ingredientId} (exists but needs proper path)
- ❌ DELETE /ingredients/{ingredientId} (exists but needs proper path)
- ❌ GET /ingredients/categories
- ❌ GET /ingredients/global

### 4. **Recipes Module - Extended Features** (Priority: MEDIUM)
**Status**: Partially Implemented
**Missing Endpoints**:
- ❌ GET /recipes
- ❌ POST /recipes
- ❌ GET /recipes/{recipeId}
- ❌ POST /recipes/{recipeId}/duplicate
- ❌ POST /recipes/{recipeId}/publish
- ❌ POST /recipes/{recipeId}/unpublish
- ❌ GET /recipes/{recipeId}/versions
- ❌ POST /recipes/{recipeId}/versions/{versionId}/restore
- ❌ POST /recipes/{recipeId}/images
- ❌ DELETE /recipes/{recipeId}/images/{imageId}
- ❌ GET /recipes/search (different from existing search)

### 5. **Marketplace Module** (Priority: MEDIUM)
**Status**: Completely Missing
**Missing Endpoints**:
- ❌ GET /marketplace/recipes
- ❌ GET /marketplace/recipes/{recipeId}
- ❌ POST /marketplace/recipes/{recipeId}/fork
- ❌ POST /marketplace/recipes/{recipeId}/rate
- ❌ POST /marketplace/recipes/{recipeId}/review
- ❌ GET /marketplace/trending

### 6. **Trips Module - Extended Features** (Priority: HIGH)
**Status**: Partially Implemented
**Missing Endpoints**:
- ❌ GET /trips
- ❌ POST /trips
- ❌ GET /trips/{tripId}
- ❌ PUT /trips/{tripId}
- ❌ DELETE /trips/{tripId}
- ❌ GET /trips/{tripId}/summary
- ❌ GET /trips/{tripId}/stove
- ❌ PUT /trips/{tripId}/stove
- ❌ POST /trips/{tripId}/apply-template/{templateId}
- ❌ GET /trips/{tripId}/participants
- ❌ POST /trips/{tripId}/participants
- ❌ PUT /trips/{tripId}/participants/{participantId}
- ❌ DELETE /trips/{tripId}/participants/{participantId}

### 7. **Trip Days Module** (Priority: HIGH)
**Status**: Completely Missing
**Missing Endpoints**:
- ❌ GET /trips/{tripId}/days
- ❌ POST /trips/{tripId}/days
- ❌ GET /trips/{tripId}/days/{dayId}
- ❌ PUT /trips/{tripId}/days/{dayId}
- ❌ DELETE /trips/{tripId}/days/{dayId}
- ❌ POST /trips/{tripId}/days/reorder

### 8. **Meals Module** (Priority: HIGH)
**Status**: Completely Missing
**Missing Endpoints**:
- ❌ GET /trips/{tripId}/days/{dayId}/meals
- ❌ PUT /trips/{tripId}/days/{dayId}/meals/{mealSlot}
- ❌ DELETE /trips/{tripId}/days/{dayId}/meals/{mealSlot}
- ❌ POST /trips/{tripId}/days/{dayId}/meals/{mealSlot}/rate

### 9. **Snacks Module** (Priority: MEDIUM)
**Status**: Completely Missing
**Missing Endpoints**:
- ❌ GET /snacks
- ❌ POST /snacks
- ❌ GET /snacks/{snackId}
- ❌ PUT /snacks/{snackId}
- ❌ DELETE /snacks/{snackId}
- ❌ GET /trips/{tripId}/days/{dayId}/snacks
- ❌ POST /trips/{tripId}/days/{dayId}/snacks
- ❌ DELETE /trips/{tripId}/days/{dayId}/snacks/{snackId}

### 10. **Drinks Module** (Priority: MEDIUM)
**Status**: Completely Missing
**Missing Endpoints**:
- ❌ GET /trips/{tripId}/days/{dayId}/drinks
- ❌ POST /trips/{tripId}/days/{dayId}/drinks
- ❌ PUT /trips/{tripId}/days/{dayId}/drinks/{drinkId}
- ❌ DELETE /trips/{tripId}/days/{dayId}/drinks/{drinkId}

### 11. **Export Module** (Priority: MEDIUM)
**Status**: Partially Implemented
**Missing Endpoints**:
- ❌ GET /trips/{tripId}/export/shopping-list
- ❌ GET /trips/{tripId}/export/packing-list
- ❌ GET /trips/{tripId}/export/nutrition
- ❌ GET /trips/{tripId}/export/summary

### 12. **Templates Module** (Priority: LOW)
**Status**: Completely Missing
**Missing Endpoints**:
- ❌ GET /templates
- ❌ POST /templates
- ❌ GET /templates/{templateId}
- ❌ PUT /templates/{templateId}
- ❌ DELETE /templates/{templateId}
- ❌ POST /templates/from-trip/{tripId}
- ❌ POST /templates/from-day/{tripId}/{dayId}

### 13. **Sharing Module** (Priority: LOW)
**Status**: Completely Missing
**Missing Endpoints**:
- ❌ POST /share/recipe/{recipeId}
- ❌ POST /share/trip/{tripId}
- ❌ GET /share/{shareToken}

### 14. **Calculation Module** (Priority: LOW)
**Status**: Completely Missing
**Missing Endpoints**:
- ❌ POST /calculate/nutrition
- ❌ POST /calculate/scaling
- ❌ POST /calculate/fuel

## Implementation Priority Task List

### Phase 1: Critical Core Features (Week 1-2)
1. **Users Module** (All endpoints)
   - User profile management
   - Preferences
   - Password change
   - Account deletion

2. **Ingredients Module**
   - Complete CRUD operations
   - Categories support
   - Global ingredients

3. **Trip Days Module**
   - Days management
   - Day reordering

4. **Meals Module**
   - Meal assignment
   - Meal management

### Phase 2: Essential Trip Features (Week 3-4)
1. **Extended Trips Module**
   - Trip CRUD completion
   - Participants management
   - Stove configuration
   - Summary generation

2. **Snacks & Drinks Modules**
   - Complete implementation

3. **Export Module**
   - Shopping list
   - Packing list
   - Nutrition reports
   - Summary exports

### Phase 3: Enhanced Features (Week 5-6)
1. **Extended Recipes Module**
   - Versioning
   - Publishing workflow
   - Image management
   - Duplication

2. **Marketplace Module**
   - Recipe marketplace
   - Rating system
   - Review system
   - Forking functionality

### Phase 4: Nice-to-Have Features (Week 7-8)
1. **Templates Module**
   - Template management
   - Template application

2. **Sharing Module**
   - Share token generation
   - Public access endpoints

3. **Calculation Module**
   - Nutrition calculations
   - Scaling calculations
   - Fuel calculations

## Technical Recommendations

1. **Router Organization**:
   - Create dedicated router files for each module
   - Use consistent prefix patterns
   - Group related endpoints

2. **Service Layer**:
   - Implement service classes for business logic
   - Separate concerns from routers

3. **Data Models**:
   - Ensure all required SQLAlchemy models exist
   - Create Pydantic schemas for all DTOs

4. **Testing**:
   - Write unit tests for each endpoint
   - Integration tests for workflows
   - Contract tests against OpenAPI spec

5. **Documentation**:
   - Update OpenAPI spec as implementation progresses
   - Add detailed endpoint documentation
   - Include example requests/responses

## Module Dependencies

1. **Users** → Required by most other modules
2. **Ingredients** → Required by Recipes, Meals
3. **Trips** → Required by Days, Meals, Exports
4. **Days** → Required by Meals, Snacks, Drinks
5. **Recipes** → Required by Marketplace, Meals

## Estimated Timeline

- **Total Missing Endpoints**: ~75
- **Already Implemented**: ~25
- **Implementation Rate**: 3-5 endpoints per day
- **Estimated Completion**: 4-6 weeks with 1 developer