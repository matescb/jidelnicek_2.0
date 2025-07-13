#!/bin/bash
#
# API Testing Helper Script for Jídelníček 2.0
#
# This script provides easy testing of authenticated API endpoints
# using the generated authentication token.
#
# Usage:
#   ./test_api_with_token.sh [command] [args...]
#
# Commands:
#   generate-token  - Generate a new authentication token
#   test-auth      - Test authentication endpoints
#   test-recipes   - Test recipe endpoints
#   test-trips     - Test trip endpoints  
#   help           - Show this help message
#

set -e

# Configuration
API_URL="${API_URL:-http://localhost:8000}"
TOKEN_FILE="auth_token.txt"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Check if token file exists and load token
load_token() {
    if [[ ! -f "$TOKEN_FILE" ]]; then
        log_error "Token file not found: $TOKEN_FILE"
        log_info "Run: ./test_api_with_token.sh generate-token"
        exit 1
    fi
    
    TOKEN=$(cat "$TOKEN_FILE" | tr -d '\n\r')
    if [[ -z "$TOKEN" ]]; then
        log_error "Token file is empty: $TOKEN_FILE"
        exit 1
    fi
    
    log_info "Token loaded from $TOKEN_FILE"
}

# Make authenticated API request
api_request() {
    local method="$1"
    local endpoint="$2"
    local data="$3"
    
    local url="${API_URL}${endpoint}"
    local auth_header="Authorization: Bearer $TOKEN"
    
    log_info "Making $method request to: $endpoint"
    
    if [[ -n "$data" ]]; then
        curl -s -X "$method" \
             -H "$auth_header" \
             -H "Content-Type: application/json" \
             -d "$data" \
             "$url" | python -m json.tool 2>/dev/null || echo "Response: $(curl -s -X "$method" -H "$auth_header" -H "Content-Type: application/json" -d "$data" "$url")"
    else
        curl -s -X "$method" \
             -H "$auth_header" \
             "$url" | python -m json.tool 2>/dev/null || echo "Response: $(curl -s -X "$method" -H "$auth_header" "$url")"
    fi
    
    echo
}

# Make unauthenticated API request  
api_request_unauth() {
    local method="$1"
    local endpoint="$2"
    local data="$3"
    
    local url="${API_URL}${endpoint}"
    
    log_info "Making unauthenticated $method request to: $endpoint"
    
    if [[ -n "$data" ]]; then
        curl -s -X "$method" \
             -H "Content-Type: application/json" \
             -d "$data" \
             "$url" | python -m json.tool 2>/dev/null || echo "Response: $(curl -s -X "$method" -H "Content-Type: application/json" -d "$data" "$url")"
    else
        curl -s -X "$method" \
             "$url" | python -m json.tool 2>/dev/null || echo "Response: $(curl -s -X "$method" "$url")"
    fi
    
    echo
}

# Generate new authentication token
generate_token() {
    log_info "Generating new authentication token..."
    
    if [[ -f "generate_auth_token.py" ]]; then
        python generate_auth_token.py "$@"
    else
        log_error "Token generator script not found: generate_auth_token.py"
        exit 1
    fi
}

# Test authentication endpoints
test_auth() {
    load_token
    
    log_info "Testing authentication endpoints..."
    echo
    
    # Test current user info
    log_info "=== GET /api/v1/auth/me ==="
    api_request "GET" "/api/v1/auth/me"
    
    # Test session count
    log_info "=== GET /api/v1/auth/sessions/active-count ==="
    api_request "GET" "/api/v1/auth/sessions/active-count"
    
    log_success "Authentication tests completed"
}

# Test recipe endpoints
test_recipes() {
    load_token
    
    log_info "Testing recipe endpoints..."
    echo
    
    # Test recipe categories
    log_info "=== GET /api/v1/recipes/categories ==="
    api_request "GET" "/api/v1/recipes/categories"
    
    # Test recipe tags
    log_info "=== GET /api/v1/recipes/tags ==="
    api_request "GET" "/api/v1/recipes/tags"
    
    # Test user's recipes
    log_info "=== GET /api/v1/recipes ==="
    api_request "GET" "/api/v1/recipes"
    
    log_success "Recipe tests completed"
}

# Test trip endpoints
test_trips() {
    load_token
    
    log_info "Testing trip endpoints..."
    echo
    
    # Test user's trips
    log_info "=== GET /api/v1/trips ==="
    api_request "GET" "/api/v1/trips"
    
    # Test trip templates
    log_info "=== GET /api/v1/trips/templates ==="
    api_request "GET" "/api/v1/trips/templates"
    
    log_success "Trip tests completed"
}

# Test user endpoints
test_users() {
    load_token
    
    log_info "Testing user endpoints..."
    echo
    
    # Test current user profile
    log_info "=== GET /api/v1/users/me ==="
    api_request "GET" "/api/v1/users/me"
    
    log_success "User tests completed"
}

# Test public endpoints (no auth required)
test_public() {
    log_info "Testing public endpoints..."
    echo
    
    # Test health check
    log_info "=== GET /health ==="
    api_request_unauth "GET" "/health"
    
    # Test OpenAPI schema
    log_info "=== GET /openapi.json ==="
    curl -s "$API_URL/openapi.json" | python -c "import sys, json; data=json.load(sys.stdin); print(f'OpenAPI Version: {data.get(\"openapi\", \"unknown\")}'); print(f'API Title: {data.get(\"info\", {}).get(\"title\", \"unknown\")}'); print(f'API Version: {data.get(\"info\", {}).get(\"version\", \"unknown\")}')"
    echo
    
    log_success "Public endpoint tests completed"
}

# Run all tests
test_all() {
    log_info "Running comprehensive API tests..."
    echo
    
    test_public
    test_auth  
    test_recipes
    test_trips
    test_users
    
    log_success "All tests completed successfully!"
}

# Show help
show_help() {
    cat << EOF
API Testing Helper Script for Jídelníček 2.0

USAGE:
    $0 [command] [args...]

COMMANDS:
    generate-token  Generate a new authentication token
    test-auth      Test authentication endpoints (/api/v1/auth/*)
    test-recipes   Test recipe endpoints (/api/v1/recipes/*)
    test-trips     Test trip endpoints (/api/v1/trips/*)
    test-users     Test user endpoints (/api/v1/users/*)
    test-public    Test public endpoints (no auth required)
    test-all       Run all endpoint tests
    help           Show this help message

EXAMPLES:
    # Generate new token
    $0 generate-token
    
    # Generate token with custom user
    $0 generate-token --email user@test.com --password MyPassword123!
    
    # Test authentication endpoints
    $0 test-auth
    
    # Run all tests
    $0 test-all

ENVIRONMENT VARIABLES:
    API_URL        Base URL of the API (default: http://localhost:8000)

NOTES:
    - Token is automatically loaded from auth_token.txt
    - Run 'generate-token' first if you don't have a token
    - Responses are automatically formatted as JSON when possible

EOF
}

# Main script logic
main() {
    local command="${1:-help}"
    
    case "$command" in
        "generate-token")
            shift
            generate_token "$@"
            ;;
        "test-auth")
            test_auth
            ;;
        "test-recipes")
            test_recipes
            ;;
        "test-trips")
            test_trips
            ;;
        "test-users")
            test_users
            ;;
        "test-public")
            test_public
            ;;
        "test-all")
            test_all
            ;;
        "help"|"-h"|"--help")
            show_help
            ;;
        *)
            log_error "Unknown command: $command"
            echo
            show_help
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"