-- CHECK USER EXISTS (SECURE RPC)
-- Returns user details if they exist in Profiles (even if Auth is missing/broken)

CREATE OR REPLACE FUNCTION check_user_exists(check_mobile TEXT)
RETURNS TABLE (
    found_role TEXT,
    found_name TEXT,
    found_status TEXT
) AS $$
DECLARE
    clean_mobile TEXT;
BEGIN
    -- Sanitize input just in case
    clean_mobile := regexp_replace(check_mobile, '[^0-9]', '', 'g');
    IF length(clean_mobile) > 10 THEN
        clean_mobile := substring(clean_mobile from length(clean_mobile)-9 for 10);
    END IF;

    RETURN QUERY 
    SELECT role, full_name, status
    FROM public.profiles
    WHERE mobile = clean_mobile
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
