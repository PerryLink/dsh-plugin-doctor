// 动态面 · 宿主契约（X 组）：把"插件装上去到底会不会被宿主接受、会不会真的挂载"变成可判定项。
//
// 这一组的依据**全部**来自可执行真相源，不手抄常量表：
//   1. 宿主 peer 判决：packages/boot/app-boot/src/plugin-compatibility.ts
//        - 只看 peerDependencies 里 `@deepseek-ai/dsh` 或 `@deepseek-ai/dsh-*` 的项
//        - semver.satisfies(runtimeVersion, range, { includePrerelease: true })
//        - workspace:^|~|* 改写成"当前 runtime 版本"（恒通过）
//        - 区间非法 / 非字符串 ⇒ 抛错 ⇒ **该行被拒绝**（不是放行）
//      判决后果：packages/boot/app-boot/src/compatibility-preflight.ts:105-118
//        - 不兼容 ⇒ row.disabled = true ⇒ stderr 一行 `dsh: disabling profile plugin ...`
//          ⇒ **宿主照常启动，插件静默不挂载**（这就是"插件不可用"最主流的形态）
//      运行时版本来源：dsh-app-boot 自己的 package.json version
//   2. 宿主服务面：<dsh>/node_modules/@deepseek-ai/dsh-tool-cordis/lib/types/api-catalog.js
//      （官方生成物；头注释自述与 docs/cordis-catalog "cannot diverge"）
//   3. 宿主自带行 id：<dsh>/node_modules/@deepseek-ai/dsh-base/cordis.patch.yml
//
// 与 K 组的边界：K 组是**文本启发式**（正则扫源码），X 组是**对宿主真实面的求值**。
// 二者刻意分开：X 组可以在拿不到宿主面时整组 skip 并触发降级，而 K 组仍能给出提示。

import path from 'node:path'
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { satisfies, parse as parseSemver, compare } from './semver-lite.mjs'
import { resolveHostSurface, loadHostEvaluator, locateDshInstall } from './host-surface.mjs'
import { referenceHosts, currentHosts, HOST_LINES_AS_OF } from './host-lines.mjs'
import { REMOVED_SEAM_BY_NAME } from './removed-seams.mjs'
import { pass, fail, warn, skip, envskip, na, findFiles } from './util.mjs'

export const GROUP = '动态面·宿主契约'

/** 会被宿主 preflight 求值的 peer 名判定（与 app-boot 逐字一致）。 */
const isDshPeer = (name) => name === '@deepseek-ai/dsh' || name.startsWith('@deepseek-ai/dsh-')

/**
 * `dsh.bundle.patch` 归一化为**非空字符串**数组（官方允许 string | string[]）。
 *
 * 严格性来自实战：旧实现（以及本函数的第一版）只判 `typeof === 'string'`，
 * 于是 `patch: ""` 会变成 `['']` —— 下游 `path.resolve(repo, '')` 得到**仓库根目录**，
 * `existsSync` 对目录为真，`readFileSync(目录)` 抛 EISDIR，
 * 到 doctor 那里就是一条 `[ERROR] doctor-internal` + 退出码 1（红队 A16 实测）。
 * 空串不是"一个叫空名字的文件"，它是**没有声明**，必须返回 null。
 *
 * @param {unknown} patch
 * @returns {string[]|null} null = 形态非法或为空
 */
export function bundlePatchPaths(patch) {
  const raw = typeof patch === 'string' ? [patch] : patch
  if (!Array.isArray(raw) || raw.length === 0) return null
  const list = raw.map((p) => (typeof p === 'string' ? p.trim() : null))
  if (list.some((p) => !p)) return null
  return list
}

/** 目标存在且是**普通文件**（不是目录）—— existsSync 对目录也为真，不能当 isFile 用。 */
function isFile(p) {
  try { return statSync(p).isFile() } catch { return false }
}

