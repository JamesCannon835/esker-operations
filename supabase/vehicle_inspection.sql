-- =====================================================================
-- VEHICLE INSPECTION & RECTIFICATION REPORT
--
-- A detailed mechanic checklist, separate from the driver daily check and
-- the Maintenance Report. Defects flow into the existing Fault Hub.
-- Reusable inspection engine — one checklist per asset kind (vehicle now).
--
--   inspection_checklists        — templates (editable master)
--   inspection_checklist_items   — the items, by section, with IM ref codes
--   vehicle_inspections          — one completed/in-progress inspection
--   vehicle_inspection_results   — one row per item (result + defect + fault)
--
-- Run once in the Supabase SQL editor. Safe to re-run (seed is idempotent).
-- =====================================================================

create table if not exists public.inspection_checklists (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  applies_to text not null default 'vehicle',   -- vehicle | trailer | plant (future)
  recurring_days int,                            -- 91 = 13-week
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.inspection_checklist_items (
  id uuid primary key default gen_random_uuid(),
  checklist_id uuid not null references public.inspection_checklists(id) on delete cascade,
  section text not null,
  reference_code text,
  item_name text not null,
  sort_order int not null default 0,
  active boolean not null default true
);
create index if not exists ici_checklist_idx on public.inspection_checklist_items (checklist_id);

create table if not exists public.vehicle_inspections (
  id uuid primary key default gen_random_uuid(),
  checklist_id uuid references public.inspection_checklists(id),
  inspection_number text unique,                 -- VIR-YYYY-NNNN, on completion
  vehicle_id uuid not null references public.vehicles(id),
  inspector_id uuid references public.users(id),
  odometer numeric,
  engine_hours numeric,
  inspection_date date not null default current_date,
  inspection_time time,
  status text not null default 'draft',          -- draft | completed
  result text,                                   -- passed | defects | out_of_service
  out_of_service boolean not null default false,
  signature_confirmed boolean not null default false,
  completed_at timestamptz,
  completed_by uuid references public.users(id),
  notes text,
  reopened_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists vi_vehicle_idx on public.vehicle_inspections (vehicle_id);
create index if not exists vi_status_idx on public.vehicle_inspections (status);
create index if not exists vi_date_idx on public.vehicle_inspections (inspection_date);
create index if not exists vi_oos_idx on public.vehicle_inspections (out_of_service);

create table if not exists public.vehicle_inspection_results (
  id uuid primary key default gen_random_uuid(),
  inspection_id uuid not null references public.vehicle_inspections(id) on delete cascade,
  checklist_item_id uuid references public.inspection_checklist_items(id),
  section text not null,
  reference_code text,
  item_name text not null,
  sort_order int not null default 0,
  result text,                                   -- ok | defect | na  (null = not done yet)
  defect_description text,
  severity text,                                 -- critical | urgent | normal
  safe_to_operate boolean,
  fault_id uuid references public.faults(id) on delete set null,
  photo_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (inspection_id, checklist_item_id)
);
create index if not exists vir_inspection_idx on public.vehicle_inspection_results (inspection_id);
create index if not exists vir_fault_idx on public.vehicle_inspection_results (fault_id);

-- Link a fault back to the inspection that raised it.
alter table public.faults
  add column if not exists source_vehicle_inspection_id uuid references public.vehicle_inspections(id) on delete set null;

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table public.inspection_checklists enable row level security;
alter table public.inspection_checklist_items enable row level security;
alter table public.vehicle_inspections enable row level security;
alter table public.vehicle_inspection_results enable row level security;

do $$
declare t text;
begin
  foreach t in array array[
    'inspection_checklists','inspection_checklist_items',
    'vehicle_inspections','vehicle_inspection_results'
  ] loop
    execute format('drop policy if exists "signed in read %1$s" on public.%1$s', t);
    execute format('create policy "signed in read %1$s" on public.%1$s for select using (auth.uid() is not null)', t);
  end loop;

  -- checklist master: managers manage
  foreach t in array array['inspection_checklists','inspection_checklist_items'] loop
    execute format('drop policy if exists "managers manage %1$s" on public.%1$s', t);
    execute format('create policy "managers manage %1$s" on public.%1$s for all using (public.is_manager()) with check (public.is_manager())', t);
  end loop;

  -- inspection records: mechanic or manager
  foreach t in array array['vehicle_inspections','vehicle_inspection_results'] loop
    execute format('drop policy if exists "workshop write %1$s" on public.%1$s', t);
    execute format('create policy "workshop write %1$s" on public.%1$s for insert with check (public.is_workshop())', t);
    execute format('drop policy if exists "workshop update %1$s" on public.%1$s', t);
    execute format('create policy "workshop update %1$s" on public.%1$s for update using (public.is_workshop())', t);
    execute format('drop policy if exists "manager delete %1$s" on public.%1$s', t);
    execute format('create policy "manager delete %1$s" on public.%1$s for delete using (public.is_manager())', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- SEED — the vehicle checklist
-- ---------------------------------------------------------------------
insert into public.inspection_checklists (id, name, applies_to, recurring_days)
values ('55555555-0000-0000-0000-0000000000a1',
        'Vehicle Inspection & Rectification Report', 'vehicle', 91)
on conflict (id) do update set name = excluded.name, recurring_days = excluded.recurring_days;

delete from public.inspection_checklist_items
  where checklist_id = '55555555-0000-0000-0000-0000000000a1';

insert into public.inspection_checklist_items
  (checklist_id, section, reference_code, item_name, sort_order)
values
  -- A. INSIDE CAB
  ('55555555-0000-0000-0000-0000000000a1','A. Inside cab','18','Driver''s seat',10),
  ('55555555-0000-0000-0000-0000000000a1','A. Inside cab','3','Seat belts and supplementary restraint systems',20),
  ('55555555-0000-0000-0000-0000000000a1','A. Inside cab','22','Mirrors and indirect vision devices',30),
  ('55555555-0000-0000-0000-0000000000a1','A. Inside cab','23','Glass and view of the road',40),
  ('55555555-0000-0000-0000-0000000000a1','A. Inside cab','24','Accessibility features',50),
  ('55555555-0000-0000-0000-0000000000a1','A. Inside cab','25','Windscreen wipers and washers',60),
  ('55555555-0000-0000-0000-0000000000a1','A. Inside cab','26','Speedometer / tachograph',70),
  ('55555555-0000-0000-0000-0000000000a1','A. Inside cab','27','Horn',80),
  ('55555555-0000-0000-0000-0000000000a1','A. Inside cab','28','Driving controls',90),
  ('55555555-0000-0000-0000-0000000000a1','A. Inside cab','30','Steering control',100),
  ('55555555-0000-0000-0000-0000000000a1','A. Inside cab','37','Service brake pedal',110),
  ('55555555-0000-0000-0000-0000000000a1','A. Inside cab','38','Service brake operation',120),
  ('55555555-0000-0000-0000-0000000000a1','A. Inside cab','34','Pressure/vacuum warning and build-up',130),
  ('55555555-0000-0000-0000-0000000000a1','A. Inside cab','36','Hand lever operating mechanical brakes',140),
  ('55555555-0000-0000-0000-0000000000a1','A. Inside cab','39','Hand-operated brake control valves',150),
  ('55555555-0000-0000-0000-0000000000a1','A. Inside cab','17','Driver''s accommodation',160),
  ('55555555-0000-0000-0000-0000000000a1','A. Inside cab','21','Interior of body, passenger entrance, exit steps and platforms',170),
  ('55555555-0000-0000-0000-0000000000a1','A. Inside cab','V','Licenses',180),
  ('55555555-0000-0000-0000-0000000000a1','A. Inside cab','W','Legal writing',190),
  ('55555555-0000-0000-0000-0000000000a1','A. Inside cab','U','Other audible warnings',200),
  ('55555555-0000-0000-0000-0000000000a1','A. Inside cab','B','Anti-theft device/alarm',210),
  ('55555555-0000-0000-0000-0000000000a1','A. Inside cab','C','Other instruments',220),
  ('55555555-0000-0000-0000-0000000000a1','A. Inside cab','D','Interior and panel lights',230),
  ('55555555-0000-0000-0000-0000000000a1','A. Inside cab','E','Heating and demisting system',240),
  ('55555555-0000-0000-0000-0000000000a1','A. Inside cab',null,'Alcohol breath tester',250),
  ('55555555-0000-0000-0000-0000000000a1','A. Inside cab',null,'Fire extinguisher',260),
  ('55555555-0000-0000-0000-0000000000a1','A. Inside cab',null,'First aid kit',270),
  ('55555555-0000-0000-0000-0000000000a1','A. Inside cab',null,'Hands-free kit',280),
  ('55555555-0000-0000-0000-0000000000a1','A. Inside cab','74','Other dangerous defects',290),
  -- B. GROUND LEVEL & UNDER VEHICLE
  ('55555555-0000-0000-0000-0000000000a1','B. Ground level & under vehicle','1','Registration plates',300),
  ('55555555-0000-0000-0000-0000000000a1','B. Ground level & under vehicle','16','Passenger doors, driver''s doors and emergency exits',310),
  ('55555555-0000-0000-0000-0000000000a1','B. Ground level & under vehicle','19','Security of body',320),
  ('55555555-0000-0000-0000-0000000000a1','B. Ground level & under vehicle','20','Exterior of body including luggage compartment',330),
  ('55555555-0000-0000-0000-0000000000a1','B. Ground level & under vehicle','5','Exhaust emissions',340),
  ('55555555-0000-0000-0000-0000000000a1','B. Ground level & under vehicle','6','Road wheels and hubs',350),
  ('55555555-0000-0000-0000-0000000000a1','B. Ground level & under vehicle','9','Bumper bars',360),
  ('55555555-0000-0000-0000-0000000000a1','B. Ground level & under vehicle','10','Spare wheel and carrier',370),
  ('55555555-0000-0000-0000-0000000000a1','B. Ground level & under vehicle','41','Condition of chassis',380),
  ('55555555-0000-0000-0000-0000000000a1','B. Ground level & under vehicle','14','Wings and wheel arches',390),
  ('55555555-0000-0000-0000-0000000000a1','B. Ground level & under vehicle','11','Vehicle to trailer coupling',400),
  ('55555555-0000-0000-0000-0000000000a1','B. Ground level & under vehicle','33','Speed limiting device',410),
  ('55555555-0000-0000-0000-0000000000a1','B. Ground level & under vehicle','42','Electrical wiring and equipment',420),
  ('55555555-0000-0000-0000-0000000000a1','B. Ground level & under vehicle','43','Engine and transmission mountings',430),
  ('55555555-0000-0000-0000-0000000000a1','B. Ground level & under vehicle','44','Oil and waste leaks',440),
  ('55555555-0000-0000-0000-0000000000a1','B. Ground level & under vehicle','45','Fuel tanks and system',450),
  ('55555555-0000-0000-0000-0000000000a1','B. Ground level & under vehicle','46','Exhaust and waste systems',460),
  ('55555555-0000-0000-0000-0000000000a1','B. Ground level & under vehicle','K','Axle alignment',470),
  ('55555555-0000-0000-0000-0000000000a1','B. Ground level & under vehicle','O','Steering alignment',480),
  ('55555555-0000-0000-0000-0000000000a1','B. Ground level & under vehicle','54','Steering mechanism',490),
  ('55555555-0000-0000-0000-0000000000a1','B. Ground level & under vehicle','48','Suspension',500),
  ('55555555-0000-0000-0000-0000000000a1','B. Ground level & under vehicle','53','Axles, stub axles and wheel bearings',510),
  ('55555555-0000-0000-0000-0000000000a1','B. Ground level & under vehicle','57','Transmission',520),
  ('55555555-0000-0000-0000-0000000000a1','B. Ground level & under vehicle','58','Additional braking devices',530),
  ('55555555-0000-0000-0000-0000000000a1','B. Ground level & under vehicle','59','Brake systems and components',540),
  ('55555555-0000-0000-0000-0000000000a1','B. Ground level & under vehicle','62','Rear markings and reflectors',550),
  ('55555555-0000-0000-0000-0000000000a1','B. Ground level & under vehicle','63','Lamps',560),
  ('55555555-0000-0000-0000-0000000000a1','B. Ground level & under vehicle','66','Direction indicators and hazard warning lamps',570),
  ('55555555-0000-0000-0000-0000000000a1','B. Ground level & under vehicle','67','Aim of headlamps',580),
  ('55555555-0000-0000-0000-0000000000a1','B. Ground level & under vehicle','S','Gearbox and bell housing',590),
  ('55555555-0000-0000-0000-0000000000a1','B. Ground level & under vehicle','T','Final drive',600),
  ('55555555-0000-0000-0000-0000000000a1','B. Ground level & under vehicle','H','Cooling system',610),
  ('55555555-0000-0000-0000-0000000000a1','B. Ground level & under vehicle','I','Generator',620),
  ('55555555-0000-0000-0000-0000000000a1','B. Ground level & under vehicle','J','Auxiliary drive belts',630),
  ('55555555-0000-0000-0000-0000000000a1','B. Ground level & under vehicle','Y','Hydraulic equipment',640),
  ('55555555-0000-0000-0000-0000000000a1','B. Ground level & under vehicle','G','Ancillary equipment',650);
