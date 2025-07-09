# Jídelníček Data Validation Rules

## 1. Field-Level Validations

### 1.1 User Fields

| Field | Validation Rule | Error Message | Example |
|-------|----------------|---------------|---------|
| email | Valid email format (RFC 5322) | "Please enter a valid email address" | valid: user@example.com<br>invalid: user@.com |
| email | Max 255 characters | "Email must not exceed 255 characters" | - |
| email | Unique in system | "An account with this email already exists" | - |
| password | Min 12 characters | "Password must be at least 12 characters long" | invalid: pass123456 |
| password | Contains uppercase letter | "Password must contain at least one uppercase letter" | invalid: password123 |
| password | Contains lowercase letter | "Password must contain at least one lowercase letter" | invalid: PASSWORD123 |
| password | Contains number | "Password must contain at least one number" | invalid: Password |
| password | Contains special character | "Password must contain at least one special character (!@#$%^&*)" | invalid: Password123 |
| password | Max 128 characters | "Password must not exceed 128 characters" | - |
| TOTP Code | 6 digits, numeric only | "Invalid authenticator code" | invalid: "12345" |
| Recovery Code | 8 characters, alphanumeric | "Invalid recovery code format" | invalid: "ABC-123" |
| timezone | IANA timezone format | "Invalid timezone format" | valid: "Europe/Prague", "America/New_York"<br>invalid: "EST", "Prague" |
| name | Max 100 characters | "Name must not exceed 100 characters" | - |
| name | Min 1 character (if provided) | "Name cannot be empty" | - |
| language | Must be 'en' or 'cs' | "Language must be either 'en' (English) or 'cs' (Czech)" | valid: en, cs<br>invalid: de, fr |
| unit_system | Must be 'metric' or 'imperial' | "Unit system must be either 'metric' or 'imperial'" | valid: metric<br>invalid: US |
| energy_unit | Must be 'kcal' or 'kJ' | "Energy unit must be either 'kcal' or 'kJ'" | valid: kcal<br>invalid: cal |
| role | Must be 'user' or 'admin' | "Invalid user role" | valid: user, admin |

### 1.2 Recipe Fields

| Field | Validation Rule | Error Message | Example |
|-------|----------------|---------------|---------|
| name | Required, 1-100 characters | "Recipe name is required and must be between 1-100 characters" | valid: "Oatmeal Breakfast"<br>invalid: "" |
| name | No special characters except .,'-() | "Recipe name contains invalid characters" | invalid: "Recipe@#$" |
| description | Max 500 characters | "Description must not exceed 500 characters" | - |
| instructions | Max 2000 characters | "Instructions must not exceed 2000 characters" | - |
| prep_time_minutes | Non-negative integer, max 1440 | "Prep time must be between 0-1440 minutes (24 hours)" | valid: 30<br>invalid: -5, 2000 |
| cook_time_minutes | Non-negative integer, max 1440 | "Cook time must be between 0-1440 minutes (24 hours)" | valid: 45<br>invalid: -10 |
| water_ml | Non-negative integer, max 10000 | "Water amount must be between 0-10000 ml" | valid: 500<br>invalid: -100 |
| servings | Positive integer, 1-100 | "Servings must be between 1-100" | valid: 4<br>invalid: 0, 150 |
| ingredient_count | Max 50 ingredients | "Recipe cannot have more than 50 ingredients" | - |
| image_count | Max 5 images | "Recipe cannot have more than 5 images" | - |
| image_size | Max 5MB per image | "Image size must not exceed 5MB" | - |
| image_format | JPEG, PNG, WebP only | "Image must be in JPEG, PNG, or WebP format" | valid: .jpg, .png<br>invalid: .gif, .bmp |

### 1.3 Ingredient Fields

| Field | Validation Rule | Error Message | Example |
|-------|----------------|---------------|---------|
| name | Required, 1-100 characters | "Ingredient name is required and must be between 1-100 characters" | valid: "Rolled Oats" |
| category | Max 50 characters | "Category must not exceed 50 characters" | valid: "Grains" |
| quantity_g | Positive decimal, max 9999.9 | "Quantity must be between 0.1-9999.9 grams" | valid: 100.5<br>invalid: 0, -50 |
| calories | Non-negative decimal, max 9999.99 | "Calories must be between 0-9999.99 per 100g" | valid: 364.0<br>invalid: -100 |
| proteins_g | Non-negative decimal, max 100.00 | "Proteins must be between 0-100.00g per 100g" | valid: 13.2<br>invalid: 150 |
| carbohydrates_g | Non-negative decimal, max 100.00 | "Carbohydrates must be between 0-100.00g per 100g" | valid: 66.3 |
| fats_g | Non-negative decimal, max 100.00 | "Fats must be between 0-100.00g per 100g" | valid: 6.9 |
| sugars_g | Non-negative, ≤ carbohydrates_g | "Sugars cannot exceed total carbohydrates" | valid: 1.0 (if carbs=66.3)<br>invalid: 70.0 |
| fiber_g | Non-negative decimal, max 100.00 | "Fiber must be between 0-100.00g per 100g" | valid: 10.6 |
| salt_g | Non-negative decimal, max 100.00 | "Salt must be between 0-100.00g per 100g" | valid: 0.01 |
| all vitamins | Non-negative decimal | "Vitamin values cannot be negative" | valid: 0.5 |

