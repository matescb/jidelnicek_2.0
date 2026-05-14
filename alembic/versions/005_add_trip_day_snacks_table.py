"""Add trip_day_snacks table

Revision ID: 005_add_trip_day_snacks
Revises: 004_add_marketplace_ratings_reviews
Create Date: 2025-01-13

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '005_add_trip_day_snacks'
down_revision = '004_add_marketplace_ratings_reviews'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create trip_day_snacks table for managing snacks assigned to trip days."""
    
    # Create trip_day_snacks table
    op.create_table(
        'trip_day_snacks',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('trip_day_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('snack_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('quantity_per_person', sa.Numeric(precision=10, scale=2), nullable=False, 
                  comment='Quantity per person (pieces or grams depending on snack measurement type)'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['trip_day_id'], ['trip_days.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['snack_id'], ['common_snacks.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('trip_day_id', 'snack_id', name='uq_trip_day_snack'),
        sa.CheckConstraint('quantity_per_person > 0', name='trip_day_snacks_quantity_positive')
    )
    
    # Create indexes
    op.create_index('idx_trip_day_snacks_trip_day', 'trip_day_snacks', ['trip_day_id'])
    op.create_index('idx_trip_day_snacks_snack', 'trip_day_snacks', ['snack_id'])
    
    # Add comment on table
    op.execute("COMMENT ON TABLE trip_day_snacks IS 'Snacks assigned to specific days in trips'")


def downgrade() -> None:
    """Drop trip_day_snacks table."""
    
    # Drop indexes
    op.drop_index('idx_trip_day_snacks_snack', 'trip_day_snacks')
    op.drop_index('idx_trip_day_snacks_trip_day', 'trip_day_snacks')
    
    # Drop table
    op.drop_table('trip_day_snacks')