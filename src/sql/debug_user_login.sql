-- DEBUG USER LOGIN
-- Run this to see what users actually exist in your database

SELECT 
    au.id,
    au.email,
    au.encrypted_password, -- (Just to see if it's set, don't share this)
    au.last_sign_in_at,
    p.role,
    p.full_name,
    p.mobile
FROM auth.users au
LEFT JOIN public.profiles p ON p.id = au.id
ORDER BY au.created_at DESC;

-- CHECK SPECIFIC MOBILE
-- Replace this with your number
-- SELECT * FROM auth.users WHERE email LIKE '9837664056%';
