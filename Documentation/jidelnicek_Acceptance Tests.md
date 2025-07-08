# Jídelníček - Acceptance Test Specification

## Overview
This document contains the acceptance test specifications for the Jídelníček meal planning application. Each test is mapped to the corresponding user story (US-1 through US-20) and includes detailed test steps, expected results, and test data requirements.

## Pragmatic Testing Approach for Solo Developer

### Testing Philosophy
As a solo developer, focus on:
1. **Critical Path Testing**: Test features that directly impact core functionality and data integrity
2. **Automated Testing**: Write unit tests for calculations and business logic
3. **Manual Testing**: Accept manual testing for UI features and non-critical paths
4. **Risk-Based Priority**: Focus on areas where bugs would have the highest impact

### Test Prioritization
- **Must Test (30-40%)**: Core functionality that could break the app or corrupt data
- **Should Test (30%)**: Important features that affect user experience
- **Manual Test OK (30-40%)**: Nice-to-have features that can be tested during development

### Realistic Expectations
- Target: ~100 active users initially (not 10,000)
- Focus on MVP features first
- Implement monitoring/logging to catch issues in production
- Iterate based on real user feedback

## Test Specification Format
- **Test ID**: Unique identifier (AT-X.Y where X is the US number, Y is the test case number)
- **Test Description**: Brief description of what is being tested
- **Preconditions**: Required state before test execution
- **Test Steps**: Detailed steps to execute the test
- **Expected Results**: Expected system behavior and outcomes
- **Test Data**: Required test data
- **Priority**: High/Medium/Low based on feature criticality
- **Priority for Solo Dev**: Must Test / Should Test / Manual Test OK

---

## User Story 1: User Account Creation

| Test ID | Test Description | Preconditions | Test Steps | Expected Results | Test Data | Priority | Priority for Solo Dev |
|---------|------------------|---------------|------------|------------------|-----------|----------|
| AT-1.1 | Create account with email/password | User not registered | 1. Navigate to registration page<br>2. Enter valid email and password<br>3. Click "Register"<br>4. Check email inbox | 1. Registration form displayed<br>2. Form accepts input<br>3. Success message shown<br>4. Verification email received | Email: test@example.com<br>Password: Test123!Pass | High | Must Test |
| AT-1.2 | Create account with social login | User has Google account | 1. Navigate to registration page<br>2. Click "Sign up with Google"<br>3. Complete Google authentication | 1. Google auth window opens<br>2. Successful authentication<br>3. Account created and user logged in | Valid Google account | High | Should Test |
| AT-1.3 | Email verification | Account created but not verified | 1. Click verification link in email<br>2. Observe page response | 1. Verification successful message<br>2. Account status updated to verified | Valid verification token | High | Must Test |
| AT-1.4 | Password reset | Existing verified account | 1. Click "Forgot password"<br>2. Enter registered email<br>3. Check email<br>4. Click reset link<br>5. Enter new password | 1. Reset form displayed<br>2. Email sent confirmation<br>3. Reset email received<br>4. Password change form shown<br>5. Password successfully changed | Valid email address | High | Should Test |
| AT-1.5 | Set user preferences | Logged in user | 1. Navigate to settings<br>2. Select Imperial units<br>3. Select kJ display<br>4. Save preferences | 1. Settings page displayed<br>2. Units changed to Imperial<br>3. Nutrition display changed to kJ<br>4. Preferences saved and applied | None | Medium | Manual Test OK |
| AT-1.6 | **[Post-MVP]** Enable 2FA | Verified email account | 1. Navigate to security settings<br>2. Click "Enable 2FA"<br>3. Scan QR code with authenticator app<br>4. Enter TOTP code<br>5. Save recovery codes | 2FA enabled, recovery codes displayed | Valid TOTP app | High | Post-MVP |
| AT-1.7 | **[Post-MVP]** Login with 2FA | 2FA enabled account | 1. Enter email and password<br>2. Enter TOTP code from app<br>3. Click login | Successfully logged in | Valid TOTP code | High | Post-MVP |
| AT-1.8 | **[Post-MVP]** Disable 2FA | 2FA enabled account | 1. Go to security settings<br>2. Click "Disable 2FA"<br>3. Enter password and TOTP code<br>4. Confirm | 2FA disabled | Valid credentials | Medium | Post-MVP |
| AT-1.9 | Language switching | Any page loaded | 1. Click language selector<br>2. Switch from English to Czech<br>3. Navigate through pages | 1. Language options shown<br>2. Interface changes to Czech<br>3. All pages display in Czech | None | Medium | Manual Test OK |
| AT-1.10 | Basic Email/Password Login Test | Registered user | 1. Navigate to login page<br>2. Enter valid email and password<br>3. Click "Login"<br>4. Verify successful login | 1. Login form displayed<br>2. Credentials accepted<br>3. Login process initiated<br>4. JWT token received, dashboard displayed | Email: test@example.com<br>Password: Test123!Pass | High | Must Test |

## User Story 2: Recipe Creation

