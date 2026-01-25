-- 1. Create the 'tickets' bucket (if not exists)
INSERT INTO storage.buckets (id, name, public)
VALUES ('tickets', 'tickets', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Public Access Tickets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Upload Tickets" ON storage.objects;
DROP POLICY IF EXISTS "Admin Delete Tickets" ON storage.objects;

-- 3. Policy: Allow PUBLIC read access to 'tickets' bucket
CREATE POLICY "Public Access Tickets"
ON storage.objects FOR SELECT
USING ( bucket_id = 'tickets' );

-- 4. Policy: Allow Authenticated users to Upload to 'tickets' bucket
CREATE POLICY "Authenticated Upload Tickets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'tickets' );

-- 5. Policy: Allow Anyone (for now, mainly Admin/Tech) to Update/Delete if needed
-- Ideally restrict to Admin, but for prototype flexibility:
CREATE POLICY "Authenticated Delete Tickets"
ON storage.objects FOR DELETE
TO authenticated
USING ( bucket_id = 'tickets' );

-- 6. Ensure 'tickets' table has correct array columns
-- Check and Add columns if missing
ALTER TABLE tickets 
ADD COLUMN IF NOT EXISTS images TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS voice_notes TEXT[] DEFAULT '{}';

-- (Optional) If they were JSONB, we might need to cast them, but assuming they don't exist or are compatible.
