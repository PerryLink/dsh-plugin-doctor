<#
.SYNOPSIS
  Write the correct copyright holder into the Apache-2.0 appendix line of the
  PerryLink DSH plugin family.

.DESCRIPTION
  The LICENSE files were copied between sibling repositories, so the appendix
  boilerplate often names a DIFFERENT project. The worst case is the standard's
  own repository, where the only copyright statement in the licence named
  dsh-memento. Apache-2.0 carries no other copyright line, so where this line is
  wrong the licence credits the wrong holder outright.

  This script rewrites ONLY a line that already matches
    ^<ws>Copyright <year> <anything>$
  It never invents a copyright line into a bare Apache-2.0 text: a repository
  whose LICENSE has no appendix is reported as `no-copyright-line` and left
  alone. Attribution for those belongs in NOTICE + package.json author, not in
  the licence body.

  Line endings and BOM presence are detected per file and preserved, so a
  rewrite produces a one-line diff.

  DRY RUN BY DEFAULT. Nothing is written without -Apply. Per the workspace
  deletion discipline, review the printed list before applying.

.PARAMETER Root
  The workspace holding the plugin repositories. Defaults to this script's
  grandparent directory (workspace\scripts\ -> workspace).

.PARAMETER Holder
  The copyright holder to write. Defaults to 'PerryLink'.

.PARAMETER Year
  The year to write. Defaults to the year already present on the matched line,
  falling back to the current year.

.PARAMETER Apply
  Actually write the files. Without it, only report.

.PARAMETER Repo
  Limit to these repository directory names.

.EXAMPLE
  pwsh -File scripts/fix-license-copyright.ps1
  pwsh -File scripts/fix-license-copyright.ps1 -Apply
#>
[CmdletBinding()]
param(
  [string]$Root = (Split-Path -Parent (Split-Path -Parent $PSCommandPath)),
  [string]$Holder = 'PerryLink',
  [string]$Year,
  [switch]$Apply,
  [string[]]$Repo
)

$ErrorActionPreference = 'Stop'

# Statuses that mean "this file is already correct" — never rewritten.
$OK_PATTERN = [regex]::Escape($Holder)

$results = @()

$dirs = Get-ChildItem -Path $Root -Directory -ErrorAction SilentlyContinue |
  Where-Object { Test-Path (Join-Path $_.FullName '.git') }
if ($Repo) { $dirs = $dirs | Where-Object { $Repo -contains $_.Name } }

foreach ($dir in $dirs) {
  $licPath = Join-Path $dir.FullName 'LICENSE'
  $row = [ordered]@{ Repo = $dir.Name; Status = ''; LineNo = 0; From = ''; To = '' }

  if (-not (Test-Path $licPath)) {
    $row.Status = 'no-license-file'
    $results += [pscustomobject]$row
    continue
  }

  $bytes = [System.IO.File]::ReadAllBytes($licPath)
  $hasBom = $bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF
  $text = [System.IO.File]::ReadAllText($licPath)

  # Preserve the file's own line ending. A mixed-ending file is left to the
  # dominant ending rather than being silently normalised.
  $crlf = ([regex]::Matches($text, "`r`n")).Count
  $lfTotal = ([regex]::Matches($text, "`n")).Count
  $eol = if ($crlf -gt 0 -and ($lfTotal - $crlf) -eq 0) { "`r`n" } else { "`n" }

  $lines = $text -split "`r?`n"
  $matchIndex = -1
  for ($i = 0; $i -lt $lines.Count; $i++) {
    # Apache's appendix line: "   Copyright 2026 <holder>"
    if ($lines[$i] -match '^\s*Copyright\s+(\d{4})\s+\S') { $matchIndex = $i; break }
  }

  if ($matchIndex -lt 0) {
    # Bare Apache-2.0 text with no appendix. Deliberately NOT modified.
    $row.Status = 'no-copyright-line'
    $results += [pscustomobject]$row
    continue
  }

  $from = $lines[$matchIndex]
  $matchedYear = [regex]::Match($from, '^\s*Copyright\s+(\d{4})').Groups[1].Value
  $useYear = if ($Year) { $Year } else { $matchedYear }
  $to = "   Copyright $useYear $Holder"

  $row.LineNo = $matchIndex + 1
  $row.From = $from.Trim()
  $row.To = $to.Trim()

  if ($from -match $OK_PATTERN) {
    $row.Status = 'already-correct'
    $results += [pscustomobject]$row
    continue
  }

  if (-not $Apply) {
    $row.Status = 'WOULD-FIX'
    $results += [pscustomobject]$row
    continue
  }

  $lines[$matchIndex] = $to
  $newText = $lines -join $eol
  $encoding = New-Object System.Text.UTF8Encoding($hasBom)
  [System.IO.File]::WriteAllText($licPath, $newText, $encoding)
  $row.Status = 'FIXED'
  $results += [pscustomobject]$row
}

$table = $results | Sort-Object Status, Repo | Format-Table -AutoSize -Wrap | Out-String -Width 200
Write-Host $table

$counts = $results | Group-Object Status | Sort-Object Name
Write-Host ''
foreach ($c in $counts) { Write-Host ("{0,-20} {1}" -f $c.Name, $c.Count) }
Write-Host ''
if ($Apply) {
  Write-Host "APPLIED to $(($results | Where-Object Status -eq 'FIXED').Count) file(s)."
} else {
  $n = ($results | Where-Object Status -eq 'WOULD-FIX').Count
  Write-Host "DRY RUN - nothing written. $n file(s) would change. Re-run with -Apply."
}
