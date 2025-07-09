-- Database functions and triggers for Jídelníček 2.0

-- =====================================================
-- Helper Functions
-- =====================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- User Limit Functions
-- =====================================================

-- Check recipe limit (500 per user)
CREATE OR REPLACE FUNCTION check_recipe_limit()
RETURNS TRIGGER AS $$
BEGIN
    IF (SELECT recipe_count FROM auth_users WHERE id = NEW.user_id) >= 500 THEN
        RAISE EXCEPTION 'Maximum 500 recipes per user';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Update recipe count
CREATE OR REPLACE FUNCTION update_recipe_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE auth_users SET recipe_count = recipe_count + 1 WHERE id = NEW.user_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE auth_users SET recipe_count = recipe_count - 1 WHERE id = OLD.user_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Check trip limit (100 per user)
CREATE OR REPLACE FUNCTION check_trip_limit()
RETURNS TRIGGER AS $$
BEGIN
    IF (SELECT trip_count FROM auth_users WHERE id = NEW.user_id) >= 100 THEN
        RAISE EXCEPTION 'Maximum 100 trips per user';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Update trip count
CREATE OR REPLACE FUNCTION update_trip_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE auth_users SET trip_count = trip_count + 1 WHERE id = NEW.user_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE auth_users SET trip_count = trip_count - 1 WHERE id = OLD.user_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Check participant limit (20 per trip)
CREATE OR REPLACE FUNCTION check_participant_limit()
RETURNS TRIGGER AS $$
BEGIN
    IF (SELECT COUNT(*) FROM trip_participants WHERE trip_id = NEW.trip_id) >= 20 THEN
        RAISE EXCEPTION 'Maximum 20 participants per trip';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Recipe Fork Tracking
-- =====================================================

-- Increment fork count when a recipe is forked
CREATE OR REPLACE FUNCTION increment_fork_count()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE recipe_recipes 
    SET fork_count = fork_count + 1 
    WHERE id = NEW.original_recipe_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Track fork relationship
CREATE OR REPLACE FUNCTION track_recipe_fork()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.original_recipe_id IS NOT NULL THEN
        INSERT INTO sharing_forks (
            original_recipe_id,
            forked_recipe_id,
            forked_by,
            forked_at
        ) VALUES (
            NEW.original_recipe_id,
            NEW.id,
            NEW.user_id,
            NOW()
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Session Management
-- =====================================================

-- Clean up expired sessions
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS void AS $$
BEGIN
    DELETE FROM auth_sessions WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Update session last accessed time
CREATE OR REPLACE FUNCTION update_session_accessed()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_accessed = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Audit Logging
-- =====================================================

-- Generic audit function
CREATE OR REPLACE FUNCTION audit_trigger()
RETURNS TRIGGER AS $$
DECLARE
    audit_user_id UUID;
    audit_action VARCHAR(50);
BEGIN
    -- Get current user from application context
    audit_user_id := current_setting('app.current_user_id', true)::UUID;
    
    -- Determine action
    IF TG_OP = 'INSERT' THEN
        audit_action := 'CREATE';
    ELSIF TG_OP = 'UPDATE' THEN
        audit_action := 'UPDATE';
    ELSIF TG_OP = 'DELETE' THEN
        audit_action := 'DELETE';
    END IF;
    
    -- Skip audit for certain operations
    IF TG_TABLE_NAME = 'audit_log' THEN
        RETURN NULL;
    END IF;
    
    INSERT INTO audit_log (
        user_id,
        action,
        entity_type,
        entity_id,
        changes,
        ip_address,
        user_agent
    ) VALUES (
        audit_user_id,
        audit_action,
        TG_TABLE_NAME,
        CASE 
            WHEN TG_OP = 'DELETE' THEN OLD.id
            ELSE NEW.id
        END,
        CASE
            WHEN TG_OP = 'INSERT' THEN to_jsonb(NEW)
            WHEN TG_OP = 'UPDATE' THEN jsonb_build_object(
                'old', to_jsonb(OLD),
                'new', to_jsonb(NEW),
                'diff', to_jsonb(NEW) - to_jsonb(OLD)
            )
            WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD)
        END,
        current_setting('app.current_ip', true)::INET,
        current_setting('app.current_user_agent', true)
    );
    
    RETURN NULL;
