#!/usr/bin/env python3
"""
Simple validation test runner to verify the validation system works correctly.
"""

import sys
import asyncio
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent / "src"))

# Test basic validation components
def test_validation_exceptions():
    """Test validation exception classes."""
    from jidelnicek.core.middleware.validation import ValidationException, FileValidationException
    
    # Test ValidationException
    exc = ValidationException("Test error")
    assert exc.message == "Test error"
    assert exc.error_code == "VALIDATION_ERROR"
    assert exc.status_code == 422
    
    error_dict = exc.to_dict()
    assert error_dict["error"]["code"] == "VALIDATION_ERROR"
    assert error_dict["error"]["message"] == "Test error"
    
    # Test FileValidationException
    file_exc = FileValidationException(
        "File too large",
        filename="test.jpg",
        file_size=1024000,
        max_size=512000
    )
    assert file_exc.message == "File too large"
    assert file_exc.error_code == "FILE_VALIDATION_ERROR"
    assert file_exc.status_code == 413  # REQUEST_ENTITY_TOO_LARGE
    
    print("✓ Validation exceptions test passed")

def test_validation_middleware():
    """Test validation middleware components."""
    from jidelnicek.core.middleware.validation import ValidationMiddleware
    from fastapi import FastAPI
    
    # Create middleware instance
    app = FastAPI()
    middleware = ValidationMiddleware(
        app,
        max_request_size=1024 * 1024,
        allowed_extensions=[".jpg", ".png"],
        log_validation_errors=True
    )
    
    assert middleware.max_request_size == 1024 * 1024
    assert middleware.allowed_extensions == [".jpg", ".png"]
    assert middleware.log_validation_errors is True
    
    # Test filename validation
    assert middleware._is_safe_filename("test.jpg") is True
    assert middleware._is_safe_filename("../../../etc/passwd") is False
    assert middleware._is_safe_filename("test<script>.jpg") is False
    
    print("✓ Validation middleware test passed")

def test_validation_dependencies():
    """Test validation dependencies."""
    from jidelnicek.core.validation.validation import (
        ValidationDependency, FileUploadValidator, PermissionValidator
    )
    
    # Test base dependency
    dep = ValidationDependency("TEST_ERROR")
    assert dep.error_code == "TEST_ERROR"
    
    error = dep.create_error("Test message")
    assert error.status_code == 422
    assert error.detail["error"]["code"] == "TEST_ERROR"
    
    # Test file upload validator
    file_validator = FileUploadValidator(
        max_size=1024 * 1024,
        allowed_extensions=[".jpg", ".png"],
        require_image=True
    )
    assert file_validator.max_size == 1024 * 1024
    assert file_validator.allowed_extensions == [".jpg", ".png"]
    assert file_validator.require_image is True
    
    # Test permission validator
    perm_validator = PermissionValidator("recipes:read", require_verified=True)
    assert perm_validator.required_permission == "recipes:read"
    assert perm_validator.require_verified is True
    
    print("✓ Validation dependencies test passed")

def test_utility_functions():
    """Test validation utility functions."""
    from jidelnicek.core.middleware.validation import format_validation_error
    
    # Mock validation error
    class MockError:
        def errors(self):
            return [
                {
                    "loc": ("field", "subfield"),
                    "msg": "Field is required",
                    "type": "value_error.missing",
                    "input": None
                }
            ]
    
    error = MockError()
    result = format_validation_error(error)
    
    assert result["error"]["code"] == "VALIDATION_ERROR"
    assert result["error"]["message"] == "Request validation failed"
    assert len(result["error"]["details"]) == 1
    
    detail = result["error"]["details"][0]
    assert detail["field"] == "field.subfield"
    assert detail["message"] == "Field is required"
    assert detail["type"] == "value_error.missing"
    
    print("✓ Utility functions test passed")

def test_factory_functions():
    """Test dependency factory functions."""
    from jidelnicek.core.validation.validation import (
        require_permission, validate_file, validate_content_type
    )
    
    # Test factory functions return proper dependencies
    perm_dep = require_permission("admin:access")
    assert hasattr(perm_dep, 'dependency')
    
    file_dep = validate_file(max_size=1024 * 1024)
    assert hasattr(file_dep, 'dependency')
    
    content_dep = validate_content_type(["application/json"])
    assert hasattr(content_dep, 'dependency')
    
    print("✓ Factory functions test passed")

def main():
    """Run all validation tests."""
    print("Running validation system tests...")
    print()
    
    try:
        test_validation_exceptions()
        test_validation_middleware()
        test_validation_dependencies()
        test_utility_functions()
        test_factory_functions()
        
        print()
        print("🎉 All validation tests passed successfully!")
        return 0
        
    except Exception as e:
        print(f"❌ Test failed: {e}")
        import traceback
        traceback.print_exc()
        return 1

if __name__ == "__main__":
    sys.exit(main())