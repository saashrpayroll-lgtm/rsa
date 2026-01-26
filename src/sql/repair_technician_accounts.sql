-- FORCE REPAIR & RESET SCRIPT
-- 1. Fixes Instance ID (Forces 0000...)
-- 2. Resets Password to '123456' for ALL technicians
-- 3. Ensures Email Confirmed

DO $$
DECLARE
    v_instance_id UUID := '00000000-0000-0000-0000-000000000000';
    v_count INT;
BEGIN
    -- 1. Update Instance ID for ALL users (Ensuring consistency)
    -- We target everyone to be safe, or just techs if you prefer.
    -- Let's target everyone who ISN'T the super admin (just to be safe), 
    -- but actually, if the admin works with 0000, everyone should be 0000.
    UPDATE auth.users
    SET instance_id = v_instance_id,
        aud = 'authenticated',
        role = 'authenticated',
        email_confirmed_at = COALESCE(email_confirmed_at, NOW()), -- Ensure confirmed
        updated_at = NOW()
    WHERE instance_id != v_instance_id;

    -- 2. Reset Passwords for Technicians (RSA & Hub)
    -- This ensures the hash is generated correctly by pgcrypto matches what we expect
    UPDATE auth.users
    SET encrypted_password = crypt('123456', gen_salt('bf')), -- Default cost
        updated_at = NOW()
    WHERE id IN (
        SELECT id FROM public.profiles 
        WHERE role IN ('hub_tech', 'rsa_tech')
    );

    GET DIAGNOSTICS v_count = ROW_COUNT;

    RAISE NOTICE '------------------------------------------------';
    RAISE NOTICE '✅ FORCE REPAIR COMPLETE';
    RAISE NOTICE 'Technician Passwords Reset to: 123456';
    RAISE NOTICE 'Instance IDs Normalized.';
    RAISE NOTICE 'Affected Techs: %', v_count;
    RAISE NOTICE '------------------------------------------------';

END $$;
