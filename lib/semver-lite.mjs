// 零依赖 semver 子集：只为复刻宿主的 peer 走廊判决
// （packages/boot/app-boot/src/plugin-compatibility.ts:
//    semver.satisfies(runtimeVersion, range, { includePrerelease: true })）
//
// 为什么不能用正则近似：判决的是「区间 ∩ 宿主版本」，一个 `||` 臂的上下界、
// 预发布元组的比较规则、`-0` 这种"把预发布线纳入"的写法，正则判不出来。
// 官方包 @deepseek-ai/dsh 的依赖里有 semver，但本工具契约是零依赖、且要能在
// 任意第三方仓的 CI 里离线跑 —— 因此自带实现，并用 tests/corridor.mjs 对
// 40+ 个真实区间与 node-semver 逐条对拍。
//
// 覆盖范围（node-semver 的哪些部分被实现、哪些没有）：
//   实现：^ ~ x-ranges 部分版本（1.2 / 1.x / 1） 比较器 >= > <= < = 连字符区间 a - b
//         多臂 `||` 空格分隔的 AND 组 预发布元组 构建元数据（忽略）
//   未实现（遇到即返回 null = 不可判，调用方必须当 skip 而不是当通过）：
//         `*`/`x` 之外的复杂写法、`latest`/标签、npm 别名、`workspace:`、空区间
//   `workspace:^` 等前缀由 evaluateHostCompat 单独处理，不进入本模块。

/** 版本号解析结果；prerelease 为空数组表示稳定版。 */
export function parse(v) {
  if (typeof v !== 'string') return null
  const m = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+([0-9A-Za-z.-]+))?$/.exec(v.trim())
  if (!m) return null
  return {
    major: Number(m[1]),
    minor: Number(m[2]),
    patch: Number(m[3]),
    prerelease: m[4] ? m[4].split('.').map((s) => (/^\d+$/.test(s) ? Number(s) : s)) : [],
    build: m[5] ? m[5].split('.') : [],
  }
}

/** 宽松解析：允许 `1.2` / `1`（缺位补 0）。 */
function parsePartial(v) {
  if (typeof v !== 'string') return null
  const t = v.trim().replace(/^v/, '')
  const m = /^(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:-([0-9A-Za-z.-]+))?(?:\+([0-9A-Za-z.-]+))?$/.exec(t)
  if (!m) return null
  return {
    major: Number(m[1]),
    minor: m[2] === undefined ? null : Number(m[2]),
    patch: m[3] === undefined ? null : Number(m[3]),
    prerelease: m[4] ? m[4].split('.').map((s) => (/^\d+$/.test(s) ? Number(s) : s)) : [],
  }
}

const cmpNum = (a, b) => (a === b ? 0 : a < b ? -1 : 1)

/** semver §11 优先级比较（忽略 build metadata）。 */
export function compare(a, b) {
  for (const k of ['major', 'minor', 'patch']) {
    const d = cmpNum(a[k], b[k])
    if (d !== 0) return d
  }
  const ap = a.prerelease
  const bp = b.prerelease
  if (!ap.length && !bp.length) return 0
  if (!ap.length) return 1      // 有预发布 < 无预发布
  if (!bp.length) return -1
  const n = Math.max(ap.length, bp.length)
  for (let i = 0; i < n; i++) {
    const x = ap[i]
    const y = bp[i]
    if (x === undefined) return -1
    if (y === undefined) return 1
    const xn = typeof x === 'number'
    const yn = typeof y === 'number'
    if (xn && yn) { const d = cmpNum(x, y); if (d !== 0) return d; continue }
    if (xn) return -1           // 数字标识 < 字母标识
    if (yn) return 1
    if (x !== y) return x < y ? -1 : 1
  }
  return 0
}

