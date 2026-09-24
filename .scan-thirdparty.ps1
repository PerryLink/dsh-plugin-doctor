$ErrorActionPreference = 'Continue'
$cli = 'D:\Projects\dsh\plugins\dsh-plugin-doctor\doctor.mjs'
$out = Join-Path $env:TEMP 'author-scan'
$cloneRoot = Join-Path $env:TEMP 'doctor-scan'
New-Item -ItemType Directory -Force -Path $out, $cloneRoot | Out-Null

$cands = [System.IO.File]::ReadAllText((Join-Path $out 'candidates.json')) | ConvertFrom-Json
$list = @(); foreach ($c in $cands) { $list += $c }
Write-Output "scanning $(@($list).Count) third-party DSH repositories"
Write-Output ""

$rows = @()
foreach ($c in $list) {
  $slug = $c.Repo
  $dirName = $slug.Replace('/', '__')
  $dir = Join-Path $cloneRoot $dirName
  # One directory per repository, never reused: a reused extraction directory lets
  # one repo's files leak into the next and corrupts the result.
  if (Test-Path $dir) { Remove-Item $dir -Recurse -Force -ErrorAction SilentlyContinue }

  $o = Join-Path $env:TEMP 'c1.txt'; $e = Join-Path $env:TEMP 'c2.txt'
  $null = New-Item -ItemType File -Force -Path $o, $e
  $p = Start-Process -FilePath 'git' -PassThru -Wait -NoNewWindow -WorkingDirectory $cloneRoot `
    -RedirectStandardOutput $o -RedirectStandardError $e `
    -ArgumentList ('clone --depth 1 --quiet "https://github.com/{0}.git" "{1}"' -f $slug, $dirName)
  if ($p.ExitCode -ne 0) {
    $rows += [pscustomobject]@{ Repo = $slug; Stars = $c.Stars; Status = 'clone-failed'; Detail = (([System.IO.File]::ReadAllText($e)) -split "`n" | Where-Object { $_ })[0] }
    Write-Output ("  {0,-42} clone failed" -f $slug)
    continue
  }

  $jf = Join-Path $out "$dirName.json"
  if (Test-Path $jf) { Remove-Item $jf -Force }
  $null = New-Item -ItemType File -Force -Path $o, $e
  $d = Start-Process -FilePath 'node' -PassThru -Wait -NoNewWindow -WorkingDirectory $dir `
    -RedirectStandardOutput $o -RedirectStandardError $e `
    -ArgumentList @($cli, '--repo', $dir, '--no-smoke', '--only', 'R,K', '--json', $jf)

  $gated = 0; $badIds = ''; $status = 'unknown'
  if (Test-Path $jf) {
    try {
      $rep = [System.IO.File]::ReadAllText($jf) | ConvertFrom-Json
      $g = @($rep.results | Where-Object { $_.name -notmatch '^R[24] ' })
      $gated = $g.Count
      $b = @($g | Where-Object { $_.status -eq 'fail' -or $_.status -eq 'error' })
      $badIds = ($b | ForEach-Object { $_.id }) -join ','
      $status = if ($b.Count) { 'FAIL' } else { 'ok' }
    } catch { $status = 'parse-fail' }
  } else { $status = 'no-report' }

  $rows += [pscustomobject]@{ Repo = $slug; Stars = $c.Stars; Status = $status; Gated = $gated; Failing = $badIds; Exit = $d.ExitCode }
  Write-Output ("  {0,-42} {1,4}*  {2,-6} gated={3,-3} failing=[{4}]" -f $slug, $c.Stars, $status, $gated, $badIds)
}

[System.IO.File]::WriteAllText((Join-Path $out 'results.json'), (@($rows) | ConvertTo-Json -Depth 4), (New-Object System.Text.UTF8Encoding($false)))
Write-Output ""
Write-Output "=== summary ==="
$rows | Group-Object Status | Sort-Object Count -Descending | ForEach-Object { Write-Output ("  {0,-14} x{1}" -f $_.Name, $_.Count) }
