"""Fix trip schema alignment with SQLAlchemy models

Revision ID: 011
Revises: 005
Create Date: 2025-01-09 14:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '011_fix_trip_schema_alignment'
down_revision = '0913b7f11427'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Fix trip schema to align with SQLAlchemy models."""
    
    # =====================================================
    # Fix trip_trips table - Add missing fields
    # =====================================================
    
    # Add missing Trip fields (description and status already added in migration 010)
    op.add_column('trip_trips', sa.Column('share_token', sa.String(length=255), nullable=True))
    op.add_column('trip_trips', sa.Column('share_expires_at', sa.TIMESTAMP(), nullable=True))
    
    # Add constraints for Trip (status constraint already exists from migration 010)
    op.create_check_constraint('trip_name_not_empty_check', 'trip_trips', 'LENGTH(name) > 0')
    
    # Add indexes for Trip
    op.create_index('idx_trips_share_token', 'trip_trips', ['share_token'], unique=True)
    op.create_index('idx_trips_status', 'trip_trips', ['status'])
    
    # =====================================================
    # Fix trip_participants table - Add missing fields
    # =====================================================
    
    # Add missing TripParticipant fields
    op.add_column('trip_participants', sa.Column('email', sa.String(length=255), nullable=True))
    op.add_column('trip_participants', sa.Column('meal_coefficients', postgresql.JSONB(astext_type=sa.Text()), nullable=True))
    op.add_column('trip_participants', sa.Column('arrival_date', sa.Date(), nullable=True))
    op.add_column('trip_participants', sa.Column('departure_date', sa.Date(), nullable=True))
    
    # Update participant constraints to match models
    op.drop_constraint('trip_participants_coefficient_check', 'trip_participants', type_='check')
    op.create_check_constraint('participant_coefficient_check', 'trip_participants', 'coefficient >= 10 AND coefficient <= 300')
    
    # Add unique constraints for participants
    op.create_unique_constraint('unique_participant_name_per_trip', 'trip_participants', ['trip_id', 'name'])
    op.create_unique_constraint('unique_participant_number_per_trip', 'trip_participants', ['trip_id', 'number'])
    
    # =====================================================
    # Fix trip_days table - Add missing fields and constraints
    # =====================================================
    
    # Add missing TripDay fields
    op.add_column('trip_days', sa.Column('created_at', sa.TIMESTAMP(), server_default=sa.text('now()'), nullable=False))
    op.add_column('trip_days', sa.Column('updated_at', sa.TIMESTAMP(), server_default=sa.text('now()'), nullable=False))
    
    # Update day constraints
    op.create_check_constraint('day_number_positive_check', 'trip_days', 'day_number >= 1')
    op.create_unique_constraint('unique_date_per_trip', 'trip_days', ['trip_id', 'date'])
    
    # =====================================================
    # Fix trip_meals table to match TripMeal model
    # =====================================================
    
    # Drop and recreate trip_meals with correct schema
    op.drop_table('trip_meals')
    
    op.create_table('trip_meals',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('day_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('recipe_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('meal_slot', sa.String(length=50), nullable=False),
        sa.Column('servings_override', sa.Integer(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('recipe_snapshot', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.TIMESTAMP(), server_default=sa.text('now()'), nullable=False),
        sa.CheckConstraint('servings_override IS NULL OR servings_override > 0', name='servings_override_positive_check'),
        sa.ForeignKeyConstraint(['day_id'], ['trip_days.id'], name='trip_meals_day_id_fkey', ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['recipe_id'], ['recipe_recipes.id'], name='trip_meals_recipe_id_fkey', ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id', name='trip_meals_pkey'),
        sa.UniqueConstraint('day_id', 'meal_slot', name='unique_meal_slot_per_day')
    )
    
    # =====================================================
    # Recreate trip_stoves table with correct schema
    # =====================================================
    
    # Drop and recreate trip_stoves with correct schema
    op.drop_table('trip_stoves')
    
    op.create_table('trip_stoves',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('trip_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('stove_type', sa.String(length=50), nullable=False),
        sa.Column('fuel_type', sa.String(length=50), nullable=False),
        sa.Column('efficiency_percentage', sa.Numeric(precision=5, scale=2), server_default='75.00', nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.TIMESTAMP(), server_default=sa.text('now()'), nullable=False),
        sa.CheckConstraint('efficiency_percentage >= 1 AND efficiency_percentage <= 100', name='stove_efficiency_check'),
        sa.ForeignKeyConstraint(['trip_id'], ['trip_trips.id'], name='trip_stoves_trip_id_fkey', ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id', name='trip_stoves_pkey'),
        sa.UniqueConstraint('trip_id', name='trip_stoves_trip_id_key')
    )
    
    # =====================================================
    # Recreate trip_templates table with correct schema
    # =====================================================
    
    # Drop and recreate trip_templates with correct schema
    op.drop_table('trip_templates')
    
    op.create_table('trip_templates',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(length=200), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('duration_days', sa.Integer(), nullable=False),
        sa.Column('meal_slots', postgresql.JSONB(astext_type=sa.Text()), server_default='["Breakfast", "Lunch", "Dinner"]', nullable=False),
        sa.Column('participants', postgresql.JSONB(astext_type=sa.Text()), server_default='[]', nullable=False),
        sa.Column('meal_assignments', postgresql.JSONB(astext_type=sa.Text()), server_default='{}', nullable=False),
        sa.Column('is_public', sa.Boolean(), server_default=sa.text('false'), nullable=False),
        sa.Column('category', sa.String(length=50), nullable=True),
        sa.Column('tags', postgresql.JSONB(astext_type=sa.Text()), server_default='[]', nullable=False),
        sa.Column('created_at', sa.TIMESTAMP(), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.TIMESTAMP(), server_default=sa.text('now()'), nullable=False),
        sa.CheckConstraint('duration_days > 0', name='template_duration_check'),
        sa.CheckConstraint('LENGTH(name) > 0', name='template_name_not_empty'),
        sa.CheckConstraint('jsonb_array_length(meal_slots) > 0', name='template_meal_slots_not_empty'),
        sa.ForeignKeyConstraint(['user_id'], ['auth_users.id'], name='trip_templates_user_id_fkey', ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id', name='trip_templates_pkey')
    )
    
    # =====================================================
    # Create new tables for advanced trip functionality
    # =====================================================
    
    # Create trip_meal_slots table
    op.create_table('trip_meal_slots',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('trip_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('day_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('day_number', sa.Integer(), nullable=False),
        sa.Column('meal_type', sa.String(length=50), nullable=False),
        sa.Column('is_active', sa.Boolean(), server_default=sa.text('true'), nullable=False),
        sa.Column('custom_name', sa.String(length=100), nullable=True),
        sa.Column('display_order', sa.Integer(), server_default='0', nullable=False),
        sa.Column('created_at', sa.TIMESTAMP(), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.TIMESTAMP(), server_default=sa.text('now()'), nullable=False),
        sa.CheckConstraint('day_number >= 1', name='meal_slot_day_number_check'),
        sa.CheckConstraint('display_order >= 0', name='meal_slot_display_order_check'),
        sa.ForeignKeyConstraint(['trip_id'], ['trip_trips.id'], name='trip_meal_slots_trip_id_fkey', ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['day_id'], ['trip_days.id'], name='trip_meal_slots_day_id_fkey', ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id', name='trip_meal_slots_pkey'),
        sa.UniqueConstraint('trip_id', 'day_number', 'meal_type', name='unique_trip_day_meal_type')
    )
    
    # Create trip_meal_coefficients table
    op.create_table('trip_meal_coefficients',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('participant_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('trip_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('meal_slot', sa.String(length=50), nullable=False),
        sa.Column('coefficient', sa.Numeric(precision=5, scale=2), server_default='100.00', nullable=False),
        sa.Column('created_at', sa.TIMESTAMP(), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.TIMESTAMP(), server_default=sa.text('now()'), nullable=False),
        sa.CheckConstraint('coefficient >= 10 AND coefficient <= 300', name='meal_coefficient_check'),
        sa.ForeignKeyConstraint(['participant_id'], ['trip_participants.id'], name='trip_meal_coefficients_participant_id_fkey', ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['trip_id'], ['trip_trips.id'], name='trip_meal_coefficients_trip_id_fkey', ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id', name='trip_meal_coefficients_pkey'),
        sa.UniqueConstraint('participant_id', 'meal_slot', name='unique_participant_meal_coefficient')
    )
    
    # =====================================================
    # Create indexes for performance
    # =====================================================
    
    # Trip template indexes
    op.create_index('idx_templates_user', 'trip_templates', ['user_id'])
    op.create_index('idx_templates_public', 'trip_templates', ['is_public', 'category'], postgresql_where=sa.text('is_public'))
    op.create_index('idx_templates_category', 'trip_templates', ['category'], postgresql_where=sa.text('category IS NOT NULL'))
    
    # Trip meal indexes
    op.create_index('idx_trip_meals_day', 'trip_meals', ['day_id'])
    op.create_index('idx_trip_meals_recipe', 'trip_meals', ['recipe_id'])
    
    # Trip meal slot indexes
    op.create_index('idx_trip_meal_slots_trip', 'trip_meal_slots', ['trip_id'])
    op.create_index('idx_trip_meal_slots_day', 'trip_meal_slots', ['day_id'])
    
    # Trip meal coefficient indexes
    op.create_index('idx_trip_meal_coefficients_participant', 'trip_meal_coefficients', ['participant_id'])
    op.create_index('idx_trip_meal_coefficients_trip', 'trip_meal_coefficients', ['trip_id'])
    
    # =====================================================
    # Create triggers for auto-updating timestamps
    # =====================================================
    
    # Function to update timestamps
    op.execute("""
        CREATE OR REPLACE FUNCTION update_trip_timestamp()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = now();
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)
    
    # Create triggers for all tables with updated_at
    tables_with_timestamps = [
        'trip_trips', 'trip_participants', 'trip_days', 'trip_meals', 
        'trip_stoves', 'trip_templates', 'trip_meal_slots', 'trip_meal_coefficients'
    ]
    
    for table in tables_with_timestamps:
        op.execute(f"""
            CREATE TRIGGER update_{table}_timestamp
            BEFORE UPDATE ON {table}
            FOR EACH ROW EXECUTE FUNCTION update_trip_timestamp();
        """)


def downgrade() -> None:
    """Revert trip schema changes."""
    
    # Drop triggers
    tables_with_timestamps = [
        'trip_trips', 'trip_participants', 'trip_days', 'trip_meals', 
        'trip_stoves', 'trip_templates', 'trip_meal_slots', 'trip_meal_coefficients'
    ]
    
    for table in tables_with_timestamps:
        op.execute(f"DROP TRIGGER IF EXISTS update_{table}_timestamp ON {table}")
    
    op.execute("DROP FUNCTION IF EXISTS update_trip_timestamp()")
    
    # Drop new tables
    op.drop_table('trip_meal_coefficients')
    op.drop_table('trip_meal_slots')
    
    # Revert trip_templates to original schema
    op.drop_table('trip_templates')
    op.create_table('trip_templates',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('template_data', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('is_day_template', sa.Boolean(), server_default=sa.text('false'), nullable=True),
        sa.Column('is_archived', sa.Boolean(), server_default=sa.text('false'), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.TIMESTAMP(), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['auth_users.id'], name='trip_templates_user_id_fkey', ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id', name='trip_templates_pkey')
    )
    
    # Revert trip_stoves to original schema
    op.drop_table('trip_stoves')
    op.create_table('trip_stoves',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('trip_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=True),
        sa.Column('efficiency_g_per_liter', sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column('altitude_adjustment_percent', sa.Numeric(precision=5, scale=2), server_default='0', nullable=True),
        sa.CheckConstraint('efficiency_g_per_liter > 0', name='trip_stoves_efficiency_check'),
        sa.CheckConstraint('altitude_adjustment_percent >= 0', name='trip_stoves_altitude_check'),
        sa.ForeignKeyConstraint(['trip_id'], ['trip_trips.id'], name='trip_stoves_trip_id_fkey', ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id', name='trip_stoves_pkey'),
        sa.UniqueConstraint('trip_id', name='trip_stoves_trip_id_key')
    )
    
    # Revert trip_meals to original schema
    op.drop_table('trip_meals')
    op.create_table('trip_meals',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('trip_day_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('meal_slot', sa.String(length=50), nullable=False),
        sa.Column('recipe_snapshot_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('target_calories_per_person', sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column('scaling_factor', sa.Numeric(precision=10, scale=4), server_default='1.0000', nullable=True),
        sa.Column('rating', sa.Integer(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.CheckConstraint('rating >= 1 AND rating <= 5', name='trip_meals_rating_check'),
        sa.CheckConstraint('target_calories_per_person > 0', name='trip_meals_calories_check'),
        sa.CheckConstraint('scaling_factor > 0', name='trip_meals_scaling_check'),
        sa.CheckConstraint('LENGTH(notes) <= 2000', name='trip_meals_notes_length_check'),
        sa.ForeignKeyConstraint(['recipe_snapshot_id'], ['trip_recipe_snapshots.id'], name='trip_meals_recipe_snapshot_id_fkey'),
        sa.ForeignKeyConstraint(['trip_day_id'], ['trip_days.id'], name='trip_meals_trip_day_id_fkey', ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id', name='trip_meals_pkey'),
        sa.UniqueConstraint('trip_day_id', 'meal_slot', name='trip_meals_trip_day_id_meal_slot_key')
    )
    
    # Remove fields added to existing tables
    op.drop_column('trip_days', 'updated_at')
    op.drop_column('trip_days', 'created_at')
    op.drop_constraint('unique_date_per_trip', 'trip_days', type_='unique')
    op.drop_constraint('day_number_positive_check', 'trip_days', type_='check')
    
    op.drop_constraint('unique_participant_number_per_trip', 'trip_participants', type_='unique')
    op.drop_constraint('unique_participant_name_per_trip', 'trip_participants', type_='unique')
    op.drop_constraint('participant_coefficient_check', 'trip_participants', type_='check')
    op.drop_column('trip_participants', 'departure_date')
    op.drop_column('trip_participants', 'arrival_date')
    op.drop_column('trip_participants', 'meal_coefficients')
    op.drop_column('trip_participants', 'email')
    op.create_check_constraint('trip_participants_coefficient_check', 'trip_participants', 'coefficient > 0 AND coefficient <= 999.99')
    
    op.drop_index('idx_trips_status', table_name='trip_trips')
    op.drop_index('idx_trips_share_token', table_name='trip_trips')
    op.drop_constraint('trip_name_not_empty_check', 'trip_trips', type_='check')
    op.drop_column('trip_trips', 'share_expires_at')
    op.drop_column('trip_trips', 'share_token')
    # Note: description and status fields are managed by migration 010