-- Enable the storage extension if not already enabled
-- CREATE EXTENSION IF NOT EXISTS "storage" SCHEMA "extensions";

-- Create the 'ticket-attachments' bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('ticket-attachments', 'ticket-attachments', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Policy: Allow public read access to ticket-attachments
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'ticket-attachments' );

-- Policy: Allow authenticated users to upload to ticket-attachments
-- (Updating to allow inserts for authenticated roles)
CREATE POLICY "Authenticated Upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'ticket-attachments' );

-- Policy: Allow users to update their own objects (optional, but good for edits)
-- CREATE POLICY "Owner Update"
-- ON storage.objects FOR UPDATE
-- TO authenticated
-- USING ( auth.uid() = owner );
