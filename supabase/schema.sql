-- =====================================================================
-- ESKER OPERATIONS — VERSION 1 DATABASE SETUP
-- Run this once in Supabase: Project → SQL Editor → New query → paste
-- this whole file → Run. It creates every table, relationship and
-- starter security rule from the architecture document.
-- =====================================================================

-- ---------------------------------------------------------------------
-- EXTENSIONS
-- ---------------------------------------------------------------------
create extension if not exists "pgcrypto"; -- gives us gen_random_uuid()

-- ---------------------------------------------------------------------
-- ENUM TYPES
-- ---------------------------------------------------------------------
create type app_role as enum ('driver','plant_operator','mechanic','transport_manager','admin');
create type asset_type_t as enum ('vehicle','plant','trailer');
create type asset_status_t as enum ('available','in_use','maintenance','breakdown','off_road','retired');
create type compliance_type_t as enum ('tax','cvrt_test','insurance','thirteen_week_inspection','tacho_calibration','service','other');
create type inspection_type_t as enum ('daily_vehicle','daily_plant','thirteen_week','pre_test');
create type inspection_result_t as enum ('pass','fail','na');
create type fault_severity_t as enum ('critical','urgent','normal','monitor');
create type fault_status_t as enum ('reported','accepted','in_progress','awaiting_parts','completed','closed');
create type labour_entry_type_t as enum ('diagnosis','repair','waiting');
create type audit_action_t as enum ('create','update','delete','void');

-- ---------------------------------------------------------------------
-- USERS & ROLES (multi-role: a person can hold more than one role)
-- ---------------------------------------------------------------------
create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  phone text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  role app_role not null,
  unique (user_id, role)
);

-- Helper: check if the currently logged-in user holds a given role.
-- Used throughout the security rules below.
create or replace function public.has_role(check_role app_role)
returns boolean
language sql stable security definer
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role = check_role
  );
$$;

-- Helper: management-level access (admin or transport manager)
create or replace function public.is_manager()
returns boolean
language sql stable security definer
as $$
  select public.has_role('admin') or public.has_role('transport_manager');
$$;

