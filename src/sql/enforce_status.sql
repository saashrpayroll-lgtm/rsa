-- 1. Ensure Profiles has status
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS status text DEFAULT 'active';

-- 2. Ensure Rider Master has status
-- (Assuming table exists, if not this might fail, but checking previous logic implies it exists or is mocked via profiles)
-- We will try to alter it safely.
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'rider_master') THEN
        ALTER TABLE rider_master ADD COLUMN IF NOT EXISTS status text DEFAULT 'active';
    END IF;
END $$;

-- 3. RPC: Check Account Status
-- This function checks both the Profile and (if applicable) Rider Master data
CREATE OR REPLACE FUNCTION check_account_status(check_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_profile_status text;
    v_role text;
    v_mobile text;
    v_rider_master_status text;
BEGIN
    -- Get Profile Status
    SELECT status, role, mobile INTO v_profile_status, v_role, v_mobile
    FROM profiles
    WHERE id = check_user_id;

    IF NOT FOUND THEN
        -- Profile not found? strict mode: block.
        RETURN jsonb_build_object('allowed', false, 'reason', 'Profile not found');
    END IF;

    -- Check 1: Profile Suspended?
    IF v_profile_status = 'suspended' THEN
        RETURN jsonb_build_object('allowed', false, 'reason', 'Account Suspended by Admin');
    END IF;

    -- Check 2: Rider Master Blocked? (Only for Riders)
    IF v_role = 'rider' AND v_mobile IS NOT NULL THEN
        -- Try to find in rider_master by mobile
        -- (Ideally we link by ID, but existing logic links by mobile often)
        BEGIN
            SELECT status INTO v_rider_master_status
            FROM rider_master
            WHERE mobile = v_mobile
            LIMIT 1;

            IF v_rider_master_status = 'suspended' OR v_rider_master_status = 'blocked' THEN
                RETURN jsonb_build_object('allowed', false, 'reason', 'Rider Account Blocked in Master Data');
            END IF;
        EXCEPTION WHEN undefined_table THEN
            -- rider_master might not exist yet, ignore
            NULL;
        END;
    END IF;

    -- Update last_active just to show they tried
    UPDATE profiles SET last_active_at = now() WHERE id = check_user_id;

    RETURN jsonb_build_object('allowed', true, 'reason', 'Active');
END;
$$;
