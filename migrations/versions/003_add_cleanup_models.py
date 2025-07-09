"""Add cleanup models

Revision ID: 003
Revises: 002
Create Date: 2024-01-09

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
    # Create cleanup_policies table
    op.create_table(
        'cleanup_policies',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('file_type', sa.String(length=50), nullable=False),
        sa.Column('retention_days', sa.Integer(), nullable=False),
        sa.Column('grace_period_hours', sa.Integer(), nullable=True),
        sa.Column('file_pattern', sa.String(length=255), nullable=True),
        sa.Column('min_file_size', sa.Integer(), nullable=True),
        sa.Column('max_file_size', sa.Integer(), nullable=True),
        sa.Column('storage_location', sa.String(length=50), nullable=True),
        sa.Column('allow_user_override', sa.Boolean(), nullable=True),
        sa.Column('min_retention_days', sa.Integer(), nullable=True),
        sa.Column('max_retention_days', sa.Integer(), nullable=True),
        sa.Column('notify_before_deletion', sa.Boolean(), nullable=True),
        sa.Column('notification_hours_before', sa.Integer(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=True),
        sa.Column('priority', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name')
    )
    op.create_index(op.f('ix_cleanup_policies_file_type'), 'cleanup_policies', ['file_type'], unique=False)
    op.create_index('idx_policy_active_priority', 'cleanup_policies', ['is_active', 'priority'], unique=False)
    op.create_unique_constraint('uix_file_type_storage', 'cleanup_policies', ['file_type', 'storage_location'])
    
    # Create cleanup_audit_logs table
    op.create_table(
        'cleanup_audit_logs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('file_path', sa.String(length=500), nullable=False),
        sa.Column('file_type', sa.String(length=50), nullable=False),
        sa.Column('file_size', sa.Integer(), nullable=False),
        sa.Column('file_hash', sa.String(length=64), nullable=True),
        sa.Column('deletion_reason', sa.String(length=255), nullable=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('deleted', sa.Boolean(), nullable=True),
        sa.Column('policy_id', sa.Integer(), nullable=True),
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.Column('recovered', sa.Boolean(), nullable=True),
        sa.Column('recovery_info', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('metadata', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['policy_id'], ['cleanup_policies.id'], ),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_cleanup_audit_logs_deleted_at'), 'cleanup_audit_logs', ['deleted_at'], unique=False)
    op.create_index(op.f('ix_cleanup_audit_logs_file_type'), 'cleanup_audit_logs', ['file_type'], unique=False)
    op.create_index(op.f('ix_cleanup_audit_logs_user_id'), 'cleanup_audit_logs', ['user_id'], unique=False)
    op.create_index('idx_audit_user_deleted', 'cleanup_audit_logs', ['user_id', 'deleted_at'], unique=False)
    op.create_index('idx_audit_file_type_deleted', 'cleanup_audit_logs', ['file_type', 'deleted_at'], unique=False)
    
    # Create cleanup_statistics table
    op.create_table(
        'cleanup_statistics',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('date', sa.Date(), nullable=False),
        sa.Column('files_deleted', sa.Integer(), nullable=True),
        sa.Column('total_size_freed', sa.Integer(), nullable=True),
        sa.Column('errors_count', sa.Integer(), nullable=True),
        sa.Column('by_type_stats', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('local_files_deleted', sa.Integer(), nullable=True),
        sa.Column('cloud_files_deleted', sa.Integer(), nullable=True),
        sa.Column('cleanup_duration_seconds', sa.Float(), nullable=True),
        sa.Column('average_file_size', sa.Float(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('date')
    )
    op.create_index(op.f('ix_cleanup_statistics_date'), 'cleanup_statistics', ['date'], unique=True)
    
    # Create deletion_queue table
    op.create_table(
        'deletion_queue',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('file_path', sa.String(length=500), nullable=False),
        sa.Column('file_type', sa.String(length=50), nullable=False),
        sa.Column('file_size', sa.Integer(), nullable=True),
        sa.Column('scheduled_deletion_time', sa.DateTime(timezone=True), nullable=False),
        sa.Column('grace_period_hours', sa.Integer(), nullable=True),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('audit_log_id', sa.Integer(), nullable=True),
        sa.Column('notification_sent', sa.Boolean(), nullable=True),
        sa.Column('notification_sent_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('processed', sa.Boolean(), nullable=True),
        sa.Column('processed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('cancelled', sa.Boolean(), nullable=True),
        sa.Column('cancellation_reason', sa.String(length=255), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['audit_log_id'], ['cleanup_audit_logs.id'], ),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_deletion_queue_scheduled_deletion_time'), 'deletion_queue', ['scheduled_deletion_time'], unique=False)
    op.create_index(op.f('ix_deletion_queue_user_id'), 'deletion_queue', ['user_id'], unique=False)
    op.create_index('idx_queue_scheduled_processed', 'deletion_queue', ['scheduled_deletion_time', 'processed'], unique=False)
    op.create_index('idx_queue_user_scheduled', 'deletion_queue', ['user_id', 'scheduled_deletion_time'], unique=False)
    
    # Create user_cleanup_preferences table
    op.create_table(
        'user_cleanup_preferences',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('shopping_list_retention_days', sa.Integer(), nullable=True),
        sa.Column('trip_data_retention_days', sa.Integer(), nullable=True),
        sa.Column('recipe_export_retention_days', sa.Integer(), nullable=True),
        sa.Column('dataset_export_retention_days', sa.Integer(), nullable=True),
        sa.Column('enable_deletion_notifications', sa.Boolean(), nullable=True),
        sa.Column('notification_email', sa.String(length=255), nullable=True),
        sa.Column('notification_lead_time_hours', sa.Integer(), nullable=True),
        sa.Column('auto_backup_before_deletion', sa.Boolean(), nullable=True),
        sa.Column('backup_location', sa.String(length=50), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id')
    )
    
    # Add metadata column to users table if not exists
    op.add_column('users', sa.Column('metadata', postgresql.JSON(astext_type=sa.Text()), nullable=True))


def downgrade() -> None:
    # Drop metadata column from users table
    op.drop_column('users', 'metadata')
    
    # Drop tables
    op.drop_table('user_cleanup_preferences')
    op.drop_table('deletion_queue')
    op.drop_table('cleanup_statistics')
    op.drop_table('cleanup_audit_logs')
    op.drop_table('cleanup_policies')