-- Enable RLS on tickets table
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;

-- DROP existing policies to avoid conflicts
DROP POLICY IF EXISTS "Riders can create tickets" ON tickets;
DROP POLICY IF EXISTS "Riders can view their own tickets" ON tickets;
DROP POLICY IF EXISTS "Riders can update their own tickets" ON tickets;
DROP POLICY IF EXISTS "Techs can view assigned tickets" ON tickets;
DROP POLICY IF EXISTS "Techs can update assigned tickets" ON tickets;
DROP POLICY IF EXISTS "Admins can manage all tickets" ON tickets;

-- Policy 1: Riders can CREATE tickets
CREATE POLICY "Riders can create tickets"
ON tickets FOR INSERT
WITH CHECK (
    auth.uid() = rider_id
);

-- Policy 2: Riders can VIEW their own tickets
CREATE POLICY "Riders can view their own tickets"
ON tickets FOR SELECT
USING (
    auth.uid() = rider_id
);

-- Policy 3: Riders can UPDATE their own tickets (e.g., to rate them or cancel)
CREATE POLICY "Riders can update their own tickets"
ON tickets FOR UPDATE
USING (
    auth.uid() = rider_id
);

-- Policy 4: Technicians can VIEW tickets assigned to them OR unassigned/pending (if we allow picking)
-- For now, visible if assigned OR if they are an active tech and want to see unassigned (optional)
CREATE POLICY "Techs can view assigned tickets"
ON tickets FOR SELECT
USING (
    technician_id = auth.uid() OR 
    (
        technician_id IS NULL AND 
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role IN ('rsa_tech', 'hub_tech')
        )
    )
);

-- Policy 5: Technicians can UPDATE tickets assigned to them
CREATE POLICY "Techs can update assigned tickets"
ON tickets FOR UPDATE
USING (
    technician_id = auth.uid()
);

-- Policy 6: Admins have FULL access
CREATE POLICY "Admins can manage all tickets"
ON tickets FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.role = 'admin'
    )
);
