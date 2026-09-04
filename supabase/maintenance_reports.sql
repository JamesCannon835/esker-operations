-- =====================================================================
-- VEHICLE MAINTENANCE REPORT  +  central Actions system
--
-- Proper relational structure, built for thousands of reports over many
-- years. Run once in the Supabase SQL editor. Safe to re-run.
--
--   actions                  — the central follow-up / task system
--   maintenance_reports      — one row per report
--   maintenance_work_items   — individual jobs within a report
--   maintenance_parts        — parts used
--   maintenance_labour       — mechanic hours (one row per mechanic)
--   maintenance_attachments  — photos / documents (files live in Storage)
-- =====================================================================

-- ---------------------------------------------------------------------
-- ACTIONS  (foundation piece — later reused by Safety, Quality, Environmental)
-- ---------------------------------------------------------------------
create table if not exists public.actions (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,                -- 'maintenance_report', later 'incident' etc.
  entity_id uuid not null,
  source text,                              -- 'maintenance_followup', 'inspection', 'manual'
  title text not null,
  detail text,
  priority text not null default 'normal',  -- critical | high | normal | low
  assigned_to uuid references public.users(id),
  raised_by uuid references public.users(id),
  due_date date,
  status text not null default 'open',      -- open | in_progress | done | cancelled
  completed_at timestamptz,
  completed_by uuid references public.users(id),
  completion_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists actions_status_idx on public.actions (status);
create index if not exists actions_entity_idx on public.actions (entity_type, entity_id);
create index if not exists actions_assigned_idx on public.actions (assigned_to);

-- ---------------------------------------------------------------------
-- MAINTENANCE REPORTS
-- ---------------------------------------------------------------------
create table if not exists public.maintenance_reports (
  id uuid primary key default gen_random_uuid(),
  report_number text unique,               -- VMR-YYYY-NNNN, assigned on completion
  vehicle_id uuid not null references public.vehicles(id),
  fault_id uuid references public.faults(id),
  source_inspection_id uuid references public.inspections(id),

  report_date date not null default current_date,
  report_time time,
  mileage numeric,
  engine_hours numeric,

  reasons text[] not null default '{}',    -- driver_fault, daily_check_defect, scheduled,
                                           -- service, thirteen_week_repair, cvrt_prep,
                                           -- breakdown, preventative, damage_repair,
                                           -- management_request, other
  issue_description text,                   -- fault / issue reported (mechanic's words)
  work_summary text,                        -- "Work Carried Out" free text
  notes text,                              -- Notes / additional observations

  vehicle_status text,                     -- safe | safe_monitor | not_safe |
                                           -- awaiting_parts | awaiting_external |
                                           -- further_investigation

  followup_required boolean not null default false,
  followup_detail text,
  followup_priority text,                  -- critical | high | normal | low
  followup_assigned_to uuid references public.users(id),
  followup_due_date date,
  followup_action_id uuid references public.actions(id) on delete set null,

  created_by uuid references public.users(id),
  status text not null default 'draft',    -- draft | completed
  completed_at timestamptz,
  completed_by uuid references public.users(id),
  signature_confirmed boolean not null default false,
  reopened_count int not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists mr_vehicle_idx on public.maintenance_reports (vehicle_id);
create index if not exists mr_fault_idx on public.maintenance_reports (fault_id);
create index if not exists mr_status_idx on public.maintenance_reports (status);
create index if not exists mr_date_idx on public.maintenance_reports (report_date);
create index if not exists mr_vehicle_status_idx on public.maintenance_reports (vehicle_status);

-- ---------------------------------------------------------------------
-- WORK ITEMS
-- ---------------------------------------------------------------------
create table if not exists public.maintenance_work_items (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.maintenance_reports(id) on delete cascade,
  description text not null,
  category text,                           -- brakes, electrical, tyres, bodywork, engine, ...
  completed boolean not null default true,
  labour_minutes int,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists mwi_report_idx on public.maintenance_work_items (report_id);

-- ---------------------------------------------------------------------
-- PARTS
-- ---------------------------------------------------------------------
create table if not exists public.maintenance_parts (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.maintenance_reports(id) on delete cascade,
  work_item_id uuid references public.maintenance_work_items(id) on delete set null,
  description text not null,
  part_number text,
  quantity numeric not null default 1,
  supplier text,
  unit_cost numeric,
  total_cost numeric generated always as (quantity * coalesce(unit_cost, 0)) stored,
  created_at timestamptz not null default now()
);
create index if not exists mp_report_idx on public.maintenance_parts (report_id);

-- ---------------------------------------------------------------------
-- LABOUR  (one row per mechanic per report)
-- ---------------------------------------------------------------------
create table if not exists public.maintenance_labour (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.maintenance_reports(id) on delete cascade,
  mechanic_id uuid references public.users(id),
  minutes int not null,
  work_date date not null default current_date,
  from_fault_labour_id uuid references public.labour_entries(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists ml_report_idx on public.maintenance_labour (report_id);
create index if not exists ml_mechanic_idx on public.maintenance_labour (mechanic_id);

-- ---------------------------------------------------------------------
-- ATTACHMENTS  (files stored in the `documents` bucket under maintenance/)
-- ---------------------------------------------------------------------
create table if not exists public.maintenance_attachments (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.maintenance_reports(id) on delete cascade,
  kind text,                               -- before | after | damage | part | supplier_doc | invoice | other
  file_path text not null,
  file_name text,
  uploaded_by uuid references public.users(id),
  uploaded_at timestamptz not null default now()
);
create index if not exists ma_report_idx on public.maintenance_attachments (report_id);

-- ---------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- ---------------------------------------------------------------------
alter table public.actions enable row level security;
alter table public.maintenance_reports enable row level security;
alter table public.maintenance_work_items enable row level security;
alter table public.maintenance_parts enable row level security;
alter table public.maintenance_labour enable row level security;
alter table public.maintenance_attachments enable row level security;

-- helper: mechanic or manager
create or replace function public.is_workshop()
returns boolean language sql stable security definer as $$
  select public.has_role('mechanic') or public.is_manager();
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'actions','maintenance_reports','maintenance_work_items',
    'maintenance_parts','maintenance_labour','maintenance_attachments'
  ] loop
    execute format('drop policy if exists "signed in read %1$s" on public.%1$s', t);
    execute format(
      'create policy "signed in read %1$s" on public.%1$s for select using (auth.uid() is not null)', t);
    execute format('drop policy if exists "workshop insert %1$s" on public.%1$s', t);
    execute format(
      'create policy "workshop insert %1$s" on public.%1$s for insert with check (public.is_workshop())', t);
    execute format('drop policy if exists "workshop update %1$s" on public.%1$s', t);
    execute format(
      'create policy "workshop update %1$s" on public.%1$s for update using (public.is_workshop())', t);
    execute format('drop policy if exists "manager delete %1$s" on public.%1$s', t);
    execute format(
      'create policy "manager delete %1$s" on public.%1$s for delete using (public.is_manager())', t);
  end loop;
end $$;
