-- =====================================================================
-- PHASE 3 TEST DATA CLEANUP
-- Removes the sample inspection + faults created while testing the daily
-- check flow. Safe to run; leaves the checklist templates in place.
-- Run in the Supabase SQL editor.
-- =====================================================================

-- Faults raised by test daily checks (they reference the inspection)
delete from public.faults
where source_inspection_id in (
  select i.id from public.inspections i
  join public.users u on u.id = i.completed_by
  where u.full_name like '%(test)%'
);

-- Standalone test faults reported by test users
delete from public.faults
where reported_by in (select id from public.users where full_name like '%(test)%')
  and source_inspection_id is null
  and description not in (
    'Brake warning light intermittent',
    'Hydraulic leak on loader arm'
  );

-- The test inspections themselves (item results cascade)
delete from public.inspections
where completed_by in (select id from public.users where full_name like '%(test)%');
