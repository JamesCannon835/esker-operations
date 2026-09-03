-- =====================================================================
-- Let mechanics add and edit vehicles, plant and trailers (not just
-- managers). Run once in the Supabase SQL editor.
-- =====================================================================

create policy "mechanics manage vehicles" on public.vehicles
  for insert with check (public.has_role('mechanic') or public.is_manager());
create policy "mechanics update vehicles" on public.vehicles
  for update using (public.has_role('mechanic') or public.is_manager());

create policy "mechanics manage plant" on public.plant
  for insert with check (public.has_role('mechanic') or public.is_manager());
create policy "mechanics update plant" on public.plant
  for update using (public.has_role('mechanic') or public.is_manager());

create policy "mechanics manage trailers" on public.trailers
  for insert with check (public.has_role('mechanic') or public.is_manager());
create policy "mechanics update trailers" on public.trailers
  for update using (public.has_role('mechanic') or public.is_manager());
