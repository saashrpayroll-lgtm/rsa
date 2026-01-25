-- 1. NOTIFICATIONS TABLE
create table if not exists notifications (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  message text not null,
  type text check (type in ('INFO', 'ALERT', 'SUCCESS', 'WARNING', 'ERROR')) default 'INFO',
  reference_id uuid, -- Optional: Link to Ticket ID or other entity
  is_read boolean default false,
  created_at timestamp with time zone default now()
);

-- Index for performance
create index if not exists idx_notifications_user_id on notifications(user_id);
create index if not exists idx_notifications_created_at on notifications(created_at);

-- 2. ROW LEVEL SECURITY
alter table notifications enable row level security;

-- DROP Policies first to avoid "policy already exists" error
drop policy if exists "Users can view their own notifications" on notifications;
drop policy if exists "Admins can insert notifications" on notifications;
drop policy if exists "Users can update their own notifications" on notifications;

-- Policy: Users can only see their own notifications
create policy "Users can view their own notifications"
  on notifications for select
  using (auth.uid() = user_id);

-- Policy: Admin can insert notifications (via Broadcast/Triggers)
create policy "Admins can insert notifications"
  on notifications for insert
  with check (
    exists (
      select 1 from profiles
      where id = auth.uid()
      and role = 'admin'
    )
  );

-- Policy: Users can update (mark as read) their own notifications
create policy "Users can update their own notifications"
  on notifications for update
  using (auth.uid() = user_id);

-- 3. RPC: GET NOTIFICATIONS (Fetch with Limit)
create or replace function get_notifications(
  p_limit integer default 50
)
returns table (
  id uuid,
  title text,
  message text,
  type text,
  reference_id uuid,
  is_read boolean,
  created_at timestamp with time zone
)
language plpgsql
security definer
as $$
begin
  return query
  select n.id, n.title, n.message, n.type, n.reference_id, n.is_read, n.created_at
  from notifications n
  where n.user_id = auth.uid()
  order by n.created_at desc
  limit p_limit;
end;
$$;

-- 4. RPC: MARK AS READ
create or replace function mark_notifications_read(
  p_notification_ids uuid[]
)
returns void
language plpgsql
security definer
as $$
begin
  update notifications
  set is_read = true
  where id = any(p_notification_ids)
  and user_id = auth.uid();
end;
$$;

-- 5. RPC: DELETE NOTIFICATIONS
create or replace function delete_notifications(
  p_notification_ids uuid[]
)
returns void
language plpgsql
security definer
as $$
begin
  delete from notifications
  where id = any(p_notification_ids)
  and user_id = auth.uid();
end;
$$;

-- 6. RPC: BROADCAST NOTIFICATION (Admin Only)
create or replace function send_broadcast_notification(
    p_target_role text, -- 'ALL', 'rider', 'tech'
    p_title text,
    p_message text,
    p_type text default 'INFO'
)
returns integer
language plpgsql
security definer
as $$
declare
    v_count integer := 0;
    v_user record;
begin
    -- Security Check: Admin Only
    if not exists (select 1 from profiles where id = auth.uid() and role = 'admin') then
        raise exception 'Access Denied';
    end if;

    for v_user in 
        select id from profiles 
        where status = 'active' 
        and (
            p_target_role = 'ALL' 
            or role = p_target_role 
            or (p_target_role = 'tech' and role in ('hub_tech', 'rsa_tech'))
        )
    loop
        insert into notifications (user_id, title, message, type)
        values (v_user.id, p_title, p_message, p_type);
        v_count := v_count + 1;
    end loop;

    return v_count;
end;
$$;

-- 7. AUTOMATED TRIGGERS (Advanced Logic)
create or replace function handle_ticket_notifications()
returns trigger
language plpgsql
security definer
as $$
declare
    v_admin_id uuid;
    v_rider_name text;
    v_ticket_readable_id text;
    v_msg text;
    v_title text;
begin
    -- Set readable ID
    v_ticket_readable_id := coalesce(new.ticket_id, new.id::text);

    -- 1. NEW TICKET -> Notify Admins
    if tg_op = 'INSERT' then
        select full_name into v_rider_name from profiles where id = new.rider_id;
        
        for v_admin_id in (select id from profiles where role = 'admin' and status = 'active') loop
            insert into notifications (user_id, title, message, type, reference_id)
            values (
                v_admin_id, 
                'New Ticket Alert', 
                'Rider ' || coalesce(v_rider_name, 'Unknown') || ' raised ticket #' || v_ticket_readable_id, 
                'ALERT', 
                new.id
            );
        end loop;
        return new;
    end if;

    -- 2. UPDATE TICKET
    if tg_op = 'UPDATE' then
        
        -- A. Assigned to Tech -> Notify Tech + CC Admin
        if (new.technician_id is not null) and (old.technician_id is distinct from new.technician_id) then
            -- Notify Tech
            insert into notifications (user_id, title, message, type, reference_id)
            values (new.technician_id, 'New Assignment', 'You have been assigned to ticket #' || v_ticket_readable_id, 'INFO', new.id);

            -- CC Admins
             for v_admin_id in (select id from profiles where role = 'admin' and status = 'active') loop
                insert into notifications (user_id, title, message, type, reference_id)
                values (v_admin_id, 'Technician Assigned', 'Ticket #' || v_ticket_readable_id || ' assigned to tech.', 'INFO', new.id);
            end loop;
        end if;

        -- B. Status Change -> Notify Rider + CC Admin
        if old.status is distinct from new.status then
            v_title := 'Status Update';
            
            case new.status
                when 'ACCEPTED' then v_msg := 'Technician accepted request.';
                when 'ON_WAY' then v_msg := 'Technician is on the way.';
                when 'IN_PROGRESS' then v_msg := 'Work started.';
                when 'COMPLETED' then v_msg := 'Service completed.';
                when 'CANCELLED' then v_msg := 'Ticket cancelled.';
                else v_msg := 'Status updated to: ' || new.status;
            end case;

            -- Notify Rider
            insert into notifications (user_id, title, message, type, reference_id)
            values (
                new.rider_id,
                v_title,
                'Ticket #' || v_ticket_readable_id || ': ' || v_msg,
                case when new.status = 'COMPLETED' then 'SUCCESS' else 'INFO' end,
                new.id
            );

            -- CC Admins
            for v_admin_id in (select id from profiles where role = 'admin' and status = 'active') loop
                insert into notifications (user_id, title, message, type, reference_id)
                values (
                    v_admin_id, 
                    'Rider Update: ' || new.status, 
                    'Rider notified for Ticket #' || v_ticket_readable_id || ': ' || v_msg, 
                    'INFO', 
                    new.id
                );
            end loop;
        end if;
    end if;

    return new;
end;
$$;

-- Drop and Recreate Trigger
drop trigger if exists on_ticket_changes_notify on tickets;
create trigger on_ticket_changes_notify
after insert or update on tickets
for each row
execute function handle_ticket_notifications();
