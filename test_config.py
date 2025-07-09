#!/usr/bin/env python3

import os
import sys
sys.path.insert(0, 'src')

# Set environment variables
os.environ['ENVIRONMENT'] = 'test'
os.environ['DB_PASSWORD'] = 'test-password'
os.environ['CORS_ORIGINS'] = 'http://testserver'
os.environ['ALLOWED_UPLOAD_EXTENSIONS'] = '.jpg,.jpeg,.png,.gif,.pdf,.txt,.md'

try:
    from jidelnicek.core.config import Settings
    settings = Settings()
    print("✓ Configuration loaded successfully")
    print(f"CORS Origins: {settings.cors_origins}")
    print(f"Upload Extensions: {settings.allowed_upload_extensions}")
except Exception as e:
    print(f"✗ Configuration failed: {e}")
    import traceback
    traceback.print_exc()