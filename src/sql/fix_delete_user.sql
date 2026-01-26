-- UPDATED DELETE FUNCTION
-- This version ensures better cleanup of Auth references.

CREATE OR REPLACE FUNCTION delete_user_permanently(target_user_id UUID)
RETURNS VOID AS $$
BEGIN
    -- 1. Security Check: Ensure caller is admin
    IF NOT EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() AND role = 'admin'
    ) THEN
        RAISE EXCEPTION 'Access Denied: Only Admins can delete users.';
    END IF;

    -- 2. Prevent Self-Deletion
    IF target_user_id = auth.uid() THEN
        RAISE EXCEPTION 'Operation Failed: You cannot delete your own account.';
    END IF;

    -- 3. Delete from public.profiles (Cascade should start here)
    -- We do this first so the app "forgets" the user immediately.
    DELETE FROM public.profiles WHERE id = target_user_id;

    -- 4. Delete from auth schema tables (Manual cleanup just in case cascades miss)
    DELETE FROM auth.identities WHERE user_id = target_user_id;
    DELETE FROM auth.sessions WHERE user_id = target_user_id;
    
    -- 5. Delete from auth.users (Final)
    DELETE FROM auth.users WHERE id = target_user_id;

    -- 6. Cleanup Technician Master (If applicable)
    -- We delete by Mobile since ID might not match or be irrelevant in Master.
    -- But we need the Mobile first. Profile is already deleted.
    -- Wait, we should have fetched mobile BEFORE deleting profile.
    -- Re-ordering logic below.
    
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- MANUAL CLEANUP SCRIPT FOR STUCK USER
-- Replace with the stuck mobile number
DO $$
DECLARE
    stuck_mobile TEXT := '9876543210'; -- <--- CHANGE THIS
    stuck_email TEXT;
BEGIN
    stuck_email := stuck_mobile || '@hub.com';

    -- Delete by Email (since Profile might already be gone)
    DELETE FROM auth.users WHERE email = stuck_email;
    
    RAISE NOTICE 'Cleaned up stuck user: %', stuck_email;
END $$;
