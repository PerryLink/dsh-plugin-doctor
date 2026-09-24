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

// ── 空 patch 层：官方生成的 profile 模板就是 `[]` ────────────────────────────
// harness 自己写新 profile 时用的模板是空数组（app-boot/src/profile.ts:193-197，
// 注释："a top-level YAML array of loader patch entries"），官方 patch schema 也是
// 数组（vendor/include/src/index.ts:23）。一个不挂载任何行的组合包（纯库、只为走
// bundle 通道）因此是正当形态，R3 不得判 fail。
const emptyPatch = path.join(sandbox, 'empty-patch')
makeFixture(emptyPatch, { src: false, lib: true })
fs.writeFileSync(path.join(emptyPatch, 'cordis.patch.yml'), '# comment only\n[]\n')

// 反向夹具：patch 有内容却没有 insert 结构 / id 行 —— 这是真缺陷。
const badPatch = path.join(sandbox, 'bad-patch')
makeFixture(badPatch, { src: false, lib: true })
fs.writeFileSync(path.join(badPatch, 'cordis.patch.yml'), 'this: is not a patch list\n')

// ── 纯 JS 包把 main 指向自己的 src/ ─────────────────────────────────────────
// 官方口径（publish.md:167）：git 安装取源码、不跑 build，所以 **TypeScript** 包必须
// 预构建；纯 JS 包直接发布源码是正常并可用的形态（该文档示例入口就是 "index.js"）。
const plainJsSrcMain = path.join(sandbox, 'plain-js-src-main')
makeFixture(plainJsSrcMain, { src: false, lib: false })
{
  fs.mkdirSync(path.join(plainJsSrcMain, 'src'), { recursive: true })
  fs.writeFileSync(path.join(plainJsSrcMain, 'src', 'plugin.js'), ENTRY)
  const p = JSON.parse(fs.readFileSync(path.join(plainJsSrcMain, 'package.json'), 'utf8'))
  p.main = './src/plugin.js'
  p.files = ['src', 'cordis.patch.yml', 'README.md', 'LICENSE']
  // Remove the build script: this fixture is a plain-JS package with no build
  // step at all. `dsh.bundle.patch` stays, so R1 still passes and this fixture
  // isolates R3/R7.
  delete p.scripts.build
  fs.writeFileSync(path.join(plainJsSrcMain, 'package.json'), JSON.stringify(p, null, 2) + '\n')
}

// 反向夹具：有 TS 源码、main 指向 src/、没有构建步骤 —— 这是真缺陷，npm 会发布出
// 宿主无法加载的 .ts。needsBuild() 必须把它判为需要构建。
const tsSrcMainNoBuild = path.join(sandbox, 'ts-src-main-no-build')
makeFixture(tsSrcMainNoBuild, { src: true, lib: false })
{
  const p = JSON.parse(fs.readFileSync(path.join(tsSrcMainNoBuild, 'package.json'), 'utf8'))
  p.main = './src/index.ts'
  p.files = ['src', 'cordis.patch.yml', 'README.md', 'LICENSE']
  delete p.scripts.build
  fs.writeFileSync(path.join(tsSrcMainNoBuild, 'package.json'), JSON.stringify(p, null, 2) + '\n')
}

const withSrc = path.join(sandbox, 'with-src')   // src/ + lib/：常规源码树
const libOnly = path.join(sandbox, 'lib-only')   // 无 src/ 有 lib/ 且带 build 脚本：= 已发布产物形态
const bare = path.join(sandbox, 'bare')          // 无 src/ 无 lib/：K 组结构性不可跑
makeFixture(withSrc, { src: true, lib: true })
makeFixture(libOnly, { src: false, lib: true })
makeFixture(bare, { src: false, lib: false })

// 未构建的源码树：main 指向 lib/ 产物，lib/ 不存在，files 已声明且覆盖它。
// 这是最常见的第三方形态（仓库不提交构建产物），R2/R4 必须报「环境未构建」，
// 绝不能报 plugin-defect —— 实测 15 个家族仓里有 4 个曾因此被判「插件缺陷」。
const unbuilt = path.join(sandbox, 'unbuilt')
makeFixture(unbuilt, { src: true, lib: false })