| Test ID | Test Description | Preconditions | Test Steps | Expected Results | Test Data | Priority | Priority for Solo Dev |
|---------|------------------|---------------|------------|------------------|-----------|----------|
| AT-2.1 | Create basic recipe | Logged in user | 1. Click "Create Recipe"<br>2. Enter recipe name<br>3. Add 3 ingredients with quantities<br>4. Save recipe | 1. Recipe form displayed<br>2. Name accepted<br>3. Ingredients added, quantities in grams<br>4. Recipe saved, nutrition calculated | Recipe: Oatmeal<br>Ingredients: Oats 100g, Milk powder 50g, Sugar 20g | High | Must Test |
| AT-2.2 | Specify water and cooking time | Recipe creation form open | 1. Enter cooking water: 300ml<br>2. Enter cooking time: 5 minutes<br>3. Save recipe | 1. Water field accepts ml value<br>2. Time field accepts minutes<br>3. Values saved with recipe | Water: 300ml<br>Time: 5 min | High | Must Test |
| AT-2.3 | Add preparation instructions | Recipe creation form open | 1. Enter instructions in text field<br>2. Format with line breaks<br>3. Save recipe | 1. Text field accepts multi-line input<br>2. Formatting preserved<br>3. Instructions saved and displayed | "1. Boil water\n2. Add oats\n3. Stir for 5 minutes" | Medium | Manual Test OK |
| AT-2.4 | Upload recipe image | Recipe creation form open | 1. Click "Upload Image"<br>2. Select image file<br>3. Wait for upload<br>4. Save recipe | 1. File selector opens<br>2. Image preview shown<br>3. Upload progress displayed<br>4. Image saved with recipe | JPEG image < 5MB | Medium | Manual Test OK |
| AT-2.5 | Duplicate existing recipe | Existing recipe saved | 1. Open existing recipe<br>2. Click "Duplicate"<br>3. Modify name<br>4. Save | 1. Recipe details loaded<br>2. New recipe form with copied data<br>3. Name changed<br>4. New recipe created | Existing recipe | Medium | Should Test |
| AT-2.6 | View recipe version history | Recipe edited multiple times | 1. Open recipe<br>2. Click "Version History"<br>3. Select older version<br>4. Click "Restore" | 1. Recipe loaded<br>2. Last 5 versions displayed with timestamps<br>3. Old version details shown<br>4. Recipe restored to selected version | Recipe with 5+ edits | Low | Manual Test OK |
| AT-2.7 | Nutritional calculation validation | Recipe with known ingredients | 1. Add 100g ingredient with known nutrition<br>2. Add 50g of another ingredient<br>3. Verify total nutrition | 1. Ingredient nutrition displayed<br>2. Second ingredient added<br>3. Total calories and macros correctly summed | Ingredients with complete nutritional data | High | Must Test |
| AT-2.8 | Recipe Editing Test | User with existing recipe | 1. Open existing recipe<br>2. Edit ingredient quantities<br>3. Modify instructions<br>4. Save changes | 1. Recipe loaded in edit mode<br>2. Quantities updated<br>3. Instructions changed<br>4. Changes saved, version history updated, nutrition recalculated | Existing recipe with 3+ ingredients | High | Must Test |

## User Story 3: Trip Creation

| Test ID | Test Description | Preconditions | Test Steps | Expected Results | Test Data | Priority | Priority for Solo Dev |
|---------|------------------|---------------|------------|------------------|-----------|----------|
| AT-3.1 | Create new trip | Logged in user | 1. Click "Create Trip"<br>2. Enter trip name<br>3. Set dates (5 days)<br>4. Add 4 participants<br>5. Save trip | 1. Trip form displayed<br>2. Name accepted<br>3. Date range selected<br>4. Participants added with default 100% coefficient<br>5. Trip created with 5 days | Trip: "Summer Hike"<br>Dates: July 1-5<br>Participants: 4 | High | Must Test |
| AT-3.2 | Configure custom meal slots | Trip creation form | 1. Click "Customize Meals"<br>2. Add "Second Breakfast"<br>3. Rename "Lunch" to "Trail Lunch"<br>4. Save configuration | 1. Meal configuration opens<br>2. New slot added<br>3. Slot renamed<br>4. All days show new structure | Custom slots: Breakfast, Second Breakfast, Trail Lunch, Dinner | Medium | Should Test |
| AT-3.3 | Add recipes to meal slots | Trip with days created | 1. Select Day 1<br>2. Add recipe to Breakfast<br>3. Leave Lunch empty<br>4. Add recipe to Dinner | 1. Day 1 displayed<br>2. Recipe added, scaled for participants<br>3. Lunch slot remains empty<br>4. Dinner recipe added | 2 existing recipes | High | Must Test |
| AT-3.4 | Add snacks and drinks | Trip day open | 1. Click "Add Snacks"<br>2. Add 3 snack items<br>3. Click "Add Drinks"<br>4. Add coffee with water requirement | 1. Snack interface opens<br>2. Snacks added with quantities<br>3. Drinks section available<br>4. Coffee added with 200ml water | Snacks: Nuts, Chocolate, Energy bars<br>Coffee: 10g, 200ml water | Medium | Should Test |
| AT-3.5 | Modify participant coefficients | Trip with participants | 1. Edit participant 2<br>2. Change coefficient to 150%<br>3. Save changes<br>4. Check meal portions | 1. Edit dialog opens<br>2. Coefficient updated<br>3. Changes saved<br>4. All meals recalculated for 150% portion | Coefficient: 150% | High | Must Test |
| AT-3.6 | Reorder days | Trip with 5 days | 1. Drag Day 3 to Day 1 position<br>2. Release drag<br>3. Verify new order | 1. Drag interface activated<br>2. Days reordered<br>3. Day 3 content now in Day 1 position | None | Medium | Manual Test OK |
| AT-3.7 | View trip summary | Trip with meals planned | 1. Click "Trip Summary"<br>2. Review nutritional totals<br>3. Check weight calculations<br>4. Verify fuel requirements | 1. Summary page displayed<br>2. Total nutrition for trip shown<br>3. Weight per person and total displayed<br>4. Fuel calculation based on cooking times | Complete trip data | High | Must Test |
| AT-3.8 | Add/Remove Trip Days Test | 3-day trip | 1. Open existing 3-day trip<br>2. Click "Add Day" twice<br>3. Review 5-day trip<br>4. Remove day 4 | 1. Trip loaded with 3 days<br>2. 2 new days added (now 5 days)<br>3. All days displayed sequentially<br>4. Day removed, trip has 4 days total, meal slots adjusted, day numbers sequential | Existing 3-day trip | High | Must Test |

## User Story 4: Nutritional Overview

