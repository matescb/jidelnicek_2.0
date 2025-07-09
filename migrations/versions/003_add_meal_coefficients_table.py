"""Add meal coefficients table for future meal-specific coefficient support.

Revision ID: 003
Revises: 002
Create Date: 2025-01-09
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers
revision = '003'
down_revision = '002'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """
    Create meal_coefficients table for future support of meal-specific coefficients.
    
    This table will allow participants to have different coefficients for different meal types.
    For now, the system will continue to use the base coefficient from trip_participants,
    but this structure allows for future enhancement.
    """
    op.create_table(
        'trip_meal_coefficients',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('participant_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('trip_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('meal_slot', sa.String(50), nullable=False),
        sa.Column('coefficient', sa.Numeric(5, 2), nullable=False, server_default=sa.text('100.00')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['participant_id'], ['trip_participants.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['trip_id'], ['trip_trips.id'], ondelete='CASCADE'),
        sa.CheckConstraint('coefficient >= 0.01 AND coefficient <= 999.99', name='meal_coefficient_check'),
        sa.UniqueConstraint('participant_id', 'meal_slot', name='unique_participant_meal_coefficient')
    )
    
    # Create indexes
    op.create_index('idx_meal_coefficients_participant', 'trip_meal_coefficients', ['participant_id'])
    op.create_index('idx_meal_coefficients_trip', 'trip_meal_coefficients', ['trip_id'])
    op.create_index('idx_meal_coefficients_meal_slot', 'trip_meal_coefficients', ['trip_id', 'meal_slot'])
    
    # Add comment to table
    op.execute("COMMENT ON TABLE trip_meal_coefficients IS 'Optional meal-specific coefficients for participants. If not specified, uses base coefficient from trip_participants.'")


def downgrade() -> None:
    """Drop meal coefficients table."""
    op.drop_index('idx_meal_coefficients_meal_slot', table_name='trip_meal_coefficients')
    op.drop_index('idx_meal_coefficients_trip', table_name='trip_meal_coefficients')
    op.drop_index('idx_meal_coefficients_participant', table_name='trip_meal_coefficients')
    op.drop_table('trip_meal_coefficients')