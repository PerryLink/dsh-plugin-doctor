#!/usr/bin/env node
// dsh-plugin-doctor：dsh 插件「完整性 + 运行流畅」一体检测器
// 分组：静态·包结构 / 静态·cordis 契约扫描 / 动态·沙箱冒烟 / 生态·集合站清单
import path from 'node:path'
import { readFileSync, existsSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { Doctor, verdict, render } from './lib/framework.mjs'
import { addChecks as addPackageChecks } from './lib/checks-package.mjs'
import { addChecks as addCordisChecks } from './lib/checks-cordis.mjs'
import { addSmokeChecks } from './lib/checks-smoke.mjs'
import { addChecks as addCollectionChecks } from './lib/checks-collections.mjs'

const USAGE = `dsh-plugin-doctor —— dsh 插件完整性 + 运行流畅一体检测器

用法: node doctor.mjs --repo <插件仓路径> [选项]

选项:
  --no-smoke        跳过动态沙箱冒烟（默认执行；需网络 + pnpm）
  --dsh <版本>      冒烟宿主版本（默认 0.1.2-rc.1 = npm 已发布 latest）
  --only <分组>     只跑指定分组（逗号分隔）。推荐用 ASCII 别名（编码安全）：
                      R  = 静态·包结构
                      K  = 静态·cordis 契约扫描
                      D  = 动态·沙箱冒烟
                      CC = 生态·集合站清单
                    中文全名同样可用；大小写不敏感。
  --json <路径>     另存 JSON 报告
  -h, --help        显示帮助

退出码: 0 = 无 fail/error（可含 warn/skip）；1 = 存在 fail/error；2 = 用法/分组错误或零检查
安全: 冒烟全程使用 %TEMP% mkdtemp 临时 DSH_HOME，绝不触碰真实 ~/.dsh

防静默通过: --only 里的分组名只要有一个不匹配（例如文件编码损坏导致中文变成乱码），
本工具立即以退出码 2 失败，绝不"零检查 + exit 0"。`

// 分组 ASCII 别名（工作流里用它们可免受文件编码影响；中文全名仍可用）
const GROUP_ALIASES = {
  R: '静态·包结构',
  K: '静态·cordis 契约扫描',
  D: '动态·沙箱冒烟',
  CC: '生态·集合站清单',
}

function parseArgs(argv) {
  const opts = { repo: null, smoke: true, dshVersion: '0.1.2-rc.1', json: null, groups: null, help: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--repo' || a === '-r') opts.repo = argv[++i]
    else if (a === '--no-smoke') opts.smoke = false
    else if (a === '--dsh') opts.dshVersion = argv[++i]
    else if (a === '--json') opts.json = argv[++i]
    else if (a === '--only') opts.groups = argv[++i].split(',').map((s) => s.trim())
    else if (a === '--help' || a === '-h') opts.help = true
    else if (!a.startsWith('-')) opts.repo = a
  }
  return opts
}

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  if (opts.help) { console.log(USAGE); return }
  if (!opts.repo) { console.error('缺少 --repo <路径>\n\n' + USAGE); process.exitCode = 2; return }
  const repoPath = path.resolve(opts.repo)
  const pkgPath = path.join(repoPath, 'package.json')
  if (!existsSync(pkgPath)) { console.error(`未找到 ${pkgPath}`); process.exitCode = 2; return }
  let pkg
  try { pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) } catch (e) {
    console.error(`package.json 解析失败: ${e.message}`); process.exitCode = 2; return
  }
  const logDir = mkdtempSync(path.join(tmpdir(), 'dsh-doctor-logs-'))
  const ctx = {
    repoPath,
    pkg,
    pkgName: pkg.name,
    logDir,
    workspaceRoot: path.resolve(import.meta.dirname, '..'),
  }
  const doctor = new Doctor()
  addPackageChecks(doctor, ctx)
  addCordisChecks(doctor, ctx)
  addCollectionChecks(doctor, ctx)
  if (opts.smoke) addSmokeChecks(doctor, ctx, { dshVersion: opts.dshVersion })

  const knownGroups = [...new Set(doctor.checks.map((c) => c.group))]
  if (opts.groups) {
    // 别名 → 分组全名；大小写不敏感。未命中的 token 原样保留，下面统一报错。
    const resolved = opts.groups.map((t) => GROUP_ALIASES[t.toUpperCase()] ?? t)
    const unknown = resolved.filter((g) => !knownGroups.includes(g))
    if (unknown.length > 0) {
      console.error(
        `未知分组: ${unknown.join(', ')}\n` +
          `可用分组: ${knownGroups.map((g) => `${g}（${Object.keys(GROUP_ALIASES).find((a) => GROUP_ALIASES[a] === g) ?? '-'}）`).join(', ')}`,
      )
      process.exitCode = 2
      return
    }
    opts.groups = resolved
  }

  const results = await doctor.run(ctx, { groups: opts.groups })
  if (results.length === 0) {
    console.error('没有任何检查被执行（--only 未匹配到任何分组）——拒绝静默通过，退出码 2')
    process.exitCode = 2
    return
  }
  console.log(`# dsh-plugin-doctor 报告\n目标: ${repoPath}\n包名: ${ctx.pkgName}`)
  console.log(render(results))
  console.log(`日志目录: ${logDir}`)
  if (opts.json) {
    writeFileSync(opts.json, JSON.stringify({ repo: repoPath, pkgName: ctx.pkgName, results }, null, 2), 'utf8')
    console.log(`JSON 报告: ${opts.json}`)
  }
  process.exitCode = verdict(results).ok ? 0 : 1
}

main().catch((err) => { console.error(err); process.exitCode = 2 })
