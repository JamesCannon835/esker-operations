-- =====================================================================
-- Verti-Block: a sale price per block type, so the load builder can
-- total the value of a load as well as its weight.
--
-- Run once in the Supabase SQL editor. Safe to re-run.
-- =====================================================================

alter table public.verti_block_types add column if not exists unit_price numeric;
alter table public.verti_load_lines add column if not exists unit_price numeric;
