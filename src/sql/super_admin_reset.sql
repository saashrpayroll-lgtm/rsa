-- EMERGENCY PASSWORD RESET SCRIPT
-- Replace 'YOUR_MOBILE_NUMBER_HERE' with the actual mobile number.

DO $$
DECLARE
    target_mobile TEXT := '9876543210'; -- <--- ENTER MOBILE NUMBER HERE
    target_user_id UUID;
BEGIN
    -- 1. Get User ID from Profiles
    SELECT id INTO target_user_id FROM public.profiles WHERE mobile = target_mobile;

    IF target_user_id IS NULL THEN
        RAISE EXCEPTION 'User not found in profiles with mobile: %', target_mobile;
    END IF;

    -- 2. Force Update Password in Auth Schema (to '123456')
    UPDATE auth.users
    SET encrypted_password = crypt('123456', gen_salt('bf', 10)),
        updated_at = NOW()
    WHERE id = target_user_id;

    -- 3. Ensure User is Confirmed and Active
    UPDATE auth.users
    SET email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
        raw_app_meta_data = jsonb_set(COALESCE(raw_app_meta_data, '{}'::jsonb), '{provider}', '"email"'),
        aud = 'authenticated'
    WHERE id = target_user_id;

    RAISE NOTICE 'Password forcefully reset to 123456 for User ID: %', target_user_id;
END $$;
