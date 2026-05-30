-- Minimal schema for demo auth

create extension if not exists pgcrypto;

create table if not exists app_user (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  created_at timestamptz not null default now()
);

-- Bảng customer
create table if not exists customer (
  id bigint primary key generated always as identity,
  code varchar(50) not null unique,
  name varchar(500) not null,
  tax_code varchar(50),
  address text,
  contact_person varchar(255),
  phone varchar(50),
  email varchar(255),
  is_active boolean not null default true,
  created_by bigint,
  created_at timestamptz not null default now(),
  updated_by bigint,
  updated_at timestamptz not null default now()
);

-- Indexes cho customer
create index if not exists idx_customer_code on customer(code);
create index if not exists idx_customer_name on customer(name);
create index if not exists idx_customer_tax_code on customer(tax_code);
create index if not exists idx_customer_is_active on customer(is_active);

-- Bảng contract_out - lưu thông tin các hợp đồng đầu ra của công ty
create table if not exists contract_out (
  id bigint primary key generated always as identity,
  contract_no varchar(100),
  contract_date date,
  pakd_no varchar(100),
  uq_no varchar(100),
  customer_id bigint references customer(id),
  tender_name varchar(500),
  project_name varchar(500),
  contract_type varchar(100),
  currency_code varchar(10) default 'VND',
  exchange_rate numeric(18,4) default 1,
  amount_before_vat numeric(18,2),
  amount_after_vat numeric(18,2),
  payment_term text,
  status varchar(50),
  created_by bigint,
  created_at timestamptz not null default now(),
  updated_by bigint,
  updated_at timestamptz not null default now(),
  is_deleted boolean not null default false
);

-- Indexes cho contract_out
create index if not exists idx_contract_out_no on contract_out(contract_no);
create index if not exists idx_contract_out_customer on contract_out(customer_id);
create index if not exists idx_contract_out_status on contract_out(status);
create index if not exists idx_contract_out_is_deleted on contract_out(is_deleted);

-- Bảng contract_out_member - lưu danh sách các thành viên tham gia thực hiện hợp đồng
create table if not exists contract_out_member (
  id bigint primary key generated always as identity,
  contract_out_id bigint references contract_out(id) on delete cascade,
  user_id bigint,
  member_role varchar(50),
  is_primary boolean not null default false,
  role_rank integer default 1,
  created_at timestamptz not null default now()
);

-- Indexes cho contract_out_member
create index if not exists idx_contract_out_member_contract on contract_out_member(contract_out_id);
create index if not exists idx_contract_out_member_user on contract_out_member(user_id);
create index if not exists idx_contract_out_member_role on contract_out_member(member_role);
