$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

function Set-EnvValue {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path,

    [Parameter(Mandatory = $true)]
    [string]$Key,

    [Parameter(Mandatory = $true)]
    [string]$Value
  )

  $lines = if (Test-Path $Path) { Get-Content $Path } else { @() }
  $replacement = "$Key=$Value"
  $found = $false
  $updated = foreach ($line in $lines) {
    if ($line -match "^$([regex]::Escape($Key))=") {
      $found = $true
      $replacement
    } else {
      $line
    }
  }

  if (-not $found) {
    $updated += $replacement
  }

  Set-Content -Path $Path -Value $updated
}

function New-SecretKey {
  return (([guid]::NewGuid().ToString("N")) + ([guid]::NewGuid().ToString("N")))
}

function Ensure-SecretKey {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path
  )

  $current = ""
  if (Test-Path $Path) {
    $line = Get-Content $Path | Where-Object { $_ -match "^SYNTRIX_SECRET_KEY=" } | Select-Object -First 1
    if ($line) {
      $current = $line.Substring("SYNTRIX_SECRET_KEY=".Length).Trim()
    }
  }

  if ($current.Length -lt 32 -or $current -eq "replace-me-in-production" -or $current.StartsWith("dev-change-me")) {
    Set-EnvValue -Path $Path -Key "SYNTRIX_SECRET_KEY" -Value (New-SecretKey)
  }
}

if (-not (Test-Path .env)) {
  Copy-Item .env.example .env
}

if (-not (Test-Path frontend/.env.local)) {
  Copy-Item frontend/.env.example frontend/.env.local
}

if (-not (Test-Path backend/.env)) {
  Copy-Item backend/.env.example backend/.env
}

Ensure-SecretKey -Path (Join-Path $root ".env")
Ensure-SecretKey -Path (Join-Path $root "backend\.env")

Write-Host "Environment files are ready."
Write-Host "Next step: docker compose up --build"
