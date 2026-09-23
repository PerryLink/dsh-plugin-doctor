// Contract-view tests: `--format check` must restate a run in the ecosystem's
// three-value contract (RFC #1846) without changing the verdict.
//
// The risk this guards against is a compatibility layer that quietly disagrees
// with the tool it is translating. Two properties matter most:
//   1. the two views never disagree about pass/fail;
//   2. `skip` is never presented as if the check had been evaluated - `pass` and
//      "did not run" are the distinction this tool exists to preserve, and the
//      three-value contract has no room for it.
//
// 用法: node tests/compat.mjs
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'doctor-compat-'))

const checks = []
const assert = (name, cond, detail = '') => checks.push({ name, ok: !!cond, detail })

function makeRepo(dir, { files = ['lib/', 'cordis.patch.yml', 'README.md', 'LICENSE'], lib = true } = {}) {
  fs.mkdirSync(path.join(dir, 'src'), { recursive: true })
  if (lib) fs.mkdirSync(path.join(dir, 'lib'), { recursive: true })
  const ENTRY = "export const name = 'compat-fixture'\nexport function apply(ctx) { void ctx }\n"
  fs.writeFileSync(path.join(dir, 'src', 'index.ts'), ENTRY)
  if (lib) fs.writeFileSync(path.join(dir, 'lib', 'index.js'), ENTRY)
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({
    name: 'compat-fixture',
    version: '1.0.0',
    type: 'module',
    main: 'lib/index.js',
    files,
    engines: { node: '^22.19.0 || >=24.0.0' },
    license: 'Apache-2.0',
    dsh: { bundle: { patch: './cordis.patch.yml' } },
  }, null, 2) + '\n')
  fs.writeFileSync(path.join(dir, 'cordis.patch.yml'), '- insert:\n    - id: compat-fixture\n      name: compat-fixture\n')
  fs.writeFileSync(path.join(dir, 'README.md'), '# fixture\n')
  fs.writeFileSync(path.join(dir, 'LICENSE'), 'Apache-2.0\n')
}

const good = path.join(sandbox, 'good')
makeRepo(good)
// No dsh.bundle.patch -> R1 (critical) fails.
const noPatch = path.join(sandbox, 'no-patch')
makeRepo(noPatch)
{
  const p = JSON.parse(fs.readFileSync(path.join(noPatch, 'package.json'), 'utf8'))
  delete p.dsh
  fs.writeFileSync(path.join(noPatch, 'package.json'), JSON.stringify(p, null, 2) + '\n')
}
// No cordis dependency/peer at all, and the entry sits in a directory that is
// not a build-output dir, so R5 and R8 both have nothing to judge and must
// return `skip`. That is the case the contract view has to keep distinguishable
// from a pass - `pass` and "did not run" are the distinction this tool exists
// to preserve, and the three-value contract has no room for it.
const skippy = path.join(sandbox, 'skippy')
fs.mkdirSync(path.join(skippy, 'app'), { recursive: true })
fs.writeFileSync(path.join(skippy, 'app', 'index.js'), "export const name = 'skip-fixture'\nexport function apply(ctx) { void ctx }\n")
fs.writeFileSync(path.join(skippy, 'package.json'), JSON.stringify({
  name: 'skip-fixture',
  version: '1.0.0',
  type: 'module',
  main: 'app/index.js',
  files: ['app/', 'cordis.patch.yml', 'README.md', 'LICENSE'],
  engines: { node: '^22.19.0 || >=24.0.0' },
  license: 'Apache-2.0',
  dsh: { bundle: { patch: './cordis.patch.yml' } },
}, null, 2) + '\n')
fs.writeFileSync(path.join(skippy, 'cordis.patch.yml'), '- insert:\n    - id: skip-fixture\n      name: skip-fixture\n')
fs.writeFileSync(path.join(skippy, 'README.md'), '# fixture\n')
fs.writeFileSync(path.join(skippy, 'LICENSE'), 'Apache-2.0\n')

