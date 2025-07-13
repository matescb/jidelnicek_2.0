# Jídelníček 2.0 API Testing Guide

## Authentication Token Generation & Usage

This guide provides comprehensive instructions for generating and using JWT authentication tokens for testing the Jídelníček 2.0 API endpoints.

## 🚀 Quick Start

### 1. Generate Authentication Token

```bash
# Generate token with default test user
python generate_auth_token.py

# Generate token with custom user credentials
python generate_auth_token.py --email "your-test@example.com" --password "YourSecurePassword123!"

# Generate token for scripting (outputs only the token)
python generate_auth_token.py --quiet
```

### 2. Use the Generated Token

The token is automatically saved to `auth_token.txt` and can be used immediately:

```bash
# Load token into environment variable
TOKEN=$(cat auth_token.txt)

# Test with curl
curl -H "Authorization: Bearer $TOKEN" http://localhost:8000/api/v1/auth/me
```

## 📁 Generated Files

After running the token generator, you'll have:

- **`auth_token.txt`** - Contains only the JWT access token
- **`auth_response.json`** - Full authentication response with user data and tokens
- **`generate_auth_token.py`** - Token generation script
- **`test_api_with_token.sh`** - Helper script for testing various endpoints

## 🔧 Tools & Scripts

### Token Generator Script (`generate_auth_token.py`)

**Features:**
- Creates test users automatically
- Handles existing users gracefully  
- Verifies token validity
- Provides usage examples
- Saves tokens for easy access

**Usage:**
```bash
python generate_auth_token.py [options]

Options:
  --api-url URL     API base URL (default: http://localhost:8000)
  --email EMAIL     Test user email (default: test@example.com)
  --password PASS   Test user password (default: SecureTestPass123!)
  --quiet          Output only the token (for scripting)
```

### API Testing Helper (`test_api_with_token.sh`)

**Features:**
- Pre-configured endpoint testing
- Automatic token loading
- Formatted JSON responses
- Comprehensive test coverage

**Usage:**
```bash
./test_api_with_token.sh [command]

Commands:
  generate-token  - Generate new authentication token
  test-auth      - Test authentication endpoints
  test-recipes   - Test recipe endpoints  
  test-trips     - Test trip endpoints
  test-users     - Test user endpoints
  test-public    - Test public endpoints
  test-all       - Run all tests
```

## 🔐 Authentication Details

### Test User Credentials

**Default Test User:**
- Email: `test@example.com`
- Password: `SecureTestPass123!`

**Existing Test User:**
- Email: `test-new-user@example.com`  
- Password: `StrongPass482!`

### Token Information

**Access Token:**
- Type: JWT (JSON Web Token)
- Expiry: 24 hours (86400 seconds)
- Format: `Bearer {token}`

**Refresh Token:**
- Type: JWT
- Expiry: 7 days
- Used for obtaining new access tokens

### Token Payload Example

```json
{
  "sub": "user-uuid",
  "email": "test@example.com", 
  "role": "user",
  "iat": 1752348330,
  "exp": 1752434730,
  "type": "access"
}
```

## 🌐 API Endpoints

### Authentication Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/v1/auth/register` | Register new user | No |
| POST | `/api/v1/auth/login` | User login | No |
| GET | `/api/v1/auth/me` | Get current user info | Yes |
| GET | `/api/v1/auth/sessions/active-count` | Get session count | Yes |
| POST | `/api/v1/auth/refresh` | Refresh access token | No |
| POST | `/api/v1/auth/logout` | Logout user | Yes |

### Recipe Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/v1/recipes` | List user recipes | Yes |
| GET | `/api/v1/recipes/categories` | Get recipe categories | Yes |
| GET | `/api/v1/recipes/tags` | Get recipe tags | Yes |
| POST | `/api/v1/recipes` | Create new recipe | Yes |

### Trip Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/v1/trips` | List user trips | Yes |
| GET | `/api/v1/trips/templates` | Get trip templates | Yes |
| POST | `/api/v1/trips` | Create new trip | Yes |

## 🧪 Testing Examples

### 1. Basic Authentication Test

```bash
# Generate token
python generate_auth_token.py

# Test authentication
TOKEN=$(cat auth_token.txt)
curl -H "Authorization: Bearer $TOKEN" \
     http://localhost:8000/api/v1/auth/me
```

### 2. Create a Recipe

```bash
curl -X POST http://localhost:8000/api/v1/recipes \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Recipe",
    "description": "A test recipe for API testing",
    "instructions": "Mix ingredients and cook",
    "prep_time_minutes": 15,
    "cook_time_minutes": 30
  }'
```

### 3. Test Protected Endpoint Without Token

```bash
# This should return 401 Unauthorized
curl http://localhost:8000/api/v1/auth/me
```

### 4. Test Token Expiry

