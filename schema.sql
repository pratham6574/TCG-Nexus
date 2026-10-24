-- Kaisuki Cooldown Command Center — Supabase schema
-- Run this whole file in Supabase SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Player',
  approved boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.server_channels (
  id uuid primary key default gen_random_uuid(),
  server_name text not null,
  channel_name text not null,
  last_drop_at timestamptz,
  notes text not null default '',
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (server_name, channel_name)
);

create table if not exists public.user_cooldowns (
  user_id uuid primary key references auth.users(id) on delete cascade,
  claim_until timestamptz,
  command_until timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.invites (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.server_channels enable row level security;
alter table public.user_cooldowns enable row level security;
alter table public.invites enable row level security;

-- A user can read their profile, and can only update their own display name.
create policy "read own profile" on public.profiles for select to authenticated using (id = auth.uid());
-- No client-side profile updates: approval status is controlled by the admin only.

-- Only approved users may view/update shared server/channel records.
create policy "approved users read shared channels" on public.server_channels for select to authenticated
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.approved = true));
create policy "approved users add shared channels" on public.server_channels for insert to authenticated
with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.approved = true));
create policy "approved users update shared channels" on public.server_channels for update to authenticated
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.approved = true))
with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.approved = true));
create policy "approved users delete shared channels" on public.server_channels for delete to authenticated
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.approved = true));

-- Personal cooldowns are private to each account.
create policy "read own cooldowns" on public.user_cooldowns for select to authenticated using (user_id = auth.uid());
create policy "insert own cooldowns" on public.user_cooldowns for insert to authenticated with check (user_id = auth.uid());
create policy "update own cooldowns" on public.user_cooldowns for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Invite list is deliberately not readable from the browser. Account approval is manual by admin.
-- Signup trigger creates an unapproved profile; admin must approve users in SQL editor.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, approved)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)), false)
  on conflict (id) do nothing;
  insert into public.user_cooldowns (user_id) values (new.id) on conflict (user_id) do nothing;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Enable Realtime for shared server/channel changes.
alter publication supabase_realtime add table public.server_channels;
