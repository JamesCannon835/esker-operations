-- =====================================================================
-- PHASE 3 — RLS additions for the checklist builder
-- Run once in the Supabase SQL editor.
--
-- The starter schema only lets managers INSERT checklist templates and
-- items. The builder also needs to rename, reorder and remove them, so
-- this adds UPDATE and DELETE policies (managers only). Inspections
-- themselves stay immutable once submitted — no update/delete added there.
-- =====================================================================

create policy "managers update templates" on public.inspection_templates
  for update using (public.is_manager());

create policy "managers delete templates" on public.inspection_templates
  for delete using (public.is_manager());

create policy "managers update template items" on public.inspection_template_items
  for update using (public.is_manager());

create policy "managers delete template items" on public.inspection_template_items
  for delete using (public.is_manager());
