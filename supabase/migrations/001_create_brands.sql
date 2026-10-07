create extension if not exists pgcrypto;

create table if not exists public.brands (
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

create index if not exists brands_status_idx on public.brands (status);
create index if not exists brands_allowed_origins_idx on public.brands using gin (allowed_origins);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists brands_set_updated_at on public.brands;

create trigger brands_set_updated_at
before update on public.brands
for each row
execute function public.set_updated_at();

alter table public.brands enable row level security;

revoke all on table public.brands from anon;
revoke all on table public.brands from authenticated;