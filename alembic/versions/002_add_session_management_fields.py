"""Add session management fields

Revision ID: 002_add_session_management_fields
Revises: 001_enhance_auth_schema
Create Date: 2025-01-09

This migration adds fields to support enhanced session management:
- Device information fields (device_name, device_type, browser, os)
- Location field for IP geolocation
- Additional configuration fields
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '002_add_session_management_fields'
down_revision: Union[str, None] = '001_enhance_auth_schema'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """
    Add session management fields to auth_sessions table.
    """
    
    # Add device information fields to auth_sessions
    op.add_column('auth_sessions', sa.Column('device_name', sa.String(length=255), nullable=True))
    op.add_column('auth_sessions', sa.Column('device_type', sa.String(length=50), nullable=True))
    op.add_column('auth_sessions', sa.Column('browser', sa.String(length=100), nullable=True))
    op.add_column('auth_sessions', sa.Column('os', sa.String(length=100), nullable=True))
    
    # Add location field for IP geolocation
    op.add_column('auth_sessions', sa.Column('location', sa.String(length=255), nullable=True))
    
    # Create index on device_type for analytics
    op.create_index('idx_auth_sessions_device_type', 'auth_sessions', ['device_type'])
    
    # Create composite index for session queries
    op.create_index(
        'idx_auth_sessions_user_valid_expires', 
        'auth_sessions', 
        ['user_id', 'is_valid', 'expires_at']
    )


def downgrade() -> None:
    """
    Remove session management fields from auth_sessions table.
    """
    
    # Drop indexes
    op.drop_index('idx_auth_sessions_user_valid_expires', table_name='auth_sessions')
    op.drop_index('idx_auth_sessions_device_type', table_name='auth_sessions')
    
    # Drop columns
    op.drop_column('auth_sessions', 'location')
    op.drop_column('auth_sessions', 'os')
    op.drop_column('auth_sessions', 'browser')
    op.drop_column('auth_sessions', 'device_type')
    op.drop_column('auth_sessions', 'device_name')