#!/usr/bin/env python3
"""
Script to fix malformed YAML structure in OpenAPI contract files.
This fixes the response definitions that were incorrectly merged.
"""

import os
import re
import sys

# Files that need to be cleaned up
FILES_TO_CLEANUP = [
    'tests/split_contract/recipes.yaml',
    'tests/split_contract/trips.yaml', 
    'tests/split_contract/calculations.yaml',
    'tests/split_contract/exports.yaml',
    'tests/split_contract/sharing.yaml',
    'tests/split_contract/meals.yaml'
]

def fix_response_definitions(content):
    """Fix malformed response definitions in the schemas section."""
    
    # Fix the ValidationError definition that got merged with InternalServerError
    # Pattern: schemas section starts, ValidationError is malformed, then Error schema follows
    
    # Look for the malformed ValidationError followed by Error schema
    pattern = r'(  schemas:\s*\n\s*ValidationError:\s*\n(?:.*\n)*?\s+- field: parameterId\s*\n\s+issue: Invalid UUID format\s*\n)\s*\n\s*description: Internal server error\s*\n(?:.*\n)*?\s+message: An unexpected error occurred\s*(\s*Error:)'
    
    def replacement(match):
        validation_part = match.group(1)
        error_start = match.group(2)
        
        # Properly format the response definitions
        fixed_content = validation_part + """    InternalServerError:
      description: Internal server error
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/Error'
          example:
            error: Internal Server Error
            message: An unexpected error occurred
""" + error_start
        
        return fixed_content
    
    content = re.sub(pattern, replacement, content, flags=re.MULTILINE | re.DOTALL)
    
    # Also fix cases where the schemas got completely messed up
    # Look for pattern where Error schema is missing proper structure
    error_pattern = r'(\s+)message: An unexpected error occurred(\s*)Error:'
    content = re.sub(error_pattern, r'\1message: An unexpected error occurred\2  \2Error:', content)
    
    # Fix the InternalServerError that might be missing proper YAML structure
    broken_internal_pattern = r'(\s+)description: Internal server error\s*\n\s*content:\s*\n\s*application/json:\s*\n\s*schema:\s*\n\s*\$ref: \'#/components/schemas/Error\'\s*\n\s*example:\s*\n\s*error: Internal Server Error\s*\n\s*message: An unexpected error occurred(\s*)Error:'
    
    def fix_internal_server_error(match):
        indent = match.group(1)
        after_content = match.group(2)
        return f"""{indent}description: Internal server error
{indent}content:
{indent}  application/json:
{indent}    schema:
{indent}      $ref: '#/components/schemas/Error'
{indent}    example:
{indent}      error: Internal Server Error
{indent}      message: An unexpected error occurred
{after_content}Error:"""
    
    content = re.sub(broken_internal_pattern, fix_internal_server_error, content, flags=re.MULTILINE | re.DOTALL)
    
    return content

def remove_duplicate_status_codes(content):
    """Remove duplicate status codes in responses sections."""
    
    # Pattern to find and remove duplicate 429 and 500 status codes
    # Look for patterns like:
    # '429':
    #   $ref: '#/components/responses/TooManyRequests'
    # '500':
    #   $ref: '#/components/responses/InternalServerError'
    # '401': (or other status)
    #   ...
    # '429': (duplicate)
    #   $ref: '#/components/responses/TooManyRequests'
    # '500': (duplicate)
    #   $ref: '#/components/responses/InternalServerError'
    
    lines = content.split('\n')
    result_lines = []
    in_responses = False
    seen_status_codes = set()
    current_endpoint_responses = {}
    
    i = 0
    while i < len(lines):
        line = lines[i]
        
        # Check if we're starting a new responses section
        if re.match(r'\s*responses:\s*$', line):
            in_responses = True
            seen_status_codes = set()
            current_endpoint_responses = {}
            result_lines.append(line)
        # Check if we're ending responses section (next major section)
        elif in_responses and re.match(r'\s*[a-zA-Z_]+:\s*$', line) and not re.match(r'\s*\'[0-9]+\':', line):
            in_responses = False
            seen_status_codes = set()
            current_endpoint_responses = {}
            result_lines.append(line)
        # Check for status code definitions
        elif in_responses and re.match(r'\s*\'([0-9]+)\':\s*$', line):
            status_code = re.match(r'\s*\'([0-9]+)\':\s*$', line).group(1)
            
            if status_code in seen_status_codes:
                # Skip this duplicate status code and its $ref line
                i += 1  # Skip the $ref line too
                if i < len(lines) and '$ref:' in lines[i]:
                    i += 1  # Skip the $ref line
                continue
            else:
                seen_status_codes.add(status_code)
                result_lines.append(line)
        else:
            result_lines.append(line)
        
        i += 1
    
    return '\n'.join(result_lines)

