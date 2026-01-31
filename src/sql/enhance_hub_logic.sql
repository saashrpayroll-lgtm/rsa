-- 1. Update System Settings
ALTER TABLE system_settings 
ADD COLUMN IF NOT EXISTS assignment_mode text DEFAULT 'AUTO' CHECK (assignment_mode IN ('AUTO', 'MANUAL', 'HYBRID'));

-- 2. Seed Hubs (Delhi NCR)
INSERT INTO hubs (name, latitude, longitude, address, hub_radius, rsa_radius, status)
VALUES 
    ('Ghaziabad Hub', 28.6692, 77.4538, 'Ghaziabad, Uttar Pradesh', 10.0, 50.0, 'ACTIVE'),
    ('Chhatarpur Hub', 28.5028, 77.1725, 'Chhatarpur, New Delhi', 8.0, 40.0, 'ACTIVE'),
    ('Matiyala Hub', 28.6200, 77.0500, 'Matiyala, Delhi', 8.0, 40.0, 'ACTIVE'), -- Approx coords
    ('Gurgaon Hub', 28.4595, 77.0266, 'Gurgaon, Haryana', 12.0, 60.0, 'ACTIVE')
ON CONFLICT DO NOTHING; -- Assuming name is not unique, but ID is. If name usage causes duplicates, so be it for this demo.

-- 3. Ensure Techs have hub_id support (Logic will use lat/lng for now, but good to have)
-- (Skipping schema change for profiles to avoid complexities, will use spatial matching)