EXCEPTION
    WHEN OTHERS THEN
        -- Don't fail the operation if audit fails
        RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Archive Management
-- =====================================================

-- Cascade archive to related entities
CREATE OR REPLACE FUNCTION cascade_recipe_archive()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_archived = TRUE AND OLD.is_archived = FALSE THEN
        -- Archive recipe ingredients (soft reference, no action needed)
        -- Archive reviews
        UPDATE sharing_reviews SET recipe_id = NULL WHERE recipe_id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Clean up old archived items
CREATE OR REPLACE FUNCTION cleanup_archived_items(days_to_keep INTEGER DEFAULT 30)
RETURNS TABLE(table_name TEXT, deleted_count INTEGER) AS $$
DECLARE
    cutoff_date TIMESTAMP;
BEGIN
    cutoff_date := NOW() - (days_to_keep || ' days')::INTERVAL;
    
    -- Clean recipes
    WITH deleted AS (
        DELETE FROM recipe_recipes 
        WHERE is_archived = TRUE AND updated_at < cutoff_date
        RETURNING 1
    )
    SELECT 'recipe_recipes', COUNT(*)::INTEGER FROM deleted
    INTO table_name, deleted_count;
    RETURN NEXT;
    
    -- Clean trips
    WITH deleted AS (
        DELETE FROM trip_trips 
        WHERE is_archived = TRUE AND updated_at < cutoff_date
        RETURNING 1
    )
    SELECT 'trip_trips', COUNT(*)::INTEGER FROM deleted
    INTO table_name, deleted_count;
    RETURN NEXT;
    
    -- Clean ingredients
    WITH deleted AS (
        DELETE FROM common_ingredients 
        WHERE is_archived = TRUE AND updated_at < cutoff_date
        RETURNING 1
    )
    SELECT 'common_ingredients', COUNT(*)::INTEGER FROM deleted
    INTO table_name, deleted_count;
    RETURN NEXT;
    
    -- Clean snacks
    WITH deleted AS (
        DELETE FROM common_snacks 
        WHERE is_archived = TRUE AND updated_at < cutoff_date
        RETURNING 1
    )
    SELECT 'common_snacks', COUNT(*)::INTEGER FROM deleted
    INTO table_name, deleted_count;
    RETURN NEXT;
    
    RETURN;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Data Validation Functions
-- =====================================================

-- Validate recipe ingredients before insert/update
CREATE OR REPLACE FUNCTION validate_recipe_ingredients()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if ingredient belongs to user or is global
    IF NOT EXISTS (
        SELECT 1 FROM common_ingredients 
        WHERE id = NEW.ingredient_id 
        AND (
            user_id = (SELECT user_id FROM recipe_recipes WHERE id = NEW.recipe_id)
            OR is_global = TRUE
        )
        AND NOT is_archived
    ) THEN
        RAISE EXCEPTION 'Invalid ingredient: not found or not accessible';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Validate trip dates
CREATE OR REPLACE FUNCTION validate_trip_dates()
RETURNS TRIGGER AS $$
BEGIN
    -- Maximum trip duration is 30 days
    IF (NEW.end_date - NEW.start_date) > 30 THEN
        RAISE EXCEPTION 'Trip duration cannot exceed 30 days';
    END IF;
    
    -- Start date cannot be more than 1 year in the future
    IF NEW.start_date > CURRENT_DATE + INTERVAL '1 year' THEN
        RAISE EXCEPTION 'Trip start date cannot be more than 1 year in the future';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Apply Triggers
-- =====================================================

-- Updated timestamp triggers
CREATE TRIGGER update_auth_users_updated_at BEFORE UPDATE ON auth_users
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_ingredients_updated_at BEFORE UPDATE ON common_ingredients
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_snacks_updated_at BEFORE UPDATE ON common_snacks
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_recipes_updated_at BEFORE UPDATE ON recipe_recipes
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_trips_updated_at BEFORE UPDATE ON trip_trips
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_reviews_updated_at BEFORE UPDATE ON sharing_reviews
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Session management triggers
CREATE TRIGGER update_session_accessed_trigger BEFORE UPDATE ON auth_sessions
FOR EACH ROW EXECUTE FUNCTION update_session_accessed();

