# Jídelníček Test Strategy Document

*Version: 2.0 - Updated for 100-user scale and single VPS deployment*

## 1. Test Strategy Overview

### 1.1 Testing Objectives

The primary objective of the Jídelníček testing strategy is to ensure a high-quality, reliable meal planning application that meets the needs of outdoor enthusiasts and expedition leaders. Our testing approach focuses on:

- **Functional Correctness**: Ensure all features work as specified in the PRD and user stories
- **Calculation Accuracy**: Verify 99.9% accuracy for nutritional calculations and ingredient scaling
- **Performance**: Maintain page load times under 2 seconds and handle concurrent users efficiently
- **Security**: Protect user data and prevent unauthorized access
- **Usability**: Ensure intuitive user experience across both English and Czech interfaces
- **Reliability**: Maintain 99.9% uptime with robust error handling

### 1.2 Test Levels

#### Unit Testing (70% of test effort)
- **Scope**: Individual functions, methods, and components
- **Focus**: Business logic, calculations, data validation
- **Responsibility**: Developers
- **Execution**: Continuous during development

#### Integration Testing (20% of test effort)
- **Scope**: Component interactions, API endpoints, database operations
- **Focus**: Data flow, service integration, API contracts
- **Responsibility**: Development team
- **Execution**: After unit tests pass

#### System Testing (8% of test effort)
- **Scope**: End-to-end workflows, complete user journeys
- **Focus**: User scenarios, cross-feature interactions
- **Responsibility**: QA team
- **Execution**: Pre-release testing

#### Acceptance Testing (2% of test effort)
- **Scope**: Business requirements validation
- **Focus**: User story acceptance criteria
- **Responsibility**: Product owner and stakeholders
- **Execution**: Sprint reviews and release candidates

### 1.3 Test Types

#### Functional Testing
- **Recipe Management**: Creation, editing, versioning, marketplace operations
- **Trip Planning**: Multi-day trips, participant management, meal assignment
- **Nutritional Calculations**: Accuracy of macro/micronutrient calculations
- **Export Functions**: PDF, Excel, and text format generation
- **User Management**: Authentication, preferences, permissions

#### Performance Testing
- **Load Testing**: Support 10,000+ concurrent users
- **Response Time**: API responses < 200ms (p95)
- **Database Performance**: Query optimization, connection pooling
- **Export Performance**: Large trip exports < 30s
- **Search Performance**: Recipe/ingredient search < 500ms

#### Security Testing
- **Authentication**: JWT token security, session management
- **Authorization**: Role-based access control
- **Input Validation**: XSS, SQL injection prevention
- **File Upload**: Size limits, type validation, virus scanning
- **API Security**: Rate limiting, CORS configuration

#### Accessibility Testing
- **WCAG 2.1 AA Compliance**: Keyboard navigation, screen reader support
- **Multi-language Support**: Czech and English interfaces
- **Unit System Flexibility**: Metric/Imperial conversions
- **Mobile Responsiveness**: Responsive web design only
- **PWA Testing**: Deferred to Phase 2 (service workers, offline mode, installation)

### 1.4 Risk-Based Testing Approach

**Critical Risk Areas** (High Priority):
1. Nutritional calculation accuracy
2. Ingredient scaling algorithms
3. Payment processing (future)
4. User authentication/authorization
5. Data loss prevention

**Medium Risk Areas**:
1. Recipe marketplace functionality
2. Export generation
3. Multi-participant coefficient calculations
4. Recipe versioning
5. Shopping list generation

**Low Risk Areas**:
1. UI preferences
2. Template management
3. Rating/review features
4. Share link generation

## 2. Test Environment Strategy

### 2.1 Environment Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Development   │     │    Testing      │     │    Staging      │     │   Production    │
│   Environment   │────▶│   Environment   │────▶│   Environment   │────▶│   Environment   │
└─────────────────┘     └─────────────────┘     └─────────────────┘     └─────────────────┘
                                                                          
Database Strategy:
- Unit Tests: SQLite in-memory for speed and isolation
- Integration Tests: PostgreSQL 15 matching production
- E2E Tests: PostgreSQL 15 with test data
- Production: PostgreSQL 15
```

### 2.2 Database Strategy

#### Unit Tests (SQLite in-memory only)
```python
# Test configuration using SQLite in-memory for unit tests only
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

# Benefits:
# - In-memory for ultra-fast tests
# - No external dependencies
# - Automatic cleanup between tests
# - Sufficient for logic testing
# - Isolated from file system
```

#### Integration Tests (PostgreSQL)
```python
# Docker-based PostgreSQL for integration tests
INTEGRATION_TEST_DATABASE_URL = "postgresql+asyncpg://test:test@localhost:5432/jidelnicek_test"

# Benefits:
# - Production-like behavior
# - Full SQL feature support
# - Accurate query performance testing
# - Constraint validation
```

### 2.3 Test Data Management

#### Test Data Categories
1. **Static Test Data**: Pre-defined ingredients, recipes, users
2. **Generated Test Data**: Faker-based realistic data generation
3. **Production-like Data**: Anonymized production data subset
4. **Edge Case Data**: Boundary values, special characters, large datasets

#### Pagination Strategy
```python
# Pagination implementation for testing large datasets

class PaginationStrategy:
    """Define pagination approach based on dataset size."""
    
    # Cursor-based pagination for large datasets (>1000 items)
    CURSOR_PAGINATION = {
        "use_for": ["recipe_search", "marketplace_browse", "trip_history"],
        "benefits": ["Consistent results", "Handles real-time updates", "Efficient for large datasets"],
        "implementation": """
        SELECT * FROM recipes 
        WHERE id > :last_cursor_id 
        ORDER BY id 
        LIMIT :page_size
        """
    }
    
    # Offset pagination for small datasets (<1000 items)
    OFFSET_PAGINATION = {
        "use_for": ["user_recipes", "trip_days", "ingredients"],
        "benefits": ["Simple implementation", "Easy page jumping", "Good for small sets"],
        "implementation": """
        SELECT * FROM user_recipes 
        WHERE user_id = :user_id
        ORDER BY created_at DESC
        LIMIT :page_size OFFSET :offset
        """
    }
    
    # Test scenarios
    @staticmethod
    def get_test_scenarios():
        return [
            {
                "name": "Large marketplace browse",
                "type": "cursor",
                "dataset_size": 10000,
                "page_size": 20,
                "expected_pages": 500
            },
            {
                "name": "User recipe list",
                "type": "offset", 
                "dataset_size": 100,
                "page_size": 20,
                "expected_pages": 5
            }
        ]
```

#### Test Data Strategy
```python
# Example test data factory
class TestDataFactory:
    @staticmethod
    async def create_test_user(session: AsyncSession, **kwargs):
        """Create a test user with default values."""
        defaults = {
            "email": f"test_{uuid4()}@example.com",
            "password": "Test123!",
            "language": "en",
            "unit_system": "metric"
        }
        defaults.update(kwargs)
        return await UserService.create_user(session, **defaults)
    
    @staticmethod
    async def create_test_recipe(session: AsyncSession, user_id: UUID, **kwargs):
        """Create a test recipe with ingredients."""
        defaults = {
            "name": f"Test Recipe {uuid4()}",
            "servings": 4,
            "ingredients": [
                {"ingredient_id": "flour", "quantity_g": 200},
                {"ingredient_id": "water", "quantity_g": 150}
            ]
        }
        defaults.update(kwargs)
        return await RecipeService.create_recipe(session, user_id, **defaults)
