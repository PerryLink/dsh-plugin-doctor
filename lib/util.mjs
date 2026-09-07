// 工具：临时 DSH_HOME 沙箱 + 子进程执行（输出落盘，规避管道捕获限制）
import { spawnSync } from 'node:child_process'
import {
  mkdtempSync, mkdirSync, rmSync, openSync, closeSync, readFileSync, writeFileSync, existsSync, readdirSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

// 沙箱目录一律建在 %TEMP%，绝不触碰真实 ~/.dsh（红线 3）
export function makeSandbox(label) {
  const root = mkdtempSync(path.join(tmpdir(), `dsh-doctor-${label}-`))
  const home = path.join(root, 'home')
  const logs = path.join(root, 'logs')
  mkdirSync(home, { recursive: true })
  mkdirSync(logs, { recursive: true })
  return { root, home, logs }
}

export function cleanSandbox(sb) {
  if (sb && sb.root) {
    try { rmSync(sb.root, { recursive: true, force: true }) } catch {}
  }
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
