-- ADVANCED CONTEXTUAL NOTIFICATIONS
-- Triggers to create human-readable notifications on ticket changes

-- 1. Function to handle status changes
CREATE OR REPLACE FUNCTION public.handle_ticket_notifications()
RETURNS TRIGGER AS $$
DECLARE
    v_rider_id UUID;
    v_tech_id UUID;
    v_tech_name TEXT := 'Technician';
    v_rider_name TEXT := 'Rider';
    v_ticket_ref TEXT;
BEGIN
    v_rider_id := NEW.rider_id;
    v_tech_id := NEW.technician_id;
    v_ticket_ref := COALESCE(NEW.ticket_id, SUBSTRING(NEW.id::text, 1, 8));

    -- Robust Name Fetching
    SELECT COALESCE(full_name, 'Technician') INTO v_tech_name FROM public.profiles WHERE id = v_tech_id;
    SELECT COALESCE(full_name, 'Rider') INTO v_rider_name FROM public.profiles WHERE id = v_rider_id;

    -- Better ID Formatting (Shorten UUID if Ticket ID is missing)
    IF NEW.ticket_id IS NOT NULL THEN
        v_ticket_ref := NEW.ticket_id;
    ELSE
        v_ticket_ref := SUBSTRING(NEW.id::text, 1, 6); -- Short 6-char code
    END IF;

    -- Check for Status Change
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        
        -- A. CASE: ACCEPTED (Notify Rider)
        IF NEW.status = 'ACCEPTED' THEN
             INSERT INTO public.notifications (user_id, title, message, type, reference_id, is_read, created_at)
             VALUES (v_rider_id, 'Technician Assigned', v_tech_name || ' has accepted your request (#' || v_ticket_ref || ') and is preparing to leave.', 'SUCCESS', NEW.id, false, NOW());
        END IF;

        -- B. CASE: ON_WAY (Notify Rider)
        IF NEW.status = 'ON_WAY' THEN
             INSERT INTO public.notifications (user_id, title, message, type, reference_id, is_read, created_at)
             VALUES (v_rider_id, 'Technician On The Way', v_tech_name || ' is en route to your location.', 'INFO', NEW.id, false, NOW());
        END IF;

         -- C. CASE: IN_PROGRESS (Notify Rider)
        IF NEW.status = 'IN_PROGRESS' THEN
             INSERT INTO public.notifications (user_id, title, message, type, reference_id, is_read, created_at)
             VALUES (v_rider_id, 'Work Started', 'Repairs have started on your vehicle.', 'WARNING', NEW.id, false, NOW());
        END IF;

        -- D. CASE: COMPLETED (Notify Rider)
        IF NEW.status = 'COMPLETED' THEN
             INSERT INTO public.notifications (user_id, title, message, type, reference_id, is_read, created_at)
             VALUES (v_rider_id, 'Job Completed', 'Your service is complete! Please rate ' || v_tech_name || '.', 'SUCCESS', NEW.id, false, NOW());
        END IF;

        -- E. CASE: CANCELLED (Notify Other Party)
        IF NEW.status = 'CANCELLED' THEN
             INSERT INTO public.notifications (user_id, title, message, type, reference_id, is_read, created_at)
             VALUES (v_rider_id, 'Ticket Cancelled', 'Ticket #' || v_ticket_ref || ' was cancelled.', 'ALERT', NEW.id, false, NOW());
             
             IF v_tech_id IS NOT NULL THEN
                INSERT INTO public.notifications (user_id, title, message, type, reference_id, is_read, created_at)
                VALUES (v_tech_id, 'Job Cancelled', 'Job #' || v_ticket_ref || ' was cancelled.', 'ALERT', NEW.id, false, NOW());
             END IF;
        END IF;

    END IF;

    -- Check for New Assignment (Notify Technician)
    IF OLD.technician_id IS DISTINCT FROM NEW.technician_id AND NEW.technician_id IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, title, message, type, reference_id, is_read, created_at)
        VALUES (NEW.technician_id, 'New Job Assigned', 'You have been assigned to Ticket #' || v_ticket_ref || '.', 'INFO', NEW.id, false, NOW());
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Cleanup & Attach Trigger
-- DROP OLD LEGACY TRIGGERS if they exist (to stop double/ugly notifications)
DROP TRIGGER IF EXISTS handle_ticket_update ON public.tickets; 
DROP TRIGGER IF EXISTS trigger_push_notifications ON public.tickets;
DROP FUNCTION IF EXISTS public.handle_ticket_update();

-- Create New Trigger
DROP TRIGGER IF EXISTS trigger_ticket_notifications ON public.tickets;
CREATE TRIGGER trigger_ticket_notifications
AFTER UPDATE ON public.tickets
FOR EACH ROW
EXECUTE FUNCTION public.handle_ticket_notifications();