function run(repo, extra = [], { only = 'R,K' } = {}) {
  const r = spawnSync(process.execPath, ['doctor.mjs', '--repo', repo, '--no-smoke', '--only', only, ...extra], {
    cwd: ROOT, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024,
  })
  return { exit: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' }
}

function parseContract(extra, repo) {
  const r = run(repo, ['--format', 'check', '--json', '-', ...extra])
  let json = null
  try { json = JSON.parse(r.stdout) } catch { json = null }
  return { ...r, json }
}

// ---- vocabulary and shape -------------------------------------------------
{
  const { json, exit } = parseContract([], good)
  assert('--format check 产出可解析 JSON', json !== null)
  assert('contract 命名空间为 dsh-doctor/v1', json?.contract === 'dsh-doctor/v1', `实际 ${json?.contract}`)
  assert('带 ok 布尔字段', typeof json?.ok === 'boolean', `实际 ${typeof json?.ok}`)
  assert('带 checks 数组', Array.isArray(json?.checks), `实际 ${typeof json?.checks}`)
  assert('checks 每项是 {name,status,detail}', (json?.checks ?? []).every((c) => typeof c.name === 'string' && typeof c.status === 'string' && typeof c.detail === 'string'))
  const statuses = new Set((json?.checks ?? []).map((c) => c.status))
  assert('状态只用 PASS/WARN/FAIL 三值', [...statuses].every((s) => ['PASS', 'WARN', 'FAIL'].includes(s)), [...statuses].join(','))
  assert('干净仓 ok=true', json?.ok === true, `ok=${json?.ok}`)
  assert('干净仓 --format check 退出码 0', exit === 0, `实际 ${exit}`)
}

// ---- the two views must agree ---------------------------------------------
{
  const doc = run(noPatch, ['--json', '-'])
  const docJson = JSON.parse(doc.stdout)
  const { json, exit } = parseContract([], noPatch)
  const docFailed = docJson.results.some((r) => r.status === 'fail' || r.status === 'error')
  assert('doctor 视图对缺 patch 判为失败', docFailed)
  assert('doctor 视图退出码 1', doc.exit === 1, `实际 ${doc.exit}`)
  assert('check 视图 ok=false（两视图一致）', json?.ok === false, `ok=${json?.ok}`)
  assert('check 视图退出码 1', exit === 1, `实际 ${exit}`)
  const r1 = (json?.checks ?? []).find((c) => c.id === 'R1')
  assert('R1 在 check 视图中为 FAIL', r1?.status === 'FAIL', `实际 ${r1?.status}`)
  assert('关键项 critical 标记被保留', r1?.critical === true, `实际 ${r1?.critical}`)
  assert('非缺陷类别不出现（plugin-defect 是默认，不冗余输出）', r1?.category === undefined, `实际 ${r1?.category}`)
}

// ---- skip must not masquerade as an evaluated pass -------------------------
{
  const doc = run(skippy, ['--json', '-'])
  const docJson = JSON.parse(doc.stdout)
  const docSkips = docJson.results.filter((r) => r.status === 'skip')
  assert('doctor 视图存在 skip 项', docSkips.length > 0, `实际 ${docSkips.length}`)

  const { json } = parseContract([], skippy)
  const withFlag = (json?.checks ?? []).filter((c) => c.skipped === true)
  assert('check 视图用 skipped 标记未求值项', withFlag.length === docSkips.length, `check=${withFlag.length} doctor=${docSkips.length}`)
  assert('未求值项绝不被标成 PASS', withFlag.every((c) => c.status !== 'PASS'), withFlag.map((c) => `${c.name}=${c.status}`).join(','))
  assert('doctor 视图仍保留 skip 计数以外的语义', json?.doctor?.skipped === docSkips.length, `实际 ${json?.doctor?.skipped}`)
}

// ---- the contract view must not change the default view -------------------
{
  const plain = run(good, ['--json', '-'])
  const plainJson = JSON.parse(plain.stdout)
  assert('默认视图仍是 doctor 信封（schemaVersion 在）', plainJson.schemaVersion === '2', `实际 ${plainJson.schemaVersion}`)
  assert('默认视图不含 contract 字段', plainJson.contract === undefined)
  assert('默认视图保留 5 值状态词汇', plainJson.results.some((r) => ['skip', 'pass', 'warn'].includes(r.status)))
}

// ---- usage errors ---------------------------------------------------------
{
  const r = run(good, ['--format', 'nonsense'])
  assert('未知 --format 是用法错误（退出码 2）', r.exit === 2, `实际 ${r.exit}`)
  assert('未知 --format 报出可选值', /doctor, check/.test(r.stderr + r.stdout), '')
}

// ---- a run that evaluated nothing maps to "not a plugin" ------------------
{
  const r = run(good, ['--format', 'check', '--json', '-'], { only: 'NOPE' })
  assert('无分组匹配时退出码 2', r.exit === 2, `实际 ${r.exit}`)
}

// ---- output -----------------------------------------------------------------
let failed = 0
for (const c of checks) {
  if (!c.ok) failed++
  console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.name}${c.detail ? `  — ${c.detail}` : ''}`)
}
console.log(`\ncompat: ${checks.length - failed}/${checks.length} passed`)
if (failed > 0) process.exit(1)
