create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null,
  app_user_id uuid references public.users(id) on delete set null,
  auth_user_id uuid,
  dedupe_key text unique,
  properties jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_analytics_event_name_created
  on public.analytics_events (event_name, created_at desc);

create index if not exists idx_analytics_app_user_created
  on public.analytics_events (app_user_id, created_at desc);

alter table public.analytics_events enable row level security;

drop policy if exists analytics_select_own on public.analytics_events;
create policy analytics_select_own on public.analytics_events
for select to authenticated
using (
  auth_user_id = auth.uid()
  or exists (
    select 1 from public.users u
    where u.id = app_user_id and u.auth_user_id = auth.uid()
  )
);

drop policy if exists analytics_insert_own on public.analytics_events;
create policy analytics_insert_own on public.analytics_events
for insert to authenticated
with check (
  auth_user_id = auth.uid()
  or (
    auth_user_id is null and
    exists (
      select 1 from public.users u
      where u.id = app_user_id and u.auth_user_id = auth.uid()
    )
  )
);
