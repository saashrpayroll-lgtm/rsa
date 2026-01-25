-- UNIVERSAL PASSWORD RESET SCRIPT
-- Sets password to '123456' and forces change on next login.
-- Works for ANY mobile number (Rider, Tech, Admin).

DO $$
DECLARE
    -- REPLACE THIS WITH THE TARGET MOBILE NUMBER
    target_mobile TEXT := '9876543210'; 
    target_user_id UUID;
BEGIN
    -- 1. Find User ID
    SELECT id INTO target_user_id FROM public.profiles WHERE mobile = target_mobile;

    IF target_user_id IS NULL THEN
        RAISE EXCEPTION '❌ User not found with mobile: %', target_mobile;
    END IF;

    -- 2. Update Password in Auth (123456)
    UPDATE auth.users
    SET encrypted_password = crypt('123456', gen_salt('bf', 10)),
        updated_at = NOW(),
        email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
        raw_app_meta_data = jsonb_set(COALESCE(raw_app_meta_data, '{}'::jsonb), '{provider}', '"email"'),
        aud = 'authenticated'
    WHERE id = target_user_id;

    -- 3. Set "Force Password Change" Flag
    UPDATE public.profiles
    SET force_password_change = TRUE,
        status = 'active'
    WHERE id = target_user_id;

    RAISE NOTICE '✅ SUCCESS! Password for % reset to 123456. Force Change Enabled.', target_mobile;
END $$;
