$ErrorActionPreference = 'Continue'
$env:GH_PAGER = ''
$cli = 'D:\Projects\dsh\plugins\dsh-plugin-doctor\doctor.mjs'
$out = Join-Path $env:TEMP 'author-scan'
New-Item -ItemType Directory -Force -Path $out | Out-Null
$authors = @('btsd321','LuckVd','tr1v3r','zpzjzj','XiaoBinGan','iscarson','chenhz01','PolinniZhong','huajuan404','MichaelShii','bandianliancha','33Wade333')

$all = @()
foreach ($a in $authors) {
  $f = Join-Path $out "repos-$a.json"
  $o = Join-Path $env:TEMP 'r1.txt'; $e = Join-Path $env:TEMP 'r2.txt'
  $null = New-Item -ItemType File -Force -Path $o, $e
  $p = Start-Process -FilePath 'gh' -PassThru -Wait -NoNewWindow -RedirectStandardOutput $o -RedirectStandardError $e `
    -ArgumentList ('api "users/{0}/repos?per_page=100&sort=updated"' -f $a)
  if ($p.ExitCode -ne 0) { Write-Output "  $a : api failed"; continue }
  $txt = [System.IO.File]::ReadAllText($o)
  [System.IO.File]::WriteAllText($f, $txt, (New-Object System.Text.UTF8Encoding($false)))
  $j = $txt | ConvertFrom-Json
  $list = @()
  foreach ($x in $j) { $list += $x }
  Write-Output ("  {0,-16} repos={1,-4} DSH-ish={2}" -f $a, $list.Count, (@($list | Where-Object { $_.name -match 'dsh' }).Count))
  foreach ($x in $list) {
    if ($x.fork) { continue }
    if ($x.name -notmatch 'dsh' -and ([string]$x.description -notmatch 'DeepSeek Harness')) { continue }
    $all += [pscustomobject]@{ Author = $a; Repo = $x.full_name; Stars = $x.stargazers_count; Pushed = $x.pushed_at; Desc = [string]$x.description }
  }
  Start-Sleep -Milliseconds 250
}

Write-Output ""
Write-Output "=== candidate DSH repositories: $(@($all).Count) ==="
@($all) | Sort-Object Author, Repo | ForEach-Object {
  Write-Output ("  {0,-16} {1,-44} {2,4}*  {3}" -f $_.Author, $_.Repo, $_.Stars, $_.Pushed.Substring(0,10))
}
[System.IO.File]::WriteAllText((Join-Path $out 'candidates.json'), (@($all) | ConvertTo-Json -Depth 4), (New-Object System.Text.UTF8Encoding($false)))
Write-Output ""
Write-Output "written: $(Join-Path $out 'candidates.json')"
