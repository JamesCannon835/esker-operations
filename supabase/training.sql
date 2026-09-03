-- =====================================================================
-- SAFETY TRAINING REGISTER
--   • training_courses — the editable list of course types
--   • training_records — one row per person per completed course
-- Certificates are stored in the existing `documents` storage bucket
-- under a `training/` prefix; only the path is kept here.
--
-- Run once in the Supabase SQL editor.
-- =====================================================================

create table if not exists public.training_courses (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.training_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  course_id uuid references public.training_courses(id),
  course_name text not null,          -- snapshot, so a course rename/removal never loses history
  completed_date date not null,
  expiry_date date,                   -- null = does not expire
  certificate_path text,              -- object path inside the `documents` bucket
  certificate_name text,              -- original file name, for display
  notes text,
  created_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  voided boolean not null default false
);
create index if not exists training_records_user_idx on public.training_records (user_id);

alter table public.training_courses enable row level security;
alter table public.training_records enable row level security;

-- Courses: any signed-in user can read; managers (admin / transport manager) manage.
create policy "signed in reads training courses" on public.training_courses
  for select using (auth.uid() is not null);
create policy "managers manage training courses" on public.training_courses
  for all using (public.is_manager()) with check (public.is_manager());

-- Records: a person can read their own; managers read and write everyone's.
create policy "read own or manager reads all training" on public.training_records
  for select using (user_id = auth.uid() or public.is_manager());
create policy "managers insert training" on public.training_records
  for insert with check (public.is_manager());
create policy "managers update training" on public.training_records
  for update using (public.is_manager()) with check (public.is_manager());
create policy "managers delete training" on public.training_records
  for delete using (public.is_manager());

-- Starter course list — edit freely afterwards in the app.
insert into public.training_courses (name) values
  ('Safe Pass'),
  ('Manual Handling'),
  ('Abrasive Wheels'),
  ('Working at Height'),
  ('First Aid (Occupational)'),
  ('Fire Warden'),
  ('Banksman / Slinger Signaller'),
  ('Confined Space'),
  ('Driver CPC'),
  ('ADR'),
  ('Forklift'),
  ('Telehandler'),
  ('360 Excavator'),
  ('Dumper')
on conflict (name) do nothing;