| Test ID | Test Description | Preconditions | Test Steps | Expected Results | Test Data | Priority | Priority for Solo Dev |
|---------|------------------|---------------|------------|------------------|-----------|----------|
| AT-4.1 | View comprehensive nutrition | Trip with meals | 1. Open trip summary<br>2. Check macro display<br>3. Check micro display<br>4. Verify vitamin display | 1. Summary loads<br>2. Proteins, carbs, fats shown to 0.1g<br>3. Minerals shown to 0.01mg<br>4. All vitamins listed | Trip with complete meals | High | Must Test |
| AT-4.2 | Verify nutrition precision | Trip with known values | 1. Add ingredient with 0.005g sodium<br>2. Check display<br>3. Add 1234.56 calories<br>4. Check rounding | 1. Ingredient added<br>2. Shows "<0.01"<br>3. Calories added<br>4. Displays as "1235" | Precise nutritional values | Medium | Should Test |
| AT-4.3 | Daily vs total view | Multi-day trip | 1. View Day 1 nutrition<br>2. View Day 2 nutrition<br>3. View total trip nutrition<br>4. Verify sum | 1. Day 1 totals shown<br>2. Day 2 totals shown<br>3. Trip total displayed<br>4. Total equals sum of days | 3-day trip | High | Must Test |
| AT-4.4 | Unit preference display | User with kJ preference | 1. View nutrition in kcal<br>2. Switch to kJ in settings<br>3. Return to nutrition view | 1. Values shown in kcal<br>2. Preference updated<br>3. Same values now in kJ | None | Medium | Manual Test OK |
| AT-4.5 | Export nutritional overview | Trip with nutrition data | 1. Click "Export"<br>2. Select sections<br>3. Choose PDF format<br>4. Download | 1. Export dialog opens<br>2. Sections selectable<br>3. Format selected<br>4. PDF generated with selected data | None | Medium | Should Test |

## User Story 5: Meal and Snack Adjustment by Participant

| Test ID | Test Description | Preconditions | Test Steps | Expected Results | Test Data | Priority | Priority for Solo Dev |
|---------|------------------|---------------|------------|------------------|-----------|----------|
| AT-5.1 | Set base calorie target | Meal in trip | 1. Select breakfast<br>2. Set target: 600 kcal<br>3. Save target<br>4. Check scaling | 1. Meal selected<br>2. Target field accepts value<br>3. Target saved<br>4. Ingredients scaled to reach 600 kcal | Target: 600 kcal | High | Must Test |
| AT-5.2 | Verify coefficient application | Participant with 150% coefficient | 1. Set meal to 600 kcal base<br>2. Check participant's portion<br>3. Verify ingredients scaled | 1. Base target set<br>2. Shows 900 kcal for participant<br>3. All ingredients x1.5 | Base: 600 kcal<br>Coefficient: 150% | High | Must Test |
| AT-5.3 | Verify snacks unaffected | Participants with different coefficients | 1. Add snacks to day<br>2. Set different coefficients<br>3. Check snack quantities | 1. Snacks added<br>2. Coefficients varied<br>3. Snack quantities unchanged | Various coefficients | Medium | Should Test |
| AT-5.4 | Global coefficient impact | Multiple meals and days | 1. Set participant to 75%<br>2. Check all breakfasts<br>3. Check all dinners<br>4. Verify consistency | 1. Coefficient updated<br>2. All breakfasts reduced 25%<br>3. All dinners reduced 25%<br>4. Consistent across trip | Coefficient: 75% | High | Must Test |

## User Story 6: Shopping List Generation

| Test ID | Test Description | Preconditions | Test Steps | Expected Results | Test Data | Priority | Priority for Solo Dev |
|---------|------------------|---------------|------------|------------------|-----------|----------|
| AT-6.1 | Generate basic shopping list | Complete trip plan | 1. Click "Generate Shopping List"<br>2. Review grouped items<br>3. Verify quantities<br>4. Check totals | 1. Generation dialog opens<br>2. Items grouped by category<br>3. Quantities summed correctly<br>4. All ingredients included | Trip with 10+ ingredients | High | Must Test |
| AT-6.2 | Coefficient impact on list | Participants with varied coefficients | 1. Generate list<br>2. Note quantities<br>3. Change coefficient<br>4. Regenerate list | 1. Initial list generated<br>2. Quantities recorded<br>3. Coefficient updated<br>4. New quantities reflect change | Various coefficients | High | Must Test |
| AT-6.3 | Category grouping | Ingredients with categories | 1. Add ingredients from different categories<br>2. Generate list<br>3. Verify grouping | 1. Ingredients added<br>2. List generated<br>3. Items grouped: Dairy, Grains, etc. | 5+ categories | Medium | Should Test |
| AT-6.4 | Unit preference in list | User with Imperial units | 1. Set Imperial preference<br>2. Generate list<br>3. Check unit display | 1. Preference set<br>2. List generated<br>3. Weights shown in oz/lbs | Imperial preference | Medium | Manual Test OK |

## User Story 7: Packing List Generation

| Test ID | Test Description | Preconditions | Test Steps | Expected Results | Test Data | Priority | Priority for Solo Dev |
|---------|------------------|---------------|------------|------------------|-----------|----------|
| AT-7.1 | Total packing list | Complete trip | 1. Select "Total Packing List"<br>2. Generate list<br>3. Review contents | 1. Option selected<br>2. List generated<br>3. All items with total quantities shown | Multi-day trip | High | Must Test |
| AT-7.2 | Day-by-day packing | Complete trip | 1. Select "Day-by-Day List"<br>2. Generate list<br>3. Check each day | 1. Option selected<br>2. List generated<br>3. Each day shows its specific items | 5-day trip | High | Should Test |
| AT-7.3 | Weight information | Trip with meals | 1. Generate packing list<br>2. Check weight per person<br>3. Check total weight<br>4. Verify calculations | 1. List generated<br>2. Individual weights shown<br>3. Total weight displayed<br>4. Math verified correct | Known weights | High | Must Test |
| AT-7.4 | Export packing list | Generated list | 1. Click "Export"<br>2. Select Excel format<br>3. Download file<br>4. Open in Excel | 1. Export options shown<br>2. Format selected<br>3. File downloaded<br>4. Data correctly formatted | None | Medium | Manual Test OK |

## User Story 8: Recipe Duplication and Marketplace

