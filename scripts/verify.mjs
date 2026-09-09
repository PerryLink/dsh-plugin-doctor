// dsh-plugin-doctor verified registry refresher.
//
// The badge states one auditable fact: the declared repo runs the
// dsh-plugin-doctor static R+K gate in its own CI, and that gate is green on
// the current default-branch HEAD. Verification reads the GitHub API only —
// this workflow never clones, installs or executes third-party code.
//
// Usage:
//   node scripts/verify.mjs
//   node scripts/verify.mjs --only-repo PerryLink/dsh-github,dsh-memento
//   node scripts/verify.mjs --limit 3
// Env: GITHUB_TOKEN or GH_TOKEN (optional but strongly recommended).
import fs from 'node:fs'
import path from 'node:path'
import { renderBadge } from './badge.mjs'

const ROOT = path.resolve(import.meta.dirname, '..')
const API = 'https://api.github.com'
const SCOPE = 'static R+K (the repo\'s own plugin-doctor CI gate)'
const WORKFLOW_PATH = '.github/workflows/plugin-doctor.yml'

const argv = process.argv.slice(2)
const flag = (name) => {
  const i = argv.indexOf(name)
  return i >= 0 && argv[i + 1] !== undefined ? argv[i + 1] : null
}
const onlyRepos = (flag('--only-repo') ?? '').split(',').map((s) => s.trim()).filter(Boolean)
const limit = Number(flag('--limit') ?? 0)

const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || ''
const declared = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/verified-repos.json'), 'utf8'))
let repos = declared.repos
if (onlyRepos.length > 0) repos = repos.filter((r) => onlyRepos.includes(r.repo))
if (limit > 0) repos = repos.slice(0, limit)
if (repos.length === 0) {
  console.error('verify: no repos matched')
  process.exit(1)
}

