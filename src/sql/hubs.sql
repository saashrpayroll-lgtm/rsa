-- Create Hubs Table if it doesn't exist
create table if not exists hubs (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  latitude float not null,
  longitude float not null,
  address text,
  status text default 'ACTIVE' check (status in ('ACTIVE', 'INACTIVE')),
  gps_device_id text,
  ai_location_score float,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Safely add new columns if they don't exist
do $$
begin
    if not exists (select 1 from information_schema.columns where table_name = 'hubs' and column_name = 'hub_radius') then
        alter table hubs add column hub_radius float default 5.0;
    end if;

    if not exists (select 1 from information_schema.columns where table_name = 'hubs' and column_name = 'rsa_radius') then
        alter table hubs add column rsa_radius float default 10.0;
    end if;
end $$;

-- Enable RLS (safe to run multiple times)
alter table hubs enable row level security;

-- Drop existing policies to avoid conflicts
drop policy if exists "Admins can manage hubs" on hubs;
drop policy if exists "Techs can view hubs" on hubs;

-- Re-create Policies
-- Re-create Policies
create policy "Admins can manage hubs"
  on hubs for all
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and profiles.role = 'admin'
    )
  );

create policy "Techs can view hubs"
  on hubs for select
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and profiles.role in ('hub_tech', 'rsa_tech')
    )
  );

-- Allow Riders to view active hubs (for location service)
create policy "Riders can view active hubs"
  on hubs for select
  using (
    status = 'ACTIVE'
  );
