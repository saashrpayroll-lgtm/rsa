ALTER TABLE rider_master 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

-- Ensure existing riders are active
UPDATE rider_master SET status = 'active' WHERE status IS NULL;
