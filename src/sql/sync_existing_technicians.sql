-- Sync Existing Technicians to Master Table
-- Run this script IO fix "Invalid Login" for technicians created before the Master Table sync was active.

INSERT INTO public.technician_master (full_name, mobile, role, status)
SELECT 
    full_name, 
    mobile, 
    role, 
    COALESCE(status, 'active') as status
FROM public.profiles
WHERE role IN ('hub_tech', 'rsa_tech', 'technician') -- Include all tech variants
ON CONFLICT (mobile) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    status = EXCLUDED.status;

-- Output result
DO $$
DECLARE
    count_var INTEGER;
BEGIN
    SELECT COUNT(*) INTO count_var FROM public.technician_master;
    RAISE NOTICE 'Total Technicians in Master List: %', count_var;
END $$;
