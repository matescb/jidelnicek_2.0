#!/usr/bin/env python3
"""Validate the migration structure and check for common issues."""

import re
from pathlib import Path

def validate_migration():
    """Validate the migration file content."""
    
    migration_path = Path("migrations/versions/001_initial_schema.py")
    content = migration_path.read_text()
    
    print("Validating migration content...")
    
    # Check for table creations
    tables = re.findall(r"op\.create_table\('(\w+)'", content)
    print(f"\n📊 Found {len(tables)} tables:")
    
    # Group tables by module
    auth_tables = [t for t in tables if t.startswith('auth_')]
    common_tables = [t for t in tables if t.startswith('common_')]
    recipe_tables = [t for t in tables if t.startswith('recipe_')]
    trip_tables = [t for t in tables if t.startswith('trip_')]
    admin_tables = [t for t in tables if t.startswith('admin_')]
    core_tables = [t for t in tables if t.startswith('core_')]
    other_tables = [t for t in tables if not any(t.startswith(p) for p in ['auth_', 'common_', 'recipe_', 'trip_', 'admin_', 'core_'])]
    
    print(f"   Auth tables: {len(auth_tables)}")
    print(f"   Common tables: {len(common_tables)}")
    print(f"   Recipe tables: {len(recipe_tables)}")
    print(f"   Trip tables: {len(trip_tables)}")
    print(f"   Admin tables: {len(admin_tables)}")
    print(f"   Core tables: {len(core_tables)}")
    print(f"   Other tables: {len(other_tables)}")
    
    # Check for problematic tables
    issues = []
    
    if 'common_nutritional_values' in tables:
        issues.append("❌ Found 'common_nutritional_values' table - should not exist!")
    else:
        print("\n✅ No 'common_nutritional_values' table")
    
    if 'recipe_ingredients' in tables:
        issues.append("❌ Found 'recipe_ingredients' table - should be 'common_ingredients'!")
    else:
        print("✅ No 'recipe_ingredients' table")
    
    # Check foreign key references
    fk_refs = re.findall(r"ForeignKey\(['\"](\w+\.\w+)['\"]", content)
    print(f"\n🔗 Found {len(fk_refs)} foreign key references")
    
    # Check for wrong FK references
    wrong_fks = []
    for fk in fk_refs:
        table, column = fk.split('.')
        if table == 'recipe_ingredients':
            wrong_fks.append(f"FK to 'recipe_ingredients.{column}' - should be 'common_ingredients.{column}'")
        elif table == 'recipes':
            wrong_fks.append(f"FK to 'recipes.{column}' - should be 'recipe_recipes.{column}'")
        elif table == 'common_nutritional_values':
            wrong_fks.append(f"FK to 'common_nutritional_values.{column}' - table shouldn't exist!")
    
    if wrong_fks:
        for fk in wrong_fks:
            issues.append(f"❌ {fk}")
    else:
        print("✅ All foreign key references look correct")
    
    # Check for JSON columns in common tables
    print("\n📝 Checking JSON columns in common tables...")
    
    # Find JSON columns in common_ingredients
    ingredients_section = re.search(r"op\.create_table\('common_ingredients'.*?\n\s*\)", content, re.DOTALL)
    if ingredients_section:
        json_cols = re.findall(r"Column\('(\w+)'.*?JSONB", ingredients_section.group())
        if json_cols:
            print(f"✅ common_ingredients has JSON columns: {', '.join(json_cols)}")
        else:
            issues.append("❌ common_ingredients missing JSON columns!")
    
    # Find JSON columns in common_snacks
    snacks_section = re.search(r"op\.create_table\('common_snacks'.*?\n\s*\)", content, re.DOTALL)
    if snacks_section:
        json_cols = re.findall(r"Column\('(\w+)'.*?JSONB", snacks_section.group())
        if json_cols:
            print(f"✅ common_snacks has JSON columns: {', '.join(json_cols)}")
        else:
            issues.append("❌ common_snacks missing JSON columns!")
        
        # Check for nutritional_value_id
        if 'nutritional_value_id' in snacks_section.group():
            issues.append("❌ common_snacks still has nutritional_value_id column!")
    
    # Final report
    print("\n" + "=" * 60)
    if issues:
        print("❌ Issues found:")
        for issue in issues:
            print(f"   {issue}")
        return False
    else:
        print("✅ Migration validation passed!")
        return True

def main():
    """Run validation."""
    print("=" * 60)
    print("Migration Validation")
    print("=" * 60)
    
    if validate_migration():
        return 0
    else:
        return 1

if __name__ == "__main__":
    import sys
    sys.exit(main())