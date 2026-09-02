-- =====================================================================
-- PHASE 3 — default daily-check templates
-- Run once in the Supabase SQL editor (safe to re-run).
-- Creates a "Vehicle Daily Check" and a "Plant Daily Check" with a
-- starter list of items. Edit them afterwards in the app under
-- Checklists — nothing here is fixed.
-- =====================================================================

insert into public.inspection_templates (id, name, asset_type, category)
values
  ('22222222-0000-0000-0000-0000000000a1', 'Vehicle Daily Check', 'vehicle', 'Driver walkaround'),
  ('22222222-0000-0000-0000-0000000000b1', 'Plant Daily Check',   'plant',   'Operator walkaround')
on conflict (id) do nothing;

-- Vehicle items
insert into public.inspection_template_items (template_id, item_name, sort_order)
select '22222222-0000-0000-0000-0000000000a1', item, ord
from (values
  ('Lights, indicators and reflectors', 10),
  ('Tyres, wheels and wheel nuts', 20),
  ('Mirrors and glass', 30),
  ('Windscreen, wipers and washers', 40),
  ('Horn', 50),
  ('Service brake and parking brake', 60),
  ('Steering', 70),
  ('Fluid leaks (oil, coolant, fuel)', 80),
  ('AdBlue level', 90),
  ('Battery security', 100),
  ('Seatbelts', 110),
  ('Load security and bodywork', 120),
  ('Number plates and markings', 130),
  ('First aid kit and fire extinguisher', 140),
  ('Tachograph and documentation', 150)
) as v(item, ord)
where not exists (
  select 1 from public.inspection_template_items
  where template_id = '22222222-0000-0000-0000-0000000000a1'
);

-- Plant items
insert into public.inspection_template_items (template_id, item_name, sort_order)
select '22222222-0000-0000-0000-0000000000b1', item, ord
from (values
  ('Structure, guards and steps', 10),
  ('Tyres or tracks', 20),
  ('Hydraulic hoses and rams (leaks)', 30),
  ('Engine oil and coolant level', 40),
  ('Fuel and AdBlue level', 50),
  ('Lights and beacon', 60),
  ('Horn and reversing alarm', 70),
  ('Mirrors and camera', 80),
  ('Seatbelt and ROPS/FOPS', 90),
  ('Fire extinguisher', 100),
  ('Bucket / attachment security', 110),
  ('Greasing points', 120),
  ('Controls and brakes', 130),
  ('Battery and isolator', 140)
) as v(item, ord)
where not exists (
  select 1 from public.inspection_template_items
  where template_id = '22222222-0000-0000-0000-0000000000b1'
);