/** 单个比较器：`>=1.2.3-0` / `<2` / `1.2.x` / `=1.2.3` / `~1.2`。
 * @param {string} text
 * @param {{includePrerelease: boolean}} opts
 * @returns {null|{op:string, ver?:object, bounds?:object}}
 *  `op === 'range'` 时 `bounds` 已经是展开好的边界（x-range 的情形）。
 */
function parseComparator(text, opts) {
  const m = /^(>=|<=|>|<|=|\^|~)?\s*(.+)$/.exec(text.trim())
  if (!m) return null
  const op = m[1] ?? ''
  const raw = m[2].trim()
  // `x` / `X` / `*` 出现在任何数字位上 ⇒ x-range（`0.2.x` ≡ `>=0.2.0-0 <0.3.0-0`）
  if (/^v?[0-9xX*]/.test(raw) && /(?:^|\.)[xX*](?:\.|$)/.test(raw.replace(/^v/, ''))) {
    const parts = raw.replace(/^v/, '').split('.')
    const maj = /^[0-9]+$/.test(parts[0]) ? Number(parts[0]) : null
    const min = parts[1] !== undefined && /^[0-9]+$/.test(parts[1]) ? Number(parts[1]) : null
    const full = (M, m2, p, pr) => ({ major: M, minor: m2, patch: p, prerelease: pr ?? [], build: [] })
    const lo0 = opts.includePrerelease ? [0] : []
    if (maj === null) return { op: 'range', bounds: { gte: full(0, 0, 0, lo0) } }
    // includePrerelease 下 node-semver 的 replaceXRange 把**下界钉成 -0**
    // （`0.2.x` ⇒ `>=0.2.0-0 <0.3.0-0`），正是靠这个下界让 0.2.0-rc.1 落进区间；
    // 上界同样钉 -0，从而排除 0.3.0-rc.1 这类下一线的预发布。
    if (min === null) return { op: 'range', bounds: { gte: full(maj, 0, 0, lo0), lt: full(maj + 1, 0, 0, [0]) } }
    return { op: 'range', bounds: { gte: full(maj, min, 0, lo0), lt: full(maj, min + 1, 0, [0]) } }
  }
  const ver = parsePartial(raw)
  if (!ver) return null
  return { op, ver }
}

