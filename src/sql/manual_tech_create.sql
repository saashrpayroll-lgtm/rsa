-- TEST SCRIPT: RECREATE SPECIFIC RIDER/TECH
-- Use this if specific logins are stuck

DO $$
DECLARE
    v_mobile TEXT := '9999999999'; -- CHANGE THIS to test logic
    v_email TEXT := '9999999999@hub.com';
    v_pass TEXT := '123456';
    v_instance_id UUID;
BEGIN
    -- 1. Cleanup
    DELETE FROM public.profiles WHERE mobile = v_mobile;
    DELETE FROM auth.users WHERE email = v_email;

    -- 2. Get correct instance
    SELECT instance_id INTO v_instance_id FROM auth.users WHERE id = auth.uid();
    IF v_instance_id IS NULL THEN v_instance_id := '00000000-0000-0000-0000-000000000000'; END IF;

    -- 3. Insert fresh
    INSERT INTO auth.users (
        instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, 
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) VALUES (
        v_instance_id, gen_random_uuid(), 'authenticated', 'authenticated', v_email, 
        crypt(v_pass, gen_salt('bf')), NOW(), 
        '{"provider":"email"}', jsonb_build_object('role', 'rsa_tech'), NOW(), NOW()
    );
    
    -- Sync Profile (via trigger or manual - manual here for safety)
    INSERT INTO public.profiles (id, mobile, role, full_name, status)
    SELECT id, v_mobile, 'rsa_tech', 'Test Tech 999', 'active'
    FROM auth.users WHERE email = v_email
    ON CONFLICT (id) DO NOTHING;

    RAISE NOTICE '✅ Created Test Tech: % / %', v_mobile, v_pass;
END $$;
