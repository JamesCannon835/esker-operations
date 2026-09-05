-- =====================================================================
-- VERTI-BLOCK WEEKLY PRODUCTION RECORD
-- Digitises "Verti_Block_Weekly_Production_Record.docx".
--   • verti_block_types        — the block products (editable list)
--   • verti_production_weeks    — one row per week (Mon-commencing)
--   • verti_production_days     — Mon..Fri of a week: concrete m³, counts
--                                (jsonb keyed by block type id), broken,
--                                and the three inspection ticks
--
-- Yard staff (plant operators) and management can fill these in.
--
-- Run once in the Supabase SQL editor. Safe to re-run.
-- =====================================================================

create table if not exists public.verti_block_types (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  sort_order int not null default 100,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.verti_production_weeks (
  id uuid primary key default gen_random_uuid(),
  week_commencing date not null unique,       -- the Monday
  operator_name text,
  notes text,
  created_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.verti_production_days (
  id uuid primary key default gen_random_uuid(),
  week_id uuid not null
    references public.verti_production_weeks(id) on delete cascade,
  weekday int not null check (weekday between 1 and 5),   -- 1=Mon .. 5=Fri
  day_date date not null,
  concrete_ordered_m3 numeric,
  counts jsonb not null default '{}'::jsonb,              -- { "<type id>": qty }
  blocks_broken text,
  block_visual_ok boolean,
  mould_visual_ok boolean,
  weight_ok boolean,
  updated_at timestamptz not null default now(),
  unique (week_id, weekday)
);

alter table public.verti_block_types enable row level security;
alter table public.verti_production_weeks enable row level security;
alter table public.verti_production_days enable row level security;

do $$
declare t text;
begin
  foreach t in array array[
    'verti_block_types', 'verti_production_weeks', 'verti_production_days'
  ] loop
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

-- The 14 block types from the paper sheet, in its order.
insert into public.verti_block_types (name, sort_order) values
  ('Standard', 10),
  ('Top Block', 20),
  ('Mass Extender 1200', 30),
  ('Mass Extender 1500', 40),
  ('Half Standard', 50),
  ('Double Sided Block', 60),
  ('Half Top', 70),
  ('Corner Block', 80),
  ('Corner Top', 90),
  ('Half Step', 100),
  ('Half Step Top', 110),
  ('Half Step Corner', 120),
  ('Half Step Corner Top', 130),
  ('Cap', 140)
on conflict (name) do nothing;
