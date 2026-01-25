-- ADMIN IMMUNITY SYSTEM
-- Prevents deletion or suspension of users with role='admin'

-- 1. Function to check immunity
CREATE OR REPLACE FUNCTION check_admin_immunity()
RETURNS TRIGGER AS $$
BEGIN
    -- Check for DELETION
    IF (TG_OP = 'DELETE') THEN
        IF OLD.role = 'admin' THEN
            RAISE EXCEPTION 'ADMIN IMMUNITY: Cannot delete an Administrator account. This action is blocked by system security rules.';
        END IF;
        RETURN OLD;
    
    -- Check for UPDATE (Suspension)
    ELSIF (TG_OP = 'UPDATE') THEN
        -- Only check if status is changing to a blocked state
        IF OLD.role = 'admin' AND NEW.status IN ('suspended', 'blocked', 'inactive') AND OLD.status = 'active' THEN
             RAISE EXCEPTION 'ADMIN IMMUNITY: Cannot suspend or block an Administrator account. This action is blocked by system security rules.';
        END IF;
        -- Also prevent changing role FROM admin TO something else without explicit override (optional, but good for safety)
        -- IF OLD.role = 'admin' AND NEW.role != 'admin' THEN
        --      RAISE EXCEPTION 'ADMIN IMMUNITY: Cannot demote an Administrator. Create a new account instead.';
        -- END IF;
        
        RETURN NEW;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 2. Drop existing triggers if any to avoid duplicates
DROP TRIGGER IF EXISTS trigger_check_admin_immunity_profiles ON profiles;

-- 3. Apply Trigger to PROFILES table
CREATE TRIGGER trigger_check_admin_immunity_profiles
BEFORE DELETE OR UPDATE ON profiles
FOR EACH ROW
EXECUTE FUNCTION check_admin_immunity();

-- 4. Apply Trigger to USERS table (if you have a users table, usually Supabase uses auth.users which is protected, but if you have a public.users sync)
-- Assuming 'profiles' is the main source of truth for app logic.

COMMENT ON TRIGGER trigger_check_admin_immunity_profiles ON profiles IS 'Protects Admin accounts from deletion or suspension.';
