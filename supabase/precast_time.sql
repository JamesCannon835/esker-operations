-- =====================================================================
-- Precast orders: a free-text "when" alongside the date, so the office
-- can put "first round", "8am", "second load" etc.
--
-- Run once in the Supabase SQL editor. Safe to re-run.
-- =====================================================================

alter table public.precast_orders add column if not exists required_time text;
