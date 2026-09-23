// SPEC.md 漂移守卫。
//
// 为什么需要它：SPEC.md 现在是判据的规范正文，也因此成了第二个真相来源。
// 代码改了而 SPEC 没改（或反过来），规范就会开始说谎——而对一份规范来说，
// 「说的和做的不一致」是比功能缺失更严重的缺陷：第三方按 SPEC 引用 §K3，
// 得到的必须是实现真正在做的 K3。
//
// 本测试把 SPEC.md 里可机读的三处声明与实现对齐：
//   ① §4 逐项列出的检测项 ID  ⇄  实现注册的 ID（集合相等，两个方向都查）
//   ② §1 声明的门禁集合        ⇄  实际门禁（排除 R2/R4）
//   ③ §2 声明的唯一 critical   ⇄  opts.critical 实际只有 R1
//
// 用法: node tests/spec-drift.mjs
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { parseGateList } from './spec-id-token.mjs'

const ROOT = path.resolve(import.meta.dirname, '..')
const readme = fs.readFileSync(path.join(ROOT, 'SPEC.md'), 'utf8')

const checks = []
const assert = (name, cond, detail = '') => checks.push({ name, ok: !!cond, detail })

// ── 取实现真值：干净 fixture 上跑全组 ─────────────────────────────────────
const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'doctor-specdrift-'))
const fixture = path.join(sandbox, 'fixture')
fs.mkdirSync(path.join(fixture, 'src'), { recursive: true })
fs.mkdirSync(path.join(fixture, 'lib'), { recursive: true })
const ENTRY = "export const name = 'spec-drift-fixture'\nexport function apply(ctx) { void ctx }\n"
fs.writeFileSync(path.join(fixture, 'src', 'index.ts'), ENTRY)
fs.writeFileSync(path.join(fixture, 'lib', 'index.js'), ENTRY)
fs.writeFileSync(path.join(fixture, 'package.json'), JSON.stringify({
  name: 'spec-drift-fixture',
  version: '1.0.0',
  type: 'module',
  main: 'lib/index.js',
  files: ['lib/', 'cordis.patch.yml', 'README.md', 'LICENSE'],
  engines: { node: '^22.19.0 || >=24.0.0' },
  license: 'Apache-2.0',
  dsh: { bundle: { patch: './cordis.patch.yml' } },
}, null, 2) + '\n')
fs.writeFileSync(path.join(fixture, 'cordis.patch.yml'), '- insert:\n    - id: spec-drift-fixture\n      name: spec-drift-fixture\n')
fs.writeFileSync(path.join(fixture, 'README.md'), '# fixture\n')
fs.writeFileSync(path.join(fixture, 'LICENSE'), 'Apache-2.0\n')

const jsonPath = path.join(sandbox, 'out.json')
// Only the R+K groups run here. The gate defined in SPEC §1 is a subset of them,
// so R+K is exactly what needs checking; running D would require network and
// pnpm, and a spec-drift guard must stay offline and deterministic.
const run = spawnSync(process.execPath, [
  'doctor.mjs', '--repo', fixture, '--no-smoke', '--only', 'R,K', '--json', jsonPath,
], { cwd: ROOT, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 })
const report = fs.existsSync(jsonPath) ? JSON.parse(fs.readFileSync(jsonPath, 'utf8')) : null
const results = report?.results ?? []

assert('实现可运行并产出结果', results.length > 0, `results=${results.length}`)

const implIds = results.map((r) => r.id).filter(Boolean)
const implGated = results.filter((r) => r.status !== undefined && !/^R[24] /.test(r.name)).map((r) => r.id)
const implBuildDep = results.filter((r) => /^R[24] /.test(r.name)).map((r) => r.id)
const implCritical = results.filter((r) => r.critical).map((r) => r.id)

// ── 从 SPEC.md 解析声明 ───────────────────────────────────────────────────