async function api(pathname) {
  const res = await fetch(`${API}${pathname}`, {
    headers: {
      accept: 'application/vnd.github+json',
      'x-github-api-version': '2022-11-28',
      'user-agent': 'dsh-plugin-doctor-verified',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
  })
  if (!res.ok) return { error: `${res.status} ${res.statusText}` }
  return { data: await res.json() }
}

const MOJIBAKE = /[\uE000-\uF8FF]|闈|鎵|绱|绛|鍖|浠/
const snapshot = new Date().toISOString().slice(0, 10)
const doctorCommit = process.env.GITHUB_SHA ?? 'local'
const runUrl = process.env.GITHUB_RUN_ID
  ? `https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
  : null

const entries = []
for (const item of repos) {
  const entry = {
    repo: item.repo,
    package: item.package ?? null,
    scope: 'R+K',
    result: 'no-data',
    reason: '',
    defaultBranch: null,
    headSha: null,
    gate: null,
    doctorPinned: null,
    guard: false,
    runId: null,
    runConclusion: null,
    runCreatedAt: null,
    snapshot,
    runUrl,
    evidence: '',
  }

  const repoInfo = await api(`/repos/${item.repo}`)
  if (repoInfo.error) {
    entry.reason = `repo lookup failed: ${repoInfo.error}`
    entry.evidence = `${entry.reason} at ${snapshot}`
    entries.push(entry)
    console.log(`NODATA ${item.repo.padEnd(32)} ${entry.reason}`)
    continue
  }
  const branch = repoInfo.data.default_branch
  entry.defaultBranch = branch

  const head = await api(`/repos/${item.repo}/commits/${branch}`)
  if (head.error) {
    entry.reason = `head lookup failed: ${head.error}`
    entry.evidence = `${entry.reason} at ${snapshot}`
    entries.push(entry)
    console.log(`NODATA ${item.repo.padEnd(32)} ${entry.reason}`)
    continue
  }
  entry.headSha = head.data.sha

  // Gate configuration at HEAD: pinned doctor version + a valid --only form.
  const file = await api(`/repos/${item.repo}/contents/${WORKFLOW_PATH}?ref=${entry.headSha}`)
  let gateProblems = []
  if (file.error) {
    gateProblems.push(`workflow file missing (${file.error})`)
  } else {
    const text = Buffer.from(file.data.content ?? '', 'base64').toString('utf8')
    const pin = text.match(/@perrylink\/dsh-plugin-doctor@([\d.]+)/)
    if (!pin) gateProblems.push('no pinned @perrylink/dsh-plugin-doctor version')
    else entry.doctorPinned = pin[1]
    entry.guard = /grep -q 'R0 '/.test(text)
    const asciiAlias = /--only\s+"R,K"/.test(text) || /DOCTOR_ONLY/.test(text)
    const chinese = text.includes('静态·包结构')
    if (MOJIBAKE.test(text)) gateProblems.push('gate args are double-encoded mojibake')
    else if (!asciiAlias && !chinese) gateProblems.push('no recognized --only gate args')
    entry.gate = asciiAlias ? (entry.guard ? 'ascii-escaped + self-check' : 'ascii-escaped') : 'chinese-names'
  }

  if (gateProblems.length > 0) {
    entry.result = 'fail'
    entry.reason = `gate-not-real: ${gateProblems.join('; ')}`
  } else {
    const runs = await api(`/repos/${item.repo}/actions/workflows/${path.basename(WORKFLOW_PATH)}/runs?branch=${branch}&per_page=20`)
    if (runs.error) {
      entry.reason = `runs lookup failed: ${runs.error}`
    } else {
      const hit = (runs.data.workflow_runs ?? []).find((r) => r.head_sha === entry.headSha)
      if (!hit) {
        entry.result = 'warn'
        entry.reason = 'no plugin-doctor run on the current HEAD yet'
      } else {
        entry.runId = hit.id
        entry.runConclusion = hit.conclusion
        entry.runCreatedAt = hit.created_at
        if (hit.status !== 'completed') {
          entry.result = 'warn'
          entry.reason = `run on HEAD is ${hit.status}`
        } else if (hit.conclusion === 'success') {
          entry.result = 'pass'
          entry.reason = 'gate green on HEAD'
        } else {
          entry.result = 'fail'
          entry.reason = `run on HEAD concluded ${hit.conclusion}`
        }
      }
    }
  }

  entry.evidence =
    `${entry.result} — ${entry.reason}; gate=${entry.gate ?? 'invalid'} doctorPinned=${entry.doctorPinned ?? '?'}` +
    ` guard=${entry.guard} on ${entry.defaultBranch}@${(entry.headSha ?? '').slice(0, 10)}` +
    (entry.runId ? `; run https://github.com/${item.repo}/actions/runs/${entry.runId} (${entry.runConclusion})` : '') +
    `; checked ${snapshot}`
  entries.push(entry)
  console.log(`${entry.result.toUpperCase().padEnd(6)} ${item.repo.padEnd(32)} ${entry.reason}`)
}

entries.sort((a, b) => a.repo.localeCompare(b.repo))
const registry = {
  specVersion: 'v1',
  scope: SCOPE,
  meaning:
    'The declared repo runs the dsh-plugin-doctor static R+K gate in its own CI and that gate is green on the current default-branch HEAD. Verification reads the GitHub API only; no third-party code is cloned or executed.',
  doctorVersion: JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version,
  doctorCommit,
  generatedAt: new Date().toISOString(),
  entries,
}
fs.writeFileSync(path.join(ROOT, 'data', 'verified.json'), JSON.stringify(registry, null, 2) + '\n')

fs.mkdirSync(path.join(ROOT, 'badges'), { recursive: true })
for (const e of entries) {
  fs.writeFileSync(path.join(ROOT, 'badges', `${e.repo.replace('/', '__')}.svg`), renderBadge(e.result))
}

const summary = entries.reduce((acc, e) => ((acc[e.result] = (acc[e.result] ?? 0) + 1), acc), {})
console.log(`\nverified: ${entries.length} repos | ${Object.entries(summary).map(([k, n]) => `${k}=${n}`).join(' ')}`)
console.log('registry: data/verified.json | badges: badges/*.svg')
