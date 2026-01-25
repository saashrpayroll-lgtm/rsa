-- HARD RESET ADMIN (Delete & Re-Create)
-- Run this if "Invalid Credentials" persists.
-- This forces a fresh account.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $do$
DECLARE
    target_mobile TEXT := '9837664056'; -- YOUR MOBILE
    target_password TEXT := 'admin123';
    target_email TEXT;
BEGIN
    target_email := target_mobile || '@hub.com';

    -- 1. NUKE IT (Delete existing user if any)
    -- We do this to clear any bad password hashes or weird states
    DELETE FROM public.profiles WHERE mobile = target_mobile;
    DELETE FROM auth.users WHERE email = target_email;
    
    RAISE NOTICE 'Old Admin Account Deleted (if it existed).';

    -- 2. CREATE FRESH
    INSERT INTO auth.users (
        instance_id, id, aud, role, email, encrypted_password, 
        email_confirmed_at, raw_app_meta_data, raw_user_meta_data, 
        created_at, updated_at
    )
    VALUES (
        '00000000-0000-0000-0000-000000000000', 
        gen_random_uuid(), 
        'authenticated', 
        'authenticated', 
        target_email, 
        crypt(target_password, gen_salt('bf')), 
        now(), 
        '{"provider":"email","providers":["email"]}', 
        '{"full_name":"Super Admin","role":"admin"}',
        now(), 
        now()
    );

    -- 3. SYNC PROFILE
    INSERT INTO public.profiles (id, mobile, role, full_name, status)
    SELECT id, target_mobile, 'admin', 'Super Admin', 'active'
    FROM auth.users 
    WHERE email = target_email;

    RAISE NOTICE '✅ NEW ADMIN ACCOUNT CREATED!';
    RAISE NOTICE 'Login: %', target_mobile;
    RAISE NOTICE 'Password: %', target_password;
END $do$;