-- User limit triggers
CREATE TRIGGER recipe_limit_check
BEFORE INSERT ON recipe_recipes
FOR EACH ROW EXECUTE FUNCTION check_recipe_limit();

CREATE TRIGGER recipe_count_update
AFTER INSERT OR DELETE ON recipe_recipes
FOR EACH ROW EXECUTE FUNCTION update_recipe_count();

CREATE TRIGGER trip_limit_check
BEFORE INSERT ON trip_trips
FOR EACH ROW EXECUTE FUNCTION check_trip_limit();

CREATE TRIGGER trip_count_update
AFTER INSERT OR DELETE ON trip_trips
FOR EACH ROW EXECUTE FUNCTION update_trip_count();

CREATE TRIGGER participant_limit_check
BEFORE INSERT ON trip_participants
FOR EACH ROW EXECUTE FUNCTION check_participant_limit();

-- Fork tracking triggers
CREATE TRIGGER fork_counter
AFTER INSERT ON recipe_recipes
FOR EACH ROW 
WHEN (NEW.original_recipe_id IS NOT NULL)
EXECUTE FUNCTION increment_fork_count();

CREATE TRIGGER track_fork
AFTER INSERT ON recipe_recipes
FOR EACH ROW 
WHEN (NEW.original_recipe_id IS NOT NULL)
EXECUTE FUNCTION track_recipe_fork();

-- Validation triggers
CREATE TRIGGER validate_recipe_ingredients_trigger
BEFORE INSERT OR UPDATE ON recipe_recipe_ingredients
FOR EACH ROW EXECUTE FUNCTION validate_recipe_ingredients();

CREATE TRIGGER validate_trip_dates_trigger
BEFORE INSERT OR UPDATE ON trip_trips
FOR EACH ROW EXECUTE FUNCTION validate_trip_dates();

-- Archive cascade triggers
CREATE TRIGGER cascade_recipe_archive_trigger
AFTER UPDATE ON recipe_recipes
FOR EACH ROW 
WHEN (NEW.is_archived IS DISTINCT FROM OLD.is_archived)
EXECUTE FUNCTION cascade_recipe_archive();

-- Audit triggers (apply to important tables)
CREATE TRIGGER audit_recipes AFTER INSERT OR UPDATE OR DELETE ON recipe_recipes
FOR EACH ROW EXECUTE FUNCTION audit_trigger();

CREATE TRIGGER audit_trips AFTER INSERT OR UPDATE OR DELETE ON trip_trips
FOR EACH ROW EXECUTE FUNCTION audit_trigger();

CREATE TRIGGER audit_users AFTER UPDATE OR DELETE ON auth_users
FOR EACH ROW EXECUTE FUNCTION audit_trigger();

CREATE TRIGGER audit_ingredients AFTER INSERT OR UPDATE OR DELETE ON common_ingredients
FOR EACH ROW EXECUTE FUNCTION audit_trigger();

-- =====================================================
-- Scheduled Maintenance Functions
-- =====================================================

-- Create a function to be called by pg_cron or external scheduler
CREATE OR REPLACE FUNCTION perform_maintenance()
RETURNS TABLE(task TEXT, result TEXT) AS $$
BEGIN
    -- Clean expired sessions
    PERFORM cleanup_expired_sessions();
    RETURN QUERY SELECT 'cleanup_sessions'::TEXT, 'completed'::TEXT;
    
    -- Clean old archived items (older than 30 days)
    RETURN QUERY 
    SELECT 
        'cleanup_archived_' || table_name::TEXT, 
        'deleted ' || deleted_count::TEXT || ' items'
    FROM cleanup_archived_items(30);
    
    -- Update table statistics
    ANALYZE;
    RETURN QUERY SELECT 'analyze_tables'::TEXT, 'completed'::TEXT;
    
    RETURN;
END;
$$ LANGUAGE plpgsql;