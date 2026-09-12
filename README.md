# dsh-plugin-doctor

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![npm version](https://img.shields.io/npm/v/%40perrylink%2Fdsh-plugin-doctor)](https://www.npmjs.com/package/@perrylink/dsh-plugin-doctor)
[![npm downloads](https://img.shields.io/npm/dm/%40perrylink%2Fdsh-plugin-doctor)](https://www.npmjs.com/package/@perrylink/dsh-plugin-doctor)
[![Node](https://img.shields.io/badge/node-%5E22.19%20%7C%7C%20%3E%3D24-brightgreen.svg)](#)
[![CI](https://img.shields.io/github/actions/workflow/status/PerryLink/dsh-plugin-doctor/ci.yml?branch=main&label=CI)](https://github.com/PerryLink/dsh-plugin-doctor/actions)
[![OpenSSF Scorecard](https://api.securityscorecards.dev/projects/github.com/PerryLink/dsh-plugin-doctor/badge)](https://api.securityscorecards.dev/projects/github.com/PerryLink/dsh-plugin-doctor)

dsh 插件「完整性 + 运行流畅」一体检测器。零依赖（Node ≥22 自带能力），一次运行同时覆盖
**包结构静态检查（R）→ cordis 契约扫描（K）→ 动态沙箱冒烟（D）→ 生态集合站清单校验（CC）** 四层。
判据全部来自 2026-09-07 三路一手调研：deepseek-harness 文档/源码、cordiverse/cordis 源码契约、
工作区全渠道存量盘点（详见 `SURVEY.md`）。

## 用法

```powershell
node doctor.mjs --repo <插件仓路径>            # 全量（含动态冒烟，需网络 + pnpm）
node doctor.mjs --repo <路径> --no-smoke       # 仅静态 + 清单
node doctor.mjs --repo <路径> --dsh 0.1.2-rc.1 # 冒烟宿主版本（默认 npm latest 已发布线）
node doctor.mjs --repo <路径> --only R,K       # 只跑静态两层（推荐用 ASCII 别名）
node doctor.mjs --repo <路径> --json report.json
node doctor.mjs --repo <路径> --json -         # JSON 写 stdout（此时抑制人类可读报告）
node doctor.mjs --repo <路径> --workspace <工作区根>   # 指定兄弟仓所在工作区（CC 组核对用）
node doctor.mjs --repo <路径> --allow-degraded # 显式接受「整组未真跑」（默认 exit 6）
node doctor.mjs --purge <隔离目录>              # 清理本工具产生的隔离目录（仅 doctor-quarantine-*）
```

### 目标形态与覆盖率（0.2.0 新增）

`--repo` 可以是**源码树**，也可以是**已装包目录 / 解包后的 tarball 产物**（后者常见于 `node_modules/<pkg>`）。判据随形态变化：

| 形态 | K 组（cordis 契约） | 说明 |
|---|---|---|
| 有 `src/` 的源码树 | 扫 `src/**` + 根层 JS（`mode: src`） | 完整 |
| **无 `src/`、`main` 指向 `lib/`** | **兜底扫 `lib/**`（`mode: lib-fallback`）** | 0.2.0 修复：旧实现的门槛是"无 build 脚本"，而已发布包**保留** build 脚本 → 兜底永不触发、K 九项全 skip 却仍 exit 0（假绿） |
| 既无 `src/` 也无 `lib/` | 九项全 skip（`mode: none`） | **整组未真跑 → 退出码 6**，不再假绿 |

覆盖率写入 JSON 的 `coverage.K`（`{filesInspected, mode}`），并汇总到 `groups.K`。

### `--only` 分组与 ASCII 别名

| 别名 | 分组全名 | 内容 |
|---|---|---|
| `R` | 静态·包结构 | R0–R8 |
| `K` | 静态·cordis 契约扫描 | K1–K9 |
| `D` | 动态·沙箱冒烟 | D0–D3、D9 |
| `CC` | 生态·集合站清单 | CC1–CC5 |

别名大小写不敏感，中文全名同样可用。**工作流里请一律使用别名**：中文分组名一旦被编辑器/脚本按错误编码往返，`--only` 就会一个分组都匹配不上。

### 退出码契约

| 码 | 含义 | 引入版本 |
|---|---|---|
| `0` | 无 fail/error（可含 warn/skip），且被请求的分组都真的跑了 | 0.1.x |
| `1` | 存在 fail/error（插件缺陷） | 0.1.x |
| `2` | 用法错误、未知分组、**未知选项** | 0.1.x |
| `3` | 基础设施错误（缺 npm/pnpm 等环境不可用） | **0.2.0** |
| `4` | 不支持的宿主版本（宿主自身安装失败，**不判插件**） | **0.2.0** |
| `5` | 结果不稳定（步骤超时/被信号终止） | **0.2.0** |
| `6` | **降级**：被请求的分组整组未真跑（如无源文件可扫描） | **0.2.0** |

**防静默通过**（两层）：

1. `--only` 里只要有一个分组名不匹配 → 立即 `2`。0.1.4 及更早版本在分组名乱码时会"零检查 + exit 0"，这曾让 35 个仓的 CI 门禁变成假绿（2026-09-09 实测：`checks_run=0`、`exit=0`）。
2. 0.2.0 起：**被请求的分组若整组未真跑（全 skip）→ `6`**。旧实现只覆盖"一项都没跑"，不覆盖"跑了但全 skip" —— 后者会让"K 组 0 覆盖"被当成通过。如需显式接受，用 `--allow-degraded`（退出码降为 0，但 JSON 里 `degraded` 仍非空）。

> ⚠️ 既有家族 37 仓的门禁**不读退出码**（workflow 用 `set +e` / `out="$(…)"` / `set -e`），只读 stdout 的 `R0 ` / `K1 ` 与 JSON 里 `results[].name` 前缀分流。因此 0.2.0 的退出码新增**对既有链路零影响**；它服务于交互式使用与未来的接入方。

- 冒烟全程使用 `%TEMP%` 自建沙箱（前缀 `doctor-`，**不与宿主保护模板 `%TEMP%\dsh-*` 重叠**）承载临时 `DSH_HOME`/`DSH_AGENTS_HOME`，绝不触碰真实 `~/.dsh`（红线 3）。
- `dsh plugin add` 显式带 `--ignore-scripts`：被测包的 install/prepare 脚本不在宿主执行。pnpm 的 ignored-builds 阻断归类为 `environment`（不计 pass、不计插件缺陷）。
- 每步子进程 stdout/stderr 落盘 `%TEMP%\doctor-run-*\logs\`；运行结束**只隔离不删除**（rename 到 `%TEMP%\doctor-quarantine-*`），报告尾部打印该路径，人工确认后用 `--purge` 清理（红线 4 三段式）。
- 运行期绝对路径在写入 JSON 与渲染文本前统一占位化为 `<path>`，便于把报告提交进别人的仓而不触发其路径泄漏门禁。

## 同名区分（重要）

本仓是 **`@perrylink/dsh-plugin-doctor`**，与生态里其他同名工具**不是同一个项目**：

- npm 裸名 `dsh-plugin-doctor` 属 **Xrainsmile/DSH-Plugin-Doctor**（另一个项目，0.1.1）。因此**永远不要用 `npx dsh-plugin-doctor`** —— 那会执行别人的包；请始终用 scoped 全名 `@perrylink/dsh-plugin-doctor@<精确版本>`。
- GitHub 上名称含 `dsh-plugin-doctor` 的仓有 10 个（其中**恰同名者 8 个**），包括 `zoahdev/dsh-plugin-doctor`（GitHub-only，未发布到 npm）。
- `dsh-testkit` 的 README 把 `dsh-plugin-doctor` 链向 zoahdev 的仓，与本仓无关。

一句话定位：**零依赖、可离线（`--only R,K`）、把 cordis v4 契约（K1–K9）与五大集合站清单（CC1–CC5）做成退出码可判读的 CI 门禁**。（"唯一"这类全称不作声称——仅在已核对的工具集合内未见同类。）

## 检测目录

| 分组 | 项 | 判据要点 |
|---|---|---|
| 静态·包结构 | R0–R8 | 基础字段；**激活门 `dsh.bundle.patch`（关键）**；`npm pack --dry-run` tarball 含入口与 patch；cordis.patch.yml 结构；入口 name/apply 导出；rescope 依赖口径（禁裸 `cordis`）；engines 对齐 `^22.19.0 \|\| >=24.0.0`；预构建 + files 白名单；peer 旧 rc 残留（2026-09-05 双基线教训） |
| 静态·cordis 契约 | K1–K9 | 服务访问 vs inject 声明；ctx 活数据序列化红线；定时器/监听器未包 `ctx.effect`；Schema 含函数；apply 返回形状（v4 Effect 契约）；inject 服务名 seam；**v3 遗留 API（3.x→4.x 已删除清单）**；Config 必须是 Standard Schema；`name==='apply'` 特例 |
| 动态·沙箱冒烟 | D0–D3、D9 | npm pack → `dsh plugin --profile headless add <tarball>` → 断言 `dsh.profile.bundles` 含包名 → `--dump-config` 层标记 → keyless headless 运行期望 **exit 1 + `dsh: MISSING_CREDENTIAL`**（=组合 boot 到请求阶段；排除 NO_ADAPTER/ERR_MODULE_NOT_FOUND/SyntaxError/TypeError）→ 沙箱清理 |
| 生态·集合站清单 | CC1–CC5 | 认证注册表 spec v1 五维 evidence；adp-list yml 字段/枚举/描述；dsh-catalog 目录条目约束（禁安装命令、截断启发式）；omdsh `dshWorkshop` activation 5 值；dsh-plugin-kit 三门（license/五语 README/seam 三角色，优先调用 kit 官方 CLI） |

## Verified 徽章

挂这枚徽章的含义只有一条，且可审计：**该仓在自己的 CI 里跑 dsh-plugin-doctor 的静态 R+K 门禁（16 项：R0/R1/R3/R5/R6/R7/R8 + K1–K9），且门禁在默认分支当前 HEAD 上是绿的**。**不是**认证徽章：不含 Scorecard/provenance/安装冒烟。R2（tarball 完整性）与 R4（入口契约）读取构建产物 `lib/`，而家族多数仓的构建需要 `HARNESS_COMMIT` + `gen-aliases` 才能通过——这两项由各仓自己的 `ci.yml`（build drift gate + pack smoke）把关，不在本门禁内。

```markdown
[![dsh-doctor](https://raw.githubusercontent.com/PerryLink/dsh-plugin-doctor/main/badges/PerryLink__dsh-github.svg)](https://github.com/PerryLink/dsh-plugin-doctor#verified-徽章)
```

- 注册表 `data/verified.json` 是唯一事实来源，由 `.github/workflows/verified.yml` 每日 + 每次相关 push 刷新。刷新只读 GitHub API：解析各仓 HEAD 的 `plugin-doctor.yml` 门禁配置（必须钉住 `@perrylink/dsh-plugin-doctor@<版本>`、`--only` 参数可用、含 R0/K1 实跑自校验），再核对 HEAD 那次 `plugin-doctor` workflow run 的结论。**本仓 CI 不克隆、不安装、不执行任何第三方代码。**
- 徽章外观：视觉语言对齐生态里较新的两枚徽章（`dsh.directory` 的等宽大写 + 字距 + 标记 + 渐变，`awesome-dsh-plugin` 的印章块）——**银白/铂金金属左段 + 盾牌勾标记 + 墨蓝等宽大写字**（金行主导、水行在字），右段是**整块 GitHub 惯例状态色**（绿/橙/红/灰）配等宽大写状态词，状态另用**路径绘制的图标**（✓ / ! / ✕ / –）冗余表达，色觉障碍下同样可读。5px 圆角 + 1px 描边；**描边是必需的**——去掉后银白左段在白色 README 背景上会消失。
- 四种状态（值文本用 shields / GitHub Actions 惯用词）：`passing`（绿，HEAD 上 run success）/ `warning`（橙：HEAD 还没跑、run 仍在队列、或缺少门禁配置的前置条件）/ `failing`（红：HEAD 上 run 失败，或门禁配置不成立——含 `--only` 参数是双重编码乱码的"假门禁"）/ `no data`（灰：API 查询失败）。徽章是**动态**的：不再通过就会变红。R+K 的精确口径不在徽章文字里，而在本节与注册表 `meaning` 字段（徽章链接指回本节）。
- 加入方式：向 `data/verified-repos.json` 提 PR 增加 `{ "repo": "<owner>/<name>", "package": "<npm 包名>" }`，并按下面的门禁在自己的仓里加 `plugin-doctor.yml`；条目必须通过上面的门禁核对。
- 门禁步骤（完整工作流见任一家族仓的 `.github/workflows/plugin-doctor.yml`；分组名用 **ASCII 别名 `R,K`**——0.1.5 起支持，文件与命令行全程纯 ASCII；末尾自校验 R0/K1 确实跑了。**家族 37 仓当前 pin `0.1.6`**）：

```yaml
      - name: Run dsh-plugin-doctor (static R/K on the committed tree)
        run: |
          set +e
          out="$(npx --yes @perrylink/dsh-plugin-doctor@0.1.6 --repo . --no-smoke --only "R,K" --json /tmp/doctor.json 2>&1)"
          set -e
          printf '%s\n' "$out"
          echo "$out" | grep -q 'R0 ' || { echo "::error::doctor ran no R checks"; exit 1; }
          echo "$out" | grep -q 'K1 ' || { echo "::error::doctor ran no K checks"; exit 1; }
          if [ ! -f /tmp/doctor.json ]; then echo "::error::doctor produced no JSON report"; exit 1; fi
          node -e '
            const r = JSON.parse(require("fs").readFileSync("/tmp/doctor.json", "utf8")).results
            const buildDep = r.filter((x) => /^R[24] /.test(x.name))
            const gated = r.filter((x) => !/^R[24] /.test(x.name))
            const bad = gated.filter((x) => x.status === "fail" || x.status === "error")
            console.log("gated " + gated.length + " checks; build-dependent (reported, not gated): " + (buildDep.map((x) => x.name.split(" ")[0] + "=" + x.status).join(" ") || "none"))
            if (bad.length) { console.error("::error::failing: " + bad.map((x) => x.name).join(" | ")); process.exit(1) }
          '
```

> 为什么门禁不 install/build、徽章也不由本仓自跑：静态 R/K 检查只读已提交的树（无需依赖）；而 `npm run build` 在缺 harness 别名的环境里会失败，其 prebuild 还会清空已提交的 `lib/`，制造假红。把第三方仓的依赖安装集中到本仓 CI 执行则是供应链风险。因此门禁在各仓自己的 CI 里执行、只读提交树，本仓只做审计与发徽。

## 判据来源（SURVEY.md 有全文与 URL）

- **harness 侧**：`docs/user/develop/basic/publish.md`、`apps/cli/src/plugin.ts`（激活门=唯一开关）、
  `packages/bundle/headless/README.md`（MISSING_CREDENTIAL 判据）、Releases（0.1.2-rc.1 / 0.1.3-alpha.1 变更）、
  `@deepseek-ai/dsh-loader-smoke`（官方化"临时 DSH_HOME + 期望退出码"模式）。
- **cordis 侧**：cordiverse/cordis v4 源码（registry/fiber/reflect/events.ts）+ DSH cordis-primer/tutorial 文档 +
  v3 `@cordisjs/core@3.10.2` d.ts 差异（3.x→4.x 黑名单）。
- **生态侧**：dsh-plugin-certification spec v1、adp-list `entries.mjs`/`check-submission.mjs`、
  dsh-catalog `validate.mjs`/`deploy.yml` live smoke、omdsh build-submission、dsh-plugin-kit `verify/*`。

## 已知局限（诚实声明）

- K 组为**启发式静态扫描**：K1/K3/K4 会漏掉复杂包装、也可能误报——warn 级均需人工复核，不自动判死。
- D3 只证明「组合可 boot 到模型请求」，**不证明工具 schema 合法或业务逻辑正确**（需带钥 e2e 或 mock LLM 补充）。
- pnpm `ignored-builds` 属环境配方问题：D1 命中时降级为 warn 并给出 compat.yml allowBuilds 配方提示，
  与认证 spec v1 的 environment-blocked 口径一致，不计为插件缺陷。
- npm 线宿主（0.1.2-rc.1）packument 无 engines/peerDependencies 强制，R6 为建议门。
- 本环境实测陷阱：`$` 锚点（无 m 标志）不匹配行尾孤立 `\r` 之前的位置，解析 CRLF 文本必须按
  `/\r?\n/` 切行（已内建处理，勿回退）。

## 目录结构

```
doctor.mjs               CLI 入口（分组编排、退出码、JSON 报告）
lib/framework.mjs        检查注册/运行/判定/渲染（零依赖）
lib/util.mjs             临时沙箱 + 子进程执行（stdout/stderr 落盘，规避管道捕获限制）
lib/checks-package.mjs   静态·包结构 R0–R8
lib/checks-cordis.mjs    静态·cordis 契约 K1–K9
lib/checks-smoke.mjs     动态·沙箱冒烟 D0–D3、D9
lib/checks-collections.mjs  生态·集合站清单 CC1–CC5
tests/selftest.mjs       14 例真实 CLI 自检（既有 7 例退出码契约逐字不变 + 新增降级/用法守卫 7 例）
tests/contract.mjs       31 项契约测试（冻结既有 37 仓 CI 依赖的 5 个可观测量）
scripts/verify.mjs       verified 注册表与徽章刷新（只读 GitHub API 审计各仓门禁）
scripts/badge.mjs        verified SVG 渲染
data/verified-repos.json verified 声明仓清单
data/verified.json       verified 注册表（CI 生成）
badges/                  verified 徽章（CI 生成）
THIRD-PARTY-RK-SCAN.md   第三方插件静态 R+K 扫描结果集（公开报告）
data/rk-scans.json       上述扫描的机器可读形态
SURVEY.md                全渠道检测方法梳理 + 判据出处
```

## 状态

正式仓库：GitHub `PerryLink/dsh-plugin-doctor`（Apache-2.0），npm `@perrylink/dsh-plugin-doctor`。
**当前版本 0.2.0**（npm 上 0.2.0 之前的最新为 0.1.7），见 `CHANGELOG.md`。CI 用法（**请用 ASCII 别名**）：

```powershell
npx --yes @perrylink/dsh-plugin-doctor@0.2.0 --repo . --no-smoke --only "R,K"
```

**37 个插件仓**已内置 `.github/workflows/plugin-doctor.yml`（只读已提交树 → `--only "R,K"` 静态门禁 + R0/K1 实跑自校验，pin `@0.1.6`）。
pin 停在 0.1.6 是有意的：0.2.0 对 R/K 两组的判据与输出形态**逐字不变**（`tests/contract.mjs` 已把这条冻成断言），所以提升 pin 是一波独立动作，不是本次发布的前置条件。

> 0.2.0 的改动全部是**加法式**（新增字段 / 新增选项 / 新增退出码），既有 37 仓的判据不变；已用 37 仓基线逐项比对验证 **diffs = 0**。

### 公开结果集

- [`THIRD-PARTY-RK-SCAN.md`](https://github.com/PerryLink/dsh-plugin-doctor/blob/main/THIRD-PARTY-RK-SCAN.md) —— 首份**第三方**（非 PerryLink）dsh 插件的静态 R+K 扫描：60 个候选 → 20 个真正声明 `dsh.bundle.patch` 的插件 → 16 项门禁下 **10 通过 / 10 失败**。方法：只读克隆、**零执行**第三方代码、R2/R4 单列不入门禁；含复现命令、本次扫描自身的方法学更正，以及**被点名仓的更正通道**。机器可读形态：`data/rk-scans.json`。
  **它不是认证、不是评级，也不代表插件安全**：pass 仅表示「该 commit 上 16 项静态门禁未报失败」。

## PerryLink DSH Plugin Family

This project is one of the [40 DeepSeek Harness plugins](https://github.com/PerryLink) maintained by [PerryLink](https://github.com/PerryLink). If this one helps you, the others likely will too:

| Plugin | One-liner |
|---|---|
| **[dsh-auto-review](https://github.com/PerryLink/dsh-auto-review)** | Second-model auto-review on the approval chain, fail-closed by default | |
| **[dsh-autotier](https://github.com/PerryLink/dsh-autotier)** | Automatic strong/cheap model-tier routing with deterministic risk guards and a `/tier` command | |
| **[dsh-background-agents](https://github.com/PerryLink/dsh-background-agents)** | Durable background child agents with a Web UI sidebar, messaging and interrupt | |
| **[dsh-budget](https://github.com/PerryLink/dsh-budget)** | Cost governance for DeepSeek Harness: budgets, carbon, and latency in one panel. | |
| **[dsh-catalog](https://github.com/PerryLink/dsh-catalog)** | DSH Desktop Market standard catalog source for the PerryLink family | |
| **[dsh-cert-mcp](https://github.com/PerryLink/dsh-cert-mcp)** | Read-only MCP server exposing the certification registry: grades, snapshots and five-dimension evidence | |
| **[dsh-checkpoint-rewind](https://github.com/PerryLink/dsh-checkpoint-rewind)** | Unified session + workspace + config checkpoints with one-shot `/rewind` | |
| **[dsh-claude-move](https://github.com/PerryLink/dsh-claude-move)** | Migrate Claude Code, Codex, OpenCode and Hermes sessions, memories and skills into DSH | |
| **[dsh-click](https://github.com/PerryLink/dsh-click)** | Cross-platform native desktop control for DeepSeek Harness — Windows first. | |
| **[dsh-composer-history](https://github.com/PerryLink/dsh-composer-history)** | Terminal-style input history for the web composer: arrows, Ctrl+R search | |
| **[dsh-data-quality](https://github.com/PerryLink/dsh-data-quality)** | Deterministic dataset profiling, cleaning and citation verification | |
| **[dsh-defend](https://github.com/PerryLink/dsh-defend)** | Prompt-injection, jailbreak, and secret-leak defense for DeepSeek Harness. | |
| **[dsh-doublecheck](https://github.com/PerryLink/dsh-doublecheck)** | Engineering-discipline guard: requirements grill, test gates, adversary review | |
| **[dsh-draw](https://github.com/PerryLink/dsh-draw)** | Unified static-image generation routing for DeepSeek Harness. | |
| **[dsh-fast](https://github.com/PerryLink/dsh-fast)** | Read-only performance diagnostics: load, spill, compaction and cache hit rate | |
| **[dsh-fund-research](https://github.com/PerryLink/dsh-fund-research)** | Chinese mutual-fund research with sealed, traceable source snapshots | |
| **[dsh-github](https://github.com/PerryLink/dsh-github)** | GitHub PR/issue/CI integration with every write approval-gated | |
| **[dsh-industry-research](https://github.com/PerryLink/dsh-industry-research)** | Industry and company research pack: chain map, policy timeline, company cards | |
| **[dsh-kit](https://github.com/PerryLink/dsh-kit)** | One-command starter pack that installs the core family | |
| **[dsh-library](https://github.com/PerryLink/dsh-library)** | Local document knowledge base with hybrid search and citation-aware injection | |
| **[dsh-local-ai](https://github.com/PerryLink/dsh-local-ai)** | Local Ollama model discovery and task-based routing with cloud fallback | |
| **[dsh-lsp-actions](https://github.com/PerryLink/dsh-lsp-actions)** | LSP diagnostics, formatting, completion, code actions, symbols and rename | |
| **[dsh-mask](https://github.com/PerryLink/dsh-mask)** | PII masking at the model boundary with a host-side restore table | |
| **[dsh-mcp-panel](https://github.com/PerryLink/dsh-mcp-panel)** | MCP management console: `/mcp` command, Settings tab and trial calls | |
| **[dsh-memento](https://github.com/PerryLink/dsh-memento)** | Approval-gated cross-session memory protocol (`ctx.memory` + SQLite) | |
| **[dsh-observe](https://github.com/PerryLink/dsh-observe)** | OpenTelemetry and Langfuse telemetry export from the session event stream | |
| **[dsh-output-styles](https://github.com/PerryLink/dsh-output-styles)** | Runtime-switchable model output styles | |
| **[dsh-permission-rules](https://github.com/PerryLink/dsh-permission-rules)** | Declarative allow/deny/ask rules plus a process-level network policy | |
| **[dsh-plugin-certification](https://github.com/PerryLink/dsh-plugin-certification)** | Community certification registry with repro-checkable grades and badges | |
| **[dsh-plugin-guide](https://github.com/PerryLink/dsh-plugin-guide)** | Plugin-dev knowledge base, agent skill and the `dsh-plugin-dev` CLI toolchain | |
| **[dsh-plugin-kit](https://github.com/PerryLink/dsh-plugin-kit)** | Shared zero-runtime-dependency toolkit for the PerryLink DSH plugins | |
| **[dsh-plugin-portal](https://github.com/PerryLink/dsh-plugin-portal)** | Zero-dependency static portal rendering the whole plugin family as one page | |
| **[dsh-plugin-upgrade-015](https://github.com/PerryLink/dsh-plugin-upgrade-015)** | Merged `0.1.3-alpha.1` → `0.1.5-rc.1` upgrade corridor card plus a zero-dependency seam scanner | |
| **[dsh-reach](https://github.com/PerryLink/dsh-reach)** | Multi-channel approval/question bridge: WeChat, Telegram, Feishu + a session console | |
| **[dsh-research-report](https://github.com/PerryLink/dsh-research-report)** | Verifiable research reports: evidence ledger, manifest seal, per-claim verdicts | |
| **[dsh-score](https://github.com/PerryLink/dsh-score)** | Multi-dimensional plugin quality scoring with an evidence-backed leaderboard | |
| **[dsh-session-pin](https://github.com/PerryLink/dsh-session-pin)** | Pin sessions and workspaces in the Web sidebar with per-pin colors | |
| **[dsh-session-sync](https://github.com/PerryLink/dsh-session-sync)** | Git-backed cross-device session synchronization with keep-both merges | |
| **[dsh-skill-pack-security](https://github.com/PerryLink/dsh-skill-pack-security)** | Security-audit skill pack plus the `plugin_vet` supply-chain gate | |
| **[dsh-talk](https://github.com/PerryLink/dsh-talk)** | Voice-first session loop: speech-to-text input and text-to-speech replies | |
| **[dsh-team-rooms](https://github.com/PerryLink/dsh-team-rooms)** | Cross-session team rooms: shared message bus, task board and timeline | |
| **[dsh-test-drive](https://github.com/PerryLink/dsh-test-drive)** | Isolated install-and-smoke test drives with a pass/fail matrix | |
| **[dsh-ticktick](https://github.com/PerryLink/dsh-ticktick)** | TickTick/Dida365 task bridge: session-header panel plus eleven agent tools | |
| **[dsh-translate](https://github.com/PerryLink/dsh-translate)** | Vendor parameter translation and deterministic JSON repair | |
| **[dsh-wechat](https://github.com/pan17/dsh-wechat)** | WeChat ↔ DSH bridge (Tencent iLink bot) developed with [pan17](https://github.com/pan17/dsh-wechat), who hosts the repo | |
| **[dsh-personal-directive](https://github.com/PerryLink/dsh-personal-directive)** | Personal directive injector with a top-bar toggle (fork of liucai2026/dsh-personal-directive) | |
