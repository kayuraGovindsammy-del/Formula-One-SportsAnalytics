$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Frontend = Join-Path $Root "src\frontend"

Write-Host ""
Write-Host "Starting F1 Analytics..."
Write-Host ""

Write-Host "Frontend:"
Write-Host "http://localhost:5173"
Write-Host ""

Write-Host "Hosted API:"
Write-Host "https://f1-sport-analytics-api-production.up.railway.app/api/v1"
Write-Host ""

Set-Location $Frontend

npm run dev