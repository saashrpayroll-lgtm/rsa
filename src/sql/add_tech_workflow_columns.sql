-- Add workflow tracking columns to tickets table
ALTER TABLE tickets 
ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS on_way_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS in_progress_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS parts_replaced TEXT, -- Storing as text for simplicity, could be JSONB if structured better
ADD COLUMN IF NOT EXISTS technician_voice_transcripts JSONB; -- Array of strings or objects

-- Optional: Add index on status for faster filtering if not exists
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
