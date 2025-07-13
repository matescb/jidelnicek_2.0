#!/usr/bin/env python3
"""
Test ValidationMiddleware error format to verify it returns flat format.
"""

import sys
import asyncio
import json
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent / "src"))

from fastapi import FastAPI, Request
from fastapi.testclient import TestClient
from jidelnicek.core.middleware.validation import ValidationMiddleware, ValidationException


def test_validation_middleware_error_format():
    """Test that ValidationMiddleware returns flat error format."""
    
    # Create test app with ValidationMiddleware
    app = FastAPI()
    app.add_middleware(ValidationMiddleware, max_request_size=1024, log_validation_errors=False)
    
    # Create a route that raises ValidationException
    @app.get("/test-validation-error")
    async def test_validation_error():
        raise ValidationException(
            message="Invalid email or password",
            error_code="VALIDATION_MIDDLEWARE_ERROR"
        )
    
    # Create a route that raises general exception (to test lines 149-166)
    @app.get("/test-general-error")
    async def test_general_error():
        raise ValueError("Some unexpected error")
    
    # Test with TestClient
    with TestClient(app) as client:
        # Test ValidationException path
        response = client.get("/test-validation-error")
        print("ValidationException response:")
        print(f"Status: {response.status_code}")
        print(f"Content: {json.dumps(response.json(), indent=2)}")
        
        # Verify flat format
        data = response.json()
        assert "error" in data
        assert isinstance(data["error"], str)  # Should be string, not nested dict
        assert data["error"] == "VALIDATION_MIDDLEWARE_ERROR"
        assert data["message"] == "Invalid email or password"
        print("✓ ValidationException returns flat format")
        
        # Test general exception path (lines 149-166 in validation.py)
        response = client.get("/test-general-error")
        print("\nGeneral exception response:")
        print(f"Status: {response.status_code}")
        print(f"Content: {json.dumps(response.json(), indent=2)}")
        
        # Verify flat format
        data = response.json()
        assert "error" in data
        assert isinstance(data["error"], str)  # Should be string, not nested dict
        assert data["error"] == "VALIDATION_MIDDLEWARE_ERROR"
        print("✓ General exception returns flat format")


def test_validation_exception_directly():
    """Test ValidationException.to_dict() directly."""
    
    exc = ValidationException(
        message="Invalid email or password",
        error_code="VALIDATION_MIDDLEWARE_ERROR"
    )
    
    result = exc.to_dict()
    print(f"\nValidationException.to_dict(): {json.dumps(result, indent=2)}")
    
    # Verify flat format
    assert "error" in result
    assert isinstance(result["error"], str)  # Should be string, not nested dict
    assert result["error"] == "VALIDATION_MIDDLEWARE_ERROR"
    assert result["message"] == "Invalid email or password"
    print("✓ ValidationException.to_dict() returns flat format")


if __name__ == "__main__":
    print("Testing ValidationMiddleware error format...")
    print("=" * 50)
    
    try:
        test_validation_exception_directly()
        test_validation_middleware_error_format()
        
        print("\n" + "=" * 50)
        print("🎉 All tests passed! ValidationMiddleware returns flat format correctly.")
        print("\nConfirmed format:")
        print('{')
        print('  "error": "ERROR_CODE",')
        print('  "message": "Human readable message",')
        print('  "request_id": "uuid"')
        print('}')
        
    except Exception as e:
        print(f"\n❌ Test failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)