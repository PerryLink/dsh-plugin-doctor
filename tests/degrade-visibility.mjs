// 逐项断言：**降级必须在用户可见的报告里留痕**，以及工作区定位不能编造路径。
//
// 为什么单开一个文件：`tests/contract.mjs` 与 `tests/selftest.mjs` 都是**真跑 CLI**
// （会起子进程、读 fixture），而这两条缺陷的判据是纯函数级的 —— 它们断言的是
// "用户拿到的那段文本里有没有这句话"，不需要网络、不需要安装、不需要沙箱。
//
// 背景（2026-10-13 实测）：
//   1. `render()` 从不读 `degraded`，所以宿主半区（plugin_doctor 工具、/doctor 命令）
//      返回的报告里**看不到降级**：X 组整组 skip 时用户读到的是 4 条 [SKIP] +
//      `总判定: SKIP`，与"本来就没有 X 组要跑的项"无法区分。CLI 之所以没事，
//      只因为 `doctor.mjs` 额外自己打印了 `[降级]` —— 宿主半区没有这条路径。
//   2. `plugin.mjs` 旧实现把 `workspaceRoot` 写死成 `import.meta.dirname/..`，
//      装进 profile 后该路径是 `<profile>/node_modules`（或 `.../@perrylink`），
//      不是工作区，于是 CC1/CC2/CC3 对着真实存在的仓报"本地不存在"。
import assert from 'node:assert/strict'
import path from 'node:path'
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { render, renderDegraded, summarizeGroups, degradedGroups, verdict } from '../lib/framework.mjs'
import { resolveWorkspaceRoot, workspaceOfRepo, asWorkspace, pluginRepoDirs } from '../lib/workspace.mjs'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
let failures = 0
function check(label, condition, detail = '') {
  if (condition) {
    console.log(`PASS  ${label}${detail ? `  — ${detail}` : ''}`)
  } else {
    failures += 1
    console.log(`FAIL  ${label}${detail ? `  — ${detail}` : ''}`)
  }
}

// ── 观测 1：整组 skip ⇒ degraded 非空，且**渲染结果里必须出现降级字样** ──────
const X = '动态面·宿主契约'
const allSkip = [
  { group: '静态·包结构', name: 'R0 包结构', status: 'pass', message: 'ok', id: 'R0', groupId: 'R' },
  { group: X, name: 'X1 peer 走廊', status: 'skip', message: '拿不到宿主安装', category: 'not-applicable', id: 'X1', groupId: 'X' },
  { group: X, name: 'X2 版本载体', status: 'skip', message: '拿不到宿主安装', category: 'not-applicable', id: 'X2', groupId: 'X' },
]
const degraded = degradedGroups(summarizeGroups(allSkip))
check('整组 skip 被识别为降级', degraded.includes('X'), `degraded=${JSON.stringify(degraded)}`)

const rendered = render(allSkip, { degraded })
check('render() 输出含降级提示', /\[降级\]/.test(rendered))
check('render() 输出点名降级分组', rendered.includes('X'))
check('render() 输出点明"不可当作通过"', rendered.includes('不可当作通过'))
check('render() 输出含 --allow-degraded 指引', rendered.includes('--allow-degraded'))

// 无降级时不得多出任何一行（CLI 与 CI 的 stdout 契约不变）
const clean = render(allSkip.slice(0, 1), { degraded: [] })
check('无降级时 render() 不出现降级字样', !/降级/.test(clean))
check('无降级时 render() 与旧调用等价', clean === render(allSkip.slice(0, 1)))
check('renderDegraded([]) 为空串（调用方无须判断）', renderDegraded([]) === '')

// verdict 的 ok 字段只看 fail/error：降级**不**让 ok 变 false，所以降级信息
// 只能靠渲染/退出码传达 —— 这正是必须把提示写进 render() 的原因。
const v = verdict(allSkip, { degraded })
check('verdict.ok 不因降级而 false（故渲染是唯一出口）', v.ok === true, `worst=${v.worst}`)
check('verdict 携带 degraded 列表', v.degraded.includes('X'))