```

### 2.4 Environment Isolation

- **Network Isolation**: Separate VPCs/subnets for each environment
- **Data Isolation**: No production data in test environments
- **Configuration Isolation**: Environment-specific config files
- **Access Control**: Role-based environment access

## 3. Test Automation Strategy

### 3.1 Test Framework Stack

#### Backend Testing (Python)
```python
# requirements/test.txt
pytest==7.4.3
pytest-asyncio==0.21.1
pytest-cov==4.1.0
pytest-mock==3.12.0
pytest-xdist==3.5.0  # Parallel test execution
factory-boy==3.3.0  # Test data factories
faker==20.1.0
httpx==0.25.2  # Async HTTP client for API tests
respx==0.20.2  # HTTP mocking
freezegun==1.3.1  # Time mocking
```

#### Frontend Testing (JavaScript/TypeScript)
```json
// package.json test dependencies
{
  "devDependencies": {
    "@testing-library/react": "^14.0.0",
    "@testing-library/jest-dom": "^6.0.0",
    "@testing-library/user-event": "^14.0.0",
    "jest": "^29.0.0",
    "jest-environment-jsdom": "^29.0.0",
    "cypress": "^13.0.0",
    "playwright": "^1.40.0",
    "msw": "^2.0.0"  // API mocking
  }
}
```

### 3.2 Test Pyramid Implementation

#### Level 1: Unit Tests (70%)
```python
# Example: Nutritional calculation unit test
class TestNutritionalCalculations:
    def test_recipe_nutrition_calculation(self):
        """Test accurate nutrition calculation for a recipe."""
        ingredients = [
            {"ingredient": flour, "quantity_g": 100},  # 364 kcal/100g
            {"ingredient": sugar, "quantity_g": 50}    # 387 kcal/100g
        ]
        
        nutrition = calculate_recipe_nutrition(ingredients)
        
        assert nutrition.calories == 558  # (364*1.0) + (387*0.5)
        assert nutrition.proteins_g == 10.3
        assert nutrition.carbohydrates_g == 124.5
        assert nutrition.fats_g == 1.2
    
    def test_participant_coefficient_scaling(self):
        """Test meal scaling with participant coefficients."""
        base_calories = 600
        participants = [
            {"name": "Adult", "coefficient": 1.0},
            {"name": "Teen", "coefficient": 1.5},
            {"name": "Child", "coefficient": 0.75}
        ]
        
        portions = calculate_portions(base_calories, participants)
        
        assert portions[0] == 600   # Adult: 600 * 1.0
        assert portions[1] == 900   # Teen: 600 * 1.5
        assert portions[2] == 450   # Child: 600 * 0.75
```

#### Level 2: Integration Tests (20%)
```python
# Example: API integration test
class TestRecipeAPI:
    @pytest.mark.asyncio
    async def test_create_recipe_workflow(self, client, auth_headers):
        """Test complete recipe creation workflow."""
        # Create ingredients first
        ingredient_data = {
            "name": "Test Flour",
            "calories": 364,
            "proteins_g": 10.3,
            "carbohydrates_g": 76.3,
            "fats_g": 1.0
        }
        ingredient_response = await client.post(
            "/api/ingredients",
            json=ingredient_data,
            headers=auth_headers
        )
        ingredient_id = ingredient_response.json()["id"]
        
        # Create recipe with ingredient
        recipe_data = {
            "name": "Test Bread",
            "instructions": "Mix and bake",
            "cook_time_minutes": 30,
            "water_ml": 200,
            "ingredients": [
                {"ingredient_id": ingredient_id, "quantity_g": 500}
            ]
        }
        recipe_response = await client.post(
            "/api/recipes",
            json=recipe_data,
            headers=auth_headers
        )
        
        assert recipe_response.status_code == 201
        recipe = recipe_response.json()
        assert recipe["nutrition"]["calories"] == 1820  # 364 * 5
        assert len(recipe["ingredients"]) == 1
```

#### Level 3: E2E Tests (10%)
```javascript
// Example: Cypress E2E test
describe('Trip Planning Flow', () => {
  beforeEach(() => {
    cy.login('test@example.com', 'password');
  });

  it('should create a complete 5-day hiking trip', () => {
    // Navigate to trips
    cy.visit('/trips');
    cy.contains('Create Trip').click();
    
    // Fill trip details
    cy.get('[data-testid="trip-name"]').type('Summer Alpine Trek');
    cy.get('[data-testid="start-date"]').type('2024-07-01');
    cy.get('[data-testid="end-date"]').type('2024-07-05');
    
    // Add participants
    cy.get('[data-testid="add-participant"]').click();
    cy.get('[data-testid="participant-name-0"]').type('John');
    cy.get('[data-testid="participant-coefficient-0"]').clear().type('1.0');
    
    // Add meals for day 1
    cy.get('[data-testid="day-1-breakfast"]').click();
    cy.get('[data-testid="recipe-search"]').type('Oatmeal');
    cy.get('[data-testid="recipe-result-0"]').click();
    cy.get('[data-testid="target-calories"]').type('600');
    
    // Verify calculations
    cy.get('[data-testid="day-1-total-calories"]').should('contain', '600');
    cy.get('[data-testid="trip-total-weight"]').should('be.visible');
  });
});
```

### 3.3 Page Object Model for E2E Tests

```typescript
// Example: Page Object for Recipe Creation
export class RecipeCreationPage {
  private readonly nameInput = '[data-testid="recipe-name"]';
  private readonly ingredientSearch = '[data-testid="ingredient-search"]';
  private readonly addIngredientBtn = '[data-testid="add-ingredient"]';
  private readonly saveRecipeBtn = '[data-testid="save-recipe"]';
  
  async createRecipe(name: string, ingredients: IngredientInput[]) {
    await page.fill(this.nameInput, name);
    
    for (const ingredient of ingredients) {
      await page.fill(this.ingredientSearch, ingredient.name);
      await page.click(`[data-testid="ingredient-${ingredient.id}"]`);
      await page.fill('[data-testid="quantity"]', ingredient.quantity.toString());
      await page.click(this.addIngredientBtn);
    }
    
    await page.click(this.saveRecipeBtn);
    await page.waitForSelector('[data-testid="recipe-saved-toast"]');
  }
}
```

### 3.4 API Test Automation

```python
# Example: API test collection with Tavern (YAML-based)
# tests/api/test_recipe_api.tavern.yaml
test_name: Recipe CRUD Operations

stages:
  - name: Create a new recipe
    request:
      url: "{base_url}/api/recipes"
      method: POST
      headers:
        Authorization: "Bearer {access_token}"
      json:
        name: "Energy Bars"
        servings: 10
        ingredients:
          - ingredient_id: "oats"
            quantity_g: 200
          - ingredient_id: "honey"
            quantity_g: 100
    response:
      status_code: 201
      json:
        name: "Energy Bars"
        servings: 10
      save:
        json:
          recipe_id: id

  - name: Update the recipe
    request:
      url: "{base_url}/api/recipes/{recipe_id}"
      method: PUT
      headers:
        Authorization: "Bearer {access_token}"
      json:
        servings: 12
    response:
      status_code: 200
      json:
        servings: 12
```

### 3.5 Performance Test Automation

```python
# Example: Locust performance test
from locust import HttpUser, task, between
import random

class JidelnicekUser(HttpUser):
    wait_time = between(1, 3)
    
    def on_start(self):
        """Login and get auth token."""
        response = self.client.post("/api/auth/login", json={
            "email": "perf_test@example.com",
            "password": "test123"
        })
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    @task(3)
    def browse_marketplace(self):
        """Most common operation - browsing recipes."""
        self.client.get("/api/marketplace/recipes?limit=20", headers=self.headers)
    
    @task(2)
    def view_recipe_details(self):
        """View specific recipe details."""
        recipe_id = random.choice(self.recipe_ids)
        self.client.get(f"/api/recipes/{recipe_id}", headers=self.headers)
    
    @task(1)
    def calculate_trip_nutrition(self):
        """Heavy operation - calculate trip nutrition."""
        self.client.get(f"/api/trips/{self.trip_id}/nutrition", headers=self.headers)
    
    @task(1)
    def generate_shopping_list(self):
        """Generate shopping list for a trip."""
        self.client.post(f"/api/trips/{self.trip_id}/shopping-list", headers=self.headers)
```

### 3.6 Nutritional Calculation Test Suite

#### Accuracy Requirements
- Target: 99.9% accuracy for all nutritional calculations
- Maximum allowed deviation: 0.1% or 0.1g (whichever is larger)
- Rounding: To nearest 0.1g for display, full precision in storage

#### Test Categories

1. **Basic Calculation Tests**
```python
@pytest.mark.parametrize("ingredients,expected", [
    # Single ingredient
    ([{"id": "rice", "amount": 100, "nutrition_per_100g": {"calories": 130}}], 
     {"calories": 130, "accuracy": 100.0}),
    # Multiple ingredients
    ([{"id": "rice", "amount": 100, "nutrition_per_100g": {"calories": 130}},
      {"id": "oil", "amount": 10, "nutrition_per_100g": {"calories": 884}}],
     {"calories": 218.4, "accuracy": 99.95}),
])
def test_basic_nutritional_calculation(ingredients, expected):
    result = calculate_nutrition(ingredients)
    assert abs(result['calories'] - expected['calories']) < 0.1
    assert calculate_accuracy(result, expected) >= 99.9
