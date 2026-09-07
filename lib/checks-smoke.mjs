// 动态·沙箱冒烟（D0–D3 + 清场）
// 依据：dsh compat.yml 正典配方（MISSING_CREDENTIAL 判据）+ 2026-09-07 harness 调研 +
// 工作区红线 3（一切测试全沙箱：%TEMP% mkdtemp DSH_HOME）
import path from 'node:path'
import { makeSandbox, cleanSandbox, runStep, pass, fail, skip, tail, readJson, writeJson, exists } from './util.mjs'

export const GROUP = '动态·沙箱冒烟'

export function addSmokeChecks(doctor, ctx, opts = {}) {
  const { repoPath, pkgName, logDir } = ctx
  const dshVersion = opts.dshVersion ?? '0.1.2-rc.1'
  const state = {}

  doctor.add(GROUP, 'D0 打包 tarball（npm pack）', () => {
    state.sb = makeSandbox('smoke')
    const r = runStep('d0-pack', 'npm', ['pack', '--json', '--ignore-scripts'], { cwd: repoPath, logDir, timeout: 300_000 })
    if (!r.ok) return fail(`npm pack 失败（exit ${r.code}）:\n${tail(r.err)}`)
    let pack
    try {
      const json = r.out.replace(/^\uFEFF/, '').trim()
      pack = JSON.parse(json.slice(json.indexOf('['), json.lastIndexOf(']') + 1))[0]
    } catch {
      return fail('npm pack --json 解析失败')
    }
    state.tgz = path.join(repoPath, pack.filename)
    if (!exists(state.tgz)) return fail(`tarball 未生成: ${state.tgz}`)
    return pass(`已打包 ${pack.filename}（${pack.files?.length ?? '?'} 文件）`)
  })

  doctor.add(GROUP, 'D1 安装冒烟（plugin add + bundles 断言）', () => {
    if (!state.tgz) return skip('D0 未通过')
    writeJson(path.join(state.sb.root, 'package.json'), { name: 'dsh-doctor-runtime', version: '0.0.0', private: true })
    const i = runStep('d1-install', 'npm', ['install', '--no-audit', '--no-fund', '--loglevel=error', `@deepseek-ai/dsh@${dshVersion}`], {
      cwd: state.sb.root, logDir, timeout: 900_000,
    })
    if (!i.ok) return fail(`安装 @deepseek-ai/dsh@${dshVersion} 失败（exit ${i.code}）:\n${tail(i.err)}`)
    const hostPkgPath = path.join(state.sb.root, 'node_modules', '@deepseek-ai', 'dsh', 'package.json')
    if (!exists(hostPkgPath)) return fail('@deepseek-ai/dsh 未安装成功')
    const host = readJson(hostPkgPath)
    const rel = host.bin?.dsh
    const bin = rel ? path.resolve(state.sb.root, 'node_modules', '@deepseek-ai', 'dsh', rel) : null
    if (!bin || !exists(bin)) return fail(`未找到 dsh bin（package.json bin=${JSON.stringify(host.bin)}）`)
    state.bin = bin
    const dsh = (label, args, o = {}) => runStep(label, process.execPath, [bin, ...args], {
      env: { DSH_HOME: state.sb.home, DSH_AGENTS_HOME: path.join(state.sb.home, '.agents'), ...(o.env ?? {}) },
      cwd: state.sb.root, logDir, timeout: o.timeout ?? 120_000, shell: false,
    })
    state.dsh = dsh
    const a = dsh('d1-add', ['plugin', '--profile', 'headless', 'add', state.tgz], { timeout: 900_000 })
    const envBlock = /ERR_PNPM_IGNORED_BUILDS|approve-builds|ignored builds/i.test(a.err)
    if (!a.ok) {
      if (envBlock) {
        return warn(`pnpm approve-builds/ignored-builds 环境门阻断（属环境配方问题，非插件缺陷，参照 compat.yml allowBuilds 配方）:\n${tail(a.err)}`)
      }
      return fail(`plugin add 失败（exit ${a.code}）:\n${tail(a.err)}`)
    }
    if (/declares no dsh\.bundle|not activated/i.test(a.err)) return fail('宿主 stderr 出现未激活警告（dsh.bundle 声明未被识别）')
    const profilePkgPath = path.join(state.sb.home, 'profiles', 'headless', 'package.json')
    if (!exists(profilePkgPath)) return fail('profile package.json 未生成')
    const profilePkg = readJson(profilePkgPath)
    const bundles = profilePkg?.dsh?.profile?.bundles ?? []
    if (!bundles.includes(pkgName)) return fail(`dsh.profile.bundles 不含 ${pkgName}（实际: ${JSON.stringify(bundles)}）`)
    return pass(`已加入 dsh.profile.bundles: ${bundles.join(', ')}`)
  })

  doctor.add(GROUP, 'D2 层验证（--dump-config，不 boot）', () => {
    if (!state.dsh) return skip('D1 未通过')
    const r = state.dsh('d2-dump', ['--profile', 'headless', '--dump-config'], { timeout: 120_000 })
    if (!r.ok) return fail(`--dump-config 失败（exit ${r.code}）:\n${tail(r.err)}`)
    if (!r.out.includes(`# == ${pkgName}`)) return fail(`dump-config 未见层标记 "# == ${pkgName}"`)
    return pass(`层标记 "# == ${pkgName}" 出现（patch 已进入组合层）`)
  })

  doctor.add(GROUP, 'D3 keyless headless 冒烟（MISSING_CREDENTIAL 判据）', () => {
    if (!state.dsh) return skip('D1 未通过')
    const r = state.dsh('d3-run', ['--profile', 'headless', 'Reply with exactly: ok'], { timeout: 90_000 })
    const combined = `${r.out}\n${r.err}`
    if (r.signal || r.spawnError) return fail(`进程异常终止（signal=${r.signal}${r.spawnError ? ' ' + r.spawnError : ''}）`)
    const bad = combined.match(/.*(NO_ADAPTER|ERR_MODULE_NOT_FOUND|SyntaxError|TypeError|ReferenceError|Cannot find module).*/g)
    if (bad) return fail(`组合未 boot 到请求阶段，出现致命错误:\n${bad.slice(0, 5).join('\n')}`)
    if (r.code === 1 && /dsh:\s*MISSING_CREDENTIAL/.test(combined)) {
      return pass('exit 1 + dsh: MISSING_CREDENTIAL —— bundle 层生效、插件 apply 成功、组合到达模型请求阶段（严格匹配 code，防正则假阳性）')
    }
    if (r.code === 0) return pass('exit 0（环境中存在凭据，完整跑通）')
    return fail(`期望 exit 1 + MISSING_CREDENTIAL，实际 exit ${r.code}:\n${tail(combined)}`)
  })

  doctor.add(GROUP, 'D9 沙箱清理', () => {
    const wasRun = !!state.sb
    cleanSandbox(state.sb)
    return pass(wasRun ? '临时 DSH_HOME 沙箱已删除（%TEMP% mkdtemp）' : '未创建沙箱')
  })
}
