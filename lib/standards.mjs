// lib/standards.mjs —— 把一次 doctor 运行投影到 DSH 的三条采用轨道上。
//
// 三条轨道由 PerryLink 维护的 DSH 规范项目定义（PerryLink/dsh-standards；
// 机器可读源 spec/levels.json，schema `dsh-levels/1`）：
//
//   DSH-ENTRY  兼容基线 —— 现有插件几乎不改，能不能被识别 / 安装 / 至少跑起来？
//   DSH-FLOW   推荐采用 —— 装得上之后，用户能不能装得上、配得动、用得顺、卸得净？
//   DSH-BOOST  指导性实践 —— 有没有用 Cordis 原生能力做得更省？
//
// 它们是三个不同的问题，不是三根刻度。因此本模块对每条轨道各给一个状态，
// 绝不把它们折成一个分数。
//
// 投影边界：
//   · 只有 ENTRY 能由 doctor 产出证据。判定组是 R（静态·包结构）、K（静态·
//     Cordis 契约扫描）、D（动态·沙箱冒烟）。X（宿主契约）doctor 也会报，且在
//     规范的 crosswalk 里被列为 doctor 的 entry 证据源；但本投影只让 R/K/D 决定
//     `entry.status`，X 是补充证据 —— 这样单独跑 `--only X` 不会把静态运行
//     悄悄升格成 runtime。
//   · FLOW 恒为 `manual`（J1–J8）：doctor 没有用户旅程 runner。
//   · BOOST 恒为 `not-measured`（LEV-1..LEV-8）：doctor 没有基准测试。
//
// 本模块是纯函数模块：不 import 任何东西，不读文件系统，不读时钟，不读 process。
// 输出只取决于两个入参，因此可以单测、可以嵌入，且没有副作用。

export const SCHEMA = 'dsh-levels/1'

/** 决定 ENTRY 状态的三个分组（顺序即证据输出顺序）。 */
export const ENTRY_GROUPS = ['R', 'K', 'D']

/**
 * D9 是沙箱隔离（清理动作），不是 boot 证据。
 * runtime 需要「打包 → 安装 → 组合层 → 真正跑到请求阶段」这条链真的跑过；
 * 只要其中任何一环是 skip（例如缺 pnpm 时 D1 以 environment 跳过，D2/D3 跟着
 * 跳过），这次运行就只能给 static。skip 不是 pass。
 */
export const RUNTIME_EVIDENCE_IDS = ['D0', 'D1', 'D2', 'D3']

/** 这些 category 在 SPEC §2 里明确不是插件缺陷；照实标出，但仍不改变 failed 判定。 */
const NON_PLUGIN_CATEGORIES = new Set([
  'environment',
  'infrastructure',
  'unsupported-host',
  'unstable',
  'doctor-internal',
])

const STATUSES = ['pass', 'warn', 'fail', 'error', 'skip']

const CHECK_ID = /^([A-Z]{1,3})(\d+)\s/
const ID = /^([A-Z]{1,3})\d+$/

/** 结果项的真实 ID：优先用稳定的 `id`，退化为 `name` 前缀（两者都是冻结契约）。 */
function checkId(result) {
  if (result && typeof result.id === 'string' && result.id) return result.id
  const m = CHECK_ID.exec(String(result?.name ?? ''))
  return m ? `${m[1]}${m[2]}` : null
}

function groupIdOf(result, id) {
  if (result && typeof result.groupId === 'string' && result.groupId) return result.groupId
  const m = ID.exec(id ?? '')
  return m ? m[1] : null
}

/**
 * 一个分组的证据。results 是权威来源；`groups`（framework 的 summarizeGroups
 * 结果）只在五值计数与 results 完全一致时用来对齐 ran/skipped，否则不采用 ——
 * 避免信封与模块各说一套，也避免汇总把失败项覆盖成绿色。
 */
