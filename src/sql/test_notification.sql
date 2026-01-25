-- ==========================================
-- TEST SCRIPT: VERIFY NOTIFICATION SYSTEM
-- ==========================================

-- 1. Get your own User ID
-- We'll send a notification to YOU (the currently logged-in admin)

do $$
declare
    v_my_id uuid;
begin
    v_my_id := auth.uid();

    if v_my_id is null then
        raise notice 'No user logged in. Please run this in the SQL Editor while authenticated, or replace auth.uid() with a specific UUID.';
    else
        -- 2. Insert Test Notification
        insert into notifications (user_id, title, message, type)
        values (
            v_my_id,
            'System Verification',
            'Hello! The notification system is fully operational. 🚀',
            'SUCCESS'
        );
        
        raise notice 'Test notification sent to User ID: %', v_my_id;
    end if;
end;
$$;

-- 3. Verify it exists
select * from notifications order by created_at desc limit 1;
