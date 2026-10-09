// dsh-plugin-doctor 自检：真实调用 CLI，断言退出码契约与"防静默通过"行为。
// 全部在 %TEMP% mkdtemp 沙箱内构造 fixture，不触碰任何真实仓库。
// 用法: node tests/selftest.mjs
//
// 前 7 例是 0.1.x 起的既有契约（逐字不变）；其后为本轮新增的 3/4/5/6 码与降级语义。
//
// ⚠️ 沙箱前缀必须是 `doctor-`，绝不能是 `dsh-doctor-`：宿主对 `%TEMP%\dsh-*`
// 设了保护模板（工作区红线 1），带 `dsh-` 前缀的自建目录会落进该模板。本文件曾用
// `dsh-doctor-selftest-` / `dsh-doctor-dash-`，每次运行都新增两个违反红线的目录，
// 且从不清理 —— 被 tests/contract.mjs 的「不再新增 %TEMP%\dsh-doctor-*」断言抓出。
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'doctor-selftest-'))

const GOOD_PKG = {
  name: 'dsh-selftest-fixture',
  version: '1.0.0',
  description: 'doctor selftest fixture',
  type: 'module',
  main: 'lib/index.js',
  files: ['lib/', 'cordis.patch.yml', 'README.md', 'LICENSE'],
  engines: { node: '^22.19.0 || >=24.0.0' },
  license: 'Apache-2.0',
  dsh: { bundle: { patch: './cordis.patch.yml' } },
}
const ENTRY = "export const name = 'dsh-selftest-fixture'\nexport function apply(ctx) {}\n"
const PATCH = '- insert:\n    - id: selftest-fixture\n      name: dsh-selftest-fixture\n'

function makeFixture(dir, { broken = false, bare = false } = {}) {
  if (!bare) fs.mkdirSync(path.join(dir, 'lib'), { recursive: true })
  const pkg = structuredClone(GOOD_PKG)
  if (broken) delete pkg.dsh
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify(pkg, null, 2) + '\n')
  if (!bare) fs.writeFileSync(path.join(dir, 'lib', 'index.js'), ENTRY)
  fs.writeFileSync(path.join(dir, 'cordis.patch.yml'), PATCH)
  fs.writeFileSync(path.join(dir, 'README.md'), '# fixture\n')
  fs.writeFileSync(path.join(dir, 'LICENSE'), 'Apache-2.0\n')
}

const good = path.join(sandbox, 'good')
const broken = path.join(sandbox, 'broken')
const bare = path.join(sandbox, 'bare') // 无 src/ 无 lib/：K 组结构性不可跑 → 降级
makeFixture(good)
makeFixture(broken, { broken: true })
makeFixture(bare, { bare: true })

// ── K14 跨仓夹具：一个家族工作区，两个兄弟仓注册同一个服务键 ──────────────
// discoverSiblings 只认直接子目录、名字以 dsh- 开头、且声明了 dsh 字段或 DSH peer 的仓。
const family = path.join(sandbox, 'family')
const sibA = path.join(family, 'dsh-selftest-alpha')
const sibB = path.join(family, 'dsh-selftest-beta')
for (const [dir, extra] of [[sibA, {}], [sibB, {}]]) {
  fs.mkdirSync(path.join(dir, 'src'), { recursive: true })
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({
    name: path.basename(dir), version: '1.0.0', type: 'module', ...extra,
    dsh: { manifestVersion: 1 },
  }) + '\n')
}
// Both provide the SAME service key → a genuine cross-repo collision.
const SHARED = "import { Service } from '@deepseek-ai/cordis'\nclass Hub extends Service { constructor(ctx) { super(ctx, 'selftestSharedHub') } }\nexport const name = 'x'\nexport function apply(ctx) { ctx.plugin(Hub) }\n"
fs.writeFileSync(path.join(sibA, 'src', 'index.js'), SHARED)
fs.writeFileSync(path.join(sibB, 'src', 'index.js'), SHARED)

function run(repo, only, extra = []) {
  const json = path.join(sandbox, `out-${Math.random().toString(36).slice(2)}.json`)
  const r = spawnSync(
    process.execPath,
    ['doctor.mjs', '--repo', repo, '--no-smoke', '--only', only, '--json', json, ...extra],
    { cwd: ROOT, stdio: 'ignore' },
  )
  let checks = -1
  if (fs.existsSync(json)) {
    try {
      checks = JSON.parse(fs.readFileSync(json, 'utf8')).results.length
    } catch {
      checks = -2
    }
  }
  return { exit: r.status, checks }
}

const MOJIBAKE = '闈欐€伮峰寘缁撴瀯,闈欐€伮穋ordis 濂戠害鎵弿' // 双重编码乱码（回归守卫）

const cases = [
  // ── 既有 7 例（0.1.x 契约，逐字不变）────────────────────────────────
  { label: 'good + --only "R,K"', repo: good, only: 'R,K', exit: 0, minChecks: 18 },
  { label: 'good + --only "r,k"（别名大小写不敏感）', repo: good, only: 'r,k', exit: 0, minChecks: 18 },
  { label: 'good + --only "R"', repo: good, only: 'R', exit: 0, minChecks: 9 },
  { label: 'good + 中文全名', repo: good, only: '静态·包结构', exit: 0, minChecks: 9 },
  { label: 'good + 未知分组 "NOPE" → 拒绝静默通过', repo: good, only: 'NOPE', exit: 2, minChecks: -1 },
  { label: 'good + 乱码分组 → 拒绝静默通过（回归守卫）', repo: good, only: MOJIBAKE, exit: 2, minChecks: -1 },
  { label: 'broken（无 dsh.bundle）→ 门禁失败', repo: broken, only: 'R,K', exit: 1, minChecks: 18 },
  // ── 本轮新增：降级语义（R-fix 0A/4）与用法守卫（R-fix 1）────────────
  { label: 'bare（无 src 无 lib）+ --only K → 降级 exit 6', repo: bare, only: 'K', exit: 6, minChecks: 9 },
  { label: 'bare + --allow-degraded → 降级显式接受为 0', repo: bare, only: 'K', exit: 0, minChecks: 9, extra: ['--allow-degraded'] },
  { label: 'good + --workspace <sandbox>（新增选项被识别）', repo: good, only: 'R', exit: 0, minChecks: 9, extra: ['--workspace', sandbox] },
]

