$ErrorActionPreference = 'Continue'
$env:GH_PAGER = ''
$cli = 'D:\Projects\dsh\plugins\dsh-plugin-doctor\doctor.mjs'
$out = Join-Path $env:TEMP 'author-scan'
New-Item -ItemType Directory -Force -Path $out | Out-Null

# The 12 independent DSH plugin authors from the official showcase channel.
# For each, find the repositories they actually announced and check whether they
# would pass the published criteria - the only way to lead with value rather than
# with a request.
$authors = @('btsd321','LuckVd','tr1v3r','zpzjzj','XiaoBinGan','iscarson','chenhz01','PolinniZhong','huajuan404','MichaelShii','bandianliancha','33Wade333')

$rows = @()
foreach ($a in $authors) {
  $raw = gh api "users/$a/repos?per_page=100&sort=updated" 2>&1 | Out-String
  if ($raw -match 'rate limit|Not Found') { Write-Output "  $a : unavailable"; continue }
  try { $repos = @($raw | ConvertFrom-Json) } catch { continue }
  foreach ($r in $repos) {
    if ($r.fork) { continue }
    # Only repositories that look like DSH plugins.
    $isDsh = ($r.name -match 'dsh') -or ([string]$r.description -match 'DeepSeek Harness|dsh')
    if (-not $isDsh) { continue }
    $rows += [pscustomobject]@{ Author = $a; Repo = $r.full_name; Stars = $r.stargazers_count; Pushed = $r.pushed_at }
  }
  Start-Sleep -Milliseconds 200
}
Write-Output "candidate DSH repositories found: $(@($rows).Count)"
$rows | Sort-Object Author, Repo | ForEach-Object { Write-Output ("  {0,-16} {1,-46} {2,4}*  pushed {3}" -f $_.Author, $_.Repo, $_.Stars, $_.Pushed.Substring(0,10)) }
$json = Join-Path $out 'candidates.json'
[System.IO.File]::WriteAllText($json, (@($rows) | ConvertTo-Json -Depth 3), (New-Object System.Text.UTF8Encoding($false)))
Write-Output "written: $json"
