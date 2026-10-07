$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Resolve-Path (Join-Path $scriptDir "..")
$sourceDir = Join-Path $repoRoot "widget"

Copy-Item -LiteralPath (Join-Path $sourceDir "widget.js") -Destination (Join-Path $scriptDir "widget.js") -Force
Copy-Item -LiteralPath (Join-Path $sourceDir "Pixie.png") -Destination (Join-Path $scriptDir "Pixie.png") -Force

Push-Location $scriptDir
try {
  wrangler pages deploy . --project-name=wisp-widget
}
finally {
  Pop-Location
}
