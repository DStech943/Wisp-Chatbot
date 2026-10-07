$ErrorActionPreference = "Stop"

function Get-RequiredEnv {
  param([string]$Name)

  $value = [Environment]::GetEnvironmentVariable($Name)
  if ([string]::IsNullOrWhiteSpace($value)) {
    throw "Missing required environment variable: $Name"
  }

  return $value
}

function Invoke-WidgetChat {
  param(
    [string]$Url,
    [string]$SiteId,
    [string]$Origin,
    [string]$Message,
    [string]$SessionId
  )

  $body = @{
    site_id = $SiteId
    message = $Message
    session_id = $SessionId
    platform = "test"
    page_url = $Origin
  } | ConvertTo-Json -Compress

  Invoke-RestMethod `
    -Uri $Url `
    -Method Post `
    -Headers @{ Origin = $Origin } `
    -ContentType "application/json" `
    -Body $body
}

$n8nUrl = Get-RequiredEnv "N8N_URL"
$siteId = Get-RequiredEnv "SITE_ID"
$origin = Get-RequiredEnv "ORIGIN"

Write-Host "Test A: normal message expects reply"
$normal = Invoke-WidgetChat `
  -Url $n8nUrl `
  -SiteId $siteId `
  -Origin $origin `
  -Message "Hello" `
  -SessionId "test-normal"

if ([string]::IsNullOrWhiteSpace($normal.reply)) {
  throw "Test A failed: response did not include reply."
}
Write-Host "Test A passed:" ($normal | ConvertTo-Json -Compress)

Write-Host "Test B: evil origin expects HTTP 403"
try {
  Invoke-WidgetChat `
    -Url $n8nUrl `
    -SiteId $siteId `
    -Origin "https://evil.com" `
    -Message "Hello" `
    -SessionId "test-evil" | Out-Null

  throw "Test B failed: evil origin did not return HTTP 403."
} catch {
  $statusCode = $null
  if ($_.Exception.Response -and $_.Exception.Response.StatusCode) {
    $statusCode = [int]$_.Exception.Response.StatusCode
  }

  if ($statusCode -ne 403) {
    throw "Test B failed: expected HTTP 403, got $statusCode. $($_.Exception.Message)"
  }

  Write-Host "Test B passed: HTTP 403"
}

Write-Host "Test C: human handoff expects handoff true"
$handoff = Invoke-WidgetChat `
  -Url $n8nUrl `
  -SiteId $siteId `
  -Origin $origin `
  -Message "I want to talk to a human" `
  -SessionId "test-handoff"

if ($handoff.handoff -ne $true) {
  throw "Test C failed: response did not include handoff true. Response: $($handoff | ConvertTo-Json -Compress)"
}
Write-Host "Test C passed:" ($handoff | ConvertTo-Json -Compress)

Write-Host "All tests passed."
