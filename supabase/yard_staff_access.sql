-- =====================================================================
-- Give yard_staff the same Verti-Block access as plant operators.
-- Run AFTER yard_staff_role.sql. Safe to re-run.
-- =====================================================================

do $$
declare t text;
begin
  foreach t in array array[
    'verti_block_types', 'verti_production_weeks', 'verti_production_days',
    'verti_loads', 'verti_load_lines'
  ] loop
    execute format('drop policy if exists "yard staff manage %1$s" on public.%1$s', t);
    execute format(
      'create policy "yard staff manage %1$s" on public.%1$s
         for all
         using (
           public.has_role(''plant_operator'')
           or public.has_role(''yard_staff'')
           or public.is_manager()
         )
         with check (
           public.has_role(''plant_operator'')
           or public.has_role(''yard_staff'')
           or public.is_manager()
         )',
      t
    );
  end loop;
end $$;