-- ---------------------------------------------------------------------
-- ASSETS
-- ---------------------------------------------------------------------
create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  fleet_number text unique not null,
  registration text unique not null,
  make text, model text, vehicle_type text, year int, vin text,
  current_mileage numeric default 0,
  fuel_type text,
  status asset_status_t not null default 'available',
  assigned_driver_id uuid references public.users(id),
  service_interval_km numeric,
  next_service_mileage numeric,
  next_service_date date,
  qr_code text unique default gen_random_uuid()::text,
  notes text,
  voided boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.plant (
  id uuid primary key default gen_random_uuid(),
  asset_number text unique not null,
  plant_type text, make text, model text, year int, serial_number text,
  current_hours numeric default 0,
  service_interval_hours numeric,
  next_service_hours numeric,
  next_service_date date,
  status asset_status_t not null default 'available',
  assigned_operator_id uuid references public.users(id),
  qr_code text unique default gen_random_uuid()::text,
  notes text,
  voided boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.trailers (
  id uuid primary key default gen_random_uuid(),
  registration text unique not null,
  trailer_type text, make text, model text, year int, vin text,
  assigned_vehicle_id uuid references public.vehicles(id),
  qr_code text unique default gen_random_uuid()::text,
  notes text,
  voided boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- COMPLIANCE (one row per date, per asset — tax, CVRT, tacho, etc.)
-- ---------------------------------------------------------------------
create table public.compliance_items (
  id uuid primary key default gen_random_uuid(),
  asset_type asset_type_t not null,
  asset_id uuid not null,
  compliance_type compliance_type_t not null,
  due_date date not null,
  last_completed_date date,
  notes text,
  voided boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Computed status (green/amber/red), amber = due within 14 days.
-- Adjust the "14" below later if you want different warning windows
-- per compliance type.
create or replace view public.compliance_status as
select
  c.*,
  case
    when c.due_date < current_date then 'red'
    when c.due_date <= current_date + interval '14 days' then 'amber'
    else 'green'
  end as status
from public.compliance_items c
where c.voided = false;

-- ---------------------------------------------------------------------
-- INSPECTIONS (configurable checklists)
-- ---------------------------------------------------------------------
create table public.inspection_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  asset_type asset_type_t not null,
  category text
);

create table public.inspection_template_items (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.inspection_templates(id) on delete cascade,
  item_name text not null,
  sort_order int not null default 0
);

create table public.inspections (
  id uuid primary key default gen_random_uuid(),
  inspection_type inspection_type_t not null,
  asset_type asset_type_t not null,
  asset_id uuid not null,
  template_id uuid references public.inspection_templates(id),
  completed_by uuid references public.users(id),
  mileage_or_hours numeric,
  result inspection_result_t,
  signature_confirmed boolean not null default false,
  completed_at timestamptz not null default now(),
  voided boolean not null default false
);

create table public.inspection_item_results (
  id uuid primary key default gen_random_uuid(),
  inspection_id uuid not null references public.inspections(id) on delete cascade,
  template_item_id uuid references public.inspection_template_items(id),
  result inspection_result_t not null,
  comment text,
  photo_url text
);

-- ---------------------------------------------------------------------
-- FAULTS, LABOUR, PARTS, SERVICES, BREAKDOWNS
-- ---------------------------------------------------------------------
create table public.faults (
  id uuid primary key default gen_random_uuid(),
  asset_type asset_type_t not null,
  asset_id uuid not null,
  reported_by uuid references public.users(id),
  reported_at timestamptz not null default now(),
  location text,
  category text,
  description text not null,
  severity fault_severity_t not null default 'normal',
  safe_to_operate boolean not null default true,
  photo_url text,
  video_url text,
  status fault_status_t not null default 'reported',
  assigned_mechanic_id uuid references public.users(id),
  diagnosis text,
  source_inspection_id uuid references public.inspections(id),
  closed_by uuid references public.users(id),
  closed_at timestamptz,
  voided boolean not null default false
);

create table public.labour_entries (
  id uuid primary key default gen_random_uuid(),
  fault_id uuid not null references public.faults(id) on delete cascade,
  mechanic_id uuid references public.users(id),
  start_time timestamptz,
  stop_time timestamptz,
  entry_type labour_entry_type_t not null default 'repair',
  corrected_by uuid references public.users(id),
  correction_reason text,
  created_at timestamptz not null default now()
);

create table public.parts_used (
  id uuid primary key default gen_random_uuid(),
  fault_id uuid not null references public.faults(id) on delete cascade,
  part_name text not null,
  part_number text,
  quantity numeric not null default 1,
  unit_cost numeric,
  supplier text,
  total_cost numeric generated always as (quantity * coalesce(unit_cost,0)) stored
);

create table public.services (
  id uuid primary key default gen_random_uuid(),
  asset_type asset_type_t not null,
  asset_id uuid not null,
  service_date date not null default current_date,
  mileage_or_hours numeric,
  performed_by uuid references public.users(id),
  notes text,
  cost numeric,
  created_at timestamptz not null default now()
);

create table public.breakdowns (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid references public.vehicles(id),
  driver_id uuid references public.users(id),
  reported_at timestamptz not null default now(),
  location_lat numeric,
  location_lng numeric,
  problem_description text,
  immobilised boolean not null default false,
  photo_url text,
  video_url text,
  mechanic_notified_at timestamptz,
  mechanic_arrived_at timestamptz,
  recovery_required boolean not null default false,
  repair_completed_at timestamptz,
  returned_to_service_at timestamptz
);

-- ---------------------------------------------------------------------
-- DOCUMENTS & AUDIT
-- ---------------------------------------------------------------------
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  asset_type asset_type_t not null,
  asset_id uuid not null,
  category text,
  file_url text not null,
  uploaded_by uuid references public.users(id),
  uploaded_at timestamptz not null default now(),
  expiry_date date,
  voided boolean not null default false
);

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  table_name text not null,
  record_id uuid not null,
  action audit_action_t not null,
  changed_by uuid references public.users(id),
  changed_at timestamptz not null default now(),
  old_value jsonb,
  new_value jsonb
);

-- ---------------------------------------------------------------------
-- INDEXES for the lookups the dashboard will do constantly
-- ---------------------------------------------------------------------
create index on public.compliance_items (asset_type, asset_id);
create index on public.compliance_items (due_date);
create index on public.faults (status);
create index on public.faults (asset_type, asset_id);
create index on public.inspections (asset_type, asset_id);
create index on public.documents (asset_type, asset_id);

