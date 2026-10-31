// lib/standards.mjs 的单元测试（零依赖，只用 node:assert）。
//
// 这里冻结的是「投影规则」本身，不是某一次真实运行：ENTRY 的 runtime / static /
// failed / not-run 四态、skip 绝不算 pass、以及 FLOW/BOOST 恒为 manual /
// not-measured。规则一旦被"顺手优化"成假绿，本测试必须先红。
//
// 用法: node tests/standards.mjs
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { summarizeGroups } from '../lib/framework.mjs'
import { deriveStandards, SCHEMA, ENTRY_GROUPS, RUNTIME_EVIDENCE_IDS } from '../lib/standards.mjs'

// ── 测试运行器：与仓内其它 tests/*.mjs 同样的 PASS/FAIL 输出 ───────────────
const checks = []
const test = (name, fn) => {
  try {
    fn()
    checks.push({ name, ok: true })
    console.log(`PASS  ${name}`)
  } catch (err) {
    checks.push({ name, ok: false })
    console.log(`FAIL  ${name}\n      ${String(err?.message ?? err).split('\n')[0]}`)
  }
}

// ── 夹具：results 的形状与 Doctor.run() 的输出一致（id / name 前缀 / groupId）──
const GROUP_OF = (id) => /^([A-Z]{1,3})\d+$/.exec(id)?.[1] ?? '?'

/** [id, status, extra?] → 一条 doctor 结果项 */
const check = ([id, status, extra = {}]) => ({
  id,
  name: `${id} fixture check`,
  groupId: GROUP_OF(id),
  group: `${GROUP_OF(id)} fixture group`,
  status,
  ...extra,
})

/** { R: [[...]], K: [[...]] } → { results, groups } */
function scenario(spec) {
  const results = Object.entries(spec).flatMap(([, items]) => items.map(check))
  return { results, groups: summarizeGroups(results) }
}

const CLEAN_STATIC = {
  R: [['R0', 'pass'], ['R1', 'pass'], ['R2', 'skip'], ['R5', 'skip'], ['R8', 'warn']],
  K: [['K1', 'pass'], ['K2', 'pass'], ['K3', 'warn']],
}

const CLEAN_RUNTIME = {
  ...CLEAN_STATIC,
  D: [['D0', 'pass'], ['D1', 'pass'], ['D2', 'pass'], ['D3', 'pass'], ['D9', 'pass']],
}

const run = (spec) => {
  const { results, groups } = scenario(spec)
  return { results, groups, standards: deriveStandards(results, groups) }
}

// ── 1. runtime：R/K 有实跑项 + D0–D3 全跑且无 fail/error ───────────────────
test('runtime：R/K 实跑 + D0–D3 实跑 + 无 fail/error ⇒ entry.status = runtime', () => {
  const { standards } = run(CLEAN_RUNTIME)
  assert.equal(standards.schema, SCHEMA)
  assert.equal(standards.nonOfficial, true)
  assert.equal(standards.levels.entry.status, 'runtime')
  const d = standards.levels.entry.evidence.D
  assert.equal(d.status, 'pass')
  assert.equal(d.total, 5)
  assert.equal(d.ran, 5)
  assert.equal(d.skipped, 0)
  assert.deepEqual(d.failed, [])
  assert.deepEqual(d.skippedChecks, [])
})

test('R/K 的个体 skip 不阻止 runtime，但会如实留在证据里（skip 不是 pass）', () => {
  const { standards } = run(CLEAN_RUNTIME)
  const r = standards.levels.entry.evidence.R
  assert.equal(r.ran, 3)          // R0 R1 R8
  assert.equal(r.skipped, 2)      // R2 R5
  assert.deepEqual(r.skippedChecks, ['R2', 'R5'])
  assert.notEqual(r.status, 'pass') // 组内有 skip/warn，就绝不显示 pass
  assert.equal(standards.levels.entry.status, 'runtime')
})

test('warn 不是 fail：K 组 warn 仍可 runtime', () => {
  const { standards } = run(CLEAN_RUNTIME)
  assert.equal(standards.levels.entry.evidence.K.status, 'warn')
  assert.equal(standards.levels.entry.status, 'runtime')
})

// ── 2. static：R/K 干净，但 D 组根本没跑（--no-smoke）──────────────────────
test('static：R/K 实跑且无 fail/error，D 组未参与本次运行 ⇒ static', () => {
  const { standards } = run(CLEAN_STATIC)
  assert.equal(standards.levels.entry.status, 'static')
  const d = standards.levels.entry.evidence.D
  assert.equal(d.status, 'not-run')
  assert.equal(d.total, 0)
  assert.equal(d.ran, 0)
  assert.match(standards.levels.entry.note, /incomplete/)
  assert.match(standards.levels.entry.note, /not a pass/)
})