let failed = 0
for (const c of cases) {
  const r = run(c.repo, c.only, c.extra ?? [])
  const ok = r.exit === c.exit && (c.minChecks < 0 || r.checks >= c.minChecks)
  if (!ok) failed++
  console.log(
    `${ok ? 'PASS' : 'FAIL'}  ${c.label}  exit=${r.exit}(期望 ${c.exit}) checks=${r.checks}${c.minChecks > 0 ? `(>=${c.minChecks})` : ''}`,
  )
}

// ── 用法守卫：未知选项 / 缺 --repo / --no-smoke 下请求 D 组（均为 exit 2）──
const usageCases = [
  { label: '未知选项 --bogus → exit 2（旧实现会静默劫持 --repo）', args: ['doctor.mjs', '--repo', good, '--bogus', 'x', '--no-smoke'] },
  { label: '缺 --repo → exit 2', args: ['doctor.mjs', '--no-smoke'] },
  { label: '--no-smoke 下请求 D 组 → exit 2（带明确提示）', args: ['doctor.mjs', '--repo', good, '--no-smoke', '--only', 'D'] },
]
for (const c of usageCases) {
  const r = spawnSync(process.execPath, c.args, { cwd: ROOT, stdio: 'ignore' })
  const ok = r.status === 2
  if (!ok) failed++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${c.label}  exit=${r.status}(期望 2)`)
}

// ── K14 跨仓注入点重名：命中 / 豁免 / 降级 三条路径 ──────────────────
{
  // K14 reads the K-group verdict from the JSON report, so probe with --json -.
  const probeK14 = (repo) => {
    const r = spawnSync(process.execPath, [path.join(ROOT, 'doctor.mjs'), '--repo', repo, '--workspace', family, '--no-smoke', '--only', 'K', '--json', '-'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 })
    try {
      const k14 = JSON.parse(r.stdout).results.find((x) => /^K14 /.test(x.name))
      return { exit: r.status, status: k14?.status, message: String(k14?.message ?? '') }
    } catch { return { exit: r.status, status: null, message: '' } }
  }

  // (a) genuine collision between two siblings → warn
  const collide = probeK14(sibA)
  const okCollide = collide.status === 'warn' && collide.message.includes('selftestSharedHub')
  if (!okCollide) failed++
  console.log(`${okCollide ? 'PASS' : 'FAIL'}  K14 兄弟仓同服务键 → warn  status=${collide.status}`)

  // (b) the same collision declared in package.json → exempted → pass
  const pkgPath = path.join(sibA, 'package.json')
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
  pkg['dsh-plugin-doctor'] = { crossPlugin: { exempt: [{ kind: 'service', name: 'selftestSharedHub', peer: 'dsh-selftest-beta', guard: '1.0.0' }] } }
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')
  const exempt = probeK14(sibA)
  const okExempt = exempt.status === 'pass'
  if (!okExempt) failed++
  console.log(`${okExempt ? 'PASS' : 'FAIL'}  K14 声明豁免后 → pass  status=${exempt.status}`)

  // (c) a workspace with no second plugin repo → skip, never a silent pass
  const lonely = fs.mkdtempSync(path.join(sandbox, 'lonely-'))
  const r = spawnSync(process.execPath, [path.join(ROOT, 'doctor.mjs'), '--repo', sibA, '--workspace', lonely, '--no-smoke', '--only', 'K', '--json', '-'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 })
  let lonelyStatus = null
  try { lonelyStatus = JSON.parse(r.stdout).results.find((x) => /^K14 /.test(x.name))?.status } catch { /* leave null */ }
  const okLonely = lonelyStatus === 'skip'
  if (!okLonely) failed++
  console.log(`${okLonely ? 'PASS' : 'FAIL'}  K14 工作区无第二个插件仓 → skip  status=${lonelyStatus}`)
  fs.rmSync(lonely, { recursive: true, force: true })
}

// ── --json - ：JSON 写 stdout，不落名为 "-" 的文件 ─────────────────────
{
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'doctor-dash-'))
  const r = spawnSync(process.execPath, [path.join(ROOT, 'doctor.mjs'), '--repo', good, '--no-smoke', '--only', 'R', '--json', '-'], { cwd, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 })
  let parsed = false
  try { parsed = Array.isArray(JSON.parse(r.stdout).results) } catch { parsed = false }
  const noDashFile = !fs.existsSync(path.join(cwd, '-'))
  const ok = r.status === 0 && parsed && noDashFile
  if (!ok) failed++
  console.log(`${ok ? 'PASS' : 'FAIL'}  --json - 输出纯 JSON 且不产生 "-" 文件  exit=${r.status}`)
  fs.rmSync(cwd, { recursive: true, force: true })
}

const total = cases.length + usageCases.length + 1
fs.rmSync(sandbox, { recursive: true, force: true })
console.log(`\nselftest: ${total - failed}/${total} passed`)
if (failed > 0) process.exitCode = 1
