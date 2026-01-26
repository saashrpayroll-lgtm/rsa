-- DIAGNOSTIC TOOL v2: CHECK LOGIN ISSUES & PASSWORD
-- Run this: SELECT * FROM diagnose_user_login('9876543210');

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
    pass_check BOOLEAN;
BEGIN
    -- 1. Check Auth User
    SELECT * INTO user_record FROM auth.users WHERE email = target_email;
    
    IF user_record.id IS NOT NULL THEN
        RETURN QUERY SELECT 'Auth User Exists', 'PASS', 'User ID: ' || user_record.id::text;
        
        -- Check Instance ID
        SELECT instance_id INTO admin_instance_id FROM auth.users WHERE id = auth.uid();
        -- If admin is null (running in SQL editor), use known zero
        IF admin_instance_id IS NULL THEN admin_instance_id := '00000000-0000-0000-0000-000000000000'; END IF;
        
        IF user_record.instance_id = admin_instance_id THEN
             RETURN QUERY SELECT 'Instance ID Match', 'PASS', 'Matches Admin (or 0000...)';
        ELSE
             RETURN QUERY SELECT 'Instance ID Match', 'FAIL', 'User: ' || user_record.instance_id::text || ' != Admin: ' || admin_instance_id::text;
        END IF;

        -- Check Email Confirmation
        IF user_record.email_confirmed_at IS NOT NULL THEN
             RETURN QUERY SELECT 'Email Confirmed', 'PASS', 'Confirmed at: ' || user_record.email_confirmed_at;
        ELSE
             RETURN QUERY SELECT 'Email Confirmed', 'FAIL', 'Email NOT confirmed';
        END IF;

        -- Check Password Hash
        IF user_record.encrypted_password IS NOT NULL THEN
             -- Verify if it matches '123456'
             pass_check := (user_record.encrypted_password = crypt('123456', user_record.encrypted_password));
             
             IF pass_check THEN
                RETURN QUERY SELECT 'Password Check', 'PASS', 'Password is exactly "123456"';
             ELSE
                RETURN QUERY SELECT 'Password Check', 'FAIL', 'Password is NOT "123456" (Hash mismatch)';
             END IF;
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
             RETURN QUERY SELECT 'Link Integrity', 'FAIL', 'Profile ID ' || profile_record.id::text || ' != Auth ID ' || COALESCE(user_record.id::text, 'NULL');
        END IF;
    ELSE
         RETURN QUERY SELECT 'Profile Exists', 'FAIL', 'No profile found for mobile: ' || check_mobile;
    END IF;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
