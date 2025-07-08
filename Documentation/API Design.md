# API Design Document

## Overview

The Jídelníček API follows RESTful principles with a simplified, flat structure. All endpoints use standard HTTP methods and status codes, making the API intuitive and easy to use.

## Base URL

```
https://api.jidelnicek.cz/api/v1
```

## Authentication

The API uses JWT (JSON Web Tokens) for authentication with a standard Bearer token approach.

### Authentication Flow

1. **Login**: POST credentials to `/api/v1/auth/login`
2. **Receive**: JWT access token (valid for 24 hours)
3. **Use**: Include token in Authorization header: `Authorization: Bearer <token>`
4. **Refresh**: Use refresh token to get new access token when expired

### Authentication Endpoints

```http
POST   /api/v1/auth/register     # Register new user
POST   /api/v1/auth/login        # Login user
POST   /api/v1/auth/logout       # Logout user
POST   /api/v1/auth/refresh      # Refresh access token
GET    /api/v1/auth/me           # Get current user info
PUT    /api/v1/auth/me           # Update user profile
DELETE /api/v1/auth/me           # Delete user account
```

## Core Resources

### Recipes

```http
# Recipe CRUD
GET    /api/v1/recipes                 # List user's recipes
POST   /api/v1/recipes                 # Create new recipe
GET    /api/v1/recipes/{id}            # Get recipe details
PUT    /api/v1/recipes/{id}            # Update recipe
DELETE /api/v1/recipes/{id}            # Delete recipe

# Recipe Operations
POST   /api/v1/recipes/{id}/duplicate  # Duplicate recipe
POST   /api/v1/recipes/{id}/images     # Upload recipe image
DELETE /api/v1/recipes/{id}/images/{imageId}  # Delete recipe image

# Archive Management
GET    /api/v1/recipes/archived        # List archived recipes
PUT    /api/v1/recipes/{id}/archive    # Archive recipe
PUT    /api/v1/recipes/{id}/restore    # Restore archived recipe

# Search and Filter
GET    /api/v1/recipes/search?q={query}&category={category}&tags={tags}
```

### Trips

```http
# Trip CRUD
GET    /api/v1/trips                   # List user's trips
POST   /api/v1/trips                   # Create new trip
GET    /api/v1/trips/{id}              # Get trip details
PUT    /api/v1/trips/{id}              # Update trip
DELETE /api/v1/trips/{id}              # Delete trip

# Trip Planning
GET    /api/v1/trips/{id}/days         # Get trip days
PUT    /api/v1/trips/{id}/days/{dayId} # Update day plan
POST   /api/v1/trips/{id}/calculate    # Calculate totals

# Archive Management
GET    /api/v1/trips/archived          # List archived trips
PUT    /api/v1/trips/{id}/archive      # Archive trip
PUT    /api/v1/trips/{id}/restore      # Restore archived trip

# Templates
POST   /api/v1/trips/{id}/save-template    # Save as template
GET    /api/v1/trips/templates             # List templates
POST   /api/v1/trips/from-template/{templateId}  # Create from template
```

### Ingredients

```http
# Ingredient Management
GET    /api/v1/ingredients             # List ingredients
POST   /api/v1/ingredients             # Create custom ingredient
GET    /api/v1/ingredients/{id}        # Get ingredient details
PUT    /api/v1/ingredients/{id}        # Update ingredient
DELETE /api/v1/ingredients/{id}        # Delete custom ingredient

# Search
GET    /api/v1/ingredients/search?q={query}
```

### Snacks

```http
# Snack Management
GET    /api/v1/snacks                  # List snacks
POST   /api/v1/snacks                  # Create custom snack
GET    /api/v1/snacks/{id}             # Get snack details
PUT    /api/v1/snacks/{id}             # Update snack
DELETE /api/v1/snacks/{id}             # Delete custom snack
```

### Sharing

```http
# Public Recipes
GET    /api/v1/public/recipes          # Browse public recipes
GET    /api/v1/public/recipes/{id}     # View public recipe
POST   /api/v1/public/recipes/{id}/fork # Fork public recipe

# Recipe Sharing
PUT    /api/v1/recipes/{id}/visibility # Toggle public/private
GET    /api/v1/recipes/{id}/stats      # Get recipe statistics

# Reviews and Ratings
POST   /api/v1/recipes/{id}/reviews    # Add review
GET    /api/v1/recipes/{id}/reviews    # List reviews
POST   /api/v1/recipes/{id}/rating     # Rate recipe
```

## Request/Response Format

### Standard Request Headers

```http
Content-Type: application/json
Authorization: Bearer <jwt-token>
Accept-Language: cs  # Optional: for localized content
```

### Standard Response Format

#### Success Response

