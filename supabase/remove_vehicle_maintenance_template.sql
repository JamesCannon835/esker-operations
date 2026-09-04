-- =====================================================================
-- The Vehicle Maintenance Report is now its own module (from a fault →
-- "Create maintenance report"), not an inspection checklist. Remove the
-- old inspection template so the mechanic only sees "Vehicle Inspection"
-- when doing an inspection.
--
-- Run once in the Supabase SQL editor. Safe to re-run.
-- =====================================================================

-- Keep any inspections already done with it — just drop the item links.
update public.inspection_item_results
set template_item_id = null
where template_item_id in (
  select id from public.inspection_template_items
  where template_id = '44444444-0000-0000-0000-0000000000a1'
);

delete from public.inspection_template_items
  where template_id = '44444444-0000-0000-0000-0000000000a1';

delete from public.inspection_templates
  where id = '44444444-0000-0000-0000-0000000000a1';
