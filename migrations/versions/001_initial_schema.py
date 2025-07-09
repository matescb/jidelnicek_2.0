"""Initial schema creation

Revision ID: 001
Revises: 
Create Date: 2025-01-08 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '001'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create initial schema."""
    
    # Create extensions (handled in init.sql)
    
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
    
    # Create indexes for auth tables
    op.create_index('idx_auth_users_email', 'auth_users', ['email'])
    op.create_index('idx_auth_users_archived', 'auth_users', ['is_archived'])
    op.create_index('idx_auth_sessions_token', 'auth_sessions', ['session_token'])
    op.create_index('idx_auth_sessions_user', 'auth_sessions', ['user_id'])
    op.create_index('idx_auth_sessions_expires', 'auth_sessions', ['expires_at'])
    op.create_index('idx_auth_tokens_hash', 'auth_tokens', ['token_hash'])
    op.create_index('idx_auth_tokens_user', 'auth_tokens', ['user_id'])
    
    # =====================================================
    # Common Module (common_*)
    # =====================================================
    
    # Create common_nutritional_values table
    op.create_table('common_nutritional_values',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('calories', sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column('proteins_g', sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column('carbohydrates_g', sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column('fats_g', sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column('sugars_g', sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column('saturated_fats_g', sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column('trans_fats_g', sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column('monounsaturated_fats_g', sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column('polyunsaturated_fats_g', sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column('cholesterol_mg', sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column('fiber_g', sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column('salt_g', sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column('calcium_mg', sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column('sodium_mg', sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column('water_g', sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column('phe_mg', sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column('vitamin_a_ug', sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column('vitamin_b1_mg', sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column('vitamin_b2_mg', sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column('vitamin_b3_mg', sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column('vitamin_b5_mg', sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column('vitamin_b6_mg', sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column('vitamin_b7_ug', sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column('vitamin_b9_ug', sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column('vitamin_b12_ug', sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column('vitamin_c_mg', sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column('vitamin_d_ug', sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column('vitamin_e_mg', sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column('vitamin_k_ug', sa.Numeric(precision=10, scale=2), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create common_ingredients table
    op.create_table('common_ingredients',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('category', sa.String(length=50), nullable=True),
        sa.Column('nutritional_value_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('is_global', sa.Boolean(), server_default=sa.text('false'), nullable=True),
        sa.Column('is_archived', sa.Boolean(), server_default=sa.text('false'), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.TIMESTAMP(), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['nutritional_value_id'], ['common_nutritional_values.id']),
        sa.ForeignKeyConstraint(['user_id'], ['auth_users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'name')
    )
    
    # Create common_snacks table
    op.create_table('common_snacks',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('measurement_type', sa.String(length=20), nullable=True),
        sa.Column('piece_weight_g', sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column('nutritional_value_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('is_global', sa.Boolean(), server_default=sa.text('false'), nullable=True),
        sa.Column('is_archived', sa.Boolean(), server_default=sa.text('false'), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.TIMESTAMP(), server_default=sa.text('now()'), nullable=True),
        sa.CheckConstraint("measurement_type IN ('piece', 'per_100g')", name='common_snacks_measurement_type_check'),
        sa.ForeignKeyConstraint(['nutritional_value_id'], ['common_nutritional_values.id']),
        sa.ForeignKeyConstraint(['user_id'], ['auth_users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'name')
    )
    
    # Create indexes for common tables
    op.create_index('idx_ingredients_user', 'common_ingredients', ['user_id'], postgresql_where=sa.text('NOT is_archived'))
    op.create_index('idx_ingredients_global', 'common_ingredients', ['is_global'], postgresql_where=sa.text('is_global AND NOT is_archived'))
    op.create_index('idx_ingredients_name', 'common_ingredients', ['name'])
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
    
    # Create indexes for recipe tables
    op.create_index('idx_recipes_user', 'recipe_recipes', ['user_id'], postgresql_where=sa.text('NOT is_archived'))
    op.create_index('idx_recipes_public', 'recipe_recipes', ['is_published'], postgresql_where=sa.text('is_published AND NOT is_archived'))
    op.create_index('idx_recipes_original', 'recipe_recipes', ['original_recipe_id'])
    op.create_index('idx_recipes_name', 'recipe_recipes', ['name'])
    op.create_index('idx_recipe_ingredients_recipe', 'recipe_recipe_ingredients', ['recipe_id'])
    op.create_index('idx_recipe_ingredients_ingredient', 'recipe_recipe_ingredients', ['ingredient_id'])
    
    # =====================================================
    # Trip Module (trip_*)
    # =====================================================
    
    # Create trip_trips table
    op.create_table('trip_trips',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('start_date', sa.Date(), nullable=False),
        sa.Column('end_date', sa.Date(), nullable=False),
        sa.Column('meal_slots', postgresql.JSONB(astext_type=sa.Text()), server_default='["Snídaně", "Oběd", "Večeře"]', nullable=True),
        sa.Column('is_archived', sa.Boolean(), server_default=sa.text('false'), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.TIMESTAMP(), server_default=sa.text('now()'), nullable=True),
        sa.CheckConstraint('end_date >= start_date', name='trip_trips_check'),
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
        sa.CheckConstraint('coefficient > 0', name='trip_participants_coefficient_check'),
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
        sa.Column('recipe_snapshot_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('target_calories_per_person', sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column('scaling_factor', sa.Numeric(precision=10, scale=4), server_default='1.0000', nullable=True),
        sa.Column('rating', sa.Integer(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.CheckConstraint('rating >= 1 AND rating <= 5', name='trip_meals_rating_check'),
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
    
    # Execute functions and triggers from 02_functions.sql
    # Note: In production, these would be loaded from the SQL file


def downgrade() -> None:
    """Drop all tables."""
    # Drop indexes first
    op.drop_index('idx_recipe_instructions_search', table_name='recipe_recipes')
    op.drop_index('idx_ingredient_name_search', table_name='common_ingredients')
    op.drop_index('idx_recipe_name_search', table_name='recipe_recipes')
    
    # Drop tables in reverse order of creation (respecting foreign keys)
    op.drop_table('audit_log')
    op.drop_table('sharing_forks')
    op.drop_table('sharing_reviews')
    op.drop_table('trip_meals')
    op.drop_table('trip_recipe_snapshots')
    op.drop_table('trip_days')
    op.drop_table('trip_participants')
    op.drop_table('trip_trips')
    op.drop_table('recipe_recipe_ingredients')
    op.drop_table('recipe_recipes')
    op.drop_table('common_snacks')
    op.drop_table('common_ingredients')
    op.drop_table('common_nutritional_values')
    op.drop_table('auth_tokens')
    op.drop_table('auth_sessions')
    op.drop_table('auth_users')