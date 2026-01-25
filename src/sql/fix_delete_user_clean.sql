-- UPDATED DELETE FUNCTION (Try copying this EXACTLY)

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

    -- 3. Delete from public.profiles
    DELETE FROM public.profiles WHERE id = target_user_id;

    -- 4. Delete from auth schema tables 
    DELETE FROM auth.identities WHERE user_id = target_user_id;
    DELETE FROM auth.sessions WHERE user_id = target_user_id;
    
    -- 5. Delete from auth.users (Final)
    DELETE FROM auth.users WHERE id = target_user_id;
    
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
