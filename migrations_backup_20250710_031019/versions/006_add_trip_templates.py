"""Add trip templates table for reusable trip configurations.

Revision ID: 006
Revises: 005
Create Date: 2025-01-09
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers
revision = '006'
down_revision = '005'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """
    Create trip_templates table for saving and reusing trip configurations.
    
    This table allows users to save trip structures as templates that can be
    reused when creating new trips. Templates can be private or public.
    """
    op.create_table(
        'trip_templates',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('duration_days', sa.Integer(), nullable=False),
        sa.Column('meal_slots', postgresql.JSONB(), nullable=False, server_default=sa.text('\'["Breakfast", "Lunch", "Dinner"]\'::jsonb')),
        sa.Column('participants', postgresql.JSONB(), nullable=False, server_default=sa.text('\'[]\'::jsonb')),
        sa.Column('meal_assignments', postgresql.JSONB(), nullable=False, server_default=sa.text('\'{}\'::jsonb')),
        sa.Column('is_public', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('category', sa.String(50), nullable=True),
        sa.Column('tags', postgresql.JSONB(), nullable=False, server_default=sa.text('\'[]\'::jsonb')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['user_id'], ['auth_users.id'], ondelete='CASCADE'),
        sa.CheckConstraint('duration_days > 0', name='template_duration_check'),
        sa.CheckConstraint('LENGTH(name) > 0', name='template_name_not_empty'),
        sa.CheckConstraint('jsonb_array_length(meal_slots) > 0', name='template_meal_slots_not_empty')
    )
    
    # Create indexes for performance
    op.create_index('idx_templates_user', 'trip_templates', ['user_id'])
    op.create_index('idx_templates_public', 'trip_templates', ['is_public', 'category'], postgresql_where=sa.text('is_public'))
    op.create_index('idx_templates_category', 'trip_templates', ['category'], postgresql_where=sa.text('category IS NOT NULL'))
    
    # Add comment to table
    op.execute("COMMENT ON TABLE trip_templates IS 'Reusable trip configurations that can be saved and shared by users'")
    
    # Add comments to columns
    op.execute("COMMENT ON COLUMN trip_templates.name IS 'User-friendly name for the template'")
    op.execute("COMMENT ON COLUMN trip_templates.description IS 'Optional description of the template'")
    op.execute("COMMENT ON COLUMN trip_templates.duration_days IS 'Number of days in the trip template'")
    op.execute("COMMENT ON COLUMN trip_templates.meal_slots IS 'Array of meal slot names for the trip'")
    op.execute("COMMENT ON COLUMN trip_templates.participants IS 'Array of participant templates with name and coefficient'")
    op.execute("COMMENT ON COLUMN trip_templates.meal_assignments IS 'Object mapping days and meal slots to recipe/meal configurations'")
    op.execute("COMMENT ON COLUMN trip_templates.is_public IS 'Whether this template is available to all users'")
    op.execute("COMMENT ON COLUMN trip_templates.category IS 'Template category (e.g., Family, Sports, School)'")
    op.execute("COMMENT ON COLUMN trip_templates.tags IS 'Array of tags for template organization'")
    
    # Create a function to validate participant coefficients
    op.execute("""
        CREATE OR REPLACE FUNCTION validate_template_participants(participants jsonb)
        RETURNS boolean AS $$
        DECLARE
            participant jsonb;
            coefficient numeric;
        BEGIN
            -- Check if participants is an array
            IF jsonb_typeof(participants) != 'array' THEN
                RETURN false;
            END IF;
            
            -- Validate each participant
            FOR participant IN SELECT * FROM jsonb_array_elements(participants)
            LOOP
                -- Check required fields
                IF NOT (participant ? 'name' AND participant ? 'coefficient') THEN
                    RETURN false;
                END IF;
                
                -- Check name is not empty
                IF LENGTH(participant->>'name') = 0 THEN
                    RETURN false;
                END IF;
                
                -- Check coefficient is valid
                BEGIN
                    coefficient := (participant->>'coefficient')::numeric;
                    IF coefficient <= 0 OR coefficient > 2 THEN
                        RETURN false;
                    END IF;
                EXCEPTION WHEN OTHERS THEN
                    RETURN false;
                END;
            END LOOP;
            
            RETURN true;
        END;
        $$ LANGUAGE plpgsql IMMUTABLE;
    """)
    
    # Add constraint using the validation function
    op.execute("""
        ALTER TABLE trip_templates
        ADD CONSTRAINT template_participants_valid
        CHECK (validate_template_participants(participants))
    """)
    
    # Create a function to clean and validate tags
    op.execute("""
        CREATE OR REPLACE FUNCTION clean_template_tags()
        RETURNS TRIGGER AS $$
        DECLARE
            cleaned_tags jsonb;
            tag text;
            tag_array text[];
        BEGIN
            -- Initialize empty array
            tag_array := ARRAY[]::text[];
            
            -- Process each tag
            IF jsonb_typeof(NEW.tags) = 'array' THEN
                FOR tag IN SELECT jsonb_array_elements_text(NEW.tags)
                LOOP
                    -- Clean and validate tag
                    tag := LOWER(TRIM(tag));
                    IF LENGTH(tag) > 0 AND LENGTH(tag) <= 30 THEN
                        -- Add to array if not already present
                        IF NOT (tag = ANY(tag_array)) THEN
                            tag_array := array_append(tag_array, tag);
                        END IF;
                    END IF;
                END LOOP;
            END IF;
            
            -- Convert back to jsonb
            NEW.tags := to_jsonb(tag_array);
            
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)
    
    # Create trigger to clean tags before insert/update
    op.execute("""
        CREATE TRIGGER clean_tags_before_save
        BEFORE INSERT OR UPDATE OF tags ON trip_templates
        FOR EACH ROW
        EXECUTE FUNCTION clean_template_tags();
    """)
    
    # Create a view for public templates with user info
    op.execute("""
        CREATE VIEW public_trip_templates AS
        SELECT 
            t.id,
            t.name,
            t.description,
            t.duration_days,
            t.meal_slots,
            t.participants,
            t.meal_assignments,
            t.category,
            t.tags,
            t.created_at,
            t.updated_at,
            u.username as created_by_username,
            u.email as created_by_email
        FROM trip_templates t
        INNER JOIN auth_users u ON t.user_id = u.id
        WHERE t.is_public = true;
    """)
    
    # Add comment to view
    op.execute("COMMENT ON VIEW public_trip_templates IS 'Public trip templates with creator information'")


def downgrade() -> None:
    """Drop trip templates table and related objects."""
    # Drop view first
    op.execute("DROP VIEW IF EXISTS public_trip_templates")
    
    # Drop triggers
    op.execute("DROP TRIGGER IF EXISTS clean_tags_before_save ON trip_templates")
    
    # Drop functions
    op.execute("DROP FUNCTION IF EXISTS clean_template_tags()")
    op.execute("DROP FUNCTION IF EXISTS validate_template_participants(jsonb)")
    
    # Drop indexes
    op.drop_index('idx_templates_category', table_name='trip_templates')
    op.drop_index('idx_templates_public', table_name='trip_templates')
    op.drop_index('idx_templates_user', table_name='trip_templates')
    
    # Drop table
    op.drop_table('trip_templates')