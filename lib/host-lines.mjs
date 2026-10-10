// 宿主发行线（published host lines）—— doctor 用来做"区间 ∩ 真实宿主版本集"求值的宿主版本集合。
//
// 为什么要固定一份：doctor 的契约是**离线可用**（下游 40+ 个仓的 CI 只跑 R/K、不装依赖、不联网）。
// 所以不能每次去问 npm。但是"哪些宿主版本存在"这个事实会随官方发版变化，因此：
//   - 这份清单**必须带抓取日期**，且**只**用于"某区间是否与任一真实宿主相交"的判断；
//   - `--host <版本>` 可以逐个补充/替换目标宿主（例如 CI 里钉版本时用真实目标）；
//   - 实时模式（能读到 dsh 安装）会把**实际安装版本**并入集合，优先级最高。
//
// 刷新方式：`npm view @deepseek-ai/dsh versions --json`
// 最近一次刷新：2026-10-07（来源：本机 npm registry 查询，见 agents/A0b 证据）
//
// 与 doctor 旧实现的差别（这是本文件存在的理由）：
//   旧 USAGE 写"npm latest 实测为 0.1.5-rc.1、next 为 0.1.5-rc.2"，
//   2026-10-07 实测 `latest = 0.2.0-rc.2`、`alpha = 0.2.1-alpha.1`。
//   旧 R8 把"统一区间"写成 `>=0.1.2-rc.1 <0.2.0 || >=0.1.5-alpha.1 <0.2.0`，
//   而该区间在 0.2.x 上**一条都不满足** ⇒ 按旧文案改的插件会被宿主 preflight
//   静默 `disabled`（证据：packages/boot/app-boot/src/compatibility-preflight.ts:105-118）。

import { compare, parse, satisfies } from './semver-lite.mjs'

/** 全部已知宿主版本（升序无关，比较由 semver-lite 负责）。 */
export const PUBLISHED_HOST_VERSIONS = [
  '0.0.1-rc.1', '0.0.1-rc.2', '0.0.1-rc.5',
  '0.1.0-rc.2', '0.1.0-rc.3', '0.1.0-rc.6', '0.1.0-rc.7', '0.1.0-rc.8',
  '0.1.1-rc.1', '0.1.1-rc.2',
  '0.1.2-alpha.2', '0.1.2-alpha.3', '0.1.2-alpha.4', '0.1.2-alpha.5', '0.1.2-rc.1',
  '0.1.3-alpha.2',
  '0.1.5-alpha.1', '0.1.5-alpha.2', '0.1.5-rc.1', '0.1.5-rc.2', '0.1.5-rc.3',
  '0.1.6-alpha.1', '0.1.6-alpha.2',
  '0.1.7-alpha.1', '0.1.7-alpha.2', '0.1.7-rc.1', '0.1.7-rc.2',
  '0.2.0-rc.1', '0.2.0-rc.2',
  '0.2.1-alpha.1',
]

/**
 * 蒸馏出"值得逐个求值的对照宿主"：**每一条已发布发行线一个代表版本**，外加显式额外目标。
 *
 * 两个容易搞错的地方，都在这里定死：
 *   ① `0.2.0` 与 `0.2.0-rc.2` 属同一条线（major.minor 相同）。比较必须走 semver 优先级，
 *      不能比字符串 —— 比字符串会得出 `0.2.0-rc.2 > 0.2.0`（`'rc'` 对 `undefined`），
 *      于是整张表错位。
 *   ② **官方至今没有发布过任何 0.2.x 稳定版**（0.2 线只有 0.2.0-rc.1 / rc.2 与 0.2.1-alpha.1）。
 *      所以"当前该支持的宿主"不是"最高稳定版"，而是**最高已发布版本**；
 *      报告里用 `latest` 这个词，不要用 `stable`（写了 stable 会诱导读者以为有稳定版可钉）。
 */
export function referenceHosts(extra = []) {
  const byLine = new Map()
  for (const v of [...PUBLISHED_HOST_VERSIONS, ...extra]) {
    const p = parse(v)
    if (!p) continue
    const key = `${p.major}.${p.minor}`
    const prev = byLine.get(key)
    if (!prev || compare(p, prev.p) > 0) byLine.set(key, { v, p })
  }
  const all = [...new Set([...[...byLine.values()].map((x) => x.v), ...extra])]
  return all.sort((a, b) => {
    const pa = parse(a)
    const pb = parse(b)
    if (!pa || !pb) return String(a).localeCompare(String(b))
    return compare(pa, pb)
  })
}

/**
 * "当前该被支持的宿主"。
 * @returns {{latest:string|null, latestStable:string|null, latestPrerelease:string|null, lines:string[], all:string[]}}
 *   `latest`      = 全部已发布版本里的最高者（**这是报告文案与冒烟选靶该用的那个**）
 *   `latestStable`= 最高稳定版；**当前为 null**（0.2 线尚无稳定发布），不是 bug
 *   `lines`       = 已发布发行线（如 ['0.0','0.1','0.2']），用于"你的走廊覆盖了哪几条线"
 */
export function currentHosts() {
  const refs = referenceHosts()
  const parsed = refs.map((v) => ({ v, p: parse(v) })).filter((x) => x.p)
  const stable = parsed.filter((x) => x.p.prerelease.length === 0)
  const pre = parsed.filter((x) => x.p.prerelease.length > 0)
  return {
    latest: parsed.length ? parsed[parsed.length - 1].v : null,
    latestStable: stable.length ? stable[stable.length - 1].v : null,
    latestPrerelease: pre.length ? pre[pre.length - 1].v : null,
    lines: [...new Set(parsed.map((x) => `${x.p.major}.${x.p.minor}`))],
    all: refs,
  }
}

/** 某区间支持到哪些发行线（用于报告里给出"你能装在哪些宿主上"）。 */
export function linesSupportedBy(range, hosts = PUBLISHED_HOST_VERSIONS) {
  const out = []
  for (const h of hosts) {
    if (satisfies(h, range) === true) {
      const p = parse(h)
      if (p) out.push(`${p.major}.${p.minor}`)
    }
  }
  return [...new Set(out)]
}

/** 本清单的抓取日期，写进报告供读者判断新鲜度。 */
export const HOST_LINES_AS_OF = '2026-10-07'
