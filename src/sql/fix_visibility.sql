-- RLS FIX SCRIPT
-- This script ensures broad enough visibility for Technicians and Riders to see each other and their tickets.

-- 1. Profiles Visibility
-- Riders need to see Technician profiles (to show name/phone).
-- Technicians need to see Rider profiles (to show name/phone).
-- Simplest approach: "Profiles are viewable by everyone" (already exists, but we ensure it's not restricted).

DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
CREATE POLICY "Public profiles are viewable by everyone"
    ON profiles FOR SELECT
    USING (true);

-- 2. Tickets Visibility
-- Technicians MUST see tickets that are:
-- a) Assigned to them.
-- b) PENDING (so they can be auto-assigned or picked up).
-- c) CANCELLED (if historical view is needed, though usually restricted).

DROP POLICY IF EXISTS "Techs can view assigned tickets" ON tickets;
DROP POLICY IF EXISTS "Techs can view pending tickets" ON tickets;
DROP POLICY IF EXISTS "Techs can view tickets" ON tickets;

CREATE POLICY "Techs can view tickets"
    ON tickets FOR SELECT
    USING (
        -- If user is a technician
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('rsa_tech', 'hub_tech'))
        AND
        (
            -- Can see own assigned tickets
            technician_id = auth.uid() 
            OR
            -- Can see ANY pending ticket (broad visibility for testing/dispatch)
            status = 'PENDING'
            OR
             -- Can see cancelled tickets if they were ever involved (simplified to all for now to fix visibility issues)
             status = 'CANCELLED'
        )
    );

-- 3. Riders Ticket Update Logic
-- Riders must be able to update tickets to add RATING.
DROP POLICY IF EXISTS "Riders can update their own tickets" ON tickets;
CREATE POLICY "Riders can update their own tickets"
    ON tickets FOR UPDATE
    USING (rider_id = auth.uid()); -- Can only check own tickets
    -- WITH CHECK is optional, standard UPDATE policy implies filters.

-- 4. Techs Ticket Update Logic
DROP POLICY IF EXISTS "Techs can update assigned tickets" ON tickets;
CREATE POLICY "Techs can update assigned tickets"
    ON tickets FOR UPDATE
    USING (
        -- Can update if assigned to them
        technician_id = auth.uid() 
        OR 
        -- Can update to ACCEPT if pending (and unassigned)
        (status = 'PENDING' AND technician_id IS NULL)
    );

