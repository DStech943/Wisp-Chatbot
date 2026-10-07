# Multi-Brand Chat Widget

This monorepo contains a shared embeddable chat widget and a Shopify app shell for one-toggle widget installation.

## Architecture

```text
Brand website or Shopify storefront
  loads /widget/widget.js
        |
        | POST full data-api Edge Function URL
        v
Supabase Edge Function
  validates Origin + site_id against fp3.brands
  forwards validated requests server-side
        |
        v
n8n Production webhook
  handles workflow + backend call
  uses credentials stored in n8n
        |
        | POST /api/widget/chat
        v
Brand Railway AI backend
```

## Packages

- `widget/`: Vanilla JavaScript widget loaded by all brands.
- `widget-host/`: Cloudflare Pages host for the public widget asset.
- `supabase/`: Edge Function gateway and SQL for the runtime brand registry.
- `brands/`: Local onboarding registry and snippet tooling.
- `docs-site/`: Public install docs and private conversation dashboard.
- `shopify-app/`: Shopify CLI app shell. The Theme App Extension will be generated with the Shopify CLI later.

## Widget To Supabase Contract

`data-api` must be the full Supabase Edge Function URL.

The widget sends:

```json
{
  "site_id": "brand-site-id",
  "message": "Customer message",
  "session_id": "browser-session-id",
  "platform": "custom",
  "page_url": "https://brand.example/products/example"
}
```

The widget sends only `Content-Type: application/json`. Secrets must live in Supabase Edge Function secrets and n8n credentials, never in this repo.

## Non-Shopify Install Shape

```html
<script
  src="https://wisp-widget.pages.dev/widget.js"
  data-site-id="brand-site-id"
  data-platform="web"
  data-api="https://supabasedb.datastraw.in/functions/v1/widget-chat"
  defer
></script>
```
