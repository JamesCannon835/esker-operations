-- =====================================================================
-- TASKS — the Actions list, now with manual tasks + photos.
--   • action_attachments  — photos / files on a task (files in Storage)
--   • lets the assigned person update / complete their own task
--   • lets any signed-in person add a photo to a task under actions/<id>/
--
-- Run once in the Supabase SQL editor. Safe to re-run.
-- =====================================================================

create table if not exists public.action_attachments (
  id uuid primary key default gen_random_uuid(),
  action_id uuid not null references public.actions(id) on delete cascade,
  file_path text not null,
  file_name text,
  content_type text,
  uploaded_by uuid references public.users(id),
  uploaded_at timestamptz not null default now()
);
create index if not exists action_attachments_action_idx
  on public.action_attachments (action_id);

alter table public.action_attachments enable row level security;

drop policy if exists "signed in read action attachments" on public.action_attachments;
create policy "signed in read action attachments" on public.action_attachments
  for select using (auth.uid() is not null);

drop policy if exists "add action attachments" on public.action_attachments;
create policy "add action attachments" on public.action_attachments
  for insert with check (auth.uid() is not null and uploaded_by = auth.uid());

drop policy if exists "remove own or manager action attachments" on public.action_attachments;
create policy "remove own or manager action attachments" on public.action_attachments
  for delete using (uploaded_by = auth.uid() or public.is_manager());

-- The person a task is assigned to can update / complete it.
drop policy if exists "assignee updates own action" on public.actions;
create policy "assignee updates own action" on public.actions
  for update using (assigned_to = auth.uid())
  with check (assigned_to = auth.uid());

-- Storage: anyone signed in may add a file under the actions/ prefix
-- (task photos). Reads already covered by "auth read documents bucket".
drop policy if exists "auth upload task photos" on storage.objects;
create policy "auth upload task photos"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = 'actions'
  );

drop policy if exists "auth delete own task photos" on storage.objects;
create policy "auth delete own task photos"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = 'actions'
    and (owner = auth.uid() or public.is_manager())
  );
