-- =====================================================================
-- HEALTH & SAFETY document library
--
-- A folder tree of company H&S / compliance documents, mirrored from the
-- Dropbox layout. Management only (mechanic / transport manager / admin).
-- Files live in the existing `documents` storage bucket under an `hs/`
-- prefix — only the path is stored here.
--
-- Run once in the Supabase SQL editor. Safe to re-run.
-- =====================================================================

create table if not exists public.hs_folders (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  parent_id uuid references public.hs_folders(id) on delete cascade,
  sort_order int not null default 0,
  created_by uuid references public.users(id),
  created_at timestamptz not null default now()
);
create index if not exists hs_folders_parent_idx on public.hs_folders (parent_id);

create table if not exists public.hs_documents (
  id uuid primary key default gen_random_uuid(),
  folder_id uuid references public.hs_folders(id) on delete cascade,
  name text not null,
  file_path text not null,          -- object path in the `documents` bucket
  file_size bigint,
  content_type text,
  review_date date,                 -- optional "review by" date (future use)
  notes text,
  uploaded_by uuid references public.users(id),
  uploaded_at timestamptz not null default now(),
  voided boolean not null default false
);
create index if not exists hs_documents_folder_idx on public.hs_documents (folder_id);

-- ---------------------------------------------------------------------
-- RLS — management only (public.is_workshop() = mechanic or is_manager())
-- ---------------------------------------------------------------------
alter table public.hs_folders enable row level security;
alter table public.hs_documents enable row level security;

do $$
declare t text;
begin
  foreach t in array array['hs_folders', 'hs_documents'] loop
    execute format('drop policy if exists "workshop read %1$s" on public.%1$s', t);
    execute format(
      'create policy "workshop read %1$s" on public.%1$s for select using (public.is_workshop())', t);
    execute format('drop policy if exists "workshop write %1$s" on public.%1$s', t);
    execute format(
      'create policy "workshop write %1$s" on public.%1$s for all using (public.is_workshop()) with check (public.is_workshop())', t);
  end loop;
end $$;
