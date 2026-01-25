-- Secure Function to Upsert Riders (Bypassing RLS for Admin Sync)
-- This function runs as SECURITY DEFINER, meaning it uses the permissions of the creator (superuser/admin)
-- We strictly check if the caller is an admin inside the function to be safe.

CREATE OR REPLACE FUNCTION sync_riders(riders_data JSONB)
RETURNS VOID AS $$
DECLARE
    item JSONB;
BEGIN
    -- 1. Security Check: Ensure the caller is an admin
    IF NOT EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() AND role = 'admin'
    ) THEN
        RAISE EXCEPTION 'Access Denied: You must be an admin to sync riders.';
    END IF;

    -- 2. Iterate and Upsert
    -- We can use jsonb_populate_recordset or simple insert...on conflict
    -- Assuming riders_data is an array of objects matching the table structure
    
    INSERT INTO rider_master (
        custom_rider_id,
        full_name, 
        mobile, 
        chassis_number, 
        wallet_balance, 
        allotment_date, 
        team_leader_name, 
        team_leader_mobile,
        updated_at
    )
    SELECT 
        (x->>'custom_rider_id')::text,
        (x->>'full_name')::text,
        (x->>'mobile')::text,
        (x->>'chassis_number')::text,
        COALESCE((x->>'wallet_balance')::numeric, 0),
        (x->>'allotment_date')::date,
        (x->>'team_leader_name')::text,
        (x->>'team_leader_mobile')::text,
        NOW()
    FROM jsonb_array_elements(riders_data) AS x
    ON CONFLICT (mobile) DO UPDATE SET
        custom_rider_id = EXCLUDED.custom_rider_id,
        full_name = EXCLUDED.full_name,
        chassis_number = EXCLUDED.chassis_number,
        wallet_balance = EXCLUDED.wallet_balance,
        allotment_date = EXCLUDED.allotment_date,
        team_leader_name = EXCLUDED.team_leader_name,
        team_leader_mobile = EXCLUDED.team_leader_mobile,
        updated_at = NOW();

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
