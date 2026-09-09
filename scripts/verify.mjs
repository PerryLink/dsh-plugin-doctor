// dsh-plugin-doctor verified registry refresher.
// Clones each repo declared in data/verified-repos.json (shallow, read-only),
// runs the static R+K gates with the local doctor, and writes:
//   data/verified.json   — the registry (single source of truth for badges)
//   badges/<owner>__<repo>.svg — one badge per entry
// Evidence discipline: every entry carries the commit, the doctor version and
// commit, the per-status counts, and the CI run URL when available.
//
// Usage:
//   node scripts/verify.mjs                        # all declared repos
//   node scripts/verify.mjs --only-repo PerryLink/dsh-github,dsh-memento
//   node scripts/verify.mjs --limit 3 --keep
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { renderBadge } from './badge.mjs'

const ROOT = path.resolve(import.meta.dirname, '..')
const DOCTOR = path.join(ROOT, 'doctor.mjs')
const GROUPS = 'R,K'
const SCOPE = 'static R+K (no sandbox smoke)'

const argv = process.argv.slice(2)
const flag = (name) => {
  const i = argv.indexOf(name)
  return i >= 0 ? argv[i + 1] : null
}
const onlyRepos = (flag('--only-repo') ?? '').split(',').map((s) => s.trim()).filter(Boolean)
const limit = Number(flag('--limit') ?? 0)
const keep = argv.includes('--keep')

const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'))
const declared = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/verified-repos.json'), 'utf8'))
let repos = declared.repos
if (onlyRepos.length > 0) repos = repos.filter((r) => onlyRepos.includes(r.repo))
if (limit > 0) repos = repos.slice(0, limit)
if (repos.length === 0) {
  console.error('verify: no repos matched')
  process.exit(1)
}

const sh = (cmd, args, cwd) => spawnSync(cmd, args, { cwd, stdio: 'ignore' })
const capture = (cmd, args, cwd) => {
  const r = spawnSync(cmd, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
  return r.status === 0 ? r.stdout.trim() : null
}

const snapshot = new Date().toISOString().slice(0, 10)
const doctorCommit = process.env.GITHUB_SHA ?? capture('git', ['rev-parse', 'HEAD'], ROOT) ?? 'local'
const runUrl = process.env.GITHUB_RUN_ID
  ? `https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
  : null

const work = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-doctor-verify-'))
const entries = []

for (const item of repos) {
  const slug = item.repo.replace('/', '__')
  const dir = path.join(work, slug)
  const entry = {
    repo: item.repo,
    package: item.package ?? null,
    scope: 'R+K',
    result: 'fail',
    checks: 0,
    counts: {},
    doctorVersion: pkg.version,
    doctorCommit,
    snapshot,
    runUrl,
    evidence: '',
  }

  const clone = sh('git', ['clone', '--depth', '1', '--quiet', `https://github.com/${item.repo}.git`, dir])
  if (clone.status !== 0) {
    entry.evidence = `shallow clone failed (exit ${clone.status}) at ${snapshot}`
    entries.push(entry)
    console.log(`FAIL  ${item.repo.padEnd(32)} clone failed`)
    continue
  }
  entry.commit = capture('git', ['rev-parse', 'HEAD'], dir)

  const jsonPath = path.join(work, `${slug}.json`)
  const run = sh(process.execPath, [DOCTOR, '--repo', dir, '--no-smoke', '--only', GROUPS, '--json', jsonPath], ROOT)
  let results = null
  if (fs.existsSync(jsonPath)) {
    try {
      results = JSON.parse(fs.readFileSync(jsonPath, 'utf8')).results
    } catch {
      results = null
    }
  }
  if (!results) {
    entry.evidence = `doctor produced no JSON report (exit ${run.status}) at ${snapshot}`
    entries.push(entry)
    console.log(`FAIL  ${item.repo.padEnd(32)} doctor exit ${run.status}, no report`)
    continue
  }

  const counts = {}
  for (const r of results) counts[r.status] = (counts[r.status] ?? 0) + 1
  const worst = results.some((r) => r.status === 'error')
    ? 'error'
    : results.some((r) => r.status === 'fail')
      ? 'fail'
      : results.some((r) => r.status === 'warn' || r.status === 'skip')
        ? 'warn'
        : 'pass'
  entry.checks = results.length
  entry.counts = counts
  entry.result = worst === 'error' || worst === 'fail' ? 'fail' : worst
  const failures = results.filter((r) => r.status === 'fail' || r.status === 'error').map((r) => r.name)
  const soft = results.filter((r) => r.status === 'warn' || r.status === 'skip').map((r) => `${r.status}:${r.name}`)
  entry.evidence =
    `${entry.result} — dsh-plugin-doctor@${pkg.version} --only ${GROUPS} on ${entry.commit ?? 'unknown'}` +
    ` at ${snapshot}; ${Object.entries(counts).map(([k, n]) => `${k}=${n}`).join(' ')}` +
    (failures.length > 0 ? `; failing: ${failures.slice(0, 5).join(' | ')}` : '') +
    (soft.length > 0 ? `; soft: ${soft.slice(0, 5).join(' | ')}` : '') +
    (runUrl ? `; run ${runUrl}` : '')
  entries.push(entry)
  console.log(`${entry.result.toUpperCase().padEnd(4)}  ${item.repo.padEnd(32)} checks=${entry.checks} ${Object.entries(counts).map(([k, n]) => `${k}=${n}`).join(' ')}`)
}

entries.sort((a, b) => a.repo.localeCompare(b.repo))
const registry = {
  specVersion: 'v1',
  scope: SCOPE,
  doctorVersion: pkg.version,
  doctorCommit,
  generatedAt: new Date().toISOString(),
  entries,
}
fs.mkdirSync(path.join(ROOT, 'data'), { recursive: true })
fs.writeFileSync(path.join(ROOT, 'data', 'verified.json'), JSON.stringify(registry, null, 2) + '\n')

fs.mkdirSync(path.join(ROOT, 'badges'), { recursive: true })
for (const e of entries) {
  fs.writeFileSync(path.join(ROOT, 'badges', `${e.repo.replace('/', '__')}.svg`), renderBadge(e.result))
}

const summary = entries.reduce((acc, e) => ((acc[e.result] = (acc[e.result] ?? 0) + 1), acc), {})
console.log(`\nverified: ${entries.length} repos | ${Object.entries(summary).map(([k, n]) => `${k}=${n}`).join(' ')}`)
console.log(`registry: data/verified.json | badges: badges/*.svg`)
if (!keep) fs.rmSync(work, { recursive: true, force: true })
