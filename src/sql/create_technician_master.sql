-- Create Technician Master Table
-- Source of truth for pre-approved technicians (similar to rider_master)

CREATE TABLE IF NOT EXISTS public.technician_master (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    full_name TEXT NOT NULL,
    mobile TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL CHECK (role IN ('hub_tech', 'rsa_tech')),
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.technician_master ENABLE ROW LEVEL SECURITY;

-- Policies
-- Admins can do everything
DROP POLICY IF EXISTS "Admins can manage technician_master" ON technician_master;

CREATE POLICY "Admins can manage technician_master" ON technician_master
    FOR ALL
    USING (
        EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
    );

-- RPC for Public Login Check
-- This allows the login page to check if a mobile number belongs to a valid technician
-- WITHOUT exposing the entire table to the public.

CREATE OR REPLACE FUNCTION check_technician_eligibility(check_mobile TEXT)
RETURNS TABLE (
    full_name TEXT,
    role TEXT,
    status TEXT,
    mobile TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER -- Bypass RLS
SET search_path = public
AS $$
BEGIN
    RETURN QUERY 
    SELECT 
        tm.full_name,
        tm.role,
        tm.status,
        tm.mobile
    FROM technician_master tm
    WHERE tm.mobile = check_mobile;
END;
$$;

-- Grant access to anon for the login page
GRANT EXECUTE ON FUNCTION check_technician_eligibility(TEXT) TO anon, authenticated, service_role;

-- Seed a Test Technician (If not exists)
INSERT INTO public.technician_master (full_name, mobile, role, status)
VALUES 
    ('Test Tech', '9000090000', 'hub_tech', 'active')
ON CONFLICT (mobile) DO NOTHING;
