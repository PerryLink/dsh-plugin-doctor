// dsh-plugin-doctor 自检：真实调用 CLI，断言退出码契约与"防静默通过"行为。
// 全部在 %TEMP% mkdtemp 沙箱内构造 fixture，不触碰任何真实仓库。
// 用法: node tests/selftest.mjs
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-doctor-selftest-'))

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

function makeFixture(dir, { broken = false } = {}) {
  fs.mkdirSync(path.join(dir, 'lib'), { recursive: true })
  const pkg = structuredClone(GOOD_PKG)
  if (broken) delete pkg.dsh
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify(pkg, null, 2) + '\n')
  fs.writeFileSync(path.join(dir, 'lib', 'index.js'), ENTRY)
  fs.writeFileSync(path.join(dir, 'cordis.patch.yml'), PATCH)
  fs.writeFileSync(path.join(dir, 'README.md'), '# fixture\n')
  fs.writeFileSync(path.join(dir, 'LICENSE'), 'Apache-2.0\n')
}

const good = path.join(sandbox, 'good')
const broken = path.join(sandbox, 'broken')
makeFixture(good)
makeFixture(broken, { broken: true })

function run(repo, only) {
  const json = path.join(sandbox, `out-${Math.random().toString(36).slice(2)}.json`)
  const r = spawnSync(
    process.execPath,
    ['doctor.mjs', '--repo', repo, '--no-smoke', '--only', only, '--json', json],
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
  { label: 'good + --only "R,K"', repo: good, only: 'R,K', exit: 0, minChecks: 18 },
  { label: 'good + --only "r,k"（别名大小写不敏感）', repo: good, only: 'r,k', exit: 0, minChecks: 18 },
  { label: 'good + --only "R"', repo: good, only: 'R', exit: 0, minChecks: 9 },
  { label: 'good + 中文全名', repo: good, only: '静态·包结构', exit: 0, minChecks: 9 },
  { label: 'good + 未知分组 "NOPE" → 拒绝静默通过', repo: good, only: 'NOPE', exit: 2, minChecks: -1 },
  { label: 'good + 乱码分组 → 拒绝静默通过（回归守卫）', repo: good, only: MOJIBAKE, exit: 2, minChecks: -1 },
  { label: 'broken（无 dsh.bundle）→ 门禁失败', repo: broken, only: 'R,K', exit: 1, minChecks: 18 },
]

let failed = 0
for (const c of cases) {
  const r = run(c.repo, c.only)
  const ok = r.exit === c.exit && (c.minChecks < 0 || r.checks >= c.minChecks)
  if (!ok) failed++
  console.log(
    `${ok ? 'PASS' : 'FAIL'}  ${c.label}  exit=${r.exit}(期望 ${c.exit}) checks=${r.checks}${c.minChecks > 0 ? `(>=${c.minChecks})` : ''}`,
  )
}

fs.rmSync(sandbox, { recursive: true, force: true })
console.log(`\nselftest: ${cases.length - failed}/${cases.length} passed`)
if (failed > 0) process.exitCode = 1
