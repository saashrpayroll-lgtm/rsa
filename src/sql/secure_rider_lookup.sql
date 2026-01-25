-- Secure Function to check rider eligibility without exposing the whole table
CREATE OR REPLACE FUNCTION check_rider_eligibility(check_mobile TEXT)
RETURNS TABLE (
    full_name TEXT,
    status TEXT,
    chassis_number TEXT,
    wallet_balance NUMERIC,
    team_leader_name TEXT,
    mobile TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with privileges of the creator (bypasses RLS)
SET search_path = public -- Security best practice
AS $$
BEGIN
    RETURN QUERY 
    SELECT 
        rm.full_name,
        rm.status,
        rm.chassis_number,
        rm.wallet_balance,
        rm.team_leader_name,
        rm.mobile
    FROM rider_master rm
    WHERE rm.mobile = check_mobile;
END;
$$;

-- Grant execute permission to unauthenticated users (so verify works before login)
GRANT EXECUTE ON FUNCTION check_rider_eligibility(TEXT) TO anon, authenticated, service_role;
