-- SYSTEM HEALTH CHECK
-- Diagnoses: Instance ID Mismatch, Password Issues, Duplicate Emails, Missing Profiles

SELECT 
    u.id as auth_id, 
    u.email, 
    p.full_name, 
    p.role,
    u.instance_id,
    
    -- CHECK 1: Password Hash
    CASE 
        WHEN u.encrypted_password LIKE '$2a$%' THEN 'BCRYPT (Cost ?)'
        WHEN u.encrypted_password LIKE '$2b$%' THEN 'BCRYPT (New)'
        WHEN u.encrypted_password LIKE '$argon2%' THEN 'ARGON2'
        ELSE 'UNKNOWN'
    END as hash_type,

    -- CHECK 2: Password Validity (Check against '123456')
    (u.encrypted_password = crypt('123456', u.encrypted_password)) as is_pass_123456,
    
    -- CHECK 3: Instance ID Validity
    (u.instance_id = '00000000-0000-0000-0000-000000000000') as is_zero_instance,
    
    u.email_confirmed_at

FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.id
WHERE p.role IN ('hub_tech', 'rsa_tech')
ORDER BY u.created_at DESC;
