# Sharing Module Implementation Summary

## Overview
Implemented a unified sharing system for recipes and trips with backward compatibility for existing trip sharing functionality.

## Components Created/Modified

### 1. ShareLink Model (`src/jidelnicek/core/models/share_link.py`)
- **New model** for unified sharing functionality
- Fields:
  - `id` (UUID) - Primary key
  - `entity_type` (enum: 'recipe', 'trip') - Type of shared entity
  - `entity_id` (UUID) - ID of the shared entity
  - `user_id` (UUID) - Creator of the share link
  - `share_token` (string) - Unique access token
  - `created_at` (timestamp) - Creation time
  - `expires_at` (timestamp) - Expiration time
  - `view_count` (integer) - Access counter
- Indexes on share_token, entity_id, user_id, and composite indexes
- Constraints for data integrity

### 2. Database Migration (`alembic/versions/003_add_share_links_table.py`)
- Creates `share_links` table with all necessary columns and indexes
- Adds `share_token` and `share_expires_at` to `recipe_recipes` table
- Maintains backward compatibility with existing trip sharing

### 3. SharingService (`src/jidelnicek/core/services/sharing_service.py`)
- **New service** providing centralized sharing functionality
- Methods:
  - `create_share_link()` - Create share links for recipes/trips
  - `get_shared_content()` - Retrieve shared content with view tracking
  - `revoke_share_link()` - Delete share links
  - `get_user_share_links()` - List user's share links
  - `extend_share_link()` - Extend expiration time
  - `cleanup_expired_links()` - Remove expired links
  - `create_trip_share_token()` - Backward compatible trip sharing
  - `get_trip_by_share_token()` - Backward compatible trip retrieval

### 4. Updated Sharing Router (`src/jidelnicek/core/routers/sharing.py`)
- Replaced stub implementations with actual functionality
- Endpoints:
  - `POST /share/recipe/{recipeId}` - Create recipe share link
  - `POST /share/trip/{tripId}` - Create trip share link
  - `GET /share/{shareToken}` - Access shared content
  - `DELETE /share/{shareToken}` - Revoke share link
  - `GET /share/my-links` - List user's share links (new)

### 5. Model Updates
- **AuthUser** (`src/jidelnicek/auth/models.py`):
  - Added `share_links` relationship
- **Recipe** (`src/jidelnicek/recipe/models/recipe.py`):
  - Added `share_token` and `share_expires_at` fields
  - Added `is_shareable` property
- **ShareLink** exports added to `src/jidelnicek/core/models/__init__.py`

### 6. Service Updates
- **TripService** (`src/jidelnicek/trip/services/trip_service.py`):
  - Updated `share_trip()` to use new SharingService
  - Updated `get_shared_trip()` to use new SharingService
  - Maintains backward compatibility

## Key Features

### Unified Sharing
- Single system for both recipes and trips
- Consistent API across entity types
- Centralized share link management

### Security
- Time-limited share tokens (1-168 hours)
- Unique tokens using `secrets.token_urlsafe(32)`
- Owner-only revocation
- View count tracking

### Backward Compatibility
- Existing trip sharing at `/trips/{id}/share` continues working
- Trip's `share_token` and `share_expires_at` fields are synchronized
- Old share tokens remain valid

### API Responses
- Share creation returns token, URL, and expiration
- Shared content includes appropriate entity data
- Proper HTTP status codes (201, 204, 404, 410)

## Usage Examples

### Create Recipe Share Link
```bash
POST /api/v1/share/recipe/{recipeId}
{
  "expires_hours": 24
}
```

### Create Trip Share Link
```bash
POST /api/v1/share/trip/{tripId}
{
  "expires_hours": 48
}
```

### Access Shared Content
```bash
GET /api/v1/share/{shareToken}
```

### List My Share Links
```bash
GET /api/v1/share/my-links?entity_type=recipe&include_expired=false
```

### Revoke Share Link
```bash
DELETE /api/v1/share/{shareToken}
```

## Migration Steps
1. Run alembic migration: `alembic upgrade head`
2. Existing trip share tokens will continue working
3. New share links will be created in the `share_links` table
4. Recipe sharing is now available

## Testing
- Created `test_sharing_implementation.py` for comprehensive testing
- Tests cover all CRUD operations and backward compatibility
- Verifies view counting and expiration handling