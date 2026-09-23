// Meta-test: is the spec-drift guard actually able to fail?
//
// A guard test that can only pass is worse than no guard, because it certifies
// something it never checked. This asserts that the range expansion inside
// tests/spec-drift.mjs really turns the SPEC §1 token list into individual IDs —
// if it silently returned nothing, the gate-set assertions would compare two
// empty lists and pass vacuously.
//
// 用法: node tests/spec-drift-meta.mjs
import { expandIdToken, parseGateList } from './spec-id-token.mjs'

const checks = []
const assert = (name, cond, detail = '') => checks.push({ name, ok: !!cond, detail })

const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b)

// The exact token list as written in SPEC §1.
const declared = 'R0, R1, R3, R5, R6, R7, R8, K1\u2013K9'
const tokens = parseGateList(declared)

assert('SPEC §1 的 token 列表展开出 16 个 ID', tokens.length === 16, `实际 ${tokens.length}: ${tokens.join(',')}`)
assert('展开结果等于门禁的真实构成', eq(tokens, ['R0', 'R1', 'R3', 'R5', 'R6', 'R7', 'R8', 'K1', 'K2', 'K3', 'K4', 'K5', 'K6', 'K7', 'K8', 'K9']), tokens.join(','))
assert('R2 不在门禁集合内（§1 明确排除）', !tokens.includes('R2'))
assert('R4 不在门禁集合内（§1 明确排除）', !tokens.includes('R4'))

// Range expansion, the part that could silently return nothing.
assert('en dash 区间 K1–K9 展开为 9 项', eq(expandIdToken('K1\u2013K9'), ['K1', 'K2', 'K3', 'K4', 'K5', 'K6', 'K7', 'K8', 'K9']))
assert('hyphen 区间 K1-K9 同样展开', eq(expandIdToken('K1-K9'), ['K1', 'K2', 'K3', 'K4', 'K5', 'K6', 'K7', 'K8', 'K9']))
assert('单 ID R0 原样返回', eq(expandIdToken('R0'), ['R0']))
assert('跨前缀区间不被展开（R1–K9）', eq(expandIdToken('R1\u2013K9'), ['R1\u2013K9']))
assert('单点区间 K3–K3 返回一项', eq(expandIdToken('K3\u2013K3'), ['K3']))
assert('空串不产生幻影 ID', eq(expandIdToken(''), ['']))

// A mis-declared gate must NOT match the real one — the whole point of the guard.
const wrongGate = parseGateList('R0, R1, R3, R5, R6, R7, R8, K1\u2013K8')
assert('漏掉 K9 的门禁声明与真实集合不等', !eq(wrongGate, tokens), `错误声明得到 ${wrongGate.length} 项`)

let failed = 0
for (const c of checks) {
  if (!c.ok) failed++
  console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.name}${c.detail ? `  — ${c.detail}` : ''}`)
}
console.log(`\nspec-drift-meta: ${checks.length - failed}/${checks.length} passed`)
if (failed > 0) process.exit(1)
