-- Force Add User 9999209582 to Technician Master
-- Run this if Login still says "Invalid Credentials"

INSERT INTO public.technician_master (full_name, mobile, role, status)
VALUES (
    'Technician 9999209582', -- Placeholder Name
    '9999209582',
    'hub_tech',
    'active'
)
ON CONFLICT (mobile) DO UPDATE SET
    status = 'active'; -- Ensure active if already exists

-- Also repair the Auth Record just in case
DELETE FROM auth.users WHERE email = '9999209582@hub.com';

RAISE NOTICE 'User 9999209582 has been Force-Added to Master and Auth cleared for clean login.';
