-- Minimal schema for demo auth

create extension if not exists pgcrypto;

create table if not exists app_user (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  created_at timestamptz not null default now()
);