const familyWorkspace = pluginRepoDirs(path.dirname(ROOT)).length >= 2
if (familyWorkspace) {
// ── 观测 2：工作区定位 —— 不编造路径，且能从被检仓向上找到真工作区 ─────────
const self = path.join(ROOT)
check('pluginRepoDirs 认得本仓所在工作区', pluginRepoDirs(path.dirname(ROOT)).length >= 2,
  `${pluginRepoDirs(path.dirname(ROOT)).length} 个插件仓`)
check('workspaceOfRepo 从本仓向上得到工作区', workspaceOfRepo(self) === path.dirname(ROOT),
  String(workspaceOfRepo(self)))
check('asWorkspace 拒绝不存在的候选（bundle 安装形态）', asWorkspace(path.join(ROOT, 'node_modules', '@perrylink')) === null)
check('asWorkspace 拒绝存在但无插件仓的目录', asWorkspace(path.join(ROOT, 'data')) === null)

const resolved = resolveWorkspaceRoot(self, { installDir: ROOT })
check('resolveWorkspaceRoot 走 repo-ancestor', resolved.source === 'repo-ancestor', JSON.stringify(resolved))
check('resolveWorkspaceRoot 得到真工作区', resolved.root === path.dirname(ROOT))

const explicit = resolveWorkspaceRoot(self, { workspace: path.dirname(ROOT), installDir: ROOT })
check('显式 workspace 优先', explicit.source === 'argument' && explicit.root === path.dirname(ROOT))

const env = resolveWorkspaceRoot(self, { installDir: ROOT, env: { DSH_WORKSPACE: path.dirname(ROOT) } })
check('DSH_WORKSPACE 生效', env.source === 'env:DSH_WORKSPACE')
} else {
  console.log('SKIP workspace-location checks: single-repo checkout (no sibling plugin repos)')
}

// 旧行为（install-relative）只有在它真的含插件仓时才允许被采用。bundle 形态下
// `import.meta.dirname/..` 是 `<profile>/node_modules`（或 `.../@perrylink`），
// 必须落到 null —— 用一棵临时的假 profile 树复现该形态：被检仓挂在 profile 下
// （因此向上找不到含两个插件仓的目录），doctor 自身装在 profile 的 node_modules 里。
const fakeRoot = mkdtempSync(path.join(tmpdir(), 'dsh-test-doctor-ws-'))
try {
  // %TEMP% 下可能有别的 `dsh-*` 目录（本测试自身的遗留就是例子），所以假 profile
  // 必须再套一层：向上只看到 profile 根，才复现得出"找不到工作区"。
  const fakeProfile = path.join(fakeRoot, 'profile')
  const bundledInstall = path.join(fakeProfile, 'node_modules', '@perrylink', 'dsh-plugin-doctor')
  const bundledRepo = path.join(fakeProfile, 'packages', 'dsh-test-plugin')
  mkdirSync(bundledInstall, { recursive: true })
  mkdirSync(bundledRepo, { recursive: true })
  const bundled = resolveWorkspaceRoot(bundledRepo, { installDir: bundledInstall, env: {} })
  check('bundle 形态不会把 node_modules 当工作区', bundled.root === null, JSON.stringify(bundled))
  check('bundle 形态 source 为 null（不谎报来源）', bundled.source === null)

  check('bundle 形态 install-relative 候选确实在 node_modules 下',
    path.resolve(bundledInstall, '..').includes(`${path.sep}node_modules`),
    path.resolve(bundledInstall, '..'))
} finally { rmSync(fakeRoot, { recursive: true, force: true }) }

console.log(`\ndegrade-visibility: ${failures === 0 ? 'all assertions passed' : `${failures} FAILED`}`)
process.exit(failures === 0 ? 0 : 1)
