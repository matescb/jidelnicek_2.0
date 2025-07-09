#!/usr/bin/env python3

import os
import sys
sys.path.insert(0, 'src')

# Set environment variables
os.environ['ENVIRONMENT'] = 'test'

# Override the config loading to debug the issue
import pydantic_settings
from pydantic_settings.sources.providers.env import EnvSettingsSource

# Debug the exact environment variable processing
from pydantic import Field
from pydantic_settings import BaseSettings
from typing import List

class TestSettings(BaseSettings):
    cors_origins: List[str] = Field(default=["http://localhost:3000"])
    
    model_config = {
        "env_file": "config/test.env",
        "env_file_encoding": "utf-8",
        "case_sensitive": False
    }
    
    @classmethod
    def parse_cors_origins(cls, v):
        print(f"DEBUG: parse_cors_origins called with: {repr(v)}")
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        return v

try:
    settings = TestSettings()
    print(f"✓ Configuration loaded successfully")
    print(f"CORS Origins: {settings.cors_origins}")
except Exception as e:
    print(f"✗ Configuration failed: {e}")
    import traceback
    traceback.print_exc()