```

2. **Scaling Tests**
```python
def test_recipe_scaling_accuracy():
    """Test that scaling maintains 99.9% accuracy"""
    base_recipe = create_test_recipe(servings=1)
    
    for scale_factor in [0.5, 1.5, 2.0, 10.0, 0.33]:
        scaled = scale_recipe(base_recipe, scale_factor)
        expected = multiply_nutrition(base_recipe.nutrition, scale_factor)
        
        for nutrient in NUTRIENTS:
            assert_accuracy(scaled[nutrient], expected[nutrient], 99.9)
```

3. **Participant Coefficient Tests**
```python
def test_participant_coefficients():
    """Test coefficient application maintains accuracy"""
    coefficients = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0, 3.0]
    base_portion = 600  # kcal
    
    for coef in coefficients:
        result = apply_coefficient(base_portion, coef)
        expected = base_portion * coef
        assert abs(result - expected) < 0.1
```

4. **Edge Case Tests**
- Zero quantities
- Very small quantities (< 1g)
- Very large quantities (> 10kg)
- Missing nutritional data
- Partial nutritional data

### 3.7 Calculation Performance Benchmarks

| Operation | Target | Maximum |
|-----------|--------|---------|
| Single ingredient nutrition | < 1ms | 5ms |
| 50-ingredient recipe | < 10ms | 50ms |
| Recipe scaling | < 5ms | 20ms |
| Trip total (7 days, 20 people) | < 100ms | 500ms |
| Shopping list generation | < 200ms | 1000ms |

## 4. Test Data Strategy

### 4.1 Test Data Generation

```python
# Test data generator using Factory Boy
import factory
from factory import fuzzy
from app.models import User, Recipe, Ingredient, NutritionalValue

class NutritionalValueFactory(factory.Factory):
    class Meta:
        model = NutritionalValue
    
    calories = fuzzy.FuzzyDecimal(50, 500, 2)
    proteins_g = fuzzy.FuzzyDecimal(0, 30, 2)
    carbohydrates_g = fuzzy.FuzzyDecimal(0, 80, 2)
    fats_g = fuzzy.FuzzyDecimal(0, 30, 2)
    fiber_g = fuzzy.FuzzyDecimal(0, 10, 2)
    sugars_g = factory.LazyAttribute(lambda o: o.carbohydrates_g * 0.3)

class IngredientFactory(factory.Factory):
    class Meta:
        model = Ingredient
    
    name = factory.Faker('word')
    category = factory.Faker('random_element', elements=[
        'Grains', 'Dairy', 'Proteins', 'Vegetables', 'Fruits', 'Oils', 'Spices'
    ])
    nutritional_value = factory.SubFactory(NutritionalValueFactory)
    is_global = True

class RecipeFactory(factory.Factory):
    class Meta:
        model = Recipe
    
    name = factory.Faker('sentence', nb_words=3)
    description = factory.Faker('text', max_nb_chars=200)
    instructions = factory.Faker('text', max_nb_chars=1000)
    prep_time_minutes = fuzzy.FuzzyInteger(5, 60)
    cook_time_minutes = fuzzy.FuzzyInteger(10, 120)
    water_ml = fuzzy.FuzzyInteger(0, 1000, step=50)
    servings = fuzzy.FuzzyInteger(1, 8)

# Usage in tests
def test_recipe_with_ingredients():
    # Create test data
    ingredients = IngredientFactory.create_batch(5)
    recipe = RecipeFactory.create()
    
    # Add ingredients to recipe
    for ingredient in ingredients:
        recipe.add_ingredient(ingredient, quantity_g=random.randint(10, 200))
    
    # Test calculations
    assert recipe.total_calories > 0
    assert len(recipe.ingredients) == 5
```

### 4.2 Test Data Fixtures

```python
# conftest.py - Shared test fixtures
import pytest
from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import AsyncSession

@pytest.fixture
async def base_ingredients(async_session: AsyncSession) -> list:
    """Create base ingredients for testing."""
    ingredients_data = [
        {
            "name": "Flour",
            "calories": 364,
            "proteins_g": 10.3,
            "carbohydrates_g": 76.3,
            "fats_g": 1.0,
            "category": "Grains"
        },
        {
            "name": "Sugar",
            "calories": 387,
            "proteins_g": 0,
            "carbohydrates_g": 100,
            "fats_g": 0,
            "category": "Sweeteners"
        },
        {
            "name": "Olive Oil",
            "calories": 884,
            "proteins_g": 0,
            "carbohydrates_g": 0,
            "fats_g": 100,
            "category": "Oils"
        }
    ]
    
    ingredients = []
    for data in ingredients_data:
        ingredient = await create_ingredient(async_session, **data)
        ingredients.append(ingredient)
    
    return ingredients

@pytest.fixture
async def sample_trip(async_session: AsyncSession, test_user, base_ingredients):
    """Create a sample 3-day trip for testing."""
    trip = await create_trip(
        session=async_session,
        user_id=test_user.id,
        name="Test Mountain Trek",
        start_date="2024-07-01",
        end_date="2024-07-03",
        participants=[
            {"name": "Leader", "coefficient": 1.0},
            {"name": "Member", "coefficient": 1.2}
        ]
    )
    
    # Add some meals
    for day in range(3):
        await add_meal_to_day(
            session=async_session,
            trip_id=trip.id,
            day_number=day + 1,
            meal_slot="Breakfast",
            recipe_id=test_user.recipes[0].id,
            target_calories=600
        )
    
    return trip
```

### 4.3 Database Seeding

```python
# scripts/seed_test_data.py
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from app.database import Base
from app.services import UserService, RecipeService, IngredientService

async def seed_test_database():
    """Seed test database with realistic data."""
    engine = create_async_engine(TEST_DATABASE_URL)
    
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    async with AsyncSession(engine) as session:
        # Create test users
        users = []
        for i in range(10):
            user = await UserService.create_user(
                session,
                email=f"test_user_{i}@example.com",
                password="Test123!",
                language="en" if i % 2 == 0 else "cs"
            )
            users.append(user)
        
        # Create global ingredients
        ingredients = await seed_global_ingredients(session)
        
        # Create recipes for each user
        for user in users:
            await seed_user_recipes(session, user.id, ingredients)
        
        # Create sample trips
        for user in users[:5]:
            await seed_user_trips(session, user.id)
        
        await session.commit()

async def seed_global_ingredients(session: AsyncSession):
    """Seed common ingredients."""
    ingredient_data = load_json("test_data/ingredients.json")
    ingredients = []
    
    for data in ingredient_data:
        ingredient = await IngredientService.create_global_ingredient(
            session, **data
        )
        ingredients.append(ingredient)
    
    return ingredients

if __name__ == "__main__":
    asyncio.run(seed_test_database())
```

### 4.4 Data Privacy in Tests

```python
# Data anonymization for test environments
class DataAnonymizer:
    """Anonymize production data for test use."""
    
    @staticmethod
    def anonymize_user(user_data: dict) -> dict:
        """Remove PII from user data."""
        faker = Faker()
        return {
            **user_data,
            "email": faker.email(),
            "name": faker.name(),
            "created_at": user_data["created_at"],
            "preferences": user_data["preferences"]
        }
    
    @staticmethod
    def anonymize_recipe(recipe_data: dict) -> dict:
        """Anonymize recipe author information."""
        return {
            **recipe_data,
            "user_id": str(uuid4()),
            "author_name": "Test User"
        }
    
    @staticmethod
    async def create_test_dataset(production_backup: str, output_path: str):
        """Create anonymized test dataset from production backup."""
        data = load_backup(production_backup)
        
        # Anonymize users
        data["users"] = [
            DataAnonymizer.anonymize_user(user)
            for user in data["users"]
        ]
        
        # Anonymize recipes
        data["recipes"] = [
            DataAnonymizer.anonymize_recipe(recipe)
            for recipe in data["recipes"]
        ]
        
        save_json(data, output_path)
