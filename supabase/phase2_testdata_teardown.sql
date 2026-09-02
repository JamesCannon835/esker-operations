-- =====================================================================
-- PHASE 2 TEST DATA CLEANUP
-- During Phase 2 testing, two throwaway assets were created through the
-- new screens: vehicle T03 (MAN TGS) and plant P02 (Komatsu Excavator).
-- They are currently VOIDED (hidden from the active lists). Run this in
-- the Supabase SQL editor to remove them permanently, or just leave them
-- voided and ignore them.
-- =====================================================================

delete from public.vehicles where fleet_number = 'T03' and registration = '20-D-1003';
delete from public.plant    where asset_number = 'P02';
