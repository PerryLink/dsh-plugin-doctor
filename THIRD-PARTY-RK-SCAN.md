# Third-party R+K scan — 2026-09-10

Static-only scan of well-known **third-party** DSH plugins (no PerryLink repositories).
First public, reproducible result set for plugins outside this project's own family.

## Scope — read this before citing anything below

- **What was run**: `@perrylink/dsh-plugin-doctor` 0.2.0 (`checksetVersion` R0-R8+K1-K9+D0-D3,D9+CC1-CC5/1),
  groups **R (package structure)** and **K (cordis v4 contract)**, `--no-smoke`.
- **What was NOT run**: no install, no build, no boot, no runtime observation. **No third-party code was
  executed** — each target is cloned read-only into a throwaway `%TEMP%` directory and only files are read.
- **Verdict rule**: `gated` = every check **except R2/R4**, which read *built artifacts*. The clones are
  unbuilt source trees, so R2/R4 are listed separately and marked "not evaluated" — exactly as the
  family's own gate excludes them (`gated = results.filter(x => !/^R[24] /.test(x.name))`).
  A first pass that used the raw exit code reported 7 of 8 samples as failing purely because `lib/`
  is not committed; that was a methodology error in this scan, not a plugin defect.
- **This is not a certification, not a grade, and not a statement that a plugin is safe.**
  "pass" means: *on the commit scanned, the 16 gated static checks raised no failure.*
- **Method**: candidates from `awesome-dsh-plugin.com/plugins.json` (by stars, non-PerryLink, ≤2 per owner), then a qualification
  gate — the repository must declare `dsh.bundle.patch`, i.e. it must actually be a DSH plugin.
- **K coverage depth**: the `K coverage` column is `src` when the repository ships `src/`, and
  `lib-fallback` when it does not — in that case the checks run over the **built-artifact directory**
  (the directory holding `main`, or `lib/`/`dist/`), which for some plugins is a single bundled file.
  `lib-fallback` is real coverage but it is **not equivalent** to `src/` coverage: a bundle is harder to
  read heuristically and K3–K7 may under-report there.

## Result

| metric | value |
|---|---|
| candidate pool | 60 |
| **qualified DSH plugins scanned** | **20** |
| **pass (16 gated checks clean)** | **10** |
| fail (gated) | 10 |
| degraded (a requested group did not really run) | 0 |
| skipped: not a DSH plugin (no `dsh.bundle.patch`) or clone failed | 21 |

Gated failure histogram (check id → number of scanned plugins that failed it): `{"R3":5,"R7":3,"R5":1,"R8":3}`

## The scans

