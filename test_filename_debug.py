#!/usr/bin/env python3

"""
Debug filename sanitization.
"""

from jidelnicek.core.middleware.security import RequestSanitizationMiddleware

def test_sanitization():
    middleware = RequestSanitizationMiddleware(
        app=None,
        sanitize_filenames=True,
        max_filename_length=50
    )
    
    test_cases = [
        ("../../../etc/passwd", "etc_passwd"),
        ("file\x00name.txt", "file_name.txt"),
        ("file   with   spaces.pdf", "file_with_spaces.pdf"),
        ("....hidden....file....", "hidden_file"),
        ("very" + "long" * 20 + "name.txt", "verylonglonglonglonglonglonglonglon.txt"),
        ("", "unnamed"),
        ("COM1.txt", "COM1.txt"),  # Windows reserved name
        ("file<>:|?*.txt", "file______.txt"),
    ]
    
    for input_name, expected_name in test_cases:
        sanitized = middleware._sanitize_filename(input_name)
        print(f"Input: '{input_name}' -> Output: '{sanitized}' (Expected: '{expected_name}')")
        if sanitized != expected_name:
            print(f"  ❌ MISMATCH!")
        else:
            print(f"  ✅ OK")

if __name__ == "__main__":
    test_sanitization()