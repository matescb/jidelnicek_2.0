"""Add performance indexes

This migration adds comprehensive database indexes for optimal query performance.
It includes indexes for:
- Recipe search (full-text, trigram)
- Ingredient lookups
- Nutritional data filtering
- Category/tag filtering
- User queries
- Timestamp-based sorting

Required PostgreSQL extensions:
- pg_trgm (for trigram search indexes)

Revision ID: 004_add_performance_indexes
Revises: 003_add_recipe_versions
Create Date: 2025-07-09 11:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '004_add_performance_indexes'
down_revision = '003_add_recipe_versions'
branch_labels = None
depends_on = None


def upgrade():
    """Add comprehensive performance indexes.
    
    Note: This migration requires the following PostgreSQL extensions:
    - pg_trgm (for trigram indexes)
    These are installed in the database initialization script.
    """
    
    # Install required PostgreSQL extensions if not already installed
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm;")
    
    # =====================================================
    # Recipe Search and Filter Indexes
    # =====================================================
    
    # Recipe full-text search indexes (GIN for performance)
    op.create_index(
        'idx_recipe_fulltext_search',
        'recipe_recipes',
        [sa.text("to_tsvector('simple', name || ' ' || COALESCE(description, '') || ' ' || COALESCE(instructions, ''))")],
        postgresql_using='gin',
        postgresql_where=sa.text('NOT is_archived')
    )
    
    # Recipe name and description search with trigram support
    op.create_index(
        'idx_recipe_name_trgm',
        'recipe_recipes',
        [sa.text("name gin_trgm_ops")],
        postgresql_using='gin',
        postgresql_where=sa.text('NOT is_archived')
    )
    
    op.create_index(
        'idx_recipe_description_trgm',
        'recipe_recipes',
        [sa.text("description gin_trgm_ops")],
        postgresql_using='gin',
        postgresql_where=sa.text('NOT is_archived AND description IS NOT NULL')
    )
    
    # Recipe status and visibility performance indexes
    op.create_index(
        'idx_recipe_status_composite',
        'recipe_recipes',
        ['is_published', 'is_public', 'is_archived'],
        postgresql_where=sa.text('NOT is_archived')
    )
    
    # Recipe timing indexes for filtering
    op.create_index(
        'idx_recipe_prep_time',
        'recipe_recipes',
        ['prep_time_minutes'],
        postgresql_where=sa.text('NOT is_archived AND prep_time_minutes IS NOT NULL')
    )
    
    op.create_index(
        'idx_recipe_cook_time',
        'recipe_recipes',
        ['cook_time_minutes'],
        postgresql_where=sa.text('NOT is_archived AND cook_time_minutes IS NOT NULL')
    )
    
    op.create_index(
        'idx_recipe_total_time',
        'recipe_recipes',
        [sa.text('(COALESCE(prep_time_minutes, 0) + COALESCE(cook_time_minutes, 0))')],
        postgresql_where=sa.text('NOT is_archived AND (prep_time_minutes IS NOT NULL OR cook_time_minutes IS NOT NULL)')
    )
    
    # Recipe servings index
    op.create_index(
        'idx_recipe_servings',
        'recipe_recipes',
        ['servings'],
        postgresql_where=sa.text('NOT is_archived AND servings IS NOT NULL')
    )
    
    # Recipe fork count index for popular recipes
    op.create_index(
        'idx_recipe_fork_count',
        'recipe_recipes',
        ['fork_count'],
        postgresql_where=sa.text('NOT is_archived AND fork_count > 0')
    )
    
    # Recipe published date for sorting
    op.create_index(
        'idx_recipe_published_at',
        'recipe_recipes',
        ['published_at'],
        postgresql_where=sa.text('is_published AND NOT is_archived')
    )
    
    # Recipe updated/created timestamp indexes for sorting
    op.create_index(
        'idx_recipe_updated_at',
        'recipe_recipes',
        ['updated_at'],
        postgresql_where=sa.text('NOT is_archived')
    )
    
    op.create_index(
        'idx_recipe_created_at',
        'recipe_recipes',
        ['created_at'],
        postgresql_where=sa.text('NOT is_archived')
    )
    
    # =====================================================
    # Ingredient Search and Filter Indexes
    # =====================================================
    
    # Ingredient full-text search with trigram support
    op.create_index(
        'idx_ingredient_name_trgm',
        'common_ingredients',
        [sa.text("name gin_trgm_ops")],
        postgresql_using='gin',
        postgresql_where=sa.text('NOT is_archived')
    )
    
    # Ingredient category index
    op.create_index(
        'idx_ingredient_category',
        'common_ingredients',
        ['category'],
        postgresql_where=sa.text('NOT is_archived AND category IS NOT NULL')
    )
    
    # Ingredient global/user filtering
    op.create_index(
        'idx_ingredient_user_global',
        'common_ingredients',
        ['user_id', 'is_global'],
        postgresql_where=sa.text('NOT is_archived')
    )
    
    # =====================================================
    # Nutritional Data Indexes
    # =====================================================
    
    # Nutritional value indexes for filtering and sorting
    op.create_index(
        'idx_nutrition_calories',
        'common_nutritional_values',
        ['calories']
    )
    
    op.create_index(
        'idx_nutrition_macros',
        'common_nutritional_values',
        ['proteins_g', 'carbohydrates_g', 'fats_g']
    )
    
    op.create_index(
        'idx_nutrition_phe',
        'common_nutritional_values',
        ['phe_mg'],
        postgresql_where=sa.text('phe_mg IS NOT NULL')
    )
    
    op.create_index(
        'idx_nutrition_fiber',
        'common_nutritional_values',
        ['fiber_g'],
        postgresql_where=sa.text('fiber_g IS NOT NULL')
    )
    
    op.create_index(
        'idx_nutrition_sodium',
        'common_nutritional_values',
        ['sodium_mg'],
        postgresql_where=sa.text('sodium_mg IS NOT NULL')
    )
    
    # =====================================================
    # Category and Tag Performance Indexes
    # =====================================================
    
    # Category hierarchy performance
    op.create_index(
        'idx_category_hierarchy',
        'recipe_categories',
        ['parent_id', 'display_order']
    )
    
    # Tag name with trigram support
    op.create_index(
        'idx_tag_name_trgm',
        'recipe_tags',
        [sa.text("name gin_trgm_ops")],
        postgresql_using='gin'
    )
    
    # Tag usage count for popular tags
    op.create_index(
        'idx_tag_usage_desc',
        'recipe_tags',
        [sa.text('usage_count DESC')],
        postgresql_where=sa.text('usage_count > 0')
    )
    
    # =====================================================
    # User Performance Indexes
    # =====================================================
    
    # User active status
    op.create_index(
        'idx_user_active',
        'auth_users',
        ['is_archived', 'role'],
        postgresql_where=sa.text('NOT is_archived')
    )
    
    # User email verification
    op.create_index(
        'idx_user_verified',
        'auth_users',
        ['email_verified'],
        postgresql_where=sa.text('email_verified = true')
    )
    
    # User last login for activity tracking
    op.create_index(
        'idx_user_last_login',
        'auth_users',
        ['last_login'],
        postgresql_where=sa.text('last_login IS NOT NULL')
    )
    
    # User recipe count for statistics
    op.create_index(
        'idx_user_recipe_count',
        'auth_users',
        ['recipe_count'],
        postgresql_where=sa.text('recipe_count > 0')
    )
    
    # =====================================================
    # Composite Indexes for Common Query Patterns
    # =====================================================
    
    # Recipe + user queries (user's recipes)
    op.create_index(
        'idx_recipe_user_status',
        'recipe_recipes',
        ['user_id', 'is_archived', 'updated_at'],
        postgresql_where=sa.text('NOT is_archived')
    )
    
    # Recipe + category queries (category filtering)
    op.create_index(
        'idx_recipe_category_composite',
        'recipe_recipe_categories',
        ['category_id', 'is_primary']
    )
    
    # Recipe + tag queries (tag filtering)
    op.create_index(
        'idx_recipe_tag_composite',
        'recipe_recipe_tags',
        ['tag_id', 'tagged_at']
    )
    
    # Recipe + ingredient queries (ingredient usage)
    op.create_index(
        'idx_recipe_ingredient_composite',
        'recipe_recipe_ingredients',
        ['ingredient_id', 'display_order']
    )
    
    # Recipe + nutritional queries (recipes with nutritional data)
    op.create_index(
        'idx_recipe_nutrition_composite',
        'recipe_recipes',
        ['user_id', 'is_published'],
        postgresql_where=sa.text('NOT is_archived')
    )
    
    # Search + filter combinations (public recipes by category)
    op.create_index(
        'idx_recipe_public_category',
        'recipe_recipes',
        ['is_published', 'is_public', 'updated_at'],
        postgresql_where=sa.text('is_published AND is_public AND NOT is_archived')
    )
    
    # =====================================================
    # Session and Authentication Performance Indexes
    # =====================================================
    
    # Session cleanup and lookup
    op.create_index(
        'idx_session_cleanup',
        'auth_sessions',
        ['expires_at', 'last_accessed']
    )
    
    # Token validation
    op.create_index(
        'idx_token_active',
        'auth_tokens',
        ['is_active', 'expires_at'],
        postgresql_where=sa.text('is_active = true')
    )
    
    # =====================================================
    # Review and Rating Indexes
    # =====================================================
    
    # Recipe rating aggregation
    op.create_index(
        'idx_review_rating_composite',
        'sharing_reviews',
        ['recipe_id', 'rating', 'created_at']
    )
    
    # User review history
    op.create_index(
        'idx_review_user_composite',
        'sharing_reviews',
        ['user_id', 'created_at']
    )
    
    # =====================================================
    # Audit Log Performance Indexes
    # =====================================================
    
    # Audit log cleanup and querying
    op.create_index(
        'idx_audit_cleanup',
        'audit_log',
        ['created_at', 'action']
    )
    
    # Audit log entity tracking
    op.create_index(
        'idx_audit_entity_action',
        'audit_log',
        ['entity_type', 'entity_id', 'action', 'created_at']
    )
    
    # =====================================================
    # Trip Planning Performance Indexes
    # =====================================================
    
    # Trip date range queries
    op.create_index(
        'idx_trip_date_range',
        'trip_trips',
        ['start_date', 'end_date'],
        postgresql_where=sa.text('NOT is_archived')
    )
    
    # Trip meal planning
    op.create_index(
        'idx_trip_meal_composite',
        'trip_meals',
        ['trip_day_id', 'meal_slot', 'recipe_snapshot_id']
    )
    
    # Trip participant queries
    op.create_index(
        'idx_trip_participant_composite',
        'trip_participants',
        ['trip_id', 'coefficient']
    )
    
    # =====================================================
    # Snack Management Indexes
    # =====================================================
    
    # Snack name search with trigram support
    op.create_index(
        'idx_snack_name_trgm',
        'common_snacks',
        [sa.text("name gin_trgm_ops")],
        postgresql_using='gin',
        postgresql_where=sa.text('NOT is_archived')
    )
    
    # Snack user filtering
    op.create_index(
        'idx_snack_user_global',
        'common_snacks',
        ['user_id', 'is_global'],
        postgresql_where=sa.text('NOT is_archived')
    )
    
    # =====================================================
    # Recipe Versions Performance Indexes
    # =====================================================
    
    # Recipe version history
    op.create_index(
        'idx_recipe_version_history',
        'recipe_versions',
        ['recipe_id', 'version_number', 'changed_at']
    )
    
    # Recipe version changes by type
    op.create_index(
        'idx_recipe_version_changes',
        'recipe_versions',
        ['change_type', 'changed_at']
    )
    
    # User recipe changes
    op.create_index(
        'idx_recipe_version_user',
        'recipe_versions',
        ['changed_by', 'changed_at'],
        postgresql_where=sa.text('changed_by IS NOT NULL')
    )


def downgrade():
    """Remove performance indexes."""
    
    # Recipe version indexes
    op.drop_index('idx_recipe_version_user', table_name='recipe_versions')
    op.drop_index('idx_recipe_version_changes', table_name='recipe_versions')
    op.drop_index('idx_recipe_version_history', table_name='recipe_versions')
    
    # Snack indexes
    op.drop_index('idx_snack_user_global', table_name='common_snacks')
    op.drop_index('idx_snack_name_trgm', table_name='common_snacks')
    
    # Trip indexes
    op.drop_index('idx_trip_participant_composite', table_name='trip_participants')
    op.drop_index('idx_trip_meal_composite', table_name='trip_meals')
    op.drop_index('idx_trip_date_range', table_name='trip_trips')
    
    # Audit log indexes
    op.drop_index('idx_audit_entity_action', table_name='audit_log')
    op.drop_index('idx_audit_cleanup', table_name='audit_log')
    
    # Review indexes
    op.drop_index('idx_review_user_composite', table_name='sharing_reviews')
    op.drop_index('idx_review_rating_composite', table_name='sharing_reviews')
    
    # Authentication indexes
    op.drop_index('idx_token_active', table_name='auth_tokens')
    op.drop_index('idx_session_cleanup', table_name='auth_sessions')
    
    # Composite indexes
    op.drop_index('idx_recipe_public_category', table_name='recipe_recipes')
    op.drop_index('idx_recipe_nutrition_composite', table_name='recipe_recipes')
    op.drop_index('idx_recipe_ingredient_composite', table_name='recipe_recipe_ingredients')
    op.drop_index('idx_recipe_tag_composite', table_name='recipe_recipe_tags')
    op.drop_index('idx_recipe_category_composite', table_name='recipe_recipe_categories')
    op.drop_index('idx_recipe_user_status', table_name='recipe_recipes')
    
    # User indexes
    op.drop_index('idx_user_recipe_count', table_name='auth_users')
    op.drop_index('idx_user_last_login', table_name='auth_users')
    op.drop_index('idx_user_verified', table_name='auth_users')
    op.drop_index('idx_user_active', table_name='auth_users')
    
    # Category and tag indexes
    op.drop_index('idx_tag_usage_desc', table_name='recipe_tags')
    op.drop_index('idx_tag_name_trgm', table_name='recipe_tags')
    op.drop_index('idx_category_hierarchy', table_name='recipe_categories')
    
    # Nutritional indexes
    op.drop_index('idx_nutrition_sodium', table_name='common_nutritional_values')
    op.drop_index('idx_nutrition_fiber', table_name='common_nutritional_values')
    op.drop_index('idx_nutrition_phe', table_name='common_nutritional_values')
    op.drop_index('idx_nutrition_macros', table_name='common_nutritional_values')
    op.drop_index('idx_nutrition_calories', table_name='common_nutritional_values')
    
    # Ingredient indexes
    op.drop_index('idx_ingredient_user_global', table_name='common_ingredients')
    op.drop_index('idx_ingredient_category', table_name='common_ingredients')
    op.drop_index('idx_ingredient_name_trgm', table_name='common_ingredients')
    
    # Recipe indexes
    op.drop_index('idx_recipe_created_at', table_name='recipe_recipes')
    op.drop_index('idx_recipe_updated_at', table_name='recipe_recipes')
    op.drop_index('idx_recipe_published_at', table_name='recipe_recipes')
    op.drop_index('idx_recipe_fork_count', table_name='recipe_recipes')
    op.drop_index('idx_recipe_servings', table_name='recipe_recipes')
    op.drop_index('idx_recipe_total_time', table_name='recipe_recipes')
    op.drop_index('idx_recipe_cook_time', table_name='recipe_recipes')
    op.drop_index('idx_recipe_prep_time', table_name='recipe_recipes')
    op.drop_index('idx_recipe_status_composite', table_name='recipe_recipes')
    op.drop_index('idx_recipe_description_trgm', table_name='recipe_recipes')
    op.drop_index('idx_recipe_name_trgm', table_name='recipe_recipes')
    op.drop_index('idx_recipe_fulltext_search', table_name='recipe_recipes')