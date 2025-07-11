#!/usr/bin/env python3
import yaml
import json
import sys

try:
    with open('tests/jidelnicek_OpenAPI Spec.yaml', 'r') as f:
        spec = yaml.safe_load(f)
    print("YAML parsed successfully")
    
    # Check if it's a valid OpenAPI spec
    if 'openapi' in spec and 'info' in spec and 'paths' in spec:
        print(f"OpenAPI version: {spec['openapi']}")
        print(f"API title: {spec['info']['title']}")
        print(f"Number of paths: {len(spec['paths'])}")
    else:
        print("ERROR: Missing required OpenAPI fields")
        sys.exit(1)
        
except yaml.YAMLError as e:
    print(f"YAML Error: {e}")
    sys.exit(1)
except Exception as e:
    print(f"Error: {e}")
    sys.exit(1)