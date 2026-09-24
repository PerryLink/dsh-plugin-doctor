## dsh-plugin-doctor · DSH 插件的零依赖核验标准

**一套可复现的插件核验标准：28 项检查、零运行时依赖、静态 R/K 门禁可跑在 CI 上，离线可重现，不安装也不构建。**

**A reproducible verification standard for DSH plugins: 28 checks, zero runtime dependencies, and a static R/K gate that runs in CI offline — no install, no build.**

### 它解决什么问题 | What It Solves

插件的"能不能装、能不能跑"通常靠人工试。这个项目把它变成**可复现的判定**：

Plugin health is usually judged by trying it. This turns it into a reproducible verdict:

- **R 组** — 包结构：`dsh.bundle.patch` 激活门、`cordis.patch.yml` 结构、入口契约、`files` 覆盖、prebuild 缺口
  **R** — package structure: the `dsh.bundle.patch` activation gate, patch-layer structure, entry contract, `files` coverage, prebuild gaps
- **K 组** — cordis v4 契约扫描：`name`/`apply` 导出、`inject` 字面量、peer 口径
  **K** — cordis v4 contract scan: `name`/`apply` exports, `inject` literals, peer ranges
- **D 组** — 无密钥无头沙箱冒烟（可关）
  **D** — keyless headless sandbox smoke (optional)
- **CC 组** — 生态目录收录核验
  **CC** — ecosystem-listing verification

判定词汇是 `pass` / `warn` / `fail` / `skip`，退出码 0/1/2/5/6，并实现生态正在讨论的三值契约（[RFC #1846](https://github.com/deepseek-ai/deepseek-harness/discussions/1846) 的 `dsh-doctor/v1` 命名空间）。

Verdicts are `pass` / `warn` / `fail` / `skip` with exit codes 0/1/2/5/6, and it implements the three-value contract discussed for the ecosystem (namespace `dsh-doctor/v1` in [RFC #1846](https://github.com/deepseek-ai/deepseek-harness/discussions/1846)).

### 作为 CI 门禁 | As a CI gate

一条命令，只读、不联网、不装依赖：

One command, read-only, no network, no dependency install:

```shell
npx --yes @perrylink/dsh-plugin-doctor@0.3.2 --repo . --no-smoke --only "R,K"
```

把 `plugin-doctor.yml` 复制到你自己仓库的 `.github/workflows/` 即可；模板会自校验 R0/K1 确实跑过，避免"参数写错导致什么都没检查却显示绿灯"。

Copy `plugin-doctor.yml` into `.github/workflows/` in your repository. The template self-verifies that R0 and K1 actually ran, so a mis-encoded argument cannot produce a green run that checked nothing.

### 标准本身是规范文本 | The standard is normative text

`SPEC.md` 是 28 项检查的规范来源，随包发布，以 Apache-2.0 授权，**任何人都可以实现它**——校验器只是一个实现。

`SPEC.md` is the normative source for all 28 checks. It ships in the package under Apache-2.0 and **anyone may implement it**; the checker is one implementation.

- 规范 | Spec: https://github.com/PerryLink/dsh-plugin-doctor/blob/main/SPEC.md
- 采纳指南 | For adopters: https://github.com/PerryLink/dsh-plugin-doctor/blob/main/FOR-ADOPTERS.md
- npm: https://www.npmjs.com/package/@perrylink/dsh-plugin-doctor

### 关于命名 | On the name

⚠️ `dsh-plugin-doctor` 这个名字有多个项目在用。npm 上的裸名 `dsh-plugin-doctor` **不是这个项目**——请始终用带 scope 的 `@perrylink/dsh-plugin-doctor`。

⚠️ Several projects share the name `dsh-plugin-doctor`. The bare npm name `dsh-plugin-doctor` is **a different project** — always use the scoped `@perrylink/dsh-plugin-doctor`.

---

*本项目由 PerryLink 建立与维护。规范、退出码与检查语义以 SPEC.md 为准。*
*Established and maintained by PerryLink. The spec, exit codes and check semantics are normative in SPEC.md.*
