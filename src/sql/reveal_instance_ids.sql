-- REVEAL ALL INSTANCE IDs
-- This will show us if there are multiple "Rooms" in your database.
-- We are looking for a UUID that is NOT 00000000-0000-0000-0000-000000000000

SELECT 
    instance_id, 
    count(*) as user_count,
    string_agg(email, ', ') as sample_emails
FROM auth.users
GROUP BY instance_id;