/** 把一个比较器展开为 {gt,gte,lt,lte} 边界（均为完整版本）。 */
function boundsOf({ op, ver, bounds }, opts) {
  if (op === 'range') return bounds
  const { major, minor, patch } = ver
  const pre = ver.prerelease
  const full = (M, m, p, pr) => ({ major: M, minor: m, patch: p, prerelease: pr ?? [], build: [] })
  // includePrerelease 下 node 的 caret/tilde 展开会给"0 补位"的下界钉 -0：
  //   `^0.2`   ⇒ `>=0.2.0-0 <0.3.0-0`
  //   `~0.2`   ⇒ `>=0.2.0-0 <0.3.0-0`
  //   `^0.2.1` ⇒ `>=0.2.1   <0.3.0-0`（下界是完整版本，不钉 -0）
  // 这个差别正是 `^0.2` 接受 0.2.1-alpha.1、而 `^0.2.1` 拒绝它的唯一原因。
  const lo0 = opts.includePrerelease ? [0] : []
  if (op === '^') {
    // ⚠ 上界规则必须**始终**走"major===0 就收紧"那条：
    //   `^0`   ⇒ `>=0.0.0-0 <1.0.0-0`
    //   `^0.0` ⇒ `>=0.0.0-0 <0.1.0-0`   ← 不是 <1.0.0-0
    //   `^0.2` ⇒ `>=0.2.0-0 <0.3.0-0`   ← 不是 <1.0.0-0
    //   `^1.2` ⇒ `>=1.2.0-0 <2.0.0-0`
    // 我曾在"部分版本"分支里直接写 `lt: full(major + 1, 0, 0, [0])`，于是 `^0.2`
    // 的上界变成 1.0.0-0，把 `0.7.7-alpha.2` 误判为满足（随机对拍抓出来的）。
    const caretUpper = (M, m, p) => (M === 0
      ? (m === 0 ? full(0, 0, p + 1, [0]) : full(0, m + 1, 0, [0]))
      : full(M + 1, 0, 0, [0]))
    if (minor === null) return { gte: full(major, 0, 0, [0]), lt: full(major + 1, 0, 0, [0]) }
    if (patch === null) return { gte: full(major, minor, 0, [0]), lt: caretUpper(major, minor, 0) }
    return { gte: full(major, minor, patch, pre), lt: caretUpper(major, minor, patch) }
  }
  if (op === '~') {
    if (minor === null) return { gte: full(major, 0, 0, [0]), lt: full(major + 1, 0, 0, [0]) }
    if (patch === null) return { gte: full(major, minor, 0, [0]), lt: full(major, minor + 1, 0, [0]) }
    return { gte: full(major, minor, patch, pre), lt: full(major, minor + 1, 0, [0]) }
  }
  // `>` / `<` / `<=` 的**部分版本**有专门的展开规则（node 的 replaceXRanges：
  //   `>1`    ⇒ `>=2.0.0-0`（不是 >1.0.0：`1.0.0` 本身不满足）
  //   `>1.2`  ⇒ `>=1.3.0-0`
  //   `>0`    ⇒ `>=1.0.0-0`  ⇒ 排除 `0.0.1` —— 实测 node-semver 如此，别按直觉写
  //   `<=0.7`（等价 `<=0.7.x`）⇒ `<0.8.0-0`
  //   `<0.7`  ⇒ `<0.7.0-0`（node 对 `<` 的部分版本**钉** -0，因此排除 0.7.0-rc.1）
  // 注意 `>` 与 `<=` 走"进一位"，`<` 走"补零并钉 -0" —— 三者不同，别合并。
  if (op === '>' && (minor === null || patch === null)) {
    const bumpMajor = minor === null
    const M = bumpMajor ? major + 1 : major
    const m = bumpMajor ? 0 : minor + 1
    return { gte: { major: M, minor: m, patch: 0, prerelease: [0], build: [] } }
  }
  if (op === '<=' && (minor === null || patch === null)) {
    const bumpMajor = minor === null
    const M = bumpMajor ? major + 1 : major
    const m = bumpMajor ? 0 : minor + 1
    return { lt: { major: M, minor: m, patch: 0, prerelease: [0], build: [] } }
  }
  if (op === '<' && (minor === null || patch === null)) {
    return { lt: full(major, minor ?? 0, patch ?? 0, [0]) }
  }
  if (op === '>=' && (minor === null || patch === null)) {
    // `>=1.2` ⇒ `>=1.2.0-0`（下界钉 -0，把 1.2.0-alpha 纳入）
    if (minor === null) return { gte: full(major, 0, 0, [0]) }
    return { gte: full(major, minor, 0, [0]) }
  }
  if (op === '>' || op === '>=') return { [op === '>' ? 'gt' : 'gte']: full(major, minor ?? 0, patch ?? 0, pre) }
  if (op === '<') {
    // `<X.Y.Z` **不钉 -0**：`<0.2.0` 必须接受 `0.2.0-rc.1`
    // （预发布排在稳定版之前，`0.2.0-rc.1 < 0.2.0` 成立）。
    // 我曾给它钉上 `-0` 想与 node 的序列化形态对齐 —— 那是错的，
    // 会让 `<0.2.0` 拒绝 0.2.0-rc.1，从而把"0.1 线"区间判成空集。
    // node 的 replaceXRange 只在**部分版本**（`<1.2`）那条分支钉 `-0`，
    // 那条已在上面的 replaceXRanges 分支处理。
    return { lt: full(major, minor ?? 0, patch ?? 0, pre) }
  }
  if (op === '<=') return { lte: full(major, minor ?? 0, patch ?? 0, pre) }
  // 裸版本 / `=`：**部分版本按 x-range 处理**，且下界钉 `-0`、上界钉 `-0`
  // （node 的 replaceXRanges：`7.2` ⇒ `>=7.2.0-0 <7.3.0-0`；
  //   这也是"为什么 `7.x 7.2` 能同时成立"—— 两个 x-range 的交集仍非空）。
  if (minor === null) return { gte: full(major, 0, 0, [0]), lt: full(major + 1, 0, 0, [0]) }
  if (patch === null) return { gte: full(major, minor, 0, [0]), lt: full(major, minor + 1, 0, [0]) }
  return { gte: full(major, minor, patch, pre), lte: full(major, minor, patch, pre) }
}

