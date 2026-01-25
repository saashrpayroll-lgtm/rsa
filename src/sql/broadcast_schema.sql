-- FUNCTION: Broadcast Notification
CREATE OR REPLACE FUNCTION broadcast_notification(
    p_title TEXT,
    p_message TEXT,
    p_target_role TEXT, -- 'ALL', 'rider', 'technician'
    p_sender_id UUID
)
RETURNS JSON AS $$
DECLARE
    v_count INT;
BEGIN
    -- 1. Security: Only Admins can broadcast
    IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') THEN
        RETURN json_build_object('success', false, 'message', 'Access Denied');
    END IF;

    -- 2. Insert Logic
    WITH target_users AS (
        SELECT id FROM profiles
        WHERE 
            status = 'active' AND (
                p_target_role = 'ALL' 
                OR (p_target_role = 'rider' AND role = 'rider')
                OR (p_target_role = 'technician' AND role IN ('hub_tech', 'rsa_tech'))
            )
    )
    INSERT INTO notifications (user_id, title, message, type, created_at)
    SELECT id, p_title, p_message, 'INFO', NOW()
    FROM target_users;

    GET DIAGNOSTICS v_count = ROW_COUNT;

    RETURN json_build_object('success', true, 'count', v_count);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
