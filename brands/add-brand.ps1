param(
  [Parameter(Mandatory = $true)]
  [string]$SiteId,

  [Parameter(Mandatory = $true)]
  [string]$BrandName,

  [Parameter(Mandatory = $true)]
  [string]$BackendUrl,

  [Parameter(Mandatory = $true)]
  [string]$Origins
)

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

$existing = $brands | Where-Object { $_.site_id -eq $SiteId } | Select-Object -First 1
if ($existing) {
  throw "A brand with site_id '$SiteId' already exists in brands.json."
}

$originList = $Origins -split "," | ForEach-Object { $_.Trim() } | Where-Object { $_.Length -gt 0 }
if ($originList.Count -eq 0) {
  throw "At least one origin is required. Pass -Origins as a comma-separated string."
}

$entry = [ordered]@{
  site_id = $SiteId
  brand_name = $BrandName
  backend_url = $BackendUrl
  origins = @($originList)
  platform = "web"
  status = "pending"
  added_date = (Get-Date -Format "yyyy-MM-dd")
}

$updated = @($brands) + [pscustomobject]$entry
$updated | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $brandsPath -Encoding utf8

Write-Host "Added brand '$BrandName' with site_id '$SiteId'."
Write-Host ""
Write-Host "Checklist:"
Write-Host "1) Add this site_id and these origins to the Supabase fp3.brands table"
Write-Host "2) Confirm the Widget Chat Edge Function is deployed and pointing to n8n"
Write-Host "3) Run generate-snippet.ps1 -SiteId $SiteId to get the client's embed code"
Write-Host "4) After verifying it's live, run set-status.ps1 -SiteId $SiteId -Status active"
