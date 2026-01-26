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

    -- 3. Get Instance ID (More robustly)
    SELECT instance_id INTO v_instance_id FROM auth.users WHERE id = auth.uid();
    
    IF v_instance_id IS NULL THEN
        -- Fallback: Use any existing instance_id from the table
        SELECT instance_id INTO v_instance_id FROM auth.users WHERE instance_id IS NOT NULL LIMIT 1;
    END IF;
    
    -- 4. Sync with Technician Master (Source of Truth)
    -- This is the ONLY thing we do now. We rely on JIT (Just-In-Time) provisioning at first login
    -- to create the actual Auth User and Profile. This avoids hash compatibility issues.
    
    INSERT INTO public.technician_master (full_name, mobile, role, status)
    VALUES (p_full_name, p_mobile, p_role, 'active')
    ON CONFLICT (mobile) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        role = EXCLUDED.role,
        status = 'active';

    -- 5. Cleanup overlapping Auth/Profile if they exist brokenly
    -- If an auth user exists for this mobile, we DELETE it to ensure fresh JIT creation
    -- This acts as an auto-repair during creation/update
    DELETE FROM auth.users WHERE email = p_mobile || '@hub.com';

    -- Return a dummy UUID since we didn't create a real user yet
    -- The real ID will be generated when they login
    RETURN '00000000-0000-0000-0000-000000000000'::uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- AUTO-REPAIR FUNCTION
-- Call this if Login fails due to "Database error" or likely broken auth state
CREATE OR REPLACE FUNCTION repair_technician_account(check_mobile TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    v_tech_exists BOOLEAN;
    v_user_id UUID;
BEGIN
    -- 1. Verify existence in Master
    SELECT EXISTS (SELECT 1 FROM public.technician_master WHERE mobile = check_mobile) INTO v_tech_exists;
    
    IF NOT v_tech_exists THEN
        RETURN FALSE; -- Cannot repair non-master user
    END IF;

    -- 2. Delete Auth User (and cascade to Profile) to allow fresh SignUp
    -- Finding user by email (inferred from mobile)
    DELETE FROM auth.users WHERE email = check_mobile || '@hub.com';
    
    -- Also delete by metadata if possible, just in case email doesn't match
    -- DELETE FROM auth.users WHERE raw_user_meta_data->>'mobile' = check_mobile; 

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; -- Needs high privilege to delete from auth.users

-- Grant permission
GRANT EXECUTE ON FUNCTION repair_technician_account(TEXT) TO anon, authenticated, service_role;
