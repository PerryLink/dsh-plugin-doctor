#!/usr/bin/env node
/**
 * Release-health check: what the registry actually carries, versus what this checkout says.
 *
 * This exists because of a measured pattern across the 2026-10-05 family release - job
 * colour does not carry the truth:
 *   - 36 packages published green while their CHANGELOG carried "- undefined" as the
 *     release date (the stamper interpolated an unset field).
 *   - dsh-local-ai@0.2.16 and dsh-permission-rules@0.7.12 PUBLISHED SUCCESSFULLY and still
 *     ended with a red workflow run (E409 after a tag re-push; a GitHub-Release step with
 *     no tag ref).
 *   - dsh-plugin-kit failed with ENEEDAUTH because npm's trusted-publisher binding named
 *     the workflow file that used to perform the OIDC exchange, not the one that does now.
 *   - @perrylink/dsh-skill-pack-security-provider never contacted npm at all: its
 *     pre-publish verify gate failed first, so publish-provider was skipped.
 *   - Nine repos mirror the version in src/version.ts, one in src/probe.ts, one in a
 *     VERSION file, and one in sixteen SKILL.md frontmatter blocks - each with a test that
 *     fails on drift.
 *
 * It answers four questions per repository, offline-first:
 *   1. LOCKSTEP   - does every version carrier agree with package.json? (no network)
 *   2. PUBLISHED  - is the local version actually on the registry?
 *   3. PROVENANCE - which workflow file published it, and is that a current publish file?
 *   4. FILES      - does the published tarball still carry src/ (or lib/)?
 *
 * Usage:
 *   node scripts/check-release-health.mjs [--repo <path>]... [--workspace <dir>]
 *                                         [--json <out>] [--no-registry] [--quiet]
 *
 * Exit codes:
 *   0  every checked repository is healthy
 *   1  at least one problem (stale carrier, unpublished version, provenance mismatch,
 *      or a tarball with no source)
 *   2  usage error, or nothing to check
 *
 * --no-registry skips every network probe and runs only LOCKSTEP. That is what per-repo CI
 * should use: a downstream repository must never be reddened by the registry being slow.
 *
 * NOTE ON STYLE: this file deliberately uses NO template literals. A Windows console
 * mangles backticks in anything printed through it, which made failures here unreadable
 * (a real parse error surfaced as a single quote). Plain concatenation keeps every
 * diagnostic byte-exact on every platform.
 */
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'

const argv = process.argv.slice(2)
const has = (name) => argv.includes(name)
const valuesOf = (name) => {
  const out = []
  for (let i = 0; i < argv.length; i++) if (argv[i] === name && argv[i + 1]) out.push(argv[i + 1])
  return out
}
const QUIET = has('--quiet')
const NO_REGISTRY = has('--no-registry')
const JSON_OUT = valuesOf('--json')[0] ?? null

/** Files that legitimately name other versions; never treated as carriers. */
const NOT_A_CARRIER = new Set(['CHANGELOG.md', 'pnpm-lock.yaml', 'package-lock.json', 'yarn.lock'])
/** Build output, dependencies and archives. */
const SKIP_DIR = /(^|\/)(node_modules|\.git|dist|coverage|\.family-stage|_archive|_scratch|vendor|downloads|pack)(\/|$)/
/** Text files worth scanning for a version literal. */
const SCANNABLE = /\.(ts|tsx|mts|cts|mjs|cjs|js|jsx|json|ya?ml|md|txt|toml)$/i
/** Locations whose drift is load-bearing: the repo's own tests assert these. */
const LOAD_BEARING = [/^VERSION$/, /(^|\/)version\.(ts|js|mjs|cjs)$/, /(^|\/)probe\.ts$/, /(^|\/)SKILL\.md$/]

const registryUrl = (pkgName) => 'https://registry.npmjs.org/' + String(pkgName).replace('/', '%2f')
const esc = (v) => String(v).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
/** Matches the version only when not part of a longer dotted number. */
const versionRe = (v) => new RegExp('(?<![\\d.])' + esc(v) + '(?![\\d.])')

function readJson(p) {
  try { return JSON.parse(readFileSync(p, 'utf8')) } catch { return null }
}

function findVersionCarriers(repoDir, version) {
  const hits = []
  const re = versionRe(version)
  const walk = (dir, depth) => {
    if (depth > 5) return
    let entries
    try { entries = readdirSync(dir, { withFileTypes: true }) } catch { return }
    for (const e of entries) {
      const p = path.join(dir, e.name)
      const rel = path.relative(repoDir, p).split(path.sep).join('/')
      if (SKIP_DIR.test(rel)) continue
      if (e.isDirectory()) { walk(p, depth + 1); continue }
      if (NOT_A_CARRIER.has(e.name) || !SCANNABLE.test(e.name)) continue
      let text
      try {
        if (statSync(p).size > 2000000) continue
        text = readFileSync(p, 'utf8')
      } catch { continue }
      if (re.test(text)) hits.push(rel)
    }
  }
  walk(repoDir, 0)
  return hits
}

