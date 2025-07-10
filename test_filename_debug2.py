#!/usr/bin/env python3

"""
Debug filename sanitization step by step.
"""

import os
import re

def debug_sanitization(filename: str) -> str:
    """Debug version of _sanitize_filename."""
    print(f"\n=== Processing: '{filename}' ===")
    
    if not filename:
        return "unnamed"
    
    # Get base name and extension
    name, ext = os.path.splitext(filename)
    print(f"After splitext: name='{name}', ext='{ext}'")
    
    # Replace directory separators and path traversal sequences
    # This will convert "../../../etc/passwd" to "etc_passwd"
    name = name.replace("..", "").replace("/", "_").replace("\\", "_")
    print(f"After replacing path separators: name='{name}'")
    
    # Replace non-alphanumeric characters (except dots)
    filename_pattern = re.compile(r'[^\w\s.-]')
    name = filename_pattern.sub("_", name)
    print(f"After replacing non-alphanumeric: name='{name}'")
    
    # Replace multiple dots
    multiple_dots = re.compile(r'\.{2,}')
    name = multiple_dots.sub(".", name)
    print(f"After replacing multiple dots: name='{name}'")
    
    # Replace whitespace with single underscore
    whitespace = re.compile(r'\s+')
    name = whitespace.sub("_", name)
    print(f"After replacing whitespace: name='{name}'")
    
    # Remove leading/trailing dots and underscores
    name = name.strip("._")
    print(f"After stripping dots/underscores: name='{name}'")
    
    # Ensure filename is not empty
    if not name:
        name = "file"
        print(f"After ensuring not empty: name='{name}'")
    
    result = f"{name}{ext}"
    print(f"Final result: '{result}'")
    return result

def test_cases():
    test_cases = [
        ("../../../etc/passwd", "etc_passwd"),
        ("file\x00name", "file_name"),
        ("file   with   spaces", "file_with_spaces"),
        ("....hidden....file....", "hidden_file"),
    ]
    
    for input_name, expected_name in test_cases:
        sanitized = debug_sanitization(input_name)
        print(f"Expected: '{expected_name}', Got: '{sanitized}'")
        if sanitized != expected_name:
            print(f"  ❌ MISMATCH!")
        else:
            print(f"  ✅ OK")

if __name__ == "__main__":
    test_cases()