function makeEvidence(group, results, summary) {
  const evidence = {
    status: 'not-run',
    ran: 0,
    skipped: 0,
    total: 0,
    counts: { pass: 0, warn: 0, fail: 0, error: 0, skip: 0 },
    failed: [],
    notAttributable: [],
    skippedChecks: [],
    criticalFailed: [],
  }

  for (const result of results) {
    if (groupIdOf(result, checkId(result)) !== group) continue
    // 未知状态按 error 处理：宁可失败关闭（fail closed），也不让畸形结果变成绿色。
    const status = STATUSES.includes(result?.status) ? result.status : 'error'
    const id = checkId(result)
    evidence.total += 1
    evidence.counts[status] += 1
    if (status === 'skip') {
      evidence.skipped += 1
      if (id) evidence.skippedChecks.push(id)
    } else {
      evidence.ran += 1
    }
    if (status === 'fail' || status === 'error') {
      if (id) evidence.failed.push(id)
      if (NON_PLUGIN_CATEGORIES.has(result?.category) && id) evidence.notAttributable.push(id)
      if (result?.critical && id) evidence.criticalFailed.push(id)
    }
  }

  if (
    summary
    && Number.isInteger(summary.total)
    && summary.total === evidence.total
    && Number.isInteger(summary.ran)
    && Number.isInteger(summary.skipped)
  ) {
    // `groups` 只是同一个 results 的汇总。只有在五值计数逐项一致时才采用它的
    // ran/skipped；任何不一致都说明两者描述的不是同一批检查，退回 results。
    // 不这样做的话，一个畸形状态（被上面归为 error）可能被 summary 的 error=0
    // 覆盖掉，变成假绿。
    const agrees = STATUSES.every((status) => {
      const reported = Number.isInteger(summary[status]) ? summary[status] : 0
      return reported === evidence.counts[status]
    })
    if (agrees) {
      evidence.total = summary.total
      evidence.ran = summary.ran
      evidence.skipped = summary.skipped
    }
  }

  evidence.status = groupStatus(evidence)
  return evidence
}

/** 分组最坏状态：沿用 doctor 的 verdict 顺序（error > fail > warn > skip > pass）。 */
function groupStatus(evidence) {
  if (evidence.total === 0) return 'not-run'
  if (evidence.counts.error > 0) return 'error'
  if (evidence.counts.fail > 0) return 'fail'
  if (evidence.counts.warn > 0) return 'warn'
  if (evidence.counts.skip > 0) return 'skip'
  return 'pass'
}

/** D0–D3 是否都真的跑过（pass/warn；skip 不算）。 */
function runtimeChainRan(results) {
  const byId = new Map()
  for (const result of results) {
    const id = checkId(result)
    if (id) byId.set(id, result)
  }
  return RUNTIME_EVIDENCE_IDS.every((id) => {
    const result = byId.get(id)
    return result?.status === 'pass' || result?.status === 'warn'
  })
}

function uniq(values) {
  return [...new Set(values)]
}

/**
 * 把一次 doctor 运行投影成 `dsh-levels/1`。
 *
 * @param {Array<Record<string, any>>} results doctor 的扁平结果数组（必填）
 * @param {Record<string, any>} [groups] `summarizeGroups(results)` 的结果（可选，仅用于对齐计数）
 * @returns {{ schema: string, nonOfficial: true, levels: Record<string, any> }}
 */
