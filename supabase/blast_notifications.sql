-- =====================================================================
-- BLAST NOTIFICATIONS
--   • neighbours                     — the contact list
--   • sms_templates                  — reusable message bodies
--   • blast_notifications            — one row per notification sent
--   • blast_notification_recipients  — per-neighbour delivery record
--
-- The actual SMS sending is wired to a provider later; until then the
-- register, message drafting and log all work and "Send" is blocked.
-- Management only.
--
-- Run once in the Supabase SQL editor. Safe to re-run.
-- =====================================================================

create table if not exists public.neighbours (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  address text,
  notes text,
  active boolean not null default true,
  created_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sms_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.blast_notifications (
  id uuid primary key default gen_random_uuid(),
  title text,
  blast_at timestamptz,
  message text not null,
  status text not null default 'draft',   -- draft | sent
  created_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  sent_by uuid references public.users(id),
  sent_at timestamptz
);

create table if not exists public.blast_notification_recipients (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null
    references public.blast_notifications(id) on delete cascade,
  neighbour_id uuid references public.neighbours(id) on delete set null,
  name text,
  phone text not null,
  status text not null default 'pending', -- pending | sent | delivered | failed
  provider_ref text,
  error text,
  updated_at timestamptz not null default now()
);
create index if not exists bnr_notification_idx
  on public.blast_notification_recipients (notification_id);

alter table public.neighbours enable row level security;
alter table public.sms_templates enable row level security;
alter table public.blast_notifications enable row level security;
alter table public.blast_notification_recipients enable row level security;

do $$
declare t text;
begin
  foreach t in array array[
    'neighbours', 'sms_templates', 'blast_notifications',
    'blast_notification_recipients'
  ] loop
    execute format('drop policy if exists "managers manage %1$s" on public.%1$s', t);
    execute format(
      'create policy "managers manage %1$s" on public.%1$s
         for all using (public.is_manager()) with check (public.is_manager())',
      t
    );
  end loop;
end $$;

-- Starter templates — edit freely in the app afterwards.
insert into public.sms_templates (name, body) values
  (
    'Standard pre-blast',
    'Esker Readymix Quarry: a blast is planned for {date} at approx {time}. This is routine and no action is required. Queries: [office number].'
  ),
  (
    'Blast postponed',
    'Esker Readymix Quarry: the blast planned for {date} has been postponed. We will let you know the new date.'
  )
on conflict do nothing;
