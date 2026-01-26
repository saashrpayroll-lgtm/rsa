-- RPC: Get System Pulse Stats
-- Returns real-time metrics for the admin dashboard
DROP FUNCTION IF EXISTS get_system_pulse();

CREATE OR REPLACE FUNCTION get_system_pulse()
RETURNS TABLE (
  uptime_percentage numeric,
  avg_response_minutes numeric,
  active_techs_count bigint,
  overloaded_techs_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE
  today_start timestamp with time zone := date_trunc('day', now());
  total_tickets_today bigint;
  resolved_tickets_today bigint;
BEGIN
  -- 1. Uptime (Simulated as Resolution Rate for now, or System Health)
  -- Let's use Resolution Rate: Completed / Total Created Today
  SELECT count(*) INTO total_tickets_today FROM tickets WHERE created_at >= today_start;
  SELECT count(*) INTO resolved_tickets_today FROM tickets WHERE status = 'COMPLETED' AND created_at >= today_start;
  
  IF total_tickets_today > 0 THEN
    uptime_percentage := round((resolved_tickets_today::numeric / total_tickets_today::numeric) * 100, 1);
  ELSE
    uptime_percentage := 100; -- Default perfect score if no issues reported
  END IF;

  -- 2. Avg Response Time (From Created to Accepted)
  SELECT COALESCE(
    ROUND(
      AVG(
        EXTRACT(EPOCH FROM (accepted_at - created_at)) / 60
      )::numeric, 
      1
    ), 
    0
  ) 
  INTO avg_response_minutes
  FROM tickets 
  WHERE created_at >= today_start AND accepted_at IS NOT NULL;

  -- 3. Active Techs
  SELECT count(*) INTO active_techs_count
  FROM profiles
  WHERE role IN ('rsa_tech', 'hub_tech') AND is_available = true;

  -- 4. Overloaded Techs (> 2 Active Tickets)
  SELECT count(*) INTO overloaded_techs_count
  FROM (
      SELECT technician_id
      FROM tickets
      WHERE status IN ('ASSIGNED', 'IN_PROGRESS', 'ACCEPTED', 'ON_WAY')
      AND technician_id IS NOT NULL
      GROUP BY technician_id
      HAVING count(*) > 2
  ) sub;

  RETURN QUERY SELECT uptime_percentage, avg_response_minutes, active_techs_count, overloaded_techs_count;
END;
$func$;
