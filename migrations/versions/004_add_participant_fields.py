"""Add participant email, meal coefficients and attendance dates

Revision ID: 004
Revises: 003
Create Date: 2025-01-09

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '004'
down_revision = '003'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add new fields to trip_participants table."""
    # Add email field
    op.add_column('trip_participants', 
        sa.Column('email', sa.String(length=255), nullable=True)
    )
    
    # Add meal_coefficients JSON field
    op.add_column('trip_participants',
        sa.Column('meal_coefficients', sa.JSON(), nullable=True)
    )
    
    # Add partial attendance date fields
    op.add_column('trip_participants',
        sa.Column('arrival_date', sa.Date(), nullable=True)
    )
    
    op.add_column('trip_participants',
        sa.Column('departure_date', sa.Date(), nullable=True)
    )


def downgrade() -> None:
    """Remove added fields from trip_participants table."""
    op.drop_column('trip_participants', 'departure_date')
    op.drop_column('trip_participants', 'arrival_date')
    op.drop_column('trip_participants', 'meal_coefficients')
    op.drop_column('trip_participants', 'email')