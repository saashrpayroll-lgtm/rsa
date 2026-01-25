-- FORCE RESET BROADCAST FUNCTION
-- Run this ENTIRE block in Supabase SQL Editor

-- 1. Drop ALL variations of the function to clear conflicts
DROP FUNCTION IF EXISTS public.broadcast_notification(TEXT, TEXT, TEXT, UUID);
DROP FUNCTION IF EXISTS public.broadcast_notification(text, text, text, uuid);

-- 2. Create the function fresh
CREATE OR REPLACE FUNCTION public.broadcast_notification(
    p_title TEXT,
    p_message TEXT,
    p_target_role TEXT,
    p_sender_id UUID
)
RETURNS JSON AS $$
DECLARE
    v_count INT;
BEGIN
    -- Security Check
    IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') THEN
        RETURN json_build_object('success', false, 'message', 'Access Denied: Admin only');
    END IF;

    -- Insert Logic
    WITH target_users AS (
        SELECT id FROM profiles
        WHERE 
            status = 'active' AND (
                p_target_role = 'ALL' 
                OR (p_target_role = 'rider' AND role = 'rider')
                OR (p_target_role = 'technician' AND role IN ('hub_tech', 'rsa_tech'))
            )
    )
    INSERT INTO notifications (user_id, title, message, type, created_at, is_read)
    SELECT id, p_title, p_message, 'INFO', NOW(), false
    FROM target_users;

    GET DIAGNOSTICS v_count = ROW_COUNT;

    RETURN json_build_object('success', true, 'count', v_count);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Grant Permissions Explicitly
GRANT EXECUTE ON FUNCTION public.broadcast_notification(TEXT, TEXT, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.broadcast_notification(TEXT, TEXT, TEXT, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.broadcast_notification(TEXT, TEXT, TEXT, UUID) TO anon; -- Just in case (though auth check blocks it)

-- 4. Notify to refresh schema cache (Comment only)
-- AFTER RUNNING THIS: Go to Project Settings -> API -> "Reload schema cache"
