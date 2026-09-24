$ErrorActionPreference = 'Continue'
$env:GH_PAGER = ''
$repo = 'alexchenzl/dsh-plugin-directory'

Write-Output "=== state of my 44 submissions (#276-#319) ==="
$open = 0; $closed = 0; $replied = @(); $closedNums = @()
foreach ($n in 276..319) {
  $raw = (gh api "repos/$repo/issues/$n" 2>&1 | Out-String)
  if ($raw -match 'rate limit|Not Found') { continue }
  try { $i = $raw | ConvertFrom-Json } catch { continue }
  if ($i.state -eq 'open') { $open++ } else { $closed++; $closedNums += "$n($($i.state_reason))" }
  $c = (gh api "repos/$repo/issues/$n/comments" 2>&1 | Out-String).Trim()
  if ($c -ne '[]' -and $c -notmatch 'rate limit') { $replied += $n }
  Start-Sleep -Milliseconds 120
}
Write-Output "  open   : $open"
Write-Output "  closed : $closed   $($closedNums -join ', ')"
Write-Output "  with a reply (acceptance signal): $(@($replied).Count)   $($replied -join ', ')"

Write-Output ""
Write-Output "=== has the directory's batch run since 2026-09-08? ==="
$cl = (gh api "repos/$repo/issues?state=closed&labels=plugin-submission&per_page=5&sort=updated&direction=desc" 2>&1 | Out-String)
if ($cl -match 'rate limit') { Write-Output "  rate-limited" } else {
  $arr = @($cl | ConvertFrom-Json)
  $arr | Select-Object -First 5 | ForEach-Object { Write-Output ("  #{0,-6} {1,-12} closed {2}" -f $_.number, $_.state_reason, $_.closed_at) }
}

Write-Output ""
Write-Output "=== cross-check the live site for a newly-accepted package ==="
$ProgressPreference = 'SilentlyContinue'
foreach ($slug in 'perrylink/dsh-plugin-doctor', 'perrylink/dsh-ticktick', 'perrylink/dsh-autotier', 'perrylink/dsh-wechat') {
  try {
    $r = Invoke-WebRequest -Uri "https://dsh.directory/plugins/$slug" -TimeoutSec 25 -UseBasicParsing
    Write-Output "  $slug -> HTTP $($r.StatusCode)"
  } catch { Write-Output "  $slug -> $($_.Exception.Message.Split([char]10)[0])" }
}
