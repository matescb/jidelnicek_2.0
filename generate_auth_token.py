#!/usr/bin/env python3
"""
Authentication Token Generator for Jídelníček 2.0 API Testing

This script generates a valid JWT access token by:
1. Creating a test user via the registration endpoint
2. Logging in with the test user to obtain tokens
3. Extracting and displaying the access token for use in API testing

Usage:
    python generate_auth_token.py [--api-url http://localhost:8000]

Requirements:
    - requests library (pip install requests)
    - The API server must be running
"""

import argparse
import json
import sys
import time
from typing import Dict, Optional, Tuple

try:
    import requests
except ImportError:
    print("Error: requests library is required. Install with: pip install requests")
    sys.exit(1)


class AuthTokenGenerator:
    """Handles authentication token generation for API testing."""
    
    def __init__(self, api_url: str = "http://localhost:8000"):
        self.api_url = api_url.rstrip('/')
        self.session = requests.Session()
        self.session.headers.update({
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        })
    
    def test_connection(self) -> bool:
        """Test if the API server is accessible."""
        try:
            response = self.session.get(f"{self.api_url}/health", timeout=5)
            if response.status_code == 200:
                health_data = response.json()
                print(f"✅ API server is healthy (version: {health_data.get('version', 'unknown')})")
                return True
            else:
                print(f"❌ API server responded with status {response.status_code}")
                return False
        except requests.exceptions.RequestException as e:
            print(f"❌ Failed to connect to API server: {e}")
            return False
    
    def create_test_user(self, email: str, password: str) -> Tuple[bool, Optional[Dict]]:
        """
        Create a test user via the registration endpoint.
        
        Args:
            email: Test user email
            password: Test user password
            
        Returns:
            Tuple of (success, response_data)
        """
        registration_data = {
            "email": email,
            "password": password,
            "confirm_password": password,
            "language": "cs",
            "unit_system": "metric", 
            "energy_unit": "kcal",
            "has_pku": False,
            "timezone": "Europe/Prague"
        }
        
        try:
            print(f"📝 Creating test user: {email}")
            response = self.session.post(
                f"{self.api_url}/api/v1/auth/register",
                json=registration_data,
                timeout=10
            )
            
            if response.status_code == 201:
                user_data = response.json()
                print(f"✅ Test user created successfully")
                print(f"   User ID: {user_data.get('id')}")
                print(f"   Email verified: {user_data.get('email_verified', False)}")
                return True, user_data
            elif response.status_code == 409:
                print(f"ℹ️  User already exists - proceeding with login")
                return True, None
            else:
                print(f"❌ Failed to create user: {response.status_code}")
                try:
                    error_data = response.json()
                    print(f"   Error: {error_data.get('detail', 'Unknown error')}")
                except:
                    print(f"   Error: {response.text}")
                return False, None
                
        except requests.exceptions.RequestException as e:
            print(f"❌ Registration request failed: {e}")
            return False, None
    
    def login_user(self, email: str, password: str) -> Tuple[bool, Optional[str], Optional[Dict]]:
        """
        Login with test user credentials to obtain access token.
        
        Args:
            email: User email
            password: User password
            
        Returns:
            Tuple of (success, access_token, full_response)
        """
        login_data = {
            "email": email,
            "password": password
        }
        
        try:
            print(f"🔐 Logging in user: {email}")
            response = self.session.post(
                f"{self.api_url}/api/v1/auth/login",
                json=login_data,
                timeout=10
            )
            
            if response.status_code == 200:
                token_data = response.json()
                access_token = token_data.get('access_token')
                
                print(f"✅ Login successful!")
                print(f"   Token type: {token_data.get('token_type', 'Bearer')}")
                print(f"   Expires in: {token_data.get('expires_in', 'unknown')} seconds")
                
                user_info = token_data.get('user', {})
                print(f"   User: {user_info.get('email')} (ID: {user_info.get('id')})")
                
                return True, access_token, token_data
            else:
                print(f"❌ Login failed: {response.status_code}")
                try:
                    error_data = response.json()
                    print(f"   Error: {error_data.get('detail', 'Unknown error')}")
                except:
                    print(f"   Error: {response.text}")
                return False, None, None
                
        except requests.exceptions.RequestException as e:
            print(f"❌ Login request failed: {e}")
            return False, None, None
    
    def verify_token(self, access_token: str) -> bool:
        """
        Verify the access token works by calling a protected endpoint.
        
        Args:
            access_token: JWT access token to verify
            
        Returns:
            True if token is valid, False otherwise
        """
        try:
            print(f"🔍 Verifying access token...")
            headers = {'Authorization': f'Bearer {access_token}'}
            
            response = self.session.get(
                f"{self.api_url}/api/v1/auth/me",
                headers=headers,
                timeout=5
            )
            
            if response.status_code == 200:
                user_data = response.json()
                print(f"✅ Token verification successful!")
                print(f"   User: {user_data.get('email')}")
                print(f"   Role: {user_data.get('role')}")
                print(f"   Active: {user_data.get('is_active')}")
                return True
            else:
                print(f"❌ Token verification failed: {response.status_code}")
                return False
                
        except requests.exceptions.RequestException as e:
            print(f"❌ Token verification request failed: {e}")
            return False
    
    def generate_token(
        self, 
        email: str = "test@example.com",
        password: str = "SecureTestPass123!"
    ) -> Optional[str]:
        """
        Generate a valid access token for API testing.
        
        Args:
            email: Test user email
            password: Test user password
            
        Returns:
            Access token string if successful, None otherwise
        """
        print(f"🚀 Starting authentication token generation...")
        print(f"   API URL: {self.api_url}")
        print(f"   Test user: {email}")
        print()
        
        # Test API connection
        if not self.test_connection():
            return None
        print()
        
        # Create test user (or use existing)
        success, user_data = self.create_test_user(email, password)
        if not success:
            return None
        print()
        
        # Login to get tokens
        success, access_token, token_data = self.login_user(email, password)
        if not success or not access_token:
            return None
        print()
        
        # Verify token works
        if not self.verify_token(access_token):
            return None
        print()
        
        # Display results
        print("🎉 Authentication token generated successfully!")
        print("=" * 60)
        print(f"ACCESS TOKEN:")
        print(f"{access_token}")
        print("=" * 60)
        print()
        
        # Usage instructions
        print("📋 USAGE INSTRUCTIONS:")
        print("=" * 30)
        print("1. For curl requests:")
        print(f'   curl -H "Authorization: Bearer {access_token}" \\')
        print(f'        {self.api_url}/api/v1/auth/me')
        print()
        print("2. For Postman/Insomnia:")
        print("   - Set Authorization type to 'Bearer Token'")
        print(f"   - Token: {access_token}")
        print()
        print("3. For Python requests:")
        print("   headers = {'Authorization': f'Bearer {access_token}'}")
        print("   requests.get(url, headers=headers)")
        print()
        print("4. For OpenAPI/Swagger UI:")
        print("   - Click 'Authorize' button")
        print("   - Enter: Bearer {access_token}")
        print()
        
        # Save to file for easy access
        token_file = "auth_token.txt"
        try:
            with open(token_file, 'w') as f:
                f.write(access_token)
            print(f"💾 Token saved to: {token_file}")
        except Exception as e:
            print(f"⚠️  Failed to save token to file: {e}")
        
        # Save full response for reference
        if token_data:
            response_file = "auth_response.json"
            try:
                with open(response_file, 'w') as f:
                    json.dump(token_data, f, indent=2, default=str)
                print(f"💾 Full auth response saved to: {response_file}")
            except Exception as e:
                print(f"⚠️  Failed to save response to file: {e}")
        
        print()
        print("⏰ Note: Access tokens typically expire in 30 minutes.")
        print("    If the token expires, run this script again to generate a new one.")
        
        return access_token


