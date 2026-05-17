param(
  [Parameter(Mandatory = $true)]
  [string]$ApiKey,

  [string]$Model = "gpt-5.4-mini"
)

$root = Split-Path -Parent $PSScriptRoot
$cleanApiKey = $ApiKey.Trim()

if (
  $cleanApiKey.Length -lt 20 -or
  $cleanApiKey -eq "YOUR_OPENAI_API_KEY" -or
  $cleanApiKey -eq "your_api_key_here" -or
  $cleanApiKey.ToUpper().StartsWith("YOUR_")
) {
  throw "Paste your real OpenAI API key. Do not use the placeholder text."
}

function Set-EnvValue {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path,

    [Parameter(Mandatory = $true)]
    [string]$Key,

    [Parameter(Mandatory = $true)]
    [string]$Value
  )

  if (-not (Test-Path $Path)) {
    $examplePath = "$Path.example"
    if (Test-Path $examplePath) {
      Copy-Item $examplePath $Path
    } else {
      New-Item -ItemType File -Path $Path -Force | Out-Null
    }
  }

  $lines = Get-Content $Path
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

Set-EnvValue -Path (Join-Path $root ".env") -Key "SYNTRIX_OPENAI_API_KEY" -Value $cleanApiKey
Set-EnvValue -Path (Join-Path $root ".env") -Key "SYNTRIX_OPENAI_MODEL" -Value $Model
Set-EnvValue -Path (Join-Path $root "backend\.env") -Key "SYNTRIX_OPENAI_API_KEY" -Value $cleanApiKey
Set-EnvValue -Path (Join-Path $root "backend\.env") -Key "SYNTRIX_OPENAI_MODEL" -Value $Model

Write-Host "OpenAI API key and default model saved."
Write-Host "Restart with: docker compose up --build"
