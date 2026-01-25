-- Secure Hubs Table Permissions and Policies

-- 1. Ensure Table Exists (Safety)
CREATE TABLE IF NOT EXISTS hubs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  latitude float NOT NULL,
  longitude float NOT NULL,
  address text,
  status text DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
  gps_device_id text,
  ai_location_score float,
  hub_radius float DEFAULT 5.0,
  rsa_radius float DEFAULT 10.0,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Grant Privileges (Fix 'Add not working' if permission denied)
GRANT ALL ON TABLE hubs TO authenticated;
GRANT ALL ON TABLE hubs TO service_role;
GRANT SELECT ON TABLE hubs TO anon;

-- 3. Reset RLS
ALTER TABLE hubs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to be clean
DROP POLICY IF EXISTS "Admins can manage hubs" ON hubs;
DROP POLICY IF EXISTS "Techs can view hubs" ON hubs;
DROP POLICY IF EXISTS "Riders can view active hubs" ON hubs;
DROP POLICY IF EXISTS "Enable read access for all users" ON hubs;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON hubs;
DROP POLICY IF EXISTS "Enable update for users based on email" ON hubs;
DROP POLICY IF EXISTS "Enable delete for users based on user_id" ON hubs;

-- 4. Re-create Robust Policies

-- Policy: Admins have FULL access (C, R, U, D)
-- We use a more direct subquery to profiles. 
-- Ensure 'profiles' table is readable by the user, or use security definer function if profiles is locked down.
-- Assuming 'profiles' is readable by authenticated users (own profile).

CREATE POLICY "Admins can manage hubs"
  ON hubs
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Policy: Techs (Hub/RSA) and Riders can VIEW hubs
-- We split this:
-- Techs see ALL hubs (even inactive, maybe?) -> Let's say all for now.
CREATE POLICY "Techs can view hubs"
  ON hubs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('hub_tech', 'rsa_tech')
    )
  );

-- Policy: Riders can SEECT ACTIVE hubs
CREATE POLICY "Riders can view active hubs"
  ON hubs
  FOR SELECT
  USING (
    (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'rider'
        )
        AND status = 'ACTIVE'
    )
    OR
    (
        -- Also allow public/anon access if needed, or strictly authenticated?
        -- For safety, let's keep it to authenticated riders for now.
        -- If 'anon' needs access (e.g. login page map), uncomment:
        -- auth.role() = 'anon' AND status = 'ACTIVE'
        false
    )
  );
