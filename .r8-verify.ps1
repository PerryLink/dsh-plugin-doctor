$ErrorActionPreference = 'Continue'
$cli = 'D:\Projects\dsh\plugins\dsh-plugin-doctor\doctor.mjs'
$root = 'D:\Projects\dsh\plugins'
$out = Join-Path $env:TEMP 'r8-verify'
New-Item -ItemType Directory -Force -Path $out | Out-Null
$null = New-Item -ItemType File -Force -Path (Join-Path $out 'o.txt'), (Join-Path $out 'e.txt')

$dirs = @()
# the family fleet
foreach ($d in Get-ChildItem $root -Directory) {
  if (-not (Test-Path (Join-Path $d.FullName '.git'))) { continue }
  if (Test-Path (Join-Path $d.FullName '.github\workflows\plugin-doctor.yml')) { $dirs += @{ Name = "family/$($d.Name)"; Path = $d.FullName } }
}
# the third-party sample
foreach ($d in Get-ChildItem (Join-Path $env:TEMP 'doctor-scan') -Directory) {
  if (Test-Path (Join-Path $d.FullName 'package.json')) { $dirs += @{ Name = "third/$($d.Name.Replace('__','/'))"; Path = $d.FullName } }
}

Write-Output "verifying the refined R8 against $(@($dirs).Count) repositories"
Write-Output ""
$rows = @()
foreach ($t in $dirs) {
  $jf = Join-Path $out (($t.Name -replace '[/\\]', '_') + '.json')
  if (Test-Path $jf) { Remove-Item $jf -Force }
  $p = Start-Process -FilePath 'node' -PassThru -Wait -NoNewWindow -WorkingDirectory $t.Path `
    -RedirectStandardOutput (Join-Path $out 'o.txt') -RedirectStandardError (Join-Path $out 'e.txt') `
    -ArgumentList @($cli, '--repo', $t.Path, '--no-smoke', '--only', 'R,K', '--json', $jf)
  $bad = ''; $r8 = '-'; $cat = ''
  if (Test-Path $jf) {
    try {
      $rep = [System.IO.File]::ReadAllText($jf) | ConvertFrom-Json
      $g = @($rep.results | Where-Object { $_.name -notmatch '^R[24] ' })
      $bad = (@($g | Where-Object { $_.status -eq 'fail' -or $_.status -eq 'error' }) | ForEach-Object { $_.id }) -join ','
      $x = @($g | Where-Object { $_.id -eq 'R8' })
      if ($x) { $r8 = $x[0].status; $cat = [string]$x[0].category }
    } catch { $bad = 'parse' }
  }
  $rows += [pscustomobject]@{ Repo = $t.Name; Exit = $p.ExitCode; Failing = $bad; R8 = $r8; R8Cat = $cat }
}

Write-Output "=== any gated failure? ==="
$f = @($rows | Where-Object { $_.Exit -ne 0 -or $_.Failing })
if (-not $f) { Write-Output "  NONE - no repository became red" } else { $f | ForEach-Object { Write-Output ("  {0,-46} exit={1} failing=[{2}]" -f $_.Repo, $_.Exit, $_.Failing) } }

Write-Output ""
Write-Output "=== R8 verdict distribution ==="
$rows | Group-Object R8 | Sort-Object Count -Descending | ForEach-Object { Write-Output ("  {0,-8} x{1}" -f $_.Name, $_.Count) }

Write-Output ""
Write-Output "=== repos where R8 now warns (the new signal) ==="
@($rows | Where-Object { $_.R8 -eq 'warn' }) | Sort-Object Repo | ForEach-Object { Write-Output ("  {0,-46} category={1}" -f $_.Repo, $_.R8Cat) }
