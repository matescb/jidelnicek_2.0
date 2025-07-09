"""Add ingredient moderation table

Revision ID: 003
Revises: 002
Create Date: 2024-01-09 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '003'
down_revision = '002'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add ingredient moderation table and indexes."""
    
    # Create enum type for moderation status
    moderation_status_enum = postgresql.ENUM(
        'pending', 'approved', 'rejected', 'needs_review',
        name='ingredientmoderationstatus'
    )
    moderation_status_enum.create(op.get_bind())
    
    # Create ingredient moderation table
    op.create_table(
        'admin_ingredient_moderation',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text('gen_random_uuid()')),
        sa.Column('ingredient_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('submitted_by', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('submitted_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('status', moderation_status_enum, nullable=False, server_default='pending'),
        sa.Column('reviewed_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('reviewed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('review_notes', sa.String(1000), nullable=True),
        sa.Column('rejection_reason', sa.String(500), nullable=True),
        sa.Column('quality_score', sa.Integer(), nullable=True),
        sa.Column('quality_issues', postgresql.JSON(), nullable=True),
        sa.Column('suggested_changes', postgresql.JSON(), nullable=True),
        sa.Column('auto_check_passed', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('auto_check_issues', postgresql.JSON(), nullable=True),
        sa.Column('priority', sa.Integer(), nullable=False, server_default='0'),
        sa.ForeignKeyConstraint(['ingredient_id'], ['common_ingredients.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['reviewed_by'], ['auth_users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['submitted_by'], ['auth_users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('ingredient_id')
    )
    
    # Create indexes
    op.create_index('idx_admin_ingredient_moderation_ingredient_id', 'admin_ingredient_moderation', ['ingredient_id'])
    op.create_index('idx_admin_ingredient_moderation_submitted_by', 'admin_ingredient_moderation', ['submitted_by'])
    op.create_index('idx_admin_ingredient_moderation_status', 'admin_ingredient_moderation', ['status'])
    op.create_index('idx_admin_ingredient_moderation_reviewed_by', 'admin_ingredient_moderation', ['reviewed_by'])
    op.create_index('idx_admin_ingredient_moderation_reviewed_at', 'admin_ingredient_moderation', ['reviewed_at'])
    op.create_index('idx_admin_ingredient_moderation_submitted_at', 'admin_ingredient_moderation', ['submitted_at'])
    op.create_index('idx_admin_ingredient_moderation_priority', 'admin_ingredient_moderation', ['priority'])
    op.create_index('idx_moderation_status_priority', 'admin_ingredient_moderation', ['status', 'priority'])
    op.create_index('idx_moderation_submitted', 'admin_ingredient_moderation', ['submitted_at'])
    
    # Add image_url column to common_ingredients table if not exists
    op.add_column('common_ingredients', sa.Column('image_url', sa.String(500), nullable=True))


def downgrade() -> None:
    """Remove ingredient moderation table."""
    
    # Drop image_url column from common_ingredients
    op.drop_column('common_ingredients', 'image_url')
    
    # Drop indexes
    op.drop_index('idx_moderation_submitted', table_name='admin_ingredient_moderation')
    op.drop_index('idx_moderation_status_priority', table_name='admin_ingredient_moderation')
    op.drop_index('idx_admin_ingredient_moderation_priority', table_name='admin_ingredient_moderation')
    op.drop_index('idx_admin_ingredient_moderation_submitted_at', table_name='admin_ingredient_moderation')
    op.drop_index('idx_admin_ingredient_moderation_reviewed_at', table_name='admin_ingredient_moderation')
    op.drop_index('idx_admin_ingredient_moderation_reviewed_by', table_name='admin_ingredient_moderation')
    op.drop_index('idx_admin_ingredient_moderation_status', table_name='admin_ingredient_moderation')
    op.drop_index('idx_admin_ingredient_moderation_submitted_by', table_name='admin_ingredient_moderation')
    op.drop_index('idx_admin_ingredient_moderation_ingredient_id', table_name='admin_ingredient_moderation')
    
    # Drop table
    op.drop_table('admin_ingredient_moderation')
    
    # Drop enum type
    moderation_status_enum = postgresql.ENUM(
        'pending', 'approved', 'rejected', 'needs_review',
        name='ingredientmoderationstatus'
    )
    moderation_status_enum.drop(op.get_bind())