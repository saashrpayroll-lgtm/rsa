-- SUPER ADMIN RESET (Robust Version)
-- Run this in Supabase SQL Editor

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $do$
DECLARE
    target_mobile TEXT := '9837664056';
    target_password TEXT := 'admin123';
    target_email TEXT;
    u_id UUID;
BEGIN
    target_email := target_mobile || '@hub.com';

    -- 1. Check if user exists
    SELECT id INTO u_id FROM auth.users WHERE email = target_email;

    IF u_id IS NULL THEN
        -- Insert new Admin
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
        ) RETURNING id INTO u_id;
        
        RAISE NOTICE 'Admin User Created with ID: %', u_id;
    ELSE
        -- Reset Password for existing Admin
        UPDATE auth.users 
        SET encrypted_password = crypt(target_password, gen_salt('bf')),
            updated_at = now()
        WHERE id = u_id;
        
        RAISE NOTICE 'Admin Password Reset for ID: %', u_id;
    END IF;

    -- 2. Upsert Profile
    INSERT INTO public.profiles (id, mobile, role, full_name, status)
    VALUES (u_id, target_mobile, 'admin', 'Super Admin', 'active')
    ON CONFLICT (id) DO UPDATE
    SET role = 'admin',
        status = 'active', 
        mobile = EXCLUDED.mobile;
        
    RAISE NOTICE 'Admin Profile Unlocked.';
END $do$;
