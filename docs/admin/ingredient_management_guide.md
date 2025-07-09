# Ingredient Management System Guide

## Overview

The Ingredient Management System provides comprehensive administrative tools for managing the ingredient master data in Jidelnicek 2.0. This system supports both global ingredients (available to all users) and user-submitted ingredients that require moderation.

## Features

### 1. Ingredient CRUD Operations

#### Create Ingredient
- Add new ingredients with complete nutritional data
- Support for global and user-specific ingredients
- Automatic validation of nutritional values
- Barcode support for product identification

#### Update Ingredient
- Modify existing ingredient information
- Update nutritional data with validation
- Add or modify allergen information
- Manage dietary flags

#### Delete Ingredient
- Soft delete (archive) for data preservation
- Force delete option for permanent removal
- Usage checking to prevent breaking recipes

### 2. Category Management

- Organize ingredients by categories
- Dynamic category listing
- Filter ingredients by category
- Category-based statistics

### 3. Bulk Operations

#### Import (CSV/JSON)
- Bulk import ingredients from CSV files
- Template provided for correct formatting
- Validation before import
- Error reporting for failed imports

**CSV Format:**
```csv
name,brand,barcode,category,calories,proteins,carbs,fats,allergens
"Product Name","Brand","123456","Category",100,10,20,5,"gluten,dairy"
```

#### Export
- Export ingredients to CSV or JSON
- Apply filters before export
- Include/exclude archived ingredients
- Customizable export fields

### 4. User-Submitted Ingredient Moderation

#### Submission Process
1. Users create ingredients for personal use
2. Users can submit ingredients for global availability
3. System performs automated quality checks
4. Ingredient enters moderation queue

#### Moderation Workflow
1. **Automated Checks:**
   - Nutritional data validation
   - Duplicate detection
   - Suspicious content filtering
   - Completeness scoring

2. **Admin Review:**
   - View moderation queue sorted by priority
   - Review ingredient details and quality score
   - Approve, reject, or request changes
   - Bulk approval for efficiency

3. **Quality Criteria:**
   - Complete nutritional data (100 points)
   - Category assignment (10 points)
   - Allergen information (5 points)
   - Unit conversions (10 points)
   - Dietary flags (5 points)

### 5. Duplicate Detection and Merging

#### Automatic Detection
- Check by name and brand combination
- Barcode matching
- Similar nutritional profiles

#### Merge Process
1. Select source and target ingredients
2. Review combined data
3. Update recipe references
4. Delete source ingredient

### 6. Nutritional Data Validation

#### Required Fields
- Calories (kcal)
- Proteins (g)
- Carbohydrates (g)
- Fats (g)

#### Optional Fields
- Fiber, sodium, sugar
- Vitamins and minerals
- Cholesterol
- Saturated fats

#### Validation Rules
- Non-negative values
- Macronutrients cannot exceed 100g per 100g
- Calorie calculation verification (±20 kcal tolerance)

### 7. Allergen Tracking

#### Common Allergens
- Gluten
- Dairy
- Eggs
- Soy
- Nuts/Peanuts
- Fish/Shellfish
- Sesame
- Celery
- Mustard
- Sulphites

#### Management
- Multiple allergens per ingredient
- Normalized storage (lowercase)
- Search by allergen
- Allergen-free labeling

### 8. Unit Conversion Management

#### Supported Conversions
- Volume to weight (ml to g)
- Common measurements (cup, tbsp, tsp)
- Imperial units (oz, lb)
- Piece weight for countable items

#### Usage
- Store conversion factors per ingredient
- Account for density differences
- Support recipe scaling

### 9. Data Quality Monitoring

#### Quality Metrics
- Completeness score (0-100)
- Missing field tracking
- Data accuracy checks
- Usage statistics

#### Quality Reports
- Identify incomplete ingredients
- Suggest improvements
- Track quality trends
- Prioritize updates

### 10. Audit Logging

All administrative actions are logged:
- Create/update/delete operations
- Bulk operations
- Moderation decisions
- Data imports/exports

## API Endpoints

### Ingredient Management
- `POST /admin/ingredients/` - Create ingredient
- `GET /admin/ingredients/` - List ingredients with filters
- `GET /admin/ingredients/{id}` - Get ingredient details
- `PUT /admin/ingredients/{id}` - Update ingredient
- `DELETE /admin/ingredients/{id}` - Delete/archive ingredient

### Bulk Operations
- `POST /admin/ingredients/merge` - Merge ingredients
- `POST /admin/ingredients/bulk` - Bulk operations
- `POST /admin/ingredients/import` - Import from file
- `POST /admin/ingredients/export` - Export to file

### Quality & Analytics
- `GET /admin/ingredients/{id}/quality` - Quality report
- `GET /admin/ingredients/{id}/usage` - Usage statistics
- `GET /admin/ingredients/categories` - List categories
- `GET /admin/ingredients/dashboard` - Dashboard stats

### Moderation
- `GET /admin/ingredients/moderation/queue` - Moderation queue
- `POST /admin/ingredients/moderation/{id}/review` - Review submission

## Best Practices

### 1. Data Quality
- Always provide complete nutritional data
- Use standardized category names
- Include allergen information
- Add unit conversions for common measurements

### 2. Moderation
- Review high-priority items first
- Provide clear feedback for rejections
- Use bulk approval for similar items
- Monitor automated check accuracy

### 3. Import/Export
- Validate data before import
- Use templates for consistency
- Regular backups via export
- Clean data before importing

### 4. Performance
- Use pagination for large datasets
- Apply filters to reduce results
- Index frequently searched fields
- Archive unused ingredients

## Security Considerations

1. **Access Control**
   - Admin-only endpoints
   - Audit all operations
   - Validate user permissions

2. **Data Validation**
   - Sanitize all inputs
   - Validate file uploads
   - Check data types and ranges

3. **Privacy**
   - User-submitted ingredients remain private until approved
   - Personal data protection
   - GDPR compliance for exports

## Troubleshooting

### Common Issues

1. **Import Failures**
   - Check CSV formatting
   - Verify required fields
   - Look for duplicate entries
   - Review error messages

2. **Merge Conflicts**
   - Ensure no circular references
   - Check recipe dependencies
   - Verify data compatibility

3. **Quality Scores**
   - Review missing fields
   - Add allergen information
   - Include unit conversions
   - Set dietary flags

### Error Codes
- 400: Validation error
- 404: Ingredient not found
- 409: Conflict (duplicate/in use)
- 500: Server error

## Future Enhancements

1. **AI-Powered Features**
   - Automatic nutritional data extraction from images
   - Smart duplicate detection
   - Suggested categories based on name

2. **Enhanced Moderation**
   - Community voting system
   - Trusted contributor program
   - Automated approval for high-quality submitters

3. **Multi-language Support**
   - Ingredient name translations
   - Localized categories
   - Regional allergen standards

4. **Integration**
   - External nutrition databases
   - Barcode scanning APIs
   - Recipe analysis tools