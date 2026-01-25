-- Create system_settings table
CREATE TABLE IF NOT EXISTS system_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auto_assign_enabled BOOLEAN DEFAULT TRUE,
    rsa_routing_enabled BOOLEAN DEFAULT TRUE,
    hub_routing_enabled BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Insert default settings if not exists
INSERT INTO system_settings (auto_assign_enabled, rsa_routing_enabled, hub_routing_enabled)
SELECT true, true, true
WHERE NOT EXISTS (SELECT 1 FROM system_settings);

-- Update profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_available BOOLEAN DEFAULT TRUE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS current_lat FLOAT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS current_lng FLOAT;

-- Function to calculating distance (Haversine) - effectively needed if not using PostGIS
CREATE OR REPLACE FUNCTION calculate_distance(lat1 float, lon1 float, lat2 float, lon2 float)
RETURNS float AS $dist$
    DECLARE
        R float := 6371;
        dLat float := radians(lat2 - lat1);
        dLon float := radians(lon2 - lon1);
        a float;
        c float;
    BEGIN
        a := sin(dLat/2) * sin(dLat/2) + cos(radians(lat1)) * cos(radians(lat2)) * sin(dLon/2) * sin(dLon/2);
        c := 2 * atan2(sqrt(a), sqrt(1-a));
        RETURN R * c;
    END;
$dist$ LANGUAGE plpgsql;

-- Auto Assign Function (Trigger-ready)
-- Auto Assign Function (Trigger-ready)
CREATE OR REPLACE FUNCTION auto_assign_ticket_trigger()
RETURNS TRIGGER AS $$
DECLARE
    settings RECORD;
    nearest_tech RECORD;
    ticket_lng FLOAT;
    ticket_lat FLOAT;
    loc_text TEXT;
BEGIN
    -- Get System Settings
    SELECT * INTO settings FROM system_settings LIMIT 1;
    
    -- Check if Auto Assign is Enabled
    IF NOT settings.auto_assign_enabled THEN
        RETURN NEW;
    END IF;

    -- Extract Ticket Location
    -- Use PostGIS functions since NEW.location is likely a GEOMETRY type
    ticket_lng := ST_X(NEW.location::geometry);
    ticket_lat := ST_Y(NEW.location::geometry);

    -- Find nearest available technician
    SELECT id, calculate_distance(current_lat, current_lng, ticket_lat, ticket_lng) as dist
    INTO nearest_tech
    FROM profiles
    WHERE role IN ('rsa_tech', 'hub_tech')
      AND is_available = true
      AND current_lat IS NOT NULL
      AND current_lng IS NOT NULL
    ORDER BY dist ASC
    LIMIT 1;

    -- Assign if found
    IF nearest_tech.id IS NOT NULL THEN
        NEW.technician_id := nearest_tech.id;
        -- We keep status as PENDING so tech can Accept/Reject, but it is now assigned to them.
        -- If auto-accept is desired, we could change status to ACCEPTED here.
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists to avoid duplication
DROP TRIGGER IF EXISTS on_ticket_created_auto_assign ON tickets;

-- Create Trigger
CREATE TRIGGER on_ticket_created_auto_assign
    BEFORE INSERT ON tickets
    FOR EACH ROW
    EXECUTE FUNCTION auto_assign_ticket_trigger();


-- 
-- TEST DATA (Optional - Run to seed DB for testing)
--

-- 1. Insert Test Hub (New Delhi area)
INSERT INTO hubs (id, name, latitude, longitude, address, status, hub_radius, rsa_radius)
VALUES (
    '11111111-1111-1111-1111-111111111111', 
    'Central Delhi Hub', 
    28.6139, 
    77.2090, 
    'Connaught Place, New Delhi', 
    'ACTIVE', 
    5.0, 
    20.0
) ON CONFLICT (id) DO NOTHING;

-- Enable pgcrypto for password hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1.5. Insert Test Users into auth.users (Required for Foreign Key)
-- Note: This requires privileges to write to auth schema. If this fails, user must create users manually.
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role)
VALUES 
    ('22222222-2222-2222-2222-222222222222', 'tech@test.com', crypt('password', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name": "Rajesh Technician", "mobile": "9999999992", "role": "rsa_tech"}', 'authenticated', 'authenticated'),
    ('33333333-3333-3333-3333-333333333333', 'rider@test.com', crypt('password', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name": "Amit Rider", "mobile": "9999999993", "role": "rider"}', 'authenticated', 'authenticated')
ON CONFLICT (id) DO UPDATE SET encrypted_password = EXCLUDED.encrypted_password;

-- 2. Insert Test Technician (RSA Tech - Available)
-- UUID: 222...
INSERT INTO profiles (id, full_name, mobile, role, is_available, current_lat, current_lng)
VALUES (
    '22222222-2222-2222-2222-222222222222',
    'Rajesh Technician',
    '9999999992',
    'rsa_tech',
    true,
    28.6200, -- Nearby
    77.2100
) ON CONFLICT (id) DO UPDATE SET is_available = true, current_lat = 28.6200, current_lng = 77.2100;

-- 3. Insert Test Rider
-- UUID: 333...
INSERT INTO profiles (id, full_name, mobile, role)
VALUES (
    '33333333-3333-3333-3333-333333333333',
    'Amit Rider',
    '9999999993',
    'rider'
) ON CONFLICT (id) DO NOTHING;
