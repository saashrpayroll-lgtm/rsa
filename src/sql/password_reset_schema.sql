create table if not exists password_reset_requests (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete cascade,
    mobile text not null,
    status text check (status in ('PENDING', 'COMPLETED', 'REJECTED')) default 'PENDING',
    created_at timestamptz default now()
);

-- RLS: Allow anyone (even unauthenticated) to insert requests? 
-- No, ideally we want to verify user identity. 
-- But in the modal code, we fetch 'profiles' first. Since we might not be logged in, we need a way.

-- Let's check the code: The user is NOT logged in when resetting password. 
-- So they can't query 'profiles' if RLS is strict (and it should be).

-- FIX: We need a secure function to handle this without exposing profiles.

create or replace function request_password_reset(target_mobile text)
returns json
language plpgsql
security definer -- Run as admin to lookup profile
as $$
declare
    target_user_id uuid;
begin
    -- 1. Find user
    select id into target_user_id from profiles where mobile = target_mobile limit 1;

    if target_user_id is null then
        -- Return success even if failed to prevent enumeration?
        -- For this internal app, let's be honest
        return json_build_object('success', false, 'message', 'User not found');
    end if;

    -- 2. Insert Request
    insert into password_reset_requests (user_id, mobile)
    values (target_user_id, target_mobile);

    return json_build_object('success', true);
end;
$$;

-- Grant access
grant execute on function request_password_reset to anon, authenticated;
grant insert on password_reset_requests to anon, authenticated; -- Or rely solely on the RPC