// 反向夹具：构建产物不在 files 白名单内 —— 这是真缺陷，构建后依然存在，
// 必须继续 fail，不能因为「没构建」被一并放过。
const unbuiltBadFiles = path.join(sandbox, 'unbuilt-bad-files')
makeFixture(unbuiltBadFiles, { src: true, lib: false })
{
  const p = JSON.parse(fs.readFileSync(path.join(unbuiltBadFiles, 'package.json'), 'utf8'))
  p.files = ['cordis.patch.yml', 'README.md', 'LICENSE']   // lib/ 不在白名单
  fs.writeFileSync(path.join(unbuiltBadFiles, 'package.json'), JSON.stringify(p, null, 2) + '\n')
}

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

// ── 观测 6：未构建的源码树上 R2/R4 属「环境」而非「插件缺陷」───────────────
// 这两项读构建产物；仓库不提交产物时它们缺席是构造性的，不是缺陷。
// 旧实现在 15 个家族仓里把 4 个误判为 plugin-defect。
const unbuiltRun = run(unbuilt, ['--no-smoke', '--only', 'R,K'])
const unbuiltRes = unbuiltRun.report?.results ?? []
for (const id of ['R2', 'R4']) {
  const r = unbuiltRes.find((x) => x.id === id)
  assert(`未构建树 ${id} 判为 skip`, r?.status === 'skip', `实际 ${r?.status ?? '(缺此项)'}`)
  assert(`未构建树 ${id} category=environment`, r?.category === 'environment', `实际 ${r?.category}`)
  assert(`未构建树 ${id} 不计作缺陷`, !(r?.status === 'fail' || r?.status === 'error'), `实际 ${r?.status}`)
}
const unbuiltBad = (unbuiltRes.filter((x) => !/^R[24] /.test(x.name)) || [])
  .filter((x) => x.status === 'fail' || x.status === 'error')
assert('未构建树不产生任何 gated 失败', unbuiltBad.length === 0, unbuiltBad.map((x) => x.name).join(', '))

// ── 观测 7：产物不在 files 白名单 → 即使未构建也继续 fail ──────────────────
// 「没构建」不能成为真缺陷的免罪符：构建后该缺陷依然存在。
const badFilesRun = run(unbuiltBadFiles, ['--no-smoke', '--only', 'R,K'])
const badFilesRes = badFilesRun.report?.results ?? []
const r7bad = badFilesRes.find((x) => x.id === 'R7')
assert('files 未覆盖产物 → R7 fail（不受未构建影响）', r7bad?.status === 'fail', `实际 ${r7bad?.status}`)
const r2bad = badFilesRes.find((x) => x.id === 'R2')
assert('files 未覆盖产物 → R2 不伪装成 environment', r2bad?.category !== 'environment', `实际 category=${r2bad?.category} status=${r2bad?.status}`)

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

// ── 观测 8：空 patch 层合法，非空但与 patch 语义不符才是缺陷 ────────────────
const emptyPatchRun = run(emptyPatch, ['--no-smoke', '--only', 'R,K'])
const emptyR3 = (emptyPatchRun.report?.results ?? []).find((x) => x.id === 'R3')
assert('空 patch [] → R3 pass（官方模板就是 []）', emptyR3?.status === 'pass', `实际 ${emptyR3?.status}`)

const badPatchRun = run(badPatch, ['--no-smoke', '--only', 'R,K'])
const badR3 = (badPatchRun.report?.results ?? []).find((x) => x.id === 'R3')
assert('非空但无 insert/id 的 patch → R3 fail', badR3?.status === 'fail', `实际 ${badR3?.status}`)