### 1.4 Trip Fields

| Field | Validation Rule | Error Message | Example |
|-------|----------------|---------------|---------|
| name | Required, 1-100 characters | "Trip name is required and must be between 1-100 characters" | valid: "PCT Section Hike" |
| start_date | Valid date, not in past | "Start date must be a valid future date" | valid: 2025-07-01 |
| end_date | Valid date, ≥ start_date | "End date must be on or after start date" | valid: 2025-07-10 |
| participant_count | 1-20 participants | "Maximum 20 participants per trip" | valid: 5<br>invalid: 0, 25 |
| participant_name | Max 100 characters | "Participant name must not exceed 100 characters" | - |
| participant_coefficient | 10-300 (percent) | "Participant coefficient must be between 10% and 300%" | valid: 150<br>invalid: 5, 500 |
| meal_slots | Min 1 slot | "Trip must have at least 1 meal slot per day" | valid: ["Breakfast", "Lunch", "Dinner"] |
| meal_slot_name | 1-50 characters each | "Meal slot name must be between 1-50 characters" | valid: "Second Breakfast" |
| notes | Max 2000 characters | "Notes must not exceed 2000 characters" | - |

### 1.5 Snack Fields

| Field | Validation Rule | Error Message | Example |
|-------|----------------|---------------|---------|
| name | Required, 1-100 characters | "Snack name is required and must be between 1-100 characters" | valid: "Trail Mix" |
| measurement_type | Must be 'piece' or 'per_100g' | "Measurement type must be either 'piece' or 'per_100g'" | valid: piece |
| piece_weight_g | Required if type='piece', 0.1-1000 | "Piece weight must be between 0.1-1000 grams" | valid: 25.5 |
| quantity_per_person | Positive decimal, max 999.99 | "Quantity per person must be between 0.01-999.99" | valid: 2.5 |
| total_quantity | Positive decimal, max 9999.99 | "Total quantity must be between 0.01-9999.99" | valid: 50.0 |

### 1.6 Stove Fields

| Field | Validation Rule | Error Message | Example |
|-------|----------------|---------------|---------|
| name | Max 100 characters | "Stove name must not exceed 100 characters" | valid: "MSR PocketRocket 2" |
| efficiency_g_per_liter | Positive decimal, 1-100 | "Stove efficiency must be between 1-100 g/L" | valid: 7.5<br>invalid: 0, 150 |
| altitude_adjustment_percent | 0-100 | "Altitude adjustment must be between 0-100%" | valid: 10<br>invalid: -5, 150 |

### 1.7 Decimal Precision Rules

| Field Type | Storage Precision | Display Precision | Validation Rule | Example |
|------------|------------------|-------------------|-----------------|----------|
| Weight (grams) | DECIMAL(10,1) | 1 decimal place | Round to 0.1g | 100.0g, 50.5g |
| Nutritional values | DECIMAL(10,2) | 2 decimal places | Round to 0.01 | 364.25 kcal |
| Micronutrients (mg) | DECIMAL(10,2) | 2 decimal places | Values < 0.01 show as "<0.01" | 0.05mg |
| Vitamins (μg) | DECIMAL(10,2) | 2 decimal places | Values < 0.01 show as "<0.01" | 12.50μg |
| Percentages | DECIMAL(5,2) | 2 decimal places | 0.00-100.00 | 75.50% |
| Coefficients | DECIMAL(5,2) | 0 decimal places | Display as whole percent | 150% |
| Currency | DECIMAL(10,2) | 2 decimal places | Standard currency format | $12.99 |
| Scaling factors | DECIMAL(10,4) | 4 decimal places | Internal calculation only | 1.4615 |

## 2. Business Logic Validations

### 2.1 Recipe Constraints

