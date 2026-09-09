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
```

### `--only` 分组与 ASCII 别名

| 别名 | 分组全名 | 内容 |
|---|---|---|
| `R` | 静态·包结构 | R0–R8 |
| `K` | 静态·cordis 契约扫描 | K1–K9 |
| `D` | 动态·沙箱冒烟 | D0–D3、D9 |
| `CC` | 生态·集合站清单 | CC1–CC5 |

别名大小写不敏感，中文全名同样可用。**工作流里请一律使用别名**：中文分组名一旦被编辑器/脚本按错误编码往返，`--only` 就会一个分组都匹配不上。

### 退出码契约

| 码 | 含义 |
|---|---|
| `0` | 无 fail/error（可含 warn/skip） |
| `1` | 存在 fail/error |
| `2` | 用法错误、未知分组、或**零检查执行** |

**防静默通过**：`--only` 里只要有一个分组名不匹配，或最终零检查执行，本工具立即以 `2` 失败。0.1.4 及更早版本在分组名乱码时会"零检查 + exit 0"，这曾让 35 个仓的 CI 门禁变成假绿（2026-09-09 实测：`checks_run=0`、`exit=0`）。

- 冒烟全程使用 `%TEMP%` mkdtemp 临时 `DSH_HOME`/`DSH_AGENTS_HOME`，绝不触碰真实 `~/.dsh`（红线 3）。
- 每步子进程 stdout/stderr 落盘 `%TEMP%\dsh-doctor-logs-*`，报告尾部打印路径，证据可查。

## 检测目录

| 分组 | 项 | 判据要点 |
|---|---|---|
| 静态·包结构 | R0–R8 | 基础字段；**激活门 `dsh.bundle.patch`（关键）**；`npm pack --dry-run` tarball 含入口与 patch；cordis.patch.yml 结构；入口 name/apply 导出；rescope 依赖口径（禁裸 `cordis`）；engines 对齐 `^22.19.0 \|\| >=24.0.0`；预构建 + files 白名单；peer 旧 rc 残留（2026-09-05 双基线教训） |
| 静态·cordis 契约 | K1–K9 | 服务访问 vs inject 声明；ctx 活数据序列化红线；定时器/监听器未包 `ctx.effect`；Schema 含函数；apply 返回形状（v4 Effect 契约）；inject 服务名 seam；**v3 遗留 API（3.x→4.x 已删除清单）**；Config 必须是 Standard Schema；`name==='apply'` 特例 |
| 动态·沙箱冒烟 | D0–D3、D9 | npm pack → `dsh plugin --profile headless add <tarball>` → 断言 `dsh.profile.bundles` 含包名 → `--dump-config` 层标记 → keyless headless 运行期望 **exit 1 + `dsh: MISSING_CREDENTIAL`**（=组合 boot 到请求阶段；排除 NO_ADAPTER/ERR_MODULE_NOT_FOUND/SyntaxError/TypeError）→ 沙箱清理 |
| 生态·集合站清单 | CC1–CC5 | 认证注册表 spec v1 五维 evidence；adp-list yml 字段/枚举/描述；dsh-catalog 目录条目约束（禁安装命令、截断启发式）；omdsh `dshWorkshop` activation 5 值；dsh-plugin-kit 三门（license/五语 README/seam 三角色，优先调用 kit 官方 CLI） |

## Verified 徽章

挂这枚徽章的含义只有一条，且可审计：**该仓在自己的 CI 里跑 dsh-plugin-doctor 的静态 R+K 门禁，且门禁在默认分支当前 HEAD 上是绿的**（**不是**认证徽章：不含 Scorecard/provenance/安装冒烟）。

```markdown
[![dsh-doctor](https://raw.githubusercontent.com/PerryLink/dsh-plugin-doctor/main/badges/PerryLink__dsh-github.svg)](https://github.com/PerryLink/dsh-plugin-doctor#verified-徽章)
```

- 注册表 `data/verified.json` 是唯一事实来源，由 `.github/workflows/verified.yml` 每日 + 每次相关 push 刷新。刷新只读 GitHub API：解析各仓 HEAD 的 `plugin-doctor.yml` 门禁配置（必须钉住 `@perrylink/dsh-plugin-doctor@<版本>` 且 `--only` 参数可用），再核对 HEAD 那次 `plugin-doctor` workflow run 的结论。**本仓 CI 不克隆、不安装、不执行任何第三方代码。**
- 四种状态：`R+K pass`（绿，HEAD 上 run success）/ `R+K warn`（黄：HEAD 还没跑、run 仍在队列、或缺少门禁配置的前置条件）/ `R+K fail`（红：HEAD 上 run 失败，或门禁配置不成立——含 `--only` 参数是双重编码乱码的"假门禁"）/ `no-data`（灰：API 查询失败）。徽章是**动态**的：不再通过就会变红。
- 加入方式：向 `data/verified-repos.json` 提 PR 增加 `{ "repo": "<owner>/<name>", "package": "<npm 包名>" }`，并按下面的模板在自己的仓里加 `plugin-doctor.yml`；条目必须通过上面的门禁核对。
- 门禁模板（`--only` 参数用 YAML `\u` 转义构造，文件保持纯 ASCII，避免编码往返把中文分组名变成乱码；末尾自校验 R0/K1 确实跑了）：

```yaml
      - name: Run dsh-plugin-doctor
        env:
          DOCTOR_ONLY: "\u9759\u6001\u00b7\u5305\u7ed3\u6784,\u9759\u6001\u00b7cordis \u5951\u7ea6\u626b\u63cf"
        run: |
          if [ -z "$DOCTOR_ONLY" ]; then echo "DOCTOR_ONLY is empty"; exit 1; fi
          set +e
          out="$(npx --yes @perrylink/dsh-plugin-doctor@0.1.4 --repo . --no-smoke --only "$DOCTOR_ONLY" 2>&1)"
          code=$?
          set -e
          printf '%s\n' "$out"
          echo "$out" | grep -q 'R0 ' || { echo "::error::doctor ran no R checks"; exit 1; }
          echo "$out" | grep -q 'K1 ' || { echo "::error::doctor ran no K checks"; exit 1; }
          exit $code
```

> 为什么徽章读 CI 结论而不是本仓自跑：家族多数仓把 `lib/` 放在 `.gitignore`（构建产物），纯克隆缺入口文件，必须 `install + build` 才能跑 R2/R4；而把 35 个第三方仓的依赖安装集中到本仓 CI 执行是供应链风险。因此门禁由各仓自己的 CI 执行（与用户安装时的构建环境一致），本仓只做审计与发徽。

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
tests/selftest.mjs       7 例真实 CLI 自检（退出码契约 + 防静默通过回归守卫）
scripts/verify.mjs       verified 注册表与徽章刷新（只读 GitHub API 审计各仓门禁）
scripts/badge.mjs        verified SVG 渲染
data/verified-repos.json verified 声明仓清单
data/verified.json       verified 注册表（CI 生成）
badges/                  verified 徽章（CI 生成）
SURVEY.md                全渠道检测方法梳理 + 判据出处
```

## 状态

正式仓库：GitHub `PerryLink/dsh-plugin-doctor`（Apache-2.0），npm `@perrylink/dsh-plugin-doctor`
（**latest=0.1.4**；0.1.5 已入库待发布，见 `CHANGELOG.md`）。CI 用法（**请用 ASCII 别名**）：

```powershell
npx --yes @perrylink/dsh-plugin-doctor@0.1.4 --repo . --no-smoke --only "R,K"
```

35 个插件仓已内置 `.github/workflows/plugin-doctor.yml`（install→build→npx 静态 R/K 门禁）。