| Test ID | Test Description | Preconditions | Test Steps | Expected Results | Test Data | Priority | Priority for Solo Dev |
|---------|------------------|---------------|------------|------------------|-----------|----------|
| AT-8.1 | Browse marketplace | User logged in | 1. Navigate to marketplace<br>2. View recipe list<br>3. Check displayed info<br>4. Sort by rating | 1. Marketplace loads<br>2. Recipes displayed<br>3. Shows nutrition, marketplace rating (avg), review count, author<br>4. List sorted by marketplace rating | None | High | Should Test |
| AT-8.2 | Fork public recipe | Recipe in marketplace | 1. Select recipe<br>2. Click "Fork Recipe"<br>3. Recipe copied to account<br>4. Check replication count | 1. Recipe details shown<br>2. Fork confirmed<br>3. Recipe in user's list<br>4. Fork count increased by 1 | Public recipe | High | Should Test |
| AT-8.3 | Add marketplace review | Forked recipe | 1. Go to "My Recipes"<br>2. Find forked recipe<br>3. Click "Review in Marketplace"<br>4. Rate 4 stars<br>5. Write review (500 chars)<br>6. Submit | 1. User's recipes shown<br>2. Forked recipe found<br>3. Marketplace review form opens<br>4. 4 stars selected<br>5. Review text entered<br>6. Review published publicly | Rating: 4 stars<br>Review: "Great recipe! I added extra spices for more flavor. Perfect for high altitude cooking." | Medium | Should Test |
| AT-8.4 | Cannot review without forking | Public recipe not forked | 1. View marketplace recipe<br>2. Look for review option<br>3. See "Fork to review" message | 1. Recipe displayed<br>2. No review option available<br>3. Message explains need to fork first | Unforked recipe | High | Should Test |
| AT-8.5 | Update existing review | Previously reviewed recipe | 1. Find reviewed recipe<br>2. Click "Edit Review"<br>3. Change to 5 stars<br>4. Update text<br>5. Save | 1. Recipe with review shown<br>2. Edit form opens with current review<br>3. Rating changed<br>4. Text updated<br>5. Review updated (not duplicated) | Updated to 5 stars | Medium | Manual Test OK |
| AT-8.6 | Publish own recipe | Personal recipe created | 1. Open personal recipe<br>2. Click "Publish"<br>3. Confirm publication<br>4. View in marketplace | 1. Recipe loaded<br>2. Publish option available<br>3. Recipe published<br>4. Visible in marketplace with 0 reviews | Complete recipe | High | Should Test |
| AT-8.7 | View without account | Logged out user | 1. Navigate to marketplace<br>2. View recipe details<br>3. See marketplace ratings/reviews<br>4. Attempt to fork | 1. Marketplace accessible<br>2. Full details visible<br>3. All public reviews shown<br>4. Prompted to create account | None | Medium | Manual Test OK |
| AT-8.8 | Generate share link | Personal recipe | 1. Open recipe<br>2. Click "Share"<br>3. Copy link<br>4. Test in private browser | 1. Recipe displayed<br>2. Share dialog opens<br>3. Link copied<br>4. Recipe viewable without login | None | High | Should Test |
| AT-8.9 | Fork shared recipe | Share link available | 1. Open share link<br>2. Click "Fork Recipe"<br>3. Create account<br>4. Fork completes | 1. Recipe displayed<br>2. Fork option shown<br>3. Registration required<br>4. Recipe copied to account | Valid share link | High | Should Test |
| AT-8.10 | Verify no external editing | Shared recipe link | 1. Open shared link<br>2. Look for edit options<br>3. Verify read-only | 1. Recipe displayed<br>2. No edit buttons<br>3. Only view mode available | Share link | Medium | Manual Test OK |
| AT-8.11 | Original unchanged | Recipe shared and forked | 1. Fork shared recipe<br>2. Edit forked version<br>3. Check original via link | 1. Recipe forked<br>2. Changes saved<br>3. Original remains unchanged | Shared recipe | High | Must Test |
| AT-8.12 | Set custom expiration | Personal recipe | 1. Open recipe<br>2. Click "Share"<br>3. Set expiry to 7 days<br>4. Generate link | 1. Recipe displayed<br>2. Share dialog with expiry options<br>3. Custom expiry accepted<br>4. Link generated with 7-day expiry | Expiry: 7 days | Medium | Should Test |
| AT-8.13 | Expired link message | Expired share link | 1. Access expired link<br>2. View error page<br>3. Check for data leakage<br>4. Verify no access | 1. Link accessed<br>2. "This link has expired" shown<br>3. No recipe data exposed<br>4. Cannot view recipe | Expired link | High | Must Test |
| AT-8.14 | Regenerate expired link | Recipe with expired link | 1. Open recipe<br>2. See expired link status<br>3. Click "Regenerate"<br>4. New link created | 1. Recipe displayed<br>2. Shows link expired<br>3. Regenerate option available<br>4. New link with fresh expiry | Previously shared recipe | Medium | Should Test |

## User Story 9: Recipe Sharing (Merged into US-8)

**Note: Recipe sharing tests have been merged into User Story 8 (Recipe Duplication, Marketplace, and Sharing). The following tests are now part of AT-8.x series:**

| Test ID | Description | New Test ID |
|---------|-------------|-------------|
| AT-10.1 | Generate share link | AT-8.8 |
| AT-10.2 | Fork shared recipe | AT-8.9 |
| AT-10.3 | Verify no external editing | AT-8.10 |
| AT-10.4 | Original unchanged | AT-8.11 |
| AT-10.5 | Set custom expiration | AT-8.12 |
| AT-10.6 | Expired link message | AT-8.13 |
| AT-10.7 | Regenerate expired link | AT-8.14 |

## User Story 10: Recipe Change Management

| Test ID | Test Description | Preconditions | Test Steps | Expected Results | Test Data | Priority | Priority for Solo Dev |
|---------|------------------|---------------|------------|------------------|-----------|----------|
| AT-10.1 | Recipe snapshot in trip | Trip with recipes | 1. Add recipe to trip<br>2. Edit original recipe<br>3. Check trip version<br>4. Verify unchanged | 1. Recipe added<br>2. Original modified<br>3. Trip version displayed<br>4. Trip keeps original version | Recipe in trip | High | Must Test |
| AT-10.2 | Track changes mode | Trip creation | 1. Enable "track changes"<br>2. Add recipe<br>3. Edit recipe<br>4. Check trip update | 1. Mode enabled<br>2. Recipe added<br>3. Recipe modified<br>4. Trip shows updated version | Track changes enabled | Medium | Manual Test OK |
| AT-10.3 | Update selected days | Recipe used multiple days | 1. Edit recipe<br>2. Select "Update in trips"<br>3. Choose days 1 and 3<br>4. Verify updates | 1. Recipe edited<br>2. Update dialog shown<br>3. Days selected<br>4. Only selected days updated | Recipe in 5 days | Medium | Manual Test OK |
| AT-10.4 | Version history tracking | Recipe with edits | 1. Make 3 edits<br>2. View history<br>3. Check timestamps<br>4. Restore version 2 | 1. Edits saved<br>2. History shows 3 versions<br>3. Each has timestamp<br>4. Version 2 restored | Multiple edits | Low | Manual Test OK |

