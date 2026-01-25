-- DEBUG SCRIPT: CHECK USER LOGIN STATUS
-- Replace '9876543210' with the user's mobile number.

DO $$
DECLARE
    v_mobile TEXT := '9876543210'; -- <--- UPDATE THIS
    v_profile RECORD;
    v_auth_user RECORD;
BEGIN
    RAISE NOTICE '--- START DEBUGGING FOR MOBILE: % ---', v_mobile;

    -- 1. Check Profile
    SELECT * INTO v_profile FROM public.profiles WHERE mobile = v_mobile;
    
    IF v_profile IS NULL THEN
        RAISE NOTICE '❌ Profile NOT FOUND in public.profiles table.';
    ELSE
        RAISE NOTICE '✅ Profile Found: ID=%, Role=%, Status=%', v_profile.id, v_profile.role, v_profile.status;
    END IF;

    -- 2. Check Auth User
    IF v_profile IS NOT NULL THEN
        SELECT id, email, encrypted_password, email_confirmed_at, last_sign_in_at, aud, role 
        INTO v_auth_user 
        FROM auth.users 
        WHERE id = v_profile.id;

        IF v_auth_user IS NULL THEN
            RAISE NOTICE '❌ Auth User NOT FOUND in auth.users table (Sync Issue!).';
        ELSE
            RAISE NOTICE '✅ Auth User Found: Email=%', v_auth_user.email;
            RAISE NOTICE '   - Confirmed At: % (Must not be NULL)', v_auth_user.email_confirmed_at;
            RAISE NOTICE '   - Role: % (Should be authenticated)', v_auth_user.role;
            RAISE NOTICE '   - Aud: % (Should be authenticated)', v_auth_user.aud;
            
            IF v_auth_user.encrypted_password IS NULL THEN
                 RAISE NOTICE '❌ Password is NULL!';
            ELSE
                 RAISE NOTICE '✅ Password Hash Exists (Length: %)', length(v_auth_user.encrypted_password);
            END IF;
        END IF;
    END IF;

    RAISE NOTICE '--- END DEBUGGING ---';
END $$;
