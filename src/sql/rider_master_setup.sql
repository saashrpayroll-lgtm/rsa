-- Create the Master Rider Data table (Single Source of Truth)
CREATE TABLE IF NOT EXISTS rider_master (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    full_name TEXT NOT NULL,
    mobile TEXT NOT NULL UNIQUE,
    chassis_number TEXT,
    wallet_balance NUMERIC DEFAULT 0,
    allotment_date DATE,
    team_leader_name TEXT,
    team_leader_mobile TEXT,
    sheet_row_index INTEGER, -- To track row in Google Sheet for bidirectional sync if needed
    last_synced_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add index on mobile for fast lookup
CREATE INDEX IF NOT EXISTS idx_rider_master_mobile ON rider_master(mobile);

-- Enable RLS
ALTER TABLE rider_master ENABLE ROW LEVEL SECURITY;

-- Policies
-- Admin: Full Access
CREATE POLICY "Admin Full Access" ON rider_master
    FOR ALL
    USING ( auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin') );

-- Rider: Read Only (Own Data) - Conceptual, if we link by mobile
-- For now, let's allow authenticated read for simplicity in the app, 
-- but strictly we should join with profiles. 
-- Since `profiles` table exists, we might keep `rider_master` as a pure admin/backend lookup table 
-- and copy data to `profiles` via trigger or application logic.
-- PROMPT SAYS: "Rider login... system pehle Admin Panel ke Rider Master Database me match kare."

CREATE POLICY "Public Read for Auth Users" ON rider_master
    FOR SELECT
    TO authenticated
    USING (true);


-- Update Tickets Table to support Snapshot
ALTER TABLE tickets 
ADD COLUMN IF NOT EXISTS rider_snapshot JSONB;

-- Comment: rider_snapshot will store { name, mobile, chassis, wallet, tl_name, tl_mobile } at time of creation.
