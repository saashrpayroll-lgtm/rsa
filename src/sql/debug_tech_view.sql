-- Check recent tickets (Using simple ID)
SELECT id, status, technician_id, created_at, images, voice_notes
FROM tickets 
ORDER BY created_at DESC 
LIMIT 5;

-- Check technician profiles
SELECT id, full_name, role, is_available 
FROM profiles 
WHERE role IN ('rsa_tech', 'hub_tech');
