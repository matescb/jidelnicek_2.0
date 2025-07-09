"""Add Category and Tag models for recipe categorization

Revision ID: 624c83f973a5
Revises: 002
Create Date: 2025-07-09 05:38:50.353999

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = "624c83f973a5"
down_revision = "002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Apply migration."""
    # Create recipe_categories table
    op.create_table(
        'recipe_categories',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('name', sa.String(length=50), nullable=False),
        sa.Column('slug', sa.String(length=50), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('icon', sa.String(length=50), nullable=True),
        sa.Column('parent_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('display_order', sa.Integer(), server_default='0', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('slug'),
        sa.ForeignKeyConstraint(['parent_id'], ['recipe_categories.id'], ondelete='CASCADE')
    )
    op.create_index(op.f('ix_recipe_categories_name'), 'recipe_categories', ['name'], unique=False)
    op.create_index(op.f('ix_recipe_categories_slug'), 'recipe_categories', ['slug'], unique=True)
    op.create_index(op.f('ix_recipe_categories_parent_id'), 'recipe_categories', ['parent_id'], unique=False)
    op.create_index('idx_categories_parent', 'recipe_categories', ['parent_id'], unique=False)
    op.create_index('idx_categories_order', 'recipe_categories', ['display_order'], unique=False)
    
    # Create recipe_tags table
    op.create_table(
        'recipe_tags',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('name', sa.String(length=30), nullable=False),
        sa.Column('slug', sa.String(length=30), nullable=False),
        sa.Column('usage_count', sa.Integer(), server_default='0', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('slug')
    )
    op.create_index(op.f('ix_recipe_tags_name'), 'recipe_tags', ['name'], unique=False)
    op.create_index(op.f('ix_recipe_tags_slug'), 'recipe_tags', ['slug'], unique=True)
    op.create_index(op.f('ix_recipe_tags_usage_count'), 'recipe_tags', ['usage_count'], unique=False)
    op.create_index('idx_tags_usage', 'recipe_tags', ['usage_count'], unique=False)
    
    # Create recipe_recipe_categories junction table
    op.create_table(
        'recipe_recipe_categories',
        sa.Column('recipe_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('category_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('is_primary', sa.Boolean(), server_default=sa.text('false'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('recipe_id', 'category_id'),
        sa.ForeignKeyConstraint(['recipe_id'], ['recipe_recipes.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['category_id'], ['recipe_categories.id'], ondelete='CASCADE')
    )
    op.create_index('idx_recipe_categories_recipe', 'recipe_recipe_categories', ['recipe_id'], unique=False)
    op.create_index('idx_recipe_categories_category', 'recipe_recipe_categories', ['category_id'], unique=False)
    op.create_index(
        'idx_recipe_categories_primary', 
        'recipe_recipe_categories', 
        ['recipe_id', 'is_primary'], 
        unique=False,
        postgresql_where=sa.text('is_primary')
    )
    
    # Create recipe_recipe_tags junction table
    op.create_table(
        'recipe_recipe_tags',
        sa.Column('recipe_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('tag_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('tagged_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('recipe_id', 'tag_id'),
        sa.ForeignKeyConstraint(['recipe_id'], ['recipe_recipes.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['tag_id'], ['recipe_tags.id'], ondelete='CASCADE')
    )
    op.create_index('idx_recipe_tags_recipe', 'recipe_recipe_tags', ['recipe_id'], unique=False)
    op.create_index('idx_recipe_tags_tag', 'recipe_recipe_tags', ['tag_id'], unique=False)
    op.create_index('idx_recipe_tags_tagged', 'recipe_recipe_tags', ['tagged_at'], unique=False)


def downgrade() -> None:
    """Revert migration."""
    # Drop junction tables first
    op.drop_index('idx_recipe_tags_tagged', table_name='recipe_recipe_tags')
    op.drop_index('idx_recipe_tags_tag', table_name='recipe_recipe_tags')
    op.drop_index('idx_recipe_tags_recipe', table_name='recipe_recipe_tags')
    op.drop_table('recipe_recipe_tags')
    
    op.drop_index('idx_recipe_categories_primary', table_name='recipe_recipe_categories')
    op.drop_index('idx_recipe_categories_category', table_name='recipe_recipe_categories')
    op.drop_index('idx_recipe_categories_recipe', table_name='recipe_recipe_categories')
    op.drop_table('recipe_recipe_categories')
    
    # Drop main tables
    op.drop_index('idx_tags_usage', table_name='recipe_tags')
    op.drop_index(op.f('ix_recipe_tags_usage_count'), table_name='recipe_tags')
    op.drop_index(op.f('ix_recipe_tags_slug'), table_name='recipe_tags')
    op.drop_index(op.f('ix_recipe_tags_name'), table_name='recipe_tags')
    op.drop_table('recipe_tags')
    
    op.drop_index('idx_categories_order', table_name='recipe_categories')
    op.drop_index('idx_categories_parent', table_name='recipe_categories')
    op.drop_index(op.f('ix_recipe_categories_parent_id'), table_name='recipe_categories')
    op.drop_index(op.f('ix_recipe_categories_slug'), table_name='recipe_categories')
    op.drop_index(op.f('ix_recipe_categories_name'), table_name='recipe_categories')
    op.drop_table('recipe_categories')
