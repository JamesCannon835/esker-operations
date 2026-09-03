-- =====================================================================
-- Let mechanics add and update compliance dates (not just managers).
-- Run once in the Supabase SQL editor.
-- =====================================================================

create policy "mechanics add compliance" on public.compliance_items
  for insert with check (public.has_role('mechanic') or public.is_manager());

create policy "mechanics update compliance" on public.compliance_items
  for update using (public.has_role('mechanic') or public.is_manager());