def fix_missing_status_codes(content):
    """Add missing status codes to endpoints that still need them."""
    
    # Find endpoints that don't have 422/429/500 but should
    lines = content.split('\n')
    result_lines = []
    
    i = 0
    while i < len(lines):
        line = lines[i]
        
        # Look for endpoints ending with only 404 and needing more status codes  
        if ("'404':" in line and 
            i + 1 < len(lines) and 
            "$ref: '#/components/responses/NotFound'" in lines[i + 1]):
            
            # Check if this is followed by the end of responses (next endpoint or section)
            next_line_idx = i + 2
            while (next_line_idx < len(lines) and 
                   (lines[next_line_idx].strip() == '' or lines[next_line_idx].startswith('  /'))):
                if lines[next_line_idx].startswith('  /'):
                    # This 404 is the last status code before next endpoint
                    # Add missing status codes
                    result_lines.append(line)  # '404':
                    result_lines.append(lines[i + 1])  # $ref line
                    
                    # Add missing status codes
                    indent = '        '
                    if '/{' in lines[next_line_idx]:  # Path parameter endpoint needs 422
                        result_lines.append(f"{indent}'422':")
                        result_lines.append(f"{indent}  $ref: '#/components/responses/ValidationError'")
                    result_lines.append(f"{indent}'429':")
                    result_lines.append(f"{indent}  $ref: '#/components/responses/TooManyRequests'")
                    result_lines.append(f"{indent}'500':")
                    result_lines.append(f"{indent}  $ref: '#/components/responses/InternalServerError'")
                    
                    i = next_line_idx - 1  # Will be incremented at end of loop
                    break
                next_line_idx += 1
            else:
                result_lines.append(line)
        else:
            result_lines.append(line)
        
        i += 1
    
    return '\n'.join(result_lines)

def process_file(filepath):
    """Process a single OpenAPI YAML file."""
    print(f"Cleaning up {filepath}...")
    
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Apply fixes
        content = fix_response_definitions(content)
        content = remove_duplicate_status_codes(content)
        # content = fix_missing_status_codes(content)  # Commenting out for now
        
        # Write back the updated content
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        
        print(f"✓ Cleaned up {filepath}")
        return True
        
    except Exception as e:
        print(f"✗ Error cleaning up {filepath}: {e}")
        return False

def main():
    """Main function to process all files."""
    success_count = 0
    total_count = len(FILES_TO_CLEANUP)
    
    print("Cleaning up malformed YAML structure...")
    print(f"Processing {total_count} files...\n")
    
    for filepath in FILES_TO_CLEANUP:
        if os.path.exists(filepath):
            if process_file(filepath):
                success_count += 1
        else:
            print(f"✗ File not found: {filepath}")
    
    print(f"\nCompleted: {success_count}/{total_count} files cleaned up successfully")
    
    if success_count == total_count:
        print("All files cleaned up successfully!")
        return 0
    else:
        print("Some files failed to clean up.")
        return 1

if __name__ == "__main__":
    sys.exit(main())