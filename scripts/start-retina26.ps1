# Cross-user Windows launcher; keeps the existing npm run api:retina command available.
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$python = Join-Path $env:LOCALAPPDATA 'openI\retina26-venv\Scripts\python.exe'
$checkpoint = Join-Path $root 'api\models\best.pt'
if (-not (Test-Path -LiteralPath $python)) { throw 'Python 3.12 RETINA26 environment missing. Run scripts/setup-retina26.ps1.' }
if (-not (Test-Path -LiteralPath $checkpoint)) { throw 'Missing api/models/best.pt. Request a trusted checkpoint from your teammate.' }
$expected = '1240053EE3E4139362E29AF4BE006583C7A37BEAA946ECFB15005EF4938C3F8B'
$hash = (Get-FileHash -LiteralPath $checkpoint -Algorithm SHA256).Hash.ToUpperInvariant()
if ($hash -ne $expected) { throw 'Checkpoint differs from the reviewed midterm best.pt. Confirm before loading.' }
& $python -c 'import flask, torch, ultralytics, cv2, PIL'
if ($LASTEXITCODE -ne 0) { throw 'Missing dependencies. Run scripts/setup-retina26.ps1.' }
Write-Host 'Starting RETINA26 Flask on http://127.0.0.1:5000. Ctrl+C to stop.' -ForegroundColor Cyan
$previous = [Environment]::GetEnvironmentVariable('RETINA26_RESEARCH_MODE','Process')
Push-Location (Join-Path $root 'api')
try {
  $env:RETINA26_RESEARCH_MODE = '1'
  & $python -m flask --app api run --no-debugger
} finally {
  [Environment]::SetEnvironmentVariable('RETINA26_RESEARCH_MODE', $previous, 'Process')
  Pop-Location
}
