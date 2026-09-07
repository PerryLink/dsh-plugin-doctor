# dsh 插件「完整性 + 运行流畅」检测方法全梳理

> 2026-09-07 · 依据三路一手调研：① deepseek-harness 官方文档/源码/Releases（web + 只读 checkout
> `D:\deepseek-harness`@3801401cac）；② cordiverse/cordis v4 源码契约 + DSH cordis 文档 + v3 d.ts 差异；
> ③ 本工作区 `D:\Projects\dsh\plugins` 全渠道存量盘点（认证体系/adp-list/catalog/omdsh/plugin-kit/CI/compat/docs）。
> 自研检测器实现：本目录 `doctor.mjs`（四层 R/K/D/CC）。所有"通过"结论必须来自真实执行输出（证据纪律）。

## 0. 摘要（最重要的 8 条）

1. **激活门是唯一硬开关**：host 扫描 profile dependencies，凡解析出的 package.json 声明
   `"dsh": { "bundle": { "patch": "./cordis.patch.yml" } }` 即加入 `dsh.profile.bundles`；没有它 =
   装为普通依赖 + stderr 警告、**永不激活**。`dshWorkshop` 是 omdsh 社区元数据，harness 不读，不能替代。
2. **keyless headless 冒烟判据**：无凭据 `dsh --profile headless <任务>` 期望 **exit 1 且 stderr 严格匹配
   `dsh: MISSING_CREDENTIAL`**；必须同时排除 `NO_ADAPTER`/`ERR_MODULE_NOT_FOUND`/`SyntaxError`/`TypeError`。
   走到 MISSING_CREDENTIAL ⇒ bundle 层生效 + 插件 apply 成功 + 组合到达模型请求阶段。官方
   `@deepseek-ai/dsh-loader-smoke` 的 `expectedExitCode` 就是这个模式的成品（隔离临时 DSH_HOME + 超时 + 清场）。
3. **无崩溃隔离**：插件与宿主同进程；boot 期任何 parse/schema/resolution/加载失败 → fail-loud 全 profile
   非零退出。坏插件会杀死启动——这本身是检测信号，但也意味着不能只测 apply，必须测真实 Loader 组合。
4. **cordis v4 契约要点**：apply 返回只接受 函数/null/Promise\<disposer\>/(async) iterable，其余
   `TypeError('Invalid effect')`；inject=硬依赖（数组/对象形状），可选依赖走 `ctx.get(name)`；未声明直接
   访问 `ctx.xxx` 抛 `cannot get property ... without inject`；一切注册皆 effect，卸载自动回滚；v3 的
   fork/reusable/using/scope/runtime/lifecycle/config/collect/accept/decline/alias/off 全部删除（3.x 插件必查）。
5. **npm 线 vs checkout 线分裂必须进检测**：npm latest=0.1.2-rc.1（packument 无 engines/peerDependencies）；
   checkout 0.1.3-alpha.1 的 session 破坏性变更（SessionHandle / 异步 create / SESSION_FORMAT v2）未上 npm。
   冒烟基线默认钉 npm 线；会话类插件另做 0.1.3-alpha.1 专项审查。
6. **生态存量检测资产已相当成熟**：认证 spec v1 五维、adp-list 七 workflow 门禁、catalog 双 schema + live
   smoke、plugin-kit 三门、compat.yml 三段——自研检测器的正确姿势是**复用 + 补缺**，不是另起炉灶。
7. **工程红线**：一切动态测试用 `%TEMP%` mkdtemp 临时 DSH_HOME（绝不碰真实 `~/.dsh`）；pnpm ignored-builds
   属环境配方问题（按 allowBuilds compat 配方），记 environment-blocked 而非插件缺陷；证据不足记
   `no-evidence`，禁止编造通过。
8. **自研检测器 `dsh-plugin-doctor`**：零依赖、四层（R 包结构 / K cordis 契约 / D 沙箱冒烟 / CC 集合站清单）、
   退出码 CI 友好；2026-09-07 已对 dsh-github、dsh-memento 实测（§5）。

