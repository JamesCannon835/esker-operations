-- =====================================================================
-- PHASE 6 — document storage
--
-- 1. FIRST, create the bucket in the dashboard:
--      Storage -> New bucket
--      Name:   documents
--      Public: OFF  (keep it private — the app serves signed links)
--
-- 2. THEN run this in the SQL editor to add access rules.
-- =====================================================================

-- Any signed-in user can read files in the documents bucket
-- (the app still decides who sees the download link).
create policy "auth read documents bucket"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'documents');

-- Managers and mechanics can upload / replace files
create policy "managers upload documents bucket"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'documents'
    and (public.has_role('mechanic') or public.is_manager())
  );

create policy "managers update documents bucket"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'documents'
    and (public.has_role('mechanic') or public.is_manager())
  );

-- Add UPDATE / DELETE on the documents table for the same roles
-- (base schema only allows INSERT).
create policy "managers and mechanics update documents" on public.documents
  for update using (public.has_role('mechanic') or public.is_manager());

create policy "managers and mechanics delete documents" on public.documents
  for delete using (public.has_role('mechanic') or public.is_manager());
