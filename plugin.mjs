// plugin.mjs —— dsh-plugin-doctor 的 DSH bundle 宿主半区
//
// 通过 cordis.patch.yml 行加载（package.json 的 `dsh.bundle.patch`）：
//
//   dsh plugin --profile web add @perrylink/dsh-plugin-doctor
//
// 注册一个只读的 plugin_doctor 工具与 /doctor 命令，1:1 复用 doctor.mjs
// 的静态检查层（R 包结构 / K cordis 契约 / CC 集合站清单；D 沙箱冒烟为
// 工具参数显式开启）。CLI（bin: doctor.mjs）不受影响。
import path from 'node:path'
import { readFileSync, existsSync, mkdtempSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { Doctor, render, verdict, summarizeGroups, degradedGroups } from './lib/framework.mjs'
import { addChecks as addPackageChecks } from './lib/checks-package.mjs'
import { addChecks as addCordisChecks } from './lib/checks-cordis.mjs'
import { addChecks as addRuntimeChecks } from './lib/checks-runtime.mjs'
import { addSmokeChecks } from './lib/checks-smoke.mjs'
import { addChecks as addCollectionChecks } from './lib/checks-collections.mjs'
import { quarantineSandbox, redact } from './lib/util.mjs'
import { locateDshInstall } from './lib/host-surface.mjs'
import { resolveWorkspaceRoot } from './lib/workspace.mjs'

export const name = '@perrylink/dsh-plugin-doctor'

// Cold start: the loader must wait for both services before apply() reads them,
// otherwise ctx.get('tools'/'commands') races service activation and the tool
// is never registered (issue #12).
export const inject = ['tools', 'commands']

/**
 * 没有工作区时的**诚实**说明。
 * 旧实现让 CC1/CC3 各自报"本地不存在"，把"没找对目录"说成"这台机器上没有" ——
 * 两者对用户是不同的事实，不能混。
 */
const NO_WORKSPACE_NOTE = '未能定位家族工作区（既没有 workspace 参数/DSH_WORKSPACE，也无法从被检仓向上找到含 ≥2 个 DSH 插件仓的目录）'
  + ' ⇒ CC1–CC4 的"本地不存在"与 K14 的"未发现第二个插件仓"都只说明**没查到**，不说明那些仓不存在。'
  + '需要核对时用 plugin_doctor 的 workspace 参数指定家族工作区目录。'

/** 静态 R/K 组（默认）+ X 宿主契约组 + 可选 D 组冒烟，返回脱敏后的结构化报告。 */
async function runDoctor(repoPath, { smoke = false, host = true, workspace = null } = {}) {
  const abs = path.resolve(repoPath)
  const pkgPath = path.join(abs, 'package.json')
  if (!existsSync(pkgPath)) return { ok: false, error: `未找到 ${pkgPath}` }
  let pkg
  try {
    pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
  } catch (e) {
    return { ok: false, error: `package.json 解析失败: ${e.message}` }
  }

  const runRoot = mkdtempSync(path.join(tmpdir(), 'doctor-run-'))
  const logDir = path.join(runRoot, 'logs')
  mkdirSync(logDir, { recursive: true })
  // 宿主版本实测，绝不硬编码：旧实现把 0.1.2-rc.1 写死在这里，
  // 而那个版本早于 peer 执法起点（dsh-v0.1.7-rc.1），冒烟与判定都失去鉴别力。
  const dshInstall = locateDshInstall(null)
  let dshInstallVersion = null
  if (dshInstall) {
    try { dshInstallVersion = JSON.parse(readFileSync(path.join(dshInstall, 'package.json'), 'utf8')).version ?? null } catch { dshInstallVersion = null }
  }
  const ws = resolveWorkspaceRoot(abs, { workspace, installDir: import.meta.dirname })
  const ctx = {
    repoPath: abs,
    pkg,
    pkgName: pkg.name,
    logDir,
    workspaceRoot: ws.root ?? process.cwd(),
    workspaceSource: ws.source,
    sandboxRoots: [runRoot],
    dshInstall,
    dshInstallVersion,
    hostVersions: [],
  }

  const doctor = new Doctor()
  addPackageChecks(doctor, ctx)
  addCordisChecks(doctor, ctx)
  if (host) addRuntimeChecks(doctor, ctx)
  addCollectionChecks(doctor, ctx)
  if (smoke) addSmokeChecks(doctor, ctx, { dshVersion: dshInstallVersion })

  const started = Date.now()
  const results = await doctor.run(ctx)
  const redactPaths = [abs, logDir, runRoot, ...(ctx.sandboxRoots ?? [])]
  for (const r of results) {
    if (typeof r.message === 'string') r.message = redact(r.message, redactPaths)
    if (typeof r.evidence === 'string') r.evidence = redact(r.evidence, redactPaths)
  }
  const groups = summarizeGroups(results)
  const degraded = degradedGroups(groups)
  const v = verdict(results, { degraded })
  const notes = []
  if (ws.root === null) notes.push(NO_WORKSPACE_NOTE)
  return {
    ok: v.ok,
    verdict: v,
    degraded,
    workspace: ws.root,
    workspaceSource: ws.source,
    notes,
    // 降级列表必须进渲染结果：宿主半区没有退出码可用，报告本身就是全部信息。
    report: render(results, { degraded }),
    durationMs: Date.now() - started,
    quarantine: quarantineSandbox({ root: runRoot }),
    hostDshVersion: dshInstallVersion,
  }
}

/** 报告 + 与宿主形态有关的补充说明（工作区未定位等），一次交给用户。 */
function withNotes(report, notes) {
  return notes.length ? `${report}\n\n[说明] ${notes.join('\n       ')}` : report
}

export function apply(ctx) {
  const tools = ctx.get('tools')
  if (tools) {
    ctx.effect(() => tools.register({
      name: 'plugin_doctor',
      description: '只读检查一个 DSH 插件仓库（R 包结构 / K cordis 契约 / X 宿主契约：peer 走廊、inject 服务面、patch 行可定位性；可选 D 沙箱冒烟）',
      parameters: {
        type: 'object',
        properties: {
          repo: { type: 'string', description: '被检插件仓库路径（含 package.json）' },
          smoke: { type: 'boolean', description: '是否额外执行 D 组沙箱冒烟（默认 false；需网络 + pnpm）' },
          host: { type: 'boolean', description: '是否执行 X 组宿主契约检查（默认 true；需要能读到一份 dsh 安装，读不到则该组降级）' },
          workspace: { type: 'string', description: '家族工作区目录（含多个 dsh-* 插件仓的父目录），用于 CC1–CC5 集合站清单与 K14 跨仓重名；默认自动从被检仓向上定位，也可用 DSH_WORKSPACE 环境变量' },
        },
        required: ['repo'],
      },
      output: {
        schema: { type: 'string' },
        render(args, value) {
          return [{ type: 'text', text: String(value) }]
        },
      },
      async execute(args) {
        const r = await runDoctor(args.repo, {
          smoke: !!args.smoke,
          host: args.host !== false,
          workspace: typeof args.workspace === 'string' ? args.workspace : null,
        })
        if (!r.ok && r.error) return `检查失败: ${r.error}`
        return withNotes(r.report, r.notes ?? [])
      },
    }))
  }

  const commands = ctx.get('commands')
  if (commands) {
    ctx.effect(() => commands.register({
      name: 'doctor',
      description: '对插件仓运行 dsh-plugin-doctor 检查（R/K/X 组）',
      input: { hint: '<插件仓路径>' },
      handler: async (invocation) => {
        const repo = (invocation.rawInput ?? '').trim()
        if (!repo) return { kind: 'error', text: '用法: /doctor <插件仓路径>' }
        try {
          const r = await runDoctor(repo)
          if (!r.ok && r.error) return { kind: 'error', text: `检查失败: ${r.error}` }
          return { kind: 'success', text: withNotes(r.report, r.notes ?? []) }
        } catch (err) {
          return { kind: 'error', text: `doctor 运行失败: ${err.message}` }
        }
      },
    }))
  }
}

export default { name, apply }
