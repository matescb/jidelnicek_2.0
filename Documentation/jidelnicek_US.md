# Jídelníček - Meal Planning Application

## Core Purpose

A specialized web application designed for outdoor enthusiasts (long-distance hikers, runners, hiking geeks) and leaders of larger youth scout expeditions (5-20 participants, multi-week trips) to plan, organize, and manage meals for multi-day trips. The app focuses on precise nutritional planning, ingredient management, weight tracking, and generating practical packing/shopping lists with comprehensive tracking of all nutrients and fuel requirements.

## Target Audience

- Primary: Long-distance hikers, runners, and hiking enthusiasts
- Secondary: Leaders of youth scout expeditions (typically 5-20 participants for multi-week trips)

## Key Features

### 1. User Management

- Account creation with email/password or social login
- Email verification system
- Personal dashboard for trip management
- Password reset functionality
- User roles: Regular users with limited rights and admins with full access
- Language support: English and Czech
- User settings for:
    - Unit system preference (metric/imperial - all data stored in metric internally)
    - Nutritional display preference (kcal/kJ - stored in single format internally)

### 2. Meal Planning System

- Create custom recipes with ingredients and quantities (all in grams)
- Comprehensive nutritional calculation including:
    - Macronutrients (Proteins, Carbohydrates with Sugars, Fats with detailed breakdown)
    - Micronutrients (Fiber, Salt, Calcium, Sodium, Water, PHE for users with PKU)
    - All vitamins
    - Note: System tracks all nutrients; if users add ingredients without complete data, tracking accuracy depends on data completeness
- Nutritional values stored per 100g for ingredients
- Required nutritional info: calories and macros (rest optional)
- Specify water requirements per recipe (cooking water only, no drinking water tracking)
- Specify cooking time (time on stove, excluding water boiling time)
- Add preparation instructions and images
- Recipe duplication for easy variations
- Track replication count for shared recipes
- Automatic ingredient quantity calculation to meet target calorie values
- Version control:
    - Last 5 versions of each recipe retained (MVP)
    - Expandable to 10 versions post-launch based on usage
    - Users can view history and restore previous versions
    - New version created when nutritional content changes >1% or ingredients added/removed
    - Minor text edits update current version
- Recipes become meals when scaled to required proportions in daily plans
- Each meal slot can contain only one recipe
- System scales ingredients proportionally, rounding to nearest 1g (solids) or 1ml (liquids)

### 3. Trip Organization

- Multi-day trip planning with up to 20 participants
- No limit on trip duration
- Flexible day management (add, remove, reorder via drag-and-drop)
- Customizable daily meal structure:
    - Default slots: Breakfast, Lunch, Dinner
    - User can customize number and names of meal slots in trip config
    - UI optimized for 1-10 slots, but backend supports unlimited
    - Same structure applies to all days in trip
    - Empty slots allowed if not all meals needed
- Unlimited snacks (separate from ingredients, stored by piece or per 100g)
- Drinks category for hot/cold beverages with water requirements (not included in water tracking)
- Participant management:
    - Participants represented by names or numbers with coefficients
    - Default coefficient: 100% (applied globally to all meals, excluding snacks and drinks)
    - Participants and coefficients can be edited anytime (triggers recalculation)
    - No individual dietary restrictions or meal-skipping management
- Calorie-based portion adjustment using participant coefficients
- Complete nutritional overview by day and total trip
- Weight tracking: total food weight per person and total per day/trip
- Recipe storage options:
    - Default: Complete snapshot of recipes stored in trip
    - Optional: Track live recipe changes (for simultaneous trip planning and recipe editing)

### 4. Camping Stove & Fuel Management

- Add single stove per trip with efficiency rating (g of fuel per 1L boiling water)
- User must input stove specifications (note with common values provided)
- Automatic fuel consumption calculation in grams based on:
    - Total cooking time across all meals
    - Water heating requirements (including drinks)
    - Stove efficiency
- Fuel calculation assumptions:
    - 20°C starting water temperature
    - Sea level conditions
    - 5 minutes per liter boiling time
    - Users can adjust for altitude (+10% per 1000m elevation)
    - Wind/weather factors not calculated automatically
- No safety margin included (user interpretation required)
- Fuel requirements included in trip summary

### 5. Ingredient & Snack Management

