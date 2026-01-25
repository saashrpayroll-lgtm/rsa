-- Remove any default value that might be setting technician_id to current user
ALTER TABLE tickets 
ALTER COLUMN technician_id DROP DEFAULT;

-- Ensure RLS is correct: Riders can insert, but technician_id should be null
-- (Already handled by policy, but let's double check insert logic in code)

-- Disable ONLY the auto-assign trigger if it exists and is faulty
-- DROP TRIGGER IF EXISTS on_ticket_created ON tickets; 
-- (We might need this trigger for auto-dispatch, but let's check its logic first)