/** 解析一个 AND 组。
 * @returns {{gt?:object,gte?:object,lt?:object,lte?:object,any?:true,prereleaseAllowed?:boolean}|null}
 *   `any` = 真正的 `*`（空区间 / `x` / `*`），semver 把它当**任意版本、含预发布**，
 *   不能实现成 `<0.0.0-0` 这类边界 —— 那会引入一个"同元组才放行"的比较器，
 *   从而把 0.2.0-rc.2 判否（与 node-semver 实测不符）。
 */
function parseAndGroup(text, { includePrerelease } = { includePrerelease: true }) {
  const t = text.trim()
  if (!t) return null
  // 空区间 / `*` / `x` / `X`：任意版本（含预发布）—— node 把它当 Comparator.ANY，
  // 连 `0.0.0-alpha.2` 都放行，所以不能用任何边界去近似它。
  if (/^([xX*]|)$/.test(t)) return { any: true }
  const hy = /^(\S+)\s+-\s+(\S+)$/.exec(t)
  if (hy) {
    const lo = parsePartial(hy[1])
    const hi = parsePartial(hy[2])
    if (!lo || !hi) return null
    // 与 node-semver 的 hyphenReplace(includePrerelease=true) 逐分支对齐：
    //   下界：完整版本 ⇒ `>=X.Y.Z-0`（把 -0 钉在下面）；缺位 ⇒ 补 0 再钉 -0
    //   上界：完整版本 ⇒ `<X.Y.(Z+1)-0`（注意是 patch+1 且钉 -0，不是 <=X.Y.Z）
    //   缺位 ⇒ 进一位并钉 -0
    const low = lo.minor === null
      ? { major: lo.major, minor: 0, patch: 0, prerelease: [0], build: [] }
      : lo.patch === null
        ? { major: lo.major, minor: lo.minor, patch: 0, prerelease: [0], build: [] }
        : lo.prerelease.length
          ? { major: lo.major, minor: lo.minor, patch: lo.patch, prerelease: lo.prerelease, build: [] }
          : { major: lo.major, minor: lo.minor, patch: lo.patch, prerelease: [0], build: [] }
    const high = hi.minor === null
      ? { major: hi.major + 1, minor: 0, patch: 0, prerelease: [0], build: [] }
      : hi.patch === null
        ? { major: hi.major, minor: hi.minor + 1, patch: 0, prerelease: [0], build: [] }
        : hi.prerelease.length
          ? { major: hi.major, minor: hi.minor, patch: hi.patch + 1, prerelease: [0], build: [] }
          : { major: hi.major, minor: hi.minor, patch: hi.patch + 1, prerelease: [0], build: [] }
    return { comparators: [{ op: '>=', bound: low }, { op: '<', bound: high }] }
  }
  // ── 逐比较器收集并**保留每一个**（不折叠成"一个下界 + 一个上界"） ──────────
  // 折叠会丢掉约束：node 对 `<1.2 <=2.2.2-0` 生成 **两个**比较器
  // （`<1.2.0-0` 与 `<=2.2.2-0`），取交集时两个都要满足；
  // 只留"最紧的一个"在某些组合下会漏掉另一侧的约束。红队 A16-30 之后的对拍
  // 就是被这一族打穿的（40 000 例里约 3%）。
  //
  // node 的顺序：展开每个比较器（caret/tilde/x/`>`/`<`）→ 全部追加 → 再跑 replaceGTE0。
  // 因此"是否被抹成 ANY"要等收集完再判。
  const comparators = []
  let anySeen = false
  for (const part of t.split(/\s+/)) {
    if (/^[xX*]$/.test(part)) { anySeen = true; continue }
    const c = parseComparator(part, { includePrerelease })
    if (!c) return null
    if (isGteZero(c, { includePrerelease })) { anySeen = true; continue }
    comparators.push(...comparatorsOf(c, { includePrerelease }))
  }
  // 组里除了 `*` / 被抹掉的 `>=0.0.0-0` 之外什么都没有 ⇒ 就是 ANY
  if (!comparators.length && anySeen) return { any: true }
  if (!comparators.length) return { any: true }
  return { comparators }
}

