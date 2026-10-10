// 宿主真实面（host surface）：把"宿主到底提供哪些 service / 事件 / 内置行 / 会判决哪些 peer"
// 从**可执行真相源**取出来，而不再手抄常量表。
//
// 背景（实测 2026-10-07，宿主 0.2.1-alpha.1）：doctor 原先手抄的四张表全部与宿主不一致 ——
//   KNOWN_SEAMS 22 vs 91（api-catalog）/ 121（运行时构造点）
//   BUILTIN_PATCH_ROWS 31 vs 94（dsh-base/cordis.patch.yml）
//   WATERFALL_EVENTS 17 vs 17（harness）+ 1（框架 loader/patch-context）
//   RESERVED_TOOL_NAMES 与宿主工具面不符（且宿主工具集随 profile 变化，本来就不可固化）
// 手抄表必然漂移、且漂移是静默的：对正确插件报假警、对错误插件放行。本模块消灭手抄。
//
// 两个数据源，显式区分（混用会假阴性）：
//   ① 快照（lib/host-surface.data.mjs，随包发布，离线可用）
//      = 由 scripts/refresh-host-surface.mjs 从某份真实安装生成，带基线版本戳
//   ② 实时（--dsh-install 指向的安装目录，或环境变量 DSH_INSTALL_DIR）
//      = 直接读 dsh/package.json 的版本 + dsh-base/cordis.patch.yml + api-catalog.js
//
// 契约：
//   - 快照基线 ≠ 目标宿主版本时，**不得**拿旧表硬判：调用方应走 skip + category=unsupported-host。
//   - `resolution` 字段如实说明本次用的是实时还是快照，供报告自证。

import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import snapshot from './host-surface.data.mjs'

/** @typedef {{services:Set<string>, events:Set<string>, waterfall:Set<string>, builtinRows:Set<string>, evaluatedPeers:Set<string>, inheritedCtx:Set<string>, source:'live'|'snapshot', baseline:string|null, resolvedFrom:string|null, providers:Record<string,string[]>}} HostSurface */

/**
 * 找一个可用的 dsh 安装目录。顺序：显式参数 → `DSH_INSTALL_DIR` →
 * 从 doctor 自身向上找 `node_modules/@deepseek-ai/dsh`（本工具常被装进 profile，
 * 那时宿主就在隔壁）→ 全局 npm 前缀。
 * @param {string|null} explicit
 * @returns {string|null}
 */