| Constraint | Validation Rule | Error Message | Example |
|------------|----------------|---------------|---------|
| Ingredient limit | Max 50 ingredients per recipe | "Recipe cannot contain more than 50 ingredients" | - |
| Total cooking time | prep_time + cook_time ≤ 1440 min | "Total cooking time cannot exceed 24 hours" | invalid: prep=720, cook=800 |
| Recipe count per user | Max 200 recipes | "Maximum 200 recipes per user" | Database trigger enforced |
| Version retention | Keep last 5 versions only | "Older versions will be automatically deleted" | MVP: 5 versions (expandable to 10 post-launch) |
| Recipe unpublish | fork_count <= 5 | "Cannot unpublish recipe that has been forked more than 5 times" | Check constraint |
| Recipe unpublish warning | Used in active trips | "This recipe is used in {count} active trips. Unpublishing will not affect existing trips." | Warning only |
| Recipe grace period | 30 days after unpublish | "Recipe will be permanently removed in {days} days" | System notification |
| Recipe deletion | Cannot delete if used in active trips | "Cannot delete recipe that is used in active trips" | - |
| Image upload limit | Max 5 images per recipe | "Recipe already has maximum number of images (5)" | - |

### 2.2 Trip Constraints

| Constraint | Validation Rule | Error Message | Example |
|------------|----------------|---------------|---------|
| Participants per trip | 1-20 | "Maximum 20 participants per trip" | Database trigger enforced |
| Active trips per user | Max 50 active trips | "You have reached the maximum limit of 50 active trips" | - |
| Trip duration | No limit, but warn if > 365 days | "Warning: Trip duration exceeds one year" | - |
| Participant coefficients | Applied globally to all meals | "Coefficient changes will affect all meals for this participant" | - |
| One stove per trip | Cannot add multiple stoves | "A trip can only have one stove configuration" | - |
| Day reordering | All data moves with day | "All meals, snacks, and drinks will be moved with this day" | - |
| Recipe tracking | Choose snapshot or live tracking | "Recipe tracking mode cannot be changed after trip creation" | - |

### 2.3 Coefficient Ranges

| Field | Min Value | Max Value | Error Message | Example |
|-------|-----------|-----------|---------------|---------|
| Participant coefficient | 10% | 300% | "Coefficient must be between 10% and 300%" | valid: 150%<br>invalid: 5%, 500% |
| Default coefficient | 100% | 100% | "Default coefficient is always 100%" | - |
| Coefficient application | - | - | "Coefficients do not apply to snacks or drinks" | - |

### 2.4 Rating System Constraints

| Constraint | Validation Rule | Error Message | Example |
|------------|----------------|---------------|---------|
| Personal rating context | Only in user's trips | "Cannot rate meals in other users' trips" | - |
| Marketplace rating context | Only forked recipes | "Must fork recipe before rating in marketplace" | - |
| Personal rating multiple | Allowed per trip instance | "Can rate same recipe differently in each trip" | - |
| Marketplace rating multiple | One per recipe per user | "Can only submit one marketplace review per recipe" | - |
| Update marketplace review | Can edit existing review | "Review updated successfully" | - |
| Delete personal rating | Can remove from meal | "Personal rating removed" | - |
| Delete marketplace review | Cannot delete, only update | "Marketplace reviews cannot be deleted" | - |

### 2.5 Calorie Target Ranges

| Field | Validation Rule | Error Message | Example |
|-------|----------------|---------------|---------|
| Target calories per meal | 100-2000 kcal | "Target calories must be between 100-2000 kcal per person per meal" | valid: 600<br>invalid: 50, 3000 |
| Daily calorie total | Warn if > 6000 kcal | "Warning: Daily calories exceed 6000 kcal per person" | - |
| Calorie scaling accuracy | ±5% of target | "System will scale ingredients to within 5% of target calories" | target: 600, actual: 570-630 |

## 3. Cross-Field Validations

### 3.1 Date Validations

| Fields | Validation Rule | Error Message | Example |
|--------|----------------|---------------|---------|
| start_date, end_date | end_date ≥ start_date | "End date must be on or after start date" | invalid: start=2025-07-10, end=2025-07-05 |
| trip dates, current date | start_date ≥ today (for new trips) | "Start date cannot be in the past" | invalid: start=2024-01-01 (if today is 2025-01-07) |
| day dates | Must be within trip date range | "Day date must be between trip start and end dates" | invalid: day=2025-07-15 if trip ends 2025-07-10 |

### 3.2 Nutritional Calculations

