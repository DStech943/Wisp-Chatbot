create table if not exists fp3.brand_settings (
  brand_id uuid primary key references fp3.brands (brand_id) on delete cascade,
  site_id text not null unique references fp3.brands (site_id) on delete cascade,
  nudge_settings jsonb not null default '{}'::jsonb,
  ui_settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists brand_settings_set_updated_at on fp3.brand_settings;

create trigger brand_settings_set_updated_at
before update on fp3.brand_settings
for each row
execute function fp3.set_updated_at();

alter table fp3.brand_settings enable row level security;

revoke all on table fp3.brand_settings from anon;
revoke all on table fp3.brand_settings from authenticated;

create index if not exists brand_settings_site_idx
on fp3.brand_settings (site_id);
