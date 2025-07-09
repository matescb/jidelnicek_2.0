"""Add description and status fields to Trip model

Revision ID: 010_add_trip_description_status_fields
Revises: 009_update_coefficient_range
Create Date: 2025-01-14 15:30:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '010_add_trip_description_status_fields'
down_revision = '009_update_coefficient_range'
branch_labels = None
depends_on = None


def upgrade():
    """Add description and status fields to Trip model."""
    
    # Add description field
    op.add_column('trip_trips', sa.Column('description', sa.Text(), nullable=True,
                                          comment='Trip description and notes'))
    
    # Add status field with default value
    op.add_column('trip_trips', sa.Column('status', sa.String(20), nullable=False,
                                          server_default="'planned'",
                                          comment='Trip status: planned, active, completed, cancelled'))
    
    # Add check constraint for status field
    op.create_check_constraint(
        'trip_status_check',
        'trip_trips',
        "status IN ('planned', 'active', 'completed', 'cancelled')"
    )


def downgrade():
    """Remove description and status fields from Trip model."""
    
    # Drop check constraint
    op.drop_constraint('trip_status_check', 'trip_trips', type_='check')
    
    # Drop columns
    op.drop_column('trip_trips', 'status')
    op.drop_column('trip_trips', 'description')