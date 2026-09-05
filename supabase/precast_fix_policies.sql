-- =====================================================================
-- Precast — fix "can't add products/orders", and set the real product list.
-- Rebuilds the tables if missing, recreates the access policies without
-- depending on the 'yard_staff' enum value, and loads Esker's products.
--
-- Safe to re-run.
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
  required_time text,
  status text not null default 'new',
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
  product_name text not null,
  length_ft numeric,
  length_text text,
  quantity integer not null default 1,
  notes text,
  sort_order int not null default 0
);
create index if not exists precast_order_lines_order_idx on public.precast_order_lines (order_id);

do $$
declare t text;
begin
  foreach t in array array[
    'precast_products', 'precast_orders', 'precast_order_lines'
  ] loop
    execute format('alter table public.%1$s enable row level security', t);
    execute format('drop policy if exists "yard staff manage %1$s" on public.%1$s', t);
    execute format(
      'create policy "yard staff manage %1$s" on public.%1$s
         for all
         using (
           public.is_manager()
           or exists (
             select 1 from public.user_roles r
             where r.user_id = auth.uid()
               and r.role::text in (''plant_operator'', ''yard_staff'')
           )
         )
         with check (
           public.is_manager()
           or exists (
             select 1 from public.user_roles r
             where r.user_id = auth.uid()
               and r.role::text in (''plant_operator'', ''yard_staff'')
           )
         )',
      t
    );
  end loop;
end $$;

-- Clear any placeholder products that aren't on an order yet, then load the real list.
delete from public.precast_products p
where not exists (
  select 1 from public.precast_order_lines l where l.product_id = p.id
);

insert into public.precast_products (name, sort_order) values
  ('4" Face Sill', 10),
  ('2" Face Sill', 20),
  ('4" Lentil', 30),
  ('6" Lentil', 40),
  ('Heavy Duty Lentil', 50),
  ('Padstone', 60)
on conflict (name) do nothing;
