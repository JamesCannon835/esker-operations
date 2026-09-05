-- =====================================================================
-- COMPANY CALENDAR EVENTS
-- Management-only diary entries shown on /leave/calendar alongside
-- approved time off (e.g. "Truck 12D1234 CVRT test", "Auditor on site").
-- Drivers never see this — RLS is manager-only.
--
-- Run once in the Supabase SQL editor. Safe to re-run.
-- =====================================================================

create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null default 'other',
  start_date date not null,
  end_date date not null,
  note text,
  asset_type text,
  asset_id uuid,
  created_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date)
);
create index if not exists calendar_events_range_idx
  on public.calendar_events (start_date, end_date);

alter table public.calendar_events enable row level security;

drop policy if exists "managers read calendar" on public.calendar_events;
create policy "managers read calendar" on public.calendar_events
  for select using (public.is_manager());

drop policy if exists "managers write calendar" on public.calendar_events;
create policy "managers write calendar" on public.calendar_events
  for all using (public.is_manager()) with check (public.is_manager());
