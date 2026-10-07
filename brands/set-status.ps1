param(
  [Parameter(Mandatory = $true)]
  [string]$SiteId,

  [Parameter(Mandatory = $true)]
  [ValidateSet("pending", "active", "paused")]
  [string]$Status
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

$brand = $brands | Where-Object { $_.site_id -eq $SiteId } | Select-Object -First 1
if (-not $brand) {
  throw "No brand found with site_id '$SiteId'."
}

$brand.status = $Status
$brands | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $brandsPath -Encoding utf8

Write-Host "Updated '$SiteId' status to '$Status'."
