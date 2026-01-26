-- FOOLPROOF TEST USER CREATOR
-- Creates '9000090000' with password '123456'
-- Bypassing all checks to GUARANTEE a working login.

DO $$
DECLARE
    v_mobile TEXT := '9000090000';
    v_email TEXT := '9000090000@hub.com';
    v_pass TEXT := '123456';
    v_instance_id UUID;
BEGIN
    -- 1. DELETE IF EXISTS (Clean Slate)
    DELETE FROM public.profiles WHERE mobile = v_mobile;
    DELETE FROM auth.users WHERE email = v_email;

    -- 2. GET ADMIN'S INSTANCE ID (To ensure we are in the same 'room')
    SELECT instance_id INTO v_instance_id FROM auth.users WHERE id = auth.uid();
    
    IF v_instance_id IS NULL THEN
        -- Fallback if running via SQL Editor without session, assume 0000... if that's what works
        v_instance_id := '00000000-0000-0000-0000-000000000000'; 
    END IF;
    
    RAISE NOTICE 'Creating Test User % with Instance ID: %', v_mobile, v_instance_id;

    -- 3. INSERT AUTH USER (The Key)
    INSERT INTO auth.users (
        instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, 
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at, is_super_admin
    ) VALUES (
        v_instance_id, 
        gen_random_uuid(), 
        'authenticated', 
        'authenticated', 
        v_email, 
        crypt(v_pass, gen_salt('bf')), -- Standard Bcrypt Hash
        NOW(), 
        '{"provider":"email", "providers":["email"]}', 
        jsonb_build_object('full_name', 'TEST USER', 'role', 'rsa_tech', 'mobile', v_mobile), 
        NOW(), 
        NOW(),
        FALSE
    );

    -- 4. FORCE PROFILE SYNC (The Lock)
    INSERT INTO public.profiles (id, mobile, role, full_name, status)
    SELECT id, v_mobile, 'rsa_tech', 'TEST USER 90000', 'active'
    FROM auth.users WHERE email = v_email
    ON CONFLICT (id) DO UPDATE SET status='active';

    RAISE NOTICE '✅ TEST USER CREATED!';
    RAISE NOTICE 'Mobile: 9000090000';
    RAISE NOTICE 'Password: 123456';
    RAISE NOTICE 'Try logging in with this user.';
END $$;