```bash
# Generate token and wait for expiry (if configured for short expiry)
# Then test with expired token - should return 401
```

## 🔄 Token Refresh Workflow

When an access token expires, use the refresh token:

```bash
# Extract refresh token from saved response
REFRESH_TOKEN=$(cat auth_response.json | python -c "import sys, json; print(json.load(sys.stdin)['refresh_token'])")

# Get new access token
curl -X POST http://localhost:8000/api/v1/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refresh_token": "'$REFRESH_TOKEN'"}'
```

## 🛠️ Development Workflow

### For Manual Testing

1. **Generate Token:**
   ```bash
   python generate_auth_token.py
   ```

2. **Test Endpoints:**
   ```bash
   ./test_api_with_token.sh test-auth
   ```

3. **Use in API Client:**
   - Copy token from `auth_token.txt`
   - Add as Bearer token in Postman/Insomnia
   - Test your endpoints

### For Automated Testing

1. **Script Integration:**
   ```bash
   # Get token for use in scripts
   TOKEN=$(python generate_auth_token.py --quiet)
   
   # Use in automated tests
   curl -H "Authorization: Bearer $TOKEN" "$API_ENDPOINT"
   ```

2. **CI/CD Integration:**
   ```bash
   # In your test scripts
   export API_TOKEN=$(python generate_auth_token.py --quiet)
   pytest tests/ --token="$API_TOKEN"
   ```

## 🚨 Troubleshooting

### Common Issues

1. **Server Not Running:**
   ```bash
   # Check if API server is accessible
   curl http://localhost:8000/health
   ```

2. **Token Expired:**
   ```bash
   # Generate new token
   python generate_auth_token.py
   ```

3. **Invalid Credentials:**
   ```bash
   # Use existing test user or create new one
   python generate_auth_token.py --email "test-new-user@example.com" --password "StrongPass482!"
   ```

4. **Database Issues:**
   - Some endpoints may have schema issues (as seen in recipe endpoints)
   - Authentication endpoints should work correctly
   - Check API logs for specific error details

### Verification Steps

1. **Test Token Validity:**
   ```bash
   TOKEN=$(cat auth_token.txt)
   curl -H "Authorization: Bearer $TOKEN" http://localhost:8000/api/v1/auth/me
   ```

2. **Check Token Expiry:**
   ```bash
   # Decode JWT payload (requires jq or similar)
   echo "$TOKEN" | cut -d'.' -f2 | base64 -d 2>/dev/null | python -m json.tool
   ```

## 🔗 Integration Examples

### Python Requests

```python
import requests

# Load token
with open('auth_token.txt', 'r') as f:
    token = f.read().strip()

# Make authenticated request
headers = {'Authorization': f'Bearer {token}'}
response = requests.get('http://localhost:8000/api/v1/auth/me', headers=headers)
print(response.json())
```

### cURL

```bash
# One-liner with token loading
curl -H "Authorization: Bearer $(cat auth_token.txt)" \
     http://localhost:8000/api/v1/auth/me
```

### Postman Collection

1. Create environment variable: `api_token`
2. Set value to content of `auth_token.txt`
3. Add to requests: `Authorization: Bearer {{api_token}}`

## 📊 API Response Examples

### Successful Authentication

```json
{
  "id": "58fcea3e-4e9d-419d-bac6-28fc5d474dca",
  "email": "test-new-user@example.com",
  "email_verified": false,
  "language": "cs",
  "unit_system": "metric",
  "energy_unit": "kcal",
  "has_pku": false,
  "timezone": "Europe/Prague",
  "role": "user",
  "is_active": true,
  "recipe_count": 0,
  "trip_count": 0,
  "created_at": "2025-07-12T03:20:09.290247",
  "updated_at": "2025-07-12T21:25:30.457065",
  "last_login": "2025-07-12T21:25:30.470305"
}
```

### Session Information

```json
{
  "active_sessions": 1,
  "max_allowed": 5,
  "is_admin": false
}
```

### Error Response (Unauthorized)

```json
{
  "detail": "Not authenticated"
}
```

---

## 📝 Summary

This testing setup provides:

✅ **Automated token generation**  
✅ **Pre-configured test scripts**  
✅ **Multiple integration examples**  
✅ **Comprehensive documentation**  
✅ **Error handling and troubleshooting**  

The generated JWT access token allows you to:
- Test all protected API endpoints
- Verify authentication works correctly  
- Integrate with automated testing suites
- Use with API clients like Postman/Insomnia
- Develop and debug API features

**Next Steps:**
1. Generate your token: `python generate_auth_token.py`
2. Test endpoints: `./test_api_with_token.sh test-auth`
3. Integrate with your testing workflow
4. Use the token in your OpenAPI contract tests

The token is valid for 24 hours and can be regenerated as needed.