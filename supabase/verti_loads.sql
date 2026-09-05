-- =====================================================================
-- VERTI-BLOCK LOAD BUILDER
-- Each block type gets a weight; a "load" is an order you're loading onto
-- a truck. Add product lines with quantities and the load shows the total
-- weight so you can see exactly how much to put on.
--
-- Run once in the Supabase SQL editor. Safe to re-run.
-- =====================================================================

alter table public.verti_block_types
  add column if not exists weight_kg numeric;   -- weight of one block, kg

create table if not exists public.verti_loads (
  id uuid primary key default gen_random_uuid(),
  reference text,
  customer text,
  load_date date not null default current_date,
  truck_reg text,
  max_payload_kg numeric,
  status text not null default 'building',      -- building | loaded | dispatched
  notes text,
  created_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists verti_loads_date_idx on public.verti_loads (load_date);

create table if not exists public.verti_load_lines (
  id uuid primary key default gen_random_uuid(),
  load_id uuid not null references public.verti_loads(id) on delete cascade,
  block_type_id uuid not null references public.verti_block_types(id),
  quantity integer not null default 0,
  weight_kg numeric,                            -- snapshot: weight of one block
  unique (load_id, block_type_id)
);
create index if not exists verti_load_lines_load_idx
  on public.verti_load_lines (load_id);

alter table public.verti_loads enable row level security;
alter table public.verti_load_lines enable row level security;

do $$
declare t text;
begin
  foreach t in array array['verti_loads', 'verti_load_lines'] loop
    execute format('drop policy if exists "yard staff manage %1$s" on public.%1$s', t);
    execute format(
      'create policy "yard staff manage %1$s" on public.%1$s
         for all
         using (public.has_role(''plant_operator'') or public.is_manager())
         with check (public.has_role(''plant_operator'') or public.is_manager())',
      t
    );
  end loop;
end $$;
