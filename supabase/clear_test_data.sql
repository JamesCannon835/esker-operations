-- =====================================================================
-- CLEAR TEST DATA — pre-launch reset
--
-- Removes:
--   • the built-in sample fleet (T01/T02/T03, P01/P02, trailer 20-D-9001)
--     and their compliance dates
--   • ALL activity records: inspections, faults, services, documents,
--     labour entries, parts, breakdowns, audit log
--
-- Keeps:
--   • every vehicle / plant / trailer you imported or added yourself
--   • their compliance due dates
--   • all people, roles and logins
--   • checklist templates, training courses AND training records
--
-- Run once in the Supabase SQL editor. Not reversible — check the counts
-- below first if you're unsure.
-- =====================================================================

-- Sanity check — run this SELECT on its own first if you want to see what
-- survives (should be your real regs, not 20-D-1001/1002/1003):
--   select registration, fleet_number, vehicle_type from public.vehicles order by registration;

begin;

-- 1. Activity records (order respects foreign keys)
delete from public.parts_used;
delete from public.labour_entries;
delete from public.faults;                 -- must go before inspections
delete from public.inspection_item_results;
delete from public.inspections;
delete from public.services;
delete from public.documents;
delete from public.breakdowns;
delete from public.audit_log;

-- 2. Compliance dates that belong to the sample fleet only
delete from public.compliance_items
where (asset_type = 'vehicle' and asset_id in (
         select id from public.vehicles
         where id in (
                 '11111111-0000-0000-0000-0000000000a1',
                 '11111111-0000-0000-0000-0000000000a2')
            or fleet_number in ('T01','T02','T03')
            or registration in ('20-D-1001','20-D-1002','20-D-1003')))
   or (asset_type = 'plant' and asset_id in (
         select id from public.plant where asset_number in ('P01','P02')))
   or (asset_type = 'trailer' and asset_id in (
         select id from public.trailers where registration = '20-D-9001'));

-- 3. The sample assets themselves
delete from public.trailers
  where registration = '20-D-9001'
     or id = '11111111-0000-0000-0000-0000000000c1';
delete from public.plant
  where asset_number in ('P01','P02')
     or id = '11111111-0000-0000-0000-0000000000b1';
delete from public.vehicles
  where id in (
          '11111111-0000-0000-0000-0000000000a1',
          '11111111-0000-0000-0000-0000000000a2')
     or fleet_number in ('T01','T02','T03')
     or registration in ('20-D-1001','20-D-1002','20-D-1003');

commit;

-- Note: files uploaded during testing still sit in the `documents` storage
-- bucket. They're harmless, but you can clear them in Storage -> documents
-- if you want the space back.
