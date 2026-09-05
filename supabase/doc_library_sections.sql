-- =====================================================================
-- DOCUMENT LIBRARY — multiple sections
-- The folder/document engine built for Health & Safety now also backs
-- separate Quality and Environmental libraries. One `section` tag on
-- each folder and document keeps the three trees apart.
--
-- Access is unchanged: management only (public.is_workshop() — mechanic,
-- transport manager, admin), enforced by the existing RLS policies.
--
-- Run once in the Supabase SQL editor. Safe to re-run.
-- =====================================================================

alter table public.hs_folders
  add column if not exists section text not null default 'health_safety';
alter table public.hs_documents
  add column if not exists section text not null default 'health_safety';

create index if not exists hs_folders_section_idx on public.hs_folders (section);
create index if not exists hs_documents_section_idx on public.hs_documents (section);
