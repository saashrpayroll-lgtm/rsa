-- Add ticket_id column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tickets' AND column_name='ticket_id') THEN
        ALTER TABLE tickets ADD COLUMN ticket_id TEXT;
        
        -- Populate with short ID from UUID
        UPDATE tickets SET ticket_id = substring(id::text from 1 for 8);
    END IF;
END $$;
