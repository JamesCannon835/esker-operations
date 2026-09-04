-- =====================================================================
-- The old Pass/Fail/N/A "Vehicle Inspection" checklist is replaced by the
-- new Vehicle Inspection & Rectification Report (/vehicle-inspections).
-- Remove the old template. Past inspection records are kept — only the
-- item links are dropped.
--
-- Run once in the Supabase SQL editor. Safe to re-run.
-- (The Plant Inspection template is left in place.)
-- =====================================================================

update public.inspection_item_results
set template_item_id = null
where template_item_id in (
  select id from public.inspection_template_items
  where template_id = '33333333-0000-0000-0000-0000000000a1'
);

delete from public.inspection_template_items
  where template_id = '33333333-0000-0000-0000-0000000000a1';

delete from public.inspection_templates
  where id = '33333333-0000-0000-0000-0000000000a1';
