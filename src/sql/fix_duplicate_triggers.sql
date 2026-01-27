-- FIX DUPLICATE TRIGGERS
-- You have multiple triggers doing the SAME thing. This script deletes them all and keeps only the correct one.

-- 1. NOTIFICATIONS (The main issue)
-- Found: 'on_ticket_changes_notify' AND 'trigger_ticket_notifications'
DROP TRIGGER IF EXISTS on_ticket_changes_notify ON public.tickets;
DROP TRIGGER IF EXISTS trigger_ticket_notifications ON public.tickets;

-- Re-create ONLY the correct one
CREATE TRIGGER trigger_ticket_notifications
AFTER UPDATE ON public.tickets
FOR EACH ROW
EXECUTE FUNCTION public.handle_ticket_notifications();


-- 2. AUTO-ASSIGNMENT (Also duplicated)
-- Found: 'on_ticket_created_auto_assign' AND 'trg_auto_assign_on_insert'
DROP TRIGGER IF EXISTS on_ticket_created_auto_assign ON public.tickets;
DROP TRIGGER IF EXISTS trg_auto_assign_on_insert ON public.tickets;

-- Re-create ONLY the correct one
CREATE TRIGGER trg_auto_assign_on_insert
BEFORE INSERT ON public.tickets
FOR EACH ROW
EXECUTE FUNCTION public.trigger_auto_assign(); -- We assume this is the latest one