| Fields | Validation Rule | Error Message | Example |
|--------|----------------|---------------|---------|
| proteins + carbs + fats | Should ≈ 95-105% of dry weight | "Warning: Macronutrient sum seems incorrect" | - |
| sugars, carbohydrates | sugars ≤ carbohydrates | "Sugar content cannot exceed total carbohydrates" | invalid: sugars=30g, carbs=25g |
| saturated fats, total fats | saturated ≤ total fats | "Saturated fats cannot exceed total fats" | invalid: saturated=10g, total=8g |
| ingredient quantities, recipe total | Sum matches expected total | "Ingredient quantities don't match recipe total weight" | - |

### 3.3 Water and Fuel Calculations

| Fields | Validation Rule | Error Message | Example |
|--------|----------------|---------------|---------|
| cooking water, drinking water | Cooking water only tracked | "Only cooking water is tracked, not drinking water" | - |
| total water, participant count | water_per_meal × participants | "Total water calculation error" | - |
| fuel calculation inputs | All required fields present | "Stove efficiency required for fuel calculation" | - |
| altitude adjustment | Applied to base fuel calculation | "Altitude adjustment will increase fuel by {X}%" | 1000m = +10% |

### 3.4 Scaling Validations

| Fields | Validation Rule | Error Message | Example |
|--------|----------------|---------------|---------|
| recipe servings, participant count | Proper scaling factor calculated | "Scaling calculation error" | 4 servings for 6 people = 1.5x |
| ingredient rounding | Round to nearest 1g (solids) or 1ml (liquids) | "Quantities rounded to nearest gram" | 66.6g → 67g |
| minimum quantities | Warn if scaled < 1g | "Warning: Some ingredients scaled below 1g" | 0.5g salt per person |

## System Limits

| Feature | Limit | Rationale | Error Message |
|---------|-------|-----------|---------------|
| Export file size | 20 MB | Prevent server overload | Export too large. Please reduce date range or split into multiple exports |
| Meal slots per day (UI) | 10 | UI/UX optimization | UI is optimized for 1-10 meal slots, but backend supports unlimited |
| Image upload size | 5 MB | Storage optimization | Image must be less than 5MB |
| Batch operations | 50 items | Performance | Please process in batches of 50 or less |
| API request size | 10 MB | Server protection | Request payload too large |

## 4. Import/Export Validations

### 4.1 File Upload Validations

| Field | Validation Rule | Error Message | Example |
|-------|----------------|---------------|---------|
| Image file size | Max 5MB | "Image file size must not exceed 5MB" | invalid: 6MB file |
| Image format | JPEG, PNG, WebP only | "Image must be in JPEG, PNG, or WebP format" | invalid: .gif, .bmp |
| CSV import | Valid UTF-8 encoding | "File must be valid UTF-8 encoded" | - |
| Excel import | .xlsx format only | "Excel file must be in .xlsx format" | invalid: .xls |

### 4.2 Image Upload Optimization

| Optimization | Client-Side Action | Server-Side Validation | User Feedback |
|--------------|-------------------|------------------------|---------------|
| File size | Compress to 80% JPEG quality if > 3MB | Reject if > 5MB after compression | "Compressing image..." progress |
| Dimensions | Resize to max 2048px on longest side | Accept up to 4096px | "Resizing large image..." |
| Format conversion | Convert HEIC/HEIF to JPEG | Accept JPEG, PNG, WebP only | "Converting image format..." |
| Progressive upload | Use chunked upload for files > 1MB | Track upload progress | Show percentage complete |
| Retry logic | Auto-retry failed chunks (3 attempts) | Resume incomplete uploads | "Retrying upload..." |
| Preview generation | Create 200px thumbnail client-side | Store thumbnail separately | Show preview immediately |

### 4.3 Export Validations

| Field | Validation Rule | Error Message | Example |
|-------|----------------|---------------|---------|
| Export format | PDF, Excel, TXT only | "Export format must be PDF, Excel, or TXT" | valid: PDF |
| Export size | Warn if > 10MB | "Warning: Export file is large (>10MB)" | - |
| Export size limit | Max 20MB | "Export file exceeds maximum size of 20MB" | - |
| Custom export sections | At least one section selected | "Please select at least one section to export" | - |

## 5. Special Validations

### 5.1 PKU (Phenylketonuria) Support

| Field | Validation Rule | Error Message | Example |
|-------|----------------|---------------|---------|
| PHE content | Non-negative decimal | "PHE content cannot be negative" | valid: 50.5 mg |
| PHE tracking | Optional but highlighted if present | "This recipe contains {X}mg PHE per serving" | - |
| S3 Image Path | Valid S3 key format | Invalid image path format | recipes/123/456/main.jpg |
| Email Template | Must exist in SES | Email template not found | welcome_email_v1 |
| API Rate Window | 60 seconds sliding | - | - |
| Timezone validation | Valid IANA timezone | "Invalid timezone identifier" | Use pytz.all_timezones |