/** The workflow files that publish, and whether each is set up for trusted publishing. */
function publishingWorkflows(repoDir) {
  const dir = path.join(repoDir, '.github', 'workflows')
  if (!existsSync(dir)) return []
  const out = []
  for (const f of readdirSync(dir)) {
    if (!/\.ya?ml$/i.test(f)) continue
    const text = readFileSync(path.join(dir, f), 'utf8')
    if (!/npm publish|pnpm publish/.test(text)) continue
    out.push({
      file: f,
      oidc: /id-token:\s*write/.test(text),
      registryUrl: /^\s*registry-url:/m.test(text),
      readsToken: /secrets\.NPM_TOKEN/.test(text),
      tag: /tags:\s*\['?v/.test(text),
    })
  }
  return out
}

async function getJson(url) {
  const res = await fetch(url, { headers: { accept: 'application/json' } })
  if (!res.ok) return { status: res.status, body: null }
  try { return { status: res.status, body: await res.json() } } catch { return { status: res.status, body: null } }
}

/** Which workflow file produced a published version, read from its provenance bundle. */
async function publishedByWorkflow(pkgName, version) {
  const got = await getJson(registryUrl(pkgName) + '/' + version)
  if (got.status !== 200 || !got.body) return { ok: false, why: 'registry HTTP ' + got.status }
  const url = got.body.dist && got.body.dist.attestations && got.body.dist.attestations.url
  if (!url) return { ok: true, workflow: null, why: 'no provenance attestation (token or CLI publish)' }
  const att = await getJson(url)
  if (!att.body) return { ok: true, workflow: null, why: 'attestation unreadable' }
  const slsa = (att.body.attestations ?? []).find((a) => /provenance/.test(a.predicateType ?? ''))
  const payload = slsa && slsa.bundle && slsa.bundle.dsseEnvelope && slsa.bundle.dsseEnvelope.payload
  if (!payload) return { ok: true, workflow: null, why: 'no SLSA predicate in the bundle' }
  try {
    const pj = JSON.parse(Buffer.from(payload, 'base64').toString('utf8'))
    const w = pj.predicate && pj.predicate.buildDefinition &&
      pj.predicate.buildDefinition.externalParameters &&
      pj.predicate.buildDefinition.externalParameters.workflow
    return { ok: true, workflow: w ? w.repository + '::' + w.path : null, why: w ? '' : 'workflow not recorded' }
  } catch {
    return { ok: true, workflow: null, why: 'predicate unparsable' }
  }
}

/** Skill frontmatter files whose version: must equal the package version. */
function skillFiles(repoDir) {
  const out = []
  for (const root of ['skills', 'skills-en']) {
    const base = path.join(repoDir, root)
    if (!existsSync(base)) continue
    for (const name of readdirSync(base)) {
      const f = path.join(base, name, 'SKILL.md')
      if (existsSync(f)) out.push({ rel: path.relative(repoDir, f).split(path.sep).join('/'), abs: f })
    }
  }
  return out
}

async function checkRepo(repoDir) {
  const pkgPath = path.join(repoDir, 'package.json')
  if (!existsSync(pkgPath)) return null

  // Monorepo layout: some repos are a shell whose published artifact lives one level down
  // (dsh-skill-pack-security publishes `provider/package.json`, while the root package is
  // never published). Prefer the nested package when it carries both a name and a version,
  // and say so, so a reader is never misled about which artifact is being described.
  const providerPath = path.join(repoDir, 'provider', 'package.json')
  let artifactDir = repoDir
  let layout = 'root'
  if (existsSync(providerPath)) {
    const nested = readJson(providerPath)
    if (nested && nested.name && nested.version) { artifactDir = path.join(repoDir, 'provider'); layout = 'provider/' }
  }
  const pkg = readJson(path.join(artifactDir, 'package.json'))
  if (!pkg || !pkg.version) return { repo: path.basename(repoDir), skip: 'package.json has no version field' }
  const version = pkg.version

  const problems = []
  const notes = []
  if (layout !== 'root') notes.push('published artifact is ' + layout + 'package.json (' + pkg.name + ')')

  // 1) LOCKSTEP - offline, and the pass that catches the observed failure class.
  //
  // Only two carrier shapes are ASSERTED family-wide, measured on 2026-10-05:
  //   - `src/version.ts`'s exported VERSION: nine repos ship a test that compares it with
  //     package.json (e.g. dsh-score's "src/version.ts matches package.json").
  //   - a `VERSION` file, where one exists (dsh-skill-pack-security gates its 25-check
  //     verify on it).
  // `SKILL.md` frontmatter is NOT a family-wide rule: most skills carry their own
  // independent version (`0.1.0` in dsh-fund-research and dsh-industry-research, whose
  // suites do not assert it), while dsh-skill-pack-security asserts all sixteen of its own.
  // So a skill version difference is reported as a NOTE, never as a failure.
  const carriers = findVersionCarriers(repoDir, version)
  for (const rel of ['VERSION', 'src/version.ts']) {
    const p = path.join(repoDir, rel)
    if (!existsSync(p)) continue
    if (!versionRe(version).test(readFileSync(p, 'utf8'))) {
      problems.push(rel + ' does not carry the package version ' + version)
    }
  }
  for (const s of skillFiles(repoDir)) {
    const text = readFileSync(s.abs, 'utf8')
    const m = /version:\s*['"]?([0-9]+\.[0-9]+\.[0-9]+)/.exec(text)
    if (m && m[1] !== version) {
      notes.push(s.rel + ' names skill version ' + m[1] + ' (package is ' + version + ') - fine unless this repo asserts them equal')
    }
  }

  const pub = publishingWorkflows(repoDir)
  if (!pub.length) notes.push('no npm-publish workflow found (this repo may not publish)')
  for (const w of pub) {
    if (!w.oidc) notes.push(w.file + ': no id-token: write (trusted publishing unavailable)')
    if (w.readsToken) notes.push(w.file + ': reads secrets.NPM_TOKEN - a configured bearer token outranks the OIDC exchange')
    if (w.registryUrl) notes.push(w.file + ': sets registry-url (writes an _authToken line that can short-circuit OIDC)')
  }

  // 2-4) registry probes
  let published = null
  let workflow = null
  let workflowWhy = ''
  let tarballHasSource = null
  if (!NO_REGISTRY) {
    const live = await getJson(registryUrl(pkg.name))
    if (live.status !== 200 || !live.body) {
      problems.push('not on the registry (HTTP ' + live.status + ')')
    } else {
      published = (live.body['dist-tags'] && live.body['dist-tags'].latest) || null
      if (published !== version) problems.push('local ' + version + ' != registry latest ' + published)
      const target = published === version ? version : published
      if (target) {
        const prov = await publishedByWorkflow(pkg.name, target)
        if (prov.ok) { workflow = prov.workflow; workflowWhy = prov.why } else problems.push(prov.why)
        if (workflow && pub.length) {
          const named = workflow.split('::')[1]
          if (named && !pub.some((w) => '.github/workflows/' + w.file === named)) {
            notes.push('provenance names ' + named + ', which is not a current publish workflow (' +
              pub.map((w) => w.file).join(', ') + ')')
          }
        }
      }
      // 4) the published tarball still carries source (K14 and every local check read it)
      if (published === version) {
        const t = live.body.versions && live.body.versions[version] &&
          live.body.versions[version].dist && live.body.versions[version].dist.tarball
        if (t) {
          try {
            const res = await fetch(t)
            if (res.ok) {
              const tar = zlib.gunzipSync(Buffer.from(await res.arrayBuffer())).toString('latin1')
              tarballHasSource = /package\/src\//.test(tar) || /package\/lib\//.test(tar)
              if (!tarballHasSource) problems.push('published tarball carries neither src/ nor lib/')
            } else notes.push('tarball fetch HTTP ' + res.status)
          } catch { notes.push('tarball probe failed') }
        }
      }
    }
  }

  return {
    repo: path.basename(repoDir),
    package: pkg.name,
    version,
    carriers,
    publishingWorkflows: pub,
    published,
    workflow,
    workflowWhy,
    tarballHasSource,
    notes,
    problems,
  }
}

/**
 * Roster mode: verify what the registry actually carries for every declared family member,
 * without needing a checkout of any of them. This is the mode CI uses, because the point is
 * to check the PUBLISHED artifacts, not 40 working trees.
 */
async function checkRoster(rosterPath) {
  const roster = readJson(rosterPath)
  const entries = (roster && roster.repos) || []
  const rows = []
  for (const entry of entries) {
    const pkgName = entry.package ?? String(entry.repo ?? '').split('/')[1]
    if (!pkgName) { rows.push({ repo: String(entry.repo), problems: ['roster entry has no package name'], notes: [] }); continue }
    const problems = []
    const notes = []
    let published = null
    let workflow = null
    let workflowWhy = ''
    const live = await getJson(registryUrl(pkgName))
    if (live.status !== 200 || !live.body) {
      problems.push('not on the registry (HTTP ' + live.status + ')')
    } else {
      published = (live.body['dist-tags'] && live.body['dist-tags'].latest) || null
      const prov = await publishedByWorkflow(pkgName, published)
      if (prov.ok) { workflow = prov.workflow; workflowWhy = prov.why } else problems.push(prov.why)
      // The tarball must still carry source: K14 and every local check read `src/`.
      // The tarball must still carry code. Measured layouts among family members:
      // `src/` (most), `lib/` (built bundles), and `dist/` (dsh-plugin-guide ships its
      // whole guide under dist/ plus guide/; dsh-wechat ships dist/ + resources/). All
      // three are legitimate — reporting only src/lib was a false positive on those two.
      const t = live.body.versions && published && live.body.versions[published] &&
        live.body.versions[published].dist && live.body.versions[published].dist.tarball
      if (t) {
        try {
          const res = await fetch(t)
          if (!res.ok) notes.push('tarball fetch HTTP ' + res.status)
          else {
            const tar = zlib.gunzipSync(Buffer.from(await res.arrayBuffer())).toString('latin1')
            const hasCode = /package\/(src|lib|dist)\//.test(tar)
            if (!hasCode) {
              problems.push('published tarball carries no src/, lib/ or dist/ (a K14 blind spot)')
            }
          }
        } catch { notes.push('tarball probe failed') }
      }
    }
    rows.push({ repo: String(entry.repo ?? pkgName), package: pkgName, published, workflow, workflowWhy, problems, notes })
  }
  return rows
}

function repoDirs() {
  const out = valuesOf('--repo').map((r) => path.resolve(r))
  const ws = valuesOf('--workspace')[0]
  if (ws) {
    const base = path.resolve(ws)
    for (const e of readdirSync(base, { withFileTypes: true })) {
      if (!e.isDirectory()) continue
      const d = path.join(base, e.name)
      if (existsSync(path.join(d, 'package.json'))) out.push(d)
    }
  }
  return [...new Set(out)]
}

const ROSTER = valuesOf('--roster')[0] ?? null

if (ROSTER) {
  const rows = await checkRoster(path.resolve(ROSTER))
  let failing = 0
  for (const r of rows) {
    const bad = r.problems.length > 0
    if (bad) failing++
    if (QUIET && !bad) continue
    console.log((bad ? 'FAIL ' : 'PASS ') + r.repo + '  ' + (r.package ?? '') +
      (r.published ? '@' + r.published : ''))
    if (r.workflow) console.log('     published by : ' + r.workflow)
    for (const p of r.problems) console.log('     PROBLEM: ' + p)
    for (const n of r.notes) console.log('     note   : ' + n)
  }
  if (JSON_OUT) writeFileSync(JSON_OUT, JSON.stringify(rows, null, 2))
  console.log('\nroster: checked ' + rows.length + ' package(s); failing ' + failing)
  process.exit(failing ? 1 : 0)
}

const targets = repoDirs()
if (!targets.length) {
  console.error('usage: node scripts/check-release-health.mjs [--repo <path>]... [--workspace <dir>] [--no-registry] [--json <out>]')
  process.exit(2)
}

const results = []
for (const dir of targets) {
  const r = await checkRepo(dir)
  if (r) results.push(r)
}

let failing = 0
for (const r of results) {
  if (r.skip) { if (!QUIET) console.log('SKIP ' + r.repo + ': ' + r.skip); continue }
  const bad = r.problems.length > 0
  if (bad) failing++
  if (QUIET && !bad) continue
  console.log((bad ? 'FAIL ' : 'PASS ') + r.repo + '  ' + r.package + '@' + r.version)
  if (r.published !== null && r.published !== undefined) {
    console.log('     registry latest : ' + r.published)
    console.log('     published by    : ' + (r.workflow ?? '(' + (r.workflowWhy || 'unknown') + ')'))
  }
  console.log('     version carriers: ' + r.carriers.length + ' file(s)')
  for (const p of r.problems) console.log('     PROBLEM: ' + p)
  for (const n of r.notes) console.log('     note   : ' + n)
}

if (JSON_OUT) writeFileSync(JSON_OUT, JSON.stringify(results, null, 2))
console.log('\nchecked ' + results.length + ' repositor' + (results.length === 1 ? 'y' : 'ies') +
  '; failing ' + failing + (NO_REGISTRY ? ' (lockstep only)' : ''))
process.exit(failing ? 1 : 0)
