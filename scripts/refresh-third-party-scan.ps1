<#
.SYNOPSIS
  Re-run the third-party static R+K scan behind THIRD-PARTY-RK-SCAN.md.

.DESCRIPTION
  The published scan is a dated result set produced by a specific tool version.
  When a criterion changes, the published table silently becomes wrong — it
  reports failures the current tool no longer raises. That is the same
  "documentation that lies" failure this project keeps fixing elsewhere, so the
  scan is re-runnable rather than hand-maintained.

  For each candidate it:
    1. clones the repository read-only into a throw-away %TEMP% directory
       (--depth 1, no install, no build),
    2. verifies the repository actually declares dsh.bundle.patch, so unrelated
       projects in a topic-derived catalogue are skipped rather than judged,
    3. runs the canonical static gate: --no-smoke --only "R,K",
    4. records the gated verdict (all checks except R2/R4, which need built
       artifacts).

  NO third-party code is executed. --no-smoke means no install, no boot.

.PARAMETER Root
  Workspace holding dsh-plugin-doctor. Defaults to this script's grandparent.

.PARAMETER DoctorPath
  Which doctor.mjs to run. Defaults to the workspace copy (i.e. the working
  tree, not a published version) so a refresh reflects current criteria.

.PARAMETER Out
  Where to write the refresh JSON. Defaults to a %TEMP% path.

.PARAMETER Limit
  Only scan the first N candidates (for a quick check).

.EXAMPLE
  pwsh -File scripts/refresh-third-party-scan.ps1
  pwsh -File scripts/refresh-third-party-scan.ps1 -Limit 3
#>
[CmdletBinding()]
param(
  [string]$Root = (Split-Path -Parent (Split-Path -Parent $PSCommandPath)),
  [string]$DoctorPath,
  [string]$Out,
  [int]$Limit = 0
)

$ErrorActionPreference = 'Continue'
if (-not $DoctorPath) { $DoctorPath = Join-Path $Root 'doctor.mjs' }
if (-not $Out) { $Out = Join-Path $env:TEMP 'rk-scans-refresh.json' }
if (-not (Test-Path $DoctorPath)) { throw "doctor.mjs not found at $DoctorPath" }

$scanFile = Join-Path $Root 'data\rk-scans.json'
if (-not (Test-Path $scanFile)) { throw "no scan data at $scanFile" }

$prior = [System.IO.File]::ReadAllText($scanFile) | ConvertFrom-Json
$candidates = @($prior.rows | Where-Object { $_.qualified })
if ($Limit -gt 0) { $candidates = $candidates | Select-Object -First $Limit }

$work = Join-Path $env:TEMP ("doctor-3p-" + [guid]::NewGuid().ToString('N').Substring(0, 8))
New-Item -ItemType Directory -Force -Path $work | Out-Null
$null = New-Item -ItemType File -Force -Path (Join-Path $work 'o.txt')

Write-Output "doctor   : $DoctorPath"
Write-Output "work dir : $work"
Write-Output "candidates: $($candidates.Count)"
Write-Output ""

