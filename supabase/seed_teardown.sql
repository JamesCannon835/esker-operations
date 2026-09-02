-- =====================================================================
-- ESKER OPERATIONS — V1 TEST SEED TEARDOWN
-- Removes everything supabase/seed.sql created. Run in the SQL editor.
-- Does NOT delete the 5 auth users — remove those in
-- Authentication -> Users if you want them gone too.
-- =====================================================================

delete from public.audit_log     where id = '11111111-0000-0000-0000-0000000000f4';
delete from public.services      where id = '11111111-0000-0000-0000-0000000000f3';
delete from public.parts_used    where id = '11111111-0000-0000-0000-0000000000f2';
delete from public.labour_entries where id = '11111111-0000-0000-0000-0000000000f1';
delete from public.faults        where id in (
  '11111111-0000-0000-0000-0000000000e1',
  '11111111-0000-0000-0000-0000000000e2'
);
delete from public.compliance_items where id in (
  '11111111-0000-0000-0000-0000000000d1',
  '11111111-0000-0000-0000-0000000000d2',
  '11111111-0000-0000-0000-0000000000d3'
);
delete from public.trailers      where id = '11111111-0000-0000-0000-0000000000c1';
delete from public.plant         where id = '11111111-0000-0000-0000-0000000000b1';
delete from public.vehicles      where id in (
  '11111111-0000-0000-0000-0000000000a1',
  '11111111-0000-0000-0000-0000000000a2'
);

delete from public.user_roles
where user_id in (
  select id from auth.users where email in (
    'driver@esker.test', 'operator@esker.test', 'mechanic@esker.test',
    'manager@esker.test', 'admin@esker.test'
  )
);

delete from public.users
where id in (
  select id from auth.users where email in (
    'driver@esker.test', 'operator@esker.test', 'mechanic@esker.test',
    'manager@esker.test', 'admin@esker.test'
  )
);
