-- SUPER RESET SPECIFIC USER
-- Use this to Nuke and Recreate ONE specific user that can't login.
-- REPLACE '9876543210' WITH THE ACTUAL MOBILE NUMBER.

DO $$
DECLARE
    v_mobile TEXT := '9876543210'; -- <<< CHANGE THIS NUMBER
    v_full_name TEXT := 'Technician (Reset)';
    v_role TEXT := 'hub_tech';
    
    v_email TEXT;
    v_instance_id UUID;
BEGIN
    v_email := v_mobile || '@hub.com';

    -- 1. Get correct instance
    SELECT instance_id INTO v_instance_id FROM auth.users WHERE id = auth.uid();
    IF v_instance_id IS NULL THEN v_instance_id := '00000000-0000-0000-0000-000000000000'; END IF;

    RAISE NOTICE 'Targeting Mobile: %', v_mobile;

    -- 2. Delete Everything
    DELETE FROM public.profiles WHERE mobile = v_mobile;
    DELETE FROM auth.users WHERE email = v_email;

    RAISE NOTICE 'Deleted old records.';

    -- 3. Create Fresh Auth User
    INSERT INTO auth.users (
        instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, 
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) VALUES (
        v_instance_id, 
        gen_random_uuid(), 
        'authenticated', 
        'authenticated', 
        v_email, 
        crypt('123456', gen_salt('bf')), -- Standard Hash for '123456'
        NOW(), 
        '{"provider":"email", "providers":["email"]}', 
        jsonb_build_object('full_name', v_full_name, 'role', v_role, 'mobile', v_mobile), 
        NOW(), 
        NOW()
    );

    -- 4. Create Profile (Manually to ensure it links)
    INSERT INTO public.profiles (id, mobile, role, full_name, status)
    SELECT id, v_mobile, v_role, v_full_name, 'active'
    FROM auth.users 
    WHERE email = v_email
    ON CONFLICT (id) DO UPDATE SET
        role = EXCLUDED.role,
        status = 'active';

    RAISE NOTICE '✅ User Recreated Successfully!';
    RAISE NOTICE 'Login: %', v_mobile;
    RAISE NOTICE 'Password: 123456';

END $$;