/**
 * 把一个（已展开的）比较器变成 1–2 条可比对项。
 * @returns {Array<{op:'>'|'>='|'<'|'<=', bound:object}>}
 */
function comparatorsOf(c, opts) {
  // 裸版本（无运算符）：node 把它做成 Comparator.ANY + 一个 semver 引用，
  // 而 Comparator.test 对 ANY 直接 `return true`。它**只在多臂区间里**才看得出差别：
  //   `0.2.0-rc.1` 这个裸版本会让区间 `… || 0.2.0-rc.1 || …` 接受宿主 `0.2.0-rc.1`
  // （Comparator.ANY 短路），宿主 fleet 里确实有这种写法。
  // 单臂时它必须与"语义相等 + 预发布元组守卫"一致 —— 所以这里同时给出：
  //   `=tuple` 供"组内只有它"时短路，`=` 供常规比较。
  if (c.op === '' && c.ver) {
    const { minor, patch } = c.ver
    // 部分版本（`7` / `7.2`）**不是**精确项，而是 x-range：
    //   node: `7.2` ⇒ `>=7.2.0-0 <7.3.0-0`（因此 `7.x 7.2` 的交集非空、成立）
    if (minor === null || patch === null) return fromBounds(boundsOf(c, opts))
    const { major, prerelease } = c.ver
    const bound = { major, minor, patch, prerelease: prerelease ?? [], build: [] }
    return [{ op: '=tuple', bound }, { op: '=', bound }]
  }
  // `=` 写全三段：走精确相等（eq），不做元组放宽
  if (c.op === '=' && c.ver && c.ver.minor !== null && c.ver.patch !== null) {
    const { major, minor, patch, prerelease } = c.ver
    return [{ op: '=', bound: { major, minor, patch, prerelease: prerelease ?? [], build: [] } }]
  }
  return fromBounds(boundsOf(c, opts))
}

/** 把 boundsOf 的结果转成比较器数组。 */
function fromBounds(b) {
  const out = []
  if (b.gt) out.push({ op: '>', bound: b.gt })
  if (b.gte) out.push({ op: '>=', bound: b.gte })
  if (b.lt) out.push({ op: '<', bound: b.lt })
  if (b.lte) out.push({ op: '<=', bound: b.lte })
  return out
}

/**
 * 该比较器是否会被 node 的 replaceGTE0 抹成 ANY。
 * 判据是**序列化形态**，不是语义值 —— 这一点必须照着 node 抄：
 *   `>=0` / `>=0.0.0-0`（**补零后**带 -0）⇒ 抹掉；`>=0.0.0`（显式写全的稳定零版）⇒ 保留。
 *
 * ⚠ 必须区分"补零来的"与"人写全的"：
 *   · `>=0` ⇒ `>=0.0.0-0` ⇒ ANY
 *   · `>=0.0.0` ⇒ **保留**为下界 0.0.0（因此 `>=0.0.0 <0.0.1` 是空集，而 `>=0 <0.0.1` 不是）
 *   实测依据：`satisfies('0.2.1-alpha.1','>=0.0.0 <0.0.1')` 在 node-semver 上为 **false**
 *   （红队 A16-30），所以这里绝不能把 `>=0.0.0` 也抹成 ANY。
 *
 * @param {{op:string, ver?:object}} c
 * @param {{includePrerelease:boolean}} opts
 */
