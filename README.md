# dsh-plugin-doctor

dsh 插件「完整性 + 运行流畅」一体检测器。零依赖（Node ≥22 自带能力），一次运行同时覆盖
**包结构静态检查（R）→ cordis 契约扫描（K）→ 动态沙箱冒烟（D）→ 生态集合站清单校验（CC）** 四层。
判据全部来自 2026-09-07 三路一手调研：deepseek-harness 文档/源码、cordiverse/cordis 源码契约、
工作区全渠道存量盘点（详见 `SURVEY.md`）。

## 用法

```powershell
node doctor.mjs --repo <插件仓路径>            # 全量（含动态冒烟，需网络 + pnpm）
node doctor.mjs --repo <路径> --no-smoke       # 仅静态 + 清单
node doctor.mjs --repo <路径> --dsh 0.1.2-rc.1 # 冒烟宿主版本（默认 npm latest 已发布线）
node doctor.mjs --repo <路径> --only 静态·包结构,静态·cordis 契约扫描
node doctor.mjs --repo <路径> --json report.json
```

- 退出码：`0` = 无 fail/error（可含 warn/skip）；`1` = 存在 fail/error。适合直接挂 CI。
- 冒烟全程使用 `%TEMP%` mkdtemp 临时 `DSH_HOME`/`DSH_AGENTS_HOME`，绝不触碰真实 `~/.dsh`（红线 3）。
- 每步子进程 stdout/stderr 落盘 `%TEMP%\dsh-doctor-logs-*`，报告尾部打印路径，证据可查。

## 检测目录

| 分组 | 项 | 判据要点 |
|---|---|---|
| 静态·包结构 | R0–R8 | 基础字段；**激活门 `dsh.bundle.patch`（关键）**；`npm pack --dry-run` tarball 含入口与 patch；cordis.patch.yml 结构；入口 name/apply 导出；rescope 依赖口径（禁裸 `cordis`）；engines 对齐 `^22.19.0 \|\| >=24.0.0`；预构建 + files 白名单；peer 旧 rc 残留（2026-09-05 双基线教训） |
| 静态·cordis 契约 | K1–K9 | 服务访问 vs inject 声明；ctx 活数据序列化红线；定时器/监听器未包 `ctx.effect`；Schema 含函数；apply 返回形状（v4 Effect 契约）；inject 服务名 seam；**v3 遗留 API（3.x→4.x 已删除清单）**；Config 必须是 Standard Schema；`name==='apply'` 特例 |
| 动态·沙箱冒烟 | D0–D3、D9 | npm pack → `dsh plugin --profile headless add <tarball>` → 断言 `dsh.profile.bundles` 含包名 → `--dump-config` 层标记 → keyless headless 运行期望 **exit 1 + `dsh: MISSING_CREDENTIAL`**（=组合 boot 到请求阶段；排除 NO_ADAPTER/ERR_MODULE_NOT_FOUND/SyntaxError/TypeError）→ 沙箱清理 |
| 生态·集合站清单 | CC1–CC5 | 认证注册表 spec v1 五维 evidence；adp-list yml 字段/枚举/描述；dsh-catalog 目录条目约束（禁安装命令、截断启发式）；omdsh `dshWorkshop` activation 5 值；dsh-plugin-kit 三门（license/五语 README/seam 三角色，优先调用 kit 官方 CLI） |

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
SURVEY.md                全渠道检测方法梳理 + 判据出处
```

## 状态

正式仓库：GitHub `PerryLink/dsh-plugin-doctor`（MIT 外 Apache-2.0），npm `@perrylink/dsh-plugin-doctor`
（latest=0.1.3，2026-09-07）。CI 用法：

```powershell
npx --yes @perrylink/dsh-plugin-doctor@0.1.3 --repo . --no-smoke --only "静态·包结构,静态·cordis 契约扫描"
```

35 个插件仓已内置 `.github/workflows/plugin-doctor.yml`（install→build→npx 静态 R/K 门禁）。
