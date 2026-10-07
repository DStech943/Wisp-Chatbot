create extension if not exists pgcrypto;

create schema if not exists fp3;

create table if not exists fp3.brands (
  brand_id uuid primary key default gen_random_uuid(),
  site_id text not null unique,
  brand_name text not null,
  website_url text,
  backend_url text not null,
  allowed_origins text[] not null default '{}',
  platform text not null default 'web',
  status text not null default 'pending',
  added_date date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint brands_status_check check (status in ('pending', 'active', 'paused')),
  constraint brands_platform_check check (platform in ('web', 'shopify'))
);

create index if not exists brands_status_idx on fp3.brands (status);
create index if not exists brands_allowed_origins_idx on fp3.brands using gin (allowed_origins);

create or replace function fp3.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists brands_set_updated_at on fp3.brands;

create trigger brands_set_updated_at
before update on fp3.brands
for each row
execute function fp3.set_updated_at();

alter table fp3.brands enable row level security;

revoke all on table fp3.brands from anon;
revoke all on table fp3.brands from authenticated;
