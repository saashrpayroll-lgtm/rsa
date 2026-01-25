SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'rider_master';

select * from pg_policies where tablename = 'rider_master';