test('static：D 组只跑了 D0/D9、D1–D3 因缺 pnpm 跳过 ⇒ static，绝不冒充 runtime', () => {
  const { standards } = run({
    ...CLEAN_STATIC,
    D: [
      ['D0', 'pass'],
      ['D1', 'skip', { category: 'environment' }],
      ['D2', 'skip'],
      ['D3', 'skip'],
      ['D9', 'pass'],
    ],
  })
  assert.equal(standards.levels.entry.status, 'static')
  const d = standards.levels.entry.evidence.D
  assert.equal(d.ran, 2)
  assert.equal(d.skipped, 3)
  assert.deepEqual(d.skippedChecks, ['D1', 'D2', 'D3'])
  assert.match(standards.levels.entry.note, /D1, D2, D3/)
})

// ── 3. failed：fail / error / critical fail / 非插件归属的 fail ─────────────
test('failed：任一 R/K/D 结果是 fail ⇒ failed，并点名失败项', () => {
  const { standards } = run({
    ...CLEAN_RUNTIME,
    R: [['R0', 'pass'], ['R2', 'fail']],
  })
  assert.equal(standards.levels.entry.status, 'failed')
  assert.deepEqual(standards.levels.entry.evidence.R.failed, ['R2'])
  assert.match(standards.levels.entry.note, /R2/)
})

test('failed：error 也算失败（doctor 内部错误不得被当成通过）', () => {
  const { standards } = run({
    ...CLEAN_RUNTIME,
    K: [['K1', 'error', { category: 'doctor-internal' }]],
  })
  assert.equal(standards.levels.entry.status, 'failed')
  assert.deepEqual(standards.levels.entry.evidence.K.failed, ['K1'])
})

test('failed：关键项失败 ⇒ failed，且证据里保留 criticalFailed', () => {
  const { standards } = run({
    ...CLEAN_RUNTIME,
    R: [['R0', 'pass'], ['R1', 'fail', { critical: true }]],
  })
  assert.equal(standards.levels.entry.status, 'failed')
  assert.deepEqual(standards.levels.entry.evidence.R.criticalFailed, ['R1'])
  assert.match(standards.levels.entry.note, /Critical/)
})

test('failed：环境类 category 仍记 failed，但标注 notAttributable（不把宿主故障说成插件缺陷）', () => {
  const { standards } = run({
    ...CLEAN_STATIC,
    D: [
      ['D0', 'pass'],
      ['D1', 'fail', { category: 'unsupported-host' }],
      ['D2', 'skip'],
      ['D3', 'skip'],
      ['D9', 'pass'],
    ],
  })
  assert.equal(standards.levels.entry.status, 'failed')
  assert.deepEqual(standards.levels.entry.evidence.D.notAttributable, ['D1'])
  assert.match(standards.levels.entry.note, /blocked/)
})

test('failed：无法解析 ID 的 fail 仍判 failed（不能因为没有名字就滑过去）', () => {
  const results = [
    { name: 'mystery failure', groupId: 'R', status: 'fail' },
    { id: 'K1', name: 'K1 fixture check', groupId: 'K', status: 'pass' },
  ]
  const standards = deriveStandards(results)
  assert.equal(standards.levels.entry.status, 'failed')
  assert.deepEqual(standards.levels.entry.evidence.R.failed, [])
  assert.match(standards.levels.entry.note, /no parseable id/)
})

test('failed：无法解析 ID 的 critical fail 仍判 failed，并注明 unidentified', () => {
  const results = [
    { name: 'critical mystery', groupId: 'R', status: 'error', critical: true },
    { id: 'K1', name: 'K1 fixture check', groupId: 'K', status: 'pass' },
  ]
  const standards = deriveStandards(results)
  assert.equal(standards.levels.entry.status, 'failed')
  assert.match(standards.levels.entry.note, /Critical check\(s\) failed: \(unidentified\)/)
})

// ── 4. not-run：全 skip / 空结果 / 静态层没真正求值 ────────────────────────
test('not-run：三组全部 skip ⇒ not-run（skip 绝不被算成 pass）', () => {
  const { standards } = run({
    R: [['R0', 'skip'], ['R1', 'skip']],
    K: [['K1', 'skip']],
    D: [['D0', 'skip']],
  })
  assert.equal(standards.levels.entry.status, 'not-run')
  for (const group of ENTRY_GROUPS) {
    assert.equal(standards.levels.entry.evidence[group].ran, 0)
    assert.equal(standards.levels.entry.evidence[group].status, 'skip')
  }
})

test('not-run：空结果 ⇒ not-run，不是 pass', () => {
  const standards = deriveStandards([], {})
  assert.equal(standards.levels.entry.status, 'not-run')
  for (const group of ENTRY_GROUPS) {
    assert.equal(standards.levels.entry.evidence[group].status, 'not-run')
  }
})

test('skip-is-not-pass：R 组整组 skip，即使 D 链跑通也不能给 runtime', () => {
  const { standards } = run({
    R: [['R0', 'skip'], ['R1', 'skip'], ['R2', 'skip']],
    K: [['K1', 'pass']],
    D: [['D0', 'pass'], ['D1', 'pass'], ['D2', 'pass'], ['D3', 'pass'], ['D9', 'pass']],
  })
  assert.equal(standards.levels.entry.status, 'not-run')
  assert.notEqual(standards.levels.entry.status, 'runtime')
  assert.match(standards.levels.entry.note, /R ran 0\/3/)
})

