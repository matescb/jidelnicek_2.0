# Recipe CRUD Tests

This directory contains comprehensive tests for the Recipe CRUD functionality in the Jidelnicek 2.0 application.

## Test Files

### 1. `test_recipe_service.py`
**Purpose**: Tests the core business logic in the RecipeService class

**Key Features**:
- Complete CRUD operations testing
- Ingredient management (add, update, remove)
- Recipe publishing/unpublishing workflows
- Recipe forking functionality
- Recipe duplication with proper isolation
- Advanced search with multiple filters
- Permission-based authorization checks
- Comprehensive error handling

**Test Coverage**:
- ✅ Recipe creation with and without ingredients
- ✅ Recipe retrieval with permission checks
- ✅ Recipe updates with partial data
- ✅ Recipe deletion (soft delete/archiving)
- ✅ Ingredient management operations
- ✅ Publishing workflow with fork constraints
- ✅ Forking with proper attribution
- ✅ Duplication for same user
- ✅ Search functionality with filters
- ✅ Authorization and permission checks
- ✅ Error scenarios and exception handling

### 2. `test_recipe_endpoints.py`
**Purpose**: Tests the REST API endpoints for recipe operations

**Key Features**:
- HTTP endpoint testing (GET, POST, PUT, DELETE)
- Request/response validation
- Authentication and authorization
- Error handling and status codes
- Pagination and filtering
- Recipe actions (publish, fork, duplicate)

**Test Coverage**:
- ✅ Recipe creation endpoints
- ✅ Recipe retrieval endpoints  
- ✅ Recipe update endpoints
- ✅ Recipe deletion endpoints
- ✅ Recipe action endpoints (publish, fork, duplicate)
- ✅ Authentication middleware
- ✅ Authorization checks
- ✅ Error handling (404, 403, 400, 422, 500)
- ✅ Pagination and filtering
- ✅ Search functionality
- ✅ Input validation

### 3. `test_recipe_version.py`
**Purpose**: Tests the recipe version tracking functionality

**Key Features**:
- Version creation and management
- Change detection algorithms
- Version history retrieval
- Nutritional change calculations
- Automatic version creation on updates
- Recipe snapshots in versions

**Test Coverage**:
- ✅ Version creation (manual and automatic)
- ✅ Version history retrieval
- ✅ Change detection algorithms
- ✅ Nutritional change calculations
- ✅ Significance threshold testing
- ✅ Automatic version numbering
- ✅ Recipe snapshots
- ✅ Version permission checks

### 4. `conftest.py`
**Purpose**: Provides common test fixtures for all recipe tests

**Fixtures**:
- `sample_user`: Test user with proper authentication
- `sample_nutritional_value`: Nutritional data for ingredients
- `sample_ingredient`: Test ingredient with nutritional data

## Running the Tests

### Prerequisites
1. Install test dependencies:
   ```bash
   pip install pytest pytest-asyncio httpx
   ```

2. Ensure database is properly configured for testing

3. Set up environment variables for testing

### Execute Tests
```bash
# Run all recipe tests
pytest tests/recipe/ -v

# Run specific test file
pytest tests/recipe/test_recipe_service.py -v

# Run specific test class
pytest tests/recipe/test_recipe_service.py::TestRecipeServiceCrud -v

# Run with coverage
pytest tests/recipe/ --cov=src/jidelnicek/recipe --cov-report=html
```

## Test Structure and Patterns

### Async Testing
All tests use `pytest-asyncio` for proper async/await support:
```python
@pytest.mark.asyncio
async def test_create_recipe(self, db_session, user_fixture):
    # Test implementation
```

### Database Testing
- Uses in-memory SQLite for fast test execution
- Each test runs in isolation with proper cleanup
- Fixtures handle database session management

### Authentication Testing
- JWT tokens for API endpoint testing
- Permission-based access control validation
- Role-based authorization checks

### Error Handling Testing
- Custom exception testing for business logic
- HTTP status code validation for API endpoints
- Proper error message verification

## Key Test Scenarios

### Recipe Management
1. **Create Recipe**: With ingredients, validation, error handling
2. **Read Recipe**: Permission checks, public/private access
3. **Update Recipe**: Partial updates, version tracking
4. **Delete Recipe**: Soft delete, cleanup verification

### Ingredient Operations
1. **Add Ingredient**: Validation, duplication prevention
2. **Update Ingredient**: Quantity changes, display order
3. **Remove Ingredient**: Cleanup, version tracking

### Publishing Workflow
1. **Publish Recipe**: Public visibility, timestamp tracking
2. **Unpublish Recipe**: Fork count constraints
3. **Fork Recipe**: Attribution, permission checks
4. **Duplicate Recipe**: User-specific copying

### Version Control
1. **Change Detection**: Nutritional value changes
2. **Version Creation**: Automatic and manual
3. **History Tracking**: Chronological version listing
4. **Snapshots**: Recipe state preservation

### Search and Filtering
1. **Text Search**: Name, description, instructions
2. **Time Filters**: Preparation, cooking, total time
3. **Ingredient Filters**: Specific ingredient requirements
4. **Status Filters**: Published, public, archived

## Mock Data and Fixtures

### User Fixtures
- `recipe_owner`: User who owns test recipes
- `other_user`: User for permission testing
- `admin_user`: Admin user for system operations

### Recipe Fixtures
- `sample_recipe`: Basic recipe with ingredients
- `published_recipe`: Published recipe for forking
- `sample_recipe_with_versions`: Recipe with version history

### Ingredient Fixtures
- `sample_ingredient`: Basic ingredient with nutrition
- `sample_ingredient_2`: Additional ingredient for testing
- `sample_nutritional_value`: Nutritional reference data

## Business Logic Validation

### Recipe Rules
- Ingredients must exist in the system
- No duplicate ingredients in a single recipe
- Proper user association and ownership
- Validation of all input data

### Publishing Rules
- Recipes must be public to be published
- Published recipes with >5 forks cannot be unpublished
- Proper state transitions and timestamps
- Fork count tracking

### Version Control Rules
- 1% nutritional change triggers automatic versioning
- Sequential version numbering
- Recipe state snapshots
- Significant change detection

## Integration with Existing Codebase

### Database Models
- Uses existing SQLAlchemy models
- Proper relationship handling
- Database constraint validation

### Schema Validation
- Pydantic schema integration
- Request/response validation
- Type safety and data integrity

### Service Layer
- Business logic encapsulation
- Transaction management
- Error handling and logging

### API Layer
- FastAPI integration
- HTTP status code handling
- Authentication middleware

## Quality Assurance

### Test Coverage Goals
- Service Layer: 95%+ coverage
- API Layer: 90%+ coverage
- Error Handling: 100% coverage
- Edge Cases: Comprehensive coverage

### Code Quality
- Clear test naming conventions
- Descriptive test documentation
- Maintainable test structure
- Efficient test execution

### Continuous Integration
- Automated test execution
- Coverage reporting
- Performance monitoring
- Quality gates and thresholds

## Future Enhancements

### Potential Additions
1. **Performance Tests**: Load testing scenarios
2. **Integration Tests**: End-to-end workflows
3. **Security Tests**: Vulnerability assessment
4. **Mobile API Tests**: Mobile-specific testing

### Infrastructure Improvements
1. **Parallel Execution**: Faster test runs
2. **Enhanced Reporting**: Better test results
3. **Mock Services**: External dependency mocking
4. **Test Data Management**: Improved lifecycle

This comprehensive test suite ensures that the Recipe CRUD functionality is robust, secure, and maintainable while providing excellent coverage of all business scenarios and edge cases.