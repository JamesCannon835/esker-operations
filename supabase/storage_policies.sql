-- =====================================================================
-- Storage access rules for the `documents` bucket.
-- The bucket must exist first (Storage -> New bucket -> "documents", private).
-- Covers asset documents, maintenance/inspection photos, training certs
-- and the Health & Safety library — all live in this one bucket.
--
-- Run once in the Supabase SQL editor. Safe to re-run.
-- =====================================================================

-- Any signed-in user can read objects (the app decides who sees a link).
drop policy if exists "auth read documents bucket" on storage.objects;
create policy "auth read documents bucket"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'documents');

-- Mechanics and managers can add / replace / remove files.
drop policy if exists "managers upload documents bucket" on storage.objects;
create policy "managers upload documents bucket"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'documents'
    and (public.has_role('mechanic') or public.is_manager())
  );

drop policy if exists "managers update documents bucket" on storage.objects;
create policy "managers update documents bucket"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'documents'
    and (public.has_role('mechanic') or public.is_manager())
  );

drop policy if exists "managers delete documents bucket" on storage.objects;
create policy "managers delete documents bucket"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'documents'
    and (public.has_role('mechanic') or public.is_manager())
  );

-- UPDATE / DELETE on the asset `documents` table (base schema is INSERT only).
drop policy if exists "managers and mechanics update documents" on public.documents;
create policy "managers and mechanics update documents" on public.documents
  for update using (public.has_role('mechanic') or public.is_manager());

drop policy if exists "managers and mechanics delete documents" on public.documents;
create policy "managers and mechanics delete documents" on public.documents
  for delete using (public.has_role('mechanic') or public.is_manager());
