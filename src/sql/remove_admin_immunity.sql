-- REMOVE ADMIN IMMUNITY
-- Run this to DISABLE the protection on Admin accounts.

DO $do$
BEGIN
    DROP TRIGGER IF EXISTS trigger_check_admin_immunity_profiles ON public.profiles;
    DROP FUNCTION IF EXISTS check_admin_immunity();

    RAISE NOTICE 'Admin Immunity System has been REMOVED.';
END $do$;