function isGteZero(c, { includePrerelease }) {
  if (c.op !== '>=' || !c.ver) return false
  const { major, minor, patch, prerelease } = c.ver
  if (major !== 0) return false
  // ⚠ `>=0.2.0-0` 的 minor=2 —— 必须在判 prerelease 之前先把"是不是零版"卡死，
  // 否则会把任何 `>=0.x.y-0` 都当成"最小可能下界"抹掉。
  // （我自己踩过：`>=0.2.0-0 <0.3.0-0` 的 `-0` 下界被抹掉，于是 `0.1.7-rc.2` 被判满足。）
  if (minor !== null && minor !== 0) return false
  if (patch !== null && patch !== 0) return false
  // 到这里确定是 0 / 0.0 / 0.0.0 / 0.0.0-* 这一族
  const writtenPartial = minor === null || patch === null
  if (!writtenPartial) {
    // 写全的形态：只有显式的 `>=0.0.0-0` 才是 ANY
    return includePrerelease && prerelease.length === 1 && prerelease[0] === 0
  }
  if (includePrerelease) return prerelease.length === 0 || (prerelease.length === 1 && prerelease[0] === 0)
  return prerelease.length === 0
}

/** 解析完整区间为 AND 组数组；`||` 分隔。返回 null 表示本模块不可判。
 * @param {string} range
 * @param {{includePrerelease?: boolean}} [options]
 */
export function parseRange(range, options = {}) {
  const includePrerelease = options.includePrerelease !== false
  if (typeof range !== 'string') return null
  const t = range.trim()
  if (!t) return null
  const groups = []
  for (const arm of t.split('||')) {
    const g = parseAndGroup(arm, { includePrerelease })
    // 与 node-semver 对齐：**任何一个臂坏掉，整个区间就不可判**。
    // node-semver 对坏臂的处理是"该臂永不匹配"（不抛错），但那样会静默把
    // 一个畸形区间当成"永不兼容"，与"我不懂这个区间"是两回事 —— doctor 要能
    // 区分它们，所以这里返回 null，由调用方报 skip/warn 而不是当成判否。
    if (!g) return null
    groups.push(g)
  }
  return groups.length ? groups : null
}

/**
 * 区间是否接受该版本 —— 等价于 node-semver 的
 * `satisfies(version, range, { includePrerelease })`。
 *
 * 两条语义（都是读 `semver/classes/range.js` + 实测对拍得到的，不是猜的）：
 *
 * ① 区间展开随 includePrerelease 变化。caret / tilde 在"补 0"的下界上钉 `-0`：
 *      `^0.2`   ⇒ `>=0.2.0-0 <0.3.0-0`   （而 includePrerelease=false 时是 `>=0.2.0 <0.3.0-0`）
 *      `~0.2`   ⇒ `>=0.2.0-0 <0.3.0-0`
 *      `^0.2.1` ⇒ `>=0.2.1   <0.3.0-0`   （完整版本不钉 -0）
 *    这一个字符的差别，就是"`^0.2` 接受 0.2.1-alpha.1、`^0.2.1` 拒绝它"的全部原因。
 *
 * ② 预发布元组守卫（range.js 的 testSet，第 550-570 行）。**它只在
 *    includePrerelease=false 时生效** —— 源码条件就是
 *    `if (version.prerelease.length && !options.includePrerelease)`。
 *    生效时：候选是预发布 ⇒ 必须存在某个比较器，其自身带预发布**且**
 *    [major,minor,patch] 与候选完全相同，否则判否。
 *
 * 宿主 preflight 用的是 `includePrerelease: true`（见
 * packages/boot/app-boot/src/plugin-compatibility.ts），所以 doctor 的主路径走那个分支；
 * 但本函数同时提供 `{ includePrerelease: false }` 以复刻"用户手写 npm 区间时的直觉"，
 * 二者都经 tests/corridor.mjs 与随机对拍验证。
 *
 * @param {string} version
 * @param {string} range
 * @param {{includePrerelease?: boolean}} [options]
 * @returns {boolean|null} null = 本模块不可判（调用方必须报 skip，不得当作通过）
 */