export function locateDshInstall(explicit = null) {
  const candidates = []
  if (explicit) candidates.push(explicit)
  if (process.env.DSH_INSTALL_DIR) candidates.push(process.env.DSH_INSTALL_DIR)
  // 从本文件向上找（最多 6 层）
  let dir = import.meta.dirname
  for (let i = 0; i < 6 && dir; i++) {
    candidates.push(path.join(dir, 'node_modules', '@deepseek-ai', 'dsh'))
    const parent = path.dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  const home = process.env.HOME || process.env.USERPROFILE
  if (process.env.APPDATA) candidates.push(path.join(process.env.APPDATA, 'npm', 'node_modules', '@deepseek-ai', 'dsh'))
  if (home) {
    candidates.push(path.join(home, '.npm-global', 'lib', 'node_modules', '@deepseek-ai', 'dsh'))
    candidates.push(path.join(home, '.local', 'share', 'pnpm', 'global', '5', 'node_modules', '@deepseek-ai', 'dsh'))
  }
  candidates.push('/usr/local/lib/node_modules/@deepseek-ai/dsh', '/usr/lib/node_modules/@deepseek-ai/dsh')
  for (const c of candidates) {
    if (c && existsSync(path.join(c, 'package.json'))) return path.resolve(c)
  }
  return null
}

function readRowIds(text) {
  const ids = new Set()
  for (const raw of String(text).replace(/#.*$/gm, '').split(/\r?\n/)) {
    const m = /^\s*-?\s*id:\s*["']?([A-Za-z0-9_.:@/-]+)["']?\s*$/.exec(raw.trim())
    if (m) ids.add(m[1])
  }
  return ids
}

/**
 * 尽力读**实时**宿主面。任何一步失败都返回 null（调用方回退到快照）。
 * @param {string|null} dshInstall
 */
async function readLive(dshInstall) {
  if (!dshInstall) return null
  const nested = path.join(dshInstall, 'node_modules', '@deepseek-ai')
  const catalogPath = path.join(nested, 'dsh-tool-cordis', 'lib', 'types', 'api-catalog.js')
  const basePatchPath = path.join(nested, 'dsh-base', 'cordis.patch.yml')
  let dshPkg
  try { dshPkg = JSON.parse(readFileSync(path.join(dshInstall, 'package.json'), 'utf8')) } catch { return null }
  const services = new Set()
  const events = new Set()
  const waterfall = new Set()
  const inheritedCtx = new Set()
  if (existsSync(catalogPath)) {
    try {
      const cat = await import(pathToFileURL(catalogPath).href)
      for (const s of cat.SERVICE_API ?? []) services.add(s.key)
      for (const e of cat.EVENT_API ?? []) {
        events.add(e.name)
        if (e.mode === 'waterfall') waterfall.add(e.name)
      }
      for (const g of cat.INHERITED_CTX_API ?? []) {
        for (const m of String(g.name).matchAll(/ctx\.([A-Za-z_$][\w$]*)/g)) inheritedCtx.add(m[1])
      }
    } catch { /* 目录存在但不可 import ⇒ 当作没有 catalog */ }
  }
  for (const extra of ['deps', 'name', 'filter', 'select', 'events']) inheritedCtx.add(extra)
  // 框架侧事件（api-catalog 不含）
  events.add('loader/patch-context')
  waterfall.add('loader/patch-context')
  const builtinRows = existsSync(basePatchPath) ? readRowIds(readFileSync(basePatchPath, 'utf8')) : new Set()
  const evaluatedPeers = new Set([
    ...Object.keys(dshPkg.dependencies ?? {}),
    ...Object.keys(dshPkg.devDependencies ?? {}),
  ])
  if (!services.size && !builtinRows.size) return null
  // `providerEvidence` 必须也带上：api-catalog 只覆盖 harness 面，客户端半区的键
  // （locale / slots / commandUi / configForms …）由 dsh-client-* 包 provide，不进 catalog。
  // 这份"曾经真的有人 provide"的记录来自随包发布的快照（由 refresh 脚本从一份真实安装抓取），
  // 只用来区分"能证明已经没了"（fail）与"只是我们查不到"（warn）——
  // 不带上它，X4 就会把 12 个家族仓正确的 inject 判成"没有任何提供方"。
  const evidence = snapshot.recordedProviders ?? {}
  for (const k of Object.keys(evidence)) services.add(k)
  return {
    services, events, waterfall, builtinRows, evaluatedPeers, inheritedCtx,
    source: 'live',
    baseline: dshPkg.version ?? null,
    resolvedFrom: dshInstall,
    providerEvidence: evidence,
    providers: snapshot.runtimeServiceProviders ?? {},
  }
}

/** 快照形态的宿主面（离线可用；带基线版本戳，调用方须自行核对新鲜度）。 */
function fromSnapshot() {
  const d = snapshot
  return {
    services: new Set(d.services ?? []),
    events: new Set((d.events ?? []).map((e) => (typeof e === 'string' ? e : e.name))),
    waterfall: new Set([...(d.waterfallEvents ?? []), ...(d.frameworkWaterfallEvents ?? [])]),
    builtinRows: new Set(d.builtinPatchRowIds ?? []),
    evaluatedPeers: new Set(d.evaluatedPeerNames ?? []),
    inheritedCtx: new Set(d.inheritedCtx ?? []),
    source: 'snapshot',
    baseline: d.baseline?.dshVersion ?? null,
    resolvedFrom: null,
    providerEvidence: d.recordedProviders ?? {},
    providers: d.runtimeServiceProviders ?? {},
  }
}

let cached = null
/**
 * 解析宿主面。优先实时，失败回退快照（快照一定可用，因为随包发布）。
 * @param {{dshInstall?: string|null, preferLive?: boolean}} [opts]
 * @returns {Promise<HostSurface>}
 */
export async function resolveHostSurface(opts = {}) {
  const { preferLive = true, dshInstall = null } = opts
  if (cached && cached.key === `${preferLive}|${dshInstall ?? ''}`) return cached.value
  let value = null
  if (preferLive) {
    value = await readLive(locateDshInstall(dshInstall))
  }
  if (!value) value = fromSnapshot()
  cached = { key: `${preferLive}|${dshInstall ?? ''}`, value }
  return value
}

/**
 * 最强的判决路径：直接 import 宿主自己的 `@deepseek-ai/dsh-app-boot`，
 * 用它的 `getDshRuntimeVersion` / `evaluatePluginCompatibility` / `pluginCompatibilityWarning`
 * 来做 peer 判决 —— **零复刻风险**：结论与宿主逐字节同源，不存在"自研 semver 算错"的可能。
 *
 * 拿不到就返回 null，调用方回退到 semver-lite 复刻（那条路已与 node-semver 对拍 1280 例零差异，
 * 但复刻永远是复刻）。两条路都在报告里如实标注来源。
 *
 * @param {string|null} dshInstall
 * @returns {Promise<null|{
 *   runtimeVersion: string,
 *   judge: (manifest: object) => {compatible: boolean, warning: string|null, peers: Record<string,string>, malformed: string|null},
 *   modulePath: string,
 * }>}
 */
export async function loadHostEvaluator(dshInstall = null) {
  const install = locateDshInstall(dshInstall)
  if (!install) return null
  const candidates = [
    path.join(install, 'node_modules', '@deepseek-ai', 'dsh-app-boot', 'lib', 'index.js'),
    // app-boot 可能被提升到 dsh 安装的上一级
    path.join(path.dirname(install), 'dsh-app-boot', 'lib', 'index.js'),
  ]
  for (const mod of candidates) {
    if (!existsSync(mod)) continue
    try {
      const m = await import(pathToFileURL(mod).href)
      if (typeof m.evaluatePluginCompatibility !== 'function') continue
      const runtimeVersion = typeof m.getDshRuntimeVersion === 'function'
        ? m.getDshRuntimeVersion()
        : JSON.parse(readFileSync(path.join(path.dirname(path.dirname(mod)), 'package.json'), 'utf8')).version
      return {
        runtimeVersion,
        modulePath: mod,
        judge(manifest) {
          try {
            const issue = m.evaluatePluginCompatibility(manifest, {}, runtimeVersion)
            if (issue === undefined) return { compatible: true, warning: null, peers: {}, malformed: null }
            if (issue.exempted) return { compatible: true, warning: null, peers: issue.peers, malformed: null }
            const warning = typeof m.pluginCompatibilityWarning === 'function'
              ? m.pluginCompatibilityWarning(issue)
              : `Plugin ${issue.name}@${issue.version} is incompatible with dsh ${issue.runtimeVersion}`
            return { compatible: false, warning, peers: issue.peers, malformed: null }
          } catch (err) {
            // 宿主自身在 peer 元数据畸形时也会抛：preflight 把这个抛错翻成
            // "its declared peer dependencies cannot be validated" 并禁用该行。
            return { compatible: false, warning: null, peers: {}, malformed: String(err?.message ?? err) }
          }
        },
      }
    } catch { /* try next candidate */ }
  }
  return null
}

/** 供 --json 与报告使用的、可序列化的宿主面摘要（不含巨大的 Set）。 */
export function hostSurfaceSummary(surface) {
  return {
    source: surface.source,
    baseline: surface.baseline,
    resolvedFrom: surface.resolvedFrom ? '<path>' : null,
    services: surface.services.size,
    events: surface.events.size,
    waterfall: surface.waterfall.size,
    builtinRows: surface.builtinRows.size,
    evaluatedPeers: surface.evaluatedPeers.size,
  }
}

/** 快照自带 vs 实时：基线是否一致（用于"旧表不得硬判"的守卫）。 */
export function baselineMatches(surface, version) {
  if (!version || !surface?.baseline) return null
  return String(surface.baseline) === String(version)
}

export { snapshot as hostSurfaceSnapshot }