- Personal ingredient database with comprehensive nutritional values
- Fixed global common ingredient database
- Ingredients measured in grams only
- Ingredient categories assigned during creation (for shopping list grouping)
- Snacks:
    - Separate list from ingredients (duplication needed if item serves both purposes)
    - Measured by piece or per 100g
    - Cannot be used as recipe ingredients (e.g., protein bars must be snacks)
    - Manual adjustment for group sizes (interface shows 'per person' and 'total' columns)
- When sharing recipes with personal ingredients:
    - Users prompted to copy ingredients or preserve nutritional info in recipe

### 6. Recipe Marketplace & Sharing

- Public recipe marketplace (users explicitly publish recipes)
- Auto-approval for published recipes (approval process possible in future)
- Marketplace display includes:
    - Full nutritional information
    - User ratings and reviews (can rate without trying)
    - Comments
    - Author name
    - Replication count (visible popularity metric)
    - "Forked from" indicator with link (similar to GitHub)
    - Links to fork recipes
- Share functionality:
    - Shareable links for viewing without account
    - No editing without account - public recipes must be forked to edit
    - No live collaboration
    - Public recipes viewable but not editable until forked into user's account
- Publishing permissions:
    - Published recipes can be edited (creates new version)
    - Cannot unpublish if forked >5 times
    - Unpublished recipes become private (not deleted)
    - Existing forks remain unaffected
    - 30-day grace period before full removal
    - Warning shown if recipe used in active trips
    - Recipes in active trips cannot be deleted, only archived
    - Personal notes always private, never shared
- Recipe version control:
    - Complete recipe and nutrients copied into trip plans by default
    - Optional "track changes" in trips (lightweight tracking)
    - Updates don't cascade to other users' copies
    - Forked recipes maintain link to original

### 7. Export & Reports

- Shopping list generation:
    - Consolidated ingredients grouped by category
    - Total quantities only (no per-meal breakdown)
    - Export formats: PDF, Excel, TXT
- Packing lists:
    - Total packing list for entire trip
    - Day-by-day breakdown with all meals and ingredients
- Trip summary exports:
    - Comprehensive nutritional breakdowns
    - Total fuel requirements for trip
    - Water requirements per meal (cooking water only)
    - Total food weight information
    - Export formats: PDF, Excel, TXT
    - Customizable sections (user selects what to include)

### 8. Additional Features

- Meal ratings (1-5 stars) and personal notes
- Day and trip templates for storing favorite base plans (no individual meal templates)
    - Templates include: meal slot configuration, recipe assignments, snack lists
    - Templates exclude: dates, participant names/coefficients, notes
    - Templates store recipe references (always use current versions)
- Calorie target setting for meals (automatic calculation to reach targets)
- PHE tracking for users with phenylketonuria (PKU)
- System limits:
    - 500 recipes per user
    - 100 active trips per user
    - 50 ingredients per recipe
    - 100 characters for names
    - 2000 characters for instructions/notes
    - 5MB per image, 10 images per recipe
- Data retention:
    - Active data retained indefinitely
    - Deleted items kept 30 days in trash
    - Account data deleted after 10 years of inactivity
- Nutritional display precision:
    - Calories: whole numbers
    - Macros: 0.1g precision
    - Vitamins/minerals: 0.01mg or µg precision
    - Values below 0.01 display as '<0.01'

## User Stories

### User Story 1: User Account Creation

As a new user, I want to create an account so that I can save and manage my trips. **Acceptance Criteria:**

- The user can sign up using an email and password (minimum 12 characters with at least one uppercase letter, one lowercase letter, one number, and one special character) or a social media account
- A verification email is sent upon sign-up
- The user can log in and access a personal dashboard that displays their saved trips
- The user can reset their password if needed
- The user can set preferences for units (metric/imperial) and nutritional display (kcal/kJ)
- Interface is available in English and Czech
- **[Phase 1.1 - Post-MVP]** The user can enable two-factor authentication (2FA) after email verification
- **[Phase 1.1 - Post-MVP]** The user must enter a valid TOTP code when logging in with 2FA enabled
- **[Phase 1.1 - Post-MVP]** The user can disable 2FA by entering current password and TOTP code
- **[Phase 1.1 - Post-MVP]** Recovery codes are generated when enabling 2FA (8 codes)

### User Story 2: Recipe Creation

As a user, I want to create a recipe so that I can use it in my trip meal planning. **Acceptance Criteria:**

