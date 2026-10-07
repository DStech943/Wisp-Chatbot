# Brand Registry

Use this folder to onboard and track non-Shopify brands that load the widget with a plain `<script>` tag.

For hosting and updating `widget.js` itself, see [`../widget-host/README.md`](../widget-host/README.md).

## 1. Add A Brand

```powershell
.\add-brand.ps1 `
  -SiteId "client-domain.com" `
  -BrandName "Client Brand" `
  -BackendUrl "https://client-backend.example.com/api/widget/chat" `
  -Origins "https://client-domain.com,https://www.client-domain.com"
```

This adds a pending entry to `brands.json` for local onboarding tracking.

## 2. Add The Brand In Supabase

Add the same brand to the Supabase `fp3.brands` table. The runtime source of truth for allowed origins is Supabase, not this local JSON file.

See [`../supabase/README.md`](../supabase/README.md) for the table SQL and insert examples.

Secrets stay in Supabase Edge Function secrets and n8n credentials. Do not put secrets in this registry.

## 3. Generate The Client Snippet

```powershell
.\generate-snippet.ps1 -SiteId "client-domain.com"
```

Send the printed `<script>` tag to the client and ask them to paste it before `</body>`.

If you omit `-SiteId`, the script lists every registered brand:

```powershell
.\generate-snippet.ps1
```

## 4. Verify

After the client installs the snippet:

- Open the client site
- Confirm the chat bubble appears
- Send a test message
- Confirm Supabase accepts the origin and forwards to n8n
- Confirm the brand backend returns a reply

## 5. Mark Active

After verifying the widget is live:

```powershell
.\set-status.ps1 -SiteId "client-domain.com" -Status active
```

Use `paused` if the brand should remain registered but not considered live.
