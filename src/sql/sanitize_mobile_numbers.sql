-- SANITIZE MOBILE NUMBERS & EMAILS
-- Removes spaces, dashes, +91, etc. from profiles and updates auth emails.

DO $$
DECLARE
    r RECORD;
    clean_mobile TEXT;
    new_email TEXT;
    v_count INT := 0;
BEGIN
    FOR r IN SELECT * FROM public.profiles WHERE mobile ~ '[^0-9]' LOOP
        -- Remove non-digits
        clean_mobile := regexp_replace(r.mobile, '[^0-9]', '', 'g');
        -- Take last 10 digits (handles +91)
        IF length(clean_mobile) > 10 THEN
            clean_mobile := substring(clean_mobile from length(clean_mobile)-9 for 10);
        END IF;

        IF length(clean_mobile) >= 10 THEN
            new_email := clean_mobile || '@hub.com';
            
            -- Update Profile
            UPDATE public.profiles 
            SET mobile = clean_mobile 
            WHERE id = r.id;

            -- Update Auth User Email
            UPDATE auth.users
            SET email = new_email
            WHERE id = r.id;
            
            v_count := v_count + 1;
        END IF;
    END LOOP;
    
    RAISE NOTICE 'Sanitized % users.', v_count;
END $$;
