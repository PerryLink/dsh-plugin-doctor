// Compatibility view for the ecosystem's emerging plugin-check contract.
//
// Why this exists: three independent DSH plugin checkers converged on one
// interface during 2026-08 — a three-value status vocabulary (PASS/WARN/FAIL),
// exit codes 0/1/2, and a flat checks array carrying {name, status, detail}.
// It is written up as RFC #1846 in the harness repository
// (https://github.com/deepseek-ai/deepseek-harness/discussions/1846), and
// zoahdev/dsh-plugin-doctor, boyin111-1/dsh-doctor and moonquake2004/dsh-doctor
// all follow it.
//
// This project's own envelope is deliberately richer: five statuses (it keeps
// `skip` distinct from `pass`, which is the distinction that stops a group that
// never ran from counting as green), seven exit codes (3 infrastructure,
// 4 unsupported host, 5 unstable, 6 degraded), and per-check ids, categories and
// coverage. None of that is visible to a consumer expecting the three-value
// contract, so an interoperating tool cannot read this output today.
//
// This module projects the rich envelope onto the contract WITHOUT changing it.
// The projection is deliberately lossless where it can be: anything the
// three-value contract cannot express is carried in extra fields, and anything
// that would be a lie is reported through `approximated` instead of being
// silently flattened.
//
// Invariant: this module never changes whether a project passes. It only
// restates the same run in the other vocabulary.
import { readFileSync } from 'node:fs'
import path from 'node:path'

// Matches the namespace the other reference implementations already use (the
// draft is described as a "dsh-doctor/v1 JSON envelope"), so a consumer keyed on
// it recognises this output without a special case.
export const CONTRACT = 'dsh-doctor/v1'

export const EXIT = {
  PASS: 0,
  FIXABLE: 1,
  NOT_A_PLUGIN: 2,
}

/** The contract has no `skip`: a check that did not run is reported as WARN. */
const STATUS = {
  pass: 'PASS',
  warn: 'WARN',
  skip: 'WARN',
  fail: 'FAIL',
  error: 'FAIL',
}

/**
 * The proposal describes exit 2 as "not a plugin". A run that never evaluated
 * anything is not evidence about the plugin, so it maps there too — the exit code
 * has to stop a consumer from reading the run as a pass.
 */
const NOT_A_PLUGIN_CATEGORIES = new Set([
  'usage', 'plugin-missing', 'not-a-plugin', 'crash',
  'infrastructure', 'unsupported-host', 'unstable', 'degraded',
])

/**
 * @param {string} repoPath
 * @returns {{ name: string|null, version: string|null }}
 */
function readTarget(repoPath) {
  try {
    const pkg = JSON.parse(readFileSync(path.join(repoPath, 'package.json'), 'utf8'))
    return { name: pkg.name ?? null, version: pkg.version ?? null }
  } catch {
    return { name: null, version: null }
  }
}

/**
 * Project a doctor result into one contract check.
 * `name` keeps the raw doctor name (its `R0 `/`K1 ` prefix is a frozen contract
 * for downstream gates); the stable id is carried separately so a consumer can
 * address a check precisely instead of by display string.
 * @param {Record<string, any>} r
 */
function toCheck(r) {
  const skipped = r.status === 'skip'
  const check = {
    name: r.name,
    status: STATUS[r.status] ?? 'WARN',
    detail: r.message ?? '',
  }
  if (r.id) check.id = r.id
  if (r.groupId) check.group = r.groupId
  // The contract cannot express "not evaluated". Saying so explicitly is the
  // whole point: a consumer that reads WARN as "evaluated and suboptimal" would
  // otherwise be misled about a check that never ran.
  if (skipped) check.skipped = true
  if (r.status === 'warn' || r.status === 'error') check.doctorStatus = r.status
  if (r.category && r.category !== 'plugin-defect') check.category = r.category
  if (r.critical) check.critical = true
  return check
}

/**
 * @param {{ results: Array<Record<string, any>>, degraded?: string[], repoPath: string, doctorVersion: string }} args
 */
export function toContract({ results, degraded = [], repoPath, doctorVersion }) {
  const checks = results.map(toCheck)
  const failed = results.filter((r) => r.status === 'fail' || r.status === 'error')

  let exit = EXIT.PASS
  let approximated = false

  if (failed.length) {
    const onlyNonDefects = failed.every((r) => NOT_A_PLUGIN_CATEGORIES.has(r.category))
    // The contract cannot distinguish "your plugin is broken" from "the host
    // version would not install". Both are non-pass, but only the first says
    // anything about the plugin.
    exit = onlyNonDefects ? EXIT.NOT_A_PLUGIN : EXIT.FIXABLE
    approximated = onlyNonDefects
  } else if (degraded.length) {
    exit = EXIT.NOT_A_PLUGIN
    approximated = true
  }

  /** @type {Record<string, any>} */
  const out = {
    ok: exit === EXIT.PASS,
    contract: CONTRACT,
    checks,
    // Non-contract fields. A consumer that only knows the three-value contract
    // ignores them; one that wants the richer semantics can read them.
    doctor: {
      version: doctorVersion,
      exit,
      skipped: checks.filter((c) => c.skipped).length,
      criticalFail: results.some((r) => r.critical && (r.status === 'fail' || r.status === 'error')),
      degraded: [...degraded],
      approximated,
    },
  }
  const target = readTarget(repoPath)
  if (target.name) out.target = target
  return out
}

/**
 * Exit code for the contract view. 0 pass / 1 fixable (or a defect that is not
 * about the plugin) / 2 not a plugin, infrastructure fault, or a run that
 * evaluated nothing.
 * @param {Array<Record<string, any>>} results
 * @param {{ degraded?: string[] }} [opts]
 */
export function contractExitCode(results, { degraded = [] } = {}) {
  if (!results.length) return EXIT.NOT_A_PLUGIN
  return toContract({ results, degraded, repoPath: '', doctorVersion: '' }).doctor.exit
}
