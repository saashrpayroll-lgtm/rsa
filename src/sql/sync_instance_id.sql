-- SYNC INSTANCE ID (STRICT)
-- 1. Finds the TRUE instance_id from your working Admin account.
-- 2. Applies it to ALL technicians.
-- 3. Resets password to '123456' one last time (using simple hash).

DO $$
DECLARE
    v_admin_instance_id UUID;
    v_count INT;
BEGIN
    -- 1. Find the Instance ID of the First Admin
    SELECT u.instance_id INTO v_admin_instance_id
    FROM auth.users u
    JOIN public.profiles p ON p.id = u.id
    WHERE p.role = 'admin'
    LIMIT 1;

    IF v_admin_instance_id IS NULL THEN
        RAISE EXCEPTION 'Could not find an Admin account to copy Instance ID from!';
    END IF;

    RAISE NOTICE 'Found Valid Instance ID: %', v_admin_instance_id;

    -- 2. Update ALL Techs & Riders to use this ID
    UPDATE auth.users
    SET instance_id = v_admin_instance_id,
        aud = 'authenticated',
        role = 'authenticated',
        updated_at = NOW()
    WHERE id IN (
        SELECT id FROM public.profiles 
        WHERE role IN ('hub_tech', 'rsa_tech', 'rider')
    );

    -- 3. Reset Password to 123456 (Standard Hash)
    UPDATE auth.users
    SET encrypted_password = crypt('123456', gen_salt('bf')),
        email_confirmed_at = COALESCE(email_confirmed_at, NOW())
    WHERE id IN (
        SELECT id FROM public.profiles 
        WHERE role IN ('hub_tech', 'rsa_tech')
    );

    GET DIAGNOSTICS v_count = ROW_COUNT;

    RAISE NOTICE '------------------------------------------------';
    RAISE NOTICE '✅ INSTANCE ID SYNC COMPLETE';
    RAISE NOTICE 'Synced % users to Instance: %', v_count, v_admin_instance_id;
    RAISE NOTICE 'Passwords reset to: 123456';
    RAISE NOTICE '------------------------------------------------';

END $$;
