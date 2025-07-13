#!/usr/bin/env python3
"""
Example OpenAPI Contract Test with Authentication

This example demonstrates how to use the generated JWT token
for testing API endpoints that require authentication.

Usage:
    python example_contract_test.py
"""

import json
import os
import requests
import sys
from typing import Optional


class AuthenticatedAPITester:
    """Example class for testing authenticated API endpoints."""
    
    def __init__(self, api_url: str = "http://localhost:8000", token_file: str = "auth_token.txt"):
        self.api_url = api_url.rstrip('/')
        self.token_file = token_file
        self.token = self._load_token()
        self.session = requests.Session()
        
        if self.token:
            self.session.headers.update({
                'Authorization': f'Bearer {self.token}',
                'Content-Type': 'application/json'
            })
    
    def _load_token(self) -> Optional[str]:
        """Load authentication token from file."""
        if not os.path.exists(self.token_file):
            print(f"❌ Token file not found: {self.token_file}")
            print("💡 Run: python generate_auth_token.py")
            return None
        
        try:
            with open(self.token_file, 'r') as f:
                token = f.read().strip()
                if token:
                    print(f"✅ Token loaded from {self.token_file}")
                    return token
                else:
                    print(f"❌ Token file is empty: {self.token_file}")
                    return None
        except Exception as e:
            print(f"❌ Failed to load token: {e}")
            return None
    
    def test_user_profile_endpoint(self) -> bool:
        """Test GET /api/v1/auth/me endpoint."""
        print("\n🧪 Testing: GET /api/v1/auth/me")
        
        try:
            response = self.session.get(f"{self.api_url}/api/v1/auth/me")
            
            # Check status code
            if response.status_code != 200:
                print(f"❌ Expected 200, got {response.status_code}")
                print(f"   Response: {response.text}")
                return False
            
            # Check response structure
            data = response.json()
            required_fields = ['id', 'email', 'role', 'is_active']
            
            for field in required_fields:
                if field not in data:
                    print(f"❌ Missing required field: {field}")
                    return False
            
            print(f"✅ User profile retrieved successfully")
            print(f"   User: {data['email']}")
            print(f"   Role: {data['role']}")
            print(f"   Active: {data['is_active']}")
            
            return True
            
        except Exception as e:
            print(f"❌ Request failed: {e}")
            return False
    
    def test_session_count_endpoint(self) -> bool:
        """Test GET /api/v1/auth/sessions/active-count endpoint."""
        print("\n🧪 Testing: GET /api/v1/auth/sessions/active-count")
        
        try:
            response = self.session.get(f"{self.api_url}/api/v1/auth/sessions/active-count")
            
            # Check status code
            if response.status_code != 200:
                print(f"❌ Expected 200, got {response.status_code}")
                print(f"   Response: {response.text}")
                return False
            
            # Check response structure
            data = response.json()
            required_fields = ['active_sessions', 'max_allowed', 'is_admin']
            
            for field in required_fields:
                if field not in data:
                    print(f"❌ Missing required field: {field}")
                    return False
            
            # Validate data types
            if not isinstance(data['active_sessions'], int):
                print(f"❌ active_sessions should be integer, got {type(data['active_sessions'])}")
                return False
            
            if not isinstance(data['is_admin'], bool):
                print(f"❌ is_admin should be boolean, got {type(data['is_admin'])}")
                return False
            
            print(f"✅ Session count retrieved successfully")
            print(f"   Active sessions: {data['active_sessions']}")
            print(f"   Max allowed: {data['max_allowed']}")
            print(f"   Is admin: {data['is_admin']}")
            
            return True
            
        except Exception as e:
            print(f"❌ Request failed: {e}")
            return False
    
    def test_unauthorized_access(self) -> bool:
        """Test that endpoints require authentication."""
        print("\n🧪 Testing: Unauthorized access")
        
        try:
            # Create session without authentication
            unauth_session = requests.Session()
            unauth_session.headers.update({'Content-Type': 'application/json'})
            
            response = unauth_session.get(f"{self.api_url}/api/v1/auth/me")
            
            # Should return 401 or 403
            if response.status_code in [401, 403]:
                print(f"✅ Correctly rejected unauthorized access (status: {response.status_code})")
                return True
            else:
                print(f"❌ Expected 401/403, got {response.status_code}")
                print(f"   Response: {response.text}")
                return False
                
        except Exception as e:
            print(f"❌ Request failed: {e}")
            return False
    
    def test_health_endpoint(self) -> bool:
        """Test public health endpoint (no auth required)."""
        print("\n🧪 Testing: GET /health (public endpoint)")
        
        try:
            # Use session without auth headers for public endpoint
            response = requests.get(f"{self.api_url}/health")
            
            if response.status_code != 200:
                print(f"❌ Expected 200, got {response.status_code}")
                return False
            
            data = response.json()
            if 'status' not in data or data['status'] != 'healthy':
                print(f"❌ Invalid health response: {data}")
                return False
            
            print(f"✅ Health check passed")
            print(f"   Status: {data['status']}")
            print(f"   Version: {data.get('version', 'unknown')}")
            
            return True
            
        except Exception as e:
            print(f"❌ Request failed: {e}")
            return False
    
    def run_all_tests(self) -> bool:
        """Run all contract tests."""
        print("🚀 Running OpenAPI Contract Tests with Authentication")
        print(f"   API URL: {self.api_url}")
        print("=" * 60)
        
        if not self.token:
            return False
        
        tests = [
            ("Health Check", self.test_health_endpoint),
            ("User Profile", self.test_user_profile_endpoint),
            ("Session Count", self.test_session_count_endpoint),
            ("Unauthorized Access", self.test_unauthorized_access),
        ]
        
        passed = 0
        total = len(tests)
        
        for test_name, test_func in tests:
            try:
                if test_func():
                    passed += 1
                else:
                    print(f"❌ {test_name} test failed")
            except Exception as e:
                print(f"❌ {test_name} test error: {e}")
        
        print("\n" + "=" * 60)
        print(f"📊 Test Results: {passed}/{total} tests passed")
        
        if passed == total:
            print("🎉 All tests passed!")
            return True
        else:
            print(f"❌ {total - passed} tests failed")
            return False


def main():
    """Main entry point."""
    print("Jídelníček 2.0 - OpenAPI Contract Test Example")
    print("=" * 50)
    
    tester = AuthenticatedAPITester()
    
    success = tester.run_all_tests()
    
    if success:
        print("\n✅ All contract tests completed successfully!")
        print("\n💡 Usage in your test suite:")
        print("   1. Generate token: python generate_auth_token.py")
        print("   2. Run tests: python your_test_suite.py")
        print("   3. Use token from auth_token.txt in your tests")
        sys.exit(0)
    else:
        print("\n❌ Some tests failed. Check the output above.")
        sys.exit(1)


if __name__ == "__main__":
    main()