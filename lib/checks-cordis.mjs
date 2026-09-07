// 静态·cordis 契约扫描（K1–K9，启发式）
// 依据：cordiverse/cordis v4 源码契约 + DSH 官方 cordis 文档（2026-09-07 调研）：
//  - apply 可同步，亦可 async 返回 Promise<disposer>；返回非法形状抛 TypeError('Invalid effect')
//  - inject 硬依赖 = (keyof M)[] | { name?: interceptConfig }；可选依赖走 ctx.get(name)
//  - v4 删除 v3 的 fork/reusable/using/scope/runtime/lifecycle/config/collect/accept/decline/alias/off
//  - ctx 活数据不可 JSON.stringify/structuredClone/展开
import path from 'node:path'
import { readFileSync, readdirSync } from 'node:fs'
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

// 源文件发现策略：src/** + 根目录一层 JS/TS；纯 JS 仓（无 build 脚本且 main 指向 lib/）的 lib 即源码
function collectSourceFiles(ctx) {
  const { repoPath, pkg } = ctx
  const files = findFiles(repoPath, 'src', /\.(ts|mts|tsx|mjs|js)$/)
  for (const entry of readdirSync(repoPath, { withFileTypes: true })) {
    if (!entry.isFile()) continue
    if (/\.(mjs|js|cjs|ts|mts|cts)$/.test(entry.name)) files.push(path.join(repoPath, entry.name))
  }
  if (!pkg.scripts?.build && String(pkg.main ?? '').startsWith('lib/')) {
    files.push(...findFiles(repoPath, 'lib', /\.(mjs|js|cjs)$/))
  }
  return [...new Set(files)]
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
}
