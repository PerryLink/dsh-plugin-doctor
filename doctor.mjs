#!/usr/bin/env node
// dsh-plugin-doctor：dsh 插件「完整性 + 运行流畅」一体检测器
// 分组：静态·包结构(R) / 静态·cordis 契约扫描(K) / 动态·沙箱冒烟(D) / 生态·集合站清单(CC)
//
// 不可变契约（R-fix 0B）：name 前缀 / results 扁平数组 / stdout 含 "R0 " 与 "K1 " /
// 退出码 0(通过) 1(插件缺陷) 2(用法错误) 语义不变。新增码 3/4/5/6 只在原本会误判的场景出现。
import path from 'node:path'
import { readFileSync, existsSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { Doctor, verdict, render, summarizeGroups, degradedGroups } from './lib/framework.mjs'
import { addChecks as addPackageChecks } from './lib/checks-package.mjs'
import { addChecks as addCordisChecks } from './lib/checks-cordis.mjs'
import { addSmokeChecks } from './lib/checks-smoke.mjs'
import { addChecks as addCollectionChecks } from './lib/checks-collections.mjs'
import { quarantineSandbox, redact } from './lib/util.mjs'

const VERSION = JSON.parse(readFileSync(path.join(import.meta.dirname, 'package.json'), 'utf8')).version
const SCHEMA_VERSION = '2'
const CHECKSET = 'R0-R8+K1-K9+D0-D3,D9+CC1-CC5/1'
const QUARANTINE_PREFIX = 'doctor-quarantine-'

const USAGE = `dsh-plugin-doctor ${VERSION} —— dsh 插件完整性 + 运行流畅一体检测器

用法: node doctor.mjs --repo <插件仓路径> [选项]

选项:
  --repo, -r <路径>      被检插件仓（含 package.json）
  --workspace, -w <路径> 兄弟仓所在工作区根（用于 CC 组核对本地清单；缺省=工具自身父目录）
  --no-smoke        跳过动态沙箱冒烟（默认执行；需网络 + pnpm）
  --dsh <版本>      冒烟宿主版本（默认 ${'0.1.2-rc.1'} = npm 已发布 latest）
  --only <分组>     只跑指定分组（逗号分隔）。推荐用 ASCII 别名（编码安全）：
                      R  = 静态·包结构
                      K  = 静态·cordis 契约扫描
                      D  = 动态·沙箱冒烟
                      CC = 生态·集合站清单
                    中文全名同样可用；大小写不敏感。
  --allow-degraded  允许「被请求的组整组未真跑」时仍返回 0（默认返回 6）
  --json <路径|->   另存 JSON 报告；传 "-" 写 stdout（此时抑制人类可读报告）
  --purge <隔离目录> 删除本工具自己产生的隔离目录（仅接受 ${QUARANTINE_PREFIX}* 前缀）
  -h, --help        显示帮助
  -v, --version     显示版本

退出码:
  0 = 无 fail/error（可含 warn/skip）
  1 = 存在 fail/error（插件缺陷）
  2 = 用法错误、未知分组或未知选项
  3 = 基础设施错误（如缺 npm/pnpm 等环境不可用）
  4 = 不支持的宿主版本（宿主安装失败，不判插件）
  5 = 结果不稳定（步骤超时）
  6 = 降级：被请求的组整组未真跑（如无源文件可扫描）—— 不得当作通过

安全: 冒烟全程使用 %TEMP% 自建沙箱（前缀 doctor-，与宿主 %TEMP%\\dsh-* 保护模板不重叠），绝不触碰真实 ~/.dsh。
      运行结束只做「隔离不删除」（rename 到 ${QUARANTINE_PREFIX}*），需人工确认后用 --purge 清理。

防静默通过: --only 里的分组名只要有一个不匹配，本工具立即以退出码 2 失败。
            被请求的分组若整组未真跑（全 skip），以退出码 6 失败——除非显式 --allow-degraded。`

const GROUP_ALIASES = {
  R: '静态·包结构',
  K: '静态·cordis 契约扫描',
  D: '动态·沙箱冒烟',
  CC: '生态·集合站清单',
}

const FLAGS_WITH_VALUE = new Set(['--repo', '-r', '--workspace', '-w', '--dsh', '--json', '--only', '--purge'])

function parseArgs(argv) {
  const opts = {
    repo: null, workspace: null, smoke: true, dshVersion: '0.1.2-rc.1', json: null,
    groups: null, help: false, version: false, allowDegraded: false, purge: null,
  }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--repo' || a === '-r') opts.repo = argv[++i]
    else if (a === '--workspace' || a === '-w') opts.workspace = argv[++i]
    else if (a === '--no-smoke') opts.smoke = false
    else if (a === '--dsh') opts.dshVersion = argv[++i]
    else if (a === '--json') opts.json = argv[++i]
    else if (a === '--only') opts.groups = String(argv[++i] ?? '').split(',').map((s) => s.trim())
    else if (a === '--purge') opts.purge = argv[++i]
    else if (a === '--allow-degraded') opts.allowDegraded = true
    else if (a === '--help' || a === '-h') opts.help = true
    else if (a === '--version' || a === '-v') opts.version = true
    else if (a.startsWith('-')) {
      // 未知选项必须报错：旧实现会把未识别长选项的值当作位置参数、静默改写 --repo（静默错靶）
      return { ...opts, error: `未知选项: ${a}` }
    } else if (opts.repo === null) {
      opts.repo = a
    } else {
      return { ...opts, error: `多余的位置参数: ${a}（--repo 已由前一个位置参数占用）` }
    }
    if (FLAGS_WITH_VALUE.has(a) && argv[i] === undefined) return { ...opts, error: `选项 ${a} 缺少取值` }
  }
  return opts
}

