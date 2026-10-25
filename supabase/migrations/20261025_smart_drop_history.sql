-- TCG Nexus: safe additive migration for Smart Drop Radar history.
-- Apply once in Supabase SQL Editor. This does not reset or rewrite existing tables.
create table if not exists public.drop_events (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.server_channels(id) on delete cascade,
  occurred_at timestamptz not null,
  recorded_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);
create index if not exists drop_events_channel_occurred_idx on public.drop_events (channel_id, occurred_at desc);
alter table public.drop_events enable row level security;
drop policy if exists "approved users read drop history" on public.drop_events;
create policy "approved users read drop history" on public.drop_events for select to authenticated
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.approved = true));
drop policy if exists "approved users record drop history" on public.drop_events;
create policy "approved users record drop history" on public.drop_events for insert to authenticated
with check (recorded_by = auth.uid() and exists (select 1 from public.profiles p where p.id = auth.uid() and p.approved = true));
grant select, insert on public.drop_events to authenticated;

-- Keep event history synchronized to approved clients.
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'drop_events') then
    alter publication supabase_realtime add table public.drop_events;
  end if;
end $$;