// ── 观测 9：纯 JS 包 main 指向 src/ 合法；TS 包没有构建步骤才是缺陷 ─────────
const plainRun = run(plainJsSrcMain, ['--no-smoke', '--only', 'R,K'])
const plainRes = plainRun.report?.results ?? []
const plainR7 = plainRes.find((x) => x.id === 'R7')
assert('纯 JS 包 main→src/ 且无构建 → R7 pass', plainR7?.status === 'pass', `实际 ${plainR7?.status} :: ${String(plainR7?.message).slice(0, 80)}`)
const plainGated = plainRes.filter((x) => !/^R[24] /.test(x.name) && (x.status === 'fail' || x.status === 'error'))
assert('纯 JS 包不产生任何 gated 失败', plainGated.length === 0, plainGated.map((x) => x.name).join(', '))

const tsRun = run(tsSrcMainNoBuild, ['--no-smoke', '--only', 'R,K'])
const tsR7 = (tsRun.report?.results ?? []).find((x) => x.id === 'R7')
assert('TS 包 main→src/ 且无构建 → R7 fail', tsR7?.status === 'fail', `实际 ${tsR7?.status}`)

// ── 观测 10：R8 区分「点名了被取代的线」（fail）与「单臂指向当前线」（warn）──
// 旧实现把两者都判 fail，于是一条在范围写就之后才加入的规则，把 dsh-ticktick
// 的门禁从 0.1.6 的 PASS 变成 0.3.1 的 FAIL —— 而那是「选择支持哪条宿主线」，
// 不是缺陷。被取代的线仍然 fail，因为那才是 OR 形式要修的静默陷阱。
const stalePeer = path.join(sandbox, 'stale-peer')
makeFixture(stalePeer, { src: true, lib: true })
{
  const p = JSON.parse(fs.readFileSync(path.join(stalePeer, 'package.json'), 'utf8'))
  // 0.1.2-alpha.* is on the superseded list; 0.1.5-alpha.1 is not, which is why
  // this fixture must name an actually-superseded line to exercise the fail path.
  p.peerDependencies = { '@deepseek-ai/dsh-tools': '>=0.1.2-alpha.3 <0.2.0' }
  fs.writeFileSync(path.join(stalePeer, 'package.json'), JSON.stringify(p, null, 2) + '\n')
}
const singleArmPeer = path.join(sandbox, 'single-arm-peer')
makeFixture(singleArmPeer, { src: true, lib: true })
{
  const p = JSON.parse(fs.readFileSync(path.join(singleArmPeer, 'package.json'), 'utf8'))
  p.peerDependencies = { '@deepseek-ai/dsh-tools': '>=0.1.7-alpha.1 <0.2.0' }
  fs.writeFileSync(path.join(singleArmPeer, 'package.json'), JSON.stringify(p, null, 2) + '\n')
}

const staleRun = run(stalePeer, ['--no-smoke', '--only', 'R,K'])
const staleR8 = (staleRun.report?.results ?? []).find((x) => x.id === 'R8')
assert('R8 点名被取代的线 → fail', staleR8?.status === 'fail', `实际 ${staleR8?.status}`)
assert('R8 的 fail 也归类为 policy（它的首行自述「不是插件缺陷」）',
  staleR8?.category === 'policy',
  `实际 category=${staleR8?.category}`)

const singleRun = run(singleArmPeer, ['--no-smoke', '--only', 'R,K'])
const singleR8 = (singleRun.report?.results ?? []).find((x) => x.id === 'R8')
assert('R8 单臂指向当前线 → warn（不判缺陷）', singleR8?.status === 'warn', `实际 ${singleR8?.status}`)
assert('R8 单臂 warn 不产生 gated 失败', (() => {
  const g = (singleRun.report?.results ?? []).filter((x) => !/^R[24] /.test(x.name))
  return g.every((x) => x.status !== 'fail' && x.status !== 'error')
})(), (singleRun.report?.results ?? []).filter((x) => x.status === 'fail').map((x) => x.id).join(','))
assert('R8 单臂 → exit 0（门禁不再因它变红）', singleRun.exit === 0, `实际 ${singleRun.exit}`)

