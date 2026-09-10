// 生态·集合站清单校验（CC1–CC5）
// 依据：工作区存量盘点（2026-09-07）——dsh-plugin-certification spec v1 注册表、
// adp-list 收录条目 schema、dsh-catalog 市场目录、omdsh Workshop v2、dsh-plugin-kit 三门。
import path from 'node:path'
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { runStep, pass, fail, warn, skip, na, tail, readJson, findFiles } from './util.mjs'

export const GROUP = '生态·集合站清单'

const CAT_IDS = ['agi', 'ui', 'usage', 'theme', 'model', 'identity', 'session', 'memory', 'tools', 'wsl', 'browser', 'vision', 'voice', 'docs', 'skill', 'workflow', 'git', 'notify', 'dev', 'security', 'remote', 'market', 'fun']
const OMSDSH_ACTIVATION = ['immediate', 'hot-reload', 'restart-plugin', 'restart-profile', 'restart-host']

function githubSlug(pkg) {
  const repo = typeof pkg.repository === 'string' ? pkg.repository : pkg.repository?.url ?? ''
  const m = String(repo).match(/github\.com[:/]([^/]+)\/([^/.]+?)(?:\.git)?$/)
  return m ? { owner: m[1], repo: m[2], slug: `${m[1]}__${m[2]}` } : null
}

export function addChecks(doctor, ctx) {
  const ws = ctx.workspaceRoot
  const { pkg, pkgName, repoPath } = ctx
  const g = githubSlug(pkg)

  doctor.add(GROUP, 'CC1 认证注册表（dsh-plugin-certification spec v1）', () => {
    const p = path.join(ws, 'dsh-plugin-certification', 'data', 'certified.json')
    if (!existsSync(p)) return skip('认证仓本地不存在（--workspace 外运行无法核对）')
    if (!g) return skip('无法从 repository 字段解析 GitHub owner/repo')
    const data = readJson(p)
    const hit = (data.entries ?? []).find((e) => String(e.repo).toLowerCase() === `${g.owner}/${g.repo}`.toLowerCase())
    if (!hit) return skip('未收录于认证注册表（可选渠道）')
    const problems = []
    if (!hit.grade) problems.push('缺 grade')
    if (!hit.snapshot) problems.push('缺 snapshot')
    for (const d of ['manifest', 'buildHygiene', 'supplyChain', 'releaseIntegrity', 'installSmoke']) {
      const dim = hit.dimensions?.[d]
      if (!dim || !dim.evidence) problems.push(`维度 ${d} 缺 evidence`)
      if (dim && d === 'installSmoke' && dim.result === 'install-fail') problems.push('installSmoke=install-fail（认证硬门失败级）')
    }
    if (hit.veto) problems.push(`存在 veto: ${JSON.stringify(hit.veto)}`)
    if (problems.length) return warn(`已收录（grade ${hit.grade ?? '?'}）但有缺口:\n${problems.join('\n')}`)
    const smoke = hit.dimensions.installSmoke.result
    return pass(`grade ${hit.grade} · snapshot ${hit.snapshot} · installSmoke=${smoke} · 五维 evidence 齐全、无 veto`)
  })

  doctor.add(GROUP, 'CC2 收录条目（adp-list awesome-dsh-plugin）', () => {
    if (!g) return skip('无法解析 GitHub slug')
    const dir = path.join(ws, 'adp-list', 'data', 'plugins')
    if (!existsSync(dir)) return skip('adp-list 本地不存在')
    const hits = readdirSync(dir).filter((f) => f === `${g.slug}.yml` || f.startsWith(`${g.slug}--`))
    if (!hits.length) return skip('未收录于 adp-list（可选渠道）')
    const problems = []
    for (const f of hits) {
      const text = readFileSync(path.join(dir, f), 'utf8')
      const kv = {}
      // 注意：本环境 `$` 不匹配行尾孤立 \r 之前，行必须按 /\r?\n/ 切分并先剥 \r
      for (const line0 of text.split(/\r?\n/)) {
        const line = line0.replace(/\r$/, '')
        const m = line.match(/^\s*([A-Za-z0-9_.-]+):\s*([\s\S]*)$/)
        if (m) kv[m[1]] = m[2].trim()
      }
      for (const k of ['url', 'name', 'category']) if (!(k in kv)) problems.push(`${f}: 缺 ${k}`)
      if (kv.category && !CAT_IDS.includes(kv.category)) problems.push(`${f}: category=${kv.category} 不在 23 值枚举`)
      if (kv.url && !kv.url.includes(`${g.owner}/${g.repo}`)) problems.push(`${f}: url 与 repository 不符（${kv.url}）`)
      if (!/description:/.test(text) || !/^\s*en:\s*\S+/m.test(text)) problems.push(`${f}: description.en 必填单行`)
      if (kv.tarball) {
        if (!/^https:\/\/(github\.com|objects\.githubusercontent\.com|release-assets\.githubusercontent\.com)\/.*\/releases\/.+\.tgz$/.test(kv.tarball)) problems.push(`${f}: tarball 必须 GitHub Release 托管 https .tgz`)
      }
    }
    if (problems.length) return fail(problems.join('\n'))
    return pass(`已收录 ${hits.length} 条（${hits.join(', ')}），字段/枚举/描述校验通过`)
  })

  doctor.add(GROUP, 'CC3 市场目录条目（dsh-catalog）', () => {
    const p = path.join(ws, 'dsh-catalog', 'data', 'packages.json')
    if (!existsSync(p)) return skip('dsh-catalog 本地不存在')
    const list = readJson(p)
    const hit = (Array.isArray(list) ? list : []).find((e) => e.npm === pkgName)
    if (!hit) return skip('未收录于 DSH Desktop Market 目录（可选渠道）')
    const problems = []
    for (const k of ['npm', 'repo', 'displayName', 'categories', 'summary']) if (!(k in hit)) problems.push(`缺 ${k}`)
    if (hit.repo && g && !String(hit.repo).includes(`${g.owner}/${g.repo}`)) problems.push('repo 字段与 repository 不符')
    if (!Array.isArray(hit.categories) || !hit.categories.length) problems.push('categories 必须为非空数组')
    if (typeof hit.summary === 'string' && hit.summary.length > 1000) problems.push('summary 超 v1 schema 1000 字符上限')
    if (typeof hit.summary === 'string' && /dsh\s+plugin\s+--profile|pnpm\s+add|npm\s+i(nstall)?\s/.test(hit.summary)) problems.push('summary 含安装命令文本（v1 schema 禁止）')
    if (typeof hit.summary === 'string' && !/[.!?)—–"」』]$/.test(hit.summary.trim())) problems.push('summary 疑被截断（未以句读符结尾）')
    if (problems.length) return fail(problems.join('\n'))
    return pass(`目录第 ${list.indexOf(hit) + 1} 条（displayName: ${hit.displayName}）`)
  })

  doctor.add(GROUP, 'CC4 omdsh Workshop 清单（dshWorkshop）', () => {
    const w = pkg.dshWorkshop
    if (!w) return skip('未声明 dshWorkshop（omdsh 可选渠道；harness 不读此字段，激活只看 dsh.bundle）')
    const problems = []
    const act = w.lifecycle?.activation
    if (!act) problems.push('缺 lifecycle.activation')
    else if (!OMSDSH_ACTIVATION.includes(act)) problems.push(`activation=${act} 不在 5 值枚举（build-omdsh-submission.mjs 会 throw）`)
    if (problems.length) return fail(problems.join('\n'))
    return pass(`activation=${act} · restartRequired=${/^restart-/.test(act)}（hub intake 推导规则一致）`)
  })

  doctor.add(GROUP, 'CC5 插件三门（license/五语 README/seam 三角色）', () => {
    // R-fix 2：这三门（Apache-2.0 + 五语 README + seam 三角色 marker）是 PerryLink 家族私有标准，
    // 不是生态标准。旧实现在没有家族 workspace 时改跑「本地降级检查」并把它施加到目标仓上 →
    // 任何外部作者跑 --only CC 都会被判 fail（不是环境假红，是真判据），且该 fail 会被误读为工具故障。
    // 现在：家族私有标准只在家族工作区内核对（kit CLI 存在），其余显式 not-applicable。
    const kitCli = path.join(ws, 'dsh-plugin-kit', 'lib', 'verify', 'cli.js')
    if (!existsSync(kitCli)) {
      return na('家族私有标准（Apache-2.0 / 五语 README / seam 三角色）不适用于非家族仓；'
        + '如需核对请在家族工作区内运行（--workspace 指向含 dsh-plugin-kit 的目录）')
    }
    const r = runStep('cc5-kit', process.execPath, [kitCli, 'all', repoPath], { cwd: ws, logDir: ctx.logDir, timeout: 120_000, shell: false })
    if (r.ok) return pass('dsh-plugin-kit 三门 CLI 全过')
    const out = `${r.out}\n${r.err}`
    const note = /no source files found under src/.test(out)
      ? '\n注：该仓无 src/ 目录，kit verify-seam 结构不适用（kit 已支持根层 JS 回退，此处以 kit 输出为准）' : ''
    if (r.code === 1) return fail(`dsh-plugin-kit 三门失败:\n${tail(out, 12)}${note}`)
    return fail(`dsh-plugin-kit 三门执行异常（exit ${r.code}）:\n${tail(r.err)}${note}`)
  })
}