| repository | ★ | package | gated verdict | failed (gated) | warnings (gated) | K coverage | R2/R4 (not evaluated) |
|---|---|---|---|---|---|---|---|
| [zhu1090093659/dsh-web](https://github.com/zhu1090093659/dsh-web) | 7131 | `dsh-web@0.1.1` | **fail** | R3, R7 | R0, R6 | src | R2=fail R4=fail |
| [liustack/modlens](https://github.com/liustack/modlens) | 3913 | `@liustack/modlens@3.26.1` | **fail** | R7 | R6, K3, K4 | src | R2=fail R4=fail |
| [omdsh-dev/DSH-better-sidebar](https://github.com/omdsh-dev/DSH-better-sidebar) | 3421 | `dsh-better-sidebar@0.19.0` | **fail** | R5 | R6, K1, K3, K6 | src | R2=fail R4=fail |
| [dsh-market/dsh-market](https://github.com/dsh-market/dsh-market) | 3408 | `dshmarket@1.45.1` | **fail** | R8 | R6, K3, K6 | src | R2=fail R4=fail |
| [ccch1mneyyy/dsh-TUI](https://github.com/ccch1mneyyy/dsh-TUI) | 2882 | `@deepseek-harness-tui/dsh-tui@0.10.0` | **fail** | R3 | K3, K4, K5, K6 | src | R2=fail R4=fail |
| [superdesigndev/treg](https://github.com/superdesigndev/treg) | 1235 | `treg-dsh@0.19.0` | **fail** | R3 | R6, K1, K3, K6 | src | R2=pass R4=pass |
| [GanyuanRan/Aegis](https://github.com/GanyuanRan/Aegis) | 1172 | `aegis@2.10.0` | **fail** | R7 | R0, R6 | lib-fallback | R2=pass R4=warn |
| [ysr666/dsh-vision-router](https://github.com/ysr666/dsh-vision-router) | 1086 | `dsh-vision-router@2.1.5` | **fail** | R3, R8 | K1 | src | R2=pass R4=warn |
| [Anionex/dsh-vision-toolkit](https://github.com/Anionex/dsh-vision-toolkit) | 858 | `@anionex/dsh-vision-toolkit@0.1.44` | **fail** | R8 | K3, K4, K5, K6, K7 | src | R2=pass R4=pass |
| [sandbaseai/sandbase-harness](https://github.com/sandbaseai/sandbase-harness) | 642 | `managed-agents@0.3.8` | **fail** | R3 | R6, K1, K3, K4 | src | R2=fail R4=fail |
| [MeteorNOX/DeepSeek-Balance-Whale-Widget](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget) | 1884 | `dsh-whale-widget@0.2.10` | **pass** | — | R6, K3, K6 | lib-fallback | R2=pass R4=warn |
| [NanmiCoder/dsh-agent-teams](https://github.com/NanmiCoder/dsh-agent-teams) | 1443 | `@nanmicoder/dsh-agent-teams@0.1.16-rc.3` | **pass** | — | K1, K3, K6 | src | R2=fail R4=fail |
| [bowenliang123/dsh-context](https://github.com/bowenliang123/dsh-context) | 1328 | `dsh-context@0.49.1` | **pass** | — | K1, K3, K4, K6 | src | R2=fail R4=fail |
| [xmanrui/dsh-im](https://github.com/xmanrui/dsh-im) | 1215 | `@xmanrui/dsh-im@4.18.1` | **pass** | — | R6, K1, K3 | src | R2=pass R4=warn |
| [shaobeichen/dsh-pocket](https://github.com/shaobeichen/dsh-pocket) | 1002 | `dsh-pocket@2.10.4` | **pass** | — | R6 | src | R2=pass R4=warn |
| [toby-bridges/api-relay-audit](https://github.com/toby-bridges/api-relay-audit) | 824 | `dsh-api-relay-audit@2.4.0` | **pass** | — | K6 | lib-fallback | R2=pass R4=pass |
| [vshulcz/deja-vu](https://github.com/vshulcz/deja-vu) | 789 | `dsh-deja@0.20.5` | **pass** | — | R6, K1 | lib-fallback | R2=pass R4=warn |
| [Nagi-ovo/dsh-ads](https://github.com/Nagi-ovo/dsh-ads) | 613 | `@dsh-external/dsh-ads@0.1.0` | **pass** | — | R6, K1, K3, K6 | src | R2=pass R4=pass |
| [adoresever/graph-memory](https://github.com/adoresever/graph-memory) | 604 | `graph-memory@1.6.0-beta.16` | **pass** | — | R0, R6, K1, K3, K6 | src | R2=pass R4=warn |
| [superdesigndev/superdesign-skill](https://github.com/superdesigndev/superdesign-skill) | 522 | `superdesign-dsh@0.6.0` | **pass** | — | R6, K6 | lib-fallback | R2=pass R4=pass |

## Findings about the ecosystem catalogues and about R2/R4

1. **Star-ranked topic catalogues are mostly noise.** 21 of 60 candidates were
   skipped because they are not DSH plugins at all (no `package.json`, or no `dsh.bundle.patch`) — the
   highest-starred entries included 20k–50k★ unrelated projects. Anyone ranking "the most popular DSH
   plugins" from a topic-derived catalogue needs a `dsh.bundle.patch` qualification gate first.
2. **R2/R4 cannot be judged on an unbuilt clone** and must never be folded into a verdict without saying so.
   They read built artifacts (`lib/`), which most third-party repositories do not commit.

## Reproduce

```bash
git clone --depth 1 https://github.com/<owner>/<repo> /tmp/target
npx --yes @perrylink/dsh-plugin-doctor@<pinned> --repo /tmp/target --no-smoke --only "R,K" --json out.json
```

Machine-readable form of this table: `data/rk-scans.json`.
