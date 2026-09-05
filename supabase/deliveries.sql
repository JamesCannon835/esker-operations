-- =====================================================================
-- DELIVERIES IN (goods received at the yard)
--   • suppliers          — cement / sand / stone suppliers, our accounts
--   • supplier_products  — what each supplier sells us, with a price
--   • delivery_tickets   — one row per load in, tonnage + product + price
--
-- Office staff (managers / admin) key these in as trucks arrive.
--
-- Run once in the Supabase SQL editor. Safe to re-run.
-- =====================================================================

create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  account_ref text,
  contact text,
  phone text,
  email text,
  notes text,
  active boolean not null default true,
  created_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.supplier_products (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  name text not null,
  unit text not null default 'tonne',
  unit_price numeric,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists supplier_products_supplier_idx
  on public.supplier_products (supplier_id);

create table if not exists public.delivery_tickets (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.suppliers(id) on delete restrict,
  product_id uuid references public.supplier_products(id) on delete set null,
  product_name text not null,          -- snapshot
  unit text not null default 'tonne',
  quantity numeric not null,
  unit_price numeric,                  -- snapshot at delivery
  docket_number text,
  delivered_on date not null default current_date,
  vehicle_reg text,
  notes text,
  created_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists delivery_tickets_supplier_idx
  on public.delivery_tickets (supplier_id);
create index if not exists delivery_tickets_date_idx
  on public.delivery_tickets (delivered_on);

alter table public.suppliers enable row level security;
alter table public.supplier_products enable row level security;
alter table public.delivery_tickets enable row level security;

do $$
declare t text;
begin
  foreach t in array array['suppliers', 'supplier_products', 'delivery_tickets'] loop
    execute format('drop policy if exists "managers manage %1$s" on public.%1$s', t);
    execute format(
      'create policy "managers manage %1$s" on public.%1$s
         for all using (public.is_manager()) with check (public.is_manager())',
      t
    );
  end loop;
end $$;
