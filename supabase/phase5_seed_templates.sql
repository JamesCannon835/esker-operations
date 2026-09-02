-- =====================================================================
-- PHASE 5 — 13-week and pre-test inspection templates
-- Run once in the Supabase SQL editor (safe to re-run).
-- Edit them afterwards in the app under Checklists.
-- =====================================================================

insert into public.inspection_templates (id, name, asset_type, category)
values
  ('33333333-0000-0000-0000-0000000000a1', 'Vehicle 13-Week Inspection', 'vehicle', 'Roadworthiness'),
  ('33333333-0000-0000-0000-0000000000a2', 'Vehicle Pre-Test (CVRT) Inspection', 'vehicle', 'Pre-test'),
  ('33333333-0000-0000-0000-0000000000b1', 'Plant 13-Week Inspection', 'plant', 'Thorough examination')
on conflict (id) do nothing;

-- Vehicle 13-week items
insert into public.inspection_template_items (template_id, item_name, sort_order)
select '33333333-0000-0000-0000-0000000000a1', item, ord
from (values
  ('Brakes — service, parking, ABS warning', 10),
  ('Brake lines, hoses and pipes', 20),
  ('Steering and suspension', 30),
  ('Tyres — tread depth, damage, matched sizes', 40),
  ('Wheels, hubs and wheel bearings', 50),
  ('Lighting and indicators', 60),
  ('Exhaust and emissions (visible smoke)', 70),
  ('Fuel system and lines', 80),
  ('Chassis and body condition — corrosion, cracks', 90),
  ('Cab security and doors', 100),
  ('Mirrors, glass and wipers', 110),
  ('Seatbelts and seats', 120),
  ('Coupling / towing equipment', 130),
  ('Spray suppression and guards', 140),
  ('Speed limiter and tachograph', 150),
  ('Fluid levels and leaks', 160)
) as v(item, ord)
where not exists (
  select 1 from public.inspection_template_items
  where template_id = '33333333-0000-0000-0000-0000000000a1'
);

-- Vehicle pre-test items (CVRT-style, quick pre-check)
insert into public.inspection_template_items (template_id, item_name, sort_order)
select '33333333-0000-0000-0000-0000000000a2', item, ord
from (values
  ('All lights working and correctly aimed', 10),
  ('Number plates clean, secure, correct font', 20),
  ('Tyres legal tread and pressures, no damage', 30),
  ('Wheel nuts torqued, indicators fitted', 40),
  ('No fluid leaks (oil, coolant, air, fuel)', 50),
  ('Brake test — even, no pull, parking holds', 60),
  ('Steering free play within limits', 70),
  ('Wipers and washers effective', 80),
  ('Horn works', 90),
  ('Seatbelts function and retract', 100),
  ('Doors, mirrors and glass sound', 110),
  ('Body panels secure, no sharp edges', 120),
  ('Exhaust secure, no excessive smoke', 130),
  ('Load area / tipping gear secure', 140),
  ('First aid kit, fire extinguisher, warning triangle', 150)
) as v(item, ord)
where not exists (
  select 1 from public.inspection_template_items
  where template_id = '33333333-0000-0000-0000-0000000000a2'
);

-- Plant 13-week items
insert into public.inspection_template_items (template_id, item_name, sort_order)
select '33333333-0000-0000-0000-0000000000b1', item, ord
from (values
  ('Structure and welds — cracks, deformation', 10),
  ('Hydraulic system — hoses, rams, leaks, pressure', 20),
  ('Lifting points, hooks, chains, shackles', 30),
  ('Bucket / attachment pins and retainers', 40),
  ('Tyres or tracks and running gear', 50),
  ('Brakes — service and parking', 60),
  ('Steering and articulation joints', 70),
  ('Engine — oil, coolant, belts, mounts', 80),
  ('Electrical — lights, beacon, alarms, isolator', 90),
  ('Operator protection — ROPS/FOPS, seatbelt', 100),
  ('Guards and covers in place', 110),
  ('Fire extinguisher in date', 120),
  ('Greasing and lubrication points', 130),
  ('Decals, capacity plate and instructions legible', 140)
) as v(item, ord)
where not exists (
  select 1 from public.inspection_template_items
  where template_id = '33333333-0000-0000-0000-0000000000b1'
);
