-- DIAGNOSTIC TOOL: CHECK LOGIN ISSUES
-- Run this function with the mobile number that can't login:
-- SELECT diagnose_user_login('9876543210');

CREATE OR REPLACE FUNCTION diagnose_user_login(check_mobile TEXT)
RETURNS TABLE (
    check_item TEXT,
    status TEXT,
    details TEXT
) AS $$
DECLARE
    target_email TEXT := check_mobile || '@hub.com';
    user_record RECORD;
    profile_record RECORD;
    admin_instance_id UUID;
BEGIN
    -- 1. Check Auth User
    SELECT * INTO user_record FROM auth.users WHERE email = target_email;
    
    IF user_record.id IS NOT NULL THEN
        RETURN QUERY SELECT 'Auth User Exists', 'PASS', 'User ID: ' || user_record.id;
        
        -- Check Instance ID
        SELECT instance_id INTO admin_instance_id FROM auth.users WHERE id = auth.uid();
        
        IF user_record.instance_id = admin_instance_id THEN
             RETURN QUERY SELECT 'Instance ID Match', 'PASS', 'Matches Admin Instance';
        ELSE
             RETURN QUERY SELECT 'Instance ID Match', 'FAIL', 'User Instance: ' || user_record.instance_id || ', Admin Instance: ' || COALESCE(admin_instance_id::text, 'NULL');
        END IF;

        -- Check Email Confirmation
        IF user_record.email_confirmed_at IS NOT NULL THEN
             RETURN QUERY SELECT 'Email Confirmed', 'PASS', 'Confirmed at: ' || user_record.email_confirmed_at;
        ELSE
             RETURN QUERY SELECT 'Email Confirmed', 'FAIL', 'Email NOT confirmed';
        END IF;

        -- Check Password Hash
        IF user_record.encrypted_password IS NOT NULL THEN
             RETURN QUERY SELECT 'Password Hash', 'PASS', 'Hash exists (cannot verify correctness)';
        ELSE
             RETURN QUERY SELECT 'Password Hash', 'FAIL', 'No password set';
        END IF;

    ELSE
        RETURN QUERY SELECT 'Auth User Exists', 'FAIL', 'No user found in auth.users with email: ' || target_email;
    END IF;

    -- 2. Check Profile
    SELECT * INTO profile_record FROM public.profiles WHERE mobile = check_mobile;
    
    IF profile_record.id IS NOT NULL THEN
        RETURN QUERY SELECT 'Profile Exists', 'PASS', 'Role: ' || profile_record.role;
        
        IF user_record.id IS NOT NULL AND user_record.id = profile_record.id THEN
             RETURN QUERY SELECT 'Link Integrity', 'PASS', 'Profile ID matches Auth ID';
        ELSE
             RETURN QUERY SELECT 'Link Integrity', 'FAIL', 'Profile ID ' || profile_record.id || ' != Auth ID ' || COALESCE(user_record.id::text, 'NULL');
        END IF;
    ELSE
         RETURN QUERY SELECT 'Profile Exists', 'FAIL', 'No profile found for mobile: ' || check_mobile;
    END IF;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
