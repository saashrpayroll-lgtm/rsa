-- Create System Settings Table for Global Toggles
CREATE TABLE IF NOT EXISTS public.system_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    auto_assign_enabled BOOLEAN DEFAULT true,
    rsa_routing_enabled BOOLEAN DEFAULT true,
    hub_routing_enabled BOOLEAN DEFAULT true,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Allow everything for authenticated users for now (simplification)
CREATE POLICY "Enable all access for authenticated users" ON public.system_settings
    FOR ALL USING (auth.role() = 'authenticated');

-- Insert default row if empty
INSERT INTO public.system_settings (auto_assign_enabled)
SELECT true
WHERE NOT EXISTS (SELECT 1 FROM public.system_settings);