def main():
    """Main entry point for the script."""
    parser = argparse.ArgumentParser(
        description="Generate authentication tokens for Jídelníček 2.0 API testing"
    )
    parser.add_argument(
        '--api-url',
        default='http://localhost:8000',
        help='Base URL of the API server (default: http://localhost:8000)'
    )
    parser.add_argument(
        '--email',
        default='test@example.com',
        help='Test user email (default: test@example.com)'
    )
    parser.add_argument(
        '--password',
        default='SecureTestPass123!',
        help='Test user password (default: SecureTestPass123!)'
    )
    parser.add_argument(
        '--quiet',
        action='store_true',
        help='Only output the access token (useful for scripts)'
    )
    
    args = parser.parse_args()
    
    generator = AuthTokenGenerator(args.api_url)
    
    if args.quiet:
        # Suppress all output except the token
        import os
        
        # Redirect stdout to null
        original_stdout = sys.stdout
        sys.stdout = open(os.devnull, 'w')
        
        try:
            token = generator.generate_token(args.email, args.password)
            # Restore stdout and print only the token
            sys.stdout.close()
            sys.stdout = original_stdout
            
            if token:
                print(token)
                sys.exit(0)
            else:
                print("ERROR: Failed to generate token", file=sys.stderr)
                sys.exit(1)
        except Exception as e:
            sys.stdout.close()
            sys.stdout = original_stdout
            print(f"ERROR: {e}", file=sys.stderr)
            sys.exit(1)
    else:
        token = generator.generate_token(args.email, args.password)
        if token:
            sys.exit(0)
        else:
            sys.exit(1)


if __name__ == "__main__":
    main()