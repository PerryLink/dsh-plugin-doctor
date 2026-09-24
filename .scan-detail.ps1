$ErrorActionPreference = 'Continue'
$out = Join-Path $env:TEMP 'author-scan'
$cloneRoot = Join-Path $env:TEMP 'doctor-scan'
$cli = 'D:\Projects\dsh\plugins\dsh-plugin-doctor\doctor.mjs'

# Re-run the four failures with the CURRENT published version, and print the actual
# detail lines - a check id alone is not a finding anyone can act on.
foreach ($r in 'LuckVd__dsh-taskflow', 'tr1v3r__dsh-ltm', 'tr1v3r__dsh-jev', 'chenhz01__dsh-sample-plugin') {
  $dir = Join-Path $cloneRoot $r
  if (-not (Test-Path $dir)) { Write-Output "  $r : not cloned"; continue }
  Write-Output "=================== $($r.Replace('__','/')) ==================="
  $o = Join-Path $env:TEMP 'f1.txt'; $e = Join-Path $env:TEMP 'f2.txt'
  $null = New-Item -ItemType File -Force -Path $o, $e
  $p = Start-Process -FilePath 'node' -PassThru -Wait -NoNewWindow -WorkingDirectory $dir `
    -RedirectStandardOutput $o -RedirectStandardError $e `
    -ArgumentList @($cli, '--repo', $dir, '--no-smoke', '--only', 'R,K')
  $t = [System.IO.File]::ReadAllText($o)
  ($t -split "`n") | Where-Object { $_ -match '^\[FAIL\]|^\[WARN\]' -or $_ -match '^\s{4}\S' } | Select-Object -First 22 | ForEach-Object { Write-Output "  $($_.TrimEnd())" }
  Write-Output "  exit=$($p.ExitCode)"
  Write-Output ""
}
