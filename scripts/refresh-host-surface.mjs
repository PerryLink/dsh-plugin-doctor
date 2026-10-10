#!/usr/bin/env node
// 从一份真实的 dsh 安装里再生成 lib/host-surface.data.mjs。
//
// 为什么需要它：doctor 现在把四张"宿主真实面"的来源表**手抄**在
// lib/checks-cordis.mjs / lib/checks-package.mjs 里（KNOWN_SEAMS 22 项、
// RESERVED_TOOL_NAMES ~63 项、BUILTIN_PATCH_ROWS 31 项、WATERFALL_EVENTS 17 项）。
// 实测（2026-10-07，宿主 0.2.1-alpha.1）四张表**全部与宿主不一致**：
//   service 91（+9 个 cordis 继承） vs 22；内置行 id 94 vs 31；waterfall 18 vs 17。
// 手抄表必然漂移，且漂移是静默的 —— 于是 doctor 会对正确的插件报假警、
// 对错误的插件放行。本脚本把手抄改成"从宿主可执行真相源生成 + 带基线版本戳"。
//
// 真相源（全部离线、都在 npm 包里，不需要 harness checkout、不需要联网）：
//   1. <dsh>/node_modules/@deepseek-ai/dsh-tool-cordis/lib/types/api-catalog.js
//      —— 官方生成物，导出 SERVICE_API(91) / EVENT_API(81) / TYPE_API(992) /
//         INHERITED_CTX_API(9)。文件头自述：
//         "Produced by the same AST walk as docs/cordis-catalog, so this data and
//          the rendered docs cannot diverge."
//   2. <dsh>/node_modules/@deepseek-ai/dsh-base/cordis.patch.yml —— 宿主自带行 id 全集
//   3. <dsh>/node_modules/@deepseek-ai/dsh-base/package.json —— 基线版本
//   4. <dsh>/package.json —— 可被宿主 preflight 评估的 peer 名白名单
//      （= 安装的直接 dependencies ∪ devDependencies；**用这个，不要用 isPlugin 的
//       物理目录列表**，二者含义不同，见 A2 报告：物理目录 289 含 29 个不在运行时闭包内的 devDeps）
//
// 用法：
//   node scripts/refresh-host-surface.mjs [--dsh <dsh 包目录>] [--out <文件>] [--check]
//   --check  只比较，不写盘；有差异则退出码 1（供 CI 新鲜度门禁使用）

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/** Recursively list .js files under a directory (skips nested node_modules). */
function walkJs(dir, out = [], depth = 0) {
  if (depth > 5) return out
  let entries
  try { entries = readdirSync(dir, { withFileTypes: true }) } catch { return out }
  for (const e of entries) {
    if (e.name === 'node_modules') continue
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walkJs(p, out, depth + 1)
    else if (e.name.endsWith('.js')) out.push(p)
  }
  return out
}

const HERE = path.dirname(fileURLToPath(import.meta.url))
const DEFAULT_OUT = path.join(HERE, '..', 'lib', 'host-surface.data.mjs')

function arg(name, fallback = null) {
  const i = process.argv.indexOf(name)
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}
const CHECK_ONLY = process.argv.includes('--check')
const OUT = path.resolve(arg('--out', DEFAULT_OUT))

/** 找一个可用的 dsh 安装目录（显式参数 > 本机全局 npm 安装 > 常见位置）。 */
function locateDsh(explicit) {
  const candidates = []
  if (explicit) candidates.push(explicit)
  if (process.env.DSH_INSTALL_DIR) candidates.push(process.env.DSH_INSTALL_DIR)
  const globalRoots = [
    process.env.APPDATA && path.join(process.env.APPDATA, 'npm', 'node_modules', '@deepseek-ai', 'dsh'),
    process.env.HOME && path.join(process.env.HOME, '.npm-global', 'lib', 'node_modules', '@deepseek-ai', 'dsh'),
    '/usr/local/lib/node_modules/@deepseek-ai/dsh',
    '/usr/lib/node_modules/@deepseek-ai/dsh',
  ].filter(Boolean)
  candidates.push(...globalRoots)
  for (const c of candidates) {
    if (c && existsSync(path.join(c, 'package.json'))) return path.resolve(c)
  }
  return null
}