## User Story 11: Calorie Target Setting for Meals

| Test ID | Test Description | Preconditions | Test Steps | Expected Results | Test Data | Priority | Priority for Solo Dev |
|---------|------------------|---------------|------------|------------------|-----------|----------|
| AT-11.1 | Set meal calorie target | Meal with recipe | 1. Select meal<br>2. Set 800 kcal target<br>3. System calculates<br>4. Verify scaling | 1. Meal selected<br>2. Target entered<br>3. Auto-calculation runs<br>4. Ingredients scaled to 800 kcal | Target: 800 kcal | High | Must Test |
| AT-11.2 | Progress indicator | Partial recipe | 1. Start with 400 kcal recipe<br>2. Set 800 kcal target<br>3. See progress: 50%<br>4. Scale to target | 1. Initial calories shown<br>2. Target set<br>3. Progress bar at 50%<br>4. Recipe scaled x2 | 400 kcal recipe | High | Should Test |
| AT-11.3 | Multi-participant scaling | 4 participants, varied coefficients | 1. Set 600 kcal base<br>2. Check each portion<br>3. Verify total ingredients | 1. Base target set<br>2. Each shows scaled amount<br>3. Total = sum of all portions | Base: 600 kcal<br>Coefficients: 100%, 150%, 75%, 100% | High | Must Test |
| AT-11.4 | Automatic recalculation | Target changed | 1. Set 500 kcal<br>2. View quantities<br>3. Change to 700 kcal<br>4. Verify new quantities | 1. Initial target set<br>2. Quantities calculated<br>3. New target set<br>4. Quantities recalculated | Targets: 500, 700 kcal | High | Should Test |

## User Story 12: Ingredient Management

| Test ID | Test Description | Preconditions | Test Steps | Expected Results | Test Data | Priority | Priority for Solo Dev |
|---------|------------------|---------------|------------|------------------|-----------|----------|
| AT-12.1 | Add personal ingredient | Logged in user | 1. Go to ingredients<br>2. Click "Add New"<br>3. Enter all nutrition<br>4. Save ingredient | 1. Ingredient list shown<br>2. Form opens<br>3. All fields filled<br>4. Ingredient saved | Name: "Chia seeds"<br>Calories: 486/100g<br>Protein: 17g<br>Carbs: 42g<br>Fat: 31g | High | Should Test |
| AT-12.2 | Minimal nutrition data | New ingredient form | 1. Enter name<br>2. Enter only calories and macros<br>3. Leave vitamins empty<br>4. Save with warning | 1. Name entered<br>2. Required fields filled<br>3. Optional fields empty<br>4. Saves with accuracy warning | Minimal data only | Medium | Manual Test OK |
| AT-12.3 | Edit personal ingredient | Existing ingredient | 1. Select ingredient<br>2. Click "Edit"<br>3. Update values<br>4. Save changes | 1. Ingredient loaded<br>2. Edit form opens<br>3. Values modified<br>4. Changes saved | Updated nutrition values | Medium | Manual Test OK |
| AT-12.4 | Category assignment | New ingredient | 1. Create ingredient<br>2. Select "Grains" category<br>3. Save<br>4. Verify in shopping list | 1. Form displayed<br>2. Category selected<br>3. Ingredient saved<br>4. Appears under Grains | Category: Grains | Medium | Should Test |
| AT-12.5 | Remove unused ingredient | Ingredient not in recipes | 1. Select ingredient<br>2. Click "Delete"<br>3. Confirm deletion<br>4. Verify removed | 1. Ingredient selected<br>2. Delete prompt shown<br>3. Deletion confirmed<br>4. No longer in list | Unused ingredient | Low | Manual Test OK |

## User Story 13: Personal Meal Ratings and Notes

| Test ID | Test Description | Preconditions | Test Steps | Expected Results | Test Data | Priority | Priority for Solo Dev |
|---------|------------------|---------------|------------|------------------|-----------|----------|
| AT-13.1 | Add personal meal rating | Meal in user's trip | 1. Open own trip<br>2. Select meal<br>3. Click "Rate this meal"<br>4. Select 5 stars<br>5. Save rating | 1. User's trip shown<br>2. Meal details displayed<br>3. Personal rating interface opens<br>4. 5 stars selected<br>5. Personal rating saved with meal instance | Rating: 5 stars | Medium | Manual Test OK |
| AT-13.2 | Add personal meal notes | Meal in user's trip | 1. Select meal in own trip<br>2. Click "Add Personal Note"<br>3. Enter feedback<br>4. Save note | 1. Meal displayed<br>2. Personal note field opens (2000 char limit)<br>3. Text entered<br>4. Note saved privately with meal | Note: "Add more salt next time, worked well at altitude" | Medium | Manual Test OK |
| AT-13.3 | Rate same recipe differently | Same recipe in multiple trips | 1. Rate recipe 5 stars in Trip A<br>2. Create Trip B<br>3. Add same recipe<br>4. Rate 3 stars in Trip B | 1. Trip A rating saved<br>2. New trip created<br>3. Recipe added<br>4. Different rating saved for Trip B | Trip A: 5 stars<br>Trip B: 3 stars | Medium | Manual Test OK |
| AT-13.4 | Cannot rate others' meals | Viewing shared trip | 1. Open shared trip link<br>2. View meal<br>3. Look for rating option<br>4. Verify not available | 1. Shared trip displayed<br>2. Meal shown<br>3. No personal rating option<br>4. Can only view, not rate | Shared trip | High | Should Test |
| AT-13.5 | Personal rating privacy | Personal ratings exist | 1. Rate meal in trip<br>2. Share trip<br>3. View as other user<br>4. Check rating visibility | 1. Personal rating saved<br>2. Trip shared<br>3. Shared view accessed<br>4. Personal ratings not visible | Personal rating: 4 stars | High | Should Test |