$rows = @()
$i = 0
foreach ($c in $candidates) {
  $i++
  $repo = "$($c.owner)/$($c.repo)"
  $dest = Join-Path $work "$($c.owner)__$($c.repo)"
  Write-Output "[$i/$($candidates.Count)] $repo"

  if (Test-Path $dest) { Remove-Item $dest -Recurse -Force -ErrorAction SilentlyContinue }
  $clone = Start-Process -FilePath 'git' -PassThru -Wait -NoNewWindow `
    -RedirectStandardOutput (Join-Path $work 'gc.txt') -RedirectStandardError (Join-Path $work 'gc.err') `
    -ArgumentList @('clone', '--depth', '1', '--quiet', "https://github.com/$repo.git", $dest)

  if ($clone.ExitCode -ne 0) {
    $rows += [pscustomobject]@{ repo = $repo; qualified = $false; why = 'clone-fail' }
    Write-Output "    clone-fail"
    continue
  }

  # Qualification gate: it must actually be a dsh plugin.
  $pkgPath = Join-Path $dest 'package.json'
  if (-not (Test-Path $pkgPath)) {
    $rows += [pscustomobject]@{ repo = $repo; qualified = $false; why = 'no-package-json' }
    Write-Output "    skip: no package.json"
    continue
  }
  $pkg = $null
  try { $pkg = [System.IO.File]::ReadAllText($pkgPath) | ConvertFrom-Json } catch { }
  if (-not $pkg -or -not $pkg.dsh.bundle.patch) {
    $rows += [pscustomobject]@{ repo = $repo; qualified = $false; why = 'no-dsh-bundle-patch' }
    Write-Output "    skip: no dsh.bundle.patch"
    continue
  }

  $json = Join-Path $work 'r.json'
  if (Test-Path $json) { Remove-Item $json -Force }
  $run = Start-Process -FilePath 'node' -PassThru -Wait -NoNewWindow `
    -RedirectStandardOutput (Join-Path $work 'o.txt') -RedirectStandardError (Join-Path $work 'e.txt') `
    -ArgumentList @($DoctorPath, '--repo', $dest, '--no-smoke', '--only', 'R,K', '--json', $json)

  if (-not (Test-Path $json)) {
    $rows += [pscustomobject]@{ repo = $repo; qualified = $true; why = 'no-report'; exit = $run.ExitCode }
    Write-Output "    no JSON report (exit $($run.ExitCode))"
    continue
  }
  $rep = [System.IO.File]::ReadAllText($json) | ConvertFrom-Json
  $gated = @($rep.results | Where-Object { $_.name -notmatch '^R[24] ' })
  $gf = @($gated | Where-Object { $_.status -eq 'fail' -or $_.status -eq 'error' })
  $gw = @($gated | Where-Object { $_.status -eq 'warn' })

  $rows += [pscustomobject]@{
    repo         = $repo
    stars        = $c.stars
    qualified    = $true
    pkgName      = $pkg.name
    pkgVersion   = $pkg.version
    exit         = $run.ExitCode
    gatedTotal   = $gated.Count
    gatedFails   = @($gf | ForEach-Object { $_.id })
    gatedWarns   = @($gw | ForEach-Object { $_.id })
    gatedVerdict = if ($gf.Count -eq 0 -and @($rep.degraded).Count -eq 0) { 'pass' } else { 'fail' }
    kMode        = $rep.coverage.K.mode
    doctorVersion = $rep.doctorVersion
  }
  Write-Output ("    gated={0} fails=[{1}] verdict={2}" -f $gated.Count, (@($gf | ForEach-Object { $_.id }) -join ','), $rows[-1].gatedVerdict)
}

$qualified = @($rows | Where-Object { $_.qualified })
$gatedFail = @($qualified | Where-Object { $_.gatedVerdict -eq 'fail' })

# Read the version from package.json next to the doctor that was run. Requiring
# doctor.mjs would not work: its default export is the Cordis plugin, not a
# version string, and requiring plugin.mjs returns a module object.
$pkgJson = Join-Path (Split-Path -Parent $DoctorPath) 'package.json'
$doctorVersion = if (Test-Path $pkgJson) {
  ([System.IO.File]::ReadAllText($pkgJson) | ConvertFrom-Json).version
} else { 'unknown' }

$result = [ordered]@{
  rescannedAt   = (Get-Date).ToUniversalTime().ToString('o')
  doctorPath    = $DoctorPath
  doctorVersion = $doctorVersion
  criteriaNote  = 'gated = every check except R2/R4 (those read built artifacts); pass = no gated fail/error and no degraded group'
  candidatePool = $candidates.Count
  qualified     = $qualified.Count
  skipped       = @($rows | Where-Object { -not $_.qualified }).Count
  gatedPass     = @($qualified | Where-Object { $_.gatedVerdict -eq 'pass' }).Count
  gatedFail     = $gatedFail.Count
  rows          = $rows
}
[System.IO.File]::WriteAllText($Out, ($result | ConvertTo-Json -Depth 6), (New-Object System.Text.UTF8Encoding($false)))

Write-Output ""
Write-Output "=== SUMMARY ==="
Write-Output "doctor    : $doctorVersion"
Write-Output "qualified : $($qualified.Count)"
Write-Output "pass      : $($result.gatedPass)"
Write-Output "fail      : $($result.gatedFail)"
Write-Output "skipped   : $($result.skipped)"
Write-Output ""
Write-Output "failing repos:"
$gatedFail | ForEach-Object { Write-Output ("  {0,-46} {1}" -f $_.repo, ($_.gatedFails -join ',')) }
Write-Output ""
Write-Output "prior scan (for comparison): qualified=$($prior.qualified) pass=$($prior.gated) fail=$($prior.gatedFail)"
Write-Output "written: $Out"
Write-Output "clones : $work  (review before removing)"
