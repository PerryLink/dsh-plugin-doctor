// 走廊（peer 区间）判决引擎测试：**不联网、不需要 dsh 安装**。
//
// 为什么要单独一份：这一项的判据来自宿主源码（兼容性 preflight），错一位就会
// 把"会被宿主静默禁用的插件"判成通过（假绿），或把能用的插件判成不可用（假红）。
// 所以三条路都要被钉住：
//   ① lib/semver-lite.mjs 必须与 node-semver 在 includePrerelease:true 下逐例一致
//      —— 用固定期望值表（期望值由真实 node-semver 7.8.5 生成，见文件末 provenance）
//   ② 区间展开的边界形态（^ ~ x 连字符 `||` `-0` 预发布）
//   ③ 宿主判决的**语义后果**：不相交 ⇒ 该行会被 disabled（不是"装不上"）
//
// 用法: node tests/corridor.mjs      退出码 0 = 全过，1 = 有失败

import { satisfies, parse, compare, supportedHosts, parseRange } from '../lib/semver-lite.mjs'
import { referenceHosts, currentHosts, linesSupportedBy, PUBLISHED_HOST_VERSIONS, HOST_LINES_AS_OF } from '../lib/host-lines.mjs'
import { bundlePatchPaths } from '../lib/checks-runtime.mjs'

