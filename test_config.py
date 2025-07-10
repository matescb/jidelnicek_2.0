#!/usr/bin/env python3

import os
import sys
sys.path.insert(0, 'src')

# Clear all env vars first
for key in list(os.environ.keys()):
    if key.startswith(('DB_', 'REDIS_', 'CORS_', 'SECRET_')):
        del os.environ[key]

# Set minimal environment variables
os.environ['ENVIRONMENT'] = 'development'
os.environ['SECRET_KEY'] = 'test-secret-key-12345678901234567890'
os.environ['DB_HOST'] = 'localhost'
os.environ['DB_PORT'] = '5432'
os.environ['DB_NAME'] = 'test'
os.environ['DB_USER'] = 'test'
os.environ['DB_PASSWORD'] = 'test-password'

# Set CORS_ORIGINS to empty string to reproduce the error
os.environ['CORS_ORIGINS'] = ''

print("Testing with CORS_ORIGINS set to empty string...")
print(f"CORS_ORIGINS env var = '{os.environ.get('CORS_ORIGINS')}'")

try:
    from jidelnicek.core.config import Settings
    settings = Settings()
    print(f"✓ Success: cors_origins = {settings.cors_origins}")
except Exception as e:
    print(f"✗ Failed: {type(e).__name__}: {e}")
    import traceback
    traceback.print_exc()