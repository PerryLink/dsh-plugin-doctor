// dsh-plugin-doctor 检测框架：零依赖，检查注册 / 运行 / 判定 / 渲染
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
        res = { status: 'error', message: err && err.stack ? err.stack : String(err) }
      }
      res.group = c.group
      res.name = c.name
      res.critical = !!c.opts.critical
      results.push(res)
    }
    return results
  }
}

// 最坏状态排序：error/fail > warn > skip > pass
export function verdict(results) {
  let worst = 'pass'
  for (const r of results) {
    if (r.status === 'error' && worst !== 'error') worst = 'error'
    else if (r.status === 'fail' && worst !== 'error') worst = 'fail'
    else if (r.status === 'warn' && worst === 'pass') worst = 'warn'
    else if (r.status === 'skip' && worst === 'pass') worst = 'skip'
  }
  const criticalFail = results.some((r) => r.critical && (r.status === 'fail' || r.status === 'error'))
  return { worst, criticalFail, ok: worst === 'pass' }
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
