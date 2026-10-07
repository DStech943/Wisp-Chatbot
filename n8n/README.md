# Widget Chat n8n Workflow

This folder contains an importable n8n workflow for the chat widget:

```text
widget.js -> n8n Production webhook -> brand backend
```

Targeted n8n version: `2.41.2`.

## Import

1. In n8n, go to **Workflows**.
2. Choose **Import from File**.
3. Select `widget-chat.workflow.json`.
4. Open the imported workflow before activating it.

## Replace Placeholders

In the **Widget Chat** Webhook node:

- The included workflow is set for local testing with `http://127.0.0.1:8080` in **Allowed Origins (CORS)**.
- For Shopify production, change it to `https://mysa-lifestyle.myshopify.com`.

In the **Resolve Site** Code node:

- The included workflow uses `mysa-lifestyle.myshopify.com` as the `site_id`.
- Replace the origin in `origins` with the exact browser `Origin` header you want to allow.
- Keep the backend URL as-is for the current DataStraw backend, or replace it for another brand.

## Header Auth Credential

Create the credential n8n will use when calling the brand backend:

1. Go to **Credentials**.
2. Create a new **Header Auth** credential.
3. Name it `Brand Backend Secret`.
4. Set **Name** to `X-Gateway-Secret`.
5. Set **Value** to your brand backend secret.
6. Save it.
7. Open the **Call Backend** HTTP Request node.
8. Attach the `Brand Backend Secret` credential.

Secrets live only in n8n credentials. Do not put secrets in this repo or in the workflow JSON.

## Test URL vs Production URL

The Webhook node has two URLs:

- **Test URL**: use while the editor is listening for a test event.
- **Production URL**: use after the workflow is activated.

The widget should use the Production URL as its `data-api` value.

## Activate

After replacing placeholders and attaching the credential:

1. Save the workflow.
2. Turn on **Active**.
3. Copy the Production URL from the Webhook node.
4. Use that full URL as the widget `data-api`.

## Add A Brand

Add another entry to `SITES` in the **Resolve Site** Code node:

```js
"another-shop.myshopify.com": {
  brand: "another-brand",
  backend: "https://example.up.railway.app/api/widget/chat",
  origins: ["https://another-shop.myshopify.com"],
},
```

If a brand uses a different backend secret, add a **Switch** node after **Allowed?** and route each brand to its own **HTTP Request** node with its own Header Auth credential.

## Verify

Set these environment variables in PowerShell:

```powershell
$env:N8N_URL="https://YOUR-N8N-HOST/webhook/widget-chat"
$env:SITE_ID="mysa-lifestyle.myshopify.com"
$env:ORIGIN="http://127.0.0.1:8080"
```

Run:

```powershell
.\test.ps1
```

Expected:

- Normal message returns a JSON object with `reply`.
- `https://evil.com` returns HTTP `403`.
- `I want to talk to a human` returns `handoff: true`.
