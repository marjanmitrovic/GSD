-- Global Sales Dashboard v4 - Neon PostgreSQL schema

create extension if not exists "pgcrypto";

create table if not exists companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  currency text not null default 'USD',
  default_region text,
  report_note text,
  company_address text,
  company_tax_id text,
  company_registration_id text,
  company_bank_account text,
  created_at timestamptz not null default now()
);

create table if not exists users_app (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete cascade,
  email text unique not null,
  password_hash text not null,
  full_name text,
  role text not null default 'user' check (role in ('admin', 'manager', 'user')),
  created_at timestamptz not null default now()
);

create table if not exists sales_records (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete cascade,
  user_id uuid references users_app(id) on delete set null,
  sale_date date not null,
  client text not null,
  region text not null,
  salesperson text not null,
  product text not null,
  category text not null,
  quantity numeric not null default 1,
  cost numeric not null default 0,
  price numeric not null default 0,
  cost_vat_rate numeric not null default 0,
  sale_vat_rate numeric not null default 0,
  tax_country text not null default 'custom',
  tax_category text not null default 'standard',
  created_at timestamptz not null default now()
);

create index if not exists sales_records_company_date_idx on sales_records(company_id, sale_date);
create index if not exists users_app_email_idx on users_app(email);


-- v5 migration for existing v4 installations
alter table companies add column if not exists currency text not null default 'USD';
alter table companies add column if not exists default_region text;
alter table companies add column if not exists report_note text;


-- v9 tax migration for existing installations
alter table sales_records add column if not exists cost_vat_rate numeric not null default 0;
alter table sales_records add column if not exists sale_vat_rate numeric not null default 0;

alter table sales_records add column if not exists tax_country text not null default 'custom';
alter table sales_records add column if not exists tax_category text not null default 'standard';


-- v11 invoice/company fields migration
alter table companies add column if not exists company_address text;
alter table companies add column if not exists company_tax_id text;
alter table companies add column if not exists company_registration_id text;
alter table companies add column if not exists company_bank_account text;


-- v13 customers and products
create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  address text,
  tax_id text,
  region text,
  created_at timestamptz not null default now()
);

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  name text not null,
  category text,
  default_cost numeric not null default 0,
  default_price numeric not null default 0,
  tax_country text not null default 'custom',
  tax_category text not null default 'standard',
  cost_vat_rate numeric not null default 0,
  sale_vat_rate numeric not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_customers_company on customers(company_id);
create index if not exists idx_products_company on products(company_id);


-- v14 invoice numbering
create table if not exists invoices (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  sale_record_id uuid not null references sales_records(id) on delete cascade,
  invoice_number text not null,
  issue_date date not null default current_date,
  due_date date,
  status text not null default 'issued',
  created_at timestamptz not null default now(),
  unique(company_id, sale_record_id),
  unique(company_id, invoice_number)
);

create index if not exists idx_invoices_company on invoices(company_id);


-- v15 invoice payment status
alter table invoices add column if not exists paid_at date;
alter table invoices add column if not exists note text;


-- v16 payments ledger
create table if not exists invoice_payments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  invoice_id uuid not null references invoices(id) on delete cascade,
  amount numeric not null default 0,
  payment_date date not null default current_date,
  method text,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists idx_invoice_payments_company on invoice_payments(company_id);
create index if not exists idx_invoice_payments_invoice on invoice_payments(invoice_id);


-- v17 expenses / cashflow
create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  expense_date date not null default current_date,
  supplier text,
  category text,
  description text,
  net_amount numeric not null default 0,
  vat_rate numeric not null default 0,
  gross_amount numeric generated always as (net_amount * (1 + vat_rate / 100)) stored,
  created_at timestamptz not null default now()
);

create index if not exists idx_expenses_company on expenses(company_id);
create index if not exists idx_expenses_date on expenses(expense_date);
