-- =====================================================================
-- TIME OFF / LEAVE BOOKING
--   • leave_allowances  — annual entitlement per person (blank = company default)
--   • leave_requests    — one row per booking, self-service or entered by a manager
-- Leave year is the calendar year. Full days only. Working days = Mon–Fri
-- in the date range (public holidays are not auto-excluded).
--
-- Run once in the Supabase SQL editor. Safe to re-run.
-- =====================================================================

do $$ begin
  create type leave_type_t as enum ('annual','sick');
exception when duplicate_object then null; end $$;

do $$ begin
  create type leave_status_t as enum ('pending','approved','rejected','cancelled');
exception when duplicate_object then null; end $$;

create table if not exists public.leave_allowances (
  user_id uuid primary key references public.users(id) on delete cascade,
  annual_days numeric not null default 21,
  updated_at timestamptz not null default now()
);

create table if not exists public.leave_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  leave_type leave_type_t not null default 'annual',
  start_date date not null,
  end_date date not null,
  working_days numeric not null,
  reason text,
  status leave_status_t not null default 'pending',
  decided_by uuid references public.users(id),
  decided_at timestamptz,
  decision_note text,
  created_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date)
);
create index if not exists leave_requests_user_idx on public.leave_requests (user_id);
create index if not exists leave_requests_range_idx on public.leave_requests (start_date, end_date);

alter table public.leave_allowances enable row level security;
alter table public.leave_requests enable row level security;

-- Allowances: a person sees their own; managers see and set everyone's.
drop policy if exists "read own or manager reads allowances" on public.leave_allowances;
create policy "read own or manager reads allowances" on public.leave_allowances
  for select using (user_id = auth.uid() or public.is_manager());
drop policy if exists "managers write allowances" on public.leave_allowances;
create policy "managers write allowances" on public.leave_allowances
  for all using (public.is_manager()) with check (public.is_manager());

-- Requests: a person sees and books their own; managers see and manage all.
drop policy if exists "read own or manager reads leave" on public.leave_requests;
create policy "read own or manager reads leave" on public.leave_requests
  for select using (user_id = auth.uid() or public.is_manager());
drop policy if exists "book own or manager books any" on public.leave_requests;
create policy "book own or manager books any" on public.leave_requests
  for insert with check (user_id = auth.uid() or public.is_manager());
drop policy if exists "update own or manager updates any" on public.leave_requests;
create policy "update own or manager updates any" on public.leave_requests
  for update using (user_id = auth.uid() or public.is_manager())
  with check (user_id = auth.uid() or public.is_manager());
drop policy if exists "managers delete leave" on public.leave_requests;
create policy "managers delete leave" on public.leave_requests
  for delete using (public.is_manager());

-- Company-wide default entitlement (admin can change on the Settings page).
insert into public.app_settings (key, value)
values ('leave_default_days', '21')
on conflict (key) do nothing;
