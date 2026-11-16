# openI teammate setup: Windows PowerShell 5.1+.
# Creates/updates an isolated Python 3.12 environment under the CURRENT user's LOCALAPPDATA.
# Does not modify the application's Python sources or existing SQLite databases.
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$requirements = Join-Path $root 'api\requirements-retina26.txt'
if (-not (Test-Path -LiteralPath $requirements)) { throw 'Could not find api/requirements-retina26.txt. Run from a complete clone of openI.' }
if (-not $env:LOCALAPPDATA) { throw 'This setup script is for Windows. See docs/RETINA26_TEAM_SETUP.md for macOS/Linux.' }

try {
  $version = & py -3.12 --version 2>&1
  if ($LASTEXITCODE -ne 0) { throw 'Python 3.12 is missing.' }
} catch {
  throw 'Install Python 3.12 first (with the py launcher) then run this setup script again.'
}
Write-Host "Using $version" -ForegroundColor Cyan
$venv = Join-Path $env:LOCALAPPDATA 'openI\retina26-venv'
$python = Join-Path $venv 'Scripts\python.exe'
if (-not (Test-Path -LiteralPath $python)) {
  New-Item -ItemType Directory -Path (Split-Path -Parent $venv) -Force | Out-Null
  & py -3.12 -m venv $venv
  if ($LASTEXITCODE -ne 0) { throw 'Could not create the RETINA26 environment.' }
}
Write-Host "RETINA26 environment: $venv" -ForegroundColor Cyan
& $python -m pip install --upgrade pip
if ($LASTEXITCODE -ne 0) { throw 'pip upgrade failed.' }
Write-Host 'Installing CPU-only PyTorch and Torchvision (download may take time)...' -ForegroundColor Cyan
& $python -m pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu
if ($LASTEXITCODE -ne 0) { throw 'PyTorch installation failed. Check internet access and Python 3.12 architecture.' }
Write-Host 'Installing openI RETINA26 dependencies...' -ForegroundColor Cyan
& $python -m pip install -r $requirements
if ($LASTEXITCODE -ne 0) { throw 'Python dependencies failed to install.' }
& $python -c "import flask, torch, torchvision, ultralytics, cv2, PIL; print('READY: Flask, PyTorch, Ultralytics and image libraries imported.'); print('PyTorch:', torch.__version__); print('Ultralytics:', ultralytics.__version__)"
if ($LASTEXITCODE -ne 0) { throw 'Python dependency import verification failed.' }

$checkpoint = Join-Path $root 'api\models\best.pt'
if (-not (Test-Path -LiteralPath $checkpoint)) {
  Write-Warning 'Trained checkpoint is missing: api/models/best.pt. Get the trusted file from the model owner, then run scripts/check-retina26.ps1.'
} else {
  Write-Host 'Checkpoint present. Run scripts/check-retina26.ps1 to verify it before loading.' -ForegroundColor Cyan
}
Write-Host 'SUCCESS! RETINA26 environment prepared.' -ForegroundColor Green
Write-Host 'Next: npm ci (or npm install), then start Flask with npm run api:retina and React with npm run dev.'
