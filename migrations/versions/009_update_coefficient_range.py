"""Update coefficient range validation to 10-300%

Revision ID: 009_update_coefficient_range
Revises: 008_refactor_ingredient_model
Create Date: 2025-01-14 15:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '009_update_coefficient_range'
down_revision = '008_refactor_ingredient_model'
branch_labels = None
depends_on = None


def upgrade():
    """Update coefficient range validation from 0.01-999.99 to 10-300."""
    
    # Drop existing constraints
    op.drop_constraint('participant_coefficient_check', 'trip_participants', type_='check')
    op.drop_constraint('meal_coefficient_check', 'trip_meal_coefficients', type_='check')
    
    # Create new constraints with updated range
    op.create_check_constraint(
        'participant_coefficient_check',
        'trip_participants',
        'coefficient >= 10 AND coefficient <= 300'
    )
    
    op.create_check_constraint(
        'meal_coefficient_check',
        'trip_meal_coefficients',
        'coefficient >= 10 AND coefficient <= 300'
    )


def downgrade():
    """Revert coefficient range validation to 0.01-999.99."""
    
    # Drop new constraints
    op.drop_constraint('participant_coefficient_check', 'trip_participants', type_='check')
    op.drop_constraint('meal_coefficient_check', 'trip_meal_coefficients', type_='check')
    
    # Restore old constraints
    op.create_check_constraint(
        'participant_coefficient_check',
        'trip_participants',
        'coefficient >= 0.01 AND coefficient <= 999.99'
    )
    
    op.create_check_constraint(
        'meal_coefficient_check',
        'trip_meal_coefficients',
        'coefficient >= 0.01 AND coefficient <= 999.99'
    )