## User Story 14: Day and Trip Templates

| Test ID | Test Description | Preconditions | Test Steps | Expected Results | Test Data | Priority | Priority for Solo Dev |
|---------|------------------|---------------|------------|------------------|-----------|----------|
| AT-14.1 | Save day as template | Complete day planned | 1. Select day<br>2. Click "Save as Template"<br>3. Name template<br>4. Save | 1. Day selected<br>2. Template dialog opens<br>3. Name entered<br>4. Template saved | Template: "High Calorie Day" | Medium | Manual Test OK |
| AT-14.2 | Save trip template | Complete trip | 1. Open trip<br>2. Select "Save Trip Template"<br>3. Name and save<br>4. Verify saved | 1. Trip displayed<br>2. Template option shown<br>3. Template named<br>4. In template library | Template: "5-Day Mountain Trek" | Medium | Manual Test OK |
| AT-14.3 | Apply day template | New trip, empty day | 1. Select empty day<br>2. Click "Apply Template"<br>3. Select saved template<br>4. Apply | 1. Day selected<br>2. Template list shown<br>3. Template selected<br>4. Meals populated | Saved day template | Medium | Should Test |
| AT-14.4 | Template excludes dates | Trip template | 1. Check template content<br>2. Verify no dates<br>3. Verify no participants<br>4. Apply to new trip | 1. Template loaded<br>2. No date information<br>3. No participant data<br>4. Structure applied only | Trip template | Low | Manual Test OK |
| AT-14.5 | Update template | Existing template | 1. Load template<br>2. Modify meals<br>3. Save changes<br>4. Verify update | 1. Template displayed<br>2. Changes made<br>3. Update saved<br>4. Changes reflected | Existing template | Low | Manual Test OK |

## User Story 15: Snack Management

| Test ID | Test Description | Preconditions | Test Steps | Expected Results | Test Data | Priority | Priority for Solo Dev |
|---------|------------------|---------------|------------|------------------|-----------|----------|
| AT-15.1 | Add personal snacks | Logged in user | 1. Go to snacks<br>2. Click "Add Snack"<br>3. Enter by piece<br>4. Save snack | 1. Snack list shown<br>2. Form opens<br>3. Per-piece data entered<br>4. Snack saved | Snack: "Energy Bar"<br>50g per piece<br>250 kcal | High | Should Test |
| AT-15.2 | Add snacks to day | Trip day open | 1. Click "Add Snacks"<br>2. Select 3 items<br>3. Set quantities<br>4. Save to day | 1. Snack selector opens<br>2. Items selected<br>3. Quantities entered<br>4. Snacks added to day | 2 bars/person<br>100g nuts/person<br>3 chocolates/person | High | Must Test |
| AT-15.3 | Manual group adjustment | 4-person trip | 1. Add snack: 2/person<br>2. View interface<br>3. See total: 8<br>4. Manually adjust to 10 | 1. Snack added<br>2. Shows per-person and total<br>3. Auto-calculates 8 total<br>4. Accepts manual override | 2 per person = 8 total | Medium | Manual Test OK |
| AT-15.4 | Snack vs ingredient separation | Snack and ingredient lists | 1. Check snack list<br>2. Check ingredient list<br>3. Verify no overlap<br>4. Try to use snack in recipe | 1. Snack list displayed<br>2. Ingredient list displayed<br>3. Lists are separate<br>4. Snack not available for recipe | Protein bar in both | High | Should Test |
| AT-15.5 | Per-100g snack entry | New snack | 1. Create snack<br>2. Select "per 100g"<br>3. Enter nutrition<br>4. Use in trip | 1. Form displayed<br>2. Measurement type selected<br>3. Nutrition per 100g<br>4. Quantity by weight | Trail mix per 100g | Medium | Manual Test OK |

## User Story 16: Trip Summary Export

| Test ID | Test Description | Preconditions | Test Steps | Expected Results | Test Data | Priority | Priority for Solo Dev |
|---------|------------------|---------------|------------|------------------|-----------|----------|
| AT-16.1 | Export complete summary | Finished trip plan | 1. Click "Export Summary"<br>2. Select all sections<br>3. Choose PDF<br>4. Download | 1. Export dialog shown<br>2. All sections checked<br>3. PDF selected<br>4. Complete PDF generated | Full trip data | High | Should Test |
| AT-16.2 | Selective export | Trip with all data | 1. Click "Export"<br>2. Select only meals and nutrition<br>3. Export to Excel<br>4. Verify content | 1. Export options shown<br>2. Sections selected<br>3. Excel format chosen<br>4. Only selected data exported | Partial selection | Medium | Manual Test OK |
| AT-16.3 | Shopping list in export | Trip ready | 1. Export summary<br>2. Include shopping list<br>3. Check grouping<br>4. Verify categories | 1. Export initiated<br>2. Shopping list included<br>3. Items grouped<br>4. Categories preserved | Shopping list data | Medium | Should Test |
| AT-16.4 | Unit preferences in export | Imperial preference | 1. Set Imperial units<br>2. Export summary<br>3. Check all weights<br>4. Verify conversions | 1. Preference set<br>2. Export created<br>3. Weights in oz/lbs<br>4. Conversions accurate | Imperial units | Medium | Manual Test OK |
| AT-16.5 | Text format export | Simple export needed | 1. Select TXT format<br>2. Export summary<br>3. Open in text editor<br>4. Verify readability | 1. TXT selected<br>2. File exported<br>3. Opens correctly<br>4. Formatted for readability | None | Low | Manual Test OK |

## User Story 17: Stove and Fuel Management

