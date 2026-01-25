-- 1. Add "force_password_change" flag to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS force_password_change BOOLEAN DEFAULT FALSE;

-- 2. Create table for Password Reset Requests
CREATE TABLE IF NOT EXISTS password_reset_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    mobile TEXT NOT NULL,
    status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);

-- 3. RLS Policies for Reset Requests
ALTER TABLE password_reset_requests ENABLE ROW LEVEL SECURITY;

-- Allow users to create requests
CREATE POLICY "Users can create reset requests" 
ON password_reset_requests FOR INSERT 
WITH CHECK (true); -- Publicly allow requesting reset (validated by backend usually, but open for now)

-- Allow admins to view and update requests
-- Assuming admins are identified by role 'admin' in profiles table or metadata
-- For simplicity in this prototype, we'll allow authenticated users to view/update if they are admins.
-- Ideally: auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin')

CREATE POLICY "Admins can view all requests"
ON password_reset_requests FOR SELECT
USING (auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin'));

CREATE POLICY "Admins can update requests"
ON password_reset_requests FOR UPDATE
USING (auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin'));

-- 4. Function to reset password (to be called by Admin)
-- This is a placeholder. In Supabase, password updates are usually done via Auth API.
-- However, we can track the "action" here.
