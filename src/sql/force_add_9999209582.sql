DO $$
BEGIN
    INSERT INTO public.technician_master (full_name, mobile, role, status)
    VALUES (
        'Technician 9999209582', 
        '9999209582',
        'hub_tech',
        'active'
    )
    ON CONFLICT (mobile) DO UPDATE SET
        status = 'active';

    -- Clean up Auth and Dependencies manually to avoid FK errors
    DECLARE
        v_user_id UUID;
    BEGIN
        SELECT id INTO v_user_id FROM auth.users WHERE email = '9999209582@hub.com';
        
        IF v_user_id IS NOT NULL THEN
            DELETE FROM public.profiles WHERE id = v_user_id;
            DELETE FROM auth.identities WHERE user_id = v_user_id;
            DELETE FROM auth.sessions WHERE user_id = v_user_id;
            DELETE FROM auth.users WHERE id = v_user_id;
        END IF;
    END;

    RAISE NOTICE 'User 9999209582 has been Force-Added to Master and Auth cleared for clean login.';
END $$;
