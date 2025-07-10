"""Initial schema creation - consolidated

Revision ID: 001_initial_schema
Revises: 
Create Date: 2025-07-10 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '001_initial_schema'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create initial schema with all tables."""
    
    # =====================================================
    # Authentication Module (auth_*)
    # =====================================================
    
    # Create auth_users table
    op.create_table('auth_users',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('password_hash', sa.String(length=255), nullable=True),
        sa.Column('email_verified', sa.Boolean(), server_default=sa.text('false'), nullable=True),
        sa.Column('verification_token', sa.String(length=255), nullable=True),
        sa.Column('reset_token', sa.String(length=255), nullable=True),
        sa.Column('reset_token_expires', sa.TIMESTAMP(), nullable=True),
        sa.Column('language', sa.String(length=2), server_default='cs', nullable=True),
        sa.Column('unit_system', sa.String(length=10), server_default='metric', nullable=True),
        sa.Column('energy_unit', sa.String(length=10), server_default='kcal', nullable=True),
        sa.Column('has_pku', sa.Boolean(), server_default=sa.text('false'), nullable=True),
        sa.Column('timezone', sa.String(length=50), server_default='Europe/Prague', nullable=True),
        sa.Column('role', sa.String(length=20), server_default='user', nullable=True),
        sa.Column('is_archived', sa.Boolean(), server_default=sa.text('false'), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.TIMESTAMP(), server_default=sa.text('now()'), nullable=True),
        sa.Column('last_login', sa.TIMESTAMP(), nullable=True),
        sa.Column('recipe_count', sa.Integer(), server_default='0', nullable=True),
        sa.Column('trip_count', sa.Integer(), server_default='0', nullable=True),
        sa.CheckConstraint("language IN ('en', 'cs')", name='auth_users_language_check'),
        sa.CheckConstraint("unit_system IN ('metric', 'imperial')", name='auth_users_unit_system_check'),
        sa.CheckConstraint("energy_unit IN ('kcal', 'kJ')", name='auth_users_energy_unit_check'),
        sa.CheckConstraint("role IN ('user', 'admin')", name='auth_users_role_check'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('email')
    )
    
    # Create auth_sessions table
    op.create_table('auth_sessions',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('session_token', sa.String(length=255), nullable=False),
        sa.Column('expires_at', sa.TIMESTAMP(), nullable=False),
        sa.Column('ip_address', postgresql.INET(), nullable=True),
        sa.Column('user_agent', sa.Text(), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(), server_default=sa.text('now()'), nullable=True),
        sa.Column('last_accessed', sa.TIMESTAMP(), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['auth_users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('session_token')
    )
    
    # Create auth_tokens table
    op.create_table('auth_tokens',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('token_hash', sa.String(length=255), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=True),
        sa.Column('last_used', sa.TIMESTAMP(), nullable=True),
        sa.Column('expires_at', sa.TIMESTAMP(), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(), server_default=sa.text('now()'), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default=sa.text('true'), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['auth_users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('token_hash')
    )
    
    # Create auth_email_verifications table
    op.create_table('auth_email_verifications',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('token', sa.String(length=255), nullable=False),
        sa.Column('expires_at', sa.TIMESTAMP(), nullable=False),
        sa.Column('verified_at', sa.TIMESTAMP(), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['auth_users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('token')
    )
    
    # Create auth_password_resets table
    op.create_table('auth_password_resets',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('token', sa.String(length=255), nullable=False),
        sa.Column('expires_at', sa.TIMESTAMP(), nullable=False),
        sa.Column('used_at', sa.TIMESTAMP(), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['auth_users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('token')
    )
    
    # Create indexes for auth tables
    op.create_index('idx_auth_users_email', 'auth_users', ['email'])
    op.create_index('idx_auth_users_archived', 'auth_users', ['is_archived'])
    op.create_index('idx_auth_sessions_token', 'auth_sessions', ['session_token'])
    op.create_index('idx_auth_sessions_user', 'auth_sessions', ['user_id'])
    op.create_index('idx_auth_sessions_expires', 'auth_sessions', ['expires_at'])
    op.create_index('idx_auth_tokens_hash', 'auth_tokens', ['token_hash'])
    op.create_index('idx_auth_tokens_user', 'auth_tokens', ['user_id'])
    op.create_index('idx_auth_email_verifications_token', 'auth_email_verifications', ['token'])
    op.create_index('idx_auth_email_verifications_user', 'auth_email_verifications', ['user_id'])
    op.create_index('idx_auth_password_resets_token', 'auth_password_resets', ['token'])
    op.create_index('idx_auth_password_resets_user', 'auth_password_resets', ['user_id'])
    
    # =====================================================
    # Common Module (common_*)
    # =====================================================
    
    # Create common_ingredients table (with JSON fields, no nutritional_values table)
    op.create_table('common_ingredients',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('category', sa.String(length=50), nullable=True),
        sa.Column('brand', sa.String(length=100), nullable=True, comment='Brand of the ingredient, if applicable'),
        sa.Column('barcode', sa.String(length=50), nullable=True, comment='Barcode (EAN/UPC) of the ingredient'),
        sa.Column('nutritional_data', postgresql.JSONB(astext_type=sa.Text()), nullable=True, comment='Nutritional values per 100g (e.g., calories, proteins)'),
        sa.Column('unit_conversions', postgresql.JSONB(astext_type=sa.Text()), nullable=True, comment='Conversion factors to grams (e.g., {"cup": 120, "tbsp": 15})'),
        sa.Column('allergens', postgresql.ARRAY(sa.String()), nullable=True, comment='List of allergens present in the ingredient'),
        sa.Column('dietary_flags', postgresql.JSONB(astext_type=sa.Text()), nullable=True, comment='Dietary flags (e.g., {"vegan": true, "gluten_free": false})'),
        sa.Column('is_global', sa.Boolean(), server_default=sa.text('false'), nullable=True),
        sa.Column('is_archived', sa.Boolean(), server_default=sa.text('false'), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.TIMESTAMP(), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['auth_users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'name')
    )
    
    # Create common_snacks table (with JSON fields, no nutritional_value_id)
    op.create_table('common_snacks',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('measurement_type', sa.String(length=20), nullable=True),
        sa.Column('piece_weight_g', sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column('nutritional_data', postgresql.JSONB(astext_type=sa.Text()), nullable=True, comment='Nutritional values per 100g (e.g., calories, proteins)'),
        sa.Column('unit_conversions', postgresql.JSONB(astext_type=sa.Text()), nullable=True, comment='Conversion factors to grams (e.g., {"cup": 120, "tbsp": 15})'),
        sa.Column('allergens', postgresql.ARRAY(sa.String()), nullable=True, comment='List of allergens present in the snack'),
        sa.Column('dietary_flags', postgresql.JSONB(astext_type=sa.Text()), nullable=True, comment='Dietary flags (e.g., {"vegan": true, "gluten_free": false})'),
        sa.Column('is_global', sa.Boolean(), server_default=sa.text('false'), nullable=True),
        sa.Column('is_archived', sa.Boolean(), server_default=sa.text('false'), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.TIMESTAMP(), server_default=sa.text('now()'), nullable=True),
        sa.CheckConstraint("measurement_type IN ('piece', 'per_100g')", name='common_snacks_measurement_type_check'),
        sa.ForeignKeyConstraint(['user_id'], ['auth_users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'name')
    )
    
    # Create indexes for common tables
    op.create_index('idx_ingredients_user', 'common_ingredients', ['user_id'], postgresql_where=sa.text('NOT is_archived'))
    op.create_index('idx_ingredients_global', 'common_ingredients', ['is_global'], postgresql_where=sa.text('is_global AND NOT is_archived'))
    op.create_index('idx_ingredients_name', 'common_ingredients', ['name'])
    op.create_index('idx_ingredients_barcode', 'common_ingredients', ['barcode'], unique=True)
    op.create_index('idx_snacks_user', 'common_snacks', ['user_id'], postgresql_where=sa.text('NOT is_archived'))
    op.create_index('idx_snacks_name', 'common_snacks', ['name'])
    
    # =====================================================
    # Recipe Module (recipe_*)
    # =====================================================
    
    # Create recipe_recipes table
    op.create_table('recipe_recipes',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('instructions', sa.Text(), nullable=True),
        sa.Column('prep_time_minutes', sa.Integer(), nullable=True),
        sa.Column('cook_time_minutes', sa.Integer(), nullable=True),
        sa.Column('water_ml', sa.Integer(), server_default='0', nullable=True),
        sa.Column('servings', sa.Integer(), server_default='1', nullable=True),
        sa.Column('is_public', sa.Boolean(), server_default=sa.text('false'), nullable=True),
        sa.Column('is_published', sa.Boolean(), server_default=sa.text('false'), nullable=True),
        sa.Column('published_at', sa.TIMESTAMP(), nullable=True),
        sa.Column('fork_count', sa.Integer(), server_default='0', nullable=True),
        sa.Column('original_recipe_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('is_archived', sa.Boolean(), server_default=sa.text('false'), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.TIMESTAMP(), server_default=sa.text('now()'), nullable=True),
        sa.CheckConstraint('LENGTH(instructions) <= 2000', name='recipe_recipes_instructions_check'),
        sa.CheckConstraint('NOT is_published OR fork_count <= 5 OR fork_count IS NULL', name='unpublish_protection'),
        sa.ForeignKeyConstraint(['original_recipe_id'], ['recipe_recipes.id']),
        sa.ForeignKeyConstraint(['user_id'], ['auth_users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create recipe_recipe_ingredients table
    op.create_table('recipe_recipe_ingredients',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('recipe_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('ingredient_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('quantity_g', sa.Numeric(precision=10, scale=1), nullable=False),
        sa.Column('display_order', sa.Integer(), server_default='0', nullable=True),
        sa.CheckConstraint('quantity_g > 0', name='recipe_recipe_ingredients_quantity_g_check'),
        sa.ForeignKeyConstraint(['ingredient_id'], ['common_ingredients.id']),
        sa.ForeignKeyConstraint(['recipe_id'], ['recipe_recipes.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('recipe_id', 'ingredient_id')
    )
    
    # Create recipe_images table
    op.create_table('recipe_images',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('recipe_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('image_url', sa.String(length=500), nullable=False, comment='URL to full-size image'),
        sa.Column('thumbnail_url', sa.String(length=500), nullable=True, comment='URL to thumbnail image'),
        sa.Column('alt_text', sa.String(length=200), nullable=True, comment='Alternative text for accessibility'),
        sa.Column('display_order', sa.Integer(), server_default='0', nullable=False, comment='Order of display (0 = first)'),
        sa.Column('is_primary', sa.Boolean(), server_default=sa.text('false'), nullable=False, comment='Whether this is the primary/featured image'),
        sa.Column('file_size_bytes', sa.Integer(), nullable=True, comment='Original file size in bytes'),
        sa.Column('width', sa.Integer(), nullable=True, comment='Image width in pixels'),
        sa.Column('height', sa.Integer(), nullable=True, comment='Image height in pixels'),
        sa.Column('mime_type', sa.String(length=50), nullable=True, comment='MIME type (e.g., image/jpeg)'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['recipe_id'], ['recipe_recipes.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('recipe_id', 'display_order', name='uq_recipe_images_recipe_id_display_order'),
        sa.CheckConstraint('file_size_bytes <= 5242880', name='recipe_images_file_size_check')
    )
    
    # Create recipe_categories table
    op.create_table('recipe_categories',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('slug', sa.String(length=100), nullable=False),
        sa.Column('parent_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('icon', sa.String(length=50), nullable=True),
        sa.Column('display_order', sa.Integer(), server_default='0', nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.TIMESTAMP(), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['parent_id'], ['recipe_categories.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('slug')
    )
    
    # Create recipe_tags table
    op.create_table('recipe_tags',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('name', sa.String(length=50), nullable=False),
        sa.Column('slug', sa.String(length=50), nullable=False),
        sa.Column('usage_count', sa.Integer(), server_default='0', nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('slug')
    )
    
    # Create recipe_recipe_categories junction table
    op.create_table('recipe_recipe_categories',
        sa.Column('recipe_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('category_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('is_primary', sa.Boolean(), server_default=sa.text('false'), nullable=True),
        sa.ForeignKeyConstraint(['category_id'], ['recipe_categories.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['recipe_id'], ['recipe_recipes.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('recipe_id', 'category_id')
    )
    
    # Create recipe_recipe_tags junction table
    op.create_table('recipe_recipe_tags',
        sa.Column('recipe_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('tag_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('tagged_at', sa.TIMESTAMP(), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['recipe_id'], ['recipe_recipes.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['tag_id'], ['recipe_tags.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('recipe_id', 'tag_id')
    )
    
    # Create indexes for recipe tables
    op.create_index('idx_recipes_user', 'recipe_recipes', ['user_id'], postgresql_where=sa.text('NOT is_archived'))
    op.create_index('idx_recipes_public', 'recipe_recipes', ['is_published'], postgresql_where=sa.text('is_published AND NOT is_archived'))
    op.create_index('idx_recipes_original', 'recipe_recipes', ['original_recipe_id'])
    op.create_index('idx_recipes_name', 'recipe_recipes', ['name'])
    op.create_index('idx_recipe_ingredients_recipe', 'recipe_recipe_ingredients', ['recipe_id'])
    op.create_index('idx_recipe_ingredients_ingredient', 'recipe_recipe_ingredients', ['ingredient_id'])
    op.create_index('idx_recipe_images_recipe_id', 'recipe_images', ['recipe_id'])
    op.create_index('idx_recipe_primary_image', 'recipe_images', ['recipe_id', 'is_primary'], unique=True, postgresql_where=sa.text('is_primary = true'))
    op.create_index('idx_categories_slug', 'recipe_categories', ['slug'])
    op.create_index('idx_categories_parent', 'recipe_categories', ['parent_id'])
    op.create_index('idx_categories_order', 'recipe_categories', ['display_order'])
    op.create_index('idx_tags_slug', 'recipe_tags', ['slug'])
    op.create_index('idx_tags_usage', 'recipe_tags', ['usage_count'], postgresql_where=sa.text('usage_count > 0'))
    op.create_index('idx_tags_name', 'recipe_tags', ['name'])
    op.create_index('idx_recipe_categories_recipe', 'recipe_recipe_categories', ['recipe_id'])
    op.create_index('idx_recipe_categories_category', 'recipe_recipe_categories', ['category_id'])
    op.create_index('idx_recipe_categories_primary', 'recipe_recipe_categories', ['recipe_id'], postgresql_where=sa.text('is_primary'))
    op.create_index('idx_recipe_tags_recipe', 'recipe_recipe_tags', ['recipe_id'])
    op.create_index('idx_recipe_tags_tag', 'recipe_recipe_tags', ['tag_id'])
    op.create_index('idx_recipe_tags_tagged_at', 'recipe_recipe_tags', ['tagged_at'])
    
    # =====================================================
    # Trip Module (trip_*)
    # =====================================================
    
    # Create trip_trips table
    op.create_table('trip_trips',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('start_date', sa.Date(), nullable=False),
        sa.Column('end_date', sa.Date(), nullable=False),
        sa.Column('meal_slots', postgresql.JSONB(astext_type=sa.Text()), server_default='["Snídaně", "Oběd", "Večeře"]', nullable=True),
        sa.Column('status', sa.String(length=20), server_default='draft', nullable=True),
        sa.Column('is_archived', sa.Boolean(), server_default=sa.text('false'), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.TIMESTAMP(), server_default=sa.text('now()'), nullable=True),
        sa.CheckConstraint('end_date >= start_date', name='trip_trips_check'),
        sa.CheckConstraint("status IN ('draft', 'active', 'completed', 'archived')", name='trip_trips_status_check'),
        sa.ForeignKeyConstraint(['user_id'], ['auth_users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create trip_participants table
    op.create_table('trip_participants',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('trip_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=True),
        sa.Column('number', sa.Integer(), nullable=True),
        sa.Column('coefficient', sa.Numeric(precision=5, scale=2), server_default='100.00', nullable=True),
        sa.CheckConstraint('(name IS NOT NULL) OR (number IS NOT NULL)', name='trip_participants_check'),
        sa.CheckConstraint('coefficient > 0 AND coefficient <= 999.99', name='trip_participants_coefficient_check'),
        sa.ForeignKeyConstraint(['trip_id'], ['trip_trips.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create trip_days table
    op.create_table('trip_days',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('trip_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('day_number', sa.Integer(), nullable=False),
        sa.Column('date', sa.Date(), nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['trip_id'], ['trip_trips.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('trip_id', 'day_number')
    )
    
    # Create trip_recipe_snapshots table
    op.create_table('trip_recipe_snapshots',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('original_recipe_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('recipe_data', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('nutritional_data', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('created_at', sa.TIMESTAMP(), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['original_recipe_id'], ['recipe_recipes.id']),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create trip_meals table
    op.create_table('trip_meals',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('trip_day_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('meal_slot', sa.String(length=50), nullable=False),
        sa.Column('recipe_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('recipe_snapshot_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('target_calories_per_person', sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column('scaling_factor', sa.Numeric(precision=10, scale=4), server_default='1.0000', nullable=True),
        sa.Column('rating', sa.Integer(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.CheckConstraint('rating >= 1 AND rating <= 5', name='trip_meals_rating_check'),
        sa.ForeignKeyConstraint(['recipe_id'], ['recipe_recipes.id']),
        sa.ForeignKeyConstraint(['recipe_snapshot_id'], ['trip_recipe_snapshots.id']),
        sa.ForeignKeyConstraint(['trip_day_id'], ['trip_days.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('trip_day_id', 'meal_slot')
    )
    
    # Create indexes for trip tables
    op.create_index('idx_trips_user', 'trip_trips', ['user_id'], postgresql_where=sa.text('NOT is_archived'))
    op.create_index('idx_trips_dates', 'trip_trips', ['start_date', 'end_date'], postgresql_where=sa.text('NOT is_archived'))
    op.create_index('idx_trip_participants_trip', 'trip_participants', ['trip_id'])
    op.create_index('idx_trip_days_trip', 'trip_days', ['trip_id'])
    op.create_index('idx_trip_days_date', 'trip_days', ['date'])
    op.create_index('idx_trip_meals_day', 'trip_meals', ['trip_day_id'])
    op.create_index('idx_trip_meals_snapshot', 'trip_meals', ['recipe_snapshot_id'])
    
    # =====================================================
    # Admin Module (admin_*)
    # =====================================================
    
    # Create admin_permissions table
    op.create_table('admin_permissions',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('code', sa.String(100), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.String(500), nullable=True),
        sa.Column('category', sa.String(50), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('code'),
        sa.CheckConstraint(
            "category IN ('users', 'roles', 'content', 'recipes', 'ingredients', 'moderation', 'analytics', 'system', 'audit', 'settings')",
            name='check_permission_category'
        )
    )
    
    # Create admin_roles table
    op.create_table('admin_roles',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('code', sa.String(50), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.String(500), nullable=True),
        sa.Column('parent_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('priority', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('is_system', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('max_users', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.ForeignKeyConstraint(['parent_id'], ['admin_roles.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['created_by'], ['auth_users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('code')
    )
    
    # Create admin_role_permissions association table
    op.create_table('admin_role_permissions',
        sa.Column('role_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('permission_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.ForeignKeyConstraint(['role_id'], ['admin_roles.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['permission_id'], ['admin_permissions.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('role_id', 'permission_id')
    )
    
    # Create admin_user_roles association table
    op.create_table('admin_user_roles',
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('role_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('assigned_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('assigned_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['auth_users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['role_id'], ['admin_roles.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['assigned_by'], ['auth_users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('user_id', 'role_id')
    )
    
    # Create admin_user_role_assignments table (detailed tracking)
    op.create_table('admin_user_role_assignments',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('role_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('assigned_by', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('assigned_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('reason', sa.String(500), nullable=True),
        sa.Column('revoked_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('revoked_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('revoke_reason', sa.String(500), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.ForeignKeyConstraint(['user_id'], ['auth_users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['role_id'], ['admin_roles.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['assigned_by'], ['auth_users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['revoked_by'], ['auth_users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create admin_permission_delegations table
    op.create_table('admin_permission_delegations',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('delegator_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('delegate_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('permissions', postgresql.JSON(), nullable=False),
        sa.Column('starts_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('reason', sa.String(500), nullable=False),
        sa.Column('revoked_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('revoke_reason', sa.String(500), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.ForeignKeyConstraint(['delegator_id'], ['auth_users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['delegate_id'], ['auth_users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.CheckConstraint('delegator_id != delegate_id', name='check_different_users'),
        sa.CheckConstraint('expires_at > starts_at', name='check_valid_period')
    )
    
    # Create indexes for admin tables
    op.create_index('idx_admin_permissions_code', 'admin_permissions', ['code'])
    op.create_index('idx_admin_permissions_category', 'admin_permissions', ['category'])
    op.create_index('idx_admin_roles_code', 'admin_roles', ['code'])
    op.create_index('idx_role_permissions_role_id', 'admin_role_permissions', ['role_id'])
    op.create_index('idx_role_permissions_permission_id', 'admin_role_permissions', ['permission_id'])
    op.create_index('idx_user_roles_user_id', 'admin_user_roles', ['user_id'])
    op.create_index('idx_user_roles_role_id', 'admin_user_roles', ['role_id'])
    op.create_index('idx_user_roles_expires_at', 'admin_user_roles', ['expires_at'])
    op.create_index('idx_user_role_assignments_user_id', 'admin_user_role_assignments', ['user_id'])
    op.create_index('idx_user_role_assignments_role_id', 'admin_user_role_assignments', ['role_id'])
    op.create_index('idx_user_role_assignments_is_active', 'admin_user_role_assignments', ['is_active'])
    op.create_index('idx_user_role_assignments_valid', 'admin_user_role_assignments', ['user_id', 'role_id'], 
                    unique=True, postgresql_where=sa.text('is_active = true AND revoked_at IS NULL'))
    op.create_index('idx_permission_delegations_delegator_id', 'admin_permission_delegations', ['delegator_id'])
    op.create_index('idx_permission_delegations_delegate_id', 'admin_permission_delegations', ['delegate_id'])
    op.create_index('idx_permission_delegations_expires_at', 'admin_permission_delegations', ['expires_at'])
    
    # =====================================================
    # Core Module (core_*)
    # =====================================================
    
    # Create core_jobs table
    op.create_table('core_jobs',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('job_type', sa.String(length=50), nullable=False),
        sa.Column('status', sa.String(length=20), server_default='pending', nullable=False),
        sa.Column('payload', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('result', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('error', sa.Text(), nullable=True),
        sa.Column('attempts', sa.Integer(), server_default='0', nullable=False),
        sa.Column('max_attempts', sa.Integer(), server_default='3', nullable=False),
        sa.Column('priority', sa.Integer(), server_default='0', nullable=False),
        sa.Column('scheduled_at', sa.TIMESTAMP(), nullable=True),
        sa.Column('started_at', sa.TIMESTAMP(), nullable=True),
        sa.Column('completed_at', sa.TIMESTAMP(), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.TIMESTAMP(), server_default=sa.text('now()'), nullable=False),
        sa.CheckConstraint("status IN ('pending', 'running', 'completed', 'failed', 'cancelled')", name='core_jobs_status_check'),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create core_cleanup_policies table
    op.create_table('core_cleanup_policies',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('table_name', sa.String(length=100), nullable=False),
        sa.Column('retention_days', sa.Integer(), nullable=False),
        sa.Column('is_active', sa.Boolean(), server_default=sa.text('true'), nullable=False),
        sa.Column('last_run', sa.TIMESTAMP(), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.TIMESTAMP(), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('table_name')
    )
    
    # Create core_monitoring table
    op.create_table('core_monitoring',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('metric_name', sa.String(length=100), nullable=False),
        sa.Column('metric_value', sa.Numeric(precision=20, scale=4), nullable=False),
        sa.Column('metric_unit', sa.String(length=20), nullable=True),
        sa.Column('tags', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create indexes for core tables
    op.create_index('idx_core_jobs_status', 'core_jobs', ['status'])
    op.create_index('idx_core_jobs_type', 'core_jobs', ['job_type'])
    op.create_index('idx_core_jobs_scheduled', 'core_jobs', ['scheduled_at'], postgresql_where=sa.text("status = 'pending'"))
    op.create_index('idx_core_cleanup_policies_active', 'core_cleanup_policies', ['is_active'])
    op.create_index('idx_core_monitoring_metric', 'core_monitoring', ['metric_name'])
    op.create_index('idx_core_monitoring_created', 'core_monitoring', ['created_at'])
    
    # =====================================================
    # Sharing Module (sharing_*)
    # =====================================================
    
    # Create sharing_reviews table
    op.create_table('sharing_reviews',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('recipe_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('rating', sa.Integer(), nullable=False),
        sa.Column('review_text', sa.Text(), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.TIMESTAMP(), server_default=sa.text('now()'), nullable=True),
        sa.CheckConstraint('rating >= 1 AND rating <= 5', name='sharing_reviews_rating_check'),
        sa.CheckConstraint('LENGTH(review_text) <= 1000', name='sharing_reviews_review_text_check'),
        sa.ForeignKeyConstraint(['recipe_id'], ['recipe_recipes.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['auth_users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('recipe_id', 'user_id')
    )
    
    # Create sharing_forks table
    op.create_table('sharing_forks',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('original_recipe_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('forked_recipe_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('forked_by', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('forked_at', sa.TIMESTAMP(), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['forked_by'], ['auth_users.id']),
        sa.ForeignKeyConstraint(['forked_recipe_id'], ['recipe_recipes.id']),
        sa.ForeignKeyConstraint(['original_recipe_id'], ['recipe_recipes.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('forked_recipe_id')
    )
    
    # Create indexes for sharing tables
    op.create_index('idx_reviews_recipe', 'sharing_reviews', ['recipe_id'])
    op.create_index('idx_reviews_user', 'sharing_reviews', ['user_id'])
    op.create_index('idx_reviews_rating', 'sharing_reviews', ['rating'])
    op.create_index('idx_forks_original', 'sharing_forks', ['original_recipe_id'])
    op.create_index('idx_forks_user', 'sharing_forks', ['forked_by'])
    
    # =====================================================
    # Audit Module (audit_*)
    # =====================================================
    
    # Create audit_log table
    op.create_table('audit_log',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('action', sa.String(length=50), nullable=False),
        sa.Column('entity_type', sa.String(length=50), nullable=False),
        sa.Column('entity_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('changes', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('ip_address', postgresql.INET(), nullable=True),
        sa.Column('user_agent', sa.Text(), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['auth_users.id']),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create indexes for audit
    op.create_index('idx_audit_log_user', 'audit_log', ['user_id'])
    op.create_index('idx_audit_log_entity', 'audit_log', ['entity_type', 'entity_id'])
    op.create_index('idx_audit_log_created', 'audit_log', ['created_at'])
    
    # =====================================================
    # Text Search Indexes
    # =====================================================
    
    # Recipe name search
    op.create_index('idx_recipe_name_search', 'recipe_recipes', [sa.text("to_tsvector('simple', name)")], 
                    postgresql_using='gin', postgresql_where=sa.text('NOT is_archived'))
    
    # Ingredient name search
    op.create_index('idx_ingredient_name_search', 'common_ingredients', [sa.text("to_tsvector('simple', name)")], 
                    postgresql_using='gin')
    
    # Recipe instructions search
    op.create_index('idx_recipe_instructions_search', 'recipe_recipes', 
                    [sa.text("to_tsvector('simple', COALESCE(instructions, ''))")], 
                    postgresql_using='gin', postgresql_where=sa.text('NOT is_archived'))
    
    # Category name search
    op.create_index('idx_category_name_search', 'recipe_categories', 
                    [sa.text("to_tsvector('simple', name)")], 
                    postgresql_using='gin')
    
    # Tag name search
    op.create_index('idx_tag_name_search', 'recipe_tags', 
                    [sa.text("to_tsvector('simple', name)")], 
                    postgresql_using='gin')
    
    # =====================================================
    # Functions and Triggers
    # =====================================================
    
    # Create function to update tag usage count
    op.execute("""
        CREATE OR REPLACE FUNCTION update_tag_usage_count()
        RETURNS TRIGGER AS $$
        BEGIN
            IF TG_OP = 'INSERT' THEN
                UPDATE recipe_tags 
                SET usage_count = usage_count + 1 
                WHERE id = NEW.tag_id;
            ELSIF TG_OP = 'DELETE' THEN
                UPDATE recipe_tags 
                SET usage_count = GREATEST(usage_count - 1, 0) 
                WHERE id = OLD.tag_id;
            END IF;
            RETURN NULL;
        END;
        $$ LANGUAGE plpgsql;
    """)
    
    # Create trigger for tag usage count
    op.execute("""
        CREATE TRIGGER trigger_update_tag_usage_count
        AFTER INSERT OR DELETE ON recipe_recipe_tags
        FOR EACH ROW
        EXECUTE FUNCTION update_tag_usage_count();
    """)
    
    # Create function to validate category hierarchy (prevent circular references)
    op.execute("""
        CREATE OR REPLACE FUNCTION check_category_hierarchy()
        RETURNS TRIGGER AS $$
        DECLARE
            parent_check UUID;
        BEGIN
            IF NEW.parent_id IS NULL THEN
                RETURN NEW;
            END IF;
            
            -- Check for self-reference
            IF NEW.id = NEW.parent_id THEN
                RAISE EXCEPTION 'Category cannot be its own parent';
            END IF;
            
            -- Check for circular reference
            parent_check := NEW.parent_id;
            WHILE parent_check IS NOT NULL LOOP
                SELECT parent_id INTO parent_check
                FROM recipe_categories
                WHERE id = parent_check;
                
                IF parent_check = NEW.id THEN
                    RAISE EXCEPTION 'Circular reference detected in category hierarchy';
                END IF;
            END LOOP;
            
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)
    
    # Create trigger for category hierarchy validation
    op.execute("""
        CREATE TRIGGER trigger_check_category_hierarchy
        BEFORE INSERT OR UPDATE OF parent_id ON recipe_categories
        FOR EACH ROW
        EXECUTE FUNCTION check_category_hierarchy();
    """)
    
    # Create function to ensure only one primary category per recipe
    op.execute("""
        CREATE OR REPLACE FUNCTION ensure_single_primary_category()
        RETURNS TRIGGER AS $$
        BEGIN
            IF NEW.is_primary = TRUE THEN
                UPDATE recipe_recipe_categories 
                SET is_primary = FALSE 
                WHERE recipe_id = NEW.recipe_id 
                AND category_id != NEW.category_id;
            END IF;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)
    
    # Create trigger for primary category enforcement
    op.execute("""
        CREATE TRIGGER trigger_ensure_single_primary_category
        AFTER INSERT OR UPDATE OF is_primary ON recipe_recipe_categories
        FOR EACH ROW
        WHEN (NEW.is_primary = TRUE)
        EXECUTE FUNCTION ensure_single_primary_category();
    """)
    
    # Create function to update timestamps
    op.execute("""
        CREATE OR REPLACE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = CURRENT_TIMESTAMP;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)
    
    # Apply update timestamp triggers to relevant tables
    for table in ['auth_users', 'common_ingredients', 'common_snacks', 'recipe_recipes', 
                  'recipe_categories', 'recipe_images', 'trip_trips', 'admin_permissions', 
                  'admin_roles', 'core_jobs', 'core_cleanup_policies']:
        op.execute(f"""
            CREATE TRIGGER update_{table}_updated_at 
            BEFORE UPDATE ON {table}
            FOR EACH ROW 
            EXECUTE FUNCTION update_updated_at_column();
        """)


def downgrade() -> None:
    """Drop all tables in reverse order."""
    
    # Drop triggers first
    op.execute("DROP TRIGGER IF EXISTS trigger_ensure_single_primary_category ON recipe_recipe_categories")
    op.execute("DROP TRIGGER IF EXISTS trigger_check_category_hierarchy ON recipe_categories")
    op.execute("DROP TRIGGER IF EXISTS trigger_update_tag_usage_count ON recipe_recipe_tags")
    
    # Drop update timestamp triggers
    for table in ['auth_users', 'common_ingredients', 'common_snacks', 'recipe_recipes', 
                  'recipe_categories', 'recipe_images', 'trip_trips', 'admin_permissions', 
                  'admin_roles', 'core_jobs', 'core_cleanup_policies']:
        op.execute(f"DROP TRIGGER IF EXISTS update_{table}_updated_at ON {table}")
    
    # Drop functions
    op.execute("DROP FUNCTION IF EXISTS update_updated_at_column()")
    op.execute("DROP FUNCTION IF EXISTS ensure_single_primary_category()")
    op.execute("DROP FUNCTION IF EXISTS check_category_hierarchy()")
    op.execute("DROP FUNCTION IF EXISTS update_tag_usage_count()")
    
    # Drop text search indexes
    op.drop_index('idx_tag_name_search', table_name='recipe_tags')
    op.drop_index('idx_category_name_search', table_name='recipe_categories')
    op.drop_index('idx_recipe_instructions_search', table_name='recipe_recipes')
    op.drop_index('idx_ingredient_name_search', table_name='common_ingredients')
    op.drop_index('idx_recipe_name_search', table_name='recipe_recipes')
    
    # Drop tables in reverse order of creation (respecting foreign keys)
    op.drop_table('audit_log')
    op.drop_table('sharing_forks')
    op.drop_table('sharing_reviews')
    op.drop_table('core_monitoring')
    op.drop_table('core_cleanup_policies')
    op.drop_table('core_jobs')
    op.drop_table('admin_permission_delegations')
    op.drop_table('admin_user_role_assignments')
    op.drop_table('admin_user_roles')
    op.drop_table('admin_role_permissions')
    op.drop_table('admin_roles')
    op.drop_table('admin_permissions')
    op.drop_table('trip_meals')
    op.drop_table('trip_recipe_snapshots')
    op.drop_table('trip_days')
    op.drop_table('trip_participants')
    op.drop_table('trip_trips')
    op.drop_table('recipe_recipe_tags')
    op.drop_table('recipe_recipe_categories')
    op.drop_table('recipe_tags')
    op.drop_table('recipe_categories')
    op.drop_table('recipe_images')
    op.drop_table('recipe_recipe_ingredients')
    op.drop_table('recipe_recipes')
    op.drop_table('common_snacks')
    op.drop_table('common_ingredients')
    op.drop_table('auth_password_resets')
    op.drop_table('auth_email_verifications')
    op.drop_table('auth_tokens')
    op.drop_table('auth_sessions')
    op.drop_table('auth_users')