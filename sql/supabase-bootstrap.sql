-- Bootstrap schema untuk onboarding toko baru
-- POS Bangunan
-- Jalankan di Supabase SQL Editor pada project toko yang baru.

create extension if not exists pgcrypto;

create table if not exists public.branches (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text null,
  phone text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  barcode text null,
  name text not null,
  category_id uuid null,
  base_unit text not null,
  base_price numeric(14,2) not null default 0,
  sell_price numeric(14,2) not null default 0,
  current_stock numeric(14,3) not null default 0,
  min_stock numeric(14,3) not null default 0,
  branch_id uuid null references public.branches(id) on delete set null,
  image_url text null,
  base64_offline text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.unit_conversions (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  unit_name text not null,
  multiplier numeric(14,3) not null default 1,
  price numeric(14,2) null
);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid null references public.branches(id) on delete set null,
  name text not null,
  phone text null,
  address text null,
  debt_balance numeric(14,2) not null default 0,
  credit_limit numeric(14,2) not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_person text null,
  phone text null,
  email text null,
  address text null,
  notes text null,
  debt_balance numeric(14,2) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid null references public.branches(id) on delete set null,
  user_id uuid null,
  category text not null,
  amount numeric(14,2) not null default 0,
  description text not null default '',
  expense_date timestamptz not null default now(),
  payment_method text not null default 'cash',
  status text not null default 'completed' check (status in ('pending_sync', 'completed')),
  created_at timestamptz not null default now()
);

create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid null references public.branches(id) on delete set null,
  product_id uuid not null references public.products(id) on delete cascade,
  user_id uuid null,
  movement_type text not null check (movement_type in ('IN', 'OUT', 'ADJUSTMENT')),
  qty numeric(14,3) not null default 0,
  notes text not null default '',
  reference_id text not null,
  supplier_id uuid null references public.suppliers(id) on delete set null,
  payment_status text null,
  status text not null default 'completed' check (status in ('pending_sync', 'completed')),
  created_at timestamptz not null default now()
);

create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  receipt_number text not null unique,
  user_id uuid null,
  customer_id uuid null references public.customers(id) on delete set null,
  branch_id uuid null references public.branches(id) on delete set null,
  subtotal numeric(14,2) not null default 0,
  discount numeric(14,2) not null default 0,
  tax numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  paid numeric(14,2) not null default 0,
  change numeric(14,2) not null default 0,
  payment_method text not null default 'cash',
  payment_breakdown jsonb null,
  status text not null default 'completed' check (status in ('pending_sync', 'completed')),
  voided boolean not null default false,
  voided_at timestamptz null,
  voided_by uuid null,
  created_at timestamptz not null default now()
);

create table if not exists public.sale_details (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id) on delete cascade,
  product_id uuid null references public.products(id) on delete set null,
  unit_name text not null,
  unit_multiplier numeric(14,3) not null default 1,
  qty numeric(14,3) not null default 0,
  base_qty numeric(14,3) not null default 0,
  price_per_unit numeric(14,2) not null default 0,
  discount numeric(14,2) not null default 0,
  subtotal numeric(14,2) not null default 0,
  cogs_subtotal numeric(14,2) null
);

create table if not exists public.receivables_payments (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  branch_id uuid null references public.branches(id) on delete set null,
  user_id uuid null,
  amount numeric(14,2) not null default 0,
  payment_method text not null default 'cash' check (payment_method in ('cash', 'transfer', 'qris')),
  notes text null,
  status text not null default 'completed' check (status in ('pending_sync', 'completed')),
  created_at timestamptz not null default now()
);

create table if not exists public.cash_shifts (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid null references public.branches(id) on delete set null,
  user_id uuid null,
  user_role text null,
  user_name text null,
  device_id text null,
  device_name text null,
  opening_time timestamptz not null default now(),
  closing_time timestamptz null,
  opening_cash numeric(14,2) not null default 0,
  expected_closing_cash numeric(14,2) null,
  actual_closing_cash numeric(14,2) null,
  difference numeric(14,2) null,
  status text not null default 'open' check (status in ('open', 'closed', 'pending_sync')),
  notes text null,
  created_at timestamptz not null default now()
);

