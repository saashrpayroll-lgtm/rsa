-- Create a function to fetch tickets with Lat/Lng parsed
CREATE OR REPLACE FUNCTION get_tickets_with_location(
   request_status text DEFAULT NULL,
   req_rider_id uuid DEFAULT NULL,
   req_tech_id uuid DEFAULT NULL
)
RETURNS TABLE (
    id uuid,
    rider_id uuid,
    technician_id uuid,
    type text,
    category text,
    description text,
    status text,
    created_at timestamptz,
    updated_at timestamptz,
    location json,
    ai_analysis jsonb,
    images text[],
    voice_notes text[],
    customer_rating int,
    customer_feedback text,
    technician_remarks text
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        t.id,
        t.rider_id,
        t.technician_id,
        t.type,
        t.category,
        t.description,
        t.status,
        t.created_at,
        t.updated_at,
        CASE 
            WHEN t.location IS NOT NULL 
            THEN json_build_object('lat', ST_Y(t.location::geometry), 'lng', ST_X(t.location::geometry))
            ELSE NULL 
        END as location,
        t.ai_analysis,
        t.images,
        t.voice_notes,
        t.customer_rating,
        t.customer_feedback,
        t.technician_remarks
    FROM tickets t
    WHERE 
        (request_status IS NULL OR t.status = request_status)
        AND (req_rider_id IS NULL OR t.rider_id = req_rider_id)
        AND (req_tech_id IS NULL OR t.technician_id = req_tech_id)
    ORDER BY t.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Grant execute to everyone (RLS still applies to underlying table, but functions bypass RLS often unless SECURITY INVOKER)
-- We should use SECURITY INVOKER to respect RLS
ALTER FUNCTION get_tickets_with_location(text, uuid, uuid) SECURITY INVOKER;