function main() {
  const opts = parseArgs(process.argv.slice(2))
  if (opts.help) { console.log(USAGE); return 0 }
  if (opts.version) { console.log(VERSION); return 0 }
  if (opts.error) { console.error(`${opts.error}\n\n${USAGE}`); return 2 }

  // --purge：三段式的第三段（人工确认后清理）。只接受本工具自己的隔离目录。
  if (opts.purge) {
    const abs = path.resolve(opts.purge)
    if (!path.basename(abs).startsWith(QUARANTINE_PREFIX)) {
      console.error(`拒绝清理：只接受 ${QUARANTINE_PREFIX}* 前缀的隔离目录（收到 ${path.basename(abs)}）`)
      return 2
    }
    try { rmSync(abs, { recursive: true, force: true }) } catch (e) { console.error(`清理失败: ${e.message}`); return 3 }
    console.log(`已清理隔离目录: ${abs}`)
    return 0
  }

  if (!opts.repo) { console.error('缺少 --repo <路径>\n\n' + USAGE); return 2 }
  const repoPath = path.resolve(opts.repo)
  const pkgPath = path.join(repoPath, 'package.json')
  if (!existsSync(pkgPath)) { console.error(`未找到 ${pkgPath}`); return 2 }
  let pkg
  try { pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) } catch (e) { console.error(`package.json 解析失败: ${e.message}`); return 2 }

  const runRoot = mkdtempSync(path.join(tmpdir(), 'doctor-run-'))
  const logDir = path.join(runRoot, 'logs')
  mkdirSync(logDir, { recursive: true })
  const workspaceRoot = opts.workspace ? path.resolve(opts.workspace) : path.resolve(import.meta.dirname, '..')
  const ctx = {
    repoPath,
    pkg,
    pkgName: pkg.name,
    logDir,
    workspaceRoot,
    sandboxRoots: [runRoot],
  }

  const doctor = new Doctor()
  addPackageChecks(doctor, ctx)
  addCordisChecks(doctor, ctx)
  addCollectionChecks(doctor, ctx)
  if (opts.smoke) addSmokeChecks(doctor, ctx, { dshVersion: opts.dshVersion })

  const knownGroups = [...new Set(doctor.checks.map((c) => c.group))]
  if (opts.groups) {
    const resolved = opts.groups.map((t) => GROUP_ALIASES[t.toUpperCase()] ?? t)
    const unknown = resolved.filter((g) => !knownGroups.includes(g))
    if (unknown.length > 0) {
      const smokeHint = !opts.smoke && unknown.some((g) => GROUP_ALIASES.D === g)
        ? '\n注：D 组需要动态冒烟，不能与 --no-smoke 同时请求（要么去掉 --no-smoke，要么从 --only 里去掉 D）'
        : ''
      console.error(
        `未知分组: ${unknown.join(', ')}\n` +
          `可用分组: ${knownGroups.map((g) => `${g}（${Object.keys(GROUP_ALIASES).find((a) => GROUP_ALIASES[a] === g) ?? '-'}）`).join(', ')}${smokeHint}`,
      )
      return 2
    }
    opts.groups = resolved
  }

  const started = Date.now()
  const raw = doctor.run(ctx, { groups: opts.groups })
  return Promise.resolve(raw).then((results) => finish(results, { opts, ctx, repoPath, pkg, runRoot, logDir, started }))
}

