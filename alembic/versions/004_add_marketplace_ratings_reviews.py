"""Add marketplace ratings and reviews tables

Revision ID: 004_add_marketplace_ratings_reviews
Revises: 003_add_share_links_table
Create Date: 2025-01-13

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '004_add_marketplace_ratings_reviews'
down_revision = '003_add_share_links_table'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create recipe_ratings table
    op.create_table(
        'recipe_ratings',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text('gen_random_uuid()')),
        sa.Column('recipe_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('rating', sa.Integer(), nullable=False, comment='Rating value from 1 to 5'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['recipe_id'], ['recipe_recipes.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['auth_users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('recipe_id', 'user_id', name='uq_recipe_ratings_recipe_user'),
        sa.CheckConstraint('rating >= 1 AND rating <= 5', name='recipe_ratings_rating_check')
    )
    
    # Create indexes for recipe_ratings
    op.create_index('idx_recipe_ratings_recipe', 'recipe_ratings', ['recipe_id'])
    op.create_index('idx_recipe_ratings_user', 'recipe_ratings', ['user_id'])
    op.create_index('idx_recipe_ratings_rating', 'recipe_ratings', ['rating'])
    
    # Create recipe_reviews table
    op.create_table(
        'recipe_reviews',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text('gen_random_uuid()')),
        sa.Column('recipe_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('review_text', sa.Text(), nullable=False, comment='Review text content, max 2000 characters'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['recipe_id'], ['recipe_recipes.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['auth_users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('recipe_id', 'user_id', name='uq_recipe_reviews_recipe_user'),
        sa.CheckConstraint('LENGTH(review_text) <= 2000', name='recipe_reviews_text_length_check'),
        sa.CheckConstraint('LENGTH(TRIM(review_text)) > 0', name='recipe_reviews_text_not_empty')
    )
    
    # Create indexes for recipe_reviews
    op.create_index('idx_recipe_reviews_recipe', 'recipe_reviews', ['recipe_id'])
    op.create_index('idx_recipe_reviews_user', 'recipe_reviews', ['user_id'])
    op.create_index('idx_recipe_reviews_created', 'recipe_reviews', ['created_at'])

    # Add aggregate rating columns to recipe_recipes (referenced by the trigger below)
    op.add_column('recipe_recipes', sa.Column('rating_average', sa.Numeric(4, 2), nullable=True))
    op.add_column('recipe_recipes', sa.Column('rating_count', sa.Integer(), server_default='0', nullable=False))

    # Create a function to update recipe rating statistics
    op.execute("""
        CREATE OR REPLACE FUNCTION update_recipe_rating_stats()
        RETURNS TRIGGER AS $$
        BEGIN
            -- Update rating statistics for the recipe
            UPDATE recipe_recipes
            SET 
                rating_average = (
                    SELECT ROUND(AVG(rating)::numeric, 2)
                    FROM recipe_ratings
                    WHERE recipe_id = COALESCE(NEW.recipe_id, OLD.recipe_id)
                ),
                rating_count = (
                    SELECT COUNT(*)
                    FROM recipe_ratings
                    WHERE recipe_id = COALESCE(NEW.recipe_id, OLD.recipe_id)
                ),
                updated_at = now()
            WHERE id = COALESCE(NEW.recipe_id, OLD.recipe_id);
            
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)
    
    # Create triggers to automatically update rating statistics
    op.execute("""
        CREATE TRIGGER update_recipe_rating_on_insert
        AFTER INSERT ON recipe_ratings
        FOR EACH ROW
        EXECUTE FUNCTION update_recipe_rating_stats();
    """)
    
    op.execute("""
        CREATE TRIGGER update_recipe_rating_on_update
        AFTER UPDATE ON recipe_ratings
        FOR EACH ROW
        EXECUTE FUNCTION update_recipe_rating_stats();
    """)
    
    op.execute("""
        CREATE TRIGGER update_recipe_rating_on_delete
        AFTER DELETE ON recipe_ratings
        FOR EACH ROW
        EXECUTE FUNCTION update_recipe_rating_stats();
    """)


def downgrade() -> None:
    # Drop triggers
    op.execute("DROP TRIGGER IF EXISTS update_recipe_rating_on_delete ON recipe_ratings")
    op.execute("DROP TRIGGER IF EXISTS update_recipe_rating_on_update ON recipe_ratings")
    op.execute("DROP TRIGGER IF EXISTS update_recipe_rating_on_insert ON recipe_ratings")
    
    # Drop function
    op.execute("DROP FUNCTION IF EXISTS update_recipe_rating_stats()")

    # Drop aggregate rating columns from recipe_recipes (added in upgrade for the trigger)
    op.drop_column('recipe_recipes', 'rating_count')
    op.drop_column('recipe_recipes', 'rating_average')

    # Drop indexes for recipe_reviews
    op.drop_index('idx_recipe_reviews_created', table_name='recipe_reviews')
    op.drop_index('idx_recipe_reviews_user', table_name='recipe_reviews')
    op.drop_index('idx_recipe_reviews_recipe', table_name='recipe_reviews')
    
    # Drop recipe_reviews table
    op.drop_table('recipe_reviews')
    
    # Drop indexes for recipe_ratings
    op.drop_index('idx_recipe_ratings_rating', table_name='recipe_ratings')
    op.drop_index('idx_recipe_ratings_user', table_name='recipe_ratings')
    op.drop_index('idx_recipe_ratings_recipe', table_name='recipe_ratings')
    
    # Drop recipe_ratings table
    op.drop_table('recipe_ratings')