/** §4 的逐项小节标题形如 "#### R0 — Base manifest fields"。 */
const declaredIds = [...readme.matchAll(/^####\s+([A-Z]{1,3}\d+)\s/gmu)].map((m) => m[1])

/**
 * §1「The canonical gate」是唯一声明门禁集合的地方，形如：
 *   The reference project's own gate is
 *     `R0, R1, R3, R5, R6, R7, R8, K1–K9` (16 checks), deliberately excluding `R2`
 *     and `R4`, which read **built** artifacts.
 * 取该句中第一段反引号列表：它要么是单个 ID，要么是 `K1–K9` 这样的区间（en dash），
 * 区间展开成逐项。排除项来自同一句的 "excluding `R2` and `R4`"。
 */
const gateSentence = readme.match(/The reference project's own gate is([\s\S]*?which read[\s\S]*?)\.\s/u)?.[1] ?? ''

/** `K1–K9` / `K1-K9` -> ['K1',...,'K9']；`R0` -> ['R0']。实现见 spec-id-token.mjs。 */

const declaredGated = parseGateList(gateSentence.match(/`([^`]+)`/u)?.[1] ?? '')
const declaredGateExcluded = [...(gateSentence.match(/excluding([\s\S]*)$/u)?.[1] ?? '')
  .matchAll(/`([A-Z]{1,3}\d+)`/gu)].map((m) => m[1])

/** §2「currently only `R1`」。 */
const declaredCritical = [...(readme.match(/\*\*`critical`\*\*\s*—\s*currently only\s*`([A-Z]{1,3}\d+)`/u)?.[1] ?? '')
  .matchAll(/[A-Z]{1,3}\d+/g)].map((m) => m[0])

// ── ① 检测项 ID 集合必须双向相等 ─────────────────────────────────────────
// Scope: the R and K groups, i.e. everything the SPEC §1 gate can reference.
// D and CC are registered by the same code path but are not run here (D needs
// network + pnpm); their presence is asserted separately below, from the §4
// headings, so a check deleted from the spec still fails this test.
assert('SPEC §4 解析出检测项 ID', declaredIds.length > 0, `declared=${declaredIds.length}`)
assert(
  'SPEC §4 覆盖全部四组（28 项）',
  declaredIds.length === 28,
  `declared=${declaredIds.length}`,
)

const declaredRk = declaredIds.filter((id) => /^[RK]/.test(id))
const missingInSpec = implIds.filter((id) => !declaredIds.includes(id))
const missingInImpl = declaredRk.filter((id) => !implIds.includes(id))
assert(
  '实现注册的每个 ID 都在 SPEC §4 有条目',
  missingInSpec.length === 0,
  `SPEC 缺少: ${missingInSpec.join(', ') || '(none)'}`,
)
assert(
  'SPEC §4 的每个 R/K ID 都有实现',
  missingInImpl.length === 0,
  `实现缺少: ${missingInImpl.join(', ') || '(none)'}`,
)
assert(
  'SPEC §4 无重复条目',
  new Set(declaredIds).size === declaredIds.length,
  `共 ${declaredIds.length} 条，去重后 ${new Set(declaredIds).size}`,
)

// ── ② 门禁集合必须与实际一致 ─────────────────────────────────────────────
assert('SPEC §1 解析出门禁集合', declaredGated.length > 0, `declared=${declaredGated.length}`)
assert('SPEC §1 解析出门禁排除项', declaredGateExcluded.length > 0, `declared=${declaredGateExcluded.length}`)

const gateSetMismatch = []
for (const id of declaredGated) if (!implGated.includes(id)) gateSetMismatch.push(`${id} 声明为门禁但实现未门禁`)
for (const id of implGated) if (!declaredGated.includes(id)) gateSetMismatch.push(`${id} 实现门禁但 SPEC 未声明`)
for (const id of declaredGateExcluded) if (!implBuildDep.includes(id)) gateSetMismatch.push(`${id} 声明为排除但实现未排除`)
assert('门禁集合与 SPEC §1 逐项一致', gateSetMismatch.length === 0, gateSetMismatch.join('; '))
assert(
  '门禁项数 = SPEC 声明条数',
  implGated.length === declaredGated.length,
  `实现 ${implGated.length} vs SPEC ${declaredGated.length}`,
)

// ── ③ critical 必须只有 SPEC 声明的那一个 ────────────────────────────────
assert('SPEC §2 解析出 critical 项', declaredCritical.length === 1, `declared=${declaredCritical.join(',') || '(none)'}`)
assert(
  'critical 集合与 SPEC §2 一致',
  implCritical.length === declaredCritical.length && implCritical.every((id) => declaredCritical.includes(id)),
  `实现 [${implCritical.join(',')}] vs SPEC [${declaredCritical.join(',')}]`,
)

// ── ④ SPEC 自身必须署名作者 ──────────────────────────────────────────────
assert('SPEC.md 声明 PerryLink 为作者', /PerryLink/u.test(readme))
assert('SPEC.md 带 spec 版本', /Spec version\*\*\s*\|\s*`v1`/u.test(readme) || /`v1`/u.test(readme))

// ── 输出 ─────────────────────────────────────────────────────────────────
let failed = 0
for (const c of checks) {
  if (!c.ok) failed++
  console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.name}${c.detail ? `  — ${c.detail}` : ''}`)
}
console.log(`\nspec-drift: ${checks.length - failed}/${checks.length} passed`)
if (failed > 0) process.exit(1)
