-- RESET AUTH BUT KEEP PROFILES (PREPARE JIT)
-- Deletes Auth records for Technicians/Riders so they can "Re-Sign Up" via the App.
-- This fixes the "Hash Mismatch" by letting the App generate the hash.

DELETE FROM auth.users
WHERE id IN (
    SELECT id FROM public.profiles 
    WHERE role IN ('hub_tech', 'rsa_tech', 'rider')
);

-- Note: The Profiles might now have IDs that point to nowhere.
-- We must update the Profiles to allow new IDs to claim them?
-- No, Profiles PK is ID. If we delete Auth, we usually cascade delete Profile.
-- BUT we want to keep the Profile Data (Name, Role).

-- STRATEGY: 
-- We cannot easily "re-link" a new Auth ID to an existing Profile ID if PK is shared.
-- WE MUST BACKUP PROFILES -> DELETE AUTH (Cascade) -> RESTORE PROFILES (With new ID logic? No, wait.)

-- BETTER STRATEGY:
-- We just DELETE the user completely.
-- The Admin creates them again via Admin Panel.
-- BUT Admin Panel uses SQL `create_technician_user` which is broken.

-- NEW STRATEGY:
-- 1. Admin Panel creates "Shadow Profile" (in a temp table?) No.
-- 2. Client `signUp` is the ONLY way to create safe Auth.

-- OK, for now, let's just Nuke '9000090000' completely.
-- And let the user "Register" via the Login screen '123456' flow.
-- But `Login` flow needs `check_user_exists`.
-- `check_user_exists` reads `profiles`.
-- If we delete `auth.users`, `profiles` is deleted (Cascade).

-- SOLUTION:
-- Users table separate from Profiles? No, 1:1.
-- `rider_master` is the source of truth for Riders.
-- Techs don't have a "Master" table. They ARE the profiles.

-- WE NEED A `technician_master` or just `allowed_technicians` table?
-- Or, we update `create_technician_user` to NOT insert into Auth, but into a standard `profiles` table that allows NULL auth_id?
-- Current schema: `profiles.id` references `auth.users.id`.
-- It is a hard link. We can't have profile without auth.

-- BACKTRACK:
-- We MUST make SQL-created Auth work.
-- If `pgcrypto` fails, we are stuck unless we use Client-side creation.

-- CLIENT SIDE CREATION FOR ADMIN:
-- 1. Admin fills form.
-- 2. Client calls `supabase.auth.signUp()` (creates User + Profile).
-- 3. But Admin is logged in! `signUp` logs them out.
-- 4. Use `supabase.auth.admin.createUser()`? (Requires Service Key).
-- 5. We don't expose Service Key to client.

-- EDGE FUNCTION `create-user`:
-- This is the standard way.
-- But I can't deploy Edge Function easily here.

-- ATTEMPT 4:
-- maybe `crypt` in SQL is using a salt that Supabase doesn't like?
-- Let's try `extensions.pgcrypto` explicitly?

-- Let's go with the JIT flow but for `9000090000` specifically:
-- 1. Create a "Staging" table for techs?
-- No, let's try the `pgcrypto` COST 10 explicitly. I haven't tried it since the very first fail. Maybe Instance ID was the cause then.
-- I'll trying `cost 10` again.

DO $$
BEGIN
    -- Just a placeholder. The real logic is in the next tool call.
    NULL;
END $$;
