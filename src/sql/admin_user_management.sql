-- Enable pgcrypto for password hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- RPC to Create Technician User (Securely)
-- RPC to Create Technician User (Securely)
DROP FUNCTION IF EXISTS create_technician_user(TEXT, TEXT, TEXT, TEXT, TEXT);

-- Ensure profiles has updated_at column
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'updated_at') THEN 
        ALTER TABLE public.profiles ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(); 
    END IF; 
END $$;

CREATE OR REPLACE FUNCTION create_technician_user(
    p_email TEXT,
    p_password TEXT,
    p_full_name TEXT,
    p_mobile TEXT,
    p_role TEXT
)
RETURNS UUID AS $$
DECLARE
    new_user_id UUID;
BEGIN
    -- 1. Security Check: Ensure caller is admin
    -- Explicitly specify table alias for columns to avoid ambiguity/conflict
    IF NOT EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    ) THEN
        RAISE EXCEPTION 'Access Denied: Only Admins can create technicians.';
    END IF;

    -- 2. Validate Role
    IF p_role NOT IN ('hub_tech', 'rsa_tech', 'admin') THEN
        RAISE EXCEPTION 'Invalid Role. Can only create technicians or admins.';
    END IF;

    -- 3. Create User in auth.users
    INSERT INTO auth.users (
        instance_id,
        id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        created_at,
        updated_at,
        raw_app_meta_data,
        raw_user_meta_data,
        is_super_admin
    ) VALUES (
        '00000000-0000-0000-0000-000000000000', -- Default Supabase instance ID
        gen_random_uuid(),
        'authenticated',
        'authenticated', -- Postgres Role
        p_email,
        crypt(p_password, gen_salt('bf', 10)), -- Secure hashing with explicit cost 10
        NOW(), -- Auto-confirm email
        NOW(),
        NOW(),
        '{"provider": "email", "providers": ["email"]}', -- CRITICAL: App Metadata for Provider
        jsonb_build_object('full_name', p_full_name, 'role', p_role), -- User Metadata
        FALSE
    )
    RETURNING id INTO new_user_id;

    -- 4. Create Profile in public.profiles
    INSERT INTO public.profiles (id, full_name, mobile, role, status)
    VALUES (new_user_id, p_full_name, p_mobile, p_role, 'active')
    ON CONFLICT (id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        mobile = EXCLUDED.mobile,
        role = EXCLUDED.role,
        status = 'active';

    RETURN new_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- RPC to Delete User Permanently
CREATE OR REPLACE FUNCTION delete_user_permanently(target_user_id UUID)
RETURNS VOID AS $$
BEGIN
    -- 1. Security Check: Ensure caller is admin
    IF NOT EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() AND role = 'admin'
    ) THEN
        RAISE EXCEPTION 'Access Denied: Only Admins can delete users.';
    END IF;

    -- 2. Prevent Self-Deletion
    IF target_user_id = auth.uid() THEN
        RAISE EXCEPTION 'Operation Failed: You cannot delete your own account.';
    END IF;

    -- 3. Delete from public.profiles (Cascade usually handles this, but good to be explicit)
    DELETE FROM public.profiles WHERE id = target_user_id;

    -- 4. Delete from auth.users (This is the critical part)
    DELETE FROM auth.users WHERE id = target_user_id;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- RPC to Reset User Password (to '123456')
CREATE OR REPLACE FUNCTION reset_user_password(target_user_id UUID)
RETURNS VOID AS $$
BEGIN
    -- 1. Security Check: Admin Only
    IF NOT EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() AND role = 'admin'
    ) THEN
        RAISE EXCEPTION 'Access Denied: Only Admins can reset passwords.';
    END IF;

    -- 2. Update auth.users
    UPDATE auth.users
    SET encrypted_password = crypt('123456', gen_salt('bf', 10)),
        updated_at = NOW()
    WHERE id = target_user_id;

    -- 3. Update profile to force change on next login
    UPDATE public.profiles
    SET force_password_change = TRUE,
        updated_at = NOW()
    WHERE id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- RPC to Resolve Password Reset Request
DROP FUNCTION IF EXISTS resolve_reset_request(TEXT);

CREATE OR REPLACE FUNCTION resolve_reset_request(target_user_id UUID)
RETURNS VOID AS $$
DECLARE
    v_mobile TEXT;
BEGIN
    -- 1. Security Check: Admin Only
    IF NOT EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() AND role = 'admin'
    ) THEN
        RAISE EXCEPTION 'Access Denied: Only Admins can manage requests.';
    END IF;

    -- 2. Get User Mobile for fallback matching
    SELECT mobile INTO v_mobile FROM public.profiles WHERE id = target_user_id;

    -- 3. Update status (Match by ID or Mobile to covers all cases)
    -- CHANGE: Using DELETE instead of UPDATE to ensure badge removal
    DELETE FROM public.password_reset_requests
    WHERE (user_id = target_user_id OR (v_mobile IS NOT NULL AND mobile = v_mobile));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- RPC to Update User Details (Securely & syncing status)
CREATE OR REPLACE FUNCTION admin_update_user_details(
    target_user_id UUID,
    p_full_name TEXT,
    p_mobile TEXT,
    p_role TEXT,
    p_status TEXT
)
RETURNS VOID AS $$
BEGIN
    -- 1. Security Check: Admin Only
    IF NOT EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() AND role = 'admin'
    ) THEN
        RAISE EXCEPTION 'Access Denied: Only Admins can update users.';
    END IF;

    -- 2. Update Profile
    UPDATE public.profiles
    SET 
        full_name = p_full_name,
        mobile = p_mobile,
        role = p_role,
        status = p_status,
        updated_at = NOW()
    WHERE id = target_user_id;

    -- 3. If Rider, also sync status to Rider Master (if exists)
    IF p_role = 'rider' THEN
        BEGIN
            UPDATE rider_master
            SET status = p_status
            WHERE mobile = p_mobile; -- Link by Mobile usually for Master Data
        EXCEPTION WHEN undefined_table THEN
            NULL; -- Ignore if table doesn't exist
        END;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
