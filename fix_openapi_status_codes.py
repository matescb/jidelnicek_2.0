#!/usr/bin/env python3
"""
Script to fix OpenAPI contract files by adding missing status codes.
This script adds the missing 422, 429, and 500 status codes to all endpoints
and ensures the required response definitions exist.
"""

import os
import re
import sys

# Files that need to be updated (excluding already updated ones)
FILES_TO_UPDATE = [
    'tests/split_contract/recipes.yaml',
    'tests/split_contract/trips.yaml', 
    'tests/split_contract/calculations.yaml',
    'tests/split_contract/exports.yaml',
    'tests/split_contract/sharing.yaml',
    'tests/split_contract/meals.yaml'  # May need additional updates
]

# Response definitions to add if missing
RESPONSE_DEFINITIONS = """    ValidationError:
      description: Validation error - invalid request data
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/Error'
          example:
            error: Validation Error
            message: Request validation failed
            details:
              - field: parameterId
                issue: Invalid UUID format
    InternalServerError:
      description: Internal server error
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/Error'
          example:
            error: Internal Server Error
            message: An unexpected error occurred"""

def add_response_definitions(content):
    """Add missing response definitions to the components/responses section."""
    
    # Check if ValidationError and InternalServerError exist
    has_validation_error = 'ValidationError:' in content
    has_internal_server_error = 'InternalServerError:' in content
    
    if has_validation_error and has_internal_server_error:
        return content  # Both already exist
    
    # Find the TooManyRequests response (which should exist) to insert after
    pattern = r'(    TooManyRequests:\s*\n(?:.*\n)*?(?=    \w|\n  schemas:))'
    match = re.search(pattern, content, re.MULTILINE)
    
    if match:
        too_many_requests_section = match.group(1)
        replacement = too_many_requests_section
        
        if not has_validation_error:
            replacement += RESPONSE_DEFINITIONS.split('InternalServerError:')[0].rstrip() + '\n'
        
        if not has_internal_server_error:
            replacement += '    ' + RESPONSE_DEFINITIONS.split('ValidationError:')[1].split('InternalServerError:')[1]
        
        content = content.replace(too_many_requests_section, replacement)
    
    return content

def add_status_codes_to_endpoint(content):
    """Add missing status codes to endpoints that need them."""
    
    # Pattern to find endpoints that end with 404 and need additional status codes
    # This matches the last status code in a responses section
    patterns_to_fix = [
        # Endpoints with path parameters (need 422)
        (r"(\s+)'404':\s*\n\s+\$ref: '#/components/responses/NotFound'\s*\n(\s+)(/\w+/\{[^}]+\})", 
         r"\1'404':\n          $ref: '#/components/responses/NotFound'\n        '422':\n          $ref: '#/components/responses/ValidationError'\n        '429':\n          $ref: '#/components/responses/TooManyRequests'\n        '500':\n          $ref: '#/components/responses/InternalServerError'\n\2\3"),
        
        # All endpoints need 429 and 500 if they don't have them
        (r"(\s+)'404':\s*\n\s+\$ref: '#/components/responses/NotFound'\s*\n(\s+)(/[^{])", 
         r"\1'404':\n          $ref: '#/components/responses/NotFound'\n        '429':\n          $ref: '#/components/responses/TooManyRequests'\n        '500':\n          $ref: '#/components/responses/InternalServerError'\n\2\3"),
        
        # Endpoints that end with 401 and need additional codes
        (r"(\s+)'401':\s*\n\s+\$ref: '#/components/responses/Unauthorized'\s*\n(\s+)(/)", 
         r"\1'401':\n          $ref: '#/components/responses/Unauthorized'\n        '429':\n          $ref: '#/components/responses/TooManyRequests'\n        '500':\n          $ref: '#/components/responses/InternalServerError'\n\2\3"),
        
        # For endpoints that only return 200/201 (like GET /recipes)
        (r"(\s+schema:\s*\n\s+\$ref: '#/components/schemas/[^']+'\s*\n)(\s+)'401':", 
         r"\1        '429':\n          $ref: '#/components/responses/TooManyRequests'\n        '500':\n          $ref: '#/components/responses/InternalServerError'\n\2'401':"),
    ]
    
    for pattern, replacement in patterns_to_fix:
        content = re.sub(pattern, replacement, content, flags=re.MULTILINE)
    
    return content

def process_file(filepath):
    """Process a single OpenAPI YAML file."""
    print(f"Processing {filepath}...")
    
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Add response definitions if missing
        content = add_response_definitions(content)
        
        # Add status codes to endpoints
        content = add_status_codes_to_endpoint(content)
        
        # Write back the updated content
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        
        print(f"✓ Updated {filepath}")
        return True
        
    except Exception as e:
        print(f"✗ Error processing {filepath}: {e}")
        return False

def main():
    """Main function to process all files."""
    success_count = 0
    total_count = len(FILES_TO_UPDATE)
    
    print("Fixing OpenAPI contract files...")
    print(f"Processing {total_count} files...\n")
    
    for filepath in FILES_TO_UPDATE:
        if os.path.exists(filepath):
            if process_file(filepath):
                success_count += 1
        else:
            print(f"✗ File not found: {filepath}")
    
    print(f"\nCompleted: {success_count}/{total_count} files updated successfully")
    
    if success_count == total_count:
        print("All files updated successfully!")
        return 0
    else:
        print("Some files failed to update.")
        return 1

if __name__ == "__main__":
    sys.exit(main())