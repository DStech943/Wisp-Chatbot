# Supabase Widget Gateway

This folder contains the Supabase database migrations and Edge Functions for the widget runtime:

```text
widget.js -> widget-chat Edge Function -> brand backend
dashboard -> get-conversations Edge Function -> fp3.conversations
```

Supabase is the source of truth for brand registration, CORS, backend routing, and conversation history.

## 1. Create The Tables

Run the SQL migrations in order from `supabase/migrations`:

```text
001_create_brands.sql
002_create_conversations.sql
```

The important tables are:

- `fp3.brands`: one row per brand/site, including allowed origins and backend URL.
- `fp3.conversations`: one row per successful chat message/reply.

Both tables have RLS enabled and are revoked from `anon` and `authenticated`. The Edge Functions use the database connection URL directly.

## 2. Brand Secrets

The brand backend secret must live in Supabase Vault or as an Edge Function secret. Do not store it in this repo.

Default secret name:

```text
BRAND_BACKEND_SECRET
```

`widget-chat` reads `backend_secret_name` from `fp3.brands`, loads that secret from Vault, and sends it to the brand backend as:

```text
X-Gateway-Secret: <secret value>
```

For the current backend, create this Vault secret:

```text
BRAND_BACKEND_SECRET=your_backend_gateway_secret
```

For a future brand with a different backend secret, store another Vault secret, then set that brand row's `backend_secret_name` to the new secret name.

## 3. Configure Function Secrets And Vault

Set this Edge Function secret:

```powershell
supabase secrets set SUPABASE_DB_URL="YOUR_SUPABASE_DATABASE_CONNECTION_URL"
```

Store these values in Supabase Vault:

```text
BRAND_BACKEND_SECRET=YOUR_BRAND_BACKEND_GATEWAY_SECRET
WISP_ADMIN_KEY=YOUR_PRIVATE_SNIPPET_ADMIN_KEY
WISP_DASHBOARD_KEY=YOUR_PRIVATE_DASHBOARD_KEY
```

`WISP_ADMIN_KEY` protects `register-brand`.

`WISP_DASHBOARD_KEY` protects `get-conversations` and is the key you enter on the dashboard page.

## 4. Add A Brand

The docs site can create or update brand rows through `register-brand`.

Manual SQL example:

```sql
insert into fp3.brands (
  site_id,
  brand_name,
  website_url,
  backend_url,
  backend_secret_name,
  allowed_origins,
  platform,
  status
) values (
  'test-brand.com',
  'Test Brand',
  'https://test-brand.com',
  'https://datastraw-support-agent-production-54f5.up.railway.app/api/widget/chat',
  'BRAND_BACKEND_SECRET',
  array['https://test-brand.com', 'https://www.test-brand.com'],
  'web',
  'active'
);
```

Use origins exactly as browsers send them. `https://example.com` and `https://www.example.com` are different origins.

## 5. Deploy

From the repo root:

```powershell
supabase functions deploy widget-chat --project-ref YOUR_PROJECT_REF
supabase functions deploy register-brand --project-ref YOUR_PROJECT_REF
supabase functions deploy get-conversations --project-ref YOUR_PROJECT_REF
```

For your self-hosted Supabase, deploy using the method your Supabase instance supports.

Runtime URLs:

```text
https://supabasedb.datastraw.in/functions/v1/widget-chat
https://supabasedb.datastraw.in/functions/v1/register-brand
https://supabasedb.datastraw.in/functions/v1/get-conversations
```

## 6. Widget Install

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

## 7. Dashboard

The dashboard calls:

```text
https://supabasedb.datastraw.in/functions/v1/get-conversations?site_id=SITE_ID
```

with:

```text
X-Dashboard-Key: WISP_DASHBOARD_KEY
```

The function returns the newest 200 rows from `fp3.conversations` for that `site_id`.

## CORS Note

Browser preflight requests do not include the JSON body, so `widget-chat` cannot know `site_id` during `OPTIONS`. It echoes the preflight origin so the browser can send the real `POST`, then validates `site_id` and `Origin` before calling any brand backend.
