"""Add categories and tags system

Revision ID: 002
Revises: 001
Create Date: 2025-01-09 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '002'
down_revision = '001_initial_schema'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create categories and tags tables."""
    
    # =====================================================
    # Recipe Categories
    # =====================================================
    
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
    
    # =====================================================
    # Indexes for Performance
    # =====================================================
    
    # Category indexes
    op.create_index('idx_categories_slug', 'recipe_categories', ['slug'])
    op.create_index('idx_categories_parent', 'recipe_categories', ['parent_id'])
    op.create_index('idx_categories_order', 'recipe_categories', ['display_order'])
    
    # Tag indexes
    op.create_index('idx_tags_slug', 'recipe_tags', ['slug'])
    op.create_index('idx_tags_usage', 'recipe_tags', ['usage_count'], postgresql_where=sa.text('usage_count > 0'))
    op.create_index('idx_tags_name', 'recipe_tags', ['name'])
    
    # Junction table indexes
    op.create_index('idx_recipe_categories_recipe', 'recipe_recipe_categories', ['recipe_id'])
    op.create_index('idx_recipe_categories_category', 'recipe_recipe_categories', ['category_id'])
    op.create_index('idx_recipe_categories_primary', 'recipe_recipe_categories', ['recipe_id'], 
                    postgresql_where=sa.text('is_primary'))
    
    op.create_index('idx_recipe_tags_recipe', 'recipe_recipe_tags', ['recipe_id'])
    op.create_index('idx_recipe_tags_tag', 'recipe_recipe_tags', ['tag_id'])
    op.create_index('idx_recipe_tags_tagged_at', 'recipe_recipe_tags', ['tagged_at'])
    
    # Text search indexes
    op.create_index('idx_category_name_search', 'recipe_categories', 
                    [sa.text("to_tsvector('simple', name)")], 
                    postgresql_using='gin')
    
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


def downgrade() -> None:
    """Drop categories and tags tables."""
    
    # Drop triggers first
    op.execute("DROP TRIGGER IF EXISTS trigger_ensure_single_primary_category ON recipe_recipe_categories")
    op.execute("DROP TRIGGER IF EXISTS trigger_check_category_hierarchy ON recipe_categories")
    op.execute("DROP TRIGGER IF EXISTS trigger_update_tag_usage_count ON recipe_recipe_tags")
    
    # Drop functions
    op.execute("DROP FUNCTION IF EXISTS ensure_single_primary_category()")
    op.execute("DROP FUNCTION IF EXISTS check_category_hierarchy()")
    op.execute("DROP FUNCTION IF EXISTS update_tag_usage_count()")
    
    # Drop indexes
    op.drop_index('idx_tag_name_search', table_name='recipe_tags')
    op.drop_index('idx_category_name_search', table_name='recipe_categories')
    op.drop_index('idx_recipe_tags_tagged_at', table_name='recipe_recipe_tags')
    op.drop_index('idx_recipe_tags_tag', table_name='recipe_recipe_tags')
    op.drop_index('idx_recipe_tags_recipe', table_name='recipe_recipe_tags')
    op.drop_index('idx_recipe_categories_primary', table_name='recipe_recipe_categories')
    op.drop_index('idx_recipe_categories_category', table_name='recipe_recipe_categories')
    op.drop_index('idx_recipe_categories_recipe', table_name='recipe_recipe_categories')
    op.drop_index('idx_tags_name', table_name='recipe_tags')
    op.drop_index('idx_tags_usage', table_name='recipe_tags')
    op.drop_index('idx_tags_slug', table_name='recipe_tags')
    op.drop_index('idx_categories_order', table_name='recipe_categories')
    op.drop_index('idx_categories_parent', table_name='recipe_categories')
    op.drop_index('idx_categories_slug', table_name='recipe_categories')
    
    # Drop tables in correct order (junction tables first)
    op.drop_table('recipe_recipe_tags')
    op.drop_table('recipe_recipe_categories')
    op.drop_table('recipe_tags')
    op.drop_table('recipe_categories')