## 1. 渠道全景：每个集合站/渠道的检测方法与判据

### 1.1 deepseek-harness 官方运行时（deepseek-ai/deepseek-harness）

**安装与激活链**（`docs/user/develop/basic/publish.md`、`apps/cli/src/plugin.ts`、`apps/cli/reference/README.md`）：

- `dsh plugin --profile <name> <args...>` = pnpm 转发器：首用初始化 profile（`$DSH_HOME/profiles/<name>/`）→
  `spawnSync('pnpm', …)` → pnpm exit 0 后 reconcile bundles。DSH_HOME 优先级：显式路径 > `$DSH_HOME` env > `~/.dsh`。
- 五内建模板：web / headless / sdk / sdk-minimal / acp。web=常驻+浏览器+热载（`dsh web`，默认端口 3080）；
  headless=一次性（位置参数任务、无端口）。**bundle 成员变化是启动边界**：add/remove/update 后必须重启。
- 层序：bundles 列表序 → profile `cordis.patch.yml` → 家级 `$DSH_HOME/cordis.patch.yml` → `--patch` overlay；
  后层按 id **整行替换**（非深合并）。`--dump-config` 不 boot 验证层，输出 `# == <pkg>` 来源标记。

**npm 插件包形态（官方范式）**：`name`/`version`/`type: "module"`/`main`（构建产物，范式 `lib/index.js`）/
`files` 含入口 + `cordis.patch.yml`/**`"dsh": {"bundle": {"patch": "./cordis.patch.yml"}}`**；patch 为 YAML 数组
`- insert: - id: <rowId>, name: <包名>`（name 经 profile node_modules 解析，必须是包名）；入口导出
`export const name` + `export function apply(ctx)`，可选 `inject: [...]` 与 `Config`(schemastery Schema)；
依赖口径 `@deepseek-ai/cordis` 同时 peer+dev（裸 `cordis` 是上游 cordiverse 包）；工具注册正典
`ctx.tools.register(defineTool({...}))`（来自 `@deepseek-ai/dsh-tools`）；git 直装需 `prepare` + 用户侧
`pnpm-workspace.yaml allowBuilds`，npm/tarball 必须预构建。

**官方验证设施（可直接复用的检测模式）**：`@deepseek-ai/dsh-loader-smoke`（`runLoaderSmoke({tempDirPrefix,
binScript, configPath, expectedExitCode, processTimeoutMs, inspect})`：隔离临时 cwd + 隔离
DSH_HOME/DSH_AGENTS_HOME + 超时杀进程 + 期望退出码判定 + 清场）；`apps/cli/tests/profiles/headless/tests/
keyless-smoke.e2e.ts`（真实 Loader 树 + 断言会话 JSONL 落盘 + 工具清单）；打包门 publint /
verify-node-next-types / verify-npm-install-layout / verify-application-entrypoints。

**引擎与版本**：`engines.node: "^22.19.0 || >=24.0.0"`（CI 22.19/24/26；Node 23 整线排除；22.19 地板由
pi-ai 抬升）；pnpm 11.7（Corepack）；npm 线 `@deepseek-ai/dsh@0.1.2-rc.1` packument **无 engines/无
peerDependencies**（插件 engines 声明是建议非强制）。

**影响插件的变更史**（Releases 即 changelog）：rc.1 = `Session.events` → `seq`/`eventAt()`/`snapshotEvents()`、
`ApiProxy` 移除 → `@Remote`、SQLite session 后端移除、Node 24.0–24.11.1 修复、官方请求默认附带插件包名+版本；
0.1.3-alpha.1（未上 npm）= SessionHandle / 异步 `agentLoop.create()` / **SESSION_FORMAT v2**（v0/v1 相邻
generation 迁移）；rc.8 SQLite 格式不兼容；rc.7 设置卡片能力。README 明示 developer preview、破坏必续。

### 1.2 awesome-dsh-plugin（`adp-list/` 上游收录）

- **条目 schema**（`scripts/lib/entries.mjs` `validateEntries()`）：键白名单 `{url,name,category,description,tarball}`；
  url 必须 `https://github.com/owner/repo`；文件名 = slugFor(url)（monorepo 子包 `owner__repo--path.yml`）；
  category 23 值枚举；`description.en` 必填单行（zh 可选）；tarball 必须 GitHub Release 托管 https `.tgz`
  （github.com / objects.githubusercontent.com / release-assets.githubusercontent.com）；BOM 剥离。
- **contributing 硬要求**：`dsh.bundle`（仅 `dsh.client` 拒）、真实代码（占位/README-only 拒）、仓库 ≥1 天、
  活跃维护、`dsh-plugin` topic、描述属实（数字/API 名与代码核对）、分类贴切、纯聚合包不收、依赖指向上游作者、
  每 PR ≤3 条、screenshots 1–8 张 GitHub 托管、npm 映射自动采集（手写 `npm:` 键拒）。
- **CI 门禁五件套**：`pr-check`（stale-fork 守卫、yml 位置、README 与数据一致 `generate-readme.mjs --check`、
  awesome-lint、build-site）；`pr-gate`（`check-submission.mjs`：仓库存在且未归档、非 DSH 本体、未 vendor
  dsh-base/web-app/headless、全树扫 `dsh.bundle` ≤40 manifest、年龄 ≥1 天、每 PR ≤3 条；rate-limit 未检项
  记 incomplete **不阻断**）；`pr-guard`（动 `.github/` = stale fork；90 分钟无 check fail）；`regate`（6 小时
  重跑未验/过期/中性/48h 旧 PASS）；`decay-scan`（周扫 gone/archived/dormant 6 月/unbundled，只报 issue 不删，
  inconclusive >5% 拒发布）。辅助：check-bleed（描述窜扰）、probe-npm（registry repository 回指）、
  probe-tarballs（死链剔除）、probe-readmes/downloads/stars/screenshots/updates（新鲜度）。

### 1.3 dsh-plugin-certification（spec v1 认证体系）

- **五维**：A 清单合规（bundle/LICENSE SPDX/keywords/五语 README/engines）· B 构建卫生（files 白名单、peer/
  optional、无恶意 postinstall、lint/typecheck 门禁）· C 供应链（OpenSSF Scorecard 官方 API）· D 发布完整性
  （npm provenance SLSA，`npm audit signatures` 可验）· E 安装冒烟（隔离一次性 profile 真实 install/load/
  keyless boot，四态 `ok`/`load-fail`/`install-fail`/`skip`）。
- **判据**：A = 五维全过且 E=ok 无 veto；B = E 过且 A–D ≥3；C = E 过其余不全；D = 硬门失败（缺 bundle/无
  license/恶意模式）；Security veto（混淆/凭据外传/异常安装期行为）直接 D 并公布原因；**environment-blocked E
  （如 pnpm approve-builds 交互门）保 B 并记录复现命令，绝不记 D**；无证据记 `no-evidence`。
- 数据 `data/certified.json`（specVersion v1，entries 含 grade/snapshot/dimensions 五维 evidence/veto）；
  `scripts/badge.mjs` 生成徽章；`registry.yml` 每日 cron 重渲染；`dsh-cert-mcp` 只读 MCP 暴露注册表（get/list/
  spec 三工具）。现态：PerryLink/dsh-auto-review grade A。

### 1.4 DSH Desktop Market（`dsh-catalog/` 标准目录源）

- 源数据 `data/packages.json`（37 条 `{npm,repo,displayName,categories,summary}`）→ `build-catalog.mjs [origin]`
  → `artifacts/v1/plugins.json` + `catalog-source.json`（v1 双 schema 镜像）。
- **validate.mjs 判据**：manifestVersion 1.0.0；providerId 模式；endpoint https 且 /v1/plugins；items ≤200；id
  模式+去重；长度上限（name≤160/displayName≤120/summary≤1000）；禁控制/bidi 字符；repository 或 package 二选一；
  icon 与 endpoint 同源 `/icons/*.png`；**条目文本禁安装命令**（`dsh plugin --profile|pnpm add|npm i` 正则）；
  失败 exit 1。`refresh-snapshot.mjs` 带截断启发式（未以 `[.!?)—–"」』]` 结尾告警）与 mojibake 启发式。
- **CI live smoke**（deploy.yml）：build-icons → build(真实 origin) → validate → 部署（Vercel / CF workers 两段式）
  → `curl -fsS` manifest + 插件页 + 一个 icon PNG 魔数断言 `[137,80,78,71,13,10,26,10]`；items<34 或缺
  media.icon.url 即 fail。

### 1.5 omdsh hub（Workshop 提交）

- `build-omdsh-submission.mjs`：package.json 原文读取；`dshWorkshop.lifecycle.activation` ∈
  {immediate, hot-reload, restart-plugin, restart-profile, restart-host} 否则 throw；`restartRequired=/^restart-/`
  （hub intake-lib.mjs 规则）；产出 `omdsh-workshop-submission/v2` create-project JSON，`packageManifest`
  verbatim 复制 dshWorkshop。
- hub 侧前置：`prepare-issue-intake.mjs <event.json>` + `npm run check` 双过；投稿后盯 intake run 与 bot 评论，
  preflight failed 须修后重投。

### 1.6 deepseek1024 官方榜与 Showcase

- `dsh1024 plugin --profile web add <pkg>` 安装行计入安装排行（真实可装 = 上榜资格；36 个 PerryLink 条目已收录）。
- Showcase 帖（官方 Discussion）人工审查：描述属实、可复现。

### 1.7 Gitee 镜像

- 存在性与同步（perrylink gitee-sync，每日 cron），不构成质量门，仅传播渠道。

### 1.8 各插件仓自身门禁链（37 仓通用 + 特例）

- **check 链**：`pnpm run typecheck && pnpm test && pnpm run build && pnpm run verify && pnpm pack`；
  `prepublishOnly` 重跑全门禁；发布 = push tag → publish workflow（`--provenance`、Trusted Publishing 11 包）。
- **compat.yml（每月+手动，宿主钉 `@deepseek-ai/dsh@0.1.2-rc.1`）三段**：① bare-import（allowBuilds 预置四包
  dsh-subprocess-local/koffi/node-pty/protobufjs + tarball 空项目 import）② profile（DSH_HOME 临时 + add dsh-base/
  dsh-headless/tarball → `--dump-config` grep 包名 → `timeout 120 dsh --profile compat "Reply with exactly: ok"`，
  判据：日志含 `MISSING_CREDENTIAL`=PASS（树加载证明）或 exit 0 且边界正则匹配 ok=PASS，否则 FAIL exit 1）③
  uninstall 可逆。
- **CI 标配**：Scorecard、host-compat 版本钉号（`check-host-versions.mjs`）、README 官方仓库声明、安装行、funding、
  `dshWorkshop` manifest；特例门：dsh-memento 覆盖率阈值（lib≥90%/index≥85%/全文件≥90%）+ `test:conformance`
  协议黄金参考；check-endpoints 存活探测（**401/403/405/5xx=存活、404/410/DNS/TLS/超时=失败**）。
- 可复用模板资产：`scripts/loader-runner.mjs`（独立进程真 Loader）、`verify-self-contained.mjs`、
  `verify-artifacts.mjs`、`check-readmes.mjs`、`smoke-package.mjs`、`check-host-versions.mjs`、dsh-test-drive
  全链路 e2e（install/config/smoke/uninstall/cleanup 五阶段）。

## 2. cordis v4 契约要点（插件运行正确的硬约束）

来源：cordiverse/cordis v4 源码（registry/fiber/reflect/events/service.ts）+ DSH cordis-primer/cordis-api/
framework/cordis-tutorial 文档 + v3 `@cordisjs/core@3.10.2` d.ts 差异。cordis 上游 4.0.x stable 从未发布
（latest=4.0.0-rc.9），DSH 将其 vendored 为 `@deepseek-ai/cordis`——**以 rescope 包为准**。

- **插件形态**：function / 有 prototype 的 class / `{apply}` 对象；非法抛 `invalid plugin, expect function or
  object with an "apply" method`；`name==='apply'` 被重置为 undefined；`Plugin.Transform {schema:true}` 用于配置变换。
- **apply 返回（v4 Effect 契约）**：同步或 async 均可，但返回值只接受 函数 disposer / null / undefined /
  `Promise<disposer>`（fiber 停留 LOADING 直至 settle，期间服务不可见）/ (async) iterable of disposers；
  **其余形状（含 v3 `{dispose}` 对象）抛 `TypeError('Invalid effect')`**。
- **注入**：`inject: (keyof M)[] | { name?: interceptConfig }`；任一缺失 → fiber 永久 PENDING、apply 不执行；
  服务消失自动卸载、恢复重载；可选依赖 = `ctx.get(name)`（strict=true 只看 ACTIVE provider，缺失 undefined）；
  未声明访问抛 `cannot get property "x" without inject`；`ctx.set` 需先 provide（否则
  `cannot set property ... without provide`）；同隔离域重复 provide 抛 `service "x" has been registered at ...`；
  provide 卸载链先 `await Promise.allSettled(依赖方.await())` 再清理自身。
- **生命周期**：`ctx.effect(() => disposer)` 立即执行、disposer 逆序、双调 no-op、卸载后注册抛
  `CordisError('INACTIVE_EFFECT')`；多个异步 disposer **并发**执行（顺序敏感的 teardown 必须写在同一个
  disposer 内串行 await）；`ctx.on/plugin/provide/accessor/mixin` 皆 effect 返回 disposer；状态机
  `PENDING→LOADING→ACTIVE→UNLOADING→DISPOSED`（`LOADING↘FAILED`），迁移发 `internal/status`；**FAILED 后依赖
  变化不复活，只能 `update()`**（rc.9 #98）；`fiber.await()/restart()/update()/state/getEffects()` 为诊断接口。
- **事件五模式**：emit 同步不等待；parallel 并发+AggregateError；serial/bail 首 bail 停；waterfall 中间件链
  （**不调 next() = 短路 veto**；next() 二调抛错；返回值同步）。bail 判定 = 非 null/false/undefined。
  `on/once(name, listener, opts)` 返回 disposer；v4 **删除 off()**；事件名可 symbol/原型名（rc.9 #51）；
  `internal/*` 保留事件（plugin/status/service/update(waterfall)/get/set/listener/dispatch）。
- **Schema**：Config 必须是 Standard Schema 校验器（"普通对象导出为 Config 无法工作"——教程 05）；异步校验抛
  `TypeError('Async config validation is not supported')`；失败抛 `ValidationError` 聚合 issues 带路径
  （`... (at targets)`）；default 补齐；schema 可 JSON round-trip、函数/类实例值禁止、`!!js` 仅限 config/disabled。
- **3.x→4.x 黑名单（迁移必查）**：`reusable`/`reactive`/fork 机制、`inject:{required,optional}`/`using`、
  函数型 Config、`{dispose}` 返回、`ctx.using/scope/runtime/lifecycle/config/start()/stop()/collect()/accept()/
  decline()/alias()/off()`、`Context.service()` 装饰器、v3 Service 类 `static immediate`/`protected start/stop/fork`。
- **序列化红线**：Context 是 Proxy（inspect.custom），JSON.stringify/structuredClone/全量枚举 = 违规。
- 上游无插件 lint 工具；可借鉴 cordis-rs 163 场景对照表、DSH `@mode` 事件目录交叉校验（gen-cordis-catalog）、
  `ctx.invariants` 注册表（InvariantError 机械校验）。

## 3. 自研检测器：dsh-plugin-doctor（本目录）

### 3.1 设计原则

零依赖（Node 22 内置）；判据全部溯源到 §1/§2 的文件或 URL；静态层启发式只降 warn 不判死、动态层严格断言；
子进程 stdout/stderr 落盘 `%TEMP%\dsh-doctor-logs-*`（证据纪律）；退出码 0/1 直接挂 CI；
冒烟全程 `%TEMP%` mkdtemp DSH_HOME（红线 3）；pnpm ignored-builds 按 environment-blocked 口径降 warn。

### 3.2 判据映射表

| 检测项 | 来源依据 | 实现方式 |
|---|---|---|
| R1 激活门 `dsh.bundle.patch`（关键） | plugin.ts reconcile 逻辑 | 静态 JSON 字段 |
| R2 tarball 完整性 | publish.md 包形态 + `files` | `npm pack --dry-run --json` 清单核对 |
| R3 patch 结构 | patch YAML 约定（id/name=包名） | 启发式解析；D2 dump-config 动态兜底 |
| R4 入口 name/apply/inject | index.md 入口契约 | 产物 + 源码双重 grep |
| R5 rescope 依赖口径 | publish.md + 工作区双基线 | 依赖字段扫描 + 源码 import 对照 |
| R6 engines | 官方 `^22.19.0 \|\| >=24.0.0` | 声明解析（建议门） |
| R7 预构建 + files 覆盖 | publish.md（npm 预构建/git prepare） | main 指向 + files 白名单覆盖 |
| R8 peer 旧 rc 残留 | 2026-09-05 全仓统一教训 | 旧 prerelease-tuple 正则 |
| K1 服务访问 vs inject | reflect.ts throw 文案 | ctx.X 全集 vs 全仓 inject 并集 |
| K2 序列化红线 | Proxy/def-site 追踪 | JSON.stringify(ctx 等正则 |
| K3 资源未包 ctx.effect | 教程 02 原文 | 定时器/监听器上下文窗口 |
| K4 Schema 含函数 | schemastery README | Schema+箭头函数同文件 |
| K5 apply 返回形状 | fiber.ts Invalid effect | async apply 提示 + {dispose} 告警 |
| K6 inject 已知 seam | architecture.md seam 表 | seam 白名单（含实测补充） |
| K7 v3 遗留 API | v3 d.ts 差异 11 条 | 黑名单正则（fail 级） |
| K8 Config 校验器 | 教程 05 | Config 导出初值启发式 |
| K9 name==='apply' | registry.ts 特例 | 字面量正则 |
| D0–D3 沙箱冒烟 | compat.yml 正典 + loader-smoke | 临时 DSH_HOME 全链路 + 严格 MISSING_CREDENTIAL |
| CC1 认证注册表 | spec v1 certified.json | 五维 evidence/veto 核对 |
| CC2 adp-list 条目 | entries.mjs schema | 本地字段/枚举/描述校验 |
| CC3 市场目录条目 | catalog v1 schema | 条目约束 + 截断/安装命令启发式 |
| CC4 omdsh 清单 | build-submission.mjs | activation 5 值 + restartRequired |
| CC5 插件三门 | dsh-plugin-kit verify/* | 优先调 kit 官方 CLI（未构建则本地降级） |

### 3.3 局限（诚实声明）

- K 组为启发式：漏检复杂包装、可能误报——warn 均需人工复核；`$` 锚点与行尾 `\r` 的环境陷阱已内建规避。
- D3 只证明「组合可 boot 到模型请求」，不证明工具 schema/业务正确（需带钥 e2e 或 mock LLM 补）。
- 未覆盖：L9 浏览器 UI（Playwright）、L8 soak、性能/启动开销、跨平台矩阵——可后续加组。

## 4. 使用建议

1. **提交前**：`node doctor.mjs --repo . --no-smoke`（秒级）；发版/收录前：全量（含 D 组，约几分钟）。
2. **CI 接入**：静态层 job（`--no-smoke --json`）+ 每月 compat.yml 已有冒烟，双轨互补。
3. **双基线**：npm 线冒烟钉 `--dsh 0.1.2-rc.1`；checkout/0.1.3-alpha.1 线用各仓 `typecheck`（tsconfig paths 对照）
   + 会话类插件按 §1.1 变更清单专项审查（SessionHandle/异步 create/v2）。
4. **收录/认证工作流**：改动 adp-list yml、catalog 条目、认证五维证据后跑对应 CC 项 + D 组取证。
5. **pnpm ignored-builds**：按 compat.yml allowBuilds 配方（dsh-subprocess-local/koffi/node-pty/protobufjs）处理，
   记录复现命令，不判插件缺陷。

## 5. 实测记录（2026-09-07 真实执行，证据纪律：以下结论均出自真实运行输出）

### dsh-github（@perrylink/dsh-github 0.7.5 · 全量含动态冒烟）

- 静态 R0–R8 **全 PASS**（激活门 / tarball 88 文件 / patch 结构 / 入口导出 / rescope 口径 / engines /
  预构建 / peer 对齐）。
- K 组：**K1 WARN**（`state.ts:97` 的 `subagents: ctx.subagents` 未在 inject 声明——硬依赖应 inject、
  可选依赖应 `ctx.get()`）；**K3 WARN**（`bot.ts:145` setInterval、`github.ts:98–99` timeout+abort 监听、
  `jobs.ts:100` timeout 疑似未包 `ctx.effect`，需人工复核）；其余 K2/K4–K9 PASS。
- CC 组：CC2/CC3/CC4 PASS；CC1 SKIP（未进认证注册表）；**CC5 FAIL**（kit 官方 CLI：src 缺
  Service Definition/Service Provider/Consumer 三角色 marker）。
- D 组 **D0–D3 全 PASS**：`plugin add` 后 `dsh.profile.bundles` 含 `@perrylink/dsh-github` → `--dump-config`
  层标记 `# == @perrylink/dsh-github` → keyless headless **exit 1 + `dsh: MISSING_CREDENTIAL`**（组合 boot
  至模型请求阶段）→ 沙箱清理。证据：`reports/dsh-github.json` + 日志 `dsh-doctor-logs-WdvLA1`。

### dsh-memento（dsh-memento 0.5.6 · 全量含动态冒烟）

- **R8 FAIL（真实缺陷，检测器首个战果）**：peer `@deepseek-ai/dsh-settings: >=0.1.0-rc.1 <0.2.0` 是旧
  prerelease-tuple 区间（裸解析只匹配 0.1.0-rc.x 单行，与宿主 0.1.2-rc.1 波次冲突——2026-09-05 同款教训；
  devDep 已正确钉 0.1.2-rc.1，建议 peer 改为 `>=0.1.2-rc.1 <0.2.0`）。
- K 组：仅 **K4 WARN**（`index.mjs` 同文件出现 Schema 与箭头函数，需人工复核是否有函数值进 schema）；
  K1/K2/K3/K5–K9 PASS（剥注释扫描后假阳性清零）。
- CC 组：CC2/CC3/CC4 PASS；CC1 SKIP；**CC5 FAIL**（纯 JS 仓无 `src/`，kit verify-seam 结构不适用——
  检测器已自动加注，建议 kit 侧扩展扫描范围或人工豁免）。
- D 组 **D0–D3 全 PASS**（MISSING_CREDENTIAL 判据，树加载证明）。证据：`reports/dsh-memento.json` +
  日志 `dsh-doctor-logs-lJNAmQ`。

### 检测器自身迭代记录（本会话修复清单）

Windows shell 解析 npm.cmd shim；**行尾孤立 `\r` 与 `$` 锚点的环境陷阱**（本机 `$` 不匹配行尾 `\r` 前，
CRLF 行必须按 `/\r?\n/` 切分）；node.exe 直调不走 shell（路径含空格）；K 组：全仓 inject 并集、
剥注释后扫描（JSDoc 假阳性清零）、纯 JS 仓源文件发现（无 build 脚本且 main 指向 lib/ 时 lib 即源码）、
自 provide 服务从"未知 seam"豁免；CC5 纯 JS 仓注记。
