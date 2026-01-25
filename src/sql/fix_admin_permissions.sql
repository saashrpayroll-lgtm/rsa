-- 1. Grant Admin Role to your specific user (Run this in SQL Editor)
-- Replace 'admin@gmail.com' with your actual login email
UPDATE profiles 
SET role = 'admin' 
WHERE id = (
    SELECT id FROM auth.users WHERE email = 'admin@gmail.com' -- CHANGE THIS TO YOUR EMAIL
);

-- 2. Verify it worked
SELECT * FROM profiles WHERE role = 'admin';
