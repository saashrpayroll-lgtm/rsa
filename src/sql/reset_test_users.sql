-- Clean up Test Users to allow fresh Auto-Signup

-- 0. Delete dependent Tickets first (to avoid tickets_rider_id_fkey constraint)
DELETE FROM public.tickets
WHERE rider_id IN ('22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333')
   OR technician_id IN ('22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333');

-- 1. Delete dependent Profiles
DELETE FROM public.profiles 
WHERE id IN ('22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333');

-- 2. Delete Users from Auth
DELETE FROM auth.users 
WHERE id IN ('22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333')
   OR email IN ('rider@test.com', 'tech@test.com');
