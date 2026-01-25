-- Audit Logs Table
create table if not exists ticket_audit_logs (
    id uuid default gen_random_uuid() primary key,
    ticket_id uuid references tickets(id) on delete cascade not null,
    actor_id uuid references auth.users(id), -- Nullable for system actions
    actor_name text, -- Cache name for easier display
    action_type text not null, -- 'STATUS_CHANGE', 'EDIT', 'ROLLBACK', 'DELETE', 'PAUSE', 'RESUME'
    previous_state jsonb,
    new_state jsonb,
    reason text,
    created_at timestamp with time zone default now()
);

-- ADD PAUSE CAPABILITY TO TICKETS
alter table tickets add column if not exists is_paused boolean default false;
alter table tickets add column if not exists location_address text;


-- Enable Realtime (Safe Implementation)
DO $$
BEGIN
  BEGIN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE ticket_audit_logs';
  EXCEPTION
    WHEN OTHERS THEN NULL; -- Identify 42710 or just ignore if already added
  END;
END $$;

-- Index for faster history lookup
create index if not exists idx_ticket_audit_ticket_id on ticket_audit_logs(ticket_id);

-- RPC: Update Ticket With Audit
-- This function MUST be used for Admin overrides to ensure logging
create or replace function admin_update_ticket(
    p_ticket_id uuid,
    p_updates jsonb,
    p_reason text,
    p_action_type text
)
returns void
language plpgsql
security definer
as $$
declare
    v_old_state jsonb;
    v_new_state jsonb;
    v_actor_name text;
begin
    -- 1. Fetch Old State
    select to_jsonb(t) into v_old_state
    from tickets t
    where id = p_ticket_id;

    if not found then
        raise exception 'Ticket not found';
    end if;

    -- 2. Fetch Actor Name (Current User)
    select full_name into v_actor_name
    from profiles
    where id = auth.uid();

    -- 3. Perform Update
    -- We construct dynamic SQL or just update specific fields if payload is simple.
    -- For safety/simplicity, we'll handle common fields manually or use jsonb_populate_record if strictly typed.
    -- meaningful updates: status, description, location_address, technician_id.
    
    update tickets
    set 
        status = coalesce((p_updates->>'status'), status),
        description = coalesce((p_updates->>'description'), description),
        location_address = coalesce((p_updates->>'location_address'), location_address),
        is_paused = coalesce((p_updates->>'is_paused')::boolean, is_paused),
        updated_at = now(),
        completed_at = case 
            when (p_updates->>'status') = 'COMPLETED' then now() 
            else completed_at 
        end
    where id = p_ticket_id
    returning to_jsonb(tickets.*) into v_new_state;

    -- 4. Insert Audit Log
    insert into ticket_audit_logs (
        ticket_id,
        actor_id,
        actor_name,
        action_type,
        previous_state,
        new_state,
        reason
    ) values (
        p_ticket_id,
        auth.uid(),
        v_actor_name,
        p_action_type,
        v_old_state,
        v_new_state,
        p_reason
    );
end;
$$;

-- RPC: Get Audit History
create or replace function get_ticket_audit_history(p_ticket_id uuid)
returns table (
    id uuid,
    actor_name text,
    action_type text,
    previous_state jsonb,
    new_state jsonb,
    reason text,
    created_at timestamp with time zone
)
language plpgsql
security definer
as $$
begin
    return query
    select 
        al.id,
        al.actor_name,
        al.action_type,
        al.previous_state,
        al.new_state,
        al.reason,
        al.created_at
    from ticket_audit_logs al
    where al.ticket_id = p_ticket_id
    order by al.created_at desc;
end;
$$;

-- RPC: Rollback Ticket
create or replace function rollback_ticket(
    p_log_id uuid,
    p_reason text
)
returns void
language plpgsql
security definer
as $$
declare
    v_target_log record;
    v_current_state jsonb;
    v_restored_state jsonb;
    v_actor_name text;
begin
    -- 1. Fetch the log entry we want to revert TO (actually we revert to its PREVIOUS state)
    select * into v_target_log
    from ticket_audit_logs
    where id = p_log_id;

    if not found then
        raise exception 'Audit log entry not found';
    end if;

    -- 2. Fetch current state for the "Before" part of the *new* log
    select to_jsonb(t) into v_current_state
    from tickets t
    where id = v_target_log.ticket_id;

    -- 3. Restore to previous_state of the target log
    -- This effectively undoes the action recorded in that log
    
    update tickets
    set
        status = (v_target_log.previous_state->>'status'),
        description = (v_target_log.previous_state->>'description'),
        location_address = (v_target_log.previous_state->>'location_address'),
        technician_id = (v_target_log.previous_state->>'technician_id')::uuid,
        is_paused = coalesce((v_target_log.previous_state->>'is_paused')::boolean, false),
        updated_at = now()
    where id = v_target_log.ticket_id
    returning to_jsonb(tickets.*) into v_restored_state;

    -- 4. Get Actor Name
    select full_name into v_actor_name from profiles where id = auth.uid();

    -- 5. Create NEW Audit Log for the Rollback
    insert into ticket_audit_logs (
        ticket_id,
        actor_id,
        actor_name,
        action_type,
        previous_state,
        new_state,
        reason
    ) values (
        v_target_log.ticket_id,
        auth.uid(),
        v_actor_name,
        'ROLLBACK',
        v_current_state,
        v_restored_state,
        p_reason
    );
end;
$$;
