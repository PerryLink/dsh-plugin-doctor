// 契约测试（R-fix 0B）：把既有 37 仓 CI 依赖的 5 个可观测量冻结成自动化断言。
//
// 为什么需要它：家族 37 仓的 .github/workflows/plugin-doctor.yml 只做四件事 ——
//   ① stdout 含 "R0 "  ② stdout 含 "K1 "  ③ doctor.json 的 .results 是扁平数组
//   ④ results[].name 以 ^R[24] 前缀的条目被排除在门禁外，其余条目 status ∈ {pass,warn,skip}
// 任何一次"顺手清理"（例如把 ID 从 name 里拆走、给 --quiet 让 stdout 变干净）都会让 37/37 仓
// 同时硬红。本测试把这些观测固化成断言，改工具前先跑它。
//
// 用法: node tests/contract.mjs
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'doctor-contract-'))
// 本次运行前已有的 %TEMP%\dsh-doctor-* 目录（旧实现的历史泄漏，不属于本次断言范围）
const legacyDshDirs = new Set(fs.readdirSync(os.tmpdir()).filter((e) => e.startsWith('dsh-doctor-')))

// 注意：带 scripts.build 是刻意的 —— 已发布 tarball 保留 build 脚本，
// 而旧实现正因 `!pkg.scripts?.build` 门槛导致 lib 兜底永不触发（K 九项全 skip 的成因）。
const PKG = {
  name: 'dsh-contract-fixture',
  version: '1.0.0',
  description: 'doctor contract fixture',
  type: 'module',
  main: 'lib/index.js',
  files: ['lib/', 'cordis.patch.yml', 'README.md', 'LICENSE'],
  engines: { node: '^22.19.0 || >=24.0.0' },
  license: 'Apache-2.0',
  scripts: { build: 'tsdown' },
  dsh: { bundle: { patch: './cordis.patch.yml' } },
}
const ENTRY = "export const name = 'dsh-contract-fixture'\nexport function apply(ctx) { void ctx }\n"

function makeFixture(dir, { src = false, lib = true } = {}) {
  fs.mkdirSync(dir, { recursive: true })
  if (src) fs.mkdirSync(path.join(dir, 'src'), { recursive: true })
  if (lib) { fs.mkdirSync(path.join(dir, 'lib'), { recursive: true }); fs.writeFileSync(path.join(dir, 'lib', 'index.js'), ENTRY) }
  if (src) fs.writeFileSync(path.join(dir, 'src', 'index.ts'), ENTRY)
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify(PKG, null, 2) + '\n')
  fs.writeFileSync(path.join(dir, 'cordis.patch.yml'), '- insert:\n    - id: contract-fixture\n      name: dsh-contract-fixture\n')
  fs.writeFileSync(path.join(dir, 'README.md'), '# fixture\n')
  fs.writeFileSync(path.join(dir, 'LICENSE'), 'Apache-2.0\n')
}

const withSrc = path.join(sandbox, 'with-src')   // src/ + lib/：常规源码树
const libOnly = path.join(sandbox, 'lib-only')   // 无 src/ 有 lib/ 且带 build 脚本：= 已发布产物形态
const bare = path.join(sandbox, 'bare')          // 无 src/ 无 lib/：K 组结构性不可跑
makeFixture(withSrc, { src: true, lib: true })
makeFixture(libOnly, { src: false, lib: true })
makeFixture(bare, { src: false, lib: false })

function run(repo, args) {
  const json = path.join(sandbox, `out-${Math.random().toString(36).slice(2)}.json`)
  const r = spawnSync(process.execPath, ['doctor.mjs', '--repo', repo, ...args, '--json', json], {
    cwd: ROOT, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024,
  })
  let report = null
  if (fs.existsSync(json)) { try { report = JSON.parse(fs.readFileSync(json, 'utf8')) } catch { report = 'PARSE-FAIL' } }
  return { exit: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '', report }
}

const checks = []
const assert = (name, cond, detail = '') => checks.push({ name, ok: !!cond, detail })

const base = run(withSrc, ['--no-smoke', '--only', 'R,K'])
const results = base.report?.results ?? []

// ── 观测 1/2：stdout 必须含 "R0 " 与 "K1 "（37 仓门禁的两条 grep）──────────
assert('stdout 含 "R0 "', base.stdout.includes('R0 '))
assert('stdout 含 "K1 "', base.stdout.includes('K1 '))

// ── 观测 3：.results 是扁平数组，gated=16、buildDep=2 ──────────────────────
assert('.results 是数组', Array.isArray(base.report?.results))
const gated = results.filter((x) => !/^R[24] /.test(x.name))
const buildDep = results.filter((x) => /^R[24] /.test(x.name))
assert('gated 计数 = 16', gated.length === 16, `实际 ${gated.length}`)
assert('R2/R4 前缀被排除（buildDep=2）', buildDep.length === 2, `实际 ${buildDep.length}`)

// ── 观测 4：gated 条目 status ∈ {pass,warn,skip}，干净 fixture 无 fail/error ─
const badGated = gated.filter((x) => x.status === 'fail' || x.status === 'error')
assert('gated 无 fail/error（干净 fixture）', badGated.length === 0, badGated.map((x) => x.name).join(', '))
assert('gated status 全在允许集合内', gated.every((x) => ['pass', 'warn', 'skip'].includes(x.status)))

