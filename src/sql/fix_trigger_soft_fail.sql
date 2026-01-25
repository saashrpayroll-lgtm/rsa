-- Make the Auth Trigger "Soft Fail"
-- This prevents "Database Error" during signup if the profile creation has issues.
-- The Frontend (Login.tsx) already handles Profile creation manually, so this is safe.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    BEGIN
        INSERT INTO public.profiles (id, full_name, mobile, role)
        VALUES (
            new.id,
            COALESCE(new.raw_user_meta_data->>'full_name', 'Unknown'),
            COALESCE(new.raw_user_meta_data->>'mobile', ''),
            COALESCE(new.raw_user_meta_data->>'role', 'rider')
        )
        ON CONFLICT (id) DO UPDATE SET
            full_name = EXCLUDED.full_name,
            mobile = EXCLUDED.mobile;
    EXCEPTION WHEN OTHERS THEN
        -- Log error but allow User Creation to proceed
        RAISE WARNING 'Profile creation failed in trigger: %', SQLERRM;
    END;
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
