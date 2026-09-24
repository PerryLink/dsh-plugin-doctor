// Entry point for the composite GitHub Action defined in action.yml.
//
// Why this exists instead of a one-liner in action.yml: a composite action runs in
// the CALLER's workspace, so a relative path to the tool would resolve against the
// consumer's repository rather than against this action. GITHUB_ACTION_PATH is the
// only reliable anchor, and it is only available inside a step.
//
// It also keeps the resolution rule in one testable place: a repository that
// declares a `bin` named dsh-plugin-doctor would otherwise have `npx` invoke its
// LOCAL bin instead of the published one — the same self-reference that made this
// project's own gate fail while 42 others passed.

import { spawnSync } from 'node:child_process'
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const actionPath = process.env.GITHUB_ACTION_PATH
if (!actionPath) {
  console.error('::error::GITHUB_ACTION_PATH is not set; this script is the Action entry point and cannot be run directly')
  process.exit(1)
}

const cli = path.join(actionPath, 'doctor.mjs')
if (!existsSync(cli)) {
  console.error(`::error::doctor.mjs not found at ${cli} — the Action checkout is incomplete`)
  process.exit(1)
}

const input = (name, fallback = '') => {
  const v = process.env[`INPUT_${name.replace(/ /g, '_').toUpperCase()}`]
  return v === undefined || v === '' ? fallback : v
}

const workspace = process.env.GITHUB_WORKSPACE
if (!workspace) {
  console.error('::error::GITHUB_WORKSPACE is not set')
  process.exit(1)
}

const reportDir = path.resolve(workspace, input('report-dir', 'doctor-report'))
mkdirSync(reportDir, { recursive: true })
const reportPath = path.join(reportDir, 'doctor.json')

// `only` keeps the ASCII aliases the tool documents as encoding-safe.
const groups = input('only', 'R,K').replace(/\s+/g, '')
const format = input('format', 'doctor')
const dsh = input('dsh')

const args = [cli, '--repo', workspace, '--only', groups, '--json', reportPath, '--format', format]
if (input('smoke', 'false') !== 'true') args.push('--no-smoke')
if (dsh) args.push('--dsh', dsh)

console.log(`dsh-plugin-doctor: repo=${workspace} only=${groups} format=${format} smoke=${input('smoke', 'false')}`)

// Not `shell: true`: the arguments are already an array, and a shell would
// reintroduce the quoting hazards this tool warns about.
const run = spawnSync(process.execPath, args, { stdio: 'inherit', cwd: workspace })

let report = null
if (existsSync(reportPath)) {
  try {
    report = JSON.parse(readFileSync(reportPath, 'utf8'))
  } catch (error) {
    console.error(`::warning::report at ${reportPath} is not valid JSON: ${error.message}`)
  }
}

// The two report shapes are different, and a summary that assumes one silently
// reports "gated=0" for the other. `doctor` (the default) has .results with
// lowercase status; `check` (the ecosystem contract) has .checks with uppercase.
const rows = Array.isArray(report?.results)
  ? report.results.map((r) => ({ id: r.id, name: r.name, status: String(r.status).toLowerCase() }))
  : Array.isArray(report?.checks)
    ? report.checks.map((r) => ({ id: r.id, name: r.name, status: String(r.status).toLowerCase() }))
    : []

const gated = rows.filter((r) => !/^R[24] /.test(r.name))
const failing = gated.filter((r) => r.status === 'fail' || r.status === 'error')
const counts = gated.reduce((acc, r) => ({ ...acc, [r.status]: (acc[r.status] ?? 0) + 1 }), {})

const summary = `format=${format} gated=${gated.length} pass=${counts.pass ?? 0} warn=${counts.warn ?? 0} fail=${counts.fail ?? 0} error=${counts.error ?? 0} skip=${counts.skip ?? 0}`
console.log(`dsh-plugin-doctor: ${summary}`)

const out = process.env.GITHUB_OUTPUT
if (out) {
  // report.verdict is an object ({worst, ok, criticalFail}) in the doctor shape;
  // emitting it directly yields "[object Object]", which a consumer would happily
  // store as though it were a verdict.
  const verdict = typeof report?.verdict === 'string'
    ? report.verdict
    : (report?.verdict?.worst ?? (failing.length ? 'fail' : 'pass'))
  appendFileSync(out, [
    `exit-code=${run.status ?? 1}`,
    `report-path=${reportPath}`,
    `summary=${summary}`,
    `failing=${failing.map((r) => r.id ?? r.name).join(',')}`,
    `verdict=${verdict}`,
  ].join('\n') + '\n')
}

if (failing.length) {
  console.error(`::error::failing gated checks: ${failing.map((r) => r.name).join(' | ')}`)
}

process.exit(run.status ?? 1)
