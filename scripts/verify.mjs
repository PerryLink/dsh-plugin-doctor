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
// Env: DOCTOR_AUDIT_TOKEN (preferred) / GITHUB_TOKEN / GH_TOKEN.
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

// Declared before the token check: the fail-fast path builds registry entries
// too, and anything left below it would still be in its temporal dead zone.
const MOJIBAKE = /[\uE000-\uF8FF]|闈|鎵|绱|绛|鍖|浠/
const snapshot = new Date().toISOString().slice(0, 10)
const doctorCommit = process.env.GITHUB_SHA ?? 'local'
const runUrl = process.env.GITHUB_RUN_ID
  ? `https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
  : null

// Reading other repositories' Actions metadata needs a token that can see
// them. Two distinct failures produce an all-grey registry, and they used to be
// reported as one opaque "repo lookup failed":
//
//   401 -> DOCTOR_AUDIT_TOKEN is set but invalid/expired.
//   403 rate limit exceeded -> no usable DOCTOR_AUDIT_TOKEN at all, and the
//          fallback GITHUB_TOKEN is an *installation* token whose API
//          permissions do not include other repositories, so it is treated as
//          an anonymous caller and gets 60 requests/hour. Auditing 37 repos
//          needs well over 200, so the run always dies partway.
//
// Falling back to GITHUB_TOKEN therefore cannot work, and only converts a clear
// configuration error into a partial, confusing one. Require the real token.
//
// A stray BOM would make fetch throw, so strip it defensively.
const token = (process.env.DOCTOR_AUDIT_TOKEN ?? '').replace(/^\uFEFF/, '').trim()
const allowAnon = argv.includes('--allow-anonymous') || process.env.DOCTOR_ALLOW_ANONYMOUS === '1'

if (!token) {
  const msg = [
    'verify: DOCTOR_AUDIT_TOKEN is not set.',
    '',
    'Auditing the declared repos reads their Actions metadata through the GitHub API.',
    'The workflow-scoped GITHUB_TOKEN cannot do this: it holds no cross-repository',
    'read permission, so GitHub treats it as anonymous (60 requests/hour) while a',
    'full audit needs 200+. Every entry would come back no-data with',
    '"403 rate limit exceeded", which looks like a broken badge program rather than',
    'a missing secret.',
    '',
    'Fix: create a fine-grained PAT with read access to the declared repositories',
    'and store it as the DOCTOR_AUDIT_TOKEN repository secret.',
    '',
    'To run the audit locally against your own rate limit instead, pass',
    '--allow-anonymous (or set DOCTOR_ALLOW_ANONYMOUS=1). Expect 403s partway.',
  ].join('\n')

  if (!allowAnon) {
    console.error(msg)
    process.exitCode = 3
    // Emit the honest grey registry rather than leaving a stale file behind,
    // but leave every reason naming the real cause.
    writeFailureRegistry('DOCTOR_AUDIT_TOKEN is not set — nothing was verified')
    process.exit(3)
  }
  console.warn(msg)
  console.warn('')
  console.warn('Continuing anonymously because --allow-anonymous was requested.')
  console.warn('')
}

const declared = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/verified-repos.json'), 'utf8'))
let repos = declared.repos
if (onlyRepos.length > 0) repos = repos.filter((r) => onlyRepos.includes(r.repo))
if (limit > 0) repos = repos.slice(0, limit)
if (repos.length === 0) {
  console.error('verify: no repos matched')
  process.exit(1)
}

/**
 * 本脚本只读 GitHub REST 的四个端点（repos / commits / contents / workflow runs），
 * 这里把实际读取的字段逐一声明。`fetch().json()` 在 @types/node 24 下是 `unknown`，
 * 缺这份声明时四处读取都会被判「属性不存在」。
 *
 * @typedef {{
 *   default_branch?: string,
 *   sha?: string,
 *   content?: string,
 *   workflow_runs?: Array<{ head_sha?: string, id?: number, status?: string, conclusion?: string, created_at?: string }>,
 * }} GitHubPayload
 */

/**
 * @param {string} pathname
 * @returns {Promise<{ error?: string, status?: number, data?: GitHubPayload }>}
 */
async function api(pathname) {
  const res = await fetch(`${API}${pathname}`, {
    headers: {
      accept: 'application/vnd.github+json',
      'x-github-api-version': '2022-11-28',
      'user-agent': 'dsh-plugin-doctor-verified',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
  })
  if (!res.ok) {
    // The status is carried separately so the caller can tell an exhausted rate
    // limit (403) or a dead token (401) from a genuinely missing repository —
    // the first two are configuration faults that just cost the whole run.
    const remaining = res.headers.get('x-ratelimit-remaining')
    const suffix = remaining === '0' ? ' (x-ratelimit-remaining: 0)' : ''
    return { error: `${res.status} ${res.statusText}${suffix}`, status: res.status }
  }
  return { data: await res.json() }
}

/**
 * A configuration fault that makes every remaining lookup pointless: an
 * exhausted quota (403) or an invalid token (401). Continuing would burn the
 * rest of the run and bury one cause under N identical reasons.
 * @param {{ error?: string, status?: number }} res
 */
const isFatalApiFault = (res) => res.status === 401 || (res.status === 403 && /rate limit/i.test(res.error ?? ''))

/**
 * Build the registry object and write it, together with one badge per entry.
 * A single writer keeps the fail-fast path and the normal path from drifting.
 * @param {Array<Record<string, unknown>>} entryList
 */
function writeRegistry(entryList) {
  const registry = {
    specVersion: 'v1',
    scope: SCOPE,
    meaning:
      'The declared repo runs the dsh-plugin-doctor static R+K gate (16 gated checks: R0/R1/R3/R5/R6/R7/R8 + K1-K9) in its own CI and that gate is green on the current default-branch HEAD. R2/R4 read built artifacts and are gated by the repo\'s own ci.yml. '
      + 'SCOPE: static R+K only — this is NOT a certification badge (no Scorecard, no provenance, no install/runtime smoke), and it is not a statement that the plugin is safe. '
      + 'Verification reads the GitHub API only; no third-party code is cloned or executed.',
    doctorVersion: JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version,
    doctorCommit,
    generatedAt: new Date().toISOString(),
    entries: entryList,
  }
  fs.writeFileSync(path.join(ROOT, 'data', 'verified.json'), JSON.stringify(registry, null, 2) + '\n')

  fs.mkdirSync(path.join(ROOT, 'badges'), { recursive: true })
  for (const e of entryList) {
    const repo = /** @type {{ repo: string, result: string }} */ (e).repo
    const result = /** @type {{ repo: string, result: string }} */ (e).result
    fs.writeFileSync(path.join(ROOT, 'badges', `${repo.replace('/', '__')}.svg`), renderBadge(result))
  }
}

/** Write an all-grey registry whose every reason names the real cause. */
function writeFailureRegistry(cause) {
  const declared = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/verified-repos.json'), 'utf8'))
  const stale = readExistingEntries()
  writeRegistry(
    declared.repos.map((/** @type {{repo: string, package?: string}} */ r) => ({
      ...(stale.get(r.repo) ?? {}),
      repo: r.repo,
      package: r.package ?? null,
      scope: 'R+K',
      result: 'no-data',
      reason: cause,
      evidence: `${cause}; nothing was verified, so this entry carries no verdict`,
    })),
  )
}

/** Best-effort read of the previous registry, so a failed run keeps the last known head/sha. */
function readExistingEntries() {
  try {
    const prev = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'verified.json'), 'utf8'))
    return new Map((prev.entries ?? []).map((/** @type {{repo: string}} */ e) => [e.repo, e]))
  } catch {
    return new Map()
  }
}

const firstReason = () => entries.find((e) => e.reason)?.reason ?? 'unknown'

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
    // One exhausted quota or dead token makes every remaining lookup pointless;
    // stop at the first one instead of burning the rest of the run and
    // reporting the same cause 37 times.
    if (isFatalApiFault(repoInfo)) {
      const cause = repoInfo.status === 401
        ? `DOCTOR_AUDIT_TOKEN was rejected (401 ${repoInfo.error}) — the PAT is invalid, expired or revoked`
        : `GitHub API quota exhausted (${repoInfo.error}) — DOCTOR_AUDIT_TOKEN is missing or has no cross-repository read access, so this run fell back to the anonymous 60 requests/hour limit`
      entries.push({ ...entry, reason: cause, evidence: `${cause} at ${snapshot}` })
      console.error(`verify: ${cause}`)
      console.error(`verify: stopped after ${entries.length} of ${repos.length} declared repos — nothing was verified.`)
      console.error('verify: fix DOCTOR_AUDIT_TOKEN, then re-run. See the comment at its use in this file for why GITHUB_TOKEN cannot stand in.')
      writeRegistry(entries)
      process.exit(1)
    }
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
    const chinese = text.includes('静态·包结构')
    const aliasForm = /--only\s+"?R,K"?/.test(text)
    const escapedForm = /DOCTOR_ONLY/.test(text)
    if (MOJIBAKE.test(text)) gateProblems.push('gate args are double-encoded mojibake')
    else if (!aliasForm && !escapedForm && !chinese) gateProblems.push('no recognized --only gate args')
    const form = aliasForm ? 'ascii-alias' : escapedForm ? 'ascii-escaped' : 'chinese-names'
    entry.gate = entry.guard ? `${form} + self-check` : form
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
writeRegistry(entries)

const summary = entries.reduce((acc, e) => ((acc[e.result] = (acc[e.result] ?? 0) + 1), acc), {})
console.log(`\nverified: ${entries.length} repos | ${Object.entries(summary).map(([k, n]) => `${k}=${n}`).join(' ')}`)
console.log('registry: data/verified.json | badges: badges/*.svg')

// Never let a broken token or an exhausted rate limit look like a normal run:
// the registry and badges are still written (grey = "cannot verify", honest),
// but the workflow fails loudly so it gets noticed.
const allNoData = entries.length > 0 && entries.every((e) => e.result === 'no-data')
if (allNoData) {
  console.error(
    `::error::every declared repo failed verification (${entries.length}/${entries.length} no-data) — ` +
      `first reason: ${firstReason()}. Fix DOCTOR_AUDIT_TOKEN; see scripts/verify.mjs for why ` +
      `GITHUB_TOKEN cannot stand in for it.`,
  )
  process.exitCode = 1
}
