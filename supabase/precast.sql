-- =====================================================================
-- PRECAST ORDERS
-- Phone orders for made-to-order precast (sills, lintels, padstones…).
-- Management raise the order in feet; yard staff work it in feet; the
-- customer docket shows metres. Sold per metre.
--
--   precast_products      — the editable product list
--   precast_orders        — one order (customer, status, who it's for)
--   precast_order_lines   — product + length (ft) + quantity
--
-- Run once in the Supabase SQL editor. Safe to re-run.
-- =====================================================================

create table if not exists public.precast_products (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  sort_order int not null default 100,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.precast_orders (
  id uuid primary key default gen_random_uuid(),
  order_number text,
  customer text,
  phone text,
  order_date date not null default current_date,
  required_date date,
  status text not null default 'new',       -- new | in_progress | done | cancelled
  assigned_to uuid references public.users(id),
  notes text,
  taken_by uuid references public.users(id),
  done_by uuid references public.users(id),
  done_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists precast_orders_status_idx on public.precast_orders (status);

create table if not exists public.precast_order_lines (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.precast_orders(id) on delete cascade,
  product_id uuid references public.precast_products(id) on delete set null,
  product_name text not null,               -- snapshot
  length_ft numeric,                        -- length in feet (decimal, e.g. 6.5 = 6ft6)
  length_text text,                         -- as typed, e.g. "6ft6"
  quantity integer not null default 1,
  notes text,
  sort_order int not null default 0
);
create index if not exists precast_order_lines_order_idx on public.precast_order_lines (order_id);

alter table public.precast_products enable row level security;
alter table public.precast_orders enable row level security;
alter table public.precast_order_lines enable row level security;

do $$
declare t text;
begin
  foreach t in array array[
    'precast_products', 'precast_orders', 'precast_order_lines'
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

insert into public.precast_products (name, sort_order) values
  ('Window sill', 10),
  ('Lintel', 20),
  ('Padstone', 30),
  ('Cill', 40),
  ('Coping', 50),
  ('Quoin', 60),
  ('Step', 70)
on conflict (name) do nothing;
