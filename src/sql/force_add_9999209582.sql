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

    DELETE FROM auth.users WHERE email = '9999209582@hub.com';

    RAISE NOTICE 'User 9999209582 has been Force-Added to Master and Auth cleared for clean login.';
END $$;
