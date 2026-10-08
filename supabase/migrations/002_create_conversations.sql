alter table fp3.brands
add column if not exists backend_secret_name text not null default 'BRAND_BACKEND_SECRET';

create table if not exists fp3.conversations (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid references fp3.brands (brand_id) on delete set null,
  site_id text not null,
  session_id text not null,
  message text not null,
  reply text not null,
  handoff boolean not null default false,
  platform text,
  page_url text,
  origin text,
  created_at timestamptz not null default now()
);

create index if not exists conversations_site_created_idx
on fp3.conversations (site_id, created_at desc);

create index if not exists conversations_session_created_idx
on fp3.conversations (session_id, created_at);

alter table fp3.conversations enable row level security;

revoke all on table fp3.conversations from anon;
revoke all on table fp3.conversations from authenticated;
