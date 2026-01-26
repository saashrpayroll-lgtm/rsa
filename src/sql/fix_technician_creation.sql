-- Fix Technician Creation (Stable Version)

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
    v_instance_id UUID;
BEGIN
    -- 1. Security Check
    IF NOT EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    ) THEN
        RAISE EXCEPTION 'Access Denied: Only Admins can create technicians.';
    END IF;

    -- 2. Validate Role
    IF p_role NOT IN ('hub_tech', 'rsa_tech', 'admin') THEN
        RAISE EXCEPTION 'Invalid Role.';
    END IF;

    -- 3. Get Instance ID from Admin
    SELECT instance_id INTO v_instance_id FROM auth.users WHERE id = auth.uid();
    
    IF v_instance_id IS NULL THEN
        v_instance_id := '00000000-0000-0000-0000-000000000000';
    END IF;

    -- 4. Create User in auth.users
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
        v_instance_id,
        gen_random_uuid(),
        'authenticated',
        'authenticated', 
        p_email,
        crypt(p_password, gen_salt('bf')), -- Standard cost
        NOW(),
        NOW(),
        NOW(),
        '{"provider": "email", "providers": ["email"]}',
        jsonb_build_object('full_name', p_full_name, 'role', p_role),
        FALSE
    )
    RETURNING id INTO new_user_id;

    -- 5. Create Profile
    INSERT INTO public.profiles (id, full_name, mobile, role, status)
    VALUES (new_user_id, p_full_name, p_mobile, p_role, 'active')
    ON CONFLICT (id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        mobile = EXCLUDED.mobile,
        role = EXCLUDED.role,
        status = 'active';

    -- 6. Sync with Technician Master (Source of Truth)
    INSERT INTO public.technician_master (full_name, mobile, role, status)
    VALUES (p_full_name, p_mobile, p_role, 'active')
    ON CONFLICT (mobile) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        role = EXCLUDED.role,
        status = 'active';

    RETURN new_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