```

## 5. Test Execution Plan

### 5.1 Continuous Testing in CI/CD

```yaml
# .github/workflows/test.yml
name: Test Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        python-version: [3.11]
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: ${{ matrix.python-version }}
      
      - name: Cache dependencies
        uses: actions/cache@v3
        with:
          path: ~/.cache/pip
          key: ${{ runner.os }}-pip-${{ hashFiles('requirements/*.txt') }}
      
      - name: Install dependencies
        run: |
          pip install -r requirements/test.txt
      
      - name: Run unit tests
        run: |
          pytest tests/unit \
            --cov=app \
            --cov-report=xml \
            --cov-report=term-missing \
            --junit-xml=test-results/junit.xml \
            # -n 2  # Optional parallel execution for faster CI
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          file: ./coverage.xml
          fail_ci_if_error: true

  integration-tests:
    runs-on: ubuntu-latest
    needs: unit-tests
    
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: test
          POSTGRES_DB: jidelnicek_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      
      redis:
        image: redis:7
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Run integration tests
        run: |
          pytest tests/integration \
            --db-url=postgresql://postgres:test@localhost/jidelnicek_test \
            --redis-url=redis://localhost:6379
      
      - name: Run API contract tests
        run: |
          pytest tests/api \
            --html=test-results/api-report.html

  e2e-tests:
    runs-on: ubuntu-latest
    needs: integration-tests
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Start application
        run: |
          docker-compose -f docker-compose.test.yml up -d
          ./scripts/wait-for-app.sh
      
      - name: Run E2E tests
        run: |
          npm run test:e2e
      
      - name: Upload test artifacts
        if: failure()
        uses: actions/upload-artifact@v3
        with:
          name: e2e-screenshots
          path: cypress/screenshots

  performance-tests:
    runs-on: ubuntu-latest
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Run performance tests
        run: |
          locust \
            -f tests/performance/locustfile.py \
            --headless \
            --users 100 \
            --spawn-rate 10 \
            --run-time 5m \
            --host https://staging.jidelnicek.cz
      
      - name: Analyze results
        run: |
          python scripts/analyze_performance.py \
            --input locust_stats.json \
            --threshold-p95 200 \
            --threshold-p99 500
```

### 5.2 Regression Test Selection

```python
# Intelligent test selection based on code changes
class RegressionTestSelector:
    """Select relevant tests based on code changes."""
    
    def __init__(self, git_diff: str):
        self.changed_files = self._parse_git_diff(git_diff)
        self.test_mapping = self._load_test_mapping()
    
    def select_tests(self) -> List[str]:
        """Select tests affected by code changes."""
        selected_tests = set()
        
        for file in self.changed_files:
            # Direct test file changes
            if file.startswith("tests/"):
                selected_tests.add(file)
            
            # Source file changes
            elif file.startswith("app/"):
                # Find related tests
                module = file.replace("app/", "").replace(".py", "")
                related_tests = self.test_mapping.get(module, [])
                selected_tests.update(related_tests)
        
        # Always run critical tests
        selected_tests.update(self._get_critical_tests())
        
        return list(selected_tests)
    
    def _get_critical_tests(self) -> List[str]:
        """Return tests that should always run."""
        return [
            "tests/unit/test_calculations.py",
            "tests/integration/test_recipe_api.py",
            "tests/integration/test_trip_api.py"
        ]

# Usage in CI
if __name__ == "__main__":
    git_diff = subprocess.check_output(["git", "diff", "--name-only", "HEAD~1"])
    selector = RegressionTestSelector(git_diff.decode())
    tests = selector.select_tests()
    
    if tests:
        subprocess.run(["pytest"] + tests)
```

### 5.3 Smoke Test Suite

```python
# tests/smoke/test_smoke.py
import pytest
from httpx import AsyncClient

class TestSmokeTests:
    """Quick smoke tests for basic functionality."""
    
    @pytest.mark.smoke
    async def test_api_health(self, client: AsyncClient):
        """API responds to health checks."""
        response = await client.get("/health")
        assert response.status_code == 200
        assert response.json()["status"] == "healthy"
    
    @pytest.mark.smoke
    async def test_database_connection(self, async_session):
        """Database is accessible."""
        result = await async_session.execute("SELECT 1")
        assert result.scalar() == 1
    
    @pytest.mark.smoke
    async def test_redis_connection(self, redis_client):
        """Redis cache is accessible."""
        await redis_client.set("test_key", "test_value")
        value = await redis_client.get("test_key")
        assert value == b"test_value"
    
    @pytest.mark.smoke
    async def test_user_registration(self, client: AsyncClient):
        """User registration works."""
        response = await client.post("/api/auth/register", json={
            "email": f"smoke_test_{uuid4()}@example.com",
            "password": "Test123!"
        })
        assert response.status_code == 201
        assert "access_token" in response.json()
    
    @pytest.mark.smoke
    async def test_recipe_creation(self, client: AsyncClient, auth_headers):
        """Recipe creation works."""
        response = await client.post("/api/recipes", 
            json={
                "name": "Smoke Test Recipe",
                "servings": 1,
                "ingredients": []
            },
            headers=auth_headers
        )
        assert response.status_code == 201

# Run smoke tests
# pytest -m smoke --maxfail=1 --tb=short
```

### 5.4 Release Testing Checklist

```markdown
## Pre-Release Testing Checklist

### Automated Tests ✓
- [ ] All unit tests passing (coverage > 80%)
- [ ] All integration tests passing
- [ ] All E2E tests passing
- [ ] Performance benchmarks met
- [ ] Security scan completed

### Manual Testing
- [ ] New features tested on staging
- [ ] Regression testing completed
- [ ] Cross-browser testing (Chrome, Firefox, Safari)
- [ ] Mobile responsive testing (iOS Safari, Chrome Android)
- [ ] Language switching (EN ↔ CS)
- [ ] Unit system switching (Metric ↔ Imperial)

### Data Validation
- [ ] Recipe nutrition calculations verified
- [ ] Trip calculations with multiple participants
- [ ] Export generation (PDF, Excel, TXT)
- [ ] Shopping list accuracy
- [ ] Fuel calculations

### Performance Validation
- [ ] Page load times < 2s
- [ ] API response times < 200ms (p95)
- [ ] Concurrent user load test (1000 users)
- [ ] Large trip export < 30s

### Security Validation
- [ ] Authentication flows tested
- [ ] Permission checks verified
- [ ] Input validation tested
- [ ] File upload restrictions enforced

### Deployment Validation
- [ ] Database migrations tested
- [ ] Rollback procedure verified
- [ ] Monitoring alerts configured
- [ ] Backup restoration tested

### Sign-offs
- [ ] QA Lead approval
- [ ] Product Owner approval
- [ ] Technical Lead approval
- [ ] Release notes prepared
```

## 6. Test Metrics

### 6.1 Code Coverage Targets

```python
# pytest.ini
[tool:pytest]
minversion = 6.0
addopts = 
    --cov=app
    --cov-report=term-missing:skip-covered
    --cov-report=html
    --cov-report=xml
    --cov-fail-under=80

[coverage:run]
source = app
omit = 
    */tests/*
    */migrations/*
    */__init__.py
    */config.py

[coverage:report]
precision = 2
exclude_lines =
    pragma: no cover
    def __repr__
    raise AssertionError
    raise NotImplementedError
    if __name__ == .__main__.:
    @abstract
```

**Coverage Targets by Module:**
- **Core Business Logic**: 95%+ (calculations, recipes, trips)
- **API Endpoints**: 90%+ (all endpoints tested)
- **Services**: 85%+ (business logic layer)
- **Models**: 80%+ (database models)
- **Utilities**: 70%+ (helper functions)

### 6.2 Defect Metrics

```python
# Defect tracking and analysis
class DefectMetrics:
    """Track and analyze defect metrics."""
    
    @staticmethod
    def calculate_defect_density(defects: List[Defect], kloc: float) -> float:
        """Defects per thousand lines of code."""
        return len(defects) / kloc
    
    @staticmethod
    def calculate_defect_removal_efficiency(
        defects_found_testing: int,
        defects_found_production: int
    ) -> float:
        """DRE = Defects found in testing / Total defects * 100."""
        total = defects_found_testing + defects_found_production
        return (defects_found_testing / total) * 100 if total > 0 else 100
    
    @staticmethod
    def categorize_defects(defects: List[Defect]) -> Dict[str, int]:
        """Categorize defects by severity and type."""
        categories = {
            "critical": 0,
            "major": 0,
            "minor": 0,
            "trivial": 0
        }
        
        for defect in defects:
            categories[defect.severity] += 1
        
        return categories
