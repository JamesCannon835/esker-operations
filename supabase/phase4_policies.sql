-- =====================================================================
-- PHASE 4 — RLS additions for the mechanic workflow
-- Run once in the Supabase SQL editor.
--
-- The starter schema lets mechanics INSERT labour entries and parts but
-- not change them. The job timer needs a mechanic to stop their own
-- running entry, and a mis-entered part / labour line needs removing.
-- Manager-level correction policies from the base schema stay in place.
-- =====================================================================

-- A mechanic may stop their own still-running timer (stop_time still null).
-- Once stopped, only a manager can adjust it (base "managers correct labour").
create policy "mechanics stop own running labour" on public.labour_entries
  for update
  using (
    mechanic_id = auth.uid()
    and public.has_role('mechanic')
    and stop_time is null
  )
  with check (mechanic_id = auth.uid());

-- A mechanic may delete their own labour line; managers may delete any.
create policy "delete labour lines" on public.labour_entries
  for delete using (
    public.is_manager()
    or (mechanic_id = auth.uid() and public.has_role('mechanic'))
  );

-- Mechanics / managers may correct or remove a parts line.
create policy "mechanics and managers update parts" on public.parts_used
  for update using (public.has_role('mechanic') or public.is_manager());

create policy "mechanics and managers delete parts" on public.parts_used
  for delete using (public.has_role('mechanic') or public.is_manager());
