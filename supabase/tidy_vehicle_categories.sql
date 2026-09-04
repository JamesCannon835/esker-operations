-- =====================================================================
-- Fold stray vehicle category values into the fixed list.
-- Run in the Supabase SQL editor. Safe to re-run.
-- Fixed categories: Mixers, Pump Truck, Block Trucks, Artics, Tippers, Cars & Vans
-- =====================================================================

update public.vehicles set vehicle_type = 'Mixers'
  where lower(trim(vehicle_type)) in ('mixer', 'mixers');

update public.vehicles set vehicle_type = 'Tippers'
  where lower(trim(vehicle_type)) in ('tipper', 'tippers');

update public.vehicles set vehicle_type = 'Block Trucks'
  where lower(trim(vehicle_type)) in ('block truck', 'block trucks', 'blocktruck');

update public.vehicles set vehicle_type = 'Pump Truck'
  where lower(trim(vehicle_type)) in ('pump truck', 'pump trucks', 'pumptruck', 'pump');

update public.vehicles set vehicle_type = 'Artics'
  where lower(trim(vehicle_type)) in ('artic', 'artics', 'articulated');

update public.vehicles set vehicle_type = 'Cars & Vans'
  where lower(trim(vehicle_type)) in ('car', 'cars', 'van', 'vans', 'car & van', 'cars and vans');

-- See what's left that isn't a recognised category:
-- select distinct vehicle_type from public.vehicles
-- where vehicle_type is not null
--   and vehicle_type not in ('Mixers','Pump Truck','Block Trucks','Artics','Tippers','Cars & Vans');
