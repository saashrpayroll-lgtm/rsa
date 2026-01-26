-- DIAGNOSTIC: COPY ADMIN PASSWORD
-- This copies the working Admin's password hash to the Technician.
-- If this works, it means the SQL-generated hash was the problem.

DO $$
DECLARE
    v_admin_hash TEXT;
    v_target_mobile TEXT := '9999209582'; -- The mobile you are testing
    v_target_email TEXT;
BEGIN
    v_target_email := v_target_mobile || '@hub.com';

    -- 1. Get the hash from the Admin (You, the one running this script)
    SELECT encrypted_password INTO v_admin_hash 
    FROM auth.users 
    WHERE id = auth.uid();

    IF v_admin_hash IS NULL THEN
        RAISE EXCEPTION 'Could not find YOUR admin password hash. Are you logged in to SQL Editor?';
    END IF;

    -- 2. Apply it to the Technician
    UPDATE auth.users
    SET encrypted_password = v_admin_hash,
        updated_at = NOW()
    WHERE email = v_target_email;

    IF NOT FOUND THEN
         RAISE EXCEPTION 'Could not find technician with email: %', v_target_email;
    END IF;

    RAISE NOTICE '✅ PASSWORD COPIED!';
    RAISE NOTICE 'Try logging in as Technician (% ) using YOUR ADMIN PASSWORD.', v_target_mobile;

END $$;