```

**Target Metrics:**
- **Defect Density**: < 5 defects/KLOC
- **DRE**: > 95% (find defects before production)
- **Critical Defects**: 0 in production
- **Mean Time to Resolution**: < 24h for critical, < 72h for major

### 6.3 Test Execution Metrics

```python
# Test execution tracking
class TestExecutionMetrics:
    """Track test execution metrics."""
    
    def __init__(self):
        self.results = []
    
    def record_test_run(self, test_run: TestRun):
        """Record test execution results."""
        self.results.append({
            "timestamp": test_run.timestamp,
            "total_tests": test_run.total,
            "passed": test_run.passed,
            "failed": test_run.failed,
            "skipped": test_run.skipped,
            "duration": test_run.duration,
            "coverage": test_run.coverage
        })
    
    def calculate_pass_rate(self, days: int = 7) -> float:
        """Calculate test pass rate over period."""
        recent = self._get_recent_runs(days)
        total = sum(r["total_tests"] for r in recent)
        passed = sum(r["passed"] for r in recent)
        return (passed / total * 100) if total > 0 else 0
    
    def calculate_flakiness(self, test_name: str) -> float:
        """Calculate test flakiness percentage."""
        runs = self._get_test_runs(test_name)
        if len(runs) < 2:
            return 0
        
        status_changes = 0
        for i in range(1, len(runs)):
            if runs[i].status != runs[i-1].status:
                status_changes += 1
        
        return (status_changes / len(runs)) * 100
```

**Execution Targets:**
- **Test Pass Rate**: > 98%
- **Test Flakiness**: < 2%
- **Average Test Duration**: < 10 minutes for unit tests
- **Parallel Execution**: 4-8 workers

### 6.4 Quality Trends

```python
# Quality trend analysis
class QualityTrendAnalyzer:
    """Analyze quality trends over time."""
    
    def __init__(self, metrics_db: MetricsDatabase):
        self.db = metrics_db
    
    async def generate_quality_report(self, period_days: int = 30) -> Dict:
        """Generate comprehensive quality report."""
        return {
            "code_coverage": await self._get_coverage_trend(period_days),
            "defect_trend": await self._get_defect_trend(period_days),
            "test_reliability": await self._get_test_reliability(period_days),
            "performance_trend": await self._get_performance_trend(period_days),
            "security_score": await self._get_security_score(),
            "technical_debt": await self._get_technical_debt_ratio()
        }
    
    async def _get_coverage_trend(self, days: int) -> List[Dict]:
        """Get code coverage trend."""
        query = """
            SELECT date, coverage_percent, critical_coverage_percent
            FROM coverage_metrics
            WHERE date >= CURRENT_DATE - INTERVAL '%s days'
            ORDER BY date
        """
        return await self.db.fetch_all(query, days)
```

**Quality Goals:**
- **Code Coverage Trend**: Increasing or stable > 80%
- **Defect Trend**: Decreasing over time
- **Test Reliability**: > 98% consistent pass rate
- **Performance Regression**: < 5% degradation per release
- **Security Vulnerabilities**: 0 critical, < 5 medium

## 7. Sample Test Code and Configurations

### 7.1 Complete Test Configuration

```python
# conftest.py - Root test configuration
import pytest
import asyncio
from typing import AsyncGenerator, Generator
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from httpx import AsyncClient
from redis.asyncio import Redis
import os

