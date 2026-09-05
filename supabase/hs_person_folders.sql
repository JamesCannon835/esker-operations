-- =====================================================================
-- Links a person to their folder in the Health & Safety library
-- (e.g. their "14. Training Records" subfolder), so the training
-- register can jump straight into it.
--
-- Run once in the Supabase SQL editor. Safe to re-run.
-- =====================================================================

create table if not exists public.hs_person_folders (
  user_id uuid primary key references public.users(id) on delete cascade,
  folder_id uuid references public.hs_folders(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.hs_person_folders enable row level security;

drop policy if exists "workshop reads person folders" on public.hs_person_folders;
create policy "workshop reads person folders" on public.hs_person_folders
  for select using (public.is_workshop());

drop policy if exists "workshop writes person folders" on public.hs_person_folders;
create policy "workshop writes person folders" on public.hs_person_folders
  for all using (public.is_workshop()) with check (public.is_workshop());