-- ---------------------------------------------------------------------
-- ROW LEVEL SECURITY — starter policies
-- This is a first pass covering the clearest rules from the
-- permissions table. Treat this as a draft to test thoroughly
-- (log in as each role and confirm what they can't see) before
-- real driver/compliance data goes in — flagged as a risk in the
-- architecture doc for a reason.
-- ---------------------------------------------------------------------

alter table public.users enable row level security;
alter table public.user_roles enable row level security;
alter table public.vehicles enable row level security;
alter table public.plant enable row level security;
alter table public.trailers enable row level security;
alter table public.compliance_items enable row level security;
alter table public.inspection_templates enable row level security;
alter table public.inspection_template_items enable row level security;
alter table public.inspections enable row level security;
alter table public.inspection_item_results enable row level security;
alter table public.faults enable row level security;
alter table public.labour_entries enable row level security;
alter table public.parts_used enable row level security;
alter table public.services enable row level security;
alter table public.breakdowns enable row level security;
alter table public.documents enable row level security;
alter table public.audit_log enable row level security;

-- Everyone logged in can see their own user row; managers see all.
create policy "own or manager can view users" on public.users
  for select using (id = auth.uid() or public.is_manager());

create policy "own or manager can view roles" on public.user_roles
  for select using (user_id = auth.uid() or public.is_manager());
create policy "only admin manages roles" on public.user_roles
  for all using (public.has_role('admin')) with check (public.has_role('admin'));

-- Assets: everyone logged in can view; only managers can create/edit/void.
create policy "authenticated can view vehicles" on public.vehicles for select using (auth.uid() is not null);
create policy "managers manage vehicles" on public.vehicles for insert with check (public.is_manager());
create policy "managers update vehicles" on public.vehicles for update using (public.is_manager());

create policy "authenticated can view plant" on public.plant for select using (auth.uid() is not null);
create policy "managers manage plant" on public.plant for insert with check (public.is_manager());
create policy "managers update plant" on public.plant for update using (public.is_manager());

create policy "authenticated can view trailers" on public.trailers for select using (auth.uid() is not null);
create policy "managers manage trailers" on public.trailers for insert with check (public.is_manager());
create policy "managers update trailers" on public.trailers for update using (public.is_manager());

-- Compliance: everyone can view (dashboard needs it); only managers edit.
create policy "authenticated can view compliance" on public.compliance_items for select using (auth.uid() is not null);
create policy "managers manage compliance" on public.compliance_items for insert with check (public.is_manager());
create policy "managers update compliance" on public.compliance_items for update using (public.is_manager());

-- Inspection templates: everyone can view; only managers/admin edit.
create policy "authenticated can view templates" on public.inspection_templates for select using (auth.uid() is not null);
create policy "managers manage templates" on public.inspection_templates for insert with check (public.is_manager());
create policy "authenticated can view template items" on public.inspection_template_items for select using (auth.uid() is not null);
create policy "managers manage template items" on public.inspection_template_items for insert with check (public.is_manager());

-- Inspections: drivers/operators can create their own; everyone with
-- a role can view (mechanics and managers need the full picture).
create policy "authenticated can view inspections" on public.inspections for select using (auth.uid() is not null);
create policy "driver or operator can submit inspections" on public.inspections
  for insert with check (
    completed_by = auth.uid()
    and (public.has_role('driver') or public.has_role('plant_operator') or public.has_role('mechanic') or public.is_manager())
  );

create policy "authenticated can view inspection results" on public.inspection_item_results for select using (auth.uid() is not null);
create policy "authenticated can add inspection results" on public.inspection_item_results for insert with check (auth.uid() is not null);

-- Faults: anyone can report; only mechanics/managers can accept, assign, close.
create policy "authenticated can view faults" on public.faults for select using (auth.uid() is not null);
create policy "authenticated can report faults" on public.faults for insert with check (reported_by = auth.uid());
create policy "mechanics and managers update faults" on public.faults
  for update using (public.has_role('mechanic') or public.is_manager());

-- Labour & parts: mechanics record their own; managers see/correct all.
create policy "mechanics view own labour, managers view all" on public.labour_entries
  for select using (mechanic_id = auth.uid() or public.is_manager());
create policy "mechanics log labour" on public.labour_entries
  for insert with check (mechanic_id = auth.uid() and public.has_role('mechanic'));
create policy "managers correct labour" on public.labour_entries
  for update using (public.is_manager());

create policy "mechanics and managers view parts" on public.parts_used
  for select using (public.has_role('mechanic') or public.is_manager());
create policy "mechanics log parts" on public.parts_used
  for insert with check (public.has_role('mechanic') or public.is_manager());

-- Services & breakdowns: viewable by all logged in; loggable by mechanics/drivers/managers.
create policy "authenticated can view services" on public.services for select using (auth.uid() is not null);
create policy "mechanics and managers log services" on public.services
  for insert with check (public.has_role('mechanic') or public.is_manager());

create policy "authenticated can view breakdowns" on public.breakdowns for select using (auth.uid() is not null);
create policy "drivers report breakdowns" on public.breakdowns
  for insert with check (driver_id = auth.uid());
create policy "mechanics and managers update breakdowns" on public.breakdowns
  for update using (public.has_role('mechanic') or public.is_manager());

-- Documents: viewable by all logged in; uploadable by managers/mechanics.
create policy "authenticated can view documents" on public.documents for select using (auth.uid() is not null);
create policy "managers and mechanics upload documents" on public.documents
  for insert with check (public.has_role('mechanic') or public.is_manager());

-- Audit log: managers only.
create policy "managers view audit log" on public.audit_log for select using (public.is_manager());

-- =====================================================================
-- END OF SCRIPT
-- Once this runs without errors, your database has every table from
-- the architecture document, ready for the app to connect to.
-- =====================================================================
