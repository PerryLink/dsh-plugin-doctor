// 工作区定位：把 `workspaceRoot` 从"插件自己装在哪"改成"被检仓实际属于哪个工作区"。
//
// 为什么需要这一层（缺陷实测，2026-10-13）：
//   `plugin.mjs` 旧实现写死 `workspaceRoot: path.resolve(import.meta.dirname, '..')`。
//   该式只在"doctor 位于工作区 `<ws>/dsh-plugin-doctor/`"时成立。一旦按
//   `dsh plugin --profile web add @perrylink/dsh-plugin-doctor` 装进 profile
//   （`dsh-kit/plugins.txt` 的 spec 就是 `@perrylink/dsh-plugin-doctor`），
//   `import.meta.dirname` 变成
//     `<profile>/node_modules/@perrylink/dsh-plugin-doctor`
//   ⇒ `workspaceRoot` = `<profile>/node_modules/@perrylink`（npm 平铺布局）
//     或 `<profile>/node_modules`（pnpm 真路径 `.../.pnpm/<pkg>/node_modules/@perrylink/...`），
//   两者都**不是**工作区。后果不是"少跑一项"，而是**假陈述 + 假红**：
//     · CC1/CC2/CC3 对真实存在的认证仓/adp-list/dsh-catalog 报
//       "本地不存在（--workspace 外运行无法核对）" —— 而调用方从未给过 --workspace，
//       也没人告诉它真正的 ws 在哪，用户读到的是"这台机器上没有那些仓"；
//     · K14 永远 `skip('工作区 … 内未发现第二个 DSH 插件仓')`；
//     · X2 的 `siblingProvided` 认账集为空 ⇒ 家族内正当的跨仓 inject 被报 unknown。
//
// 契约：本模块只**定位**，不判定。找不到就返回 null，由调用方决定回落到哪里，
// 绝不编造一个像工作区的路径。

import path from 'node:path'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'

/**
 * 目录是否是"系统临时区"（本机 `%TEMP%` / `tmpdir()`）。
 *
 * 为什么必须排除（实测 2026-10-13，本机）：`%TEMP%` 下有 20+ 个以 `dsh-` 开头的
 * 真实测试工作目录（`dsh-install-020`、`dsh-market`、`dsh-install-check`…），每个都有
 * `package.json`，其中一些还带 `@deepseek-ai/dsh*` peer。于是"向上找含 ≥2 个插件仓的
 * 目录"这一条在**任意**仓上都会命中 `%TEMP%`：工作区被定位到临时区，K14 去跟一堆
 * 一次性测试目录比 inject 重名，X2 的兄弟认账集被这些目录填满 ⇒ 真正的跨仓冲突被掩盖。
 * 临时区永远不是工作区，排除它是语义正确的，不是特判。
 * @param {string} dir
 * @returns {boolean}
 */
export function isTempDir(dir) {
  const abs = path.resolve(dir).toLowerCase()
  const tmp = path.resolve(tmpdir()).toLowerCase()
  if (abs === tmp) return true
  const env = process.env
  for (const key of ['TEMP', 'TMP', 'TMPDIR']) {
    const v = env[key]
    if (v && abs === path.resolve(v).toLowerCase()) return true
  }
  return false
}

/**
 * 一层目录里像"DSH 插件仓"的子目录。
 * 判据与 `checks-cordis.mjs` 的 `discoverSiblings` 同源：有 `package.json`，
 * 且声明了 `dsh` 清单字段或任一 `@deepseek-ai/dsh*` peer。
 * @param {string} dir
 * @returns {string[]} 子目录绝对路径
 */
export function pluginRepoDirs(dir) {
  let entries
  try { entries = readdirSync(dir, { withFileTypes: true }) } catch { return [] }
  const found = []
  for (const e of entries) {
    if (!e.isDirectory() || e.name.startsWith('.') || e.name === 'node_modules') continue
    if (!e.name.startsWith('dsh-')) continue
    const sub = path.join(dir, e.name)
    let pkg
    try { pkg = JSON.parse(readFileSync(path.join(sub, 'package.json'), 'utf8')) } catch { continue }
    const isPlugin = pkg.dsh !== undefined
      || Object.keys(pkg.peerDependencies ?? {}).some((n) => n === '@deepseek-ai/dsh' || n.startsWith('@deepseek-ai/dsh-'))
    if (isPlugin) found.push(sub)
  }
  return found
}

