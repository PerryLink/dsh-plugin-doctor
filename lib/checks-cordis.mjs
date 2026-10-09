// 静态·cordis 契约扫描（K1–K9，启发式）
// 依据：cordiverse/cordis v4 源码契约 + DSH 官方 cordis 文档（2026-09-07 调研）：
//  - apply 可同步，亦可 async 返回 Promise<disposer>；返回非法形状抛 TypeError('Invalid effect')
//  - inject 硬依赖 = (keyof M)[] | { name?: interceptConfig }；可选依赖走 ctx.get(name)
//  - v4 删除 v3 的 fork/reusable/using/scope/runtime/lifecycle/config/collect/accept/decline/alias/off
//  - ctx 活数据不可 JSON.stringify/structuredClone/展开
import path from 'node:path'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { pass, fail, warn, skip, findFiles } from './util.mjs'

export const GROUP = '静态·cordis 契约扫描'

// v4 Context 固有成员（访问无需 inject）。v3 已删除成员（scope/config/fork/...）故意不列入，
// 由 K7 精确追责。
const CTX_INTRINSIC = new Set([
  'get', 'on', 'once', 'effect', 'set', 'root', 'plugin', 'emit',
  'parallel', 'waterfall', 'bail', 'serial', 'logger', 'name', 'deps',
  'isolate', 'intercept', 'extend', 'accessor', 'mixin', 'provide',
  'reflect', 'registry', 'inject', 'fiber', 'filter', 'select',
])
const KNOWN_SEAMS = new Set([
  'tools', 'llm', 'shell', 'jobs', 'commands', 'web', 'logger', 'config', 'storage',
  'session', 'sessions', 'slots', 'locale', 'connection', 'remote', 'settingsScope',
  'approval', 'credentials', 'subagents', 'settings', 'systemPrompt',
])

// ── 交叉干扰参考数据（K10–K13）─────────────────────────────────────────────
// 全部取自上游文档的机器可读来源，附抓取时的基线，避免变成会漂移的手抄表。
// 来源 1：docs/event-producer-consumer.md 的 @mode 列（waterfall 共 17 条，
//         基线 DSH 0.2.0-rc.2 / 该文档 81 条事件表）。
// 来源 2：docs/tool-catalog.md 的 `### \`name\`` 小节（内置工具名，基线同上）。
// 来源 3：packages/bundle/base/cordis.patch.yml 的顶层 id（宿主自带行 id）。
// 重新生成：见本仓 THIRD-PARTY-RK-SCAN.md 的同名小节。
const WATERFALL_EVENTS = new Set([
  'agent/pre-step', 'agent/request', 'agent/request-error', 'approval/request',
  'compaction/summary-error', 'connection/request', 'fs/edit-intent', 'fs/write-intent',
  'llm/stream', 'session-telemetry/record', 'system-prompt/assemble', 'tools/execute',
  'tools/post-execute', 'tools/pre-execute', 'tools/ptc-dispatch-log',
  'user-questions/request', 'workspace/session-activity',
])
/** 宿主内置工具名 + PTC 保留名。同名注册在同层会抛错；显式遮蔽会改写模型语义。 */
const RESERVED_TOOL_NAMES = new Set([
  'ask_user_question', 'bash', 'cordis_inspect_list', 'cordis_inspect_query',
  'create_goal', 'edit', 'exit_plan_mode', 'get_goal', 'glob', 'grep',
  'interrupt_agent', 'job_kill', 'job_list', 'job_output', 'list_agents',
  'list_mcp_resource_templates', 'list_mcp_resources', 'list_subagent_models',
  'load_workspace_dependencies', 'lsp', 'plugin_manager', 'present', 'pwsh', 'ralph',
  'read', 'read_image', 'read_mcp_resource', 'run_code', 'schedule_create',
  'schedule_delete', 'schedule_list', 'schedule_update', 'send_message',
  'session_event_read', 'session_event_search', 'session_event_trace', 'session_search',
  'session_trace', 'skill', 'spawn_teammate', 'stagehand_act', 'stagehand_extract',
  'stagehand_navigate', 'stagehand_observe', 'stagehand_screenshot', 'stagehand_tabs',
  'str_replace_editor', 'subagent', 'team_task_create', 'team_task_get', 'team_task_list',
  'team_task_update', 'terminal_close', 'terminal_list', 'terminal_open', 'terminal_read',
  'terminal_send', 'terminal_signal', 'todo_write', 'update_goal', 'wait_agent',
  'web_fetch', 'web_search', 'workflow', 'write',
])
/**
 * 宿主自带的行 id（`@deepseek-ai/dsh-base` 及模式组合包注册的行）。覆写这些行的
 * `config` 是整段替换语义，会与其它覆写同一行的插件互相抹掉 —— 实测故障类别，
 * 见 dsh-highstar-plugins.md §5.6（dsh-purge 与 dsh-infinite-gen-4 在
 * `system-prompt` 上互斥）。
 */