// ── 观测 5：退出码语义不变（0 通过 / 2 用法）──────────────────────────────
assert('干净 fixture → exit 0', base.exit === 0, `实际 ${base.exit}`)
assert('未知分组 → exit 2', run(withSrc, ['--no-smoke', '--only', 'NOPE']).exit === 2)
assert('未知选项 → exit 2（旧实现会静默劫持 --repo）', run(withSrc, ['--no-smoke', '--bogus', 'x']).exit === 2)
assert('缺 --repo → exit 2', spawnSync(process.execPath, ['doctor.mjs', '--no-smoke'], { cwd: ROOT, encoding: 'utf8' }).status === 2)

// ── 新增契约：id / groupId / name 前缀不变 / 信封字段 ────────────────────
assert('结果项带 id', results.length > 0 && results.every((x) => typeof x.id === 'string' && x.id.length > 0))
assert('结果项带 groupId', results.every((x) => typeof x.groupId === 'string'))
assert('name 仍保留 ID 前缀（不可变契约）', results.every((x) => /^([A-Z]{1,3}\d+)\s/.test(x.name)))
assert('信封 schemaVersion = 2', base.report?.schemaVersion === '2')
assert('信封带 checksetVersion / doctorVersion', typeof base.report?.checksetVersion === 'string' && typeof base.report?.doctorVersion === 'string')
assert('信封带 target / env / groups / verdict', !!(base.report?.target && base.report?.env && base.report?.groups && base.report?.verdict))
assert('message 已脱敏（不含仓库绝对路径）', results.every((x) => !String(x.message ?? '').includes(withSrc)))

// ── R-fix 0A：lib 兜底生效 —— 无 src/ 有 lib/ 的「已发布产物形态」K 组仍可跑 ──
const libOnlyRun = run(libOnly, ['--no-smoke', '--only', 'K'])
const kItems = (libOnlyRun.report?.results ?? []).filter((x) => /^K\d /.test(x.name))
const kRan = kItems.filter((x) => x.status !== 'skip').length
assert('lib 兜底：无 src 有 lib 时 K 组仍有实跑项', kRan > 0, `ran=${kRan}/${kItems.length}`)
assert('lib 兜底：coverage.K.mode = lib-fallback', libOnlyRun.report?.coverage?.K?.mode === 'lib-fallback', JSON.stringify(libOnlyRun.report?.coverage ?? null))
assert('lib 兜底：不判降级', !(libOnlyRun.report?.degraded ?? []).includes('K'))

// ── R-fix 0A/4：结构性不可跑 → 整组未真跑 → exit 6 ────────────────────────
const bareK = run(bare, ['--no-smoke', '--only', 'K'])
assert('K 组整组未真跑 → exit 6', bareK.exit === 6, `实际 ${bareK.exit}`)
assert('降级列表含 K', (bareK.report?.degraded ?? []).includes('K'))
assert('--allow-degraded → 显式接受降级为 0', run(bare, ['--no-smoke', '--only', 'K', '--allow-degraded']).exit === 0)
assert('有源文件仓不降级', !(base.report?.degraded ?? []).includes('K'))

// ── R-fix 0A/P7：无 src 时 R5 不再静默 pass ──────────────────────────────
const r5 = (run(libOnly, ['--no-smoke', '--only', 'R']).report?.results ?? []).find((x) => /^R5 /.test(x.name))
assert('无 src 时 R5 = skip（不再静默 pass）', r5?.status === 'skip', `实际 ${r5?.status}`)

// ── R-fix 2：CC5 在非家族工作区 = not-applicable（不再对外部仓假红）────────
const cc = run(withSrc, ['--no-smoke', '--only', 'CC', '-w', sandbox])
const cc5 = (cc.report?.results ?? []).find((x) => /^CC5 /.test(x.name))
assert('非家族工作区 CC5 = skip', cc5?.status === 'skip', `实际 ${cc5?.status}`)
assert('CC 组整组未真跑 → exit 6（不假绿）', cc.exit === 6, `实际 ${cc.exit}`)

// ── C3：--json - 写 stdout 且不落名为 "-" 的文件 ─────────────────────────
assert('--json - 输出纯 JSON 且不产生 "-" 文件', (() => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'doctor-dash-'))
  const r = spawnSync(process.execPath, [path.join(ROOT, 'doctor.mjs'), '--repo', withSrc, '--no-smoke', '--only', 'R', '--json', '-'], { cwd, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 })
  const dash = fs.existsSync(path.join(cwd, '-'))
  let parsed = false
  try { parsed = !!JSON.parse(r.stdout).results } catch { parsed = false }
  fs.rmSync(cwd, { recursive: true, force: true })
  return !dash && parsed
})())

// ── R-fix 7：沙箱只隔离不删除，且前缀不落在 %TEMP%\dsh-* 保护模板内 ────────
assert('quarantine 路径前缀为 doctor-quarantine-', (() => {
  const q = base.report?.quarantine
  return typeof q === 'string' && path.basename(q).startsWith('doctor-quarantine-')
})(), String(base.report?.quarantine))
assert('本次运行不再新增 %TEMP%\\dsh-doctor-* 目录', (() => {
  const now = fs.readdirSync(os.tmpdir()).filter((e) => e.startsWith('dsh-doctor-') && !legacyDshDirs.has(e))
  return now.length === 0
})(), `历史遗留 ${legacyDshDirs.size} 个（不在本次范围）`)

fs.rmSync(sandbox, { recursive: true, force: true })

let failed = 0
for (const c of checks) {
  if (!c.ok) failed++
  console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.name}${c.detail ? `  — ${c.detail}` : ''}`)
}
console.log(`\ncontract: ${checks.length - failed}/${checks.length} passed`)
if (failed > 0) process.exitCode = 1
