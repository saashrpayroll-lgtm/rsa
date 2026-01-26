-- LIST ALL TECHNICIANS (DEBUG INFO)
-- Run this to see exactly who is in your system.

SELECT 
    p.full_name,
    p.mobile,
    p.role,
    u.email,
    u.instance_id,
    (u.encrypted_password IS NOT NULL) as has_password,
    u.email_confirmed_at
FROM public.profiles p
JOIN auth.users u ON u.id = p.id
WHERE p.role IN ('hub_tech', 'rsa_tech')
ORDER BY p.created_at DESC;
