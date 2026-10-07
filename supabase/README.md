# Supabase Widget Gateway

This folder contains the Supabase Edge Function that sits between browser widgets and n8n:

```text
widget.js -> Supabase Edge Function -> n8n webhook -> brand backend
```

The function handles browser CORS, validates the request origin against the brand registry table, then forwards the validated payload to n8n server-side.

## 1. Create The Table

Run this SQL in Supabase SQL Editor:

```sql
create extension if not exists pgcrypto;

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
```

The Edge Function uses the service role key, so browser users never read this table directly.

## 2. Add A Brand

Example insert:

```sql
insert into fp3.brands (
  site_id,
  brand_name,
  website_url,
  backend_url,
  allowed_origins,
  platform,
  status
) values (
  'test-brand.com',
  'Test Brand',
  'https://test-brand.com',
  'https://datastraw-support-agent-production-54f5.up.railway.app/api/widget/chat',
  array['https://test-brand.com', 'https://www.test-brand.com'],
  'web',
  'pending'
);
```

Use origins exactly as browsers send them. `https://example.com` and `https://www.example.com` are different origins.

To pause a brand:

```sql
update fp3.brands
set status = 'paused'
where site_id = 'test-brand.com';
```

To mark a brand active:

```sql
update fp3.brands
set status = 'active'
where site_id = 'test-brand.com';
```

## 3. Configure Function Secrets And Vault

Set these Edge Function secrets:

```powershell
supabase secrets set SUPABASE_URL="https://supabasedb.datastraw.in"
supabase secrets set SUPABASE_SERVICE_ROLE_KEY="YOUR_SERVICE_ROLE_KEY"
```

Store these values in Supabase Vault:

```text
N8N_WEBHOOK_URL=https://n8n.srv1327344.hstgr.cloud/webhook/widget-chat
N8N_SHARED_SECRET=YOUR_SHARED_EDGE_TO_N8N_SECRET
```

`N8N_SHARED_SECRET` is sent to n8n as `X-Wisp-Edge-Secret`. In n8n, check the incoming `X-Wisp-Edge-Secret` header before calling any backend.

## 4. Deploy

From the repo root:

```powershell
supabase functions deploy widget-chat --project-ref YOUR_PROJECT_REF
```

For your self-hosted Supabase, deploy using the method your Supabase instance supports. The function URL should be:

```text
https://supabasedb.datastraw.in/functions/v1/widget-chat
```

## 5. Update n8n

The browser no longer calls n8n directly. Supabase calls n8n server-side, so the n8n workflow should trust only requests with the shared Edge secret.

In your existing **Widget Chat** workflow, replace the old **Resolve Site** Code node logic with this shape:

```js
const expectedSecret = process.env.WISP_EDGE_SECRET || "";
const headers = $json.headers || {};
const body = $json.body || {};
const providedSecret = headers["x-wisp-edge-secret"] || headers["X-Wisp-Edge-Secret"] || "";

const ok = !!expectedSecret
  && providedSecret === expectedSecret
  && typeof body.backend_url === "string"
  && body.backend_url.startsWith("https://")
  && typeof body.message === "string"
  && body.message.length > 0
  && body.message.length <= 1000
  && typeof body.session_id === "string"
  && body.session_id.length <= 100;

return {
  json: {
    ok,
    backend: ok ? body.backend_url : null,
    payload: ok
      ? {
          message: body.message,
          session_id: body.session_id,
          platform: body.platform || "web",
          page_url: body.page_url || null,
        }
      : null,
  },
};
```

Then keep the existing IF node and HTTP Request node pattern:

- IF checks `{{ $json.ok }}`.
- HTTP Request URL stays `{{ $json.backend }}`.
- HTTP Request JSON body stays `{{ $json.payload }}`.
- The brand backend secret stays in the HTTP Request credential.

Set the same secret in both places:

- Supabase Vault secret: `N8N_SHARED_SECRET`
- n8n environment variable: `WISP_EDGE_SECRET`

## 6. Update Widget Installs

The widget `data-api` should point to the Edge Function:

```html
<script
  src="https://wisp-widget.pages.dev/widget.js"
  data-site-id="test-brand.com"
  data-platform="web"
  data-api="https://supabasedb.datastraw.in/functions/v1/widget-chat"
  defer
></script>
```

## CORS Note

Browser preflight requests do not include the JSON body, so the function cannot know `site_id` during `OPTIONS`. It echoes the preflight origin so the browser can send the real `POST`, then validates `site_id` and `Origin` before forwarding anything to n8n.

