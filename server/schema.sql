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

