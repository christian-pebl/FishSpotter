# Weekly snip sync for FishSpotter.
#
# Checks the exported-snips folder for anything not yet on FishSpotter, uploads
# the snips whose metadata is complete, and holds the rest for Christian to fix
# in TRDesk4. Written to be run unattended by Windows Task Scheduler.
#
# Why a Windows task and not a Vercel cron: this needs the G: Drive snips
# folder, the local repo and the DB credentials in .env.local. A Vercel cron
# has none of those.
#
# Two gates protect the live app. snip-preflight.ts reports what would happen
# without touching anything, and sync.ts independently refuses to upload a snip
# whose metadata.json is missing site / deployment / depth_m / latitude /
# longitude / recording_datetime. The gate lives in sync.ts rather than here, so
# a manual `npm run db:sync` is protected too.
#
# Logs to logs/weekly-snip-sync/<date>.log and keeps a machine-readable
# preflight report beside it. Silent when there is nothing to do.
#
#   powershell -ExecutionPolicy Bypass -File scripts\weekly-snip-sync.ps1
#   ... -WhatIf     report only, never upload

param(
    [switch]$WhatIf
)

$ErrorActionPreference = "Stop"

$repo = Split-Path -Parent $PSScriptRoot
$snipsDir = "G:\.shortcut-targets-by-id\1QkmI63Nho2bLYjVC4vWXRdDRruEV5-Zl\Ocean\08 - Data\01 - SubCam data\Fish Spotter Snips"

$logDir = Join-Path $repo "logs\weekly-snip-sync"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$stamp = Get-Date -Format "yyyy-MM-dd_HHmm"
$log = Join-Path $logDir "$stamp.log"
$report = Join-Path $logDir "$stamp.preflight.json"

function Write-Log($msg) {
    $line = "[{0}] {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $msg
    Write-Host $line
    Add-Content -Path $log -Value $line
}

Set-Location $repo
$env:SNIPS_DIR = $snipsDir

Write-Log "Weekly snip sync starting. repo=$repo"

if (-not (Test-Path $snipsDir)) {
    Write-Log "ABORT: snips folder not reachable: $snipsDir"
    Write-Log "Google Drive is probably not mounted. Nothing was uploaded."
    exit 2
}

# Step 1: preflight. Read-only, and the source of the held-snips list.
Write-Log "Running preflight..."
# npm rather than npx: under Task Scheduler's non-interactive shell, npx cannot
# always resolve the local tsx binary ("could not determine executable to run").
& npm.cmd run snips:check -- --report $report 2>&1 | ForEach-Object { Write-Log $_ }

if (-not (Test-Path $report)) {
    Write-Log "ABORT: preflight wrote no report. Nothing was uploaded."
    exit 1
}

$pf = Get-Content $report -Raw | ConvertFrom-Json
$ready = $pf.totals.ready
$hold = $pf.totals.hold
Write-Log "Preflight: READY=$ready HOLD=$hold SKIP=$($pf.totals.skip) SYNCED=$($pf.totals.synced)"

# Step 2: upload the complete ones. sync.ts re-checks the metadata itself, so a
# snip that went stale between the two steps is still caught.
if ($ready -gt 0 -and -not $WhatIf) {
    Write-Log "Uploading $ready snip(s)..."
    & npm.cmd run db:sync 2>&1 | ForEach-Object { Write-Log $_ }
    if ($LASTEXITCODE -ne 0) {
        Write-Log "WARNING: db:sync exited $LASTEXITCODE. Check the log above."
    }
} elseif ($ready -gt 0) {
    Write-Log "WhatIf: would upload $ready snip(s). Skipping."
} else {
    Write-Log "Nothing new to upload."
}

# Step 3: surface what needs a human. This is the half that a silent job would
# lose, and the reason the 25 Aug NORF-1 gap went unnoticed for three days.
if ($hold -gt 0) {
    Write-Log ""
    Write-Log "=============================================================="
    Write-Log " $hold SNIP(S) NEED DATA BEFORE THEY CAN GO UP"
    Write-Log "=============================================================="
    $pf.hold | Group-Object { $_.missing -join ", " } | ForEach-Object {
        Write-Log " $($_.Count) snip(s) missing: $($_.Name)"
        $_.Group | Select-Object -First 8 | ForEach-Object { Write-Log "    - $($_.folder)" }
        if ($_.Count -gt 8) { Write-Log "    ... and $($_.Count - 8) more" }
    }
    Write-Log ""
    Write-Log " Fix: set the deployment record on the source video in TRDesk4 and"
    Write-Log " re-export. They are not in the sync manifest, so the next run"
    Write-Log " retries them automatically."
    Write-Log "=============================================================="
}

Write-Log "Done. Log: $log"

# Exit 3 signals 'ran fine, but something is waiting on you'. Task Scheduler
# shows it as the last result, so the held state is visible without opening
# the log.
if ($hold -gt 0) { exit 3 }
exit 0