export function deriveStandards(results, groups) {
  if (!Array.isArray(results)) {
    throw new TypeError('deriveStandards: results must be an array')
  }

  const list = results
  const summary = groups && typeof groups === 'object' ? groups : {}
  const evidence = {}
  for (const group of ENTRY_GROUPS) {
    const inGroup = list.filter((result) => groupIdOf(result, checkId(result)) === group)
    evidence[group] = makeEvidence(group, inGroup, summary[group])
  }

  const failures = ENTRY_GROUPS.flatMap((group) => evidence[group].failed)
  const notAttributable = uniq(ENTRY_GROUPS.flatMap((group) => evidence[group].notAttributable))
  // 判定必须看 counts，而不是只看能解析出 ID 的数组：一个没有 ID 的 fail/error
  // 仍然是一次失败，不能因为没有可引用的名字就滑过去（fail closed）。
  const failureCount = ENTRY_GROUPS
    .reduce((sum, group) => sum + evidence[group].counts.fail + evidence[group].counts.error, 0)
  // 「或关键项失败」：critical 目前只有 R1，但判定不假设它一定在 R/K/D 之内。
  const criticalResults = list
    .filter((result) => result?.critical && (result.status === 'fail' || result.status === 'error'))
  const criticalFailed = uniq(criticalResults.map(checkId).filter(Boolean))
  const criticalFailCount = criticalResults.length

  const staticRan = evidence.R.ran > 0 && evidence.K.ran > 0
  const runtimeRan = runtimeChainRan(list)

  /** @type {'runtime'|'static'|'failed'|'not-run'} */
  let status
  if (failureCount > 0 || criticalFailCount > 0) {
    status = 'failed'
  } else if (staticRan && runtimeRan) {
    status = 'runtime'
  } else if (staticRan) {
    status = 'static'
  } else {
    status = 'not-run'
  }

  return {
    schema: SCHEMA,
    nonOfficial: true,
    levels: {
      entry: {
        status,
        evidence,
        note: entryNote({
          status, evidence, failures, notAttributable,
          criticalFailed, failureCount, criticalFailCount,
        }),
      },
      flow: {
        status: 'manual',
        checklist: 'J1-J8',
        note: 'doctor does not run user journeys',
      },
      boost: {
        status: 'not-measured',
        evidence: 'LEV-1..LEV-8',
        note: 'doctor does not benchmark',
      },
    },
  }
}

/** ENTRY 的诚实说明：说清「凭什么」，以及这次运行没有声称什么。 */
function entryNote({
  status, evidence, failures, notAttributable,
  criticalFailed, failureCount, criticalFailCount,
}) {
  const d = evidence.D

  if (status === 'failed') {
    const ids = uniq([...failures, ...criticalFailed])
    const label = ids.length > 0
      ? ids.join(', ')
      : `${failureCount + criticalFailCount} check(s) with no parseable id`
    const critical = criticalFailCount > 0
      ? ` Critical check(s) failed: ${criticalFailed.length > 0 ? criticalFailed.join(', ') : '(unidentified)'}.`
      : ''
    const hostOnly = notAttributable.length > 0
      ? ` ${notAttributable.join(', ')} carry a non-plugin category (environment, infrastructure, unsupported-host, unstable or doctor-internal); dsh-levels/1 still records failed because this projection has no blocked state (canonical DSH-ENTRY would call those blocked).`
      : ''
    return `ENTRY failed: ${label} returned fail/error.${critical}${hostOnly}`
  }

  if (status === 'runtime') {
    return 'R and K each ran at least one check, and the D0-D3 sandbox chain ran with no fail/error. This is the strongest ENTRY status this run supports; it does not establish canonical G4 (client shape) or G5 (freshness anchors).'
  }

  if (status === 'static') {
    const why = []
    if (d.total === 0) why.push('the D group was not part of this run')
    if (d.ran === 0 && d.total > 0) why.push('every D check was skipped')
    const skipped = d.skippedChecks.length > 0 ? `skipped D checks: ${d.skippedChecks.join(', ')}` : ''
    if (skipped) why.push(skipped)
    if (why.length === 0) why.push('D0-D3 did not all run')
    return `R and K ran with no fail/error, but the runtime chain is incomplete (${why.join('; ')}). static is not a pass and must not be cited as runtime.`
  }

  // not-run：到这里 staticRan 必为 false（否则会落到 static 或 runtime）。
  const r = evidence.R
  const k = evidence.K
  const dRan = d.ran > 0
  const detail = `R and K did not both run (R ran ${r.ran}/${r.total}, K ran ${k.ran}/${k.total})`
  const dNote = dRan
    ? ' The D chain did run, but a runtime claim also requires the static groups, so no ENTRY level is asserted.'
    : ''
  return `No ENTRY level can be established: ${detail}. not-run is not a pass.${dNote}`
}
