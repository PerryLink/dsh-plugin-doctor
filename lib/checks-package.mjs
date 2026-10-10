// 静态·包结构检查（R0–R8）
// 依据：deepseek-harness publish.md / apps/cli/src/plugin.ts（2026-09-07 调研）+
// PerryLink 工作区双基线约定（AGENTS.md）
//
// ⚠ 路径解析（入口 / patch / files 覆盖）**统一走 lib/manifest-paths.mjs**。
// 红队 A16 实测：每个检查各写一份近似解析，会互相矛盾并制造连锁假红 ——
// R1 不认数组形态的 `dsh.bundle.patch` 一次派生 4 条 fail；R2/R4 的
// `main ?? exports…` 与 Node 的优先级相反（有 exports 时 main 被忽略）。
import path from 'node:path'
import { readFileSync, existsSync } from 'node:fs'
import { runStep, pass, fail, warn, skip, envskip, tail, findFiles } from './util.mjs'
import {
  bundlePatchPaths, resolveEntry, normalizeEntry as resolveEntryPath, filesCovers, unbuiltReason, isFile,
} from './manifest-paths.mjs'

export const GROUP = '静态·包结构'

const stripDot = (p) => String(p ?? '').replace(/^\.\//, '')
const normalizeEntry = (pkg) => resolveEntryPath(pkg)

// Directories that hold BUILD OUTPUT in this ecosystem.
const BUILD_DIRS = ['lib', 'dist', 'build', 'out', 'esm', 'cjs']

export function addChecks(doctor, ctx) {
  const { repoPath, pkg, pkgName } = ctx

  /** 声明的 patch 文件列表（null = 未声明 / 形态非法）。全组共用这一处解析。 */
  const declaredPatches = () => bundlePatchPaths(pkg.dsh?.bundle?.patch)

  /** TS/JS 源码文件（供"未构建源码树"判定与入口兜底）。 */
  const tsSources = () => findFiles(repoPath, 'src', /\.(ts|mts|cts|tsx)$/)

  /**
   * R2/R4 read BUILT artifacts (the entry named by exports/main). On a source tree
   * that ships no build output -- which is most third-party repositories, and every
   * clone that has not been built -- the entry is absent by construction.
   *
   * This is an environment fact, not a plugin defect. Reporting it as
   * `plugin-defect` once made 4 of 15 family repositories look broken, and the
   * label is actively misleading: the tool's own output told a maintainer their
   * plugin was defective when they had simply not run `npm run build`.
   *
   * 判据已按红队实测放宽（旧实现只在入口落在 lib/dist/... 时才降级，
   * 于是 `main:"index.js"` + tsc 的仓被判"入口不存在"）：现在只看事实 ——
   * 入口文件不存在、且本包确实有构建步骤或 TS 源码、且入口能找到同名源码
   * 或本身就是 .ts ⇒ 未构建源码树。反例（入口指向根本不存在的源码）仍 fail。
   *
   * Declared inside addChecks because it closes over repoPath and pkg.
   *
   * @returns {null | { status: 'skip', message: string, category: string }}
   */
  const unbuiltTree = () => {
    const { entry } = resolveEntry(pkg)
    const reason = unbuiltReason({
      repoPath, pkg, entry, tsSources: tsSources(), buildCmd: String(pkg.scripts?.build ?? ''),
    })
    return reason ? envskip(reason) : null
  }

  /** The build command this package declares, if any. */
  const buildCmd = () => String(pkg.scripts?.build ?? '')

  /**
   * Whether this package genuinely needs a build step before publication.
   *
   * It does when it declares a `build` script, or when it ships TypeScript
   * sources that the declared entry does not correspond to — the harness docs
   * are explicit that a git install fetches sources and never runs `build`, so
   * a TypeScript package must be prebuilt (publish.md:167).
   *
   * A plain-JavaScript package that points `main` at its own `src/` does NOT
   * need building; that is a normal, working layout.
   */
  const needsBuild = () => {
    if (buildCmd().trim()) return true
    const entry = normalizeEntry(pkg)
    if (/\.(ts|mts|cts|tsx)$/.test(entry)) return true
    const tsSources = findFiles(repoPath, 'src', /\.(ts|mts|cts|tsx)$/)
    return tsSources.length > 0
  }

  doctor.add(GROUP, 'R0 基础字段（name/version/license/README/type）', () => {
    const problems = []
    if (!pkg.name) problems.push('缺 name')
    if (!pkg.version) problems.push('缺 version')
    if (!pkg.license) problems.push('缺 license（SPDX）')
    if (!existsSync(path.join(repoPath, 'README.md'))) problems.push('缺 README.md')
    const hasLicenseFile = ['LICENSE', 'LICENSE.md', 'LICENSE.txt'].some((f) => existsSync(path.join(repoPath, f)))
    if (!hasLicenseFile) problems.push('缺 LICENSE 文件')
    if (!pkg.type) problems.push('未声明 type（官方范式 "module"）')
    if (problems.length) return warn(problems.join('；'))
    return pass('基础字段齐全')
  })

  doctor.add(GROUP, 'R1 激活门 dsh.bundle.patch', () => {
    const raw = pkg.dsh?.bundle?.patch
    if (raw === undefined) {
      return fail(
        'package.json 缺少 dsh.bundle.patch —— 该包安装后只会作为普通依赖，宿主永远不会把它加入 dsh.profile.bundles（最静默的失败模式）',
      )
    }
    const list = declaredPatches()
    if (list === null) {
      // 官方只接受 `string | string[]`（dsh-app-boot: bundlePatchFiles）。
      // 旧实现只认字符串，把**合法的数组形态**判成 critical fail，并连锁派生
      // R2/R3/R7 三条假红（红队 A16 用 fixture 实测）。这里必须区分"没写"与"写错"。
      return fail(
        `dsh.bundle.patch 形态非法：${JSON.stringify(raw)}\n`
        + '官方契约（dsh-app-boot 的 bundlePatchFiles）只接受"一个文件路径，或一组有序文件路径"：\n'
        + '  "dsh": { "bundle": { "patch": "./cordis.patch.yml" } }\n'
        + '  "dsh": { "bundle": { "patch": ["./a.yml", "./b.yml"] } }\n'
        + '其它形态（对象、数字、空串、含空项的数组）会让宿主在加载该 bundle 时抛 '
        + '`dsh.bundle.patch must be a file path or a list of file paths`。',
      )
    }
    return pass(`dsh.bundle.patch = ${list.length > 1 ? JSON.stringify(list) : list[0]}${list.length > 1 ? `（${list.length} 个文件，按序应用）` : ''}`)
  }, { critical: true })

  doctor.add(GROUP, 'R2 tarball 完整性（npm pack --dry-run）', () => {
    const unbuilt = unbuiltTree()
    if (unbuilt) return unbuilt
    const r = runStep('r2-pack', 'npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], { cwd: repoPath, logDir: ctx.logDir, timeout: 300_000 })
    if (!r.ok) return fail(`npm pack 失败（exit ${r.code}）:\n${tail(r.err)}`)
    let pack
    try {
      const json = r.out.replace(/^\uFEFF/, '').trim()
      pack = JSON.parse(json.slice(json.indexOf('['), json.lastIndexOf(']') + 1))[0]
    } catch {
      return fail('npm pack --json 输出解析失败')
    }
    const files = pack.files ?? []
    const paths = files.map((f) => f.path)
    const problems = []
    const patches = (declaredPatches() ?? []).map(stripDot)
    const { entry } = resolveEntry(pkg)
    for (const patch of patches) {
      if (!paths.includes(patch)) problems.push(`patch 文件 ${patch} 不在 tarball（files 白名单未覆盖？）`)
    }
    if (entry && !paths.some((f) => f === entry)) problems.push(`入口 ${entry} 不在 tarball`)
    for (const need of [...patches, entry]) {
      const hit = files.find((f) => f.path === need)
      if (hit && Number(hit.size ?? 0) === 0) problems.push(`${need} 为空文件`)
    }
    const expected = `${pkgName.replace(/^@/, '').replace('/', '-')}-${pkg.version}.tgz`
    if (pack.filename && pack.filename !== expected) problems.push(`tarball 名 ${pack.filename} ≠ 期望 ${expected}`)
    if (problems.length) return fail(problems.join('\n'))
    return pass(`tarball ${pack.filename} 含入口与 patch（共 ${files.length} 个文件）`)
  })

  doctor.add(GROUP, 'R3 cordis.patch.yml 结构（启发式）', () => {
    const patches = (declaredPatches() ?? []).map(stripDot)
    if (!patches.length) return skip('无 dsh.bundle.patch')
    // 逐个 patch 文件检查（官方允许数组，按序应用；任何一个坏掉都会让 bundle 加载失败）
    const problems = []
    const notes = []
    for (const patch of patches) {
      const p = path.resolve(repoPath, patch)
      if (!isFile(p)) {
        problems.push(`${patch}: ${existsSync(p) ? '是目录而不是文件' : '文件不存在'}`)
        continue
      }
      const text = readFileSync(p, 'utf8')
      // YAML 注释行剔除后再做启发式（示例配置注释里常出现 name: xxx）
      const active = text.split(/\r?\n/).filter((l) => !/^\s*#/.test(l)).join('\n')

      // 空 patch 文档是合法的，不是缺陷：官方 patch schema 是
      // `entryListSchema = yaml.JSON_SCHEMA.extend(JsExpr)`（vendor/include/src/index.ts:23），
      // 即一个数组；且 harness 自己生成新 profile 时用的模板就是 `[]`
      // （packages/boot/app-boot/src/profile.ts:193-197，注释写明
      // "a top-level YAML array of loader patch entries"）。
      // 一个不挂载任何行的组合包（纯库、只为走 bundle 通道）因此是正当形态。
      // 旧实现要求每个 patch 都必须有 insert 结构与 id 行，把这种合法包判成 fail。
      const body = active.replace(/[\[\],]/g, '').trim()
      if (!body) continue

      if (!/-\s+insert\s*:/.test(active)) problems.push(`${patch}: 未找到 "- insert:" 结构`)
      const ids = [...active.matchAll(/(?:^|\n)\s*-?\s*id:\s*["']?([^"'\s]+)/g)].map((m) => m[1])
      if (!ids.length) problems.push(`${patch}: 未找到 id 行（行 id 必须存在，供上层整行替换定位）`)
      // ⚠ `name` 不必等于本包名：官方 dsh-base 的行 name 指向别的包
      // （如 `@deepseek-ai/dsh-plugin-manager/tools`），一个 bundle 组合多个包是正当形态。
      // 旧实现要求每个 name 都等于/前缀于本包名，对多包 bundle 是错的（红队 A16 实测）。
      // 因此降为 note，并且只在"看起来像笔误"时提示。
      const names = [...active.matchAll(/(?:^|\n)\s*name:\s*["']?([^"'\s,]+)|[,\s]name:\s*["']?([^"'\s,]+)/g)]
        .map((m) => m[1] ?? m[2]).filter(Boolean)
      const foreign = [...new Set(names.filter((n) => n !== pkgName && !n.startsWith(`${pkgName}/`)))]
      if (foreign.length) {
        notes.push(`${patch}: patch 行 name 里有 ${foreign.length} 个不属于本包的模块（${foreign.slice(0, 3).join(', ')}${foreign.length > 3 ? ' …' : ''}）—— 若本包是组合包（bundle）则属正常；若只是笔误，宿主解析不到会抛 "cannot resolve profile bundle ..."`)
      }
    }
    if (problems.length) return fail(problems.join('\n'))
    if (notes.length) return warn(notes.join('\n'))
    // pass 只陈述**本项真正判过的事实**。旧文案宣称 "name 与包名一致"，
    // 但那条判据已改成 note（组合包的行 name 指向别的包是合法的）——
    // 在 pass 里复述一条不存在的判据，会让多包 bundle 的作者去改正当的 name。
    return pass(
      `解析到 insert 结构、${patches.length} 个 patch 文件、${[...new Set(
        patches.flatMap((rel) => {
          try {
            return [...readFileSync(path.resolve(repoPath, rel), 'utf8')
              .split(/\r?\n/).filter((l) => !/^\s*#/.test(l)).join('\n')
              .matchAll(/(?:^|\n)\s*-?\s*id:\s*["']?([^"'\s]+)/g)].map((m) => m[1])
          } catch { return [] }
        }),
      )].length} 个 id（启发式；以 D2 --dump-config 为准）`,
    )
  })

  doctor.add(GROUP, 'R4 入口契约（name/apply 导出 + inject 字面量）', () => {
    const resolved = resolveEntry(pkg)
    const entry = resolved.entry
    if (resolved.exportsBlocked) {
      return fail(
        'package.json 声明了 `exports` 但**没有导出包根 `"."`** —— Node 无法把该包当作入口导入'
        + '（cordis Loader 也是用 `import(name)` 装载），因此这一行永远挂不上。\n'
        + `当前 exports = ${JSON.stringify(pkg.exports)}\n`
        + '修法：加上 `"exports": { ".": "./<入口文件>" }`（同时保留你需要暴露的子路径）。',
      )
    }
    const entryAbs = path.resolve(repoPath, entry)
    if (!isFile(entryAbs)) {
      // An absent build output on an unbuilt tree is an environment fact, not a
      // defect. Only a genuinely wrong entry declaration should fail here.
      const unbuilt = unbuiltTree()
      if (unbuilt) return unbuilt
      // ⚠ 文案不能说"需先 pnpm run build"：走到这里恰恰是**已经排除了未构建源码树**
      // 的情形（unbuiltTree 返回 null），所以这是入口声明本身的问题，
      // 让作者去跑一遍构建是白跑一轮（而且 pnpm 未必是他的工具）。
      const src = resolveEntry(pkg)
      return fail(
        `入口文件 ${entry} 不存在，且这不是"尚未构建"的情形（files 未覆盖它，或找不到对应源码）`
        + `—— 属**入口声明问题**。\n`
        + `当前解析依据：${src.source === 'exports' ? '`exports`（有 exports 时 Node 会忽略 `main`）' : src.source === 'main' ? '`main`' : '默认值 `index.js`'}\n`
        + `修法：让入口指向一个**会随包发布**的文件（构建产物要预构建、并写进 files[]）。`,
      )
    }
    const src = readFileSync(entryAbs, 'utf8')
    const hasApply = /exports\s*\.\s*apply|module\.exports\s*=\s*\{[\s\S]{0,400}\bapply\b|export\s+(?:const|function)\s+apply/.test(src)
    const hasName = /exports\s*\.\s*name|module\.exports\s*=\s*\{[\s\S]{0,400}\bname\b|export\s+const\s+name/.test(src)
    const problems = []
    if (!hasApply) problems.push('入口未检出 apply 导出')
    if (!hasName) problems.push('入口未检出 name 导出')
    // TS 源兜底（入口是编译产物时）
    const srcFiles = findFiles(repoPath, 'src', /\.(ts|mts|tsx|mjs|js)$/)
    const srcText = srcFiles.map((f) => { try { return readFileSync(f, 'utf8') } catch { return '' } }).join('\n')
    if (!hasApply && /export\s+(?:const|function)\s+apply|apply\s*\(ctx/.test(srcText)) {
      problems.splice(problems.indexOf('入口未检出 apply 导出'), 1)
    }
    if (!hasName && /export\s+const\s+name\b/.test(srcText)) {
      problems.splice(problems.indexOf('入口未检出 name 导出'), 1)
    }
    const injectDecl = srcText.match(/(?:export\s+)?(?:const\s+)?inject\s*[:=]\s*\[([^\]]*)\]/)
    if (injectDecl) {
      const inner = injectDecl[1].trim()
      const junk = inner.replace(/['"][^'"]*['"]/g, '').replace(/[\s,]/g, '')
      if (junk) problems.push(`inject 数组含非字符串字面量: [${inner}]`)
    }
    if (problems.length) return warn(problems.join('\n') + '\n（启发式扫描；若为 default 对象/class 形式请人工确认）')
    return pass(`入口 ${entry} 检出 name/apply 导出${injectDecl ? '，inject 为字符串数组' : ''}`)
  })

  doctor.add(GROUP, 'R5 依赖口径（rescope cordis / 禁裸上游名）', () => {
    const problems = []
    for (const field of ['dependencies', 'peerDependencies', 'devDependencies']) {
      const deps = pkg[field] ?? {}
      if ('cordis' in deps) problems.push(`${field} 出现裸 cordis@${deps.cordis}（应使用 rescope @deepseek-ai/cordis）`)
      if ('schemastery' in deps) problems.push(`${field} 出现裸 schemastery@${deps.schemastery}（应使用 @deepseek-ai/schemastery）`)
    }
    const peer = pkg.peerDependencies?.['@deepseek-ai/cordis']
    const dep = pkg.dependencies?.['@deepseek-ai/cordis']
    const srcFiles = findFiles(repoPath, 'src', /\.(ts|mts|tsx|mjs|js)$/)
    const importsCordis = srcFiles.some((f) => { try { return /from\s+['"]@deepseek-ai\/cordis['"]|require\(['"]@deepseek-ai\/cordis['"]\)/.test(readFileSync(f, 'utf8')) } catch { return false } })
    if (!peer && !dep) {
      if (importsCordis) problems.push('源码 import @deepseek-ai/cordis 但未声明任何依赖')
      // R-fix 0A / P7：无源文件时旧实现直接 pass（真·静默通过，连 skip 痕迹都不留），而 R5 属被门禁的 16 项之一。
      else if (srcFiles.length) return pass('未声明 @deepseek-ai/cordis 且源码无 import（纯 JS 仓可无 cordis 运行时依赖）')
      else return skip('无源文件可判（无 src/ 且未声明 @deepseek-ai/cordis）——不计 pass')
    } else if (!peer) {
      problems.push('@deepseek-ai/cordis 只在 dependencies（官方口径：peerDependencies + devDependencies 同时声明）')
    }
    if (pkg.dependencies?.['@deepseek-ai/dsh']) problems.push('dependencies 直接依赖 @deepseek-ai/dsh（宿主已提供，应走 peer/dev 口径）')
    if (problems.length) return fail(problems.join('\n'))
    return pass(`cordis 口径正确（${peer ?? dep}）`)
  })

  doctor.add(GROUP, 'R6 Node 引擎声明', () => {
    const e = pkg.engines?.node
    if (!e) return warn('未声明 engines.node（建议 "^22.19.0 || >=24.0.0"；npm 线宿主不强制，属建议门）')
    const only23 = /23/.test(e) && !/22/.test(e) && !/24/.test(e) && !/>=\s*2[5-9]/.test(e)
    if (only23) return fail(`engines.node=${e} 宣称 Node 23（官方整线排除 23，要求 ^22.19.0 || >=24.0.0）`)
    if (/22\.19/.test(e) && /24/.test(e)) return pass(`engines.node=${e} 与官方 ^22.19.0 || >=24.0.0 一致`)
    return warn(`engines.node=${e} 与官方 ^22.19.0 || >=24.0.0 的相交性请人工确认`)
  })

  doctor.add(GROUP, 'R7 预构建与 files 覆盖', () => {
    const { entry } = resolveEntry(pkg)
    const problems = []
    // "main 指向 src/" 只有在确实需要构建时才是缺陷。
    // 官方口径（docs/user/develop/basic/publish.md:167）：git 安装取的是源码、
    // 不跑 build，所以 **TypeScript** 包必须预构建或提供 prepare。纯 JS 包直接
    // 发布源码完全正常 —— 该文档自己的示例入口就是 "index.js"（:40），不在 lib/ 下；
    // :181-183 也把「发布构建产物」作为「不想要求用户授权构建」之外的一种选择，而非义务。
    // 旧实现一律拒绝 src/ 入口，把 dsh-cert-mcp 这类零构建的纯 JS MCP server 判成 fail。
    if (entry && entry.includes('src/') && needsBuild()) {
      problems.push(`入口指向源码 ${entry}，而本包有构建步骤（${buildCmd()}）——npm 发布应指向构建产物`)
    }
    const filesField = pkg.files
    if (Array.isArray(filesField) && filesField.length) {
      // files 支持 glob（红队实测 5 个仓用 `README*.md` / `locale/*.json` / `lib/types/**/*.d.ts`），
      // 纯粹的前缀比较会把它们判错 ⇒ 统一走 manifest-paths 的 filesCovers。
      if (entry && !filesCovers(filesField, entry)) problems.push(`files 白名单未覆盖入口 ${entry}`)
      for (const patch of (declaredPatches() ?? []).map(stripDot)) {
        if (!filesCovers(filesField, patch)) problems.push(`files 白名单未覆盖 patch：${patch}`)
      }
    } else {
      problems.push('未声明 files 白名单')
    }
    const note = pkg.scripts?.prepare ? '（含 prepare 脚本，支持 git 直装自构建）' : '（无 prepare，git 直装不可用，npm/tarball 不受影响）'
    if (problems.length) return fail(problems.join('\n') + '\n' + note)
    // The pass message has to describe THIS package, not the rule in general:
    // saying "main points at build output" when it points at a no-build src/ is
    // the same kind of untrue statement the criteria exist to catch.
    const entryKind = !entry ? '（无入口声明）' : entry.includes('src/') ? '源码入口（本包无需构建）' : '构建产物'
    return pass(`入口指向${entryKind}，files 覆盖入口与 patch ${note}`)
  })

  doctor.add(GROUP, 'R8 peer 范围旧 rc 残留（双基线教训）', () => {
    const peers = Object.entries(pkg.peerDependencies ?? {})
      .filter(([k]) => k.startsWith('@deepseek-ai/dsh') || k === 'cordis' || k.startsWith('@deepseek-ai/cordis'))
    if (!peers.length) return skip('无 dsh 相关 peer 声明')
    const problems = []
    const notes = []
    for (const [k, v] of peers) {
      const s = String(v)
      // Enumerating two literals (0.1.0-rc.8 / 0.1.1-rc.2) only caught the shapes
      // that happened to exist on 2026-09-05; every other old line slipped through.
      // Match the whole old-line family instead.
      if (/(0\.1\.0-rc\.|0\.1\.1-rc\.|0\.1\.2-alpha\.|0\.1\.3-alpha\.)/.test(s)) problems.push(`${k}: ${s} 含旧 rc/alpha 版本（早于 peer 执法起点 dsh-v0.1.7-rc.1 的写法）`)
      // A single-arm prerelease-tuple range admits only the one prerelease it
      // names: `>=0.1.2-rc.1 <0.2.0` (no `||`) rejects 0.1.5-rc.1 — exactly the
      // false green the OR form exists to fix.
      //
      // Reported as a NOTE, not a failure, because the check cannot tell the two
      // cases apart offline:
      //   - an arm naming a SUPERSEDED line is the trap above, and
      //   - an arm naming the CURRENT line (>=0.1.7-alpha.1) is a deliberate
      //     target. It still excludes whatever line is `latest`, so the plugin
      //     will not install against the stable host — a real consequence worth
      //     saying — but it is a choice about which host to support, not a defect
      //     and not silent.
      // Failing the second case turns a legitimate choice into a red CI run, and
      // did: dsh-ticktick's gate went from PASS on 0.1.6 to FAIL on 0.3.1 for
      // exactly this, over a rule added after its ranges were written.
      if (!s.includes('||') && /^>=\s*0\.1\.\d+-[0-9A-Za-z.]+/.test(s) && /<\s*0\.2\.0/.test(s)) {
        notes.push(`${k}: ${s} 是单臂 prerelease-tuple 区间，只放行它点名的那条预发布线，因此排除了当前 latest 宿主线。若这是刻意只支持新线，可忽略。`)
      }
      // An open-top `>=` comparator has NO upper bound at all: `>=0.1.0-rc.1`
      // admits 0.5.0, 1.0.0 and anything later. `^0.1.0-rc.1` does NOT have this
      // problem — caret is semver sugar for `>=0.1.0-rc.1 <0.2.0`, so it is bounded
      // even though the string contains no `<`. 14 of 22 third-party repositories
      // sampled on 2026-09-24 use the caret form, so this separates a real defect
      // from the ecosystem's normal convention instead of flagging both.
      //
      // A separate `if`, not an `else if`: a range can be both stale AND open-top
      // (`>=0.1.0-rc.1` is), and the second is the more consequential of the two.
      //
      // A NOTE rather than a failure, for the same reason as the single-arm case:
      // whether a deliberately open range is wrong depends on the host's release
      // policy, which this check cannot see offline. It is worth saying because the
      // failure it predicts is silent — a breaking host line is accepted by the
      // range and the plugin loads against an API it never tested.
      if (/^>=\s*[0-9]/.test(s) && !s.includes('<')) {
        notes.push(`${k}: ${s} 是 open-top 区间（>= 且无上界），会放行 0.5.0 / 1.0.0 等未来主线。若想跟随预发布线但不跟随破坏性升级，写成 ^${s.replace(/^>=\s*/, '').trim()} 或补上 <0.2.0`)
      }
    }
    if (problems.length) {
      // Severity is FAIL because the exit code is the contract and 42 downstream
      // gates already read it — but the *meaning* is narrower than "your plugin
      // is broken", and the message has to say so. A peer pinned to an older rc
      // line is a working package that has fallen behind this family's release
      // train; it is staleness, not a defect. SPEC.md §4.1/R8 and §5.4 are where
      // that distinction is normative, and a third-party repository reading this
      // output should not conclude it is broken.
      return {
        ...fail(
          ['这是**策略陈旧**，不是插件缺陷 —— pin 的 rc 线早于 peer 执法起点（dsh-v0.1.7-rc.1）。'
            + '但**后果不是无害的**：区间与用户实际在跑的宿主线不相交时，宿主 preflight 会把这一行静默 '
            + '`disabled`，用户看到"装上了但没反应"。（判定为 fail 是因为退出码是既有契约，'
            + '42 个下游门禁在读它；语义边界见 SPEC.md §4.1/R8 与 §5.4。）',
          ...problems,
          // A failure must not swallow the notes. `>=0.1.0-rc.1` is both stale and
          // open-top, and open-top is the more consequential of the two; reporting
          // only the staleness would let a repository fix the cosmetic problem and
          // keep the one that admits a breaking host line.
          ...(notes.length ? ['—— 另有与陈旧无关的区间问题：', ...notes] : []),
          // ⚠ 本项**不再给"统一区间"的推荐值**。旧文案在 2026-10-07 被实测证伪：
          //   它推荐的 `>=0.1.2-rc.1 <0.2.0 || >=0.1.5-alpha.1 <0.2.0` 在 0.2.1-alpha.1 上
          //   一条都不满足 ⇒ 照它改的插件会被宿主 preflight 静默 disabled（不是装不上，
          //   是"装上了完全没反应"）。"该改成什么区间"是 X1 的职责 —— X1 直接 import
          //   宿主自己的 app-boot 判决器，结论与宿主逐字节同源；本项只管"是否陈旧"。
          '—— "区间该改成什么"请看同一份报告里的 X1。'].join('\n'),
        ),
        // Also `policy`: the penalty is real, but the message says in its first line
        // that this is not a plugin defect. Filing it as one made the report disagree
        // with itself, which is what §3.3's `policy` category exists to prevent.
        category: 'policy',
      }
    }
    if (notes.length) {
      // `warn` would otherwise default to category `plugin-defect`, which
      // contradicts the message: both of these are deliberate range conventions,
      // not defects. SPEC.md §3.3 defines `policy` for exactly this, and §5.4 note 4
      // already says R5 and R8 encode policy rather than correctness.
      return { ...warn(['区间写法值得确认——两者都是**选择**而非缺陷，故不判失败：', ...notes].join('\n')), category: 'policy' }
    }
    return pass(peers.map(([k, v]) => `${k} ${v}`).join('；'))
  })
}
