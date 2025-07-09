# Jídelníček 2.0 Scripts

This directory contains utility scripts for managing the Jídelníček 2.0 application.

## Available Scripts

### seed_data.py
Seeds initial categories and dietary tags into the database.

**Usage:**
```bash
python scripts/seed_data.py
```

**What it does:**
- Creates category hierarchy (Meals, Cuisine, Cooking Method, Difficulty)
- Creates dietary tags (vegan, vegetarian, gluten-free, etc.)
- Checks if data already exists to avoid duplicates
- Provides option to force re-seed if needed

**When to use:**
- After initial database setup
- When adding new categories or tags to the seed data
- For testing with a fresh database

### Future Scripts
- `migrate_data.py` - For migrating data from old system
- `backup_db.py` - Database backup utility
- `generate_test_data.py` - Generate test recipes and menus
- `cleanup_orphans.py` - Clean up orphaned database records