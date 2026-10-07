# Widget Host

This folder is for publicly hosting the vanilla widget assets so non-Shopify brands can install the widget with a plain `<script>` tag.

`/widget` remains the source of truth. The files in this folder are deployment copies:

- `widget.js`
- `Pixie.png`

## One-Time Setup

Install Wrangler:

```powershell
npm install -g wrangler
```

Log in to Cloudflare:

```powershell
wrangler login
```

## Deploy After Widget Changes

After any edit to `/widget/widget.js` or `/widget/Pixie.png`, run:

```powershell
.\sync.ps1
```

The script copies the latest widget assets from `/widget` into this folder, then runs:

```powershell
wrangler pages deploy . --project-name=wisp-widget
```

## Live URL

The live URL only appears after the first successful deploy. It will likely be:

```text
https://wisp-widget.pages.dev
```

Confirm the actual URL from the `wrangler pages deploy` output.

Non-Shopify brands can then load:

```html
<script
  src="https://wisp-widget.pages.dev/widget.js"
  data-site-id="BRAND_SITE_ID"
  data-platform="web"
  data-api="https://supabasedb.datastraw.in/functions/v1/widget-chat"
  defer
></script>
```
