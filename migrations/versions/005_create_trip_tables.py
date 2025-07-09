"""Create trip planning tables

Revision ID: 005
Revises: 004
Create Date: 2025-01-09 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '005'
down_revision = '004_add_performance_indexes'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create trip planning tables."""
    
    # =====================================================
    # Trip Module (trip_*)
    # =====================================================
    
    # Add missing columns to existing trip_trips table (table already created in migration 001)
    op.add_column('trip_trips', sa.Column('recipe_storage_mode', sa.String(length=20), server_default='snapshot', nullable=False))
    op.add_column('trip_trips', sa.Column('notes', sa.Text(), nullable=True))
    
    # Update meal_slots default value to English
    op.alter_column('trip_trips', 'meal_slots', server_default='["Breakfast", "Lunch", "Dinner"]')
    
    # Add missing check constraints
    op.create_check_constraint('trip_trips_storage_mode_check', 'trip_trips', "recipe_storage_mode IN ('snapshot', 'track_changes')")
    op.create_check_constraint('trip_trips_notes_length_check', 'trip_trips', 'LENGTH(notes) <= 2000')
    
    # Update existing constraint name for consistency
    op.drop_constraint('trip_trips_check', 'trip_trips', type_='check')
    op.create_check_constraint('trip_trips_date_check', 'trip_trips', 'end_date >= start_date')
    
    # Enhance existing trip_participants table (table already created in migration 001)
    op.add_column('trip_participants', sa.Column('created_at', sa.TIMESTAMP(), server_default=sa.text('now()'), nullable=True))
    op.add_column('trip_participants', sa.Column('updated_at', sa.TIMESTAMP(), server_default=sa.text('now()'), nullable=True))
    
    # Update constraints to match migration 005 requirements
    op.drop_constraint('trip_participants_check', 'trip_participants', type_='check')
    op.drop_constraint('trip_participants_coefficient_check', 'trip_participants', type_='check')
    
    op.create_check_constraint('trip_participants_name_or_number_check', 'trip_participants', '(name IS NOT NULL) OR (number IS NOT NULL)')
    op.create_check_constraint('trip_participants_coefficient_check', 'trip_participants', 'coefficient > 0 AND coefficient <= 999.99')
    
    # Enhance existing trip_days table (table already created in migration 001)
    # Add missing check constraints not present in migration 001
    op.create_check_constraint('trip_days_day_number_check', 'trip_days', 'day_number > 0')
    op.create_check_constraint('trip_days_notes_length_check', 'trip_days', 'LENGTH(notes) <= 2000')
    
    # Update constraint name to match migration 005 style
    op.drop_constraint('trip_days_trip_id_day_number_key', 'trip_days', type_='unique')
    op.create_unique_constraint('trip_days_trip_id_day_number_key', 'trip_days', ['trip_id', 'day_number'])
    
    # Note: trip_recipe_snapshots table already exists from migration 001 with identical structure
    # No modifications needed - table structure is the same
    
    # Enhance existing trip_meals table (table already created in migration 001)
    # Add missing check constraints not present in migration 001
    op.create_check_constraint('trip_meals_calories_check', 'trip_meals', 'target_calories_per_person > 0')
    op.create_check_constraint('trip_meals_scaling_check', 'trip_meals', 'scaling_factor > 0')
    op.create_check_constraint('trip_meals_notes_length_check', 'trip_meals', 'LENGTH(notes) <= 2000')
    
    # Update constraint name to match migration 005 style
    op.drop_constraint('trip_meals_trip_day_id_meal_slot_key', 'trip_meals', type_='unique')
    op.create_unique_constraint('trip_meals_trip_day_id_meal_slot_key', 'trip_meals', ['trip_day_id', 'meal_slot'])
    
    # Create trip_day_snacks table
    op.create_table('trip_day_snacks',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('trip_day_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('snack_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('quantity_per_person', sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column('total_quantity', sa.Numeric(precision=10, scale=2), nullable=False),
        sa.CheckConstraint('quantity_per_person > 0', name='trip_day_snacks_per_person_check'),
        sa.CheckConstraint('total_quantity > 0', name='trip_day_snacks_total_check'),
        sa.ForeignKeyConstraint(['snack_id'], ['common_snacks.id'], name='trip_day_snacks_snack_id_fkey'),
        sa.ForeignKeyConstraint(['trip_day_id'], ['trip_days.id'], name='trip_day_snacks_trip_day_id_fkey', ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id', name='trip_day_snacks_pkey')
    )
    
    # Create trip_day_drinks table
    op.create_table('trip_day_drinks',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('trip_day_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('ingredient_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('quantity_per_person', sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column('total_quantity', sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column('water_ml', sa.Integer(), server_default='0', nullable=True),
        sa.CheckConstraint('quantity_per_person > 0', name='trip_day_drinks_per_person_check'),
        sa.CheckConstraint('total_quantity > 0', name='trip_day_drinks_total_check'),
        sa.CheckConstraint('water_ml >= 0', name='trip_day_drinks_water_check'),
        sa.ForeignKeyConstraint(['ingredient_id'], ['common_ingredients.id'], name='trip_day_drinks_ingredient_id_fkey'),
        sa.ForeignKeyConstraint(['trip_day_id'], ['trip_days.id'], name='trip_day_drinks_trip_day_id_fkey', ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id', name='trip_day_drinks_pkey')
    )
    
    # Create trip_stoves table
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
    
    # Create trip_templates table
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
    
    # =====================================================
    # Create indexes for performance
    # =====================================================
    
    # Trip indexes
    op.create_index('idx_trips_user', 'trip_trips', ['user_id'], unique=False, postgresql_where=sa.text('NOT is_archived'))
    op.create_index('idx_trips_dates', 'trip_trips', ['start_date', 'end_date'], unique=False, postgresql_where=sa.text('NOT is_archived'))
    op.create_index('idx_trips_created', 'trip_trips', ['created_at'], unique=False)
    
    # Participant indexes
    op.create_index('idx_trip_participants_trip', 'trip_participants', ['trip_id'], unique=False)
    
    # Day indexes
    op.create_index('idx_trip_days_trip', 'trip_days', ['trip_id'], unique=False)
    op.create_index('idx_trip_days_date', 'trip_days', ['date'], unique=False)
    
    # Meal indexes
    op.create_index('idx_trip_meals_day', 'trip_meals', ['trip_day_id'], unique=False)
    op.create_index('idx_trip_meals_snapshot', 'trip_meals', ['recipe_snapshot_id'], unique=False)
    
    # Snack and drink indexes
    op.create_index('idx_trip_day_snacks_day', 'trip_day_snacks', ['trip_day_id'], unique=False)
    op.create_index('idx_trip_day_drinks_day', 'trip_day_drinks', ['trip_day_id'], unique=False)
    
    # Template indexes
    op.create_index('idx_trip_templates_user', 'trip_templates', ['user_id'], unique=False, postgresql_where=sa.text('NOT is_archived'))
    
    # =====================================================
    # Create triggers for trip count management
    # =====================================================
    
    # Function to check trip limit (100 per user)
    op.execute("""
        CREATE OR REPLACE FUNCTION check_trip_limit()
        RETURNS TRIGGER AS $$
        BEGIN
            IF (SELECT trip_count FROM auth_users WHERE id = NEW.user_id) >= 100 THEN
                RAISE EXCEPTION 'Maximum 100 active trips per user';
            END IF;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)
    
    # Trigger to check trip limit before insert
    op.execute("""
        CREATE TRIGGER trip_limit_check
        BEFORE INSERT ON trip_trips
        FOR EACH ROW EXECUTE FUNCTION check_trip_limit();
    """)
    
    # Function to update trip count
    op.execute("""
        CREATE OR REPLACE FUNCTION update_trip_count()
        RETURNS TRIGGER AS $$
        BEGIN
            IF TG_OP = 'INSERT' THEN
                UPDATE auth_users SET trip_count = trip_count + 1 WHERE id = NEW.user_id;
            ELSIF TG_OP = 'DELETE' THEN
                UPDATE auth_users SET trip_count = trip_count - 1 WHERE id = OLD.user_id;
            ELSIF TG_OP = 'UPDATE' THEN
                IF OLD.is_archived = FALSE AND NEW.is_archived = TRUE THEN
                    UPDATE auth_users SET trip_count = trip_count - 1 WHERE id = NEW.user_id;
                ELSIF OLD.is_archived = TRUE AND NEW.is_archived = FALSE THEN
                    UPDATE auth_users SET trip_count = trip_count + 1 WHERE id = NEW.user_id;
                END IF;
            END IF;
            RETURN NULL;
        END;
        $$ LANGUAGE plpgsql;
    """)
    
    # Trigger to update trip count after insert/update/delete
    op.execute("""
        CREATE TRIGGER trip_count_update
        AFTER INSERT OR UPDATE OR DELETE ON trip_trips
        FOR EACH ROW EXECUTE FUNCTION update_trip_count();
    """)
    
    # Function to update timestamps
    op.execute("""
        CREATE OR REPLACE FUNCTION update_trip_updated_at()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = now();
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)
    
    # Triggers for updated_at columns
    op.execute("""
        CREATE TRIGGER update_trip_trips_updated_at
        BEFORE UPDATE ON trip_trips
        FOR EACH ROW EXECUTE FUNCTION update_trip_updated_at();
    """)
    
    op.execute("""
        CREATE TRIGGER update_trip_participants_updated_at
        BEFORE UPDATE ON trip_participants
        FOR EACH ROW EXECUTE FUNCTION update_trip_updated_at();
    """)
    
    op.execute("""
        CREATE TRIGGER update_trip_templates_updated_at
        BEFORE UPDATE ON trip_templates
        FOR EACH ROW EXECUTE FUNCTION update_trip_updated_at();
    """)


def downgrade() -> None:
    """Drop trip planning tables."""
    
    # Drop triggers first
    op.execute("DROP TRIGGER IF EXISTS update_trip_templates_updated_at ON trip_templates")
    op.execute("DROP TRIGGER IF EXISTS update_trip_participants_updated_at ON trip_participants")
    op.execute("DROP TRIGGER IF EXISTS update_trip_trips_updated_at ON trip_trips")
    op.execute("DROP TRIGGER IF EXISTS trip_count_update ON trip_trips")
    op.execute("DROP TRIGGER IF EXISTS trip_limit_check ON trip_trips")
    
    # Drop functions
    op.execute("DROP FUNCTION IF EXISTS update_trip_updated_at()")
    op.execute("DROP FUNCTION IF EXISTS update_trip_count()")
    op.execute("DROP FUNCTION IF EXISTS check_trip_limit()")
    
    # Drop indexes
    op.drop_index('idx_trip_templates_user', table_name='trip_templates')
    op.drop_index('idx_trip_day_drinks_day', table_name='trip_day_drinks')
    op.drop_index('idx_trip_day_snacks_day', table_name='trip_day_snacks')
    op.drop_index('idx_trip_meals_snapshot', table_name='trip_meals')
    op.drop_index('idx_trip_meals_day', table_name='trip_meals')
    op.drop_index('idx_trip_days_date', table_name='trip_days')
    op.drop_index('idx_trip_days_trip', table_name='trip_days')
    op.drop_index('idx_trip_participants_trip', table_name='trip_participants')
    op.drop_index('idx_trips_created', table_name='trip_trips')
    op.drop_index('idx_trips_dates', table_name='trip_trips')
    op.drop_index('idx_trips_user', table_name='trip_trips')
    
    # Drop new tables created in this migration (in reverse order of dependencies)
    op.drop_table('trip_templates')
    op.drop_table('trip_stoves')
    op.drop_table('trip_day_drinks')
    op.drop_table('trip_day_snacks')
    
    # Revert constraint changes to existing tables
    # Revert trip_meals constraints
    op.drop_constraint('trip_meals_notes_length_check', 'trip_meals', type_='check')
    op.drop_constraint('trip_meals_scaling_check', 'trip_meals', type_='check')
    op.drop_constraint('trip_meals_calories_check', 'trip_meals', type_='check')
    op.drop_constraint('trip_meals_trip_day_id_meal_slot_key', 'trip_meals', type_='unique')
    op.create_unique_constraint('trip_meals_trip_day_id_meal_slot_key', 'trip_meals', ['trip_day_id', 'meal_slot'])
    
    # Revert trip_days constraints
    op.drop_constraint('trip_days_notes_length_check', 'trip_days', type_='check')
    op.drop_constraint('trip_days_day_number_check', 'trip_days', type_='check')
    op.drop_constraint('trip_days_trip_id_day_number_key', 'trip_days', type_='unique')
    op.create_unique_constraint('trip_days_trip_id_day_number_key', 'trip_days', ['trip_id', 'day_number'])
    
    # Revert trip_participants constraints
    op.drop_constraint('trip_participants_coefficient_check', 'trip_participants', type_='check')
    op.drop_constraint('trip_participants_name_or_number_check', 'trip_participants', type_='check')
    op.create_check_constraint('trip_participants_check', 'trip_participants', '(name IS NOT NULL) OR (number IS NOT NULL)')
    op.create_check_constraint('trip_participants_coefficient_check', 'trip_participants', 'coefficient > 0')
    
    # Remove added columns from trip_participants
    op.drop_column('trip_participants', 'updated_at')
    op.drop_column('trip_participants', 'created_at')
    
    # Remove columns and constraints added to existing trip_trips table (don't drop the table itself)
    op.drop_constraint('trip_trips_notes_length_check', 'trip_trips', type_='check')
    op.drop_constraint('trip_trips_storage_mode_check', 'trip_trips', type_='check')
    op.drop_constraint('trip_trips_date_check', 'trip_trips', type_='check')
    
    # Restore original constraint name
    op.create_check_constraint('trip_trips_check', 'trip_trips', 'end_date >= start_date')
    
    # Restore original meal_slots default value
    op.alter_column('trip_trips', 'meal_slots', server_default='["Snídaně", "Oběd", "Večeře"]')
    
    # Remove added columns
    op.drop_column('trip_trips', 'notes')
    op.drop_column('trip_trips', 'recipe_storage_mode')