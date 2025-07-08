# Jídelníček Modular Monolith Architecture

## Overview

The Jídelníček application adopts a modular monolith architecture that provides clear separation of concerns while maintaining the simplicity of a single deployable unit. This approach offers the best of both worlds: the modularity and clear boundaries of microservices with the operational simplicity of a monolith.

### Key Principles

1. **Module Independence**: Each module encapsulates its own business logic, data access, and API endpoints
2. **Clear Boundaries**: Modules communicate through well-defined interfaces, not direct database access
3. **Future-Ready**: Architecture supports easy extraction to microservices when needed
4. **Single Deployment**: All modules deploy as one unit, simplifying operations
5. **Shared Infrastructure**: Common concerns (logging, auth middleware, database connection) are centralized

## Module Boundaries

### 1. Auth Module
**Responsibility**: User authentication, authorization, and session management

**Components**:
- User registration and profile management
- JWT token generation and validation
- OAuth2 integration (Google, Facebook)
- Password reset and email verification
- Role-based access control (RBAC)

**Database Schema**: `auth.*`
- `auth.users`
- `auth.sessions`
- `auth.oauth_connections`
- `auth.roles`
- `auth.permissions`

**API Endpoints**: `/api/auth/*`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `POST /api/auth/refresh`
- `GET /api/auth/profile`
- `PUT /api/auth/profile`

### 2. Recipe Module
**Responsibility**: Recipe creation, management, and versioning

**Components**:
- Recipe CRUD operations
- Ingredient management
- Nutritional information calculation
- Recipe versioning and history
- Recipe categories and tags
- Search and filtering

**Database Schema**: `recipe.*`
- `recipe.recipes`
- `recipe.ingredients`
- `recipe.recipe_ingredients`
- `recipe.recipe_versions`
- `recipe.categories`
- `recipe.tags`

**API Endpoints**: `/api/recipes/*`
- `GET /api/recipes`
- `POST /api/recipes`
- `GET /api/recipes/:id`
- `PUT /api/recipes/:id`
- `DELETE /api/recipes/:id`
- `GET /api/recipes/:id/versions`
- `GET /api/ingredients`

### 3. Trip Module
**Responsibility**: Trip planning, meal scheduling, and participant management

**Components**:
- Trip creation and management
- Meal planning and scheduling
- Participant management
- Shopping list generation
- Meal assignment to days/times
- Trip templates

**Database Schema**: `trip.*`
- `trip.trips`
- `trip.participants`
- `trip.meals`
- `trip.meal_assignments`
- `trip.shopping_lists`
- `trip.trip_templates`

**API Endpoints**: `/api/trips/*`
- `GET /api/trips`
- `POST /api/trips`
- `GET /api/trips/:id`
- `PUT /api/trips/:id`
- `DELETE /api/trips/:id`
- `POST /api/trips/:id/participants`
- `POST /api/trips/:id/meals`
- `GET /api/trips/:id/shopping-list`

### 4. Sharing Module
**Responsibility**: Recipe marketplace, sharing, and community features

**Components**:
- Recipe publishing to marketplace
- Public/private recipe sharing
- Rating and review system
- Recipe collections
- Social features (following, favorites)
- Share link generation

**Database Schema**: `sharing.*`
- `sharing.published_recipes`
- `sharing.ratings`
- `sharing.reviews`
- `sharing.collections`
- `sharing.favorites`
- `sharing.share_links`

**API Endpoints**: `/api/sharing/*`
- `POST /api/sharing/publish`
- `GET /api/sharing/marketplace`
- `POST /api/sharing/rate`
- `POST /api/sharing/review`
- `POST /api/sharing/share-link`
- `GET /api/sharing/collections`

## Benefits for Solo Developer

### 1. Simplified Operations
- **Single deployment unit**: Deploy, monitor, and scale one application
- **Unified logging**: All logs in one place, easier debugging
- **Single database**: Simplified backup and maintenance
- **One CI/CD pipeline**: Faster iteration and deployment

### 2. Development Efficiency
- **Shared codebase**: Reuse utilities, types, and infrastructure
- **Atomic changes**: Update multiple modules in one commit
- **Simplified testing**: Integration tests across modules without network calls
- **Local development**: Run entire system on one machine

### 3. Cost Effective
- **Single server**: Start with one VPS or container
- **Reduced complexity**: No service discovery, API gateways, or message queues
- **Lower operational overhead**: Monitor one application instead of many

### 4. Maintainability
- **Clear module boundaries**: Easy to understand and modify
- **Enforced dependencies**: Modules can't bypass interfaces
- **Consistent patterns**: Same structure across all modules

## Migration Path to Microservices

### Phase 1: Current State (Modular Monolith)
```
┌─────────────────────────────────────┐
│         Jídelníček Monolith         │
├─────────────────────────────────────┤
│  ┌─────────┐  ┌─────────┐          │
│  │  Auth   │  │ Recipe  │          │
│  │ Module  │  │ Module  │          │
│  └─────────┘  └─────────┘          │
│  ┌─────────┐  ┌─────────┐          │
│  │  Trip   │  │ Sharing │          │
│  │ Module  │  │ Module  │          │
│  └─────────┘  └─────────┘          │
├─────────────────────────────────────┤
│         Shared Database             │
└─────────────────────────────────────┘
```