| Test ID | Test Description | Preconditions | Test Steps | Expected Results | Test Data | Priority | Priority for Solo Dev |
|---------|------------------|---------------|------------|------------------|-----------|----------|
| AT-17.1 | Add stove to trip | Trip created | 1. Go to trip settings<br>2. Add stove<br>3. Enter efficiency: 10g/L<br>4. Save | 1. Settings accessed<br>2. Stove form shown<br>3. Efficiency entered<br>4. Stove saved | Efficiency: 10g fuel per liter | High | Should Test |
| AT-17.2 | Calculate basic fuel | Stove added, meals planned | 1. View fuel calculation<br>2. Check total cooking time<br>3. Check water needed<br>4. Verify fuel grams | 1. Calculation displayed<br>2. Shows 60 min total<br>3. Shows 5L water<br>4. Correct fuel amount | 60 min cooking<br>5L water<br>10g/L efficiency | High | Must Test |
| AT-17.3 | Altitude adjustment | Trip at elevation | 1. Set altitude: 2000m<br>2. View fuel calc<br>3. See +20% adjustment<br>4. Verify new total | 1. Altitude entered<br>2. Calculation shown<br>3. 20% increase applied<br>4. Higher fuel total | Altitude: 2000m | Medium | Manual Test OK |
| AT-17.4 | Include drinks water | Coffee/tea added | 1. Add coffee: 200ml x 4<br>2. Add tea: 250ml x 4<br>3. Check water total<br>4. Verify fuel increase | 1. Coffee added<br>2. Tea added<br>3. Water: +1.8L<br>4. Fuel recalculated | Coffee and tea daily | Medium | Should Test |
| AT-17.5 | Common stove reference | Stove selection | 1. Click "Common Values"<br>2. View reference list<br>3. Select similar stove<br>4. Use suggested value | 1. Reference shown<br>2. List of stoves/values<br>3. Stove selected<br>4. Value auto-filled | Common stove list | Low | Manual Test OK |

## User Story 18: Comprehensive Nutritional Tracking

| Test ID | Test Description | Preconditions | Test Steps | Expected Results | Test Data | Priority | Priority for Solo Dev |
|---------|------------------|---------------|------------|------------------|-----------|----------|
| AT-18.1 | Display all nutrients | Meal with complete data | 1. View meal nutrition<br>2. Check macros<br>3. Check minerals<br>4. Check vitamins | 1. Nutrition panel shown<br>2. All macros with subsets<br>3. All minerals listed<br>4. All vitamins displayed | Complete ingredient data | High | Must Test |
| AT-18.2 | Fat breakdown display | Recipe with fats | 1. View fat section<br>2. Check saturated<br>3. Check trans<br>4. Check cholesterol | 1. Fat details expanded<br>2. Saturated shown<br>3. Trans fats shown<br>4. Cholesterol in mg | Various fat types | Medium | Should Test |
| AT-18.3 | PHE tracking | User with PKU | 1. Enable PHE tracking<br>2. View meal PHE<br>3. Check daily total<br>4. View trip total | 1. PHE column visible<br>2. Meal PHE shown<br>3. Daily sum displayed<br>4. Trip total calculated | PHE data required | Medium | Manual Test OK |
| AT-18.4 | Vitamin completeness | Full trip nutrition | 1. View trip summary<br>2. Check each vitamin<br>3. Identify gaps<br>4. Compare to RDA | 1. Summary displayed<br>2. All vitamins listed<br>3. Low values highlighted<br>4. Percentage of RDA shown | Complete vitamin data | Low | Manual Test OK |
| AT-18.5 | Aggregated daily view | Multi-meal day | 1. View day summary<br>2. Check meal totals<br>3. Check snack totals<br>4. Verify daily sum | 1. Day view shown<br>2. Each meal subtotal<br>3. Snacks included<br>4. Accurate daily total | Full day planned | High | Must Test |

## User Story 19: Daily Meal Structure

| Test ID | Test Description | Preconditions | Test Steps | Expected Results | Test Data | Priority | Priority for Solo Dev |
|---------|------------------|---------------|------------|------------------|-----------|----------|
| AT-19.1 | Customize meal slots | New trip | 1. Create trip<br>2. Add "Snack Time" slot<br>3. Remove "Lunch"<br>4. Apply to all days | 1. Trip created<br>2. New slot added<br>3. Slot removed<br>4. All days updated | Custom: Breakfast, Snack Time, Dinner | High | Should Test |
| AT-19.2 | Unlimited slot creation | Trip configuration | 1. Add 8 meal slots<br>2. Name each uniquely<br>3. Save configuration<br>4. Verify no limit | 1. Slots added<br>2. Each named<br>3. Config saved<br>4. All 8 slots available | 8 custom slots | Medium | Manual Test OK |
| AT-19.3 | Empty slots allowed | Day with slots | 1. Fill breakfast<br>2. Leave lunch empty<br>3. Fill dinner<br>4. Save day | 1. Breakfast filled<br>2. Lunch remains empty<br>3. Dinner filled<br>4. Day saved successfully | Partial meal plan | Medium | Should Test |
| AT-19.4 | Drinks management | Day planning | 1. Add coffee morning<br>2. Add tea evening<br>3. Specify water amounts<br>4. Check not in water total | 1. Coffee added<br>2. Tea added<br>3. Water requirements set<br>4. Separate from meal water | Coffee: 200ml<br>Tea: 250ml | Medium | Should Test |
| AT-19.5 | Consistent structure | 5-day trip | 1. Set structure day 1<br>2. Check day 2-5<br>3. Verify identical<br>4. Cannot vary by day | 1. Structure configured<br>2. Other days checked<br>3. All match day 1<br>4. No per-day variation | Multi-day trip | High | Must Test |

## User Story 20: Trip Sharing

