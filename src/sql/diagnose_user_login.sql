-- Diagnostic Script for User 9999209582

DO $$
DECLARE
    v_mobile TEXT := '9999209582';
    v_in_master BOOLEAN;
    v_in_profiles BOOLEAN;
    v_in_auth BOOLEAN;
    v_profile_role TEXT;
    v_master_role TEXT;
BEGIN
    -- Check Master
    SELECT EXISTS(SELECT 1 FROM public.technician_master WHERE mobile = v_mobile) INTO v_in_master;
    SELECT role INTO v_master_role FROM public.technician_master WHERE mobile = v_mobile;
    
    -- Check Profiles
    SELECT EXISTS(SELECT 1 FROM public.profiles WHERE mobile = v_mobile) INTO v_in_profiles;
    SELECT role INTO v_profile_role FROM public.profiles WHERE mobile = v_mobile;

    -- Check Auth (approximate by email)
    SELECT EXISTS(SELECT 1 FROM auth.users WHERE email = v_mobile || '@hub.com') INTO v_in_auth;

    RAISE NOTICE '--- DIAGNOSTIC RESULTS FOR % ---', v_mobile;
    RAISE NOTICE 'Exists in Technician Master: % (Role: %)', v_in_master, v_master_role;
    RAISE NOTICE 'Exists in Profiles: % (Role: %)', v_in_profiles, v_profile_role;
    RAISE NOTICE 'Exists in Auth.Users: %', v_in_auth;
    
    IF NOT v_in_master THEN
        RAISE NOTICE 'CRITICAL: User is MISSING from Master List. Login will fail.';
        RAISE NOTICE 'SUGGESTION: Run `sync_existing_technicians.sql` or add manually.';
    END IF;

    IF v_in_master AND v_in_auth THEN
        RAISE NOTICE 'User in Master AND Auth. Standard login SHOULD work.';
        RAISE NOTICE 'If failing, password hash might be wrong. Trigger Repair by deleting Auth?';
    END IF;

    IF v_in_master AND NOT v_in_auth THEN
        RAISE NOTICE 'User in Master but NOT Auth. JIT Login SHOULD work.';
    END IF;

END $$;