### Phase 2: Extract First Service (Recipe Service)
```
┌─────────────────────┐  ┌─────────────────────┐
│   Main Monolith     │  │   Recipe Service    │
├─────────────────────┤  ├─────────────────────┤
│  ┌─────────┐       │  │                     │
│  │  Auth   │       │  │   Recipe Module     │
│  │ Module  │       │  │                     │
│  └─────────┘       │  └─────────────────────┘
│  ┌─────────┐       │           │
│  │  Trip   │       │           │ API
│  │ Module  │←──────┼───────────┘
│  └─────────┘       │
│  ┌─────────┐       │
│  │ Sharing │       │
│  │ Module  │       │
│  └─────────┘       │
└─────────────────────┘
```

### Extraction Steps:
1. **Identify module to extract** (start with least coupled)
2. **Create API gateway layer** in monolith
3. **Deploy module as separate service**
4. **Update monolith to call service via API**
5. **Migrate database schema** to service-specific database
6. **Update deployment pipeline**

## Dependency Rules Between Modules

### Allowed Dependencies:
```
Auth Module    → None (foundational module)
Recipe Module  → Auth Module (for user context)
Trip Module    → Auth Module, Recipe Module
Sharing Module → Auth Module, Recipe Module
```

### Prohibited Dependencies:
- No circular dependencies
- No direct database access across modules
- No shared domain models (each module defines its own)
- No bypassing module interfaces

### Inter-Module Communication:
1. **Synchronous**: Direct service calls through interfaces
2. **Asynchronous**: Event system for loose coupling
3. **Shared Types**: Common DTOs in shared package

Example interface:
```typescript
// modules/recipe/interfaces/recipe.service.interface.ts
export interface IRecipeService {
  getRecipe(id: string, userId: string): Promise<Recipe>;
  searchRecipes(query: SearchQuery): Promise<Recipe[]>;
  validateRecipeExists(id: string): Promise<boolean>;
}
```

## Shared Database with Module-Specific Schemas

### Database Organization:
```sql
-- Each module owns its schema
CREATE SCHEMA auth;
CREATE SCHEMA recipe;
CREATE SCHEMA trip;
CREATE SCHEMA sharing;

-- Common schema for shared data
CREATE SCHEMA common;
```

### Access Rules:
1. **Module owns its schema**: Full CRUD on own tables
2. **Read-only views**: For cross-module data needs
3. **No foreign keys across schemas**: Maintain independence
4. **Event sourcing**: For data synchronization needs

### Migration Strategy:
```sql
-- Example: Trip module needs recipe names
CREATE VIEW trip.recipe_summary AS
SELECT id, name, prep_time, cook_time
FROM recipe.recipes
WHERE deleted_at IS NULL;

-- Grant read-only access
GRANT SELECT ON trip.recipe_summary TO trip_module;
```

## API Structure Within Monolith

### Directory Structure:
```
src/
├── modules/
│   ├── auth/
│   │   ├── controllers/
│   │   ├── services/
│   │   ├── repositories/
│   │   ├── interfaces/
│   │   └── routes.ts
│   ├── recipe/
│   │   ├── controllers/
│   │   ├── services/
│   │   ├── repositories/
│   │   ├── interfaces/
│   │   └── routes.ts
│   ├── trip/
│   │   └── ...
│   └── sharing/
│       └── ...
├── shared/
│   ├── interfaces/
│   ├── middleware/
│   ├── utils/
│   └── types/
└── main.ts
```

### Route Registration:
```typescript
// main.ts
import authRoutes from './modules/auth/routes';
import recipeRoutes from './modules/recipe/routes';
import tripRoutes from './modules/trip/routes';
import sharingRoutes from './modules/sharing/routes';

app.use('/api/auth', authRoutes);
app.use('/api/recipes', recipeRoutes);
app.use('/api/trips', tripRoutes);
app.use('/api/sharing', sharingRoutes);
```

### Module Isolation:
```typescript
// modules/recipe/index.ts
export class RecipeModule {
  private recipeService: RecipeService;
  private authService: IAuthService;

  constructor(authService: IAuthService) {
    this.authService = authService;
    this.recipeService = new RecipeService();
  }

  getRoutes(): Router {
    return createRecipeRoutes(this.recipeService, this.authService);
  }
}
```

## Testing Strategy

### Unit Tests:
- Test each module in isolation
- Mock inter-module dependencies
- Focus on business logic

### Integration Tests:
- Test module interactions
- Use in-memory database
- Verify API contracts

### E2E Tests:
- Test complete user flows
- Verify module boundaries
- Ensure data consistency

## Monitoring and Observability

### Module-Specific Metrics:
- Request count per module
- Response time per endpoint
- Error rate by module
- Database query performance

### Health Checks:
```typescript
GET /health
{
  "status": "healthy",
  "modules": {
    "auth": "healthy",
    "recipe": "healthy",
    "trip": "healthy",
    "sharing": "healthy"
  }
}
```

## Future Considerations

### When to Extract Modules:
1. **Performance**: Module needs different scaling characteristics
2. **Team Growth**: Separate teams working on modules
3. **Technology**: Module needs different tech stack
4. **Compliance**: Module has specific regulatory requirements
5. **Third-Party**: Module becomes a separate product

### Extraction Priority:
1. **Auth Module**: Often needed by other applications
2. **Recipe Module**: Core domain, most reusable
3. **Sharing Module**: Community features, different scaling needs
4. **Trip Module**: Tightly coupled, extract last

## Conclusion

The modular monolith architecture provides an excellent foundation for the Jídelníček project. It offers the flexibility and maintainability of a microservices architecture while keeping the operational complexity low—perfect for a solo developer or small team. The clear module boundaries and well-defined interfaces ensure that the system can evolve as needs change, with a clear path to microservices when the time is right.