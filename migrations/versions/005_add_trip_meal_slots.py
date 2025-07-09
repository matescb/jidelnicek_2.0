"""Add trip meal slots table for flexible meal configuration.

Revision ID: 005
Revises: 004
Create Date: 2025-01-09
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers
revision = '005'
down_revision = '004'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """
    Create trip_meal_slots table for flexible meal slot configuration.
    
    This table allows trips to have different meal patterns per day,
    enabling scenarios like no breakfast on day 1, or adding snacks on specific days.
    """
    op.create_table(
        'trip_meal_slots',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('trip_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('day_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('day_number', sa.Integer(), nullable=False),
        sa.Column('meal_type', sa.String(50), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('custom_name', sa.String(100), nullable=True),
        sa.Column('display_order', sa.Integer(), nullable=False, server_default=sa.text('0')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['trip_id'], ['trip_trips.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['day_id'], ['trip_days.id'], ondelete='CASCADE'),
        sa.CheckConstraint('day_number >= 1', name='meal_slot_day_number_check'),
        sa.CheckConstraint('display_order >= 0', name='meal_slot_display_order_check'),
        sa.UniqueConstraint('trip_id', 'day_number', 'meal_type', name='unique_trip_day_meal_type')
    )
    
    # Create indexes for performance
    op.create_index('idx_meal_slots_trip', 'trip_meal_slots', ['trip_id'])
    op.create_index('idx_meal_slots_day', 'trip_meal_slots', ['day_id'])
    op.create_index('idx_meal_slots_trip_day', 'trip_meal_slots', ['trip_id', 'day_number'])
    op.create_index('idx_meal_slots_active', 'trip_meal_slots', ['trip_id', 'is_active'], postgresql_where=sa.text('is_active = true'))
    
    # Add comment to table
    op.execute("COMMENT ON TABLE trip_meal_slots IS 'Flexible meal slot configuration for trips, allowing different meal patterns per day'")
    
    # Add comments to columns
    op.execute("COMMENT ON COLUMN trip_meal_slots.meal_type IS 'Type of meal (e.g., Breakfast, Lunch, Dinner, Snack)'")
    op.execute("COMMENT ON COLUMN trip_meal_slots.is_active IS 'Whether this meal slot is active for the day'")
    op.execute("COMMENT ON COLUMN trip_meal_slots.custom_name IS 'Optional custom name for the meal slot (e.g., Brunch instead of Breakfast)'")
    op.execute("COMMENT ON COLUMN trip_meal_slots.display_order IS 'Order for displaying meal slots (e.g., Breakfast=1, Lunch=2, Dinner=3)'")
    
    # Create a function to automatically populate meal slots when days are created
    op.execute("""
        CREATE OR REPLACE FUNCTION create_default_meal_slots_for_day()
        RETURNS TRIGGER AS $$
        DECLARE
            trip_record RECORD;
            meal_type TEXT;
            order_num INTEGER;
        BEGIN
            -- Get trip information
            SELECT * INTO trip_record FROM trip_trips WHERE id = NEW.trip_id;
            
            -- Only create meal slots if trip has meal_slots defined
            IF trip_record.meal_slots IS NOT NULL AND jsonb_array_length(trip_record.meal_slots) > 0 THEN
                order_num := 1;
                -- Create a meal slot for each meal type in the trip's meal_slots array
                FOR meal_type IN SELECT jsonb_array_elements_text(trip_record.meal_slots)
                LOOP
                    INSERT INTO trip_meal_slots (
                        trip_id, day_id, day_number, meal_type, 
                        is_active, display_order
                    ) VALUES (
                        NEW.trip_id, NEW.id, NEW.day_number, meal_type,
                        true, order_num
                    );
                    order_num := order_num + 1;
                END LOOP;
            END IF;
            
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)
    
    # Create trigger to automatically create meal slots for new days
    op.execute("""
        CREATE TRIGGER create_meal_slots_on_day_insert
        AFTER INSERT ON trip_days
        FOR EACH ROW
        EXECUTE FUNCTION create_default_meal_slots_for_day();
    """)
    
    # Create a function to update meal slot references when meal type is changed
    op.execute("""
        CREATE OR REPLACE FUNCTION update_meal_references_on_slot_change()
        RETURNS TRIGGER AS $$
        BEGIN
            -- Update any meal references if meal_type changes
            IF OLD.meal_type != NEW.meal_type THEN
                UPDATE trip_meals 
                SET meal_slot = NEW.meal_type 
                WHERE day_id = NEW.day_id AND meal_slot = OLD.meal_type;
            END IF;
            
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)
    
    # Create trigger to update meal references when meal slot changes
    op.execute("""
        CREATE TRIGGER update_meals_on_slot_change
        AFTER UPDATE OF meal_type ON trip_meal_slots
        FOR EACH ROW
        EXECUTE FUNCTION update_meal_references_on_slot_change();
    """)


def downgrade() -> None:
    """Drop meal slots table and related objects."""
    # Drop triggers first
    op.execute("DROP TRIGGER IF EXISTS update_meals_on_slot_change ON trip_meal_slots")
    op.execute("DROP TRIGGER IF EXISTS create_meal_slots_on_day_insert ON trip_days")
    
    # Drop functions
    op.execute("DROP FUNCTION IF EXISTS update_meal_references_on_slot_change()")
    op.execute("DROP FUNCTION IF EXISTS create_default_meal_slots_for_day()")
    
    # Drop indexes
    op.drop_index('idx_meal_slots_active', table_name='trip_meal_slots')
    op.drop_index('idx_meal_slots_trip_day', table_name='trip_meal_slots')
    op.drop_index('idx_meal_slots_day', table_name='trip_meal_slots')
    op.drop_index('idx_meal_slots_trip', table_name='trip_meal_slots')
    
    # Drop table
    op.drop_table('trip_meal_slots')