/** Minimal reader for the `- insert:` row list in a bundle patch: ids only, in order. */
function readPatchRowIds(text) {
  const ids = []
  for (const raw of text.replace(/#.*$/gm, '').split(/\r?\n/)) {
    const m = /^\s*-?\s*id:\s*["']?([A-Za-z0-9_.:@/-]+)["']?\s*$/.exec(raw.trim())
    if (m) ids.push(m[1])
  }
  return [...new Set(ids)]
}

const dsh = locateDsh(arg('--dsh'))
if (!dsh) {
  console.error('找不到 dsh 安装目录。请用 --dsh <path> 指定（含 package.json 的 @deepseek-ai/dsh 目录）。')
  process.exit(2)
}

const nested = path.join(dsh, 'node_modules', '@deepseek-ai')
const catalogPath = path.join(nested, 'dsh-tool-cordis', 'lib', 'types', 'api-catalog.js')
const basePatchPath = path.join(nested, 'dsh-base', 'cordis.patch.yml')
const basePkgPath = path.join(nested, 'dsh-base', 'package.json')
for (const p of [catalogPath, basePatchPath, basePkgPath]) {
  if (!existsSync(p)) { console.error(`缺少真相源: ${p}`); process.exit(2) }
}

const catalog = await import(`file://${catalogPath.replace(/\\/g, '/')}`)
const basePkg = JSON.parse(readFileSync(basePkgPath, 'utf8'))
const dshPkg = JSON.parse(readFileSync(path.join(dsh, 'package.json'), 'utf8'))

const catalogServices = catalog.SERVICE_API.map((s) => s.key).sort()
// cordis 框架自带的 ctx 成员：api-catalog 用 "ctx.on / ctx.once" 这种**分组名**，
// 必须逐个方法拆出来，不能把整串当成员名（否则 `logger`/`config` 这类内建成员
// 会被判成"未知服务"，而对它们的访问本来就无需 inject）。
const inherited = new Set()
for (const g of catalog.INHERITED_CTX_API) {
  for (const m of String(g.name).matchAll(/ctx\.([A-Za-z_$][\w$]*)/g)) inherited.add(m[1])
}
// cordis Context 上真实存在、但分组标题里没逐个点名的成员
for (const extra of ['deps', 'name', 'filter', 'select', 'events']) inherited.add(extra)

const events = catalog.EVENT_API.map((e) => ({ name: e.name, mode: e.mode ?? null })).sort((a, b) => a.name.localeCompare(b.name))
const harnessWaterfall = events.filter((e) => e.mode === 'waterfall').map((e) => e.name)

// api-catalog 只覆盖 harness 侧。**cordis / loader 框架自身的事件不在里面**
// （例：`loader/patch-context`，来自 @deepseek-ai/cordis-plugin-loader）。
// 插件合法地监听框架事件，所以这两类要分开记录，不能混成一张表。
const frameworkWaterfall = ['loader/patch-context']

// 运行时真实提供的服务键（`new Service(ctx,'x')` / `ctx.provide('x')`）。
// 比 catalog 宽：客户端半区（locale / slots / commandUi / configForms …）与个别
// 宿主侧键（remote / workspaces）由这些包 provide，但不进 api-catalog ——
// 后者按官方生成脚本的 SERVICE_PAGE 分区只收 harness 面。用于"注入名是否真实存在"
// 的判定，必须与 catalog 名集合并集使用，否则会把 12 个家族仓的正确 inject 判成未知。
const runtimeServices = {}
for (const pkgDir of readdirSync(nested, { withFileTypes: true })) {
  if (!pkgDir.isDirectory()) continue
  const lib = path.join(nested, pkgDir.name, 'lib')
  if (!existsSync(lib)) continue
  for (const f of walkJs(lib)) {
    let text
    try { text = readFileSync(f, 'utf8') } catch { continue }
    for (const m of text.matchAll(/super\(\s*ctx\s*,\s*['"]([A-Za-z_$][\w$]*)['"]/g)) addRuntime(m[1], pkgDir.name)
    for (const m of text.matchAll(/\.provide\(\s*['"]([A-Za-z_$][\w$]*)['"]/g)) addRuntime(m[1], pkgDir.name)
  }
}
function addRuntime(key, pkg) {
  ;(runtimeServices[key] ??= new Set()).add(pkg)
}
const runtimeServiceKeys = Object.keys(runtimeServices).sort()
const catalogOnly = catalogServices.filter((k) => !(k in runtimeServices))
const runtimeOnly = runtimeServiceKeys.filter((k) => !catalogServices.includes(k))

const rows = readPatchRowIds(readFileSync(basePatchPath, 'utf8'))
// preflight 能"看见"的 peer 名 = 安装的直接 dependencies ∪ devDependencies。
// 只有这些名字能在宿主侧解析到 manifest，从而被 version 判决；其余 peer 名宿主
// manifestOf 解析不到 ⇒ 保持"无意见"（compatibility-preflight.ts:43,48-49,103-104）。
const evaluatedPeers = [...new Set([
  ...Object.keys(dshPkg.dependencies ?? {}),
  ...Object.keys(dshPkg.devDependencies ?? {}),
])].sort()

const data = {
  generatedBy: 'scripts/refresh-host-surface.mjs',
  generatedAt: new Date().toISOString().slice(0, 10),
  baseline: {
    dshInstall: dsh.replace(/\\/g, '/'),
    dshVersion: dshPkg.version,
    dshBaseVersion: basePkg.version,
    appBootVersion: (() => {
      try { return JSON.parse(readFileSync(path.join(nested, 'dsh-app-boot', 'package.json'), 'utf8')).version } catch { return null }
    })(),
  },
  counts: {
    catalogServices: catalogServices.length,
    runtimeServices: runtimeServiceKeys.length,
    inheritedCtx: inherited.size,
    events: events.length,
    harnessWaterfall: harnessWaterfall.length,
    frameworkWaterfall: frameworkWaterfall.length,
    builtinRows: rows.length,
    evaluatedPeers: evaluatedPeers.length,
  },
  /** 宿主 `ctx.<key>` 的 harness 服务键（api-catalog 生成物；权威、有渲染文档对拍） */
  services: catalogServices,
  /** 运行时 `new Service(ctx,'x')`/`ctx.provide('x')` 抓到的全部键（含客户端半区，宽于 catalog） */
  runtimeServices: runtimeServiceKeys,
  /** 只在 api-catalog 里、没抓到运行时构造点的键（生成脚本分区与运行时形态的差异） */
  catalogOnlyServices: catalogOnly,
  /** 只在运行时抓到、不在 api-catalog 里的键（客户端半区等；按 profile 才存在） */
  runtimeOnlyServices: runtimeOnly,
  /**
   * 有**真凭实据**的提供方记录：仅限"运行时构造点抓到了、但不在 api-catalog 里"的键。
   * 用途 = 分类"查不到的 inject 名"：
   *   在此表里 ⇒ 曾经真的有人 provide 它，现在没了 ⇒ 可以判 fail（如 0.2 线移除的 invariants）；
   *   不在此表里 ⇒ 只是"我们查不到" ⇒ 只能 warn（避免把 `session` 这类键判成假红）。
   * 特意**不**收录 catalogOnly 键：那些键的提供方本来就在 catalog 里，不需要这层兜底，
   * 收了反而会把"从没被 provide 过"的名字错判成"曾经存在过"。
   */
  recordedProviders: Object.fromEntries(runtimeOnly.map((k) => [k, [...runtimeServices[k]].sort()])),
  /** 每个运行时服务键的提供包（仅供报告与诊断展示，不承担 fail/warn 判定） */
  runtimeServiceProviders: Object.fromEntries(Object.entries(runtimeServices).map(([k, v]) => [k, [...v].sort()])),
  /** cordis 框架自带的 ctx 成员（访问无需 inject） */
  inheritedCtx: [...inherited].sort(),
  /** 全部宿主事件名（含 mode） */
  events,
  /** harness 侧顺序敏感事件：监听器必须委托 next()，否则静默吞掉下游 */
  waterfallEvents: harnessWaterfall,
  /** 框架侧顺序敏感事件（不在 api-catalog 里，来自 cordis/loader 自身） */
  frameworkWaterfallEvents: frameworkWaterfall,
  /** dsh-base 自带的行 id：patch 覆写这些 id 是"整段替换"语义，跨插件会互抹 */
  builtinPatchRowIds: rows,
  /** 会被宿主 preflight 做版本判决的 peer 名（其余名字宿主"无意见"） */
  evaluatedPeerNames: evaluatedPeers,
}

const banner = `// 由 scripts/refresh-host-surface.mjs 生成 —— 请勿手改。
// 基线: dsh ${data.baseline.dshVersion} / dsh-base ${data.baseline.dshBaseVersion}（生成于 ${data.generatedAt}）
// 再生成: node scripts/refresh-host-surface.mjs --dsh <dsh 安装目录>
// 新鲜度门禁: node scripts/refresh-host-surface.mjs --check
//
// 数据来源（全部离线可读，不需要 harness checkout、不需要联网）：
//   dsh-tool-cordis/lib/types/api-catalog.js  —— 官方生成物，头注释自述与 docs/cordis-catalog
//                                                 "cannot diverge"
//   dsh-base/cordis.patch.yml                 —— 宿主自带行 id
//   dsh/package.json                          —— 会被 preflight 判决的 peer 名
`

const body = banner + '\n' + 'export default ' + JSON.stringify(data, null, 2) + '\n'

if (CHECK_ONLY) {
  if (!existsSync(OUT)) { console.error(`快照不存在: ${OUT}`); process.exit(1) }
  const current = readFileSync(OUT, 'utf8')
  // 只比较数据部分，忽略环境相关字段。
  //
  // `generatedAt` 出现在两处：JSON 数据里，以及 banner 注释的「生成于 …」里。
  // 早先只剥了 JSON 那一处，于是 banner 的日期仍然参与比较 —— 门禁在生成当天之
  // 外的任何一天都会报「已过期」，而宿主面其实一个字节都没变（2026-10-10 实测：
  // 重新生成后全文 1400 行只有这 4 行日期不同）。两处都要剥，门禁才是在判断
  // 「宿主面变没变」而不是「今天是不是生成那天」。
  const strip = (s) => s
    .replace(/"generatedAt":\s*"[^"]*"/g, '')
    .replace(/"dshInstall":\s*"[^"]*"/g, '')
    .replace(/（生成于 [^）]*）/g, '')
  if (strip(current) !== strip(body)) {
    console.error('宿主面快照已过期：请运行 node scripts/refresh-host-surface.mjs')
    process.exit(1)
  }
  console.log(`宿主面快照是最新的（dsh ${data.baseline.dshVersion} / dsh-base ${data.baseline.dshBaseVersion}）`)
  process.exit(0)
}

writeFileSync(OUT, body, 'utf8')
console.log(`已写出 ${OUT}`)
console.log(JSON.stringify(data.counts, null, 2))
console.log(`基线: dsh ${data.baseline.dshVersion}  dsh-base ${data.baseline.dshBaseVersion}  app-boot ${data.baseline.appBootVersion}`)
