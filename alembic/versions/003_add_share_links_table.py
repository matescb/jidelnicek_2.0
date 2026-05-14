"""Add share_links table

Revision ID: 003_add_share_links_table
Revises: 002_add_session_management_fields
Create Date: 2025-01-13

This migration adds the share_links table to support unified sharing functionality
for recipes and trips through secure, time-limited share tokens.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '003_add_share_links_table'
down_revision: Union[str, None] = '002_add_session_management_fields'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """
    Create share_links table for unified sharing functionality.
    """
    
    # Create share_links table
    op.create_table('share_links',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('entity_type', sa.String(), nullable=False, comment='Type of entity being shared: recipe or trip'),
        sa.Column('entity_id', postgresql.UUID(as_uuid=True), nullable=False, comment='ID of the shared entity (recipe or trip)'),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False, comment='ID of the user who created the share link'),
        sa.Column('share_token', sa.String(length=255), nullable=False, comment='Unique token for accessing shared content'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False, comment='When the share link was created'),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False, comment='When the share link expires'),
        sa.Column('view_count', sa.Integer(), server_default='0', nullable=False, comment='Number of times the share link has been accessed'),
        sa.CheckConstraint('view_count >= 0', name='share_link_view_count_non_negative'),
        sa.CheckConstraint("entity_type IN ('recipe', 'trip')", name='share_link_entity_type_check'),
        sa.CheckConstraint('expires_at > created_at', name='share_link_expires_after_created'),
        sa.ForeignKeyConstraint(['user_id'], ['auth_users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('entity_type', 'entity_id', 'share_token', name='uq_share_links_entity_token'),
        sa.UniqueConstraint('share_token')
    )
    
    # Create indexes
    op.create_index('idx_share_links_share_token', 'share_links', ['share_token'])
    op.create_index('idx_share_links_entity_id', 'share_links', ['entity_id'])
    op.create_index('idx_share_links_user_id', 'share_links', ['user_id'])
    op.create_index('idx_share_links_expires_at', 'share_links', ['expires_at'])
    op.create_index('idx_share_links_user_active', 'share_links', ['user_id', 'expires_at'])
    op.create_index('idx_share_links_entity', 'share_links', ['entity_type', 'entity_id'])
    
    # Add share_token and share_expires_at to recipe_recipes table for backward compatibility
    op.add_column('recipe_recipes', sa.Column('share_token', sa.String(length=255), nullable=True))
    op.add_column('recipe_recipes', sa.Column('share_expires_at', sa.DateTime(timezone=True), nullable=True))
    
    # Create unique index on recipe share_token
    op.create_index('idx_recipe_share_token', 'recipe_recipes', ['share_token'], unique=True, postgresql_where=sa.text('share_token IS NOT NULL'))


def downgrade() -> None:
    """
    Remove share_links table and recipe sharing columns.
    """
    
    # Drop recipe sharing columns
    op.drop_index('idx_recipe_share_token', table_name='recipe_recipes')
    op.drop_column('recipe_recipes', 'share_expires_at')
    op.drop_column('recipe_recipes', 'share_token')
    
    # Drop share_links indexes
    op.drop_index('idx_share_links_entity', table_name='share_links')
    op.drop_index('idx_share_links_user_active', table_name='share_links')
    op.drop_index('idx_share_links_expires_at', table_name='share_links')
    op.drop_index('idx_share_links_user_id', table_name='share_links')
    op.drop_index('idx_share_links_entity_id', table_name='share_links')
    op.drop_index('idx_share_links_share_token', table_name='share_links')
    
    # Drop share_links table
    op.drop_table('share_links')