function finish(results, { opts, ctx, repoPath, pkg, runRoot, logDir, started }) {
  if (results.length === 0) {
    console.error('没有任何检查被执行（--only 未匹配到任何分组）——拒绝静默通过，退出码 2')
    return 2
  }

  // 脱敏：把本次运行注入的绝对路径替换为占位符（R-fix 0C）
  const redactPaths = [repoPath, logDir, runRoot, ...(ctx.sandboxRoots ?? [])]
  for (const r of results) {
    if (typeof r.message === 'string') r.message = redact(r.message, redactPaths)
    if (typeof r.evidence === 'string') r.evidence = redact(r.evidence, redactPaths)
  }

  const groups = summarizeGroups(results)
  const degraded = degradedGroups(groups)
  const v = verdict(results, { degraded })
  const durationMs = Date.now() - started

  const envelope = {
    schemaVersion: SCHEMA_VERSION,
    doctorVersion: VERSION,
    checksetVersion: CHECKSET,
    target: {
      repo: repoPath,
      pkgName: pkg.name,
      pkgVersion: pkg.version ?? null,
      integrity: null,          // 取自 registry（npm view <pkg>@<ver> dist.integrity）；R/K 离线档不解析
      integritySource: 'unresolved',
    },
    env: {
      node: process.version,
      platform: process.platform,
      arch: process.arch,
      hostDshVersion: opts.smoke ? opts.dshVersion : null,
      smoke: opts.smoke,
    },
    startedAt: new Date(started).toISOString(),
    durationMs,
    quarantine: null,
    coverage: ctx.coverage ?? {},
    groups,
    degraded,
    verdict: { worst: v.worst, ok: v.ok, criticalFail: v.criticalFail },
    results,
  }

  const qPath = quarantineSandbox({ root: runRoot })
  envelope.quarantine = qPath

  const code = exitCodeFor(results, { degraded, allowDegraded: opts.allowDegraded })

  if (opts.json === '-') {
    process.stdout.write(JSON.stringify(envelope, null, 2) + '\n')
  } else {
    console.log(`# dsh-plugin-doctor 报告\n目标: ${repoPath}\n包名: ${pkg.name}`)
    console.log(render(results))
    if (degraded.length) {
      console.log(`\n[降级] 以下分组整组未真跑（全 skip），本次结论不可当作通过: ${degraded.join(', ')}`)
      if (!opts.allowDegraded) console.log('       如需显式接受，请加 --allow-degraded（退出码将降为 0）')
    }
    console.log(`沙箱隔离目录: ${qPath ?? '(未创建)'}（人工确认后用 --purge 清理）`)
    if (opts.json) {
      writeFileSync(opts.json, JSON.stringify(envelope, null, 2) + '\n', 'utf8')
      console.log(`JSON 报告: ${opts.json}`)
    }
  }
  return code
}

// 退出码映射：fail/error 优先（按 category 细分 3/4/5），其次「整组未真跑」→ 6。
function exitCodeFor(results, { degraded, allowDegraded }) {
  const bad = results.filter((r) => r.status === 'fail' || r.status === 'error')
  if (bad.length) {
    const cats = [...new Set(bad.map((r) => r.category))]
    if (cats.length === 1) {
      if (cats[0] === 'unsupported-host') return 4
      if (cats[0] === 'infrastructure') return 3
      if (cats[0] === 'unstable') return 5
    }
    return 1
  }
  if (degraded.length && !allowDegraded) return 6
  return 0
}

const out = main()
Promise.resolve(out).then((code) => { process.exitCode = typeof code === 'number' ? code : 0 }).catch((err) => {
  console.error(err)
  process.exitCode = 3
})
