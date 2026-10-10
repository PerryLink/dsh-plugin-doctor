// 已被宿主移除的 seam / 包名 —— 只收录**有官方出处**的条目。
//
// 为什么需要这份表：X4 的判定准则是"要能**证明**某个 inject 名没有提供方"，而不是
// "我们查不到"。判 fail 需要证据链，证据只能来自官方明示的破坏性变更；靠推断判 fail
// 就会制造假红（红队 A16 实测：`session` / `config` 这类查不到的名字仍在被正确使用）。
//
// 每一条都必须能指向一处官方文本，写清"哪一版移除的"。newer 条目 = 更值得 fail：
// 用户装到的宿主越新，被移除的 seam 越必然不存在。
//
// 数据源（全部在 harness checkout 里，可离线核对）：
//   docs/upgrade-guide/<版本>/<kebab-item>/guide.md
//   —— 机器可校验：frontmatter 恰好 {description, kind}，kind: upgrade-guide，
//      标题为一个 `#` + 恰好 `## Change` / `## Migration`，英文 ≤500 词
//      （门在 scripts/verify-upgrade-guides.ts）。
//   现有批次：v0.1.7-rc.2（2 篇）、v0.2.0-rc.2（4 篇）。该目录**没有覆盖第三方插件
//   代码面的全部破坏性变更**，所以本表只收"官方明说了的"，不收推断的。
//
// 刷新方式：读 docs/upgrade-guide/*/*/guide.md，抽 `## Change` 里的
// `@deepseek-ai/<pkg>`、`ctx.<service>`、`<package>/<subpath>` 三类名字。

/**
 * @typedef {{name:string, kind:'service'|'package'|'subpath', removedIn:string, replacement:string|null, source:string, note:string}} RemovedSeam
 */

/** @type {RemovedSeam[]} */
export const REMOVED_SEAMS = [
  {
    name: 'invariants',
    kind: 'service',
    removedIn: '0.2.0-rc.2',
    replacement: null,
    source: 'docs/upgrade-guide/v0.2.0-rc.2/remove-runtime-invariants/guide.md',
    note: '运行时不变量注册表整套移除：`@deepseek-ai/dsh-invariants`、`InvariantRegistry`、'
      + '`InvariantInstaller`、`InvariantFailure`、`InvariantError`、以及任何 `<package>/invariant` 子路径都不再发布；'
      + '`sdk-minimal` 里的五行（`invariants`/`session-invariant`/`agent-invariant`/`scope-invariant`/`agent-loop-invariant`）也一并移除。'
      + '`cordis.yml`/patch/overlay 点名即加载失败，TS import 即编译失败。'
      + '官方迁移：删掉这些行与 import；四个发射器改为**吞并记录** `code:\'INVARIANT\'` 而不再重抛，'
      + '所以依赖"重抛的 INVARIANT 失败"的插件必须改用自己的上报通道。',
  },
]

/** 按名字索引，便于 O(1) 查。 */
export const REMOVED_SEAM_BY_NAME = new Map(REMOVED_SEAMS.map((r) => [r.name, r]))

/** 包级移除（与 seam 分开，因为用途不同：一个是 inject 名，一个是 import 说明符）。 */
export const REMOVED_PACKAGES = [
  {
    name: '@deepseek-ai/dsh-invariants',
    removedIn: '0.2.0-rc.2',
    source: 'docs/upgrade-guide/v0.2.0-rc.2/remove-runtime-invariants/guide.md',
    note: '整个包停止发布。import 它会 ERR_MODULE_NOT_FOUND；patch 行 name 指向它会加载失败。',
  },
]

export const REMOVED_PACKAGE_BY_NAME = new Map(REMOVED_PACKAGES.map((r) => [r.name, r]))

/**
 * 子路径移除：`<package>/invariant` 这类伴生插件子路径整体消失。
 * 判定用后缀匹配（因为前缀是任意包名）。
 */
export const REMOVED_SUBPATH_SUFFIXES = [
  {
    suffix: '/invariant',
    removedIn: '0.2.0-rc.2',
    source: 'docs/upgrade-guide/v0.2.0-rc.2/remove-runtime-invariants/guide.md',
    note: '各包发布的 `./invariant` 伴生插件子路径全部消失。',
  },
]

/** 本表最近一次核对日期（写进报告，供读者判断新鲜度）。 */
export const REMOVED_SEAMS_AS_OF = '2026-10-07'
