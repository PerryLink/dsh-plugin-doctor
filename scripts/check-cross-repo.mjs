#!/usr/bin/env node
/**
 * K14 cross-repo injection-point check for the whole family, without cloning it.
 *
 * K14 compares this repo's injection points against its siblings inside a family
 * workspace (`--workspace`). In per-repo CI there are no siblings, so K14 degrades to
 * `skip` — by design: a downstream repo must never be reddened by a check it cannot run.
 * The consequence is that nobody runs K14 at all unless someone does it by hand.
 *
 * This script closes that gap for THIS repository's own CI. It materialises a throwaway
 * family workspace from the PUBLISHED tarballs instead of a 46-repo checkout:
 *   - `data/verified-repos.json` is the authoritative roster of family members that are
 *     expected to carry a doctor badge, so "who is in the family" has exactly one source.
 *   - Each npm tarball ships `package.json` (including the `dshPluginDoctor` exemption
 *     declaration) and `src/` — the only two inputs K14 reads. Verified against
 *     `dsh-background-agents@0.10.2`: all 9 exemption entries survive publication.
 *   - Extraction is done here with `node:zlib`, not the `tar` binary: this host's Git
 *     ships GNU tar which shadows System32 bsdtar and does not accept `--one-top-level`.
 *
 * A collision in the output is a real cross-repo finding (either a genuine clash, or a
 * guard whose exemption was never declared), so this exits non-zero on FAIL and on an
 * unexempted WARN.
 */
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import zlib from 'node:zlib'

const ROOT = path.resolve(import.meta.dirname, '..')
const STAGE = path.join(ROOT, '.family-stage')

/** Minimal tar reader: enough for npm tarballs (GNU + POSIX ustar/pax headers). */
function extractTarGz(buf, destDir) {
  const tar = zlib.gunzipSync(buf)
  let off = 0
  let files = 0
  while (off + 512 <= tar.length) {
    const header = tar.subarray(off, off + 512)
    if (header.every((b) => b === 0)) break
    let name = header.subarray(0, 100).toString('utf8').replace(/\0.*$/, '')
    const prefix = header.subarray(345, 500).toString('utf8').replace(/\0.*$/, '')
    if (prefix) name = `${prefix}/${name}`
    const sizeField = header.subarray(124, 136).toString('utf8').replace(/\0.*$/, '').trim()
    const size = sizeField ? parseInt(sizeField, 8) : 0
    const type = String.fromCharCode(header[156])
    off += 512
    const body = tar.subarray(off, off + size)
    off += Math.ceil(size / 512) * 512

    // npm tarballs root everything under `package/`; strip it.
    const rel = name.replace(/^package\/?/, '')
    if (!rel) continue
    const target = path.join(destDir, rel)
    if (!target.startsWith(destDir)) continue // never escape the stage
    if (type === '5' || name.endsWith('/')) { mkdirSync(target, { recursive: true }); continue }
    if (type === '0' || type === '\0' || type === '') {
      mkdirSync(path.dirname(target), { recursive: true })
      writeFileSync(target, body)
      files++
    }
  }
  return files
}

function npmJson(args) {
  const r = spawnSync('npm', args, { encoding: 'utf8', shell: process.platform === 'win32', maxBuffer: 32 * 1024 * 1024 })
  if (r.status !== 0) return null
  try { return JSON.parse(r.stdout) } catch { return null }
}

async function fetchTarball(url) {
  const res = await fetch(url, { redirect: 'follow' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return Buffer.from(await res.arrayBuffer())
}

const roster = JSON.parse(readFileSync(path.join(ROOT, 'data', 'verified-repos.json'), 'utf8')).repos
console.log(`roster: ${roster.length} family members declared in data/verified-repos.json`)

rmSync(STAGE, { recursive: true, force: true })
mkdirSync(STAGE, { recursive: true })

const staged = []
const failed = []
for (const entry of roster) {
  // Each roster entry is `{ repo: "PerryLink/dsh-x", package: "dsh-x" }`: the exact npm
  // name is declared, so no convention guessing is needed.
  const pkgName = entry.package ?? (entry.repo ?? '').split('/')[1]
  const repoBase = (entry.repo ?? '').split('/')[1] ?? pkgName
  if (!pkgName) { failed.push(`${JSON.stringify(entry)} (no package name)`); continue }

  const meta = npmJson(['view', pkgName, 'dist.tarball', 'version', '--json'])
  if (!meta) { failed.push(`${pkgName} (not on the registry)`); continue }
  let tarball, version
  if (Array.isArray(meta)) { [tarball, version] = meta } else if (typeof meta === 'object' && meta['dist.tarball']) {
    tarball = meta['dist.tarball']; version = meta.version
  } else { failed.push(`${pkgName} (unexpected npm view shape)`); continue }

  try {
    const buf = await fetchTarball(tarball)
    const dest = path.join(STAGE, repoBase.startsWith('dsh-') ? repoBase : `dsh-${repoBase}`)
    mkdirSync(dest, { recursive: true })
    const n = extractTarGz(buf, dest)
    const hasSrc = existsSync(path.join(dest, 'src')) || existsSync(path.join(dest, 'lib'))
    staged.push(`${pkgName}@${version} (${n} files${hasSrc ? '' : ', NO SOURCE — K14 blind spot'})`)
  } catch (e) {
    failed.push(`${pkgName} (${e.message})`)
  }
}

console.log(`staged: ${staged.length}`)
for (const s of staged) console.log('  ' + s)
if (failed.length) {
  console.log(`not staged: ${failed.length}`)
  for (const f of failed) console.log('  ' + f)
}

// Run K14 against the staged family workspace. `--json -` writes the machine-readable
// envelope to stdout (there is no `--format json`; `--format` picks doctor vs check).
const run = spawnSync('node', ['doctor.mjs', '--repo', ROOT, '--workspace', STAGE, '--no-smoke', '--only', 'K', '--json', '-'], {
  cwd: ROOT, encoding: 'utf8', shell: process.platform === 'win32', maxBuffer: 64 * 1024 * 1024,
})
const out = `${run.stdout ?? ''}\n${run.stderr ?? ''}`
writeFileSync(path.join(ROOT, 'k14-report.json'), run.stdout ?? '')

let k14 = null
try {
  const parsed = JSON.parse(run.stdout)
  const results = parsed.results ?? parsed.checks ?? parsed
  const list = Array.isArray(results) ? results : Object.values(results)
  k14 = list.find((r) => r && String(r.id ?? r.name ?? '').includes('K14'))
} catch { /* fall through to textual scan */ }

if (k14) {
  console.log(`\nK14: ${k14.status}`)
  if (k14.evidence) console.log(String(k14.evidence).slice(0, 4000))
  if (k14.message) console.log(String(k14.message).slice(0, 4000))
} else {
  console.log('\nK14 result not parsed; raw tail:')
  console.log(out.split('\n').slice(-30).join('\n'))
}

// `skip` is a legitimate outcome only when the stage is too small to compare; a missing
// result means the extraction or invocation broke, which must not read as success.
const status = k14?.status ?? 'missing'
const bad = status === 'fail' || status === 'warn' || status === 'skip' || status === 'missing' || staged.length < 2
console.log(`\nstatus=${status} staged=${staged.length} -> ${bad ? 'FAILING THE JOB' : 'ok'}`)
rmSync(STAGE, { recursive: true, force: true })
process.exit(bad ? 1 : 0)