create table if not exists public.store_settings (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid null references public.branches(id) on delete set null,
  preferences jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists idx_products_barcode on public.products(barcode);
create index if not exists idx_products_branch_id on public.products(branch_id);
create index if not exists idx_unit_conversions_product_id on public.unit_conversions(product_id);
create index if not exists idx_customers_branch_id on public.customers(branch_id);
create index if not exists idx_customers_name on public.customers(name);
create index if not exists idx_suppliers_name on public.suppliers(name);
create index if not exists idx_expenses_branch_id on public.expenses(branch_id);
create index if not exists idx_expenses_status on public.expenses(status);
create index if not exists idx_inventory_movements_product_id on public.inventory_movements(product_id);
create index if not exists idx_inventory_movements_status on public.inventory_movements(status);
create index if not exists idx_sales_receipt_number on public.sales(receipt_number);
create index if not exists idx_sales_created_at on public.sales(created_at);
create index if not exists idx_sales_branch_id on public.sales(branch_id);
create index if not exists idx_sale_details_sale_id on public.sale_details(sale_id);
create index if not exists idx_receivables_payments_customer_id on public.receivables_payments(customer_id);
create index if not exists idx_receivables_payments_status on public.receivables_payments(status);
create index if not exists idx_cash_shifts_status on public.cash_shifts(status);
create index if not exists idx_cash_shifts_opening_time on public.cash_shifts(opening_time);
create index if not exists idx_store_settings_branch_id on public.store_settings(branch_id);

alter table public.branches enable row level security;
alter table public.products enable row level security;
alter table public.unit_conversions enable row level security;
alter table public.customers enable row level security;
alter table public.suppliers enable row level security;
alter table public.expenses enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.sales enable row level security;
alter table public.sale_details enable row level security;
alter table public.receivables_payments enable row level security;
alter table public.cash_shifts enable row level security;
alter table public.store_settings enable row level security;

drop policy if exists "anon_all" on public.branches;
create policy "anon_all" on public.branches for all to anon, authenticated using (true) with check (true);
drop policy if exists "anon_all" on public.products;
create policy "anon_all" on public.products for all to anon, authenticated using (true) with check (true);
drop policy if exists "anon_all" on public.unit_conversions;
create policy "anon_all" on public.unit_conversions for all to anon, authenticated using (true) with check (true);
drop policy if exists "anon_all" on public.customers;
create policy "anon_all" on public.customers for all to anon, authenticated using (true) with check (true);
drop policy if exists "anon_all" on public.suppliers;
create policy "anon_all" on public.suppliers for all to anon, authenticated using (true) with check (true);
drop policy if exists "anon_all" on public.expenses;
create policy "anon_all" on public.expenses for all to anon, authenticated using (true) with check (true);
drop policy if exists "anon_all" on public.inventory_movements;
create policy "anon_all" on public.inventory_movements for all to anon, authenticated using (true) with check (true);
drop policy if exists "anon_all" on public.sales;
create policy "anon_all" on public.sales for all to anon, authenticated using (true) with check (true);
drop policy if exists "anon_all" on public.sale_details;
create policy "anon_all" on public.sale_details for all to anon, authenticated using (true) with check (true);
drop policy if exists "anon_all" on public.receivables_payments;
create policy "anon_all" on public.receivables_payments for all to anon, authenticated using (true) with check (true);
drop policy if exists "anon_all" on public.cash_shifts;
create policy "anon_all" on public.cash_shifts for all to anon, authenticated using (true) with check (true);
drop policy if exists "anon_all" on public.store_settings;
create policy "anon_all" on public.store_settings for all to anon, authenticated using (true) with check (true);

grant select, insert, update, delete on public.branches to anon, authenticated;
grant select, insert, update, delete on public.products to anon, authenticated;
grant select, insert, update, delete on public.unit_conversions to anon, authenticated;
grant select, insert, update, delete on public.customers to anon, authenticated;
grant select, insert, update, delete on public.suppliers to anon, authenticated;
grant select, insert, update, delete on public.expenses to anon, authenticated;
grant select, insert, update, delete on public.inventory_movements to anon, authenticated;
grant select, insert, update, delete on public.sales to anon, authenticated;
grant select, insert, update, delete on public.sale_details to anon, authenticated;
grant select, insert, update, delete on public.receivables_payments to anon, authenticated;
grant select, insert, update, delete on public.cash_shifts to anon, authenticated;
grant select, insert, update, delete on public.store_settings to anon, authenticated;