/**
 * 从被检仓向上找一个"装着 ≥2 个 DSH 插件仓"的目录当工作区。
 *
 * 为什么要求 ≥2：K14 与 X2 的兄弟认账都以"还存在别的插件仓"为前提，只有本仓
 * 的目录（例如某个孤立的 checkout）不构成工作区，把它当 ws 会让 K14 拿
 * `siblings.length < 2` 的 skip，等于换了个理由的假陈述。
 *
 * @param {string} repoPath 被检仓绝对路径
 * @param {{ maxDepth?: number }} [opts]
 * @returns {string|null} 工作区绝对路径，找不到为 null
 */
export function workspaceOfRepo(repoPath, { maxDepth = 4 } = {}) {
  let dir = path.resolve(repoPath)
  const base = path.parse(dir).root
  for (let i = 0; i <= maxDepth; i++) {
    const parent = path.dirname(dir)
    if (parent === dir || parent === base) return null
    dir = parent
    // 系统临时区永不作为工作区（见 isTempDir 的实测理由）。
    if (isTempDir(dir)) return null
    if (pluginRepoDirs(dir).length >= 2) return dir
  }
  return null
}

/**
 * 候选工作区里"真的像工作区"的那个（≥1 个插件仓即可，用于校验显式传入/环境变量/安装相对候选）。
 * @param {string|null|undefined} dir
 * @returns {string|null}
 */
export function asWorkspace(dir) {
  if (!dir) return null
  const abs = path.resolve(String(dir))
  if (!existsSync(abs)) return null
  if (isTempDir(abs)) return null
  return pluginRepoDirs(abs).length >= 1 ? abs : null
}

/**
 * 本次运行该用哪个目录当"家族工作区"。
 *
 * 旧实现（`plugin.mjs`）是 `path.resolve(import.meta.dirname, '..')` —— 只在 doctor
 * 位于 `<ws>/dsh-plugin-doctor/` 时成立。装进 profile 后（`dsh-kit/plugins.txt` 的 spec
 * 就是 `@perrylink/dsh-plugin-doctor`）它是 `<profile>/node_modules/@perrylink`
 * （npm 平铺）或 `<profile>/node_modules`（pnpm 真路径），**都不是工作区**。
 *
 * 解析顺序（每一步都必须**验证过**才采用，绝不编造一个像工作区的路径）：
 *   1. 显式参数
 *   2. `DSH_WORKSPACE` 环境变量
 *   3. 从被检仓向上找（{@link workspaceOfRepo}）—— 最可靠：被检仓自己就在工作区里
 *   4. 安装相对根（旧行为），但仅当它真的含插件仓时才用
 *
 * @param {string} repoPath 被检仓绝对路径
 * @param {{ workspace?: string|null, installDir?: string|null, env?: Record<string, string|undefined> }} [opts]
 *   `installDir` = 本次运行的 doctor 包目录（决定"安装相对根"），默认由调用方给出。
 * @returns {{ root: string|null, source: string|null }}
 */
export function resolveWorkspaceRoot(repoPath, { workspace = null, installDir = null, env = process.env } = {}) {
  const explicit = asWorkspace(workspace)
  if (explicit) return { root: explicit, source: 'argument' }
  const fromEnv = asWorkspace(env.DSH_WORKSPACE)
  if (fromEnv) return { root: fromEnv, source: 'env:DSH_WORKSPACE' }
  const fromRepo = workspaceOfRepo(repoPath)
  if (fromRepo) return { root: fromRepo, source: 'repo-ancestor' }
  const installRelative = installDir ? asWorkspace(path.resolve(installDir, '..')) : null
  if (installRelative) return { root: installRelative, source: 'install-relative' }
  return { root: null, source: null }
}
