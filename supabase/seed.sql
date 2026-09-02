-- =====================================================================
-- ESKER OPERATIONS — V1 TEST SEED
-- Run in Supabase: Project -> SQL Editor -> New query -> paste -> Run.
-- The SQL editor runs as a superuser, so it bypasses Row Level Security
-- (which is why profile + role rows must be created here, not from the app).
--
-- BEFORE running this: create 5 users in
--   Supabase -> Authentication -> Users -> "Add user" -> Create new user
--   (tick "Auto Confirm User"), using these exact emails:
--
--     driver@esker.test        (any password, e.g. Test1234!)
--     operator@esker.test
--     mechanic@esker.test
--     manager@esker.test
--     admin@esker.test
--
-- Then run this whole file. Re-running it is safe (idempotent).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. PROFILES  (public.users  <-  auth.users)
-- ---------------------------------------------------------------------
insert into public.users (id, full_name, phone)
select
  au.id,
  initcap(split_part(au.email, '@', 1)) || ' (test)',
  null
from auth.users au
where au.email in (
  'driver@esker.test',
  'operator@esker.test',
  'mechanic@esker.test',
  'manager@esker.test',
  'admin@esker.test'
)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- 2. ROLE ASSIGNMENTS  (one role per test user)
-- ---------------------------------------------------------------------
insert into public.user_roles (user_id, role)
select au.id, v.role::app_role
from auth.users au
join (values
  ('driver@esker.test',   'driver'),
  ('operator@esker.test', 'plant_operator'),
  ('mechanic@esker.test', 'mechanic'),
  ('manager@esker.test',  'transport_manager'),
  ('admin@esker.test',    'admin')
) as v(email, role) on v.email = au.email
on conflict (user_id, role) do nothing;

-- ---------------------------------------------------------------------
-- 3. SAMPLE FLEET DATA
--    Fixed UUIDs so seed_teardown.sql can remove exactly these rows.
-- ---------------------------------------------------------------------

-- Vehicles
insert into public.vehicles (id, fleet_number, registration, make, model, vehicle_type, status, assigned_driver_id)
values
  ('11111111-0000-0000-0000-0000000000a1', 'T01', '20-D-1001', 'Volvo', 'FMX', 'Tipper',
     'in_use', (select id from auth.users where email = 'driver@esker.test')),
  ('11111111-0000-0000-0000-0000000000a2', 'T02', '20-D-1002', 'Scania', 'P360', 'Mixer',
     'available', null)
on conflict (id) do nothing;

-- Plant
insert into public.plant (id, asset_number, plant_type, make, model, status, assigned_operator_id)
values
  ('11111111-0000-0000-0000-0000000000b1', 'P01', 'Wheel Loader', 'CAT', '966M',
     'in_use', (select id from auth.users where email = 'operator@esker.test'))
on conflict (id) do nothing;

-- Trailer
insert into public.trailers (id, registration, trailer_type, make, model, assigned_vehicle_id)
values
  ('11111111-0000-0000-0000-0000000000c1', '20-D-9001', 'Flatbed', 'Dennison', 'Tri-Axle',
     '11111111-0000-0000-0000-0000000000a2')
on conflict (id) do nothing;

-- Compliance items for vehicle T01: one overdue (red), one soon (amber), one fine (green)
insert into public.compliance_items (id, asset_type, asset_id, compliance_type, due_date, last_completed_date)
values
  ('11111111-0000-0000-0000-0000000000d1', 'vehicle', '11111111-0000-0000-0000-0000000000a1',
     'cvrt_test', current_date - 3,  current_date - 368),
  ('11111111-0000-0000-0000-0000000000d2', 'vehicle', '11111111-0000-0000-0000-0000000000a1',
     'tax',       current_date + 7,  current_date - 358),
  ('11111111-0000-0000-0000-0000000000d3', 'vehicle', '11111111-0000-0000-0000-0000000000a1',
     'insurance', current_date + 90, current_date - 275)
on conflict (id) do nothing;

-- Faults: one assigned to the mechanic, one unassigned in the queue
insert into public.faults (id, asset_type, asset_id, reported_by, description, severity, status, assigned_mechanic_id)
values
  ('11111111-0000-0000-0000-0000000000e1', 'vehicle', '11111111-0000-0000-0000-0000000000a1',
     (select id from auth.users where email = 'driver@esker.test'),
     'Brake warning light intermittent', 'urgent', 'in_progress',
     (select id from auth.users where email = 'mechanic@esker.test')),
  ('11111111-0000-0000-0000-0000000000e2', 'plant', '11111111-0000-0000-0000-0000000000b1',
     (select id from auth.users where email = 'operator@esker.test'),
     'Hydraulic leak on loader arm', 'normal', 'reported', null)
on conflict (id) do nothing;

-- Labour entry by the mechanic on fault e1
insert into public.labour_entries (id, fault_id, mechanic_id, start_time, stop_time, entry_type)
values
  ('11111111-0000-0000-0000-0000000000f1', '11111111-0000-0000-0000-0000000000e1',
     (select id from auth.users where email = 'mechanic@esker.test'),
     now() - interval '2 hours', now() - interval '1 hour', 'diagnosis')
on conflict (id) do nothing;

-- Part used on fault e1
insert into public.parts_used (id, fault_id, part_name, part_number, quantity, unit_cost, supplier)
values
  ('11111111-0000-0000-0000-0000000000f2', '11111111-0000-0000-0000-0000000000e1',
     'Brake light switch', 'BLS-4471', 1, 24.50, 'TruckParts IE')
on conflict (id) do nothing;

-- A service record
insert into public.services (id, asset_type, asset_id, service_date, mileage_or_hours, performed_by, notes, cost)
values
  ('11111111-0000-0000-0000-0000000000f3', 'vehicle', '11111111-0000-0000-0000-0000000000a1',
     current_date - 30, 145000, (select id from auth.users where email = 'mechanic@esker.test'),
     'Scheduled A-service', 380.00)
on conflict (id) do nothing;

-- An audit log row (visible to managers only)
insert into public.audit_log (id, table_name, record_id, action, changed_by, new_value)
values
  ('11111111-0000-0000-0000-0000000000f4', 'vehicles', '11111111-0000-0000-0000-0000000000a1',
     'update', (select id from auth.users where email = 'manager@esker.test'),
     '{"status": "in_use"}'::jsonb)
on conflict (id) do nothing;

-- =====================================================================
-- Expected "Data access check" counts after seeding:
--
--   table             driver  operator  mechanic  manager/admin
--   vehicles             2        2         2           2
--   plant                1        1         1           1
--   compliance_items     3        3         3           3
--   faults               2        2         2           2
--   labour_entries       0        0         1           1
--   parts_used           0        0         1           1
--   audit_log            0        0         0           1
--   users                1        1         1           5
--   user_roles           1        1         1           5
-- =====================================================================
