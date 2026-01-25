-- DIAGNOSTIC: CHECK ADMIN STATUS
-- Run this to see if your Admin account is ready.

DO $do$
DECLARE
    target_mobile TEXT := '9837664056';
    target_email TEXT;
    u_count INT;
    p_count INT;
BEGIN
    target_email := target_mobile || '@hub.com';
    
    SELECT count(*) INTO u_count FROM auth.users WHERE email = target_email;
    SELECT count(*) INTO p_count FROM public.profiles WHERE mobile = target_mobile AND role = 'admin';
    
    RAISE NOTICE '------------------------------------------------';
    RAISE NOTICE 'DIAGNOSTIC RESULTS FOR: %', target_mobile;
    RAISE NOTICE '------------------------------------------------';
    
    IF u_count > 0 THEN
        RAISE NOTICE '✅ Auth User: FOUND';
    ELSE
        RAISE NOTICE '❌ Auth User: MISSING (Run recreate_admin_completely.sql)';
    END IF;
    
    IF p_count > 0 THEN
        RAISE NOTICE '✅ Admin Profile: FOUND';
    ELSE
        RAISE NOTICE '❌ Admin Profile: MISSING or NOT ADMIN (Run recreate_admin_completely.sql)';
    END IF;
    
    IF u_count > 0 AND p_count > 0 THEN
         RAISE NOTICE '🎉 ACCOUNT IS VALID. If login fails, check Vercel ENV VARS.';
    END IF;
    
    RAISE NOTICE '------------------------------------------------';
END $do$;
