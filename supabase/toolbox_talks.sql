-- =====================================================================
-- TOOLBOX TALKS
--   • toolbox_talks            — one row per weekly talk
--   • toolbox_talk_recipients  — who it went to + their drawn signature
-- Signatures are stored inline as small PNG data URLs (a few KB each) —
-- no storage bucket needed. A signed-off PDF is generated on demand.
--
-- Run once in the Supabase SQL editor. Safe to re-run.
-- =====================================================================

create table if not exists public.toolbox_talks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  talk_date date not null default current_date,
  body text,
  document_id uuid references public.hs_documents(id) on delete set null,
  attachment_path text,
  attachment_name text,
  status text not null default 'draft',        -- draft | sent
  created_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create table if not exists public.toolbox_talk_recipients (
  id uuid primary key default gen_random_uuid(),
  talk_id uuid not null references public.toolbox_talks(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  signed_at timestamptz,
  signature_data text,
  unique (talk_id, user_id)
);
create index if not exists ttr_user_idx on public.toolbox_talk_recipients (user_id);
create index if not exists ttr_talk_idx on public.toolbox_talk_recipients (talk_id);

alter table public.toolbox_talks enable row level security;
alter table public.toolbox_talk_recipients enable row level security;

-- Talks: managers manage; a recipient can read a talk that was sent to them.
drop policy if exists "managers manage toolbox talks" on public.toolbox_talks;
create policy "managers manage toolbox talks" on public.toolbox_talks
  for all using (public.is_manager()) with check (public.is_manager());

drop policy if exists "recipients read their toolbox talks" on public.toolbox_talks;
create policy "recipients read their toolbox talks" on public.toolbox_talks
  for select using (
    public.is_manager()
    or exists (
      select 1 from public.toolbox_talk_recipients r
      where r.talk_id = toolbox_talks.id and r.user_id = auth.uid()
    )
  );

-- Recipient rows: a person sees and signs their own; managers see and set all.
drop policy if exists "read own or manager reads recipients" on public.toolbox_talk_recipients;
create policy "read own or manager reads recipients" on public.toolbox_talk_recipients
  for select using (user_id = auth.uid() or public.is_manager());

drop policy if exists "managers add recipients" on public.toolbox_talk_recipients;
create policy "managers add recipients" on public.toolbox_talk_recipients
  for insert with check (public.is_manager());

drop policy if exists "sign own or manager edits recipients" on public.toolbox_talk_recipients;
create policy "sign own or manager edits recipients" on public.toolbox_talk_recipients
  for update using (user_id = auth.uid() or public.is_manager())
  with check (user_id = auth.uid() or public.is_manager());

drop policy if exists "managers remove recipients" on public.toolbox_talk_recipients;
create policy "managers remove recipients" on public.toolbox_talk_recipients
  for delete using (public.is_manager());
