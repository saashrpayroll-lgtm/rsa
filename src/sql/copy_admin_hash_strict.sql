-- COPY ADMIN PASSWORD (STRICT MODE)
-- 1. Finds the FIRST Admin user in your database.
-- 2. Copies their password hash to the target Technician.
-- 3. You can then login as the Tech using YOUR Admin Password.

DO $$
DECLARE
    v_admin_email TEXT;
    v_admin_hash TEXT;
    v_target_mobile TEXT := '9999209582'; -- <<< TARGET TECH MOBILE
    v_target_email TEXT;
BEGIN
    v_target_email := v_target_mobile || '@hub.com';

    -- 1. Find YOUR Admin account (via Profiles)
    SELECT u.email, u.encrypted_password 
    INTO v_admin_email, v_admin_hash
    FROM auth.users u
    JOIN public.profiles p ON p.id = u.id
    WHERE p.role = 'admin'
    LIMIT 1;

    IF v_admin_hash IS NULL THEN
        RAISE EXCEPTION 'No Admin found in profiles! Cannot copy password.';
    END IF;

    RAISE NOTICE 'Found Admin: %', v_admin_email;

    -- 2. Copy the hash to the Technician
    UPDATE auth.users
    SET encrypted_password = v_admin_hash,
        updated_at = NOW(),
        email_confirmed_at = COALESCE(email_confirmed_at, NOW()) -- Ensure confirmed
    WHERE email = v_target_email;

    IF NOT FOUND THEN
         RAISE EXCEPTION 'Could not find technician with email: %', v_target_email;
    END IF;

    RAISE NOTICE '------------------------------------------------';
    RAISE NOTICE '✅ SUCCESS!';
    RAISE NOTICE 'Please login as Technician (%) using YOUR ADMIN PASSWORD.', v_target_mobile;
    RAISE NOTICE '------------------------------------------------';

END $$;
