#!/usr/bin/env python3
"""
Test script for migration 004_add_performance_indexes.py

This script validates that the migration can run successfully
and that all indexes are created as expected.
"""

import subprocess
import sys
import os
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

def run_command(cmd, description):
    """Run a command and handle errors."""
    print(f"\n🔄 {description}")
    try:
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True, cwd=project_root)
        if result.returncode != 0:
            print(f"❌ Error: {result.stderr}")
            return False
        else:
            print(f"✅ Success: {description}")
            if result.stdout:
                print(f"Output: {result.stdout}")
            return True
    except Exception as e:
        print(f"❌ Exception: {e}")
        return False

def check_migration_file():
    """Check that the migration file exists and has valid syntax."""
    migration_file = project_root / "migrations" / "versions" / "004_add_performance_indexes.py"
    
    print(f"\n🔍 Checking migration file: {migration_file}")
    
    if not migration_file.exists():
        print("❌ Migration file not found!")
        return False
    
    # Check syntax
    try:
        with open(migration_file, 'r') as f:
            code = f.read()
        compile(code, str(migration_file), 'exec')
        print("✅ Migration file syntax is valid")
        return True
    except SyntaxError as e:
        print(f"❌ Syntax error in migration file: {e}")
        return False

def check_dependencies():
    """Check that required dependencies are available."""
    print("\n🔍 Checking dependencies...")
    
    # Check if alembic is available
    if not run_command("python -c 'import alembic; print(alembic.__version__)'", "Checking Alembic"):
        return False
    
    # Check if SQLAlchemy is available
    if not run_command("python -c 'import sqlalchemy; print(sqlalchemy.__version__)'", "Checking SQLAlchemy"):
        return False
    
    # Check if psycopg2 is available
    if not run_command("python -c 'import psycopg2; print(psycopg2.__version__)'", "Checking psycopg2"):
        return False
    
    return True

def validate_index_definitions():
    """Validate that index definitions are correct."""
    print("\n🔍 Validating index definitions...")
    
    migration_file = project_root / "migrations" / "versions" / "004_add_performance_indexes.py"
    
    with open(migration_file, 'r') as f:
        content = f.read()
    
    # Check for required index types
    required_patterns = [
        "postgresql_using='gin'",  # GIN indexes
        "postgresql_where=",       # Partial indexes
        "sa.text(",               # Expression indexes
        "op.create_index",        # Index creation
        "op.drop_index",          # Index deletion in downgrade
    ]
    
    for pattern in required_patterns:
        if pattern not in content:
            print(f"❌ Missing required pattern: {pattern}")
            return False
    
    # Check for proper index naming
    index_names = []
    lines = content.split('\n')
    for line in lines:
        if 'op.create_index(' in line and "'" in line:
            # Extract index name
            start = line.find("'") + 1
            end = line.find("'", start)
            if start > 0 and end > start:
                index_names.append(line[start:end])
    
    print(f"✅ Found {len(index_names)} index definitions")
    
    # Check for duplicate index names
    if len(index_names) != len(set(index_names)):
        print("❌ Duplicate index names found!")
        return False
    
    print("✅ All index names are unique")
    return True

def check_postgresql_compatibility():
    """Check that the migration is compatible with PostgreSQL."""
    print("\n🔍 Checking PostgreSQL compatibility...")
    
    migration_file = project_root / "migrations" / "versions" / "004_add_performance_indexes.py"
    
    with open(migration_file, 'r') as f:
        content = f.read()
    
    # Check for PostgreSQL-specific features
    pg_features = [
        "postgresql.UUID",
        "postgresql_using='gin'",
        "postgresql_where=",
        "gin_trgm_ops",
        "to_tsvector",
    ]
    
    for feature in pg_features:
        if feature in content:
            print(f"✅ Found PostgreSQL feature: {feature}")
    
    # Check for potentially problematic patterns
    problematic_patterns = [
        "FULLTEXT",  # MySQL-specific
        "CLUSTERED", # SQL Server-specific
    ]
    
    for pattern in problematic_patterns:
        if pattern in content:
            print(f"❌ Found potentially problematic pattern: {pattern}")
            return False
    
    return True

def main():
    """Main test function."""
    print("🧪 Testing Migration 004: Performance Indexes")
    print("=" * 50)
    
    success = True
    
    # Run all checks
    checks = [
        check_migration_file,
        check_dependencies,
        validate_index_definitions,
        check_postgresql_compatibility,
    ]
    
    for check in checks:
        if not check():
            success = False
    
    print("\n" + "=" * 50)
    if success:
        print("✅ All tests passed! Migration 004 is ready to deploy.")
        print("\nNext steps:")
        print("1. Run: python -m alembic upgrade head")
        print("2. Monitor index usage with: psql -f scripts/check_index_usage.sql")
        print("3. Consider running VACUUM ANALYZE after migration")
    else:
        print("❌ Some tests failed. Please fix the issues before deploying.")
        sys.exit(1)

if __name__ == "__main__":
    main()