// ── 观测 12：open-top `>=` 必须告警，而 caret 不得误报 ──
// `>=0.1.0-rc.1` 无上界，会放行 0.5.0 / 1.0.0，未来破坏性主线被静默接受。
// `^0.1.0-rc.1` 没有这个问题：caret 是 semver 语法糖，等价于 >=0.1.0-rc.1 <0.2.0，
// 有界，只是字符串里不含 "<"。2026-09-24 实测 22 个第三方 DSH 仓，caret 是通行写法，
// 所以这条断言的两个方向都重要：漏报会放过真缺陷，误报会指责生态的常规写法。
const openTopPeer = path.join(sandbox, 'open-top-peer')
makeFixture(openTopPeer, { src: true, lib: true })
{
  const p = JSON.parse(fs.readFileSync(path.join(openTopPeer, 'package.json'), 'utf8'))
  p.peerDependencies = { '@deepseek-ai/dsh-tools': '>=0.0.1-rc.1' }
  fs.writeFileSync(path.join(openTopPeer, 'package.json'), JSON.stringify(p, null, 2) + '\n')
}
const caretPeer = path.join(sandbox, 'caret-peer')
makeFixture(caretPeer, { src: true, lib: true })
{
  const p = JSON.parse(fs.readFileSync(path.join(caretPeer, 'package.json'), 'utf8'))
  p.peerDependencies = { '@deepseek-ai/cordis': '^4.0.4' }
  fs.writeFileSync(path.join(caretPeer, 'package.json'), JSON.stringify(p, null, 2) + '\n')
}

const openRun = run(openTopPeer, ['--no-smoke', '--only', 'R'])
const openR8 = (openRun.report?.results ?? []).find((x) => x.id === 'R8')
assert('R8 open-top >= 且无上界 → warn', openR8?.status === 'warn', `实际 ${openR8?.status}`)
assert('R8 open-top 的说明指向 caret 或上界',
  /open-top|无上界/.test(String(openR8?.message ?? '')),
  `实际说明：${String(openR8?.message ?? '').slice(0, 80)}`)
assert('R8 区间 warn 归类为 policy，而非 plugin-defect',
  openR8?.category === 'policy',
  `实际 category=${openR8?.category}（warn 默认是 plugin-defect，与该条自述「不是缺陷」矛盾）`)

const caretRun = run(caretPeer, ['--no-smoke', '--only', 'R'])
const caretR8 = (caretRun.report?.results ?? []).find((x) => x.id === 'R8')
assert('R8 caret 区间有界 → 不得误报（生态通行写法）', caretR8?.status === 'pass', `实际 ${caretR8?.status}`)

fs.rmSync(sandbox, { recursive: true, force: true })

// ── 观测 11：门禁模板必须从检出之外运行 ──
// `npm exec` 先拿命令名去比对当前 package.json 的 bin，因此在声明了同名 bin 的仓里
// 运行会去调本地那个 bin；检出里没有 node_modules 时就是 `sh: 1: ... not found`、
// exit 127。本仓恰好声明了 {"dsh-plugin-doctor": "./doctor.mjs"} —— 于是 42 个仓的
// 门禁都是绿的，只有本仓自己的红。模板必须 cd /tmp，并用绝对路径回指检出。
{
  const tpl = fs.readFileSync(path.join(ROOT, 'plugin-doctor.yml'), 'utf8')
  const wf = fs.readFileSync(path.join(ROOT, '.github', 'workflows', 'plugin-doctor.yml'), 'utf8')
  assert('门禁模板先 cd /tmp 再跑 npx（否则自指 bin 解析 exit 127）', /^\s*cd \/tmp\s*$/m.test(tpl), '模板里没有 cd /tmp')
  assert('门禁模板用 $GITHUB_WORKSPACE 绝对路径回指检出', tpl.includes('--repo "$GITHUB_WORKSPACE"'), '仍是相对 --repo .')
  assert('仓内工作流与根模板逐字节一致', tpl === wf, 'plugin-doctor.yml 与 .github/workflows/ 下的副本已漂移')
}

let failed = 0
for (const c of checks) {
  if (!c.ok) failed++
  console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.name}${c.detail ? `  — ${c.detail}` : ''}`)
}
console.log(`\ncontract: ${checks.length - failed}/${checks.length} passed`)
if (failed > 0) process.exitCode = 1
