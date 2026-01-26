-- FOOLPROOF USER v2 (COST 10)
-- Retrying SQL creation with Cost 10, which matches Supabase Default.

DO $$
DECLARE
    v_mobile TEXT := '9000090000';
    v_email TEXT := '9000090000@hub.com';
    v_pass TEXT := '123456';
    v_instance_id UUID;
    v_hash TEXT;
BEGIN
    -- 1. CLEANUP
    DELETE FROM public.profiles WHERE mobile = v_mobile;
    DELETE FROM auth.users WHERE email = v_email;

    -- 2. GET INSTANCE
    SELECT instance_id INTO v_instance_id FROM auth.users WHERE id = auth.uid();
    IF v_instance_id IS NULL THEN v_instance_id := '00000000-0000-0000-0000-000000000000'; END IF;

    -- 3. GENERATE HASH (Cost 10)
    -- This mimics GoTrue default
    v_hash := crypt(v_pass, gen_salt('bf', 10));

    -- 4. INSERT
    INSERT INTO auth.users (
        instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, 
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) VALUES (
        v_instance_id, gen_random_uuid(), 'authenticated', 'authenticated', v_email, 
        v_hash, NOW(), 
        '{"provider":"email", "providers":["email"]}', 
        jsonb_build_object('full_name', 'TEST USER 10', 'role', 'rsa_tech', 'mobile', v_mobile), 
        NOW(), NOW()
    );

    -- 5. PROFILE
    INSERT INTO public.profiles (id, mobile, role, full_name, status)
    SELECT id, v_mobile, 'rsa_tech', 'TEST USER 10', 'active'
    FROM auth.users WHERE email = v_email;

    RAISE NOTICE '✅ Created User (Cost 10): %', v_mobile;
END $$;