# Configure event loop
@pytest.fixture(scope="session")
def event_loop() -> Generator:
    """Create event loop for async tests."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()

# Database fixtures
@pytest.fixture(scope="function")
async def async_engine():
    """Create async engine for unit tests only."""
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        echo=False,
        future=True
    )
    
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    yield engine
    
    await engine.dispose()

@pytest.fixture(scope="function")
async def async_session(async_engine) -> AsyncGenerator[AsyncSession, None]:
    """Create async session for tests."""
    async_session_maker = sessionmaker(
        async_engine,
        class_=AsyncSession,
        expire_on_commit=False
    )
    
    async with async_session_maker() as session:
        yield session
        await session.rollback()

# API client fixtures
@pytest.fixture(scope="function")
async def app(async_session):
    """Create FastAPI app with test database."""
    from app.main import create_app
    from app.dependencies import get_db
    
    app = create_app()
    
    # Override database dependency
    async def override_get_db():
        yield async_session
    
    app.dependency_overrides[get_db] = override_get_db
    
    yield app
    
    app.dependency_overrides.clear()

@pytest.fixture(scope="function")
async def client(app) -> AsyncGenerator[AsyncClient, None]:
    """Create async HTTP client."""
    async with AsyncClient(app=app, base_url="http://test") as ac:
        yield ac

# Authentication fixtures
@pytest.fixture(scope="function")
async def test_user(async_session):
    """Create test user."""
    from app.services.auth_service import AuthService
    
    user = await AuthService.register_user(
        session=async_session,
        email="test@example.com",
        password="Test123!",
        language="en"
    )
    
    yield user

@pytest.fixture(scope="function")
async def auth_headers(test_user):
    """Create authentication headers."""
    from app.core.security import create_access_token
    
    token = create_access_token(user_id=str(test_user.id))
    return {"Authorization": f"Bearer {token}"}

# Redis fixtures
@pytest.fixture(scope="function")
async def redis_client():
    """Create Redis client for tests."""
    client = Redis(host="localhost", port=6379, db=1)
    
    yield client
    
    await client.flushdb()
    await client.close()
```

### 7.2 Example Unit Tests

```python
# tests/unit/test_nutritional_calculations.py
import pytest
from decimal import Decimal
from app.services.calculation_service import NutritionalCalculator
from app.models import Ingredient, Recipe, NutritionalValue

class TestNutritionalCalculator:
    """Test nutritional calculation logic."""
    
    @pytest.fixture
    def calculator(self):
        return NutritionalCalculator()
    
    @pytest.fixture
    def sample_ingredients(self):
        """Create sample ingredients with known values."""
        return [
            Ingredient(
                name="Oats",
                nutritional_value=NutritionalValue(
                    calories=389,
                    proteins_g=16.9,
                    carbohydrates_g=66.3,
                    fats_g=6.9,
                    fiber_g=10.6
                )
            ),
            Ingredient(
                name="Milk Powder",
                nutritional_value=NutritionalValue(
                    calories=496,
                    proteins_g=26.3,
                    carbohydrates_g=38.4,
                    fats_g=26.7,
                    calcium_mg=912
                )
            )
        ]
    
    def test_calculate_recipe_nutrition(self, calculator, sample_ingredients):
        """Test basic recipe nutrition calculation."""
        recipe_ingredients = [
            {"ingredient": sample_ingredients[0], "quantity_g": 100},
            {"ingredient": sample_ingredients[1], "quantity_g": 50}
        ]
        
        nutrition = calculator.calculate_recipe_nutrition(recipe_ingredients)
        
        # Verify calculations (per 100g basis)
        assert nutrition.calories == 389 + (496 * 0.5)  # 637
        assert nutrition.proteins_g == 16.9 + (26.3 * 0.5)  # 30.05
        assert nutrition.carbohydrates_g == 66.3 + (38.4 * 0.5)  # 85.5
        assert nutrition.fats_g == 6.9 + (26.7 * 0.5)  # 20.25
        assert nutrition.fiber_g == 10.6  # Only from oats
        assert nutrition.calcium_mg == 912 * 0.5  # 456, only from milk
    
    def test_scale_recipe_to_calories(self, calculator, sample_ingredients):
        """Test scaling recipe to meet calorie target."""
        recipe = Recipe(
            name="Energy Porridge",
            servings=1,
            ingredients=[
                {"ingredient": sample_ingredients[0], "quantity_g": 80},
                {"ingredient": sample_ingredients[1], "quantity_g": 20}
            ]
        )
        
        # Original calories: (389 * 0.8) + (496 * 0.2) = 311.2 + 99.2 = 410.4
        target_calories = 600
        
        scaling_factor = calculator.calculate_scaling_factor(
            recipe, target_calories
        )
        
        assert abs(scaling_factor - 1.461) < 0.001  # 600 / 410.4
        
        scaled_ingredients = calculator.scale_ingredients(
            recipe.ingredients, scaling_factor
        )
        
        assert scaled_ingredients[0]["quantity_g"] == pytest.approx(116.88, 0.01)
        assert scaled_ingredients[1]["quantity_g"] == pytest.approx(29.22, 0.01)
    
    def test_participant_portions(self, calculator):
        """Test portion calculation with participant coefficients."""
        base_calories = 500
        participants = [
            {"name": "Adult 1", "coefficient": 1.0},
            {"name": "Adult 2", "coefficient": 1.2},
            {"name": "Teen", "coefficient": 0.8},
            {"name": "Child", "coefficient": 0.6}
        ]
        
        portions = calculator.calculate_participant_portions(
            base_calories, participants
        )
        
        assert portions[0]["calories"] == 500
        assert portions[1]["calories"] == 600
        assert portions[2]["calories"] == 400
        assert portions[3]["calories"] == 300
        assert sum(p["calories"] for p in portions) == 1800
    
    def test_micronutrient_precision(self, calculator):
        """Test micronutrient calculation precision."""
        ingredient = Ingredient(
            name="Salt",
            nutritional_value=NutritionalValue(
                calories=0,
                proteins_g=0,
                carbohydrates_g=0,
                fats_g=0,
                sodium_mg=38758  # per 100g
            )
        )
        
        # 0.5g of salt
        nutrition = calculator.calculate_ingredient_nutrition(
            ingredient, quantity_g=0.5
        )
        
        assert nutrition.sodium_mg == pytest.approx(193.79, 0.01)
        
        # Test display formatting
        display_value = calculator.format_nutrient_display(
            nutrition.sodium_mg, unit="mg"
        )
        assert display_value == "193.79"
    
    def test_vitamin_calculations(self, calculator):
        """Test vitamin calculation and display."""
        ingredient = Ingredient(
            name="Orange Juice Powder",
            nutritional_value=NutritionalValue(
                calories=358,
                proteins_g=5.5,
                carbohydrates_g=82.3,
                fats_g=1.5,
                vitamin_c_mg=450,  # per 100g
                vitamin_a_ug=180
            )
        )
        
        # 10g serving
        nutrition = calculator.calculate_ingredient_nutrition(
            ingredient, quantity_g=10
        )
        
        assert nutrition.vitamin_c_mg == 45.0
        assert nutrition.vitamin_a_ug == 18.0
        
        # Test below threshold display
        tiny_nutrition = calculator.calculate_ingredient_nutrition(
            ingredient, quantity_g=0.001  # 1mg
        )
        
        assert tiny_nutrition.vitamin_c_mg == 0.0045
        display = calculator.format_nutrient_display(
            tiny_nutrition.vitamin_c_mg, unit="mg", threshold=0.01
        )
        assert display == "<0.01"
```

### 7.3 Example Integration Tests

```python
# tests/integration/test_trip_workflow.py
import pytest
from datetime import date, timedelta
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

class TestTripWorkflow:
    """Test complete trip planning workflow."""
    
    @pytest.mark.asyncio
    async def test_complete_trip_planning_flow(
        self,
        client: AsyncClient,
        auth_headers: dict,
        sample_recipes: list
    ):
        """Test creating and planning a complete trip."""
        
        # Step 1: Create trip
        trip_data = {
            "name": "Alpine Adventure",
            "start_date": str(date.today() + timedelta(days=30)),
            "end_date": str(date.today() + timedelta(days=34)),
            "meal_slots": ["Breakfast", "Lunch", "Dinner", "Snack"],
            "participants": [
                {"name": "John", "coefficient": 1.0},
                {"name": "Jane", "coefficient": 0.9},
                {"name": "Teen", "coefficient": 1.2}
            ]
        }
        
        response = await client.post(
            "/api/trips",
            json=trip_data,
            headers=auth_headers
        )
        assert response.status_code == 201
        trip = response.json()
        trip_id = trip["id"]
        
        # Step 2: Add meals to days
        for day_num in range(1, 6):
            # Add breakfast
            meal_data = {
                "recipe_id": sample_recipes[0]["id"],
                "target_calories_per_person": 600
            }
            response = await client.post(
                f"/api/trips/{trip_id}/days/{day_num}/meals/Breakfast",
                json=meal_data,
                headers=auth_headers
            )
            assert response.status_code == 201
            
            # Add dinner
            meal_data = {
                "recipe_id": sample_recipes[1]["id"],
                "target_calories_per_person": 800
            }
            response = await client.post(
                f"/api/trips/{trip_id}/days/{day_num}/meals/Dinner",
                json=meal_data,
                headers=auth_headers
            )
            assert response.status_code == 201
        
        # Step 3: Add snacks
        snack_data = {
            "snack_id": "energy-bar",
            "quantity_per_person": 2,
            "total_quantity": 6  # Can be manually adjusted
        }
        response = await client.post(
            f"/api/trips/{trip_id}/days/1/snacks",
            json=snack_data,
            headers=auth_headers
        )
        assert response.status_code == 201
        
        # Step 4: Configure stove
        stove_data = {
            "name": "MSR PocketRocket",
            "efficiency_g_per_liter": 8.5,
            "altitude_adjustment_percent": 20  # High altitude
        }
        response = await client.put(
            f"/api/trips/{trip_id}/stove",
            json=stove_data,
            headers=auth_headers
        )
        assert response.status_code == 200
        
        # Step 5: Get trip summary
        response = await client.get(
            f"/api/trips/{trip_id}/summary",
            headers=auth_headers
        )
        assert response.status_code == 200
        summary = response.json()
        
        # Verify calculations
        assert summary["total_days"] == 5
        assert summary["total_participants"] == 3
        assert summary["nutrition"]["total_calories"] > 0
        assert summary["weight"]["total_food_g"] > 0
        assert summary["fuel"]["total_fuel_g"] > 0
        
        # Step 6: Generate shopping list
        response = await client.get(
            f"/api/trips/{trip_id}/shopping-list",
            headers=auth_headers
        )
        assert response.status_code == 200
        shopping_list = response.json()
        
        assert len(shopping_list["categories"]) > 0
        assert shopping_list["total_weight_g"] > 0
        
        # Step 7: Export trip
        response = await client.post(
            f"/api/trips/{trip_id}/export",
            json={
                "format": "pdf",
                "sections": ["summary", "meals", "shopping_list", "packing_list"]
            },
            headers=auth_headers
        )
        assert response.status_code == 200
        assert response.headers["content-type"] == "application/pdf"
    
    @pytest.mark.asyncio
    async def test_recipe_versioning_in_trips(
        self,
        client: AsyncClient,
        auth_headers: dict,
        async_session: AsyncSession
    ):
        """Test recipe snapshot vs tracking behavior."""
        
        # Create recipe
        recipe_response = await client.post(
            "/api/recipes",
            json={
                "name": "Trail Mix",
                "ingredients": [
                    {"ingredient_id": "nuts", "quantity_g": 100},
                    {"ingredient_id": "raisins", "quantity_g": 50}
                ]
            },
            headers=auth_headers
        )
        recipe = recipe_response.json()
        
        # Create trip with snapshot (default)
        trip_response = await client.post(
            "/api/trips",
            json={
                "name": "Snapshot Test Trip",
                "start_date": str(date.today()),
                "end_date": str(date.today()),
                "track_recipe_changes": False
            },
            headers=auth_headers
        )
        snapshot_trip = trip_response.json()
        
        # Create trip with tracking
        tracking_response = await client.post(
            "/api/trips",
            json={
                "name": "Tracking Test Trip",
                "start_date": str(date.today()),
                "end_date": str(date.today()),
                "track_recipe_changes": True
            },
            headers=auth_headers
        )
        tracking_trip = tracking_response.json()
        
        # Add recipe to both trips
        for trip_id in [snapshot_trip["id"], tracking_trip["id"]]:
            await client.post(
                f"/api/trips/{trip_id}/days/1/meals/Breakfast",
                json={"recipe_id": recipe["id"]},
                headers=auth_headers
            )
        
        # Modify the recipe
        await client.put(
            f"/api/recipes/{recipe['id']}",
            json={
                "ingredients": [
                    {"ingredient_id": "nuts", "quantity_g": 150},  # Changed
                    {"ingredient_id": "raisins", "quantity_g": 50}
                ]
            },
            headers=auth_headers
        )
        
        # Check snapshot trip (should have old values)
        snapshot_meal = await client.get(
            f"/api/trips/{snapshot_trip['id']}/days/1/meals/Breakfast",
            headers=auth_headers
        )
        assert snapshot_meal.json()["ingredients"][0]["quantity_g"] == 100
        
        # Check tracking trip (should have new values)
        tracking_meal = await client.get(
            f"/api/trips/{tracking_trip['id']}/days/1/meals/Breakfast",
            headers=auth_headers
        )
        assert tracking_meal.json()["ingredients"][0]["quantity_g"] == 150
```

### 7.4 Example Performance Tests

```python
# tests/performance/test_calculations.py
import pytest
import time
from app.services.calculation_service import NutritionalCalculator

class TestCalculationPerformance:
    """Performance tests for critical calculations."""
    
    @pytest.fixture
    def large_recipe(self, sample_ingredients):
        """Create recipe with many ingredients."""
        return {
            "ingredients": [
                {"ingredient": ing, "quantity_g": 50}
                for ing in sample_ingredients * 10  # 50 ingredients
            ]
        }
    
    @pytest.mark.performance
    def test_recipe_calculation_speed(self, large_recipe):
        """Test recipe calculation performance."""
        calculator = NutritionalCalculator()
        
        start_time = time.perf_counter()
        
        for _ in range(100):  # 100 calculations
            nutrition = calculator.calculate_recipe_nutrition(
                large_recipe["ingredients"]
            )
        
        end_time = time.perf_counter()
        avg_time = (end_time - start_time) / 100
        
        # Should complete in under 10ms per calculation
        assert avg_time < 0.01, f"Calculation too slow: {avg_time:.3f}s"
    
    @pytest.mark.performance
    def test_trip_summary_generation(self, large_trip):
        """Test trip summary generation performance."""
        start_time = time.perf_counter()
        
        summary = generate_trip_summary(large_trip)
        
        end_time = time.perf_counter()
        duration = end_time - start_time
        
        # Should complete in under 1 second for 20-person, 30-day trip
        assert duration < 1.0, f"Summary generation too slow: {duration:.3f}s"
    
    @pytest.mark.performance
    def test_shopping_list_grouping(self, large_trip):
        """Test shopping list generation performance."""
        start_time = time.perf_counter()
        
        shopping_list = generate_shopping_list(large_trip)
        
        end_time = time.perf_counter()
        duration = end_time - start_time
        
        # Should complete in under 500ms
        assert duration < 0.5, f"Shopping list too slow: {duration:.3f}s"
```

### 7.5 Example E2E Test Configuration

```javascript
// cypress.config.js
import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:3000',
    viewportWidth: 1280,
    viewportHeight: 720,
    video: true,
    screenshotOnRunFailure: true,
    defaultCommandTimeout: 10000,
    requestTimeout: 10000,
    responseTimeout: 10000,
    
    setupNodeEvents(on, config) {
      // Task for seeding test data
      on('task', {
        async seedDatabase() {
          // Seed test data
          await seedTestData();
          return null;
        },
        
        async clearDatabase() {
          // Clear test data
          await clearTestData();
          return null;
        }
      });
      
      // Code coverage
      require('@cypress/code-coverage/task')(on, config);
      
      return config;
    },
    
    env: {
      apiUrl: 'http://localhost:8000',
      coverage: true
    }
  }
});

// cypress/support/commands.js
Cypress.Commands.add('login', (email, password) => {
  cy.request('POST', `${Cypress.env('apiUrl')}/api/auth/login`, {
    email,
    password
  }).then((response) => {
    window.localStorage.setItem('access_token', response.body.access_token);
    window.localStorage.setItem('refresh_token', response.body.refresh_token);
  });
});

Cypress.Commands.add('createRecipe', (recipeData) => {
  return cy.request({
    method: 'POST',
    url: `${Cypress.env('apiUrl')}/api/recipes`,
    headers: {
      Authorization: `Bearer ${window.localStorage.getItem('access_token')}`
    },
    body: recipeData
  });
});
```

## 8. Test Automation Pipeline

### 8.1 Pre-commit Hooks

```yaml
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/pre-commit/pre-commit-hooks
    rev: v4.5.0
    hooks:
      - id: trailing-whitespace
      - id: end-of-file-fixer
      - id: check-yaml
      - id: check-added-large-files
        args: ['--maxkb=1000']
  
  - repo: https://github.com/psf/black
    rev: 23.11.0
    hooks:
      - id: black
        language_version: python3.11
  
  - repo: https://github.com/pycqa/isort
    rev: 5.12.0
    hooks:
      - id: isort
        args: ["--profile", "black"]
  
  - repo: https://github.com/pycqa/flake8
    rev: 6.1.0
    hooks:
      - id: flake8
        args: ['--max-line-length=88', '--extend-ignore=E203']
  
  - repo: local
    hooks:
      - id: pytest-check
        name: pytest-check
        entry: pytest
        language: system
        pass_filenames: false
        always_run: true
        args: ['-x', '--tb=short', '--maxfail=1', 'tests/unit']
```

### 8.2 Continuous Integration Pipeline

```yaml
# .github/workflows/ci.yml
name: CI Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    types: [opened, synchronize, reopened]

env:
  PYTHON_VERSION: "3.11"
  NODE_VERSION: "18"
  POSTGRES_VERSION: "15"

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: ${{ env.PYTHON_VERSION }}
      
      - name: Run pre-commit
        uses: pre-commit/action@v3.0.0

  test-backend:
    runs-on: ubuntu-latest
    needs: lint
    
    services:
      postgres:
        image: postgres:${{ env.POSTGRES_VERSION }}
        env:
          POSTGRES_PASSWORD: testpass
          POSTGRES_DB: test_db
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: ${{ env.PYTHON_VERSION }}
          cache: 'pip'
      
      - name: Install dependencies
        run: |
          pip install --upgrade pip
          pip install -r requirements/test.txt
      
      - name: Run migrations
        env:
          DATABASE_URL: postgresql://postgres:testpass@localhost/test_db
        run: |
          alembic upgrade head
      
      - name: Run tests with coverage
        env:
          DATABASE_URL: postgresql://postgres:testpass@localhost/test_db
        run: |
          pytest \
            --cov=app \
            --cov-report=xml \
            --cov-report=html \
            --cov-report=term-missing \
            --junit-xml=test-results/junit.xml \
            --html=test-results/report.html \
            --self-contained-html \
            # -n 2
      
      - name: Upload coverage reports
        uses: codecov/codecov-action@v3
        with:
          file: ./coverage.xml
          flags: backend
          name: backend-coverage
      
      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: backend-test-results
          path: test-results/

  test-frontend:
    runs-on: ubuntu-latest
    needs: lint
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Set up Node.js
        uses: actions/setup-node@v3
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run unit tests
        run: npm run test:unit -- --coverage
      
      - name: Run component tests
        run: npm run test:components
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          file: ./coverage/lcov.info
          flags: frontend
          name: frontend-coverage

  e2e-tests:
    runs-on: ubuntu-latest
    needs: [test-backend, test-frontend]
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Start services
        run: |
          docker-compose -f docker-compose.test.yml up -d
          ./scripts/wait-for-services.sh
      
      - name: Run E2E tests
        run: |
          npm run test:e2e:ci
      
      - name: Upload E2E artifacts
        if: failure()
        uses: actions/upload-artifact@v3
        with:
          name: e2e-artifacts
          path: |
            cypress/screenshots
            cypress/videos

  security-scan:
    runs-on: ubuntu-latest
    needs: lint
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Run Trivy vulnerability scanner
        uses: aquasecurity/trivy-action@master
        with:
          scan-type: 'fs'
          scan-ref: '.'
          format: 'sarif'
          output: 'trivy-results.sarif'
      
      - name: Upload Trivy scan results
        uses: github/codeql-action/upload-sarif@v2
        with:
          sarif_file: 'trivy-results.sarif'
      
      - name: Run Bandit security linter
        run: |
          pip install bandit
          bandit -r app/ -f json -o bandit-report.json
      
      - name: Upload Bandit results
        uses: actions/upload-artifact@v3
        with:
          name: security-reports
          path: bandit-report.json

  performance-tests:
    runs-on: ubuntu-latest
    needs: [test-backend, test-frontend]
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: ${{ env.PYTHON_VERSION }}
      
      - name: Install Locust
        run: pip install locust
      
      - name: Run performance tests
        run: |
          locust \
            -f tests/performance/locustfile.py \
            --headless \
            --users 50 \
            --spawn-rate 5 \
            --run-time 2m \
            --host ${{ secrets.STAGING_URL }} \
            --html performance-report.html
      
      - name: Upload performance report
        uses: actions/upload-artifact@v3
        with:
          name: performance-report
          path: performance-report.html
      
      - name: Check performance thresholds
        run: |
          python scripts/check_performance_thresholds.py \
            --report performance-report.html \
            --p95-threshold 200 \
            --p99-threshold 500

  build-and-push:
    runs-on: ubuntu-latest
    needs: [test-backend, test-frontend, security-scan]
    if: github.event_name == 'push'
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3
      
      - name: Log in to Docker Hub
        uses: docker/login-action@v3
        with:
          username: ${{ secrets.DOCKER_USERNAME }}
          password: ${{ secrets.DOCKER_PASSWORD }}
      
      - name: Build and push Docker image
        uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: |
            ${{ secrets.DOCKER_USERNAME }}/jidelnicek:latest
            ${{ secrets.DOCKER_USERNAME }}/jidelnicek:${{ github.sha }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

## 9. Test Reporting and Monitoring

### 9.1 Test Dashboard Configuration

```python
# scripts/generate_test_report.py
import json
import pandas as pd
from datetime import datetime
from jinja2 import Template

class TestReportGenerator:
    """Generate comprehensive test reports."""
    
    def __init__(self, test_results_path: str):
        self.results = self._load_results(test_results_path)
    
    def generate_html_report(self, output_path: str):
        """Generate HTML test report."""
        template = Template("""
        <!DOCTYPE html>
        <html>
        <head>
            <title>Jídelníček Test Report - {{ date }}</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 20px; }
                .summary { background: #f0f0f0; padding: 20px; border-radius: 8px; }
                .metric { display: inline-block; margin: 10px; padding: 10px; }
                .passed { color: green; }
                .failed { color: red; }
                .chart { margin: 20px 0; }
                table { border-collapse: collapse; width: 100%; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                th { background-color: #4CAF50; color: white; }
            </style>
        </head>
        <body>
            <h1>Test Execution Report</h1>
            <div class="summary">
                <h2>Summary</h2>
                <div class="metric">
                    <strong>Total Tests:</strong> {{ summary.total }}
                </div>
                <div class="metric passed">
                    <strong>Passed:</strong> {{ summary.passed }}
                </div>
                <div class="metric failed">
                    <strong>Failed:</strong> {{ summary.failed }}
                </div>
                <div class="metric">
                    <strong>Pass Rate:</strong> {{ summary.pass_rate }}%
                </div>
                <div class="metric">
                    <strong>Duration:</strong> {{ summary.duration }}s
                </div>
                <div class="metric">
                    <strong>Coverage:</strong> {{ summary.coverage }}%
                </div>
            </div>
            
            <h2>Test Results by Category</h2>
            <table>
                <tr>
                    <th>Category</th>
                    <th>Total</th>
                    <th>Passed</th>
                    <th>Failed</th>
                    <th>Pass Rate</th>
                </tr>
                {% for category in categories %}
                <tr>
                    <td>{{ category.name }}</td>
                    <td>{{ category.total }}</td>
                    <td class="passed">{{ category.passed }}</td>
                    <td class="failed">{{ category.failed }}</td>
                    <td>{{ category.pass_rate }}%</td>
                </tr>
                {% endfor %}
            </table>
            
            <h2>Failed Tests</h2>
            {% if failed_tests %}
            <table>
                <tr>
                    <th>Test Name</th>
                    <th>Error Message</th>
                    <th>Duration</th>
                </tr>
                {% for test in failed_tests %}
                <tr>
                    <td>{{ test.name }}</td>
                    <td>{{ test.error }}</td>
                    <td>{{ test.duration }}s</td>
                </tr>
                {% endfor %}
            </table>
            {% else %}
            <p>No failed tests!</p>
            {% endif %}
            
            <h2>Performance Metrics</h2>
            <table>
                <tr>
                    <th>Metric</th>
                    <th>Value</th>
                    <th>Target</th>
                    <th>Status</th>
                </tr>
                {% for metric in performance_metrics %}
                <tr>
                    <td>{{ metric.name }}</td>
                    <td>{{ metric.value }}</td>
                    <td>{{ metric.target }}</td>
                    <td class="{{ 'passed' if metric.passed else 'failed' }}">
                        {{ 'PASS' if metric.passed else 'FAIL' }}
                    </td>
                </tr>
                {% endfor %}
            </table>
            
            <p><em>Generated on {{ date }}</em></p>
        </body>
        </html>
        """)
        
        html = template.render(
            date=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            summary=self._calculate_summary(),
            categories=self._group_by_category(),
            failed_tests=self._get_failed_tests(),
            performance_metrics=self._get_performance_metrics()
        )
        
        with open(output_path, 'w') as f:
            f.write(html)
```

### 9.2 Real-time Test Monitoring

```python
# monitoring/test_monitor.py
import asyncio
from prometheus_client import Counter, Histogram, Gauge, start_http_server

# Metrics
test_runs_total = Counter('test_runs_total', 'Total test runs', ['test_type', 'status'])
test_duration_seconds = Histogram('test_duration_seconds', 'Test duration', ['test_type'])
test_coverage_percent = Gauge('test_coverage_percent', 'Test coverage percentage')
flaky_tests_count = Gauge('flaky_tests_count', 'Number of flaky tests')

class TestMonitor:
    """Monitor test execution and metrics."""
    
    def __init__(self, webhook_url: str = None):
        self.webhook_url = webhook_url
        self.flaky_tests = set()
    
    async def record_test_run(self, test_result: dict):
        """Record test run metrics."""
        test_type = test_result.get('type', 'unit')
        status = 'passed' if test_result['passed'] else 'failed'
        duration = test_result['duration']
        
        # Update Prometheus metrics
        test_runs_total.labels(test_type=test_type, status=status).inc()
        test_duration_seconds.labels(test_type=test_type).observe(duration)
        
        # Check for flaky tests
        if self._is_flaky(test_result):
            self.flaky_tests.add(test_result['name'])
            flaky_tests_count.set(len(self.flaky_tests))
        
        # Send alerts for critical failures
        if status == 'failed' and test_type in ['integration', 'e2e']:
            await self._send_alert(test_result)
    
    def _is_flaky(self, test_result: dict) -> bool:
        """Detect flaky tests based on history."""
        # Implementation of flaky test detection
        pass
    
    async def _send_alert(self, test_result: dict):
        """Send alert for test failures."""
        if self.webhook_url:
            message = {
                "text": f"Test Failure Alert",
                "attachments": [{
                    "color": "danger",
                    "fields": [
                        {"title": "Test", "value": test_result['name']},
                        {"title": "Type", "value": test_result['type']},
                        {"title": "Error", "value": test_result['error'][:200]}
                    ]
                }]
            }
            # Send to Slack/Teams/etc
```

## 10. Conclusion

This comprehensive test strategy for the Jídelníček application ensures high quality through:

1. **Multi-level Testing**: Unit, integration, system, and acceptance tests
2. **Automation First**: 90% automated test coverage
3. **Performance Focus**: Continuous performance monitoring
4. **Security Integration**: Security scanning in CI/CD
5. **Quality Metrics**: Comprehensive tracking and reporting

The strategy emphasizes:
- **Shift-left testing**: Finding issues early in development
- **Continuous testing**: Automated testing in CI/CD pipeline
- **Risk-based approach**: Focus on critical functionality
- **Data-driven decisions**: Metrics-based quality assessment

By following this strategy, the Jídelníček application will maintain high quality standards while supporting rapid development and deployment cycles.

### What This Strategy Does NOT Include

Given the 100-user scale and solo developer constraints, this strategy intentionally omits:

1. **Distributed Load Testing**: No need for complex distributed testing infrastructure
2. **Multiple Staging Environments**: Direct dev-to-production deployment only
3. **24/7 Monitoring**: Basic uptime monitoring is sufficient
4. **Dedicated QA Team**: Developer performs all testing
5. **Complex CI/CD Pipelines**: Simple GitHub Actions workflow is adequate
6. **Enterprise-grade Performance**: Targets are adjusted for single VPS reality
7. **Extensive Test Data Management**: Simple fixtures and factories suffice
8. **Automated Security Audits**: Manual security reviews and basic scans only
9. **PWA/Offline Testing**: Deferred to Phase 2
   - Service worker testing
   - IndexedDB synchronization tests
   - Offline mode functionality tests
   - Background sync testing
   - Push notification testing

This pragmatic approach focuses on:
- **Essential Testing**: Unit and integration tests for core functionality
- **Manual Testing**: Acceptable for UI and edge cases
- **Simple Infrastructure**: Single VPS, no complex orchestration
- **Realistic Goals**: Performance targets match actual usage patterns
- **Developer Efficiency**: Testing that doesn't overwhelm a solo developer