```json
{
  "data": {
    // Response data
  },
  "meta": {
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

#### Error Response

```json
{
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "Recipe not found",
    "details": {
      "resource": "recipe",
      "id": "123e4567-e89b-12d3-a456-426614174000"
    }
  }
}
```

### Pagination

For list endpoints, use standard query parameters:

```http
GET /api/v1/recipes?page=1&limit=20&sort=created_at&order=desc
```

Response includes pagination metadata:

```json
{
  "data": [...],
  "meta": {
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 150,
      "pages": 8
    }
  }
}
```

## HTTP Status Codes

- **200 OK** - Successful GET, PUT
- **201 Created** - Successful POST
- **204 No Content** - Successful DELETE
- **400 Bad Request** - Invalid request data
- **401 Unauthorized** - Missing or invalid authentication
- **403 Forbidden** - Insufficient permissions
- **404 Not Found** - Resource not found
- **409 Conflict** - Resource conflict (e.g., duplicate)
- **422 Unprocessable Entity** - Validation errors
- **429 Too Many Requests** - Rate limit exceeded
- **500 Internal Server Error** - Server error

## Error Codes

Common error codes used across the API:

- `VALIDATION_ERROR` - Request validation failed
- `RESOURCE_NOT_FOUND` - Requested resource doesn't exist
- `UNAUTHORIZED` - Authentication required
- `FORBIDDEN` - Insufficient permissions
- `RESOURCE_LIMIT_EXCEEDED` - User limit reached (e.g., 500 recipes)
- `DUPLICATE_RESOURCE` - Resource already exists
- `INVALID_OPERATION` - Operation not allowed

## Rate Limiting

- **Authenticated requests**: 1000 requests per hour
- **Unauthenticated requests**: 100 requests per hour
- Rate limit headers included in responses:
  - `X-RateLimit-Limit`
  - `X-RateLimit-Remaining`
  - `X-RateLimit-Reset`

## Example Requests

### Create Recipe

```http
POST /api/v1/recipes
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Camping Pasta",
  "description": "Quick and easy pasta for camping",
  "servings": 4,
  "prep_time_minutes": 10,
  "cook_time_minutes": 15,
  "ingredients": [
    {
      "ingredient_id": "123e4567-e89b-12d3-a456-426614174000",
      "amount": 400,
      "unit": "g"
    },
    {
      "ingredient_id": "223e4567-e89b-12d3-a456-426614174001",
      "amount": 200,
      "unit": "ml"
    }
  ],
  "instructions": "1. Boil water\n2. Add pasta\n3. Cook for 10 minutes",
  "tags": ["vegetarian", "quick"]
}
```

Response:

```json
{
  "data": {
    "id": "323e4567-e89b-12d3-a456-426614174000",
    "name": "Camping Pasta",
    "description": "Quick and easy pasta for camping",
    "servings": 4,
    "prep_time_minutes": 10,
    "cook_time_minutes": 15,
    "total_time_minutes": 25,
    "is_public": false,
    "created_at": "2024-01-15T10:30:00Z",
    "updated_at": "2024-01-15T10:30:00Z",
    "nutrition": {
      "calories": 450,
      "protein_g": 15,
      "carbs_g": 65,
      "fat_g": 12,
      "fiber_g": 4
    },
    "ingredients": [
      {
        "id": "423e4567-e89b-12d3-a456-426614174000",
        "ingredient": {
          "id": "123e4567-e89b-12d3-a456-426614174000",
          "name": "Pasta",
          "category": "grains"
        },
        "amount": 400,
        "unit": "g"
      }
    ]
  }
}
```

### Archive Recipe

```http
PUT /api/v1/recipes/323e4567-e89b-12d3-a456-426614174000/archive
Authorization: Bearer <token>
```

Response:

```json
{
  "data": {
    "id": "323e4567-e89b-12d3-a456-426614174000",
    "archived": true,
    "archived_at": "2024-01-15T11:00:00Z"
  }
}
```

### Search Recipes

```http
GET /api/v1/recipes/search?q=pasta&category=dinner&tags=vegetarian,quick&page=1&limit=10
Authorization: Bearer <token>
```

Response:

```json
{
  "data": [
    {
      "id": "323e4567-e89b-12d3-a456-426614174000",
      "name": "Camping Pasta",
      "description": "Quick and easy pasta for camping",
      "category": "dinner",
      "tags": ["vegetarian", "quick"],
      "total_time_minutes": 25,
      "nutrition": {
        "calories": 450
      }
    }
  ],
  "meta": {
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 25,
      "pages": 3
    }
  }
}
```

### Create Trip

```http
POST /api/v1/trips
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Summer Camping 2024",
  "start_date": "2024-07-01",
  "end_date": "2024-07-07",
  "participant_count": 4,
  "stove_count": 2,
  "location": "High Tatras"
}
```

### Batch Operations

For efficiency, some endpoints support simple batch operations:

```http
# Delete multiple recipes
DELETE /api/v1/recipes/batch
Content-Type: application/json

{
  "ids": [
    "123e4567-e89b-12d3-a456-426614174000",
    "223e4567-e89b-12d3-a456-426614174000"
  ]
}

# Archive multiple recipes
PUT /api/v1/recipes/batch/archive
Content-Type: application/json

{
  "ids": [
    "123e4567-e89b-12d3-a456-426614174000",
    "223e4567-e89b-12d3-a456-426614174000"
  ]
}
```

## Data Validation

All endpoints validate input data. Common validation rules:

- **Strings**: Max 255 characters for names, 1000 for descriptions
- **Numbers**: Must be positive integers where applicable
- **Dates**: ISO 8601 format (YYYY-MM-DD)
- **Arrays**: Max 50 items for ingredients per recipe
- **File uploads**: Max 5MB for images, JPEG/PNG only

## Versioning

The API uses URL versioning (`/api/v1/`). Breaking changes will result in a new version (`/api/v2/`). Non-breaking changes are added to the current version.

## Security Considerations

- All endpoints require HTTPS
- JWT tokens expire after 24 hours
- Refresh tokens expire after 30 days
- Rate limiting prevents abuse
- Input sanitization on all text fields
- SQL injection protection via parameterized queries
- XSS protection via proper output encoding

## Performance Guidelines

- Use pagination for large datasets
- Include only necessary fields in responses
- Cache frequently accessed public data
- Batch operations where possible
- Optimize image uploads with compression

## API Clients

Official SDKs and examples:

- JavaScript/TypeScript: Use native `fetch` or `axios`
- Python: Use `requests` or `httpx`
- API documentation available at `/api/v1/docs` (OpenAPI/Swagger)

---

This simplified API design focuses on clarity, standard REST patterns, and developer experience while maintaining all necessary functionality for the Jídelníček application.