| Test ID | Test Description | Preconditions | Test Steps | Expected Results | Test Data | Priority | Priority for Solo Dev |
|---------|------------------|---------------|------------|------------------|-----------|----------|
| AT-20.1 | Generate trip share link | Complete trip | 1. Open trip<br>2. Click "Share Trip"<br>3. Copy link<br>4. Test in private mode | 1. Trip displayed<br>2. Share dialog opens<br>3. Link generated<br>4. Full trip viewable | Complete trip plan | High | Should Test |
| AT-20.2 | View shared trip | Share link | 1. Open link logged out<br>2. View all days<br>3. Check meal details<br>4. View shopping list | 1. Trip loads<br>2. All days visible<br>3. Full meal info shown<br>4. Lists accessible | Valid share link | High | Should Test |
| AT-20.3 | Duplicate shared trip | Shared trip viewed | 1. View shared trip<br>2. Click "Duplicate"<br>3. Create account<br>4. Trip copied | 1. Trip displayed<br>2. Duplicate option shown<br>3. Registration required<br>4. Trip in new account | Shared trip | High | Should Test |
| AT-20.4 | Preview information | Trip list view | 1. View shared trips<br>2. See participant count<br>3. See duration<br>4. See basic info | 1. List displayed<br>2. Shows "4 participants"<br>3. Shows "5 days"<br>4. Preview without opening | Multiple shared trips | Medium | Manual Test OK |
| AT-20.5 | No collaboration | Duplicated trip | 1. User A shares trip<br>2. User B duplicates<br>3. User B edits<br>4. Check User A's version | 1. Trip shared<br>2. Trip duplicated<br>3. Changes made<br>4. Original unchanged | 2 user accounts | Medium | Manual Test OK |
| AT-20.6 | Set trip link expiration | Complete trip | 1. Open trip<br>2. Click "Share Trip"<br>3. Set expiry to 60 days<br>4. Generate link | 1. Trip displayed<br>2. Share dialog with expiry options<br>3. Custom expiry accepted (60 days)<br>4. Link generated with expiry | Expiry: 60 days | Medium | Should Test |
| AT-20.7 | Expired trip link | Expired trip share link | 1. Access expired link<br>2. View error page<br>3. Check for data leakage<br>4. Verify no access | 1. Link accessed<br>2. "This link has expired" shown<br>3. No trip data exposed<br>4. Cannot view trip | Expired link | High | Must Test |
| AT-20.8 | Regenerate trip link | Trip with expired link | 1. Open trip<br>2. See expired link status<br>3. Click "Regenerate"<br>4. New link created | 1. Trip displayed<br>2. Shows link expired<br>3. Regenerate option available<br>4. New link with 30-day default | Previously shared trip | Medium | Should Test |

## Calculation Accuracy Tests

| Test ID | Test Description | Test Data | Expected Result | Priority | Priority for Solo Dev |
|---------|------------------|-----------|-----------------|----------|
| AT-CAL-1 | Single ingredient calculation | 100g rice (130 kcal/100g) | 130 kcal ± 0.1 | Critical | Must Test |
| AT-CAL-2 | Multi-ingredient recipe | Rice + oil + vegetables | Sum of components ± 0.1% | Critical | Must Test |
| AT-CAL-3 | Recipe scaling 2x | 1-serving recipe | All values doubled ± 0.1% | Critical | Must Test |
| AT-CAL-4 | Fractional scaling | Scale by 0.33 | Values × 0.33 ± 0.1% | High | Should Test |
| AT-CAL-5 | Coefficient 150% | Base 600 kcal | 900 kcal ± 0.1 | Critical | Must Test |
| AT-CAL-6 | Group calculation | 5 people, various coefficients | Correct total ± 0.1% | Critical | Must Test |
| AT-CAL-7 | Micronutrient precision | Vitamin calculations | Maintains µg precision | High | Should Test |
| AT-CAL-8 | Water content | Recipe with 500ml water | 500ml ± 0.1 | High | Should Test |
| AT-CAL-9 | Zero handling | 0g ingredient | 0 for all nutrients | Medium | Manual Test OK |
| AT-CAL-10 | Rounding display | 123.456g | Displays 123.5g | Medium | Manual Test OK |

---

## Test Execution Summary

### Priority Distribution (Original)
- **High Priority**: 62 tests (critical functionality)
- **Medium Priority**: 43 tests (important features)
- **Low Priority**: 9 tests (nice-to-have features)

### Solo Developer Priority Distribution
- **Must Test**: ~40 tests (35%) - Core functionality that could break the app or corrupt data
- **Should Test**: ~35 tests (31%) - Important features that affect user experience
- **Manual Test OK**: ~39 tests (34%) - Nice-to-have features that can be tested during development

### Total Tests: 118

### Solo Developer Testing Strategy

#### Phase 1: Must Test (Automated)
Focus on automating these critical tests:
1. Authentication basics (AT-1.1, AT-1.3)
2. Core CRUD operations (AT-2.1, AT-2.2, AT-2.7, AT-3.1, AT-3.3)
3. Calculation accuracy (AT-CAL-1 through AT-CAL-6)
4. Participant coefficients (AT-3.5, AT-5.1, AT-5.2, AT-5.4)
5. Data integrity (AT-7.1, AT-7.2, AT-8.1, AT-8.3, AT-11.1)
6. Critical exports (AT-4.1, AT-4.3, AT-19.1, AT-19.5)

#### Phase 2: Should Test (Mix of Automated and Manual)
Implement these as time permits:
1. Social features (AT-9.1, AT-9.2, AT-10.1, AT-10.2)
2. Advanced UI features (AT-6.1, AT-15.3)
3. Export variations (AT-4.5, AT-17.1)
4. Fuel calculations (AT-18.2, AT-18.4)

#### Phase 3: Manual Test OK (During Development)
Test these features manually as you build:
1. UI preferences and settings
2. Edge cases and nice-to-have features
3. Visual elements and image uploads

#### Phase 1.1: Post-MVP Security Enhancements
Implement after initial launch (Month 1-2):
1. Two-factor authentication (AT-1.6, AT-1.7, AT-1.8)
2. Enhanced session management
3. Security audit logging

### Realistic Expectations
- Focus on ~100 active users initially (not 10,000)
- Implement comprehensive logging to catch production issues
- Use user feedback to prioritize which "Should Test" items to automate
- Consider using feature flags to safely roll out complex features

### Test Coverage by User Story
Each user story has between 4-7 acceptance tests covering:
- Happy path scenarios
- Edge cases
- Data validation
- Integration points
- User interface behavior

### Recommended Test Execution Order for Solo Developer
1. Core calculation engine (must be 100% accurate)
2. Basic user authentication and recipe creation
3. Trip planning core functionality
4. Shopping and packing list generation
5. Sharing features (can iterate based on user feedback)
6. Advanced features (implement based on user demand)