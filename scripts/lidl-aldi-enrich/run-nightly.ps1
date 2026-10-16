# Natlig kørsel på brugerens pc (docs/LIDL-ALDI-ENRICH.md). Kræver ingen
# administratorrettigheder: henter nyeste kode, opdaterer et lokalt venv og
# kører enrich.py. Log: logs\nightly-<dato>.log ved siden af scriptet.
$ErrorActionPreference = "Continue"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$repo = (git -C $here rev-parse --show-toplevel).Trim()
$logDir = Join-Path $here "logs"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$log = Join-Path $logDir ("nightly-{0}.log" -f (Get-Date -Format "yyyy-MM-dd"))

function Write-Log($text) { "{0}  {1}" -f (Get-Date -Format "HH:mm:ss"), $text | Tee-Object -FilePath $log -Append }

Write-Log "Henter nyeste kode (git pull origin master)"
git -C $repo pull --ff-only origin master 2>&1 | Tee-Object -FilePath $log -Append

$venv = Join-Path $here ".venv"
if (-not (Test-Path (Join-Path $venv "Scripts\python.exe"))) {
  Write-Log "Opretter venv"
  py -3 -m venv $venv 2>&1 | Tee-Object -FilePath $log -Append
}
$python = Join-Path $venv "Scripts\python.exe"
& $python -m pip install --quiet -r (Join-Path $here "requirements.txt") 2>&1 | Tee-Object -FilePath $log -Append

Write-Log "Starter enrich.py"
& $python (Join-Path $here "enrich.py") 2>&1 | Tee-Object -FilePath $log -Append
Write-Log "Færdig (exit $LASTEXITCODE)"
