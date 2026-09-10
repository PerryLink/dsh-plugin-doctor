// 工具：临时沙箱 + 子进程执行（输出落盘，规避管道捕获限制）
import { spawnSync } from 'node:child_process'
import {
  mkdtempSync, mkdirSync, renameSync, openSync, closeSync, readFileSync, writeFileSync, existsSync, readdirSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

// 沙箱目录一律建在 %TEMP%，绝不触碰真实 ~/.dsh（红线 3）。
// 前缀用 `doctor-` 而非 `dsh-`：宿主运行目录的保护模板是 %TEMP%\dsh-*（红线 1），
// 用 `dsh-doctor-*` 会与该模板相撞；改名后本工具的自建临时目录不再落在保护模板内。
const SANDBOX_PREFIX = 'doctor-sbx-'
const QUARANTINE_PREFIX = 'doctor-quarantine-'

export function makeSandbox(label) {
  const root = mkdtempSync(path.join(tmpdir(), `${SANDBOX_PREFIX}${label}-`))
  const home = path.join(root, 'home')
  const logs = path.join(root, 'logs')
  mkdirSync(home, { recursive: true })
  mkdirSync(logs, { recursive: true })
  return { root, home, logs }
}

// 清理改为「隔离不删除」（红线 4 三段式的前两段：dry-run 打印 → rename 到隔离目录）。
// 返回隔离后的绝对路径；调用方必须打印它，人工确认后再自行清理。
// 本工具不再有任何 rmSync/rm -rf 路径 —— 旧的 cleanSandbox 已移除。
export function quarantineSandbox(sb) {
  if (!sb || !sb.root || !existsSync(sb.root)) return null
  const dest = path.join(tmpdir(), `${QUARANTINE_PREFIX}${Date.now()}-${path.basename(sb.root)}`)
  try {
    renameSync(sb.root, dest)
    return dest
  } catch {
    return null
  }
}

// 把运行期绝对路径替换为占位符，使 message 可对外复用（R-fix 0C / L1）。
// 只处理"本次运行自己注入的路径"，不做通用脱敏。
export function redact(text, paths = []) {
  let s = String(text ?? '')
  const variants = []
  for (const p of paths) {
    if (!p || typeof p !== 'string') continue
    variants.push(p, p.replace(/\\/g, '/'), p.replace(/\//g, '\\'))
  }
  const tmp = tmpdir()
  variants.push(tmp, tmp.replace(/\\/g, '/'), tmp.replace(/\//g, '\\'))
  for (const v of [...new Set(variants)].sort((a, b) => b.length - a.length)) {
    if (v.length < 4) continue
    s = s.split(v).join('<path>')
  }
  return s
}

// 执行命令：stdout/stderr 分别写入日志文件（不建管道），返回退出码与全文
export function runStep(label, cmd, args, { env = {}, timeout = 120_000, cwd, logDir, shell } = {}) {
  const dir = logDir ?? process.cwd()
  const outPath = path.join(dir, `${label}.out.log`)
  const errPath = path.join(dir, `${label}.err.log`)
  const fdOut = openSync(outPath, 'w')
  const fdErr = openSync(errPath, 'w')
  const res = spawnSync(cmd, args, {
    cwd,
    env: { ...process.env, ...env },
    stdio: ['ignore', fdOut, fdErr],
    timeout,
    windowsHide: true,
    // Windows 下解析 npm.cmd/pnpm.cmd 等 shim 需要 shell；直接调用 node.exe 等真实可执行文件时禁用
    shell: shell ?? process.platform === 'win32',
  })
  closeSync(fdOut)
  closeSync(fdErr)
  const read = (p) => { try { return readFileSync(p, 'utf8') } catch { return '' } }
  return {
    code: res.status,
    signal: res.signal,
    spawnError: res.error ? String(res.error) : null,
    out: read(outPath),
    err: read(errPath),
    outPath,
    errPath,
    ok: res.status === 0 && !res.error,
  }
}

export function tail(text, n = 8) {
  if (!text) return '(无输出)'
  const lines = text.trim().split('\n')
  return lines.slice(-n).join('\n')
}

export const pass = (message) => ({ status: 'pass', message })
export const fail = (message) => ({ status: 'fail', message })
export const warn = (message) => ({ status: 'warn', message })
export const skip = (reason) => ({ status: 'skip', message: reason })
/** 显式不可判：与 skip 同判定，但带 category 以便上游区分「环境不适用」与「确实没跑」 */
export const na = (reason, category = 'not-applicable') => ({ status: 'skip', message: reason, category })
/** 环境类降级：不计 pass、不计插件缺陷，走 category=environment */
export const envskip = (reason) => ({ status: 'skip', message: reason, category: 'environment' })

export function readJson(p) {
  return JSON.parse(readFileSync(p, 'utf8'))
}

export function exists(p) {
  return existsSync(p)
}

export function writeJson(p, obj) {
  writeFileSync(p, JSON.stringify(obj, null, 2) + '\n', 'utf8')
}

// 递归收集目录下匹配文件（跳过 node_modules/lib/dist 等构建产物）
export function findFiles(dir, sub, re, out = []) {
  const base = path.join(dir, sub)
  if (!existsSync(base)) return out
  for (const entry of readdirSync(base, { withFileTypes: true })) {
    if (['node_modules', 'lib', 'dist', '.git'].includes(entry.name)) continue
    const p = path.join(base, entry.name)
    if (entry.isDirectory()) findFiles(dir, path.join(sub, entry.name), re, out)
    else if (re.test(entry.name)) out.push(p)
  }
  return out
}
