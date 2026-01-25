-- Activity Logs Table
create table if not exists activity_logs (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  action text not null, -- 'LOGIN', 'LOGOUT', 'ONLINE', 'OFFLINE'
  metadata jsonb default '{}'::jsonb,
  created_at timestamp with time zone default now()
);

-- Index for faster queries
create index if not exists idx_activity_logs_user_id on activity_logs(user_id);
create index if not exists idx_activity_logs_created_at on activity_logs(created_at);

-- RPC: Get Technician Stats (Online Duration & Ticket Counts & Avg Resolution)
-- DROP first to allow return type change
drop function if exists get_technician_stats(timestamp with time zone);

create or replace function get_technician_stats(
  time_range_start timestamp with time zone
)
returns table (
  user_id uuid,
  full_name text,
  role text,
  is_available boolean,
  total_tickets_assigned bigint,
  total_tickets_resolved bigint,
  avg_resolution_time_minutes double precision,
  last_active timestamp with time zone
)
language plpgsql
security definer
as $func$
begin
  return query
  select 
    p.id as user_id,
    p.full_name,
    p.role,
    p.is_available,
    count(t.id) filter (where t.created_at >= time_range_start) as total_tickets_assigned,
    count(t.id) filter (where t.status = 'COMPLETED' and t.created_at >= time_range_start) as total_tickets_resolved,
    coalesce(
        avg(
            extract(epoch from (t.updated_at - t.created_at))/60
        ) filter (where t.status = 'COMPLETED' and t.created_at >= time_range_start), 
        0
    ) as avg_resolution_time_minutes,
    max(al.created_at) as last_active
  from profiles p
  left join tickets t on p.id = t.technician_id
  left join activity_logs al on p.id = al.user_id
  where p.role in ('hub_tech', 'rsa_tech')
  group by p.id, p.full_name, p.role, p.is_available;
end;
$func$;

-- RPC: Get Rider Activity Stats
create or replace function get_rider_activity_stats(
  time_range_start timestamp with time zone
)
returns table (
  active_riders_count bigint,
  total_tickets_raised bigint
)
language plpgsql
security definer
as $func$
begin
  return query
  select
    count(distinct al.user_id) as active_riders_count,
    count(t.id) as total_tickets_raised
  from activity_logs al
  left join tickets t on al.user_id = t.rider_id
  where al.action = 'LOGIN' and al.created_at >= time_range_start;
end;
$func$;

-- RPC: Reassign Tickets (Unassign pending tickets from a tech)
create or replace function reassign_technician_tickets(
  target_tech_id uuid
)
returns void
language plpgsql
security definer
as $func$
begin
  -- Unassign tickets that are OPEN or ASSIGNED but not yet COMPLETED/CANCELLED
  update tickets
  set technician_id = null,
      status = 'OPEN',
      updated_at = now()
  where technician_id = target_tech_id
  and status in ('ASSIGNED', 'IN_PROGRESS');
end;
$func$;

-- RPC: Auto Assign Tickets (Basic Load Balancing)
create or replace function auto_assign_tickets()
returns integer
language plpgsql
security definer
as $func$
declare
  assigned_count integer := 0;
  ticket_record record;
  best_tech_id uuid;
begin
  -- Iterate through OPEN tickets
  for ticket_record in select * from tickets where status = 'OPEN' and technician_id is null loop
    -- Find available tech with least active tickets
    select p.id into best_tech_id
    from profiles p
    left join tickets t on p.id = t.technician_id and t.status in ('ASSIGNED', 'IN_PROGRESS')
    where p.role in ('hub_tech', 'rsa_tech') 
    and p.is_available = true
    group by p.id
    order by count(t.id) asc
    limit 1;

    if best_tech_id is not null then
      update tickets
      set technician_id = best_tech_id,
          status = 'ASSIGNED',
          updated_at = now()
      where id = ticket_record.id;
      
      assigned_count := assigned_count + 1;
    end if;
  end loop;

  return assigned_count;
end;
$func$;
