// 清单路径解析：**全组共用一处**，避免每个检查各写一份近似实现然后互相矛盾。
//
// 红队（A16）实测出的三类假红都源于"每个检查各自解析 package.json 路径"：
//   · R1 只认 `typeof patch === 'string'` ⇒ 官方的**数组形态**被判 critical fail，
//     并连锁派生 R2/R3/R7 三条假红（一次 4 条）。
//   · R2/R4 的 `normalizeEntry` 写的是 `main ?? exports…`，而 **Node 恰好相反**：
//     有 `exports` 时 `main` 被忽略。且它不认识 `exports: {".": "./x.js"}`（字符串形态）
//     与 `exports: {".": {import, require, default}}`（条件形态），会回落到字面量 `index.js`。
//   · `unbuiltTree()` 只在入口落在 `lib/dist/…` 时才降级 ⇒ `main: "index.js"` + tsc
//     构建的仓会被判"入口不存在"。
//
// 本模块只做**解析**，不做判定；判定留在各检查里，但必须用这里的同一个结果。

import { existsSync, statSync } from 'node:fs'
import path from 'node:path'

const stripDot = (p) => String(p ?? '').replace(/^\.\//, '')

/** 构建产物目录（本生态的约定；只用于"未构建源码树"这类环境降级的识别）。 */
export const BUILD_DIRS = ['lib', 'dist', 'build', 'out', 'esm', 'cjs']

/**
 * `dsh.bundle.patch` 归一化为**非空字符串**数组。
 *
 * 官方契约（`dsh-app-boot` 的 `bundlePatchFiles`）：
 *   `const declared = typeof bundle.patch === 'string' ? [bundle.patch] : bundle.patch`
 *   即 `string | string[]`；其它形态抛
 *   `dsh.bundle.patch must be a file path or a list of file paths`。
 *
 * 空串不是"一个叫空名字的文件"：它经 `path.resolve(dir, '')` 会得到**目录本身**，
 * 于是 `existsSync` 为真、`readFileSync` 抛 EISDIR（红队实测 → doctor-internal ERROR）。
 * 因此 trim 后为空 ⇒ 整体视为**声明缺失**。
 *
 * @param {unknown} patch
 * @returns {string[]|null} null = 未声明 / 形态非法 / 含空项
 */
export function bundlePatchPaths(patch) {
  const raw = typeof patch === 'string' ? [patch] : patch
  if (!Array.isArray(raw) || raw.length === 0) return null
  const list = raw.map((p) => (typeof p === 'string' ? p.trim() : null))
  if (list.some((p) => !p)) return null
  return list
}

/** 目标存在且是普通文件。`existsSync` 对目录也为真，不能当 isFile 用。 */
export function isFile(p) {
  try { return statSync(p).isFile() } catch { return false }
}

/**
 * 把 `exports` 的一个子路径目标解析成相对文件路径。
 * 支持：字符串 / `{import, require, default, node, types, browser}` / 嵌套条件 / 数组（取首个可用）。
 * @param {unknown} target
 * @returns {string|null}
 */
function resolveExportTarget(target) {
  if (typeof target === 'string') return stripDot(target)
  if (Array.isArray(target)) {
    for (const t of target) {
      const r = resolveExportTarget(t)
      if (r) return r
    }
    return null
  }
  if (target && typeof target === 'object') {
    // 条件顺序按 Node 的推荐次序近似；`types` 不是运行时入口，放最后
    for (const key of ['import', 'module', 'node', 'default', 'require', 'browser', 'types']) {
      if (key in target) {
        const r = resolveExportTarget(target[key])
        if (r) return r
      }
    }
    // 未知条件键：取第一个能解析出字符串的
    for (const v of Object.values(target)) {
      const r = resolveExportTarget(v)
      if (r) return r
    }
  }
  return null
}

/**
 * 解析包入口 —— **与 Node 的优先级一致**：有 `exports` 时 `main` 被忽略。
 *
 * 覆盖形态（红队 fixture 实测过的都在内）：
 *   exports: "./index.js"                        字符串
 *   exports: { ".": "./index.js" }               子路径字符串
 *   exports: { ".": { import: "./x.js" } }       条件
 *   exports: { ".": { default: "./x.js" } }      条件 default
 *   main: "./lib/index.js"                       无 exports 时的回落
 *   都没有                                          "index.js"
 *
 * @param {object} pkg
 * @returns {{entry:string, source:'exports'|'exports-conditions'|'main'|'default', exportsBlocked:boolean}}
 *   `exportsBlocked` = 声明了 `exports` 但解析不出 `"."`（则包**不可作为入口导入**，
 *   是硬缺陷，不是"回落到 main"）。
 */
export function resolveEntry(pkg) {
  const ex = pkg?.exports
  if (ex !== undefined && ex !== null) {
    if (typeof ex === 'string') return { entry: stripDot(ex), source: 'exports', exportsBlocked: false }
    if (typeof ex === 'object' && !Array.isArray(ex)) {
      const keys = Object.keys(ex)
      // 子路径形态：只有 "." 是包入口
      if (keys.some((k) => k === '.' || k.startsWith('./'))) {
        const dot = ex['.']
        if (dot === undefined) return { entry: null, source: 'exports', exportsBlocked: true }
        const r = resolveExportTarget(dot)
        if (!r) return { entry: null, source: 'exports', exportsBlocked: true }
        return { entry: r, source: 'exports', exportsBlocked: false }
      }
      // 纯条件形态（没有 "." 也没有 "./x"）：整个对象就是一个条件表
      const r = resolveExportTarget(ex)
      if (r) return { entry: r, source: 'exports-conditions', exportsBlocked: false }
      return { entry: null, source: 'exports', exportsBlocked: true }
    }
  }
  if (typeof pkg?.main === 'string' && pkg.main.trim()) return { entry: stripDot(pkg.main), source: 'main', exportsBlocked: false }
  return { entry: 'index.js', source: 'default', exportsBlocked: false }
}

/** 兼容旧调用点：只要入口路径字符串。 */
export function normalizeEntry(pkg) {
  return resolveEntry(pkg).entry ?? ''
}

/** 包的"根目录"入口是否落在构建产物目录里（用于未构建源码树的识别）。 */
export function entryIsBuildOutput(entry) {
  if (!entry) return false
  const top = stripDot(entry).split('/')[0]
  return BUILD_DIRS.includes(top)
}

/**
 * 未构建源码树的统一判据（环境事实，不是插件缺陷）。
 *
 * 两条约束必须同时满足，缺一不可 —— 它们各自堵住一类错误：
 *
 * ① **`files` 必须已声明并覆盖入口**。若声明了 `files` 却没覆盖入口，那是**包装缺陷**
 *    （发布出去也没有这个文件），构建与否都救不了 ⇒ 仍然 fail。
 *    这条是 SPEC 冻结契约的一部分（contract.mjs 有一条 "files 未覆盖产物 → R2 不伪装成
 *    environment" 在守它），不能为了少报红而放宽。
 *
 * ② **入口必须确实像一个构建产物**：本身是 .ts，或能在 TS 源码里找到同名文件，
 *    或落在约定的构建目录里（lib/dist/...）。只看目录名会漏掉 `main: "index.js"`
 *    + tsc 这种形态（红队 A16 实测的假红）；只看"有 build 脚本"又会把
 *    "入口写错、根本没有这个文件"的真缺陷说成未构建。
 *
 * @param {{repoPath:string, pkg:object, entry:string|null, tsSources?:string[], buildCmd?:string}} input
 * @returns {string|null} 非 null = 降级理由
 */
export function unbuiltReason({ repoPath, pkg, entry, tsSources, buildCmd }) {
  if (!entry) return null
  const abs = path.resolve(repoPath, entry)
  if (isFile(abs)) return null
  // ① 包装声明必须是对的，否则是缺陷而非环境
  const filesField = pkg?.files
  if (!Array.isArray(filesField) || !filesField.length) return null
  if (!filesCovers(filesField, entry)) return null
  // ② 入口必须确实像构建产物
  const ts = tsSources ?? []
  const entryIsTs = /\.(ts|mts|cts|tsx)$/.test(entry)
  const base = path.basename(entry).replace(/\.(mjs|cjs|js)$/, '')
  const sameNameSource = ts.some((f) => path.basename(f).replace(/\.(ts|mts|cts|tsx)$/, '') === base)
  if (!entryIsTs && !sameNameSource && !entryIsBuildOutput(entry)) return null
  // 还要有"本包确实会构建"的证据，否则更可能是入口写错了
  const build = String(buildCmd ?? pkg?.scripts?.build ?? '').trim()
  if (!build && !ts.length && !entryIsTs) return null
  return `入口 ${entry} 不存在，且它是构建产物（files 已声明并覆盖它）—— 未构建的源码树，非插件缺陷。`
    + '先 `npm run build`（或 pnpm）后重跑；本项读构建产物，故不计 pass、不计缺陷。'
}

/** 校验 `files[]` 是否覆盖某路径（支持目录前缀与简单 glob）。 */
export function filesCovers(filesField, target) {
  if (!Array.isArray(filesField) || !filesField.length) return false
  const t = stripDot(target)
  return filesField.some((item) => {
    const raw = String(item).replace(/\/$/, '')
    if (raw === t) return true
    if (t.startsWith(`${raw}/`)) return true
    // `files` 支持 glob（`lib/types/**/*.d.ts`、`README*.md`、`locale/*.json`）
    if (raw.includes('*')) {
      const re = new RegExp(`^${raw.split('*').map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('[^/]*')}$`)
      if (re.test(t)) return true
    }
    return false
  })
}

export { stripDot }
