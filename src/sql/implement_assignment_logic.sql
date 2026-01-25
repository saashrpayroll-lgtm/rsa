-- 1. Add columns to profiles for assignment tracking
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS last_assigned_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS is_available BOOLEAN DEFAULT true;

-- 2. Create RPC to toggle system settings (Auto Assign)
CREATE OR REPLACE FUNCTION toggle_auto_assign(enabled BOOLEAN)
RETURNS VOID AS $$
BEGIN
    UPDATE system_settings SET auto_assign_enabled = enabled;
    IF NOT FOUND THEN
        INSERT INTO system_settings (auto_assign_enabled) VALUES (enabled);
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Create RPC for Manual Assignment
CREATE OR REPLACE FUNCTION manual_assign_ticket(p_ticket_id UUID, p_tech_id UUID)
RETURNS VOID AS $$
BEGIN
    -- Update Ticket
    UPDATE tickets 
    SET technician_id = p_tech_id,
        status = 'ACCEPTED' -- Auto-accept when manually assigned by Admin
    WHERE id = p_ticket_id;

    -- Update Tech Last Assigned
    UPDATE profiles
    SET last_assigned_at = now()
    WHERE id = p_tech_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Create RPC for Round Robin Auto Assignment
CREATE OR REPLACE FUNCTION auto_assign_ticket_round_robin(p_ticket_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_category TEXT;
    v_type TEXT;
    v_tech_id UUID;
    v_tech_role TEXT;
BEGIN
    -- Get ticket info
    SELECT category, type INTO v_category, v_type FROM tickets WHERE id = p_ticket_id;

    -- Determine required role (Simple logic for now)
    IF v_type = 'RSA' THEN
        v_tech_role := 'rsa_tech';
    ELSE
        v_tech_role := 'hub_tech'; -- Default for Running Repair
    END IF;

    -- Find best candidate (Round Robin: Least recently assigned, Available, Online preferred but not strict if we want to force)
    -- Logic: Available AND Active. Sort by last_assigned_at ASC.
    SELECT id INTO v_tech_id
    FROM profiles
    WHERE role = v_tech_role
      AND (is_available = true OR is_available IS NULL)
      -- AND is_online = true -- Optional: Enable if we only want online techs
    ORDER BY last_assigned_at ASC NULLS FIRST
    LIMIT 1;

    -- If tech found, assign
    IF v_tech_id IS NOT NULL THEN
        UPDATE tickets
        SET technician_id = v_tech_id,
            status = 'ACCEPTED'
        WHERE id = p_ticket_id;

        UPDATE profiles
        SET last_assigned_at = now()
        WHERE id = v_tech_id;
        
        RETURN TRUE;
    END IF;

    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Trigger to Auto-Assign on Creation (if enabled)
CREATE OR REPLACE FUNCTION trigger_auto_assign()
RETURNS TRIGGER AS $$
DECLARE
    v_auto_enabled BOOLEAN;
BEGIN
    -- Check if auto-assign is enabled in system_settings
    SELECT auto_assign_enabled INTO v_auto_enabled FROM system_settings LIMIT 1;

    -- If enabled and status is PENDING and no tech assigned
    IF v_auto_enabled AND NEW.status = 'PENDING' AND NEW.technician_id IS NULL THEN
        -- Call assignment logic (We explicitly call the function, ignore result)
        PERFORM auto_assign_ticket_round_robin(NEW.id);
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Register Trigger
DROP TRIGGER IF EXISTS trg_auto_assign_on_insert ON tickets;
CREATE TRIGGER trg_auto_assign_on_insert
    AFTER INSERT ON tickets
    FOR EACH ROW
    EXECUTE FUNCTION trigger_auto_assign();
