-- =====================================================================
-- PHASE 5 — RLS additions for service records
-- Run once in the Supabase SQL editor.
--
-- The base schema lets mechanics/managers INSERT service records but not
-- fix or remove a mistaken one. This adds UPDATE and DELETE for those
-- same roles.
-- =====================================================================

create policy "mechanics and managers update services" on public.services
  for update using (public.has_role('mechanic') or public.is_manager());

create policy "mechanics and managers delete services" on public.services
  for delete using (public.has_role('mechanic') or public.is_manager());
