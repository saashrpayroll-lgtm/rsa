-- Fix system_settings table and permissions
CREATE TABLE IF NOT EXISTS system_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auto_assign_enabled BOOLEAN DEFAULT TRUE,
    rsa_routing_enabled BOOLEAN DEFAULT TRUE,
    hub_routing_enabled BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Enable RLS
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- Allow read access to everyone (or authenticated)
CREATE POLICY "Allow read access to authenticated users" ON system_settings
    FOR SELECT TO authenticated USING (true);

-- Allow update access to admins (or authenticated for now for simplicity)
CREATE POLICY "Allow update access to authenticated users" ON system_settings
    FOR UPDATE TO authenticated USING (true);

-- Allow insert access (for initialization)
CREATE POLICY "Allow insert access to authenticated users" ON system_settings
    FOR INSERT TO authenticated WITH CHECK (true);

-- Insert default row if not exists
INSERT INTO system_settings (auto_assign_enabled, rsa_routing_enabled, hub_routing_enabled)
SELECT true, true, true
WHERE NOT EXISTS (SELECT 1 FROM system_settings);

-- Check current state
SELECT * FROM system_settings;
