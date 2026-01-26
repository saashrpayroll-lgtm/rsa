-- Migration: Add alternate_mobile to tickets table

ALTER TABLE tickets 
ADD COLUMN IF NOT EXISTS alternate_mobile TEXT;

COMMENT ON COLUMN tickets.alternate_mobile IS 'Optional alternate contact number for the rider';