### 5.2 Publishing and Sharing

| Field | Validation Rule | Error Message | Example |
|-------|----------------|---------------|---------|
| Public recipe | Must have complete nutritional data | "Public recipes must have complete nutritional information" | - |
| Fork source | Must reference valid original | "Invalid source recipe for fork" | - |
| Share link expiry | 1-365 days | "Share link expiration must be between 1 and 365 days" | valid: 30<br>invalid: 0, 400 |
| Share link default | 30 days if not specified | "Share link will expire in 30 days" | default: 30 |
| Expired share link | Show error message | "This link has expired" | - |
| Marketplace review text | Max 1000 characters | "Marketplace review must not exceed 1000 characters" | - |
| Marketplace rating | 1-5 stars only | "Marketplace rating must be between 1 and 5 stars" | valid: 4<br>invalid: 0, 6 |
| Marketplace review eligibility | Must have forked recipe | "You can only review recipes you have forked" | - |
| Marketplace reviews per recipe | Max 1 per user | "You have already reviewed this recipe" | - |
| Personal meal rating | 1-5 stars only | "Personal rating must be between 1 and 5 stars" | valid: 5<br>invalid: 0, 6 |
| Personal meal notes | Max 2000 characters | "Personal notes must not exceed 2000 characters" | - |
| Personal rating eligibility | Must be user's own meal | "You can only rate meals in your own trips" | - |

### 5.3 Recipe Unpublishing Rules

| Condition | Validation Rule | Action/Message | Implementation |
|-----------|----------------|----------------|----------------|
| Fork count check | fork_count <= 5 | Allow unpublish | Database constraint |
| Fork count check | fork_count > 5 | "Cannot unpublish: This recipe has been forked {count} times (maximum 5)" | Prevent action |
| Active trip usage | Count trips using recipe | "Warning: This recipe is used in {count} active trips" | Display warning |
| Unpublish action | Set published = false | Recipe becomes private | Update database |
| Grace period | 30 days from unpublish date | "Recipe scheduled for removal on {date}" | Background job |
| Fork preservation | Existing forks unaffected | No cascade to forked copies | Isolation |
| Marketplace removal | Remove from search/browse | "Recipe no longer available" | Immediate |
| Direct link access | Return 404 for public access | "This recipe is no longer publicly available" | Check published flag |
| Author access | Full access maintained | Recipe visible in author's list | Check ownership |
| Republish option | Can republish anytime | "Republish recipe to marketplace" | Reset published flag |

## 6. Performance-Related Validations

| Operation | Validation Rule | Error Message | Example |
|-----------|----------------|---------------|---------|
| Bulk operations | Max 50 items at once | "Cannot process more than 50 items in a single operation" | - |
| Search query | Max 100 characters | "Search query must not exceed 100 characters" | - |
| Pagination | Max 50 items per page | "Cannot retrieve more than 50 items per page" | - |
| Calculation timeout | Max 30 seconds | "Calculation timed out, please try with fewer items" | - |

## 7. Data Retention Validations

| Entity | Retention Rule | Warning/Error Message |
|--------|---------------|---------------------|
| Deleted items | 30 days in trash | "Deleted items will be permanently removed after 30 days" |
| Inactive accounts | 10 years | "Account will be deleted after 10 years of inactivity" |
| Old recipe versions | Keep last 5 only | "Older versions will be automatically removed" |
| Expired share links | Cleanup 30 days post-expiry | "This share link has expired and is no longer valid" |
| Share link regeneration | Available for expired links | "You can regenerate an expired share link" |

## Implementation Notes

1. **Client-Side Validation**: Implement all basic format validations on the client for immediate feedback
2. **Server-Side Validation**: Always validate on server - never trust client input
3. **Batch Validation**: For bulk operations, collect all errors and return them together
4. **Async Validation**: For complex validations (e.g., uniqueness checks), use async validators
5. **Validation Order**: Check format → check business rules → check cross-field dependencies
6. **Error Format**: Return field name, error code, and user-friendly message for each validation error
7. **Localization**: All error messages should support both English and Czech translations

## Validation Error Response Format

```json
{
  "errors": [
    {
      "field": "email",
      "code": "INVALID_FORMAT",
      "message": "Please enter a valid email address"
    },
    {
      "field": "participant_count",
      "code": "EXCEEDS_LIMIT",
      "message": "Trip must have between 1-20 participants"
    }
  ]
}
```

---

**Document Version**: 1.2  
**Last Updated**: 2025-07-08  
**Status**: Updated image size limits to 5MB with compression strategy