- The user can create a recipe by giving it a name and selecting ingredients from common or personal lists
- All quantities specified in grams
- The recipe's nutritional information is automatically calculated based on ingredient nutritional values per 100g
- The user can specify the amount of cooking water needed (not drinking water)
- The user can specify cooking time (stove time, excluding water boiling)
- The user can add preparation instructions as a text field
- The user can upload an image of the recipe
- The user can edit the recipe at any time
- The user can duplicate an existing recipe to create variations
- Version tracking shows datetime for multiple saved versions
- Recipes are used as base templates that become meals when added to trip days

### User Story 3: Trip Creation

As a user, I want to create a new trip so that I can organize meals and plan my expedition. **Acceptance Criteria:**

- The user can start a new trip by providing:
    - Trip name
    - Start and end dates
    - Number of participants (up to 20) with names or just numbers
    - Participant coefficients (default 100% for all)
    - Meal slot configuration (default: Breakfast, Lunch, Dinner)
    - Recipe storage preference (snapshot or track changes)
- The user can add or remove days within the trip
- For each day, the user can:
    - Add recipes to configured meal slots (recipes become meals when scaled)
    - Leave slots empty if needed
    - Add unlimited snacks (by piece or weight)
    - Add drinks with water requirements
- The user can edit participants and coefficients anytime (triggers recalculation)
- The user can reorder days by dragging and dropping (all assigned meals, snacks, drinks, and nutritional values move with the day; the trip summary reflects the new order)
- The user can view summaries including:
    - Nutritional breakdown per day and total
    - Food weight per person and total
    - Water requirements per meal
    - Fuel requirements for trip
- The user can edit or delete the trip

### User Story 4: Nutritional Overview

As a user, I want to see a nutritional breakdown of the entire trip so that I can ensure all dietary requirements are met. **Acceptance Criteria:**

- The user can view comprehensive nutritional values including:
    - Total calories, proteins, carbohydrates (with sugars)
    - Fats breakdown (saturated, trans, mono/polyunsaturated, cholesterol)
    - Fiber, salt, calcium, sodium, water, PHE
    - All vitamins
- Values displayed with appropriate precision:
    - Calories: whole numbers
    - Macros: 0.1g
    - Vitamins/minerals: 0.01mg or µg
    - Values <0.01 show as '<0.01'
- Values displayed in user's preferred units (kcal or kJ)
- The nutritional overview updates dynamically as meals are adjusted
- The user can see both overall trip summary and daily breakdowns
- The user can export this nutritional overview with customizable sections

### User Story 5: Meal and Snack Adjustment by Participant

As a user, I want to customize meal portions for each participant so that everyone's dietary needs are met. **Acceptance Criteria:**

- The user sets a base calorie target per person for each meal
- Each participant has a coefficient (default 100%)
- The system automatically calculates ingredient quantities to reach target calories
- Example: 600 kcal base with 150% coefficient = 900 kcal portion
- Coefficients apply globally to all meals (not to snacks or drinks)
- Coefficients cannot be adjusted per meal or per day
- No option to exclude participants from specific meals


### User Story 6: Shopping List Generation

As a user, I want to generate a shopping list based on my trip plan. **Acceptance Criteria:**

- The user can generate a consolidated shopping list for the entire trip
- Ingredients are grouped by category
- Shows total quantity needed for each item (not per-meal breakdown)
- Reflects all adjustments from participant coefficients and portion sizes
- Can be regenerated after trip changes
- Displayed in user's preferred unit system

### User Story 7: Packing List Generation

As a user, I want to generate a packing list for efficient food organization. **Acceptance Criteria:**

- The user can generate two types of packing lists:
    - Total packing list for entire trip
    - Day-by-day breakdown
- Each day shows all meals, snacks, and drinks with exact quantities
- Includes ingredient quantities adjusted for participants
- Shows food weight information
- Can be regenerated after trip changes
- Available for printing or export

**Note: This functionality is also available as part of the comprehensive Trip Summary Export (User Story 16), which includes packing lists along with other trip documentation.**

### User Story 8: Recipe Duplication, Marketplace, and Sharing

As a user, I want to browse, duplicate, and share recipes with other users. **Acceptance Criteria:**

**Marketplace Features:**
- Users can browse public recipe marketplace
- Each recipe displays:
    - Full nutritional information
    - Replication count
    - Marketplace Rating (average of all public reviews, 1-5 stars)
    - Number of marketplace reviews
    - Author information
- Users can duplicate any public recipe (fork it to their account)
- Users can rate and review marketplace recipes after forking them:
    - Marketplace Rating: 1-5 stars (public, affects recipe ranking)
    - Marketplace Review: text up to 1000 characters (public)
    - Users can only submit one marketplace review per recipe they've forked
- Replication counter increases when duplicated
- Users choose whether to publish their recipes
- Modified recipes can be kept private or shared back
- No account required to view public recipes

**Recipe Sharing (formerly US-9):**
- Users can generate shareable links for recipes
- Share links have expiration dates:
    - Default expiration: 30 days
    - User can set custom expiration (1-365 days)
    - Expired links show "This link has expired" message
    - Users can regenerate expired links
- Recipients can view all details without an account
- Recipients must create account and fork recipe to modify
- Original recipes remain unchanged
- No live collaboration on shared recipes
- Public recipes must be forked before editing
- No external editing without account

**Recipe Management Rules:**
- Recipe unpublishing rules:
    - Authors can unpublish anytime if fork count ≤ 5
    - Cannot unpublish if fork count > 5 (recipe too popular)
    - Unpublished recipes become private (not deleted)
    - Existing forks remain unaffected
    - 30-day grace period before full removal
    - Warning shown if recipe used in active trips

### User Story 9: Recipe Sharing (Merged with Marketplace)

**Note: This functionality is now part of User Story 8 (Recipe Duplication and Marketplace). Recipe sharing is handled through the public marketplace and share links.**

See User Story 8 for:
- Public recipe marketplace functionality
- Generating shareable links for recipes
- Forking shared recipes
- Share link expiration and management

### User Story 10: Recipe Change Management (formerly US-11)

As a user, I want to manage recipe updates in my trip plans. **Acceptance Criteria:**

- Complete recipes with nutrients are copied into trip plans
- Optional "track changes" mode for lightweight tracking
- When editing a recipe used in trips, user chooses to update or keep original
- Updated recipes can replace old versions in selected days
- Original versions can be preserved while saving edited version as new
- Version history shows datetime information

### User Story 11: Calorie Target Setting for Meals (formerly US-12)

As a user, I want to set calorie targets for meals to meet energy needs. **Acceptance Criteria:**

- User sets specific calorie target per person for each meal
- System automatically calculates ingredient quantities to reach target
- Shows progress toward calorie target as ingredients are added
- Works with participant coefficients for proper scaling
- This is the core functionality of the tool

### User Story 12: Ingredient Management (formerly US-13)

As a user, I want to manage my personal ingredient list. **Acceptance Criteria:**

- Users can add new ingredients with:
    - Name
    - Category (for shopping list grouping)
    - Nutritional values per 100g (calories and macros required, rest optional)
- Users can edit existing personal ingredients
- Users can remove unused ingredients
- Personal list is separate from fixed global common list
- All measurements in grams only
- Note: Missing nutritional data will reduce tracking accuracy

### User Story 13: Personal Meal Ratings and Notes (formerly US-14)

As a user, I want to rate meals in my trips and add notes for future reference. **Acceptance Criteria:**

- Users can rate each meal instance in their trips 1-5 stars (Personal Rating)
- Personal ratings are private and stored with the user's meal instance in their trip
- Users can add personal notes (max 2000 characters) for modifications or feedback
- Personal ratings and notes are saved with the specific meal occurrence in the trip
- Personal ratings are completely separate from public marketplace ratings
- Personal ratings help track favorite meals for future trip planning
- Users can only add personal ratings to meals in their own trips

### User Story 14: Day and Trip Templates (formerly US-15)

As a user, I want to create templates for quick trip planning. **Acceptance Criteria:**

- Users can save entire days or trips as templates
- Templates store complete meal structures and content
- Templates serve as favorite base plans
- Users can apply templates when planning new trips
- Templates can be edited and updated
- Changes to templates don't affect existing trips
- No individual meal templates - only day or trip level

### User Story 15: Snack Management (formerly US-16)

As a user, I want to manage snacks separately from meal ingredients. **Acceptance Criteria:**

- Users can view default snacks available to all
- Users can add personal snacks with:
    - Measurement by piece or per 100g
    - Full nutritional information
- Snacks cannot be used as meal ingredients
- Items appearing as both require duplication
- Users can edit or remove personal snacks
- Easy addition to specific days when planning
- Manual quantity adjustment for group size
- Interface displays 'per person' and 'total' columns for calculations

### User Story 16: Trip Summary Export (formerly US-17)

As a user, I want to export comprehensive trip documentation. **Acceptance Criteria:**

- Users can generate summary including:
    - All planned meals (recipes scaled to portions), snacks, drinks
    - Complete nutritional details
    - Packing lists (both total and day-by-day breakdown - see also US-7)
    - Shopping lists (grouped by category - see also US-6)
    - Total fuel requirements
    - Water requirements per meal (cooking water)
    - Food weight per person and total
- Export formats available: PDF, Excel, TXT
- Users select which sections to include
- Export reflects user's unit preferences
- Suitable for printing or digital reference

**Note: This comprehensive export includes functionality from:**
- **User Story 6**: Shopping List Generation
- **User Story 7**: Packing List Generation
Users can export these individually or as part of the complete trip documentation.

### User Story 17: Stove and Fuel Management (formerly US-18)

As a user, I want to calculate fuel requirements for my camping stove. **Acceptance Criteria:**

- User adds single stove per trip with efficiency rating (g fuel/L water)
- Common stove values provided as reference
- System calculates total fuel in grams based on:
    - All meal cooking times
    - Water heating for meals and drinks
    - Stove efficiency
    - Default assumptions: 20°C water, sea level, 5 min/L boiling
- User can adjust for altitude (+10% per 1000m)
- No automatic safety margin (user discretion)
- Fuel calculation included in trip summary and exports

### User Story 18: Comprehensive Nutritional Tracking (formerly US-19)

As a user, I want detailed nutritional information for trip planning. **Acceptance Criteria:**

- Each meal displays full breakdown:
    - Proteins
    - Carbohydrates (with sugars subset)
    - Fats (saturated, trans, mono/polyunsaturated, cholesterol)
    - Fiber, salt, calcium, sodium, water, PHE
    - All vitamins
- Trip summary shows aggregated data
- Daily breakdowns include all nutrients
- PHE tracking specifically for users with PKU
- Display in user's preferred units

### User Story 19: Daily Meal Structure (formerly US-20)

As a user, I want flexible meal organization for different trip types. **Acceptance Criteria:**

- Default structure: Breakfast, Lunch, Dinner
- User can customize in trip configuration:
    - Number of meal slots (flexible)
    - Names of meal slots
    - UI optimized for 1-10 slots, but backend supports unlimited
- Same structure applies to all days in trip
- Empty slots allowed if not all meals needed
- Unlimited snacks throughout the day
- Separate drinks category with:
    - Ingredient list (e.g., coffee beans, tea bags)
    - Hot water requirements
    - Nutritional contributions (e.g., electrolytes)
- Clear labeling and organization in daily view
- Water requirements calculated for cooking only (drinks not included in water tracking)

### User Story 20: Trip Sharing (formerly US-21)

As a user, I want to share my complete trip plans with others so they can use them for their own expeditions. **Acceptance Criteria:**

- Users can generate shareable links for entire trips
- Share links have expiration dates:
    - Default expiration: 30 days
    - User can set custom expiration (1-365 days)
    - Expired links show "This link has expired" message
    - Users can regenerate expired links
- Recipients can view full trip details without an account:
    - All days with meals, snacks, and drinks
    - Nutritional information
    - Participant setup
    - Shopping and packing lists
- Recipients must create account to duplicate and modify the trip
- Original trip remains unchanged when duplicated
- Shared trips show participant count and duration in preview
- No live collaboration - each user works on their own copy

---

## Consolidation Notes

**Total User Stories: 20** (reduced from 21 after merging)

### Merged User Stories:
1. **User Story 9 (Recipe Sharing)** has been merged into **User Story 8 (Recipe Duplication, Marketplace, and Sharing)**
   - All recipe sharing functionality is now consolidated under US-8
   - This eliminates duplication between marketplace sharing and direct sharing features

### Cross-Referenced Features:
1. **User Story 7 (Packing List Generation)** functionality is also available in **User Story 16 (Trip Summary Export)**
2. **User Story 6 (Shopping List Generation)** functionality is also available in **User Story 16 (Trip Summary Export)**
3. Day reordering functionality remains part of **User Story 3 (Trip Creation)** as originally designed

These consolidations improve clarity and eliminate redundancy while maintaining all required functionality.