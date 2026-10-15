# Read-only checks for teammate readiness and Git hygiene. Never loads a .pt checkpoint.
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$checkpoint = Join-Path $root 'api\models\best.pt'
$expected = '1240053EE3E4139362E29AF4BE006583C7A37BEAA946ECFB15005EF4938C3F8B'
Write-Host '=== openI RETINA26 TEAM CHECK ===' -ForegroundColor Cyan
if (-not (Test-Path -LiteralPath (Join-Path $root 'package.json'))) { throw 'Missing package.json' }
if (-not (Test-Path -LiteralPath (Join-Path $root 'api\api.py'))) { throw 'Missing api/api.py' }
if ($env:LOCALAPPDATA) {
  $python = Join-Path $env:LOCALAPPDATA 'openI\retina26-venv\Scripts\python.exe'
  if (Test-Path -LiteralPath $python) {
    & $python -c "import flask,torch,ultralytics,cv2,PIL; print('Python libraries: OK')"
    if ($LASTEXITCODE -ne 0) { throw 'RETINA26 Python dependencies are incomplete.' }
  } else { Write-Warning 'Python environment missing. Run scripts/setup-retina26.ps1.' }
} else { Write-Warning 'Windows Python check unavailable. See docs/RETINA26_TEAM_SETUP.md.' }
if (Test-Path -LiteralPath $checkpoint) {
  $hash = (Get-FileHash -LiteralPath $checkpoint -Algorithm SHA256).Hash.ToUpperInvariant()
  if ($hash -ne $expected) { throw "Model hash differs from the supplied midterm checkpoint ($hash). Confirm the file with its owner BEFORE loading it." }
  Write-Host 'Trusted midterm best.pt SHA256: verified' -ForegroundColor Green
} else {
  Write-Warning 'api/models/best.pt missing. AI predictions and explanations will not work until installed.'
}
Push-Location $root
try {
  $trackedSensitive = @(& git ls-files -- '*.db' '*.db-*' '*.sqlite' '*.sqlite3' '*.pt' '*.pth' '*.onnx' '.env' '.env.*')
  if ($LASTEXITCODE -ne 0) { throw 'git ls-files failed.' }
  if ($trackedSensitive.Count -gt 0) {
    Write-Warning 'Sensitive-looking paths are already tracked; review before pushing:'
    $trackedSensitive | ForEach-Object { Write-Host "  $_" }
  } else {
    Write-Host 'Tracked databases, model weights and .env files: none' -ForegroundColor Green
  }
  Write-Host 'Current branch:' (& git branch --show-current)
} finally { Pop-Location }
Write-Host 'Check finished. This command does not modify files or run the model.'