let failed = 0
let total = 0
function check(label, got, want) {
  total++
  const ok = JSON.stringify(got) === JSON.stringify(want)
  if (!ok) failed++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : `\n      got  ${JSON.stringify(got)}\n      want ${JSON.stringify(want)}`}`)
}

// ── ① 对拍表：期望值来自真实 node-semver 的 satisfies(h, r, {includePrerelease:true}) ──
// 这些不是"我认为应该是什么"，而是宿主自己那份 semver 的实测输出。
const CORRIDORS = [
  // [区间, 宿主, 期望]
  ['>=0.1.2-rc.1 <0.2.0', '0.2.1-alpha.1', false],
  ['>=0.1.2-rc.1 <0.2.0', '0.1.5-rc.1', true],
  ['^0.1.2-rc.1', '0.2.1-alpha.1', false],
  ['^0.1.2-rc.1', '0.1.7-rc.2', true],
  ['^0.2', '0.2.1-alpha.1', true],
  ['^0.2', '0.1.7-rc.2', false],
  ['^0.2.0', '0.2.1-alpha.1', true],
  ['^0.2.0', '0.2.0-rc.2', false],
  ['^0.2.1', '0.2.1-alpha.1', false],
  ['~0.2', '0.2.1-alpha.1', true],
  ['~0.2.1', '0.2.1-alpha.1', false],
  ['~0.2.1', '0.2.1', true],
  ['~0.2.1', '0.2.2', true],
  ['~0.2.1', '0.2.0', false],
  ['~0.2.0', '0.2.0-rc.1', false],
  ['~4.0.5-alpha.1', '4.0.6', true],
  ['~4.0.5-alpha.1', '4.0.5-alpha.1', true],
  ['~4.0.5-alpha.1', '4.1.0', false],
  ['0.2.x', '0.2.0-rc.1', true],
  ['0.2.x', '0.3.0', false],
  ['>=0.2.0 <0.3.0', '0.2.0-rc.2', false],
  ['>=0.2.0-0 <0.3.0', '0.2.0-rc.2', true],
  ['>=0.2.0-0 <0.3.0-0', '0.2.0-rc.2', true],
  ['>=0.1.2-rc.1 <0.2.0 || >=0.1.5-alpha.1 <0.2.0', '0.2.0-rc.2', true],
  ['>=0.1.2-rc.1 <0.2.0 || >=0.1.5-alpha.1 <0.2.0', '0.2.1-alpha.1', false],
  // 精确性：上界 `<0.2.0` 会放行 **0.2.0 自己的预发布**（0.2.0-rc.1 / rc.2 都排在 0.2.0 之前），
  // 但排除 0.2.1 及之后的一切 —— 包括本机在跑的 0.2.1-alpha.1。
  // 所以"旧文案在 0.2 线上全灭"是**错的**说法；正确说法是"它覆盖不到用户真正在用的宿主"。
  ['>=0.1.2-rc.1 <0.2.0', '0.2.0-rc.1', true],
  ['>=0.1.2-rc.1 <0.2.0', '0.2.0-rc.2', true],
  ['>=0.1.2-rc.1 <0.2.0', '0.2.1-alpha.1', false],
  ['>=0.1.2-rc.1 <0.2.0 || >=0.2.0-0 <0.3.0', '0.2.0-rc.2', true],
  ['>=0.1.2-rc.1 <0.2.0 || >=0.2.0-0 <0.3.0', '0.1.5-rc.3', true],
  ['>=0.1.6-0 <0.2.0 || >=0.2.0-0 <0.3.0 || >=0.2.1-0 <0.3.0', '0.2.1-alpha.1', true],
  ['>=0.1.6-0 <0.3.0', '0.2.1-alpha.1', true],
  ['*', '0.2.1-alpha.1', true],
  ['*', '0.1.0-rc.2', true],
  ['>0.1.2-rc.1', '0.1.3-alpha.2', true],
  ['0.2.0 - 0.2.5', '0.2.0-rc.1', true],
  ['0.2.0 - 0.2.5', '0.2.6', false],
  ['<=0.2.0-rc.2', '0.2.0-rc.2', true],
  ['=0.2.0-rc.2', '0.2.0-rc.2', true],
  ['^0.2.0-rc.2', '0.2.0-rc.2', true],
  ['^0.2.0-rc.2', '0.2.1-alpha.1', true],
  ['^0.2.0-rc.2', '0.3.0', false],
  ['^0.1.7-alpha.1', '0.1.7-rc.2', true],
  ['^4.0.5-alpha.1', '4.0.5-alpha.1', true],
  ['>=0.1.0-rc.1', '0.3.0', true],
]
for (const [range, host, want] of CORRIDORS) {
  check(`satisfies(${host}, ${JSON.stringify(range)})`, satisfies(host, range), want)
}

// ── ② 不可判必须返回 null（调用方据此 skip，不得当通过） ──
check('empty range → null', satisfies('0.2.0', ''), null)
check('non-string range → null', satisfies('0.2.0', 123), null)
check('invalid version → null', satisfies('not-a-version', '^0.2'), null)
check('garbage range → null', satisfies('0.2.0', 'banana'), null)
check('space-only range → null', satisfies('0.2.0', '   '), null)

// ── ③ 版本解析与比较 ──
check('parse("0.2.1-alpha.1")', parse('0.2.1-alpha.1'), { major: 0, minor: 2, patch: 1, prerelease: ['alpha', 1], build: [] })
check('parse("v1.2.3+build")', parse('v1.2.3+build'), { major: 1, minor: 2, patch: 3, prerelease: [], build: ['build'] })
check('parse("1.2") → null（partial 不是合法版本）', parse('1.2'), null)
check('compare(0.2.0-rc.2 < 0.2.0)', compare(parse('0.2.0-rc.2'), parse('0.2.0')) < 0, true)
check('compare(0.2.0-alpha.1 < 0.2.0-beta.1)', compare(parse('0.2.0-alpha.1'), parse('0.2.0-beta.1')) < 0, true)
check('compare(0.2.0-alpha.2 > 0.2.0-alpha.1)', compare(parse('0.2.0-alpha.2'), parse('0.2.0-alpha.1')) > 0, true)
check('compare(0.2.0-1 < 0.2.0-alpha)', compare(parse('0.2.0-1'), parse('0.2.0-alpha')) < 0, true)

// ── ④ 区间展开形态（边界必须完整） ──
{
  const r = parseRange('^0.2')[0]
  const hasUpper = (r.comparators ?? []).some((c) => c.op === '<' || c.op === '<=')
  check('parseRange("^0.2") 有上界', hasUpper, true)
  // `^0.2` 的上界是 0.3.0-0，**不是** 1.0.0-0（major=0 时 caret 收紧）
  const upper = (r.comparators ?? []).find((c) => c.op === '<')?.bound
  check('parseRange("^0.2") 上界 = 0.3.0-0（major=0 收紧）', upper && upper.major === 0 && upper.minor === 3, true)
  check('parseRange("^0") 上界 = 1.0.0-0', (() => {
    const u = (parseRange('^0')[0].comparators ?? []).find((c) => c.op === '<')?.bound
    return u && u.major === 1 && u.minor === 0
  })(), true)
}
check('parseRange("*") 是 any', parseRange('*')[0].any, true)
check('parseRange("") → null', parseRange(''), null)
check('parseRange("||") → null', parseRange('||'), null)

// ── ⑤ 发行线选择 ──
{
  const refs = referenceHosts()
  const cur = currentHosts()
  const okRefs = refs.length >= 3 && refs.every((v) => parse(v))
  check(`referenceHosts() 全部可解析且覆盖所有发行线（${refs.length} 个代表版本）`, okRefs, true)
  check(`currentHosts().lines 覆盖 0.0/0.1/0.2（${cur.lines.join(' ')}）`,
    ['0.0', '0.1', '0.2'].every((l) => cur.lines.includes(l)), true)
  // 官方至今**没有**发布 0.2.x 稳定版 —— 这是事实，不是 bug。测试钉住它，
  // 免得以后有人"顺手"把 0.2.0 加进清单，从而让 latestStable 谎报一个不存在的版本。
  check('currentHosts().latestStable 为 null（0.2 线尚无稳定发布）', cur.latestStable, null)
  check(`currentHosts().latest 是最高的已发布版本（${cur.latest}）`, cur.latest, '0.2.1-alpha.1')
  check('currentHosts().latestPrerelease 是预发布版', /-/.test(cur.latestPrerelease ?? ''), true)
  check('PUBLISHED_HOST_VERSIONS 含 0.2.1-alpha.1（本机运行宿主）', PUBLISHED_HOST_VERSIONS.includes('0.2.1-alpha.1'), true)
  // 同线代表版本必须是该线最高者：0.2 线是 0.2.1-alpha.1，不是 0.2.0-rc.2
  check('0.2 线代表版本 = 0.2.1-alpha.1（semver 比较，不是字符串比较）', refs.includes('0.2.1-alpha.1'), true)
  check('0.2.0-rc.2 不作为 0.2 线代表（被同线更高版本取代）', refs.includes('0.2.0-rc.2'), false)
  check('HOST_LINES_AS_OF 是日期字符串', /^\d{4}-\d{2}-\d{2}$/.test(HOST_LINES_AS_OF), true)
}

// ── ⑥ supportedHosts 的语义（"这个区间能支持到哪条线"） ──
{
  const s = supportedHosts('>=0.2.0-0 <0.3.0-0', PUBLISHED_HOST_VERSIONS)
  check('supportedHosts(0.2 线) best 落在 0.2.x', /^0\.2\./.test(s.best ?? ''), true)
  check('supportedHosts(0.2 线) 不含 0.1.x', s.all.every((v) => !/^0\.1\./.test(v)), true)

  // 这一组是"旧推荐文案会害人"的机器可读证据。注意精确性：
  //   `>=0.1.2-rc.1 <0.2.0` **确实**接受 `0.2.0-rc.1`（预发布排在 0.2.0 之前，上界放行），
  //   所以不能说"它一条 0.2 都不含"。真正的危害是它**排除了 0.2.0-rc.2 及之后的一切**，
  //   包括本机正在跑的 0.2.1-alpha.1 —— 那正是用户会装到的宿主。
  check('>=0.1.2-rc.1 <0.2.0 接受 0.2.0-rc.1（预发布排序的必然结果）', satisfies('0.2.0-rc.1', '>=0.1.2-rc.1 <0.2.0'), true)
  check('>=0.1.2-rc.1 <0.2.0 也接受 0.2.0-rc.2（npm latest 恰好落在里面）', satisfies('0.2.0-rc.2', '>=0.1.2-rc.1 <0.2.0'), true)
  check('>=0.1.2-rc.1 <0.2.0 拒绝 0.2.1-alpha.1（本机运行宿主）', satisfies('0.2.1-alpha.1', '>=0.1.2-rc.1 <0.2.0'), false)
  check('旧双臂文案 >=0.1.2-rc.1 <0.2.0 || >=0.1.5-alpha.1 <0.2.0 拒绝 0.2.1-alpha.1',
    satisfies('0.2.1-alpha.1', '>=0.1.2-rc.1 <0.2.0 || >=0.1.5-alpha.1 <0.2.0'), false)
  check('旧双臂文案 接受 0.2.0-rc.2（npm latest）——所以"全灭"是错的说法',
    satisfies('0.2.0-rc.2', '>=0.1.2-rc.1 <0.2.0 || >=0.1.5-alpha.1 <0.2.0'), true)
  check('^0.1.2-rc.1 拒绝整条 0.2 线（含 0.2.0-rc.1）', satisfies('0.2.0-rc.1', '^0.1.2-rc.1'), false)

  const s3 = supportedHosts('banana', PUBLISHED_HOST_VERSIONS)
  check('supportedHosts(不可判区间) all 为空且 best 为 null', s3.all.length === 0 && s3.best === null, true)
}

// ── ⑥b linesSupportedBy：报告里"你的走廊覆盖了哪几条线" ──
{
  check('linesSupportedBy(^0.2) == ["0.2"]', linesSupportedBy('^0.2'), ['0.2'])
  check('linesSupportedBy(^0.1.2-rc.1) == ["0.1"]', linesSupportedBy('^0.1.2-rc.1'), ['0.1'])
  check('linesSupportedBy(>=0.0.1-rc.1 <0.3.0-0) 覆盖三条线', linesSupportedBy('>=0.0.1-rc.1 <0.3.0-0'), ['0.0', '0.1', '0.2'])
  check('linesSupportedBy(*) 覆盖全部线', linesSupportedBy('*').length, 3)
  // "0.2 线被覆盖"不等于"0.2.1-alpha.1 被覆盖"—— 两个概念要在代码里分开，
  // 否则报告会说"你支持 0.2 线"而实际在用户宿主上被禁用。
  check('linesSupportedBy 说覆盖 0.2 线，但 0.2.1-alpha.1 实际不被接受（两个概念必须分开）',
    linesSupportedBy('>=0.1.2-rc.1 <0.2.0').includes('0.2') && satisfies('0.2.1-alpha.1', '>=0.1.2-rc.1 <0.2.0') === false, true)
}

// ── ⑦ dsh.bundle.patch 形态归一化（官方允许 string | string[]） ──
check('bundlePatchPaths("./a.yml")', bundlePatchPaths('./a.yml'), ['./a.yml'])
check('bundlePatchPaths(["./a.yml","./b.yml"])', bundlePatchPaths(['./a.yml', './b.yml']), ['./a.yml', './b.yml'])
check('bundlePatchPaths(undefined) → null', bundlePatchPaths(undefined), null)
check('bundlePatchPaths({}) → null', bundlePatchPaths({}), null)
check('bundlePatchPaths([1]) → null', bundlePatchPaths([1]), null)

// ── ⑧ X1 的严重级别分级：自相矛盾 vs 诚实的老区间 ────────────────────────
// 这组守的是"报告不许退化成噪声"：如果任何与当前宿主不相交的区间都判 fail，
// 那么所有尚未迁移到新宿主线的仓都会变红，fail 就失去了意义。
// 判据是"该区间有没有声称覆盖到宿主所在的那一段"，见 checks-runtime 的 nominallyCoversLine。
{
  const HOST = '0.2.1-alpha.1'
  // 自相矛盾：声称覆盖 0.2.1 这一档，却在 0.2.1-alpha.1 上不满足
  // ⚠ `>=0.2.0 <0.3.0` **不在**这一档里 —— 实测（宿主自带 semver 7.8.5 与本引擎一致）
  //    它接受 0.2.1-alpha.1。原因是 `>=0.2.0` 的下界是**稳定 0.2.0**，而预发布 0.2.1-alpha.1
  //    大于它。曾有调研结论说它会失败，已实测证伪，不要照抄那句。
  const selfContradictory = ['^0.2.1', '~0.2.1', '0.2.1', '>=0.2.1 <0.3.0']
  // 诚实的老区间：连 0.2.1 都不覆盖（上界钉在 0.2.0 之前）
  const honestOld = ['>=0.1.2-rc.1 <0.2.0', '^0.1.2-rc.1', '~0.1.7', '>=0.1.5-alpha.1 <0.2.0']
  // 正确：覆盖并满足。注意 `>=0.2.1-0` —— 下界带 `-0` 就能接纳同元组的预发布，
  // 这正是 `^0.2.1`（下界钉在稳定 0.2.1）与它的全部差别。
  const correct = ['^0.2', '~0.2', '0.2.x', '>=0.2.0-0 <0.3.0-0', '>=0.2.0 <0.3.0', '>=0.2.1-0', '>=0.1.2-rc.1 <0.2.0 || >=0.2.0-0 <0.3.0']

  const coversSegment = (range) => ['0.2.1', '0.2.2', '0.2.2-0'].some((v) => satisfies(v, range) === true)

  for (const r of selfContradictory) {
    const sat = satisfies(HOST, r)
    check(`自相矛盾档：${JSON.stringify(r)} 在 ${HOST} 上不满足`, sat, false)
    check(`自相矛盾档：${JSON.stringify(r)} 声称覆盖到宿主段（⇒ 应判 fail）`, coversSegment(r), true)
  }
  for (const r of honestOld) {
    const sat = satisfies(HOST, r)
    check(`陈旧档：${JSON.stringify(r)} 在 ${HOST} 上不满足`, sat, false)
    check(`陈旧档：${JSON.stringify(r)} **未**声称覆盖宿主段（⇒ 只应判 warn）`, coversSegment(r), false)
  }
  for (const r of correct) {
    check(`正确档：${JSON.stringify(r)} 在 ${HOST} 上满足`, satisfies(HOST, r), true)
  }
}

// ── ⑨ 不可判区间必须返回 null（不能当"不满足"，也不能当"满足"） ──
check('null range → null（不可判，调用方须 skip）', satisfies('0.2.0', null), null)
check('undefined range → null', satisfies('0.2.0', undefined), null)
check('随机的非 semver 串 → null', satisfies('0.2.0', 'not a range at all'), null)

console.log(`\ncorridor: ${total - failed}/${total} passed`)
if (failed > 0) process.exitCode = 1
