// 检测框架：零依赖，检查注册 / 运行 / 判定 / 渲染
//
// 不可变契约（R-fix 0B 冻结；家族 37 仓的 CI 依赖它们，任何改动都会造成硬红）：
//   1. 结果项 res.name 保留 `^R[0-8] / ^K[1-9] / ^D\d / ^CC\d ` 前缀 —— ID 只新增字段，绝不从 name 里拆走
//   2. 结果项仍是扁平数组（JSON 的 .results），按注册顺序稳定输出
//   3. 渲染行的形态不变（`[STATUS] <name>`），stdout 必须仍含 "R0 " 与 "K1 "
//      （族内 `plugin-doctor.yml` 门禁只 grep 这两处）。**0.3.2 起在汇总行之后
//      追加降级提示行**（`renderDegraded`），只在 degraded 非空时出现 —— 这是
//      SPEC §3.2 "must report the degraded groups" 在宿主半区的落实，不影响上面两条。
//   4. skip 不算 fail（verdict.ok 只看 fail/error）
export const GROUP_IDS = {
  '静态·包结构': 'R',
  '静态·cordis 契约扫描': 'K',
  '动态·沙箱冒烟': 'D',
  '生态·集合站清单': 'CC',
  // X 组 = 对宿主真实面的求值（服务面/事件面/内置行/peer 走廊）。
  // 与 K 组的边界：K 是文本启发式，X 是"拿宿主自己的判决器算"。
  // X 组可在拿不到宿主面时整组降级（degradedGroups ⇒ exit 6），而 K 组仍给提示。
  '动态面·宿主契约': 'X',
}

export class Doctor {
  constructor() {
    this.checks = []
  }

  add(group, name, fn, opts = {}) {
    this.checks.push({ group, name, fn, opts })
  }

  /**
   * @param {unknown} ctx 透传给每个检查函数；本方法只转发，不读取
   * @param {{ groups?: string[] }} [options] `groups` 给了就只跑这些分组
   */
  async run(ctx, { groups } = {}) {
    const results = []
    for (const c of this.checks) {
      if (groups && !groups.includes(c.group)) continue
      let res
      try {
        res = await c.fn(ctx)
        if (typeof res === 'string') res = { status: 'pass', message: res }
        if (!res || typeof res !== 'object') res = { status: 'pass', message: String(res) }
      } catch (err) {
        res = { status: 'error', message: err && err.stack ? err.stack : String(err), category: 'doctor-internal' }
      }
      res.group = c.group
      res.name = c.name
      res.critical = !!c.opts.critical
      // 稳定 ID 从 name 前缀派生（只读，不改写 name）
      const m = /^([A-Z]{1,3})(\d+)\s/.exec(c.name)
      res.id = m ? `${m[1]}${m[2]}` : null
      res.groupId = GROUP_IDS[c.group] ?? null
      if (!res.category) res.category = res.status === 'skip' ? 'not-applicable' : 'plugin-defect'
      results.push(res)
    }
    return results
  }
}

/** 按组统计：total / ran（非 skip）/ skipped / 各状态计数 / 累计 filesInspected */
export function summarizeGroups(results) {
  const out = {}
  for (const r of results) {
    const g = r.groupId ?? '?'
    const s = (out[g] ??= { total: 0, ran: 0, skipped: 0, pass: 0, warn: 0, fail: 0, error: 0, skip: 0, filesInspected: 0 })
    s.total += 1
    s[r.status] = (s[r.status] ?? 0) + 1
    if (r.status === 'skip') s.skipped += 1
    else s.ran += 1
    if (typeof r.filesInspected === 'number') s.filesInspected += r.filesInspected
  }
  return out
}

/** 被请求、但一条都没真跑的组（全部 skip）→ 该次运行「降级」，不得裸报成功 */
export function degradedGroups(groups) {
  return Object.entries(groups).filter(([, v]) => v.total > 0 && v.ran === 0).map(([k]) => k)
}

// 最坏状态排序：error/fail > warn > skip > pass
export function verdict(results, { degraded = [] } = {}) {
  let worst = 'pass'
  for (const r of results) {
    if (r.status === 'error' && worst !== 'error') worst = 'error'
    else if (r.status === 'fail' && worst !== 'error') worst = 'fail'
    else if (r.status === 'warn' && worst === 'pass') worst = 'warn'
    else if (r.status === 'skip' && worst === 'pass') worst = 'skip'
  }
  const criticalFail = results.some((r) => r.critical && (r.status === 'fail' || r.status === 'error'))
  // 退出码契约：0 = 无 fail/error（可含 warn/skip）；1 = 存在 fail/error
  return { worst, criticalFail, ok: worst !== 'fail' && worst !== 'error', degraded }
}

const ICONS = { pass: '[PASS]', warn: '[WARN]', fail: '[FAIL]', error: '[ERROR]', skip: '[SKIP]' }

/**
 * 降级提示行。**这是"用户可见"的唯一渲染出口** —— CLI（doctor.mjs）与宿主半区
 * （plugin.mjs 的 plugin_doctor 工具、/doctor 命令）都用它。
 *
 * 为什么必须是 render 的一部分（缺陷实测，2026-10-13）：`verdict()` 把 degraded
 * 放进返回值，但 `render()` 从不读它，于是宿主半区返回的 `r.report` 里**看不到任何
 * 降级痕迹**：X 组整组 skip 时，用户读到的是 4 条 [SKIP] + `总判定: SKIP`，与
 * "本来就没有 X 组要跑的项"无法区分。SPEC §3.2 要求降级运行"must not report success"
 * 且"reports the degraded groups" —— CLI 满足，宿主半区不满足。
 *
 * @param {string[]} degraded `degradedGroups()` 的结果
 * @param {{ allowDegraded?: boolean, hint?: string }} [opts]
 * @returns {string} 无降级时为空串（调用方无须判断）
 */
export function renderDegraded(degraded, { allowDegraded = false, hint } = {}) {
  if (!degraded?.length) return ''
  const lines = [
    `[降级] 以下分组整组未真跑（全部 skip），本次结论不可当作通过: ${degraded.join(', ')}`,
  ]
  if (hint) lines.push(`       ${hint}`)
  if (!allowDegraded) lines.push('       如需显式接受，请加 --allow-degraded（退出码将降为 0）')
  return lines.join('\n')
}

export function render(results, { degraded = [] } = {}) {
  const lines = []
  let lastGroup = null
  for (const r of results) {
    if (r.group !== lastGroup) {
      lines.push('', `== ${r.group} ==`)
      lastGroup = r.group
    }
    const tag = r.critical ? ' [关键]' : ''
    lines.push(`${ICONS[r.status] ?? '[?]'} ${r.name}${tag}`)
    const msg = String(r.message ?? '').trim()
    if (msg) {
      for (const line of msg.split('\n')) lines.push(`    ${line}`)
    }
    if (r.evidence) lines.push(`    证据: ${r.evidence}`)
  }
  const v = verdict(results)
  const counts = {}
  for (const r of results) counts[r.status] = (counts[r.status] ?? 0) + 1
  lines.push(
    '',
    `=== 汇总: ${Object.entries(counts).map(([k, n]) => `${k}=${n}`).join(' ')} | 总判定: ${v.worst.toUpperCase()}${v.criticalFail ? '（含关键项失败）' : ''} ===`,
  )
  // 降级必须在**渲染结果里**留痕，不能只活在退出码/信封字段里：宿主半区
  // （工具与命令）只把本函数的返回值交给用户，退出码对它不存在。
  const degradedLine = renderDegraded(degraded)
  if (degradedLine) lines.push('', degradedLine)
  return lines.join('\n')
}
