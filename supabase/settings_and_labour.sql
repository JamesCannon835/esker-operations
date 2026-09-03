-- =====================================================================
-- Yard settings (the hourly labour rate) + let mechanics see all logged
-- labour so the per-truck cost view is complete for them.
-- Run once in the Supabase SQL editor.
-- =====================================================================

create table if not exists public.app_settings (
  key text primary key,
  value text,
  updated_at timestamptz not null default now()
);

alter table public.app_settings enable row level security;

create policy "signed in reads settings" on public.app_settings
  for select using (auth.uid() is not null);

create policy "admin writes settings" on public.app_settings
  for all using (public.has_role('admin')) with check (public.has_role('admin'));

insert into public.app_settings (key, value)
values ('labour_rate_per_hour', '0')
on conflict (key) do nothing;

-- Hours the yard spent on the truck during a service (entered on the
-- inspection). Cost = labour_hours * labour_rate_per_hour.
alter table public.services add column if not exists labour_hours numeric;

-- Mechanics can already see their own labour; this lets any mechanic see
-- the whole picture for costing a truck.
create policy "mechanics view all labour" on public.labour_entries
  for select using (public.has_role('mechanic') or public.is_manager());