/** 去 `./` 前缀。 */
const stripDot = (p) => String(p ?? '').replace(/^\.\//, '')

/**
 * 该区间是否**名义上覆盖了宿主所在的那一段版本**（不只是那条线）。
 *
 * 用途是把"自相矛盾的声明"与"诚实的老区间"分开：
 *   · `^0.2.1` 声称覆盖到 0.2.1，却在 `0.2.1-alpha.1` 上不满足 ⇒ **自相矛盾** ⇒ fail。
 *     （它能过 `^0.2` 却过不了 `^0.2.1`，差别只在补零下界有没有钉 `-0`。）
 *   · `>=0.1.2-rc.1 <0.2.0` 连 `0.2.0` 都不覆盖 ⇒ 它**从没声称**支持 0.2 的正式段，
 *     只是还没跟上 ⇒ 陈旧 ⇒ warn。
 *
 * ⚠ 不能用"那条线的某个版本满足"来判：`0.2.0-rc.1` 排在 `0.2.0` 之前，
 * 所以 `<0.2.0` 会放行它 —— 用"该线是否被覆盖"当判据，会把诚实的老区间误判成自相矛盾
 * （第一版就是这么错的，被存档旧快照的实测打回）。
 *
 * 判法：只看"宿主版本本身"与"同 minor 下的更高 patch 的稳定版"这两个探针。
 * 只要有一个满足，就说明区间覆盖到了用户实际所在的那一段。
 */
function nominallyCoversLine(range, hostVersion) {
  const p = parseSemver(hostVersion)
  if (!p) return false
  const probes = [
    `${p.major}.${p.minor}.${p.patch}`,          // 该 patch 的稳定版（如 0.2.1）
    `${p.major}.${p.minor}.${p.patch + 1}`,      // 再高一个 patch
    `${p.major}.${p.minor}.${p.patch + 1}-0`,    // 再高一个 patch 的预发布下界
  ]
  return probes.some((v) => satisfies(v, range) === true)
}

export function addChecks(doctor, ctx) {
  const { repoPath, pkg } = ctx
  const peers = Object.entries(pkg.peerDependencies ?? {})
    .filter(([k, v]) => isDshPeer(k) && typeof v === 'string')
    .map(([k, v]) => [k, v])
  const peerEntriesAll = Object.entries(pkg.peerDependencies ?? {}).filter(([k]) => isDshPeer(k))

  // ── X1 peer 走廊 ∩ 真实宿主版本集 ─────────────────────────────────────────
  // 这是本组最重要的一项：它回答"装上之后会不会被宿主静默摘掉"。
  //
  // 两条判决路径，报告里如实标注：
  //   ① host-native：直接 import 宿主自己的 @deepseek-ai/dsh-app-boot，
  //      调它的 evaluatePluginCompatibility —— **与宿主逐字节同源，零复刻风险**。
  //   ② replicated：拿不到宿主模块时，用 lib/semver-lite.mjs + lib/host-lines.mjs
  //      复刻同一判据（已与 node-semver 对拍 1280 例零差异，但复刻永远是复刻）。
  // 两条路都拿不到宿主版本时 ⇒ skip(category=infrastructure)，**绝不回落硬编码常量**。
  doctor.add(GROUP, 'X1 peer 走廊与实际宿主版本求交（宿主会静默禁用不相交的插件）', async () => {
    if (!peerEntriesAll.length) {
      return skip('未声明任何 @deepseek-ai/dsh* peer —— 宿主 preflight 无意见，无法判版本共存（既不通过也不失败）')
    }
    const evaluator = await loadHostEvaluator(ctx.dshInstall ?? null)
    const surface = await resolveHostSurface({ dshInstall: ctx.dshInstall ?? null })
    const extra = [ctx.dshInstallVersion, ...(ctx.hostVersions ?? [])].filter(Boolean)
    const hosts = referenceHosts(extra)
    const current = currentHosts()
    const installed = evaluator?.runtimeVersion ?? ctx.dshInstallVersion ?? null

    if (evaluator) {
      // ── 路径 ①：宿主原生判决（对本机实际运行的宿主，结论即最终结论） ──
      const v = evaluator.judge(pkg)
      if (v.malformed) {
        return fail(
          '宿主自身拒绝校验本包的 peer 声明 —— preflight 会把该行判为 '
          + '"its declared peer dependencies cannot be validated" 并**静默禁用整行**：\n'
          + `  ${v.malformed}\n`
          + '（判据来源：宿主原生模块 ' + '<dsh>/node_modules/@deepseek-ai/dsh-app-boot，'
          + `运行时版本 ${evaluator.runtimeVersion}）`,
        )
      }
      // 顺带给出"其它发行线"的复刻判定，供作者决定要不要扩走廊
      const otherLines = []
      for (const h of hosts) {
        if (h === installed) continue
        const bad = peerEntriesAll.filter(([name, range]) => typeof range === 'string' && satisfies(h, range) === false).map(([n]) => n)
        if (bad.length) otherLines.push(`  ${h}: 不满足 ${bad.join(', ')}`)
      }
      if (v.compatible) {
        return pass(
          `宿主原生判决：**兼容**（与 dsh ${evaluator.runtimeVersion} 逐字节同源判定，零复刻风险）。\n`
          + peerEntriesAll.map(([k, r]) => `${k} ${r}`).join('\n')
          + (otherLines.length
            ? `\n\n其它发行线上的复刻判定（仅供参考，用于判断是否要扩走廊）：\n${otherLines.slice(0, 6).join('\n')}`
            : ''),
        )
      }
      // ── 严重级别分级 ────────────────────────────────────────────────────
      // 关键区分：**这条区间有没有"声称"支持用户正在跑的这条线？**
      //   声称了却不满足 ⇒ 自相矛盾（`^0.2.1` 在 0.2.1-alpha.1 上不满足，而 `^0.2` 满足，
      //     差别只在补零下界有没有钉 `-0`）⇒ fail。
      //   根本没声称（上界钉在 0.2.0 之前，如 `>=0.1.2-rc.1 <0.2.0`）⇒ 诚实的老区间，
      //     属"还没跟上"⇒ warn。
      // 这个区分是必要的：若一律 fail，任何尚未迁移到 0.2 线的仓都会变红，
      // 报告会退化成噪声，反而没人再认真对待 fail。
      const contradicts = peerEntriesAll.some(
        ([, range]) => typeof range === 'string' && nominallyCoversLine(range, evaluator.runtimeVersion),
      )
      const host = installed ?? evaluator.runtimeVersion
      const head = contradicts
        ? `⛔ 宿主原生判决：**不兼容，且区间自相矛盾** —— 你声明的走廊覆盖 ${host} 所在的发行线，`
          + `却在 ${host} 上不满足。`
        : `⚠ 宿主原生判决：不兼容，但区间**从未声称**支持 ${host} 所在的发行线。`
      const tail = contradicts
        ? ''
        : `\n（不判失败：这是"还没跟上新宿主线"的陈旧声明，不是自相矛盾。`
          + `但它意味着跑在 ${host} 上的用户会看到你的插件被静默禁用 —— 想支持就把新线加进走廊。）`
      const result = (contradicts ? fail : warn)(
        `${head}\n`
        + `  你的区间：${peerEntriesAll.map(([k, r]) => `${k} ${r}`).join(' / ')}\n`
        + `  宿主自己的报错原文：${v.warning}\n`
        + '  用户现象：插件能装，但宿主启动时把这一行 `disabled`，stderr 只有一行 '
        + '`dsh: disabling profile plugin ...`，插件功能完全不可见。\n\n'
        + '修法（走廊必须与**每条你还想支持的宿主线**都相交）：\n'
        + '  · 同时支持 0.1 与 0.2：">=0.1.2-rc.1 <0.2.0 || >=0.2.0-0 <0.3.0"\n'
        + `  · 只跟当前线（最省事）："^${current.lines.includes('0.2') ? '0.2' : (current.latest ?? '0.2.1-alpha.1')}" 或 ">=0.2.0-0 <0.3.0-0"\n`
        + '  · 陷阱：^0.2.1 / ~0.2.1 / "0.2.1" 在宿主的 0.2.1-alpha.1 上都**不满足**（下界钉在稳定版上）；\n'
        + '           ^0.2 / ~0.2 / 0.2.x 满足，但只在宿主硬编码 includePrerelease:true 时成立。\n'
        + '  · 精确性提醒：">=0.1.2-rc.1 <0.2.0" **会**放行 0.2.0-rc.1 / 0.2.0-rc.2（预发布排在 0.2.0 之前），\n'
        + `           但**排除 0.2.1 及之后的一切**，包括本机在跑的 ${host} —— 别被"上界是 0.2.0"骗了，\n`
        + '           也别以为"npm latest 装得上"就代表用户装得上。\n'
        + '  · 验证命令：改完后重跑本工具，或 `dsh --profile <p> --dump-config-schema` 看该行是否被禁用。'
        + tail,
      )
      result.category = contradicts ? 'plugin-defect' : 'policy'
      result.hostEvaluator = { source: 'host-native', runtimeVersion: evaluator.runtimeVersion, peers: v.peers, contradicts }
      return result
    }

    // ── 路径 ②：复刻判决（拿不到宿主模块时） ──
    const malformed = []
    const verdicts = new Map()
    for (const [name, range] of peerEntriesAll) {
      if (typeof range !== 'string') { malformed.push(`${name}: 区间不是字符串（${JSON.stringify(range)}）`); continue }
      if (range.trim() === '') { malformed.push(`${name}: 区间为空字符串`); continue }
      if (/^workspace:/.test(range)) continue            // 恒通过，官方支持
      void parseSemver(range)
      for (const h of hosts) {
        const s = satisfies(h, range)
        if (s === null) { malformed.push(`${name}: 区间 ${JSON.stringify(range)} 无法解析（宿主会以"无法校验 peer 依赖"为由拒绝该行）`); break }
        if (s === false) {
          if (!verdicts.has(h)) verdicts.set(h, [])
          verdicts.get(h).push({ peer: name, range })
        }
      }
    }
    if (malformed.length) {
      return fail('peer 区间无法被宿主校验 —— 宿主会把该行判为 "its declared peer dependencies cannot be validated" 并**禁用整行**：\n' + [...new Set(malformed)].join('\n'))
    }

    const blocked = [...verdicts.entries()]
    const blockedOnCurrent = current.latestStable && verdicts.has(current.latestStable)
    const blockedOnPre = current.latestPrerelease && verdicts.has(current.latestPrerelease)
    const everBlocked = blocked.length > 0

    if (!everBlocked) {
      return pass(
        `与 ${hosts.length} 个已发布宿主版本（含 latest ${current.latestStable ?? '?'}`
        + `${current.latestPrerelease ? ` / alpha ${current.latestPrerelease}` : ''}）全部相交；`
        + '宿主不会因此禁用该行。\n' + peerEntriesAll.map(([k, v]) => `${k} ${v}`).join('\n')
        + `\n（复刻判据：satisfies(宿主版本, 区间, {includePrerelease:true})；`
        + `宿主模块不可用，故用复刻实现；发行线清单抓取于 ${HOST_LINES_AS_OF}）`,
      )
    }

    const detail = blocked
      .sort((a, b) => compare(parseSemver(b[0]) ?? { major: 0, minor: 0, patch: 0, prerelease: [] }, parseSemver(a[0]) ?? { major: 0, minor: 0, patch: 0, prerelease: [] }))
      .slice(0, 6)
      .map(([h, list]) => `  宿主 ${h}: 不满足 ${[...new Set(list.map((x) => `${x.peer} ${JSON.stringify(x.range)}`))].join(' / ')}`)
      .join('\n')
    const blockingHosts = blocked.map(([h]) => h)
    const onlyOldLines = blockingHosts.every((h) => {
      const v2 = parseSemver(h)
      return v2 && (v2.major < 0.2 || (v2.major === 0 && v2.minor < 2))
    })

    const head = blockedOnCurrent || blockedOnPre
      ? '⛔ 在当前 latest/alpha 宿主上会被禁用：插件能装，但宿主启动时把整行 disabled，用户看不到任何插件功能。'
      : onlyOldLines
        ? '⚠ 只与**较旧的**宿主发行线不相交（当前 latest/alpha 不受影响）。若你依赖这些旧线，需要扩区间；否则可忽略。'
        : '⚠ 与部分宿主发行线不相交，插件在那些宿主上会被静默禁用。'

    const advice = [
      '',
      '修法（走廊必须与"每条你还想支持的宿主线"都相交）：',
      '  · 同时支持 0.1 与 0.2：">=0.1.2-rc.1 <0.2.0 || >=0.2.0-0 <0.3.0"',
      `  · 只跟当前线（最省事）："^${current.lines.includes('0.2') ? '0.2' : (current.latest ?? '0.2.1-alpha.1')}" 或 ">=0.2.0-0 <0.3.0-0"`,
      '  · 陷阱：^0.2.1 / ~0.2.1 / "0.2.1" 在宿主的 0.2.1-alpha.1 上都**不满足**（下界钉在稳定版上）；',
      '           ^0.2 / ~0.2 / 0.2.x 满足，但只在宿主硬编码 includePrerelease:true 时成立。',
      '  · 精确性提醒：">=0.1.2-rc.1 <0.2.0" **会**放行 0.2.0-rc.1 / 0.2.0-rc.2（预发布排在 0.2.0 之前），',
      `           但**排除 0.2.1 及之后的一切**，包括本机在跑的 ${installed ?? '0.2.1-alpha.1'} —— 别被"上界是 0.2.0"骗了，`,
      '           也别以为"npm latest 装得上"就代表用户装得上。',
      '  · 验证命令：改完后重跑本工具，或 `dsh --profile <p> --dump-config-schema` 看该行是否被禁用。',
    ].join('\n')

    const result = blockedOnCurrent || blockedOnPre
      ? fail(`${head}\n${detail}${advice}`)
      : warn(`${head}\n${detail}\n（不判失败：只影响旧发行线，属"支持到哪条线"的选择）`)
    result.category = 'plugin-defect'
    result.hostVerdicts = Object.fromEntries(blocked)
    void surface
    return result
  })

  // ── X2 版本载体自洽 ─────────────────────────────────────────────────────
  // 分级刻意做细，因为"写了 engines.dsh"本身不是缺陷（读者是 dsh-plugin-upgrade
  // 的走廊路由），真正的缺陷是**走廊只写在不被执行的地方**：
  //   fail  = 有 engines.dsh / dshWorkshop 走廊，却一个 @deepseek-ai/dsh* peer 都没有
  //           ⇒ 版本闸门完全不存在，任何宿主都放行（"声明了但没人执行"）
  //   warn  = peer 存在但区间形态有代价（open-top / workspace 前缀）
  //   pass  = peer 存在且形态无代价（engines.dsh 有无都无所谓，只在 message 里注明）
  doctor.add(GROUP, 'X2 版本载体自洽（走廊是否写在了宿主动真的地方）', () => {
    const problems = []
    const notes = []
    const enginesDsh = pkg.engines?.dsh
    const workshopVersions = pkg.dshWorkshop?.compatibility?.dshVersions ?? pkg.dshhub?.compatibility?.dshVersions
    const hasPeer = peerEntriesAll.length > 0
    const declaredElsewhere = []
    if (enginesDsh !== undefined) declaredElsewhere.push(`engines.dsh=${JSON.stringify(enginesDsh)}`)
    if (workshopVersions !== undefined) declaredElsewhere.push(`dshWorkshop.compatibility.dshVersions=${JSON.stringify(workshopVersions)}`)

    if (!hasPeer && declaredElsewhere.length) {
      problems.push(
        `走廊只写在**宿主不读**的字段里：${declaredElsewhere.join(' / ')}\n`
        + '宿主 preflight 只求值 peerDependencies 里 key 为 @deepseek-ai/dsh 或 @deepseek-ai/dsh-* 的条目'
        + '（dsh-app-boot 的 evaluatePluginCompatibility；2026-10-07 实测：dsh 的 lib/ 与全部官方包内 grep `engines` 零命中）。\n'
        + '⇒ 现在的效果是"声明了但没人执行"：任何宿主版本都会放行，包括你明确写了不支持的那些。\n'
        + '修法：把走廊搬到 peerDependencies，例如\n'
        + '  "peerDependencies": { "@deepseek-ai/dsh": ">=0.2.0-0 <0.3.0" }\n'
        + 'engines.dsh 可以保留（dsh-plugin-upgrade 的走廊路由会读它），但它不能是唯一声明。',
      )
    } else if (!hasPeer) {
      notes.push('未声明任何 @deepseek-ai/dsh* peer ⇒ 宿主 preflight 对本包**无意见**，任何宿主版本都会放行。这是允许的（生态里高采用度插件也有这么写的），但意味着版本兼容完全靠你自己测。')
    }

    for (const [name, range] of peerEntriesAll) {
      if (typeof range !== 'string') { problems.push(`${name} 的区间不是字符串（宿主会以"无法校验 peer 依赖"为由禁用该行）`); continue }
      if (/^workspace:/.test(range)) {
        notes.push(
          `${name}: ${range} —— workspace 协议在**已发布**的包里会被宿主改写成"当前 runtime 版本"，`
          + '等于把版本闸门自废（恒通过）。发布物里不应出现；请换成真实 semver 区间。',
        )
      }
      if (/^[>]=?\s*\d/.test(range) && !range.includes('<') && !range.includes('||') && !range.includes('^') && !range.includes('~')) {
        notes.push(
          `${name}: ${range} 是 open-top 区间（>= 且无上界），会放行 1.0.0 等未来破坏性主线。`
          + `若只是想跟随预发布线而不跟随破坏性升级，写 ^${range.replace(/^>=\s*/, '').trim()}`,
        )
      }
    }
    if (problems.length) return fail(problems.join('\n'))
    if (notes.length) return { ...warn(notes.join('\n')), category: 'policy' }
    return pass(
      `版本载体自洽：peer 区间形态无代价${declaredElsewhere.length ? `（另有 ${declaredElsewhere.join(' / ')} —— 宿主不读，仅 dsh-plugin-upgrade 的走廊路由会用，属装饰而非缺陷）` : ''}`,
    )
  })

  // ── X3 dsh.bundle.patch 形态 ─────────────────────────────────────────────
  doctor.add(GROUP, 'X3 dsh.bundle.patch 形态与文件存在性（string | string[]）', () => {
    const raw = pkg.dsh?.bundle?.patch
    if (raw === undefined) return skip('无 dsh.bundle.patch（R1 已判）')
    const list = bundlePatchPaths(raw)
    if (list === null) {
      return fail(
        `dsh.bundle.patch 形态非法：${JSON.stringify(raw)}\n`
        + '官方只接受"一个文件路径，或一组有序文件路径"（dsh-app-boot: bundlePatchFiles）：\n'
        + '  "dsh": { "bundle": { "patch": "./cordis.patch.yml" } }\n'
        + '  "dsh": { "bundle": { "patch": ["./a.yml", "./b.yml"] } }\n'
        + '其它形态会让宿主在加载该 bundle 时抛 "dsh.bundle.patch must be a file path or a list of file paths"。',
      )
    }
    if (!list.length) return fail('dsh.bundle.patch 是空数组 —— 至少需要一个 patch 文件（要声明"空层"请用一个内容为 [] 的文件）')
    const problems = []
    for (const rel of list) {
      const abs = path.resolve(repoPath, stripDot(rel))
      if (!isFile(abs)) {
        problems.push(existsSync(abs) ? `patch 路径是目录而不是文件：${rel}` : `patch 文件不存在：${rel}`)
      }
    }
    const filesField = Array.isArray(pkg.files) && pkg.files.length ? pkg.files : null
    if (filesField) {
      for (const rel of list) {
        const f = stripDot(rel)
        const covered = filesField.some((item) => {
          const base = String(item).replace(/\/$/, '')
          return f === item || f.startsWith(`${base}/`)
        })
        if (!covered) problems.push(`files 白名单未覆盖 patch：${rel}`)
      }
    }
    if (problems.length) return fail(problems.join('\n'))
    return pass(`patch 形态合法${list.length > 1 ? `（${list.length} 个文件，按序应用）` : ''}：${list.join(', ')}`)
  })

  // ── X4 服务依赖：inject 名单 vs 宿主真实服务面 ─────────────────────────────
  // 事实依据（实测）：inject 里点名了一个宿主/其它插件都不提供的服务 ⇒ fiber 永久 PENDING，
  // apply **永不执行**，且**零报错** —— 只在宿主启动审计里一行 `pending (waiting for service: X)`。
  //
  // 为什么这一项必须是 fail 而不是 warn：它是最"安静"的致命形态。实测本家族 3 个仓
  // （dsh-auto-review / dsh-doublecheck / dsh-output-styles）inject 了 `invariants`，
  // 而 @deepseek-ai/dsh-invariants 已在宿主 0.2.1-alpha.1 被移除、没有任何包 provide 它 ⇒
  // 三个插件在真实宿主上完全不工作，而旧实现因为 KNOWN_SEAMS 手抄表里**恰好写了** invariants
  // 而判它们 pass。手抄表的忠实度直接决定这条是"拦下致命"还是"盖章放行"。
  doctor.add(GROUP, 'X4 inject 名单 vs 宿主真实服务面（不存在的服务 ⇒ apply 永不执行且零报错）', async () => {
    const srcFiles = collectRuntimeSources(ctx)
    if (!srcFiles.length) return skip('无源文件可扫描')
    const injectNames = new Set()
    let sawInject = false
    const providedBySelf = new Set()
    for (const { text } of readSource(srcFiles)) {
      for (const m of text.matchAll(/(?:export\s+)?(?:const\s+)?inject\s*[:=]\s*\[([^\]]*)\]/g)) {
        sawInject = true
        for (const s of m[1].match(/['"][^'"]*['"]/g) ?? []) {
          const name = s.slice(1, -1)
          if (!name.includes('.')) injectNames.add(name)
        }
      }
      for (const m of text.matchAll(/(?:ctx\.)?provide\s*\(\s*['"]([^'"]+)['"]/g)) providedBySelf.add(m[1])
      for (const m of text.matchAll(/super\(\s*(?:ctx|this\.ctx)\s*,\s*['"]([^'"]+)['"]/g)) providedBySelf.add(m[1])
    }
    if (!sawInject) return na('源码未见数组形态的 inject 声明（对象插件/类插件可能在别处声明）')

    const surface = await resolveHostSurface({ dshInstall: ctx.dshInstall ?? null })
    const host = new Set([...surface.services, ...surface.inheritedCtx])
    for (const k of Object.keys(surface.providers ?? {})) host.add(k)

    // 家族内其它仓 provide 的服务（插件互操作是正当形态，必须认账，否则假阳性）
    const siblingProvided = new Set()
    const ws = ctx.workspaceRoot
    if (ws && existsSync(ws)) {
      for (const e of readdirSafe(ws)) {
        if (!e.startsWith('dsh-')) continue
        const dir = path.join(ws, e)
        if (path.resolve(dir) === path.resolve(repoPath)) continue
        for (const f of scanProvideKeys(dir)) siblingProvided.add(f)
      }
    }

    const unknown = [...injectNames].filter((n) => !host.has(n) && !providedBySelf.has(n) && !siblingProvided.has(n)).sort()
    const siblingOnly = [...injectNames].filter((n) => !host.has(n) && !providedBySelf.has(n) && siblingProvided.has(n)).sort()
    // 三级归因，刻意区分"能证明没有提供方"与"证明不了"：
    //   provenMissing = 有**官方出处**说明它已被移除（lib/removed-seams.mjs，逐条指向
    //                   docs/upgrade-guide/...），或快照记录过它曾被 provide
    //                   ⇒ 可以 fail：证据表明它曾经存在、现在没了（如 0.2 线移除的 invariants）。
    //   unlisted      = 查不到、也没有任何证据 ⇒ **只能 warn**：
    //                   可能是客户端半区、可选实验包，或我们没抓到的构造点，
    //                   判 fail 会制造假红（红队 A16 实测 `session` / `config` 就是这种）。
    const evidence = surface.providerEvidence ?? {}
    const provenMissing = unknown.filter((n) => n in evidence || REMOVED_SEAM_BY_NAME.has(n))
    const unlisted = unknown.filter((n) => !(n in evidence) && !REMOVED_SEAM_BY_NAME.has(n))
    if (!unknown.length && !siblingOnly.length) {
      return pass(`inject 的 ${injectNames.size} 个服务名都真实存在（服务面来源：${surface.source}${surface.baseline ? ` @ dsh ${surface.baseline}` : ''}，${host.size} 个键${siblingProvided.size ? `；另认账工作区内 ${siblingProvided.size} 个兄弟仓 provide 键` : ''}）`)
    }
    if (!unknown.length) {
      return pass(`inject 的服务名均可解析（其中 ${siblingOnly.join(', ')} 由工作区内的兄弟插件 provide —— 跨插件依赖，安装时必须同时装上对方）`)
    }
    const detailOf = (n) => {
      const removed = REMOVED_SEAM_BY_NAME.get(n)
      if (removed) {
        // 官方出处只印一次（在收尾处统一给出），这里只给结论与取代物。
        return `  ${n} —— **宿主已在 ${removed.removedIn} 移除该 seam**`
          + (removed.replacement ? `，改用 ${removed.replacement}` : '，且没有等价取代物')
      }
      const providers = evidence[n]
      return providers?.length
        ? `  ${n}（曾由 ${providers.join(', ')} 提供 —— 该包已不在宿主安装里，或只在特定 profile 装载）`
        : `  ${n}（宿主面里查不到，也没有任何提供方记录）`
    }
    /** 命中的官方条目，去重后随收尾一次性给出出处与迁移说明。 */
    const citationsOf = (arr) => [...new Set(arr.map((n) => REMOVED_SEAM_BY_NAME.get(n)).filter(Boolean))]
      .map((r) => `  · ${r.name}（${r.removedIn}）：${r.source}\n      ${r.note.split('\n')[0]}`)
      .join('\n')
    const lines = (arr) => arr.map(detailOf).join('\n')
    const FIX = '修法三选一：\n'
      + '  ① 该服务已从宿主移除（如 0.2 线移除的 @deepseek-ai/dsh-invariants / ctx.invariants）'
      + '⇒ 删除这个 inject 与相应代码，或改用宿主现有的等价 seam；\n'
      + '  ② 该服务由你依赖的另一个插件提供 ⇒ 在 README 与 peerDependencies 里写明"必须同时安装 X"；\n'
      + '  ③ 它本来是可选的 ⇒ 从 inject 里删掉，改用 `ctx.get(\'name\')` 并在拿到 undefined 时降级。'
    const PROV = `（服务面来源：${surface.source}${surface.baseline ? `，基线 dsh ${surface.baseline}` : ''}；`
      + '核验命令：`dsh --profile <p> --dump-config-schema`，或启动后看 stderr 的 pending 清单）'
    if (provenMissing.length) {
      const cites = citationsOf(provenMissing)
      return fail(
        '以下 inject 服务名**没有任何提供方** —— 该插件的 apply 永远不会执行，而且宿主**不会报错**：\n'
        + lines(provenMissing)
        + '\n用户看到的现象：插件"装上了但完全没反应"。宿主启动审计里只有一行 '
        + '`pending (waiting for service: X)`（auditStartupEntries）。\n'
        + (cites ? `\n官方出处与迁移说明：\n${cites}\n` : '')
        + FIX + '\n' + PROV,
      )
    }
    return warn(
      '以下 inject 服务名在宿主面上查不到，**但无法证明它一定不存在** —— 若确无提供方，'
      + '该插件的 apply 不会执行且宿主不报错（只在启动审计里留一行 `pending (waiting for service: X)`）：\n'
      + lines(unlisted)
      + '\n不判失败的原因：这些名字可能来自客户端半区、可选实验包，或由本工具未能抓到的构造点提供。'
      + '请按下面的方式确认后再处理。\n' + FIX + '\n' + PROV,
    )
  })

  // ── X5 patch 行可定位性 ──────────────────────────────────────────────────
  doctor.add(GROUP, 'X5 patch 行可定位性（id/name 是否指向真实存在的东西）', async () => {
    const list = bundlePatchPaths(pkg.dsh?.bundle?.patch)
    if (!list || !list.length) return skip('无 dsh.bundle.patch（或形态非法，X3 已判）')
    const problems = []
    const notes = []
    const surface = await resolveHostSurface({ dshInstall: ctx.dshInstall ?? null })
    for (const rel of list) {
      const abs = path.resolve(repoPath, stripDot(rel))
      if (!isFile(abs)) continue    // X3 已判（不存在 / 是目录 / 空串）
      const text = readFileSync(abs, 'utf8')
      const active = text.split(/\r?\n/).filter((l) => !/^\s*#/.test(l)).join('\n')
      if (!active.trim() || /^\[?\s*\]?$/.test(active.replace(/[\[\],]/g, '').trim())) continue
      // 每行的 id 与 name
      const lines = active.split(/\r?\n/)
      let inInsert = false
      let rowId = null
      const ids = []
      const names = []
      for (let i = 0; i < lines.length; i++) {
        const t = lines[i].trim()
        if (/^-\s*insert\s*:/.test(t)) { inInsert = true; continue }
        if (/^-\s+\S/.test(lines[i])) inInsert = false
        const idm = /^-?\s*id\s*:\s*["']?([A-Za-z0-9_.:@/-]+)["']?\s*$/.exec(t)
        if (idm) { rowId = idm[1]; ids.push({ id: idm[1], line: i + 1, inInsert }); continue }
        const nm = /^-?\s*name\s*:\s*["']?([^"'\s,]+)["']?\s*$/.exec(t)
        if (nm) { names.push({ name: nm[1], line: i + 1, inInsert, id: rowId }) }
      }
      // insert 行的 name 应当是"能从 profile node_modules 解析到的包名"
      for (const n of names.filter((x) => x.inInsert)) {
        if (n.name.startsWith('cordis:') || n.name.startsWith('./') || n.name.startsWith('../') || n.name.startsWith('/')) continue
        const bare = n.name.startsWith('@') ? n.name.split('/').slice(0, 2).join('/') : n.name.split('/')[0]
        const isSelf = bare === pkg.name
        const inPeers = Object.prototype.hasOwnProperty.call(pkg.peerDependencies ?? {}, bare)
        const inDeps = Object.prototype.hasOwnProperty.call(pkg.dependencies ?? {}, bare)
        const isOfficial = bare.startsWith('@deepseek-ai/') || bare.startsWith('@cordisjs/')
        if (!isSelf && !inPeers && !inDeps && !isOfficial) {
          notes.push(`${path.basename(rel)}:${n.line} insert 行 name='${n.name}' 既不是本包、也未在 dependencies/peerDependencies 里声明 —— 宿主按 profile 的 node_modules 解析，解析不到会抛 "cannot resolve profile bundle ..."`)
        }
      }
      // 顶层（非 insert）行 = 覆写既有行；id 必须能在宿主自带行里找到
      for (const x of ids.filter((y) => !y.inInsert)) {
        if (!surface.builtinRows.size) continue
        if (!surface.builtinRows.has(x.id)) {
          notes.push(`${path.basename(rel)}:${x.line} 顶层覆写 id='${x.id}' 不在宿主自带行 id 里 —— 宿主会打 "patch: entry <id> not found" 并忽略这一行`)
        }
      }
      // insert 的 id 撞宿主自带 id = 同一行被两个来源定义（整段替换语义，必有一方失效）
      for (const x of ids.filter((y) => y.inInsert)) {
        if (surface.builtinRows.has(x.id)) {
          problems.push(`${path.basename(rel)}:${x.line} insert 行 id='${x.id}' 与宿主自带行 id 重名 —— patch 是整段 config 替换语义，会与宿主或其它插件互相覆盖`)
        }
      }
    }
    if (problems.length) return warn(problems.join('\n'))
    if (notes.length) return warn([...new Set(notes)].join('\n'))
    return pass('patch 行的 id/name 均可定位（未撞宿主自带行、name 可解析）')
  })
}

/** 收集"运行时源文件"：src/** 优先，无 src 时按 main 所在目录与 lib/dist 兜底。 */
function collectRuntimeSources(ctx) {
  const { repoPath, pkg } = ctx
  const src = findFiles(repoPath, 'src', /\.(ts|mts|cts|tsx|mjs|js|cjs)$/)
  const root = []
  for (const e of readdirSafe(repoPath)) {
    if (/\.(mjs|js|cjs)$/.test(e)) root.push(path.join(repoPath, e))
  }
  let files = [...new Set([...src, ...root])]
  if (!files.length) {
    const main = stripDot(pkg.main ?? '')
    const mainDir = path.posix.dirname(main)
    const dirs = [...new Set([mainDir !== '.' && mainDir !== '' ? mainDir : null, 'lib', 'dist'].filter(Boolean))]
    for (const d of dirs) {
      const hit = findFiles(repoPath, d, /\.(mjs|js|cjs)$/)
      if (hit.length) { files = hit; break }
    }
  }
  return files
}

function readdirSafe(dir) {
  try { return readdirSync(dir).filter((n) => !n.startsWith('.')) } catch { return [] }
}

function readSource(files) {
  return files.map((f) => {
    try { return { f, text: stripComments(readFileSync(f, 'utf8')) } } catch { return { f, text: '' } }
  })
}

function stripComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
}

/** 抓一个仓对外 provide 的服务键（`new Service(ctx,'x')` / `ctx.provide('x')`）。 */
function scanProvideKeys(dir) {
  const out = []
  for (const sub of ['src', 'lib']) {
    if (!existsSync(path.join(dir, sub))) continue
    for (const f of findFiles(dir, sub, /\.(ts|mts|cts|tsx|mjs|js|cjs)$/)) {
      let text
      try { text = stripComments(readFileSync(f, 'utf8')) } catch { continue }
      for (const m of text.matchAll(/super\(\s*(?:ctx|this\.ctx)\s*,\s*['"]([A-Za-z_$][\w$]*)['"]/g)) out.push(m[1])
      for (const m of text.matchAll(/(?:this\.)?ctx\.provide\(\s*['"]([A-Za-z_$][\w$]*)['"]/g)) out.push(m[1])
    }
  }
  for (const e of readdirSafe(dir)) {
    if (!/\.(mjs|js|cjs)$/.test(e)) continue
    let text
    try { text = stripComments(readFileSync(path.join(dir, e), 'utf8')) } catch { continue }
    for (const m of text.matchAll(/super\(\s*(?:ctx|this\.ctx)\s*,\s*['"]([A-Za-z_$][\w$]*)['"]/g)) out.push(m[1])
    for (const m of text.matchAll(/(?:this\.)?ctx\.provide\(\s*['"]([A-Za-z_$][\w$]*)['"]/g)) out.push(m[1])
  }
  return out
}

export { pass, fail, warn, skip, envskip, na, locateDshInstall }