export function satisfies(version, range, options = {}) {
  const includePrerelease = options.includePrerelease !== false
  const v = parse(version)
  if (!v) return null
  const groups = parseRange(range, { includePrerelease })
  if (!groups) return null
  for (const g of groups) {
    if (matchGroup(v, g, { includePrerelease })) return true
  }
  return false
}

function matchGroup(v, g, { includePrerelease }) {
  if (g.any) return true
  const c = (a, b) => compare(a, b)
  // 组内**每一条**比较器都必须满足（node 的 testSet 就是逐条 test）
  for (const { op, bound } of g.comparators) {
    if (op === '>=' && !(c(v, bound) >= 0)) return false
    if (op === '>' && !(c(v, bound) > 0)) return false
    if (op === '<' && !(c(v, bound) < 0)) return false
    if (op === '<=' && !(c(v, bound) <= 0)) return false
    // 裸版本：精确对象相等（node 这里是 object identity，不是语义 eq）
    if (op === '=tuple' && c(v, bound) !== 0) return false
    // 显式 `=`：语义相等
    if (op === '=' && c(v, bound) !== 0) return false
  }
  // 组内只剩裸版本那一条时，node 走 Comparator.ANY 短路 ⇒ 不再有预发布元组守卫。
  // （多臂区间 `… || 0.2.0-rc.1 || …` 的实际行为就是靠这一条成立的。）
  const onlyBare = g.comparators.length === 1 && g.comparators[0].op === '=tuple'
  // ② 元组守卫（只在 includePrerelease=false 时生效）——
  //    node 的 testSet 只看"带预发布**且比较符不为空**"的比较器。
  if (!includePrerelease && v.prerelease.length && !onlyBare) {
    const allowed = g.comparators.some(
      ({ op, bound }) => op !== '=tuple' && bound.prerelease.length > 0
        && bound.major === v.major && bound.minor === v.minor && bound.patch === v.patch,
    )
    if (!allowed) return false
  }
  return true
}

/** 区间之间是否可能有交集（用于把走廊与宿主版本集合求交）。粗判：拿候选点集试。 */
export function intersects(rangeA, candidates) {
  const out = []
  for (const c of candidates) {
    const s = satisfies(c, rangeA)
    if (s === true) out.push(c)
  }
  return out
}

/** 从一组宿主版本里挑"该插件支持的最高稳定版"与"最高预发布版"。 */
export function supportedHosts(range, hosts) {
  const ok = []
  const undecidable = []
  for (const h of hosts) {
    const s = satisfies(h, range)
    if (s === true) ok.push(h)
    else if (s === null) undecidable.push(h)
  }
  const parsed = ok.map((h) => ({ h, v: parse(h) })).filter((x) => x.v)
  const stable = parsed.filter((x) => x.v.prerelease.length === 0).sort((a, b) => compare(b.v, a.v))
  const pre = parsed.filter((x) => x.v.prerelease.length > 0).sort((a, b) => compare(b.v, a.v))
  return {
    all: ok,
    stable: stable.map((x) => x.h),
    prerelease: pre.map((x) => x.h),
    best: stable[0]?.h ?? pre[0]?.h ?? null,
    undecidable,
  }
}
