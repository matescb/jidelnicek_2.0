"""Enhance authentication schema

Revision ID: 001_enhance_auth_schema
Revises: 
Create Date: 2025-01-08

This migration enhances the authentication schema to support:
- Email verification timestamps
- Failed login tracking and account lockout
- Separate tables for password reset and email verification tokens
- Session validity tracking
- Enhanced security features
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '001_enhance_auth_schema'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """
    Enhance the authentication schema with additional security features.
    """
    
    # Add missing columns to auth_users table
    op.add_column('auth_users', sa.Column('email_verified_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('auth_users', sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'))
    op.add_column('auth_users', sa.Column('failed_login_attempts', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('auth_users', sa.Column('locked_until', sa.DateTime(timezone=True), nullable=True))
    
    # Create index on lowercase email for case-insensitive lookups
    op.create_index('idx_auth_users_email_lower', 'auth_users', [sa.text('lower(email)')])
    
    # Rename session_token to token_hash and add is_valid column to auth_sessions
    op.alter_column('auth_sessions', 'session_token', new_column_name='token_hash')
    op.add_column('auth_sessions', sa.Column('is_valid', sa.Boolean(), nullable=False, server_default='true'))
    
    # Create password reset tokens table
    op.create_table('auth_password_reset_tokens',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('token', sa.String(length=255), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('used_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('request_ip', postgresql.INET(), nullable=True),
        sa.Column('used_ip', postgresql.INET(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['user_id'], ['auth_users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('token')
    )
    op.create_index('idx_auth_password_reset_tokens_token', 'auth_password_reset_tokens', ['token'])
    op.create_index('idx_auth_password_reset_tokens_user_id', 'auth_password_reset_tokens', ['user_id'])
    op.create_index('idx_auth_password_reset_tokens_expires_at', 'auth_password_reset_tokens', ['expires_at'])
    
    # Create email verification tokens table
    op.create_table('auth_email_verification_tokens',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('token', sa.String(length=255), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('used_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['user_id'], ['auth_users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('token')
    )
    op.create_index('idx_auth_email_verification_tokens_token', 'auth_email_verification_tokens', ['token'])
    op.create_index('idx_auth_email_verification_tokens_user_id', 'auth_email_verification_tokens', ['user_id'])
    op.create_index('idx_auth_email_verification_tokens_expires_at', 'auth_email_verification_tokens', ['expires_at'])
    
    # Drop the old verification_token and reset_token columns from auth_users
    # since we're now using separate tables for better token management
    op.drop_column('auth_users', 'verification_token')
    op.drop_column('auth_users', 'reset_token')
    op.drop_column('auth_users', 'reset_token_expires')
    
    # Update the index on auth_sessions for the renamed column
    op.drop_index('idx_auth_sessions_token', table_name='auth_sessions')
    op.create_index('idx_auth_sessions_token_hash', 'auth_sessions', ['token_hash'])


def downgrade() -> None:
    """
    Revert the authentication schema enhancements.
    """
    
    # Drop the new tables
    op.drop_table('auth_email_verification_tokens')
    op.drop_table('auth_password_reset_tokens')
    
    # Restore the old token columns on auth_users
    op.add_column('auth_users', sa.Column('reset_token_expires', sa.DateTime(timezone=True), nullable=True))
    op.add_column('auth_users', sa.Column('reset_token', sa.String(length=255), nullable=True))
    op.add_column('auth_users', sa.Column('verification_token', sa.String(length=255), nullable=True))
    
    # Remove the enhanced columns from auth_users
    op.drop_index('idx_auth_users_email_lower', table_name='auth_users')
    op.drop_column('auth_users', 'locked_until')
    op.drop_column('auth_users', 'failed_login_attempts')
    op.drop_column('auth_users', 'is_active')
    op.drop_column('auth_users', 'email_verified_at')
    
    # Revert auth_sessions changes
    op.drop_index('idx_auth_sessions_token_hash', table_name='auth_sessions')
    op.drop_column('auth_sessions', 'is_valid')
    op.alter_column('auth_sessions', 'token_hash', new_column_name='session_token')
    op.create_index('idx_auth_sessions_token', 'auth_sessions', ['session_token'])