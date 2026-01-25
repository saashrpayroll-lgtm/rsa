-- Add custom_rider_id column to rider_master
ALTER TABLE rider_master 
ADD COLUMN IF NOT EXISTS custom_rider_id TEXT;

-- We can make it unique if desired, but user said "any format accept". 
-- Recommended to add an index though.
CREATE INDEX IF NOT EXISTS idx_rider_master_custom_id ON rider_master(custom_rider_id);
