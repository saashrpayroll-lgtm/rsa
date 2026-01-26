-- FIXED: REPAIR & RESET SCRIPT (Simpler Hashing)
-- 1. Updates Instance ID to match the Admin's ID (or 0000...)
-- 2. Resets Password to '123456' using standard bcrypt cost
-- 3. Ensures Email Confirmed

DO $$
DECLARE
    v_admin_instance_id UUID;
    v_count INT;
BEGIN
    -- 1. Get the Admin's Instance ID (The one executing this script)
    SELECT instance_id INTO v_admin_instance_id FROM auth.users WHERE id = auth.uid();
    
    -- Fallback
    IF v_admin_instance_id IS NULL THEN
        v_admin_instance_id := '00000000-0000-0000-0000-000000000000';
    END IF;

    RAISE NOTICE 'Using Reference Instance ID: %', v_admin_instance_id;

    -- 2. Update Instance ID for ALL Techs to match Admin
    UPDATE auth.users
    SET instance_id = v_admin_instance_id,
        aud = 'authenticated',
        role = 'authenticated',
        email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
        updated_at = NOW()
    WHERE id IN (
        SELECT id FROM public.profiles WHERE role IN ('hub_tech', 'rsa_tech', 'rider')
    );

    -- 3. Reset Passwords for Technicians
    -- Using gen_salt('bf') without explicit cost to match standard Supabase defaults
    UPDATE auth.users
    SET encrypted_password = crypt('123456', gen_salt('bf')),
        updated_at = NOW()
    WHERE id IN (
        SELECT id FROM public.profiles 
        WHERE role IN ('hub_tech', 'rsa_tech')
    );

    GET DIAGNOSTICS v_count = ROW_COUNT;

    RAISE NOTICE '------------------------------------------------';
    RAISE NOTICE '✅ REPAIR COMPLETE';
    RAISE NOTICE 'Technician Passwords Reset to: 123456';
    RAISE NOTICE 'Synced Instance ID to: %', v_admin_instance_id;
    RAISE NOTICE 'Affected Users: %', v_count;
    RAISE NOTICE '------------------------------------------------';

END $$;
