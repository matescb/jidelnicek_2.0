#!/usr/bin/env python3
"""Test the migration SQL generation without a database."""

import sys
from pathlib import Path
from sqlalchemy import create_engine, MetaData
from sqlalchemy.schema import CreateTable
from alembic.config import Config
from alembic.migration import MigrationContext
from alembic.operations import Operations
from io import StringIO

# Add src to Python path
sys.path.insert(0, str(Path(__file__).parent / "src"))

def test_migration_sql():
    """Generate and validate SQL from the migration."""
    
    print("Testing migration SQL generation...")
    
    # Create an in-memory SQLite engine (won't actually be used for execution)
    engine = create_engine("sqlite:///:memory:")
    
    # Set up Alembic context
    with engine.connect() as connection:
        context = MigrationContext.configure(connection)
        op = Operations(context)
        
        # Import the migration
        import importlib.util
        migration_path = Path("migrations/versions/001_initial_schema.py")
        spec = importlib.util.spec_from_file_location("migration", migration_path)
        migration = importlib.util.module_from_spec(spec)
        
        # Inject alembic operations into the module
        migration.op = op
        migration.sa = __import__('sqlalchemy')
        
        # Load the module
        spec.loader.exec_module(migration)
        
        # Capture SQL output
        from alembic.ddl.impl import DefaultImpl
        from alembic.runtime.migration import MigrationInfo
        
        tables_created = []
        constraints_created = []
        indexes_created = []
        
        # Mock the operations to capture what would be created
        original_create_table = op.create_table
        original_create_index = op.create_index
        original_create_check_constraint = op.create_check_constraint
        original_create_foreign_key = op.create_foreign_key
        original_create_unique_constraint = op.create_unique_constraint
        
        def mock_create_table(name, *args, **kwargs):
            tables_created.append(name)
            return original_create_table(name, *args, **kwargs)
        
        def mock_create_index(name, table, *args, **kwargs):
            indexes_created.append(f"{table}.{name}")
            return original_create_index(name, table, *args, **kwargs)
        
        def mock_create_constraint(name, table, *args, **kwargs):
            constraints_created.append(f"{table}.{name}")
            return original_create_check_constraint(name, table, *args, **kwargs)
        
        op.create_table = mock_create_table
        op.create_index = mock_create_index
        op.create_check_constraint = mock_create_constraint
        
        # Run the upgrade
        try:
            migration.upgrade()
            print("✅ Migration upgrade() executed successfully")
        except Exception as e:
            print(f"❌ Migration upgrade() failed: {e}")
            return False
        
        # Report what was created
        print(f"\n📊 Migration Summary:")
        print(f"   Tables created: {len(tables_created)}")
        print(f"   Indexes created: {len(indexes_created)}")
        print(f"   Constraints created: {len(constraints_created)}")
        
        # Check for expected tables
        expected_tables = [
            'auth_users', 'common_ingredients', 'common_snacks', 
            'recipe_recipes', 'recipe_recipe_ingredients', 'trip_trips', 'trip_meals'
        ]
        
        missing_tables = [t for t in expected_tables if t not in tables_created]
        if missing_tables:
            print(f"\n❌ Missing expected tables: {missing_tables}")
            return False
        else:
            print("\n✅ All expected tables present")
        
        # Check for problematic references
        print("\n🔍 Checking for schema issues...")
        
        # Verify no nutritional_values table
        if 'common_nutritional_values' in tables_created:
            print("❌ Unwanted table 'common_nutritional_values' found!")
            return False
        else:
            print("✅ No 'common_nutritional_values' table (correct)")
        
        # Check foreign key naming
        if 'recipe_ingredients' in tables_created:
            print("❌ Table named 'recipe_ingredients' found - should be 'common_ingredients'!")
            return False
        else:
            print("✅ No 'recipe_ingredients' table (correct)")
        
        return True

def main():
    """Run the SQL generation test."""
    print("=" * 60)
    print("Migration SQL Generation Test")
    print("=" * 60)
    
    if test_migration_sql():
        print("\n✅ Migration SQL generation test passed!")
        return 0
    else:
        print("\n❌ Migration SQL generation test failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())