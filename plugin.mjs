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
import { addSmokeChecks } from './lib/checks-smoke.mjs'
import { addChecks as addCollectionChecks } from './lib/checks-collections.mjs'
import { quarantineSandbox, redact } from './lib/util.mjs'

export const name = '@perrylink/dsh-plugin-doctor'

/** 静态 R/K/CC 组（默认）+ 可选 D 组冒烟，返回脱敏后的结构化报告。 */
async function runDoctor(repoPath, { smoke = false } = {}) {
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
  const ctx = {
    repoPath: abs,
    pkg,
    pkgName: pkg.name,
    logDir,
    workspaceRoot: path.resolve(import.meta.dirname, '..'),
    sandboxRoots: [runRoot],
  }

  const doctor = new Doctor()
  addPackageChecks(doctor, ctx)
  addCordisChecks(doctor, ctx)
  addCollectionChecks(doctor, ctx)
  if (smoke) addSmokeChecks(doctor, ctx, { dshVersion: '0.1.2-rc.1' })

  const started = Date.now()
  const results = await doctor.run(ctx)
  const redactPaths = [abs, logDir, runRoot, ...(ctx.sandboxRoots ?? [])]
  for (const r of results) {
    if (typeof r.message === 'string') r.message = redact(r.message, redactPaths)
    if (typeof r.evidence === 'string') r.evidence = redact(r.evidence, redactPaths)
  }
  const groups = summarizeGroups(results)
  const v = verdict(results, { degraded: degradedGroups(groups) })
  return {
    ok: v.ok,
    verdict: v,
    report: render(results),
    durationMs: Date.now() - started,
    quarantine: quarantineSandbox({ root: runRoot }),
  }
}

export function apply(ctx) {
  const tools = ctx.get('tools')
  if (tools) {
    ctx.effect(() => tools.register({
      name: 'plugin_doctor',
      description: '只读静态检查一个 DSH 插件仓库（R 包结构 / K cordis 契约 / CC 集合站清单；可选 D 沙箱冒烟）',
      parameters: {
        type: 'object',
        properties: {
          repo: { type: 'string', description: '被检插件仓库路径（含 package.json）' },
          smoke: { type: 'boolean', description: '是否额外执行 D 组沙箱冒烟（默认 false；需网络 + pnpm）' },
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
        const r = await runDoctor(args.repo, { smoke: !!args.smoke })
        if (!r.ok && r.error) return `检查失败: ${r.error}`
        return r.report
      },
    }))
  }

  const commands = ctx.get('commands')
  if (commands) {
    ctx.effect(() => commands.register({
      name: 'doctor',
      description: '对插件仓运行 dsh-plugin-doctor 静态检查（R/K/CC 组）',
      input: { hint: '<插件仓路径>' },
      handler: async (invocation) => {
        const repo = (invocation.rawInput ?? '').trim()
        if (!repo) return { kind: 'error', text: '用法: /doctor <插件仓路径>' }
        try {
          const r = await runDoctor(repo)
          if (!r.ok && r.error) return { kind: 'error', text: `检查失败: ${r.error}` }
          return { kind: 'success', text: r.report }
        } catch (err) {
          return { kind: 'error', text: `doctor 运行失败: ${err.message}` }
        }
      },
    }))
  }
}

export default { name, apply }
