"""Add trip module with Trip model

Revision ID: 002_add_trip_module
Revises: 001_initial_schema
Create Date: 2025-01-09

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '002_add_trip_module'
down_revision = '001_initial_schema'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create trip_trips table
    op.create_table(
        'trip_trips',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('start_date', sa.Date(), nullable=False),
        sa.Column('end_date', sa.Date(), nullable=False),
        sa.Column('meal_slots', sa.JSON(), server_default=sa.text("'[\"Breakfast\", \"Lunch\", \"Dinner\"]'::jsonb"), nullable=True, comment='Customizable meal slot names for the trip'),
        sa.Column('share_token', sa.String(length=255), nullable=True, comment='Token for sharing trip with others'),
        sa.Column('share_expires_at', sa.DateTime(timezone=True), nullable=True, comment='When the share link expires'),
        sa.Column('is_archived', sa.Boolean(), server_default=sa.text('false'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.CheckConstraint('end_date >= start_date', name='trip_dates_check'),
        sa.CheckConstraint('LENGTH(name) > 0', name='trip_name_not_empty'),
        sa.ForeignKeyConstraint(['user_id'], ['auth_users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('share_token')
    )
    
    # Create indexes
    op.create_index('idx_trips_user', 'trip_trips', ['user_id'], unique=False, postgresql_where=sa.text('NOT is_archived'))
    op.create_index('idx_trips_dates', 'trip_trips', ['start_date', 'end_date'], unique=False, postgresql_where=sa.text('NOT is_archived'))
    op.create_index(op.f('ix_trip_trips_share_token'), 'trip_trips', ['share_token'], unique=False)
    op.create_index(op.f('ix_trip_trips_user_id'), 'trip_trips', ['user_id'], unique=False)
    op.create_index(op.f('ix_trip_trips_is_archived'), 'trip_trips', ['is_archived'], unique=False)


def downgrade() -> None:
    # Drop indexes
    op.drop_index(op.f('ix_trip_trips_is_archived'), table_name='trip_trips')
    op.drop_index(op.f('ix_trip_trips_user_id'), table_name='trip_trips')
    op.drop_index(op.f('ix_trip_trips_share_token'), table_name='trip_trips')
    op.drop_index('idx_trips_dates', table_name='trip_trips', postgresql_where=sa.text('NOT is_archived'))
    op.drop_index('idx_trips_user', table_name='trip_trips', postgresql_where=sa.text('NOT is_archived'))
    
    # Drop table
    op.drop_table('trip_trips')