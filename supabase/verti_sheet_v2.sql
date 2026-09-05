-- =====================================================================
-- Verti-Block production sheet — additions
--   • broken            — jsonb count of broken blocks per block type
--                         (was a single free-text line)
--   • waste_concrete_m3  — waste concrete used that day (internal only:
--                          NOT shown on the audit PDF export)
--
-- Run once in the Supabase SQL editor. Safe to re-run.
-- =====================================================================

alter table public.verti_production_days
  add column if not exists broken jsonb not null default '{}'::jsonb;

alter table public.verti_production_days
  add column if not exists waste_concrete_m3 numeric;