const BUILTIN_PATCH_ROWS = new Set([
  'agent-loop', 'system-prompt', 'llm-deepseek', 'modules', 'connection',
  'session-telemetry-otel', 'tool-fs', 'tool-web', 'tool-bash', 'tool-pwsh',
  'storage-domain', 'session', 'agent', 'settings', 'commands', 'goal', 'plan-mode',
  'compaction-basic', 'subagent', 'tools', 'llm', 'web', 'mcp-resources', 'hmr',
  'plugin-manager', 'permission', 'approval', 'skill', 'jobs', 'token-meter',
])

// 剥注释后再扫描（JSDoc 里的 ctx.xxx 引用是假阳性大户）；(^|[^:]) 守卫避免伤及字符串内 ://
function stripComments(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
}

function readAll(files) {
  return files.map((f) => { try { return { f, text: stripComments(readFileSync(f, 'utf8')) } } catch { return { f, text: '' } } })
}

const short = (f) => f.split(/[\\/]/).pop()

// 源文件发现策略（R-fix 0A 修正）：
//   ① src/** + 根目录一层 JS/TS
//   ② 无 src 时，若 main 指向 lib/ → 把 lib/** 当源码（**去掉旧的 `!pkg.scripts?.build` 门槛**：
//      已发布 tarball / 已装包目录里没有 src/，但 package.json 仍保留 build 脚本，
//      旧条件因此永不成立 → K1–K9 九项全 skip → 汇总仍 exit 0（假绿））
//   ③ main 未做 stripDot 时 `./index.mjs` 不匹配 'lib/'，7 个仓的 lib/ 从不被扫（同样修正）
// 覆盖率写入 ctx.coverage.K，供报告与「整组未真跑」判定使用。
function collectSourceFiles(ctx) {
  const { repoPath, pkg } = ctx
  const main = String(pkg.main ?? '').replace(/^\.\//, '')
  const srcFiles = findFiles(repoPath, 'src', /\.(ts|mts|tsx|mjs|js)$/)
  for (const entry of readdirSync(repoPath, { withFileTypes: true })) {
    if (!entry.isFile()) continue
    if (/\.(mjs|js|cjs|ts|mts|cts)$/.test(entry.name)) srcFiles.push(path.join(repoPath, entry.name))
  }
  let files = [...new Set(srcFiles)]
  let mode = 'src'
  let fallbackDir = null
  if (!files.length) {
    // 无 src 时按「构建产物目录」兜底：main 所在目录 + lib/ + dist/。
    // 不再要求 main 必须以 'lib/' 开头 —— 实测第三方插件里 main 落在 dist/ 或包根是常见形态，
    // 只认 lib/ 会让这些包 K 组九项全 skip（本仓 THIRD-PARTY-RK-SCAN.md 里 3/20 即此情形）。
    const mainDir = path.posix.dirname(main)
    const dirs = [...new Set([mainDir !== '.' && mainDir !== '' ? mainDir : null, 'lib', 'dist'].filter(Boolean))]
    for (const d of dirs) {
      const hit = findFiles(repoPath, d, /\.(mjs|js|cjs)$/)
      if (hit.length) { files = [...new Set(hit)]; mode = 'lib-fallback'; fallbackDir = d; break }
    }
  }
  if (!files.length) mode = 'none'
  ctx.coverage = { ...(ctx.coverage ?? {}), K: { filesInspected: files.length, mode, fallbackDir } }
  return files
}

export function addChecks(doctor, ctx) {
  const srcFiles = collectSourceFiles(ctx)

  doctor.add(GROUP, 'K1 服务访问与 inject 声明一致', () => {
    if (!srcFiles.length) return skip('无源文件可扫描')
    const all = readAll(srcFiles)
    // 全仓 inject 并集（多文件插件架构：inject 常集中声明在入口文件）
    const injectList = new Set()
    for (const { text } of all) {
      const injectDecl = text.match(/(?:export\s+)?(?:const\s+)?inject\s*[:=]\s*\[([^\]]*)\]/)
      for (const s of injectDecl?.[1]?.match(/['"][^'"]*['"]/g) ?? []) injectList.add(s.slice(1, -1))
    }
    const candidates = new Map()
    for (const { f, text } of all) {
      // 局部类型参数（如 createState(ctx: { credentials: ... })，非 cordis Context）——跳过该文件
      if (/ctx\s*:\s*\{/.test(text)) continue
      // 局部对象变量（如 `const ctx = { sandboxRoots, coverage }`）——同样不是 cordis
      // Context，它只是本文件自己的上下文袋。实测本仓的 doctor.mjs:144 就是这种写法，
      // 旧版因此把 ctx.sandboxRoots / ctx.coverage 报成「未 inject 的服务访问」——
      // 一个纯假阳性，而它每天出现在本仓自己的门禁里。
      if (/(?:const|let|var)\s+ctx\s*=(?!=)/.test(text)) continue
      for (const m of text.matchAll(/ctx\.([A-Za-z_$][\w$]*)/g)) {
        const name = m[1]
        if (CTX_INTRINSIC.has(name) || injectList.has(name)) continue
        if (!candidates.has(name)) candidates.set(name, [])
        candidates.get(name).push(f)
      }
    }
    if (!candidates.size) return pass('未发现未声明的 ctx.<服务> 访问')
    const lines = [...candidates.entries()].slice(0, 10)
      .map(([n, fs]) => `ctx.${n}（${fs.length} 处，如 ${short(fs[0])}）`)
    return warn(
      `以下服务被直接访问但未在 inject 声明（硬依赖必须 inject，否则运行时抛 "cannot get property ... without inject"；可选依赖应改用 ctx.get()）:\n${lines.join('\n')}`,
    )
  })

  doctor.add(GROUP, 'K2 活数据序列化红线', () => {
    if (!srcFiles.length) return skip('无源文件可扫描')
    const hits = []
    for (const { f, text } of readAll(srcFiles)) {
      for (const m of text.matchAll(/JSON\.stringify\(\s*ctx\b|structuredClone\(\s*ctx\b|\{\s*\.\.\.ctx\b/g)) {
        hits.push(`${short(f)}: ${m[0]}`)
      }
    }
    if (hits.length) return fail(`检测到对 ctx 活数据的序列化/展开（Context 是 Proxy，序列化会丢 def/use-site 追踪或触发代理陷阱）:\n${hits.slice(0, 5).join('\n')}`)
    return pass('未发现 ctx 序列化/展开')
  })

  doctor.add(GROUP, 'K3 定时器/全局监听生命周期', () => {
    if (!srcFiles.length) return skip('无源文件可扫描')
    const hits = []
    for (const { f, text } of readAll(srcFiles)) {
      const lines = text.split('\n')
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        if (!/(setInterval|setTimeout|setImmediate|process\.on|addEventListener\()/.test(line)) continue
        // 变量级清理检测：同文件存在 clearTimeout/clearInterval/unref/removeEventListener 对应清理 → 自清理，跳过
        // （变量声明可能在上一行，如三元表达式换行的 `const timer = cond\n  ? setInterval(...)`）
        let varMatch = line.match(/(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=/)
        if (!varMatch && i > 0) varMatch = lines[i - 1].match(/(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=/)
        const listenerCleaned = line.includes('addEventListener') && /removeEventListener\(/.test(text)
        if (varMatch) {
          const name = varMatch[1]
          const timerCleaned = new RegExp(`clear(?:Timeout|Interval)\\(\\s*${name}\\b|${name}\\??\\.\\s*unref\\s*\\(`).test(text)
          if (timerCleaned || listenerCleaned) continue
        } else if (listenerCleaned) {
          continue
        }
        const before = lines.slice(Math.max(0, i - 3), i).join('\n')
        if (!/ctx\.effect|ctx\.on\b/.test(before) && !/return\s*\(\)\s*=>/.test(before + line)) {
          hits.push(`${short(f)}:${i + 1} ${line.trim()}`)
        }
      }
    }
    if (hits.length) return warn(`定时器/全局监听疑似未包装进 ctx.effect（"Cordis API 之外的资源必须包在 ctx.effect 中"——教程 02；卸载后不回收，HMR 泄漏）:\n${hits.slice(0, 5).join('\n')}`)
    return pass('未发现裸定时器/全局监听')
  })

  doctor.add(GROUP, 'K4 Schema 含函数', () => {
    if (!srcFiles.length) return skip('无源文件可扫描')
    const hits = []
    for (const { f, text } of readAll(srcFiles)) {
      if (/Schema\./.test(text) && /=>/.test(text)) hits.push(short(f))
    }
    if (hits.length) return warn(`以下文件同时出现 Schema 与箭头函数（函数值进不了 schema：不可校验、不可持久化）:\n${hits.slice(0, 5).join('\n')}`)
    return pass('未发现 Schema 定义旁箭头函数')
  })

  doctor.add(GROUP, 'K5 apply 返回形状（v4 Effect 契约）', () => {
    if (!srcFiles.length) return skip('无源文件可扫描')
    const notes = []
    for (const { f, text } of readAll(srcFiles)) {
      if (/export\s+async\s+function\s+apply|apply\s*:\s*async\s*\(/.test(text)) {
        notes.push(`${short(f)}: async apply（v4 允许，但必须返回 Promise<disposer>；settle 前 fiber 停留 LOADING、其服务对依赖方不可见）`)
      }
    }
    if (notes.length) return warn(notes.join('\n') + '\nv4 合法返回值：函数 disposer / null / undefined / Promise<disposer> / (async) iterable；其余形状抛 TypeError("Invalid effect")')
    return pass('apply 为同步声明')
  })

  doctor.add(GROUP, 'K6 inject 服务名属于已知 seam', () => {
    if (!srcFiles.length) return skip('无源文件可扫描')
    const unknown = new Set()
    const provided = new Set()
    for (const { text } of readAll(srcFiles)) {
      const injectDecl = text.match(/(?:export\s+)?(?:const\s+)?inject\s*[:=]\s*\[([^\]]*)\]/)
      for (const s of injectDecl?.[1]?.match(/['"][^'"]*['"]/g) ?? []) {
        const name = s.slice(1, -1)
        if (!KNOWN_SEAMS.has(name) && !name.includes('.')) unknown.add(name)
      }
      // 插件自 provide 的服务不算"未知"（自建 capability seam）
      for (const m of text.matchAll(/(?:ctx\.)?provide\s*\(\s*['"]([^'"]+)['"]/g)) provided.add(m[1])
    }
    for (const p of provided) unknown.delete(p)
    if (unknown.size) return warn(`inject 引用未知服务名（请确认由宿主/其它插件提供，否则 fiber 永久 PENDING、apply 永不执行）: ${[...unknown].join(', ')}`)
    return pass('inject 服务名均在已知 seam 内或为自 provide 能力')
  })

  doctor.add(GROUP, 'K7 v3 遗留 API（3.x→4.x 已删除）', () => {
    if (!srcFiles.length) return skip('无源文件可扫描')
    const hard = []
    const soft = []
    for (const { f, text } of readAll(srcFiles)) {
      for (const m of text.matchAll(/ctx\.(using|scope|runtime|lifecycle|collect|accept|decline|alias|off|fork)\b/g)) {
        hard.push(`${short(f)}: ctx.${m[1]}（v3 API，v4 已删除）`)
      }
      if (/ctx\.config\b/.test(text)) hard.push(`${short(f)}: ctx.config（v4 改为 ctx.fiber.config）`)
      if (/ctx\.(start|stop)\(/.test(text)) hard.push(`${short(f)}: ctx.start()/stop()（v4 改为 fiber.await()/dispose()/update()）`)
      if (/inject\s*:\s*\{[^}]*\b(required|optional)\b|\binject\s*\.\s*(required|optional)/.test(text)) hard.push(`${short(f)}: inject {required,optional} 形状（v3；v4 为 string[] 或 {name: interceptConfig}，可选依赖用 ctx.get）`)
      if (/\b(reusable|reactive)\s*:/.test(text)) soft.push(`${short(f)}: reusable/reactive 元数据（v4 已删除 fork 机制，该字段被忽略）`)
      if (/\busing\s*:/.test(text)) soft.push(`${short(f)}: using 元数据（v3 的 inject 别名）`)
      if (/static\s+immediate|protected\s+(start|stop|fork)\s*\(/.test(text)) soft.push(`${short(f)}: v3 Service 写法（static immediate/protected start/stop）`)
      if (/return\s*\{\s*dispose\s*[:(]/.test(text)) soft.push(`${short(f)}: 返回 {dispose} 对象（v3 DisposableLike，v4 抛 Invalid effect，须返回函数 disposer）`)
    }
    if (hard.length) return fail([...new Set(hard)].slice(0, 8).join('\n'))
    if (soft.length) return warn([...new Set(soft)].slice(0, 8).join('\n'))
    return pass('未发现 v3 遗留 API')
  })

  doctor.add(GROUP, 'K8 Config 必须是 Standard Schema 校验器', () => {
    if (!srcFiles.length) return skip('无源文件可扫描')
    const hits = []
    for (const { f, text } of readAll(srcFiles)) {
      const m = text.match(/export\s+const\s+Config\s*=\s*([^\n]*)/)
      if (m && !/Schema\./.test(m[1]) && !/interface|type\s/.test(text.match(/export\s+(?:interface|type)\s+Config/)?.[0] ?? '')) {
        if (m[1].trim().startsWith('{')) hits.push(`${short(f)}: export const Config = {普通对象}（"将普通对象导出为 Config 无法工作"——教程 05；应导出 schemastery Schema）`)
      }
    }
    if (hits.length) return fail(hits.join('\n'))
    return pass('Config 声明为 Schema 校验器或纯类型')
  })

  doctor.add(GROUP, 'K9 插件 name 特例', () => {
    if (!srcFiles.length) return skip('无源文件可扫描')
    const hits = []
    for (const { f, text } of readAll(srcFiles)) {
      if (/name\s*:\s*['"]apply['"]/.test(text)) hits.push(short(f))
    }
    if (hits.length) return warn(`对象插件 name === 'apply' 会被框架重置为 undefined（registry.ts 特例），诊断名丢失:\n${hits.join('\n')}`)
    return pass('无 name="apply" 特例')
  })

  // ── 交叉干扰（K10–K13）───────────────────────────────────────────────────
  // 前九项只看「本插件自身是否正确」；K10–K13 看「本插件会不会干扰别的插件，
  // 或会不会被别的插件吃掉」。这四类都是实测过的真实故障类别，见 WAVE-A 调研：
  //  - waterfall 监听器不调 next() → 静默吞掉全部下游监听器（DSH 官方明文规则）
  //  - 同名 tool 遮蔽：DSH 自带的 installMetaShim 用 data.delete + register 两步
  //    显式遮蔽内置 get_goal/create_goal/update_goal（7.0k★ 插件实测）
  //  - 服务键双提供：Cordis 每个 isolate scope 只允许一个提供方
  //  - 覆写内置行的 config：整段替换语义，两个插件覆写同一行必有一方失效

  doctor.add(GROUP, 'K10 waterfall 监听器必须委托 next()', () => {
    if (!srcFiles.length) return skip('无源文件可扫描')
    const hits = []
    for (const { f, text } of readAll(srcFiles)) {
      // 只判定**内联函数体**的注册点：`ctx.on('事件', (…) => …)` / `function (…)`。
      // 传具名引用（`ctx.on('approval/request', bridge.onApproval)`）时委托发生在
      // 别处，静态看不到，报 warn 只会制造噪声 —— 实测 dsh-reach 就是这种写法，
      // 而它的 bridge.onApproval 内部确实调用 next()（见该仓 AGENTS.md 的
      // waterfall discipline 一节）。因此只对能确证的形态下结论。
      for (const m of text.matchAll(/ctx\.on\(\s*['"]([A-Za-z0-9_$/*.:-]+)['"]\s*,\s*(?:async\s+)?(?:\(|function\b)/g)) {
        const event = m[1]
        if (!WATERFALL_EVENTS.has(event)) continue
        if (/\bnext\b/.test(text.slice(m.index, m.index + 2500))) continue
        // 注册窗口内没出现 next：若整个文件都没有 next，可确定它没有委托能力；
        // 若文件别处有 next，则委托可能经由引用完成，不下结论。
        if (/\bnext\b/.test(text)) continue
        hits.push(`${short(f)}: ctx.on('${event}') 的内联监听器全文未见 next —— 未委托将静默吞掉该 waterfall 的全部下游监听器`)
      }
    }
    if (hits.length) return warn(hits.join('\n'))
    return pass('顺序敏感事件的内联监听器均可确认委托 next()')
  })

  doctor.add(GROUP, 'K11 工具名遮蔽内置/保留名', () => {
    if (!srcFiles.length) return skip('无源文件可扫描')
    if (!srcFiles.length) return skip('无源文件可扫描')
    const hits = []
    for (const { f, text } of readAll(srcFiles)) {
      for (const m of text.matchAll(/\bname\s*:\s*['"]([A-Za-z0-9_$.-]+)['"]/g)) {
        if (RESERVED_TOOL_NAMES.has(m[1])) hits.push(`${short(f)}: 工具名 '${m[1]}' 与宿主保留名/内置工具同名`)
      }
      // 显式遮蔽两步法：先删再注册。这是 dsh-routing-suite 遮蔽内置目标的实现方式。
      for (const m of text.matchAll(/\b(?:tools|data)\.(?:data\.)?delete\(\s*(?:def|definition)\.name\s*\)/g)) {
        hits.push(`${short(f)}: 检测到 tools.data.delete(def.name) —— 显式遮蔽内置工具的两步法，会使模型看到被改写的同名 schema`)
      }
    }
    if (hits.length) return warn(`工具名冲突/遮蔽（同名工具在同层注册会抛错；显式遮蔽会改写内置语义）:\n${[...new Set(hits)].join('\n')}`)
    return pass('未发现内置/保留工具名冲突')
  })

  doctor.add(GROUP, 'K12 服务键与宿主 seam 同名', () => {
    if (!srcFiles.length) return skip('无源文件可扫描')
    if (!srcFiles.length) return skip('无源文件可扫描')
    const hits = []
    for (const { f, text } of readAll(srcFiles)) {
      // super(ctx, 'name') 与 ctx.provide('name') 是本插件对外提供的服务键。
      for (const m of text.matchAll(/super\(\s*(?:ctx|this\.ctx)\s*,\s*['"]([A-Za-z0-9_$]+)['"]/g)) {
        if (KNOWN_SEAMS.has(m[1])) hits.push(`${short(f)}: super(ctx, '${m[1]}') 与宿主既有 seam 同名 —— 同一 isolate scope 只允许一个提供方，另一个提供方会失败`)
      }
      for (const m of text.matchAll(/ctx\.provide\(\s*['"]([A-Za-z0-9_$]+)['"]/g)) {
        if (KNOWN_SEAMS.has(m[1])) hits.push(`${short(f)}: ctx.provide('${m[1]}') 与宿主既有 seam 同名`)
      }
    }
    if (hits.length) return warn(`${[...new Set(hits)].join('\n')}\n若确为替代实现，必须让用户显式禁用原提供方行，而不是与之并存。`)
    return pass('对外提供的服务键未与已知 seam 冲突')
  })

  doctor.add(GROUP, 'K13 patch 覆写内置行 config', () => {
    // K10–K13 共担「无源文件 ⇒ K 组整组结构性不可跑」这一降级契约
    // （framework.mjs 的 degradedGroups 要求整组 ran === 0 才算降级）。
    // 本项本身只看 patch，但若在此处报 pass，一个「有 patch 无源码」的仓
    // 就会让整组不再降级 —— 那正是 selftest「bare → exit 6」所守的语义。
    if (!srcFiles.length) return skip('无源文件可扫描')
    const patchFiles = ['cordis.patch.yml', 'cordis.patch.yaml']
      .map((n) => path.join(ctx.repoPath, n))
      .filter((p) => { try { readFileSync(p); return true } catch { return false } })
    if (!patchFiles.length) return skip('无 cordis.patch.yml')
    const hits = []
    for (const p of patchFiles) {
      const text = readFileSync(p, 'utf8').replace(/#.*$/gm, '')
      // 顶层 override 行 = 有 id 且不在 insert 块内的行。整段 config 替换语义下，
      // 覆写内置行会与其它覆写同一行的插件互相抹掉。
      const lines = text.split(/\r?\n/)
      let inInsert = false
      for (let i = 0; i < lines.length; i++) {
        const t = lines[i].trim()
        if (/^-\s*insert:/.test(t)) { inInsert = true; continue }
        if (/^-\s+/.test(lines[i]) && !/^\s/.test(lines[i])) inInsert = false
        if (inInsert) continue
        const idm = /^-?\s*id:\s*["']?([A-Za-z0-9_.:@/-]+)["']?\s*$/.exec(t)
        if (idm && BUILTIN_PATCH_ROWS.has(idm[1])) {
          hits.push(`${path.basename(p)}:${i + 1} 覆写内置行 id='${idm[1]}' —— patch 是整段 config 替换（不深度合并），与其它覆写同一行的插件必有一方完全失效`)
        }
      }
    }
    if (hits.length) return warn(`${hits.join('\n')}\n若必须覆写，请重述你保留的全部字段，并在 README 标注与其它覆写同一行的插件的互斥关系。`)
    return pass('patch 未覆写内置行的 config')
  })

  // ── 跨仓注入点比对（K14）───────────────────────────────────────────────
  // K10–K13 判的是「本仓自身」，看不到兄弟仓。而实战中最贵的冲突恰恰是跨仓的：
  // 服务键对每个 isolate scope 只允许一个提供方；同名工具在同层注册直接抛错。
  // 本项在 --workspace 指向的家族工作区里横向比对，把这类冲突在**发布前**暴露出来。
  doctor.add(GROUP, 'K14 跨仓注入点重名（需 --workspace）', () => {
    // Same whole-group degradation contract as K10–K13: with no source files the
    // K group is structurally unrunnable, and returning `pass` here would stop
    // `degradedGroups` from reporting the group as degraded.
    if (!srcFiles.length) return skip('无源文件可扫描')
    const ws = ctx.workspaceRoot
    if (!ws || !existsSync(ws)) return skip('未提供 --workspace（跨仓比对需要家族工作区）')
    const siblings = discoverSiblings(ws)
    if (siblings.length < 2) return skip(`工作区 ${short(ws)} 内未发现第二个 DSH 插件仓`)
    const mine = injectionPointsOf(ctx.repoPath, ctx.pkg)
    if (mine.services.size === 0 && mine.tools.size === 0 && mine.commands.size === 0 && mine.insertIds.size === 0) {
      return pass('本仓未注册服务键/工具/命令/patch insert 行，无跨仓重名面')
    }
    const exemptions = readCrossPluginExemptions(ctx.repoPath)
    const collisions = []
    for (const sib of siblings) {
      if (path.resolve(sib.dir) === path.resolve(ctx.repoPath)) continue
      const theirs = injectionPointsOf(sib.dir, sib.pkg)
      const pairs = [
        ['service', mine.services, theirs.services],
        ['tool', mine.tools, theirs.tools],
        ['command', mine.commands, theirs.commands],
        ['patch insert id', mine.insertIds, theirs.insertIds],
      ]
      for (const [kind, a, b] of pairs) {
        for (const name of a) {
          if (!b.has(name)) continue
          if (crossPluginExempt(exemptions, kind, name, sib.pkg.name)) continue
          collisions.push(`${kind} "${name}" 与 ${sib.pkg.name} 同名`)
        }
      }
    }
    const uniq = [...new Set(collisions)]
    if (uniq.length) {
      return warn(
        `${uniq.join('\n')}\n`
        + '服务键对每个 isolate scope 只允许一个提供方；同名工具的第二次注册抛错。'
        + '缓解方式二选一：(a) 让本仓改注册独立名字（首选）；(b) 保留运行期让位守卫，'
        + `并在本仓 package.json 或 ${CROSS_PLUGIN_FILE} 里声明 dsh-plugin-doctor.crossPlugin.exempt 予以豁免。`,
      )
    }
    return pass(`与工作区内 ${siblings.length - 1} 个兄弟仓比对，无未豁免的注入点重名`)
  })
}

const CROSS_PLUGIN_FILE = 'dsh-plugin-doctor.yml'

/** A sibling DSH plugin repo inside the family workspace. */
function discoverSiblings(ws) {
  let entries
  try { entries = readdirSync(ws, { withFileTypes: true }) } catch { return [] }
  const found = []
  for (const e of entries) {
    if (!e.isDirectory() || e.name.startsWith('.') || e.name === 'node_modules') continue
    if (!e.name.startsWith('dsh-')) continue
    const dir = path.join(ws, e.name)
    let pkg
    try { pkg = JSON.parse(readFileSync(path.join(dir, 'package.json'), 'utf8')) } catch { continue }
    // Only repos that are actually DSH plugins: a `dsh` manifest field, or a DSH peer.
    const isPlugin = pkg.dsh !== undefined
      || Object.keys(pkg.peerDependencies ?? {}).some((n) => n === '@deepseek-ai/dsh' || n.startsWith('@deepseek-ai/dsh-'))
    if (isPlugin) found.push({ dir, pkg })
  }
  return found
}

/** Cross-repo injection points a repo owns. Heuristic, same shapes as K10–K13. */
function injectionPointsOf(dir, pkg) {
  const files = []
  for (const sub of ['src', 'lib']) {
    if (!existsSync(path.join(dir, sub))) continue
    for (const f of findFiles(dir, sub, /\.(mjs|js|cjs|ts|mts|tsx)$/)) files.push(f)
  }
  let text = ''
  for (const f of [...new Set(files)]) {
    try { text += stripComments(readFileSync(f, 'utf8')) + '\n' } catch { /* unreadable */ }
  }
  const grab = (re, group = 1) => {
    const s = new Set()
    for (const m of text.matchAll(re)) s.add(m[group])
    return s
  }
  // Tools: `defineTool({ name: '...' })`. Commands: `ctx.commands.register({ name: '...' })`.
  const tools = new Set()
  for (const m of text.matchAll(/defineTool\s*\(\s*\{/g)) {
    const n = /\bname:\s*['"]([A-Za-z0-9_.-]+)['"]/.exec(text.slice(m.index, m.index + 600))
    if (n) tools.add(n[1])
  }
  const commands = new Set()
  for (const m of text.matchAll(/ctx\.commands\.register\s*\(\s*\{/g)) {
    const n = /\bname:\s*['"]([A-Za-z0-9_.:-]+)['"]/.exec(text.slice(m.index, m.index + 800))
    if (n) commands.add(n[1])
  }
  // Patch insert ids: only `insert:` blocks add rows, and only those can collide.
  const insertIds = new Set()
  for (const pf of ['cordis.patch.yml', 'cordis.patch.yaml']) {
    let raw
    try { raw = readFileSync(path.join(dir, pf), 'utf8') } catch { continue }
    let inInsert = false
    for (const line of raw.replace(/#.*$/gm, '').split(/\r?\n/)) {
      const t = line.trim()
      if (/^-\s*insert:/.test(t)) { inInsert = true; continue }
      if (/^-\s+\S/.test(line)) inInsert = false
      if (!inInsert) continue
      const m = /^-?\s*id:\s*["']?([A-Za-z0-9_.:@/-]+)["']?\s*$/.exec(t)
      if (m) insertIds.add(m[1])
    }
  }
  void pkg
  return {
    services: new Set([
      ...grab(/super\(\s*(?:ctx|this\.ctx)\s*,\s*['"]([A-Za-z0-9_$]+)['"]/g),
      ...grab(/(?:this\.)?ctx\.provide\(\s*['"]([A-Za-z0-9_$]+)['"]/g),
    ]),
    tools,
    commands,
    insertIds,
  }
}
/**
 * Read guard-aware exemptions.
 *
 * A plugin that deliberately keeps a *runtime* first-provider-wins guard still
 * contains the contested name in its source, so a source-only comparison cannot
 * tell it apart from a genuine collision. The author declares the intent instead
 * of the tool guessing:
 *
 *   "dsh-plugin-doctor": {
 *     "crossPlugin": { "exempt": [
 *       { "kind": "service", "name": "roomHub", "peer": "dsh-team-rooms", "guard": "0.9.14" }
 *     ] }
 *   }
 *
 * `guard` records the version in which the stand-down guard landed, so the
 * exemption cannot outlive the code that justified it.
 */
function readCrossPluginExemptions(repoPath) {
  const out = []
  try {
    const pkg = JSON.parse(readFileSync(path.join(repoPath, 'package.json'), 'utf8'))
    const list = pkg['dsh-plugin-doctor']?.crossPlugin?.exempt
    if (Array.isArray(list)) out.push(...list.filter((e) => e && typeof e === 'object'))
  } catch { /* no package.json field */ }
  try {
    const p = path.join(repoPath, CROSS_PLUGIN_FILE)
    if (existsSync(p)) {
      const parsed = parseCrossPluginFile(readFileSync(p, 'utf8'))
      out.push(...parsed)
    }
  } catch { /* malformed sidecar is reported by K14 as no exemption */ }
  return out
}

/**
 * Parse the tiny `dsh-plugin-doctor.yml` sidecar without a YAML dependency
 * (this tool is zero-dependency by contract). Accepts only the
 * `crossPlugin: exempt: - kind/name/peer/guard` list shape and ignores the rest.
 */
function parseCrossPluginFile(text) {
  const out = []
  let inExempt = false
  let cur = null
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, '')
    if (!line.trim()) continue
    const indent = line.match(/^\s*/)[0].length
    const t = line.trim()
    if (/^crossPlugin:\s*$/.test(t)) continue
    if (/^exempt:\s*$/.test(t)) { inExempt = true; continue }
    if (!inExempt) continue
    if (t.startsWith('- ')) {
      if (cur) out.push(cur)
      cur = {}
      const m = /^-\s*([A-Za-z]+):\s*["']?([^"']*)["']?\s*$/.exec(t)
      if (m) cur[m[1]] = m[2].trim()
      continue
    }
    if (cur && indent > 0) {
      const m = /^([A-Za-z]+):\s*["']?([^"']*)["']?\s*$/.exec(t)
      if (m) cur[m[1]] = m[2].trim()
    }
  }
  if (cur) out.push(cur)
  return out
}

/** Whether a declared exemption covers this collision. */
function crossPluginExempt(exemptions, kind, name, peerName) {
  return exemptions.some((e) => e.kind === kind && e.name === name && (e.peer === undefined || e.peer === peerName))
}
