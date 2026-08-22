$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Backend = Join-Path $Root "src\backend"
$Frontend = Join-Path $Root "src\frontend"

Write-Host ""
Write-Host "========================================="
Write-Host " F1 Analytics - Local Development Setup"
Write-Host "========================================="
Write-Host ""

function Require-Command($Name, $InstallHint) {
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        Write-Host "ERROR: '$Name' was not found."
        Write-Host $InstallHint
        exit 1
    }
}

Require-Command "node" "Install Node.js, then reopen the terminal."
Require-Command "npm" "Install Node.js/npm, then reopen the terminal."

Write-Host "Installing frontend dependencies..."

Push-Location $Frontend

npm install

if ($LASTEXITCODE -ne 0) {
    Pop-Location
    Write-Host "Frontend dependency installation failed."
    exit $LASTEXITCODE
}

Pop-Location

Write-Host ""
Write-Host "Installing backend dependencies..."

Push-Location $Backend

npm install

if ($LASTEXITCODE -ne 0) {
    Pop-Location
    Write-Host "Backend dependency installation failed."
    exit $LASTEXITCODE
}

Pop-Location

Write-Host ""
Write-Host "========================================="
Write-Host " Setup complete"
Write-Host "========================================="
Write-Host ""
Write-Host "The frontend uses the hosted Railway API."
Write-Host "The Railway API connects to the shared Neon PostgreSQL database."
Write-Host ""
Write-Host "No local PostgreSQL installation is required."
Write-Host "No Neon password is required locally."
Write-Host "No Firebase Admin service-account file is required locally."
Write-Host ""
Write-Host "Run the frontend with:"
Write-Host ""
Write-Host "  cd src/frontend"
Write-Host "  npm run dev"
Write-Host ""
Write-Host "Or run:"
Write-Host ""
Write-Host "  .\start.ps1"
Write-Host ""