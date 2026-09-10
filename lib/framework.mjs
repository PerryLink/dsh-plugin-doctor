// 检测框架：零依赖，检查注册 / 运行 / 判定 / 渲染
//
// 不可变契约（R-fix 0B 冻结；家族 37 仓的 CI 依赖它们，任何改动都会造成硬红）：
//   1. 结果项 res.name 保留 `^R[0-8] / ^K[1-9] / ^D\d / ^CC\d ` 前缀 —— ID 只新增字段，绝不从 name 里拆走
//   2. 结果项仍是扁平数组（JSON 的 .results），按注册顺序稳定输出
//   3. 渲染行的形态不变（`[STATUS] <name>`），stdout 必须仍含 "R0 " 与 "K1 "
//   4. skip 不算 fail（verdict.ok 只看 fail/error）
export const GROUP_IDS = {
  '静态·包结构': 'R',
  '静态·cordis 契约扫描': 'K',
  '动态·沙箱冒烟': 'D',
  '生态·集合站清单': 'CC',
}

export class Doctor {
  constructor() {
    this.checks = []
  }

  add(group, name, fn, opts = {}) {
    this.checks.push({ group, name, fn, opts })
  }

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

export function render(results) {
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
  return lines.join('\n')
}
