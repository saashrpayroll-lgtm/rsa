-- EMERGENCY ADMIN PASSWORD RESET SCRIPT
-- RUN THIS IN SUPABASE SQL EDITOR

-- 1. Enable pgcrypto if not already enabled (required for password hashing)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Variables (Replace with your Admin Mobile if different)
DO $$
DECLARE
    target_mobile TEXT := '9837664056'; -- ENTER YOUR ADMIN MOBILE HERE
    new_password TEXT := 'admin123';
    target_email TEXT;
BEGIN
    target_email := target_mobile || '@hub.com';

    -- 3. Update the password in auth.users
    UPDATE auth.users
    SET encrypted_password = crypt(new_password, gen_salt('bf')),
        updated_at = now()
    WHERE email = target_email;

    IF FOUND THEN
        RAISE NOTICE 'Password for Admin (%) has been reset to: %', target_mobile, new_password;
    ELSE
        RAISE NOTICE 'Admin user with mobile % not found!', target_mobile;
    END IF;
END $$;
