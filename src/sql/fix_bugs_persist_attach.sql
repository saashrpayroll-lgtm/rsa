-- 1. Fix System Settings Persistence
-- Ensure we only have one row in system_settings
DELETE FROM system_settings WHERE id NOT IN (SELECT id FROM system_settings LIMIT 1);

-- If no row exists, insert default
INSERT INTO system_settings (auto_assign_enabled, rsa_routing_enabled, hub_routing_enabled)
SELECT true, true, true
WHERE NOT EXISTS (SELECT 1 FROM system_settings);

-- Ensure RLS allows Admins to UPDATE
DROP POLICY IF EXISTS "Allow update access to authenticated users" ON system_settings;
DROP POLICY IF EXISTS "Admins can update settings" ON system_settings;
CREATE POLICY "Admins can update settings" ON system_settings
    FOR UPDATE TO authenticated
    USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    )
    WITH CHECK (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- Allow READ to everyone authenticated
DROP POLICY IF EXISTS "Allow read access to authenticated users" ON system_settings;
DROP POLICY IF EXISTS "Authenticated can read settings" ON system_settings;
CREATE POLICY "Authenticated can read settings" ON system_settings
    FOR SELECT TO authenticated USING (true);

-- Fix RPC to target the single row specifically or handling update properly
CREATE OR REPLACE FUNCTION toggle_auto_assign(enabled BOOLEAN)
RETURNS VOID AS $$
BEGIN
    UPDATE system_settings SET auto_assign_enabled = enabled;
    
    -- If table was empty (shouldn't be due to above, but safe fallback)
    IF NOT FOUND THEN
        INSERT INTO system_settings (auto_assign_enabled) VALUES (enabled);
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. Fix Ticket Attachments
-- Ensure columns exist and are of correct type (TEXT[] for arrays of URLs)
ALTER TABLE tickets 
ADD COLUMN IF NOT EXISTS images TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS voice_notes TEXT[] DEFAULT '{}';

-- Fix existing nulls to empty arrays if any
UPDATE tickets SET images = '{}' WHERE images IS NULL;
UPDATE tickets SET voice_notes = '{}' WHERE voice_notes IS NULL;

-- 3. Storage Bucket Policy (Ensure images can be read)
-- Make sure the bucket exists and is public
INSERT INTO storage.buckets (id, name, public)
VALUES ('ticket-attachments', 'ticket-attachments', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Ensure public/authenticated read access
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'ticket-attachments' );

