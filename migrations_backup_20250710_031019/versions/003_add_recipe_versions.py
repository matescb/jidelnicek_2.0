"""Add recipe versions table

Revision ID: 003_add_recipe_versions
Revises: 002_add_categories_tags
Create Date: 2025-07-09 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '003_add_recipe_versions'
down_revision = '002'
branch_labels = None
depends_on = None


def upgrade():
    """
    Add recipe_versions table and current_version field to recipes table.
    """
    # Create recipe_versions table
    op.create_table(
        'recipe_versions',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('recipe_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('version_number', sa.Integer(), nullable=False, comment='Sequential version number starting from 1'),
        sa.Column('change_type', sa.String(length=50), nullable=False, comment='Type of change: ingredient_change, title_change, instructions_change, nutritional_change, minor_change'),
        sa.Column('change_data', sa.JSON(), nullable=False, default={}, comment='Detailed change information including before/after values'),
        sa.Column('changed_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('changed_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('description', sa.Text(), nullable=True, comment='Optional description of the change'),
        sa.CheckConstraint('version_number > 0', name='recipe_versions_version_number_check'),
        sa.CheckConstraint("change_type IN ('ingredient_change', 'title_change', 'instructions_change', 'nutritional_change', 'minor_change')", name='recipe_versions_change_type_check'),
        sa.ForeignKeyConstraint(['changed_by'], ['auth_users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['recipe_id'], ['recipe_recipes.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('recipe_id', 'version_number', name='recipe_versions_recipe_version_unique')
    )
    
    # Create indexes for recipe_versions table
    op.create_index('idx_recipe_versions_recipe_changed_at', 'recipe_versions', ['recipe_id', 'changed_at'])
    op.create_index(op.f('ix_recipe_versions_changed_at'), 'recipe_versions', ['changed_at'])
    op.create_index(op.f('ix_recipe_versions_changed_by'), 'recipe_versions', ['changed_by'])
    op.create_index(op.f('ix_recipe_versions_change_type'), 'recipe_versions', ['change_type'])
    op.create_index(op.f('ix_recipe_versions_recipe_id'), 'recipe_versions', ['recipe_id'])
    
    # Add current_version column to recipe_recipes table
    op.add_column('recipe_recipes', sa.Column('current_version', sa.Integer(), server_default='1', nullable=False, comment='Current version number of the recipe'))
    
    # Add check constraint for current_version
    op.create_check_constraint('recipe_current_version_positive', 'recipe_recipes', 'current_version > 0')


def downgrade():
    """
    Remove recipe_versions table and current_version field from recipes table.
    """
    # Drop check constraint for current_version
    op.drop_constraint('recipe_current_version_positive', 'recipe_recipes', type_='check')
    
    # Drop current_version column from recipe_recipes table
    op.drop_column('recipe_recipes', 'current_version')
    
    # Drop indexes from recipe_versions table
    op.drop_index(op.f('ix_recipe_versions_recipe_id'), table_name='recipe_versions')
    op.drop_index(op.f('ix_recipe_versions_change_type'), table_name='recipe_versions')
    op.drop_index(op.f('ix_recipe_versions_changed_by'), table_name='recipe_versions')
    op.drop_index(op.f('ix_recipe_versions_changed_at'), table_name='recipe_versions')
    op.drop_index('idx_recipe_versions_recipe_changed_at', table_name='recipe_versions')
    
    # Drop recipe_versions table
    op.drop_table('recipe_versions')