param(
  [string]$SiteId
)

$WIDGET_HOST_URL = "https://wisp-widget.pages.dev/widget.js"
$WIDGET_API_URL = "https://supabasedb.datastraw.in/functions/v1/widget-chat"

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$brandsPath = Join-Path $scriptDir "brands.json"

if (-not (Test-Path -LiteralPath $brandsPath)) {
  throw "Could not find brands.json at $brandsPath"
}

$raw = Get-Content -LiteralPath $brandsPath -Raw
$brands = @()
if ($raw.Trim().Length -gt 0) {
  $parsed = $raw | ConvertFrom-Json
  if ($null -ne $parsed) {
    $brands = @($parsed)
  }
}

if (-not $SiteId) {
  if ($brands.Count -eq 0) {
    Write-Host "No brands found in brands.json."
    return
  }

  $brands | Select-Object site_id, brand_name, status | Format-Table -AutoSize
  return
}

$brand = $brands | Where-Object { $_.site_id -eq $SiteId } | Select-Object -First 1
if (-not $brand) {
  throw "No brand found with site_id '$SiteId'. Run add-brand.ps1 first."
}

$snippet = @"
<script
  src="$WIDGET_HOST_URL"
  data-site-id="$($brand.site_id)"
  data-platform="web"
  data-api="$WIDGET_API_URL"
  defer
></script>
"@

Write-Host "Paste this before </body>:"
Write-Host ""
Write-Host $snippet
