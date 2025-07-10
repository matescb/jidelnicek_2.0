#!/usr/bin/env python3
"""Test the consolidated migration for syntax and structure."""

import sys
import importlib.util
from pathlib import Path

def test_migration():
    """Test the migration file can be imported and has correct structure."""
    
    print("Testing migration file...")
    
    # Load the migration module
    migration_path = Path("migrations/versions/001_initial_schema.py")
    if not migration_path.exists():
        print(f"❌ Migration file not found: {migration_path}")
        return False
    
    try:
        # Import the migration module
        spec = importlib.util.spec_from_file_location("migration", migration_path)
        migration = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(migration)
        print("✅ Migration file imports successfully")
    except Exception as e:
        print(f"❌ Failed to import migration: {e}")
        return False
    
    # Check required attributes
    required_attrs = ['revision', 'down_revision', 'branch_labels', 'depends_on', 'upgrade', 'downgrade']
    for attr in required_attrs:
        if not hasattr(migration, attr):
            print(f"❌ Missing required attribute: {attr}")
            return False
    print("✅ All required attributes present")
    
    # Check revision values
    if migration.revision != '001_initial_schema':
        print(f"❌ Incorrect revision: {migration.revision}")
        return False
    if migration.down_revision is not None:
        print(f"❌ down_revision should be None, got: {migration.down_revision}")
        return False
    print("✅ Revision identifiers correct")
    
    # Check that upgrade and downgrade are callables
    if not callable(migration.upgrade):
        print("❌ upgrade is not callable")
        return False
    if not callable(migration.downgrade):
        print("❌ downgrade is not callable")
        return False
    print("✅ upgrade and downgrade functions are callable")
    
    print("\n✅ Migration structure is valid!")
    return True

def check_model_imports():
    """Test that all models can be imported."""
    print("\nTesting model imports...")
    
    models_to_test = [
        ("jidelnicek.auth.models", "AuthUser"),
        ("jidelnicek.common.models.ingredient", "Ingredient"),
        ("jidelnicek.common.models.snack", "Snack"),
        ("jidelnicek.recipe.models.recipe", "Recipe"),
        ("jidelnicek.recipe.models.recipe_ingredient", "RecipeIngredient"),
        ("jidelnicek.trip.models.trip", "Trip"),
        ("jidelnicek.trip.models.meal", "TripMeal"),
    ]
    
    all_good = True
    for module_name, class_name in models_to_test:
        try:
            module = importlib.import_module(module_name)
            if hasattr(module, class_name):
                print(f"✅ {module_name}.{class_name}")
            else:
                print(f"❌ {class_name} not found in {module_name}")
                all_good = False
        except ImportError as e:
            print(f"❌ Failed to import {module_name}: {e}")
            all_good = False
    
    return all_good

def main():
    """Run all tests."""
    print("=" * 60)
    print("Migration and Model Validation Test")
    print("=" * 60)
    
    # Add src to Python path
    sys.path.insert(0, str(Path(__file__).parent / "src"))
    
    migration_ok = test_migration()
    models_ok = check_model_imports()
    
    print("\n" + "=" * 60)
    if migration_ok and models_ok:
        print("✅ All tests passed!")
        return 0
    else:
        print("❌ Some tests failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())