-- =====================================================================
-- Replace the Vehicle Daily Check with a simple driver walkaround,
-- grouped exterior -> cab -> trailer.
-- Run once in the Supabase SQL editor. Safe to re-run.
-- =====================================================================

-- Keep any daily checks already done, but let go of the old item links
-- so the old items can be removed.
update public.inspection_item_results
set template_item_id = null
where template_item_id in (
  select id from public.inspection_template_items
  where template_id = '22222222-0000-0000-0000-0000000000a1'
);

delete from public.inspection_template_items
where template_id = '22222222-0000-0000-0000-0000000000a1';

insert into public.inspection_templates (id, name, asset_type, category)
values ('22222222-0000-0000-0000-0000000000a1', 'Vehicle Daily Check', 'vehicle', 'Driver walkaround')
on conflict (id) do update set name = excluded.name, category = excluded.category;

insert into public.inspection_template_items (template_id, item_name, sort_order)
values
  -- Outside the truck
  ('22222222-0000-0000-0000-0000000000a1', 'Lights and indicators - all working and clean', 10),
  ('22222222-0000-0000-0000-0000000000a1', 'Tyres and wheels - condition, no damage, wheel nuts tight', 20),
  ('22222222-0000-0000-0000-0000000000a1', 'Mirrors and glass - clean and not cracked', 30),
  ('22222222-0000-0000-0000-0000000000a1', 'Bodywork and mixer drum - no damage, drum turning, chutes secure', 40),
  ('22222222-0000-0000-0000-0000000000a1', 'Leaks - none under the truck (oil, fuel, AdBlue, water)', 50),
  ('22222222-0000-0000-0000-0000000000a1', 'Number plates - clean and secure', 60),
  ('22222222-0000-0000-0000-0000000000a1', 'Reversing alarm and beacon working', 70),
  -- In the cab
  ('22222222-0000-0000-0000-0000000000a1', 'Windscreen, wipers and washers working', 110),
  ('22222222-0000-0000-0000-0000000000a1', 'Warning lights - none stay on after starting', 120),
  ('22222222-0000-0000-0000-0000000000a1', 'Air pressure builds and buzzer clears', 130),
  ('22222222-0000-0000-0000-0000000000a1', 'Service brake and handbrake working', 140),
  ('22222222-0000-0000-0000-0000000000a1', 'Steering - no excess play', 150),
  ('22222222-0000-0000-0000-0000000000a1', 'Horn working', 160),
  ('22222222-0000-0000-0000-0000000000a1', 'Seatbelt - good condition', 170),
  ('22222222-0000-0000-0000-0000000000a1', 'Tachograph working and card in', 180),
  ('22222222-0000-0000-0000-0000000000a1', 'Tax, CVRT and insurance in date', 190),
  -- Trailer (mark N/A if not towing)
  ('22222222-0000-0000-0000-0000000000a1', 'Trailer - coupling locked and safety catch on', 210),
  ('22222222-0000-0000-0000-0000000000a1', 'Trailer - lights and brakes working', 220),
  ('22222222-0000-0000-0000-0000000000a1', 'Trailer - tyres and wheel nuts', 230),
  ('22222222-0000-0000-0000-0000000000a1', 'Load and chute secured', 240);
