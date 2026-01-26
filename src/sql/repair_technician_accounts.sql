-- REPAIR BROKEN TECHNICIAN ACCOUNTS
-- This script fixes any user accounts that were created with the wrong Instance ID (0000...)

DO $$
DECLARE
    v_correct_instance_id UUID;
    v_fixed_count INT;
BEGIN
    -- 1. Find a "Good" Instance ID (e.g., from the Super Admin or any user that ISN'T broken)
    SELECT instance_id INTO v_correct_instance_id 
    FROM auth.users 
    WHERE instance_id != '00000000-0000-0000-0000-000000000000' 
    LIMIT 1;

    IF v_correct_instance_id IS NULL THEN
        RAISE EXCEPTION 'Could not find a valid Instance ID to copy. Do you have any working users?';
    END IF;

    RAISE NOTICE 'Found valid Instance ID: %', v_correct_instance_id;

    -- 2. Update all "Broken" users to use this ID
    UPDATE auth.users
    SET instance_id = v_correct_instance_id,
        updated_at = NOW()
    WHERE instance_id = '00000000-0000-0000-0000-000000000000';

    GET DIAGNOSTICS v_fixed_count = ROW_COUNT;

    RAISE NOTICE '------------------------------------------------';
    RAISE NOTICE '✅ REPAIR COMPLETE';
    RAISE NOTICE 'Fixed % user accounts.', v_fixed_count;
    RAISE NOTICE '------------------------------------------------';
    
    -- 3. Optional: Reset their passwords to '123456' just in case hashing was also weird
    -- Uncomment the below lines if login still fails after repair
    /*
    UPDATE auth.users
    SET encrypted_password = crypt('123456', gen_salt('bf', 10))
    WHERE instance_id = v_correct_instance_id 
    AND id IN (SELECT id FROM profiles WHERE role IN ('hub_tech', 'rsa_tech'));
    */

END $$;
