-- =====================================================================
-- Tidy the inspection checklists so the mechanic sees just two:
--   "Vehicle Inspection"  and  "Vehicle Maintenance Report"
-- (and the plant equivalents). Daily-check templates are untouched —
-- they belong to the driver / operator flow.
-- Run once in the Supabase SQL editor. Safe to re-run.
-- =====================================================================

-- Drop the pre-test template and its items
delete from public.inspection_template_items
  where template_id = '33333333-0000-0000-0000-0000000000a2';
delete from public.inspection_templates
  where id = '33333333-0000-0000-0000-0000000000a2';

-- Rename the 13-week templates to plain "Inspection"
update public.inspection_templates
  set name = 'Vehicle Inspection', category = 'Scheduled inspection'
  where id = '33333333-0000-0000-0000-0000000000a1';
update public.inspection_templates
  set name = 'Plant Inspection', category = 'Scheduled inspection'
  where id = '33333333-0000-0000-0000-0000000000b1';

-- Maintenance report templates
insert into public.inspection_templates (id, name, asset_type, category)
values
  ('44444444-0000-0000-0000-0000000000a1', 'Vehicle Maintenance Report', 'vehicle', 'Workshop'),
  ('44444444-0000-0000-0000-0000000000b1', 'Plant Maintenance Report',   'plant',   'Workshop')
on conflict (id) do nothing;

insert into public.inspection_template_items (template_id, item_name, sort_order)
select '44444444-0000-0000-0000-0000000000a1', item, ord
from (values
  ('Engine oil and filter', 10),
  ('Air filter', 20),
  ('Fuel filter(s)', 30),
  ('Coolant level and condition', 40),
  ('Brake pads / shoes and discs', 50),
  ('Brake fluid', 60),
  ('Tyres — pressure, tread, damage', 70),
  ('Wheel nut torque', 80),
  ('Suspension and steering components', 90),
  ('Lights and electrical', 100),
  ('Wipers and washers', 110),
  ('Battery and charging', 120),
  ('Exhaust and AdBlue system', 130),
  ('Belts and hoses', 140),
  ('Greasing / lubrication', 150),
  ('Body and chassis condition', 160)
) as v(item, ord)
where not exists (
  select 1 from public.inspection_template_items
  where template_id = '44444444-0000-0000-0000-0000000000a1'
);

insert into public.inspection_template_items (template_id, item_name, sort_order)
select '44444444-0000-0000-0000-0000000000b1', item, ord
from (values
  ('Engine oil and filter', 10),
  ('Hydraulic oil and filters', 20),
  ('Coolant level and condition', 30),
  ('Air filter', 40),
  ('Fuel filter(s)', 50),
  ('Grease all points', 60),
  ('Hoses and rams — leaks, chafing', 70),
  ('Tracks / tyres and undercarriage', 80),
  ('Attachment pins and bushes', 90),
  ('Electrical and lights', 100),
  ('Battery', 110),
  ('Brakes and controls', 120),
  ('Structure and welds', 130)
) as v(item, ord)
where not exists (
  select 1 from public.inspection_template_items
  where template_id = '44444444-0000-0000-0000-0000000000b1'
);
