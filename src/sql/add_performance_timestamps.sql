-- Add timestamp columns for performance tracking
ALTER TABLE tickets 
ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- Index for faster range queries on these dates
CREATE INDEX IF NOT EXISTS idx_tickets_completed_at ON tickets(completed_at);