test('skip-is-not-pass：D 链只有 D9（清理）实跑，不能构成 runtime', () => {
  const { standards } = run({
    ...CLEAN_STATIC,
    D: [['D0', 'skip'], ['D1', 'skip'], ['D2', 'skip'], ['D3', 'skip'], ['D9', 'pass']],
  })
  assert.equal(standards.levels.entry.status, 'static')
  assert.equal(standards.levels.entry.evidence.D.ran, 1)
})

// ── 5. FLOW / BOOST 的诚实状态 ─────────────────────────────────────────────
test('FLOW 恒为 manual(J1-J8)，BOOST 恒为 not-measured(LEV-1..LEV-8)', () => {
  const { standards } = run(CLEAN_RUNTIME)
  assert.deepEqual(standards.levels.flow, {
    status: 'manual',
    checklist: 'J1-J8',
    note: 'doctor does not run user journeys',
  })
  assert.deepEqual(standards.levels.boost, {
    status: 'not-measured',
    evidence: 'LEV-1..LEV-8',
    note: 'doctor does not benchmark',
  })
})

// ── 6. 纯函数：groups 可省略、不改入参、不读文件/时钟/process ──────────────
test('groups 可省略：仅凭 results 也能得到同一 ENTRY 状态', () => {
  const { results, standards } = run(CLEAN_RUNTIME)
  const withoutGroups = deriveStandards(results)
  assert.equal(withoutGroups.levels.entry.status, standards.levels.entry.status)
  assert.equal(withoutGroups.levels.entry.evidence.D.ran, standards.levels.entry.evidence.D.ran)
})

test('纯函数：冻结入参不抛错，且输入未被改写', () => {
  const { results, groups } = scenario(CLEAN_RUNTIME)
  const before = JSON.stringify({ results, groups })
  const deepFreeze = (value) => {
    if (value && typeof value === 'object') {
      Object.values(value).forEach(deepFreeze)
      Object.freeze(value)
    }
    return value
  }
  deepFreeze(results)
  deepFreeze(groups)
  assert.doesNotThrow(() => deriveStandards(results, groups))
  assert.equal(JSON.stringify({ results, groups }), before)
})

test('零依赖：模块没有 import，也不触碰 fs / process / 时钟', () => {
  const source = fs.readFileSync(new URL('../lib/standards.mjs', import.meta.url), 'utf8')
  assert.ok(!/^\s*import\s/mu.test(source), '不应有 import 语句')
  assert.ok(!/from\s+['"]node:/u.test(source), '不应引用 node: 内建模块')
  assert.ok(!/\bprocess\./u.test(source), '不应触碰 process')
  assert.ok(!/\bDate\.now\b|\bnew Date\b/u.test(source), '不应读时钟')
  assert.ok(!/\b(?:readFileSync|writeFileSync|existsSync|readdirSync)\b/u.test(source), '不应读文件系统')
})

test('证据字段自洽：R/K/D 三组都在，runtime 证据 ID 与模块导出一致', () => {
  const { standards } = run(CLEAN_RUNTIME)
  assert.deepEqual(Object.keys(standards.levels.entry.evidence), ENTRY_GROUPS)
  assert.deepEqual(RUNTIME_EVIDENCE_IDS, ['D0', 'D1', 'D2', 'D3'])
})

test('data/standards.json 与模块常量一致，且每个 check 都归到已声明分组', () => {
  const data = JSON.parse(fs.readFileSync(new URL('../data/standards.json', import.meta.url), 'utf8'))
  assert.equal(data.schema, SCHEMA)
  assert.equal(data.nonOfficial, true)
  assert.deepEqual(data.entry.decidingGroups, ENTRY_GROUPS)
  assert.deepEqual(data.entry.runtimeEvidence, RUNTIME_EVIDENCE_IDS)
  assert.equal(data.flow.status, 'manual')
  assert.equal(data.flow.checklist, 'J1-J8')
  assert.equal(data.boost.status, 'not-measured')
  assert.equal(data.boost.evidence, 'LEV-1..LEV-8')
  const groups = new Map(data.entry.groups.map((g) => [g.groupId, g]))
  for (const [id, meta] of Object.entries(data.entry.checks)) {
    assert.ok(groups.has(meta.group), `${id} 指向未声明的分组 ${meta.group}`)
    assert.ok(groups.get(meta.group).checks.includes(id), `${meta.group} 的 checks 未列出 ${id}`)
  }
})

// ── 汇总 ───────────────────────────────────────────────────────────────────
const failed = checks.filter((c) => !c.ok).length
console.log(`\nstandards: ${checks.length - failed}/${checks.length} passed`)
if (failed > 0) process.exit(1)
