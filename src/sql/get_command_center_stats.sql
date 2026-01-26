-- RPC: Get SLA Monitor Stats
-- PROMPT: add 2 more tracking points (Arrival Time, Customer Satisfaction)
DROP FUNCTION IF EXISTS get_sla_monitor_stats();

CREATE OR REPLACE FUNCTION get_sla_monitor_stats()
RETURNS TABLE (
  response_score numeric,
  resolution_score numeric,
  arrival_score numeric,
  customer_satisfaction numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE
  total_tickets bigint;
  response_ok bigint;
  resolution_ok bigint;
  arrival_ok bigint;
  avg_rating numeric;
BEGIN
  -- Time window: Last 24 hours
  SELECT count(*) INTO total_tickets FROM tickets WHERE created_at >= now() - interval '24 hours';
  
  IF total_tickets = 0 THEN
    RETURN QUERY SELECT 100::numeric, 100::numeric, 100::numeric, 100::numeric;
  ELSE
    -- 1. Response Score (< 15 mins)
    SELECT count(*) INTO response_ok FROM tickets 
    WHERE created_at >= now() - interval '24 hours' 
    AND (accepted_at - created_at) <= interval '15 minutes';
    
    -- 2. Resolution Score (< 60 mins)
    SELECT count(*) INTO resolution_ok FROM tickets 
    WHERE created_at >= now() - interval '24 hours' 
    AND status = 'COMPLETED'
    AND (updated_at - created_at) <= interval '60 minutes';

    -- 3. Arrival Score (< 30 mins)
    SELECT count(*) INTO arrival_ok FROM tickets 
    WHERE created_at >= now() - interval '24 hours' 
    AND (on_way_at IS NOT NULL AND accepted_at IS NOT NULL)
    AND (on_way_at - accepted_at) <= interval '30 minutes';

    -- 4. Customer Satisfaction (Avg Rating)
    SELECT AVG(COALESCE(customer_rating, 5)) INTO avg_rating FROM tickets
    WHERE created_at >= now() - interval '7 days'; -- 7 days for better sample size

    RETURN QUERY SELECT 
      round((response_ok::numeric / total_tickets::numeric) * 100, 1),
      round((resolution_ok::numeric / total_tickets::numeric) * 100, 1),
      round((arrival_ok::numeric / total_tickets::numeric) * 100, 1),
      round((COALESCE(avg_rating, 5)::numeric / 5.0) * 100, 1);
  END IF;
END;
$func$;


-- RPC: Get Ticket Forecast Data (Actual vs Predicted)
-- Returns 24 hour data points (12 past, 12 future)
DROP FUNCTION IF EXISTS get_ticket_forecast();

CREATE OR REPLACE FUNCTION get_ticket_forecast()
RETURNS TABLE (
  "time" text,
  actual numeric,
  predicted numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
BEGIN
  RETURN QUERY
  WITH hours AS (
    SELECT generate_series(
      date_trunc('hour', now()) - interval '12 hours',
      date_trunc('hour', now()) + interval '12 hours',
      '1 hour'::interval
    ) AS hour_start
  ),
  actuals AS (
    SELECT 
      date_trunc('hour', created_at) AS hour_start,
      count(*) AS count
    FROM tickets
    WHERE created_at >= now() - interval '12 hours'
    GROUP BY 1
  )
  SELECT 
    to_char(h.hour_start, 'HH24:MI') AS time,
    -- Actual: defined for past, null for future
    CASE 
      WHEN h.hour_start <= now() THEN COALESCE(a.count, 0)
      ELSE NULL
    END AS actual,
    -- Predicted: defined for all (Mocking logic based on time of day + random noise)
    ABS(
      (CASE 
        WHEN EXTRACT(HOUR FROM h.hour_start) BETWEEN 8 AND 10 THEN 20  -- Morning Peak
        WHEN EXTRACT(HOUR FROM h.hour_start) BETWEEN 17 AND 19 THEN 25 -- Evening Peak
        WHEN EXTRACT(HOUR FROM h.hour_start) BETWEEN 1 AND 5 THEN 2   -- Night Low
        ELSE 10
      END) 
      + (floor(random() * 5) - 2) -- Noise
    )::int AS predicted
  FROM hours h
  LEFT JOIN actuals a ON h.hour_start = a.hour_start
  ORDER BY h.hour_start;
END;
$func$;
