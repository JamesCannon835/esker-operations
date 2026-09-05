-- =====================================================================
-- Let admin / management delete a checklist template even after it has
-- been used: old inspections keep their recorded results and just lose
-- the pointer back to the (now deleted) template.
--
-- Run once in the Supabase SQL editor. Safe to re-run.
-- =====================================================================

do $$
declare c text;
begin
  select conname into c
  from pg_constraint
  where conrelid = 'public.inspections'::regclass
    and confrelid = 'public.inspection_templates'::regclass;
  if c is not null then
    execute format('alter table public.inspections drop constraint %I', c);
  end if;
end $$;

alter table public.inspections
  add constraint inspections_template_id_fkey
  foreign key (template_id)
  references public.inspection_templates(id)
  on delete set null;
