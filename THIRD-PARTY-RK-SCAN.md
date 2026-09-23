# Third-party R+K scan — refreshed 2026-09-23

Static-only scan of well-known **third-party** DSH plugins (no PerryLink
repositories). Re-runnable: `scripts/refresh-third-party-scan.ps1`.

## Read this first: why the numbers moved

This file replaces a scan dated **2026-09-10**, produced by **0.2.0**. It was
refreshed because two criteria changed in 0.3.0 (`R3` now accepts a valid empty
patch layer; `R7` no longer rejects a zero-build plain-JavaScript package), and a
published table that keeps asserting superseded verdicts is the
documentation-that-lies failure this project exists to catch.

| | 2026-09-10 (0.2.0) | 2026-09-23 (0.3.0) |
|---|---|---|
| candidates | 60 | 20 (the same qualified set, re-scanned) |
| qualified | 20 | 19 |
| **pass** | 10 | **6** |
| **fail** | 10 | **13** |
| skipped | 21 not-plugins | 1 (clone failure) |

**Nothing regressed because of the R3/R7 fixes.** Comparing repository by
repository, no repository's gated verdict changed as a result of them. The
headline movement is entirely `R8`:

| check | 2026-09-10 | 2026-09-23 |
|---|---|---|
| `R3` | 5 | 5 |
| `R7` | 3 | 3 |
| **`R8`** | **3** | **9** |

`R8` was **not** changed. What changed is the ecosystem: the minimum peer line
`>=0.1.2-rc.1 <0.2.0 || >=0.1.5-alpha.1 <0.2.0` has moved on, and repositories
still pinning `0.1.0-rc.6` are now measurably behind it — `@deepseek-ai/dsh-*`
publishes up to `0.1.7-alpha.2`. Six repositories crossed from pass to fail on
that basis alone. **Read `R8` as staleness, not breakage** — see §"What a failure
means here".

## Scope — read this before citing anything below

- **What was run**: `@perrylink/dsh-plugin-doctor` **0.3.0**, groups **R** and
  **K**, `--no-smoke`. The gated set is every check **except `R2`/`R4`**, which
  read *built* artifacts and cannot be judged on an unbuilt clone.
- **What was NOT run**: no install, no build, no boot, no runtime observation.
  **No third-party code was executed** — each target is cloned read-only
  (`--depth 1`) into a throwaway `%TEMP%` directory and only files are read.
- **This is not a certification, not a grade, and not a statement that a plugin
  is safe.** "pass" means: *on the commit scanned, the 16 gated static checks
  raised no failure.*
- **Method**: the same candidate set as the previous scan, re-cloned and
  re-tested. The qualification gate is unchanged: the repository must declare
  `dsh.bundle.patch`, i.e. it must actually be a DSH plugin.
- **K coverage depth**: `src` when the repository ships `src/`, `lib-fallback`
  otherwise. `lib-fallback` is real coverage but **not equivalent** — a bundle is
  harder to read heuristically and K3–K7 may under-report there.

### Corrections

Every row records what a **static** check reported on **one commit**, and nothing
more. If you maintain a repository listed here and believe a row is wrong — a
stale clone, a file this heuristic mis-reads, a check that does not fit your
layout — open an issue at
[PerryLink/dsh-plugin-doctor/issues](https://github.com/PerryLink/dsh-plugin-doctor/issues)
with the reproduce command and your output. The row is re-run and this file is
amended in place, with the same prominence as the original: **a wrong row is a
defect of this tool, not a fact about your plugin.** Four checks have already
been corrected under this promise (`R2`/`R4` in 0.2.4, `R3`/`R7` in 0.3.0).

## Result

| metric | value |
|---|---|
| **qualified DSH plugins scanned** | **19** |
| **pass (16 gated checks clean)** | **6** |
| fail (gated) | 13 |
| degraded (a requested group did not really run) | 0 |
| skipped (clone failed, transient) | 1 |

Gated failure histogram: `{"R8":9,"R3":5,"R7":3}`.

## The scans

| repository | ★ | package | gated verdict | failed (gated) |
|---|---|---|---|---|
| [zhu1090093659/dsh-web](https://github.com/zhu1090093659/dsh-web) | 7131 | `dsh-web` | **fail** | R3, R7 |
| [liustack/modlens](https://github.com/liustack/modlens) | 3913 | `@liustack/modlens` | **fail** | R7 |
| [dsh-market/dsh-market](https://github.com/dsh-market/dsh-market) | 3408 | `dshmarket` | **fail** | R8 |
| [ccch1mneyyy/dsh-TUI](https://github.com/ccch1mneyyy/dsh-TUI) | 2882 | `@deepseek-harness-tui/dsh-tui` | **fail** | R3, R8 |
| [MeteorNOX/DeepSeek-Balance-Whale-Widget](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget) | 1884 | `dsh-whale-widget` | **pass** | — |
| [NanmiCoder/dsh-agent-teams](https://github.com/NanmiCoder/dsh-agent-teams) | 1443 | `@nanmicoder/dsh-agent-teams` | **fail** | R8 |
| [bowenliang123/dsh-context](https://github.com/bowenliang123/dsh-context) | 1328 | `dsh-context` | **pass** | — |
| [superdesigndev/treg](https://github.com/superdesigndev/treg) | 1235 | `treg-dsh` | **fail** | R3 |
| [xmanrui/dsh-im](https://github.com/xmanrui/dsh-im) | 1215 | `@xmanrui/dsh-im` | **pass** | — |
| [GanyuanRan/Aegis](https://github.com/GanyuanRan/Aegis) | 1172 | `aegis` | **fail** | R7, R8 |
| [ysr666/dsh-vision-router](https://github.com/ysr666/dsh-vision-router) | 1086 | `dsh-vision-router` | **fail** | R3, R8 |
| [shaobeichen/dsh-pocket](https://github.com/shaobeichen/dsh-pocket) | 1002 | `dsh-pocket` | **pass** | — |
| [Anionex/dsh-vision-toolkit](https://github.com/Anionex/dsh-vision-toolkit) | 858 | `@anionex/dsh-vision-toolkit` | **fail** | R8 |
| [toby-bridges/api-relay-audit](https://github.com/toby-bridges/api-relay-audit) | 824 | `dsh-api-relay-audit` | **fail** | R8 |
| [vshulcz/deja-vu](https://github.com/vshulcz/deja-vu) | 789 | `dsh-deja` | **pass** | — |
| [sandbaseai/sandbase-harness](https://github.com/sandbaseai/sandbase-harness) | 642 | `managed-agents` | **fail** | R3 |
| [Nagi-ovo/dsh-ads](https://github.com/Nagi-ovo/dsh-ads) | 613 | `@dsh-external/dsh-ads` | **fail** | R8 |
| [adoresever/graph-memory](https://github.com/adoresever/graph-memory) | 604 | `graph-memory` | **fail** | R8 |
| [superdesigndev/superdesign-skill](https://github.com/superdesigndev/superdesign-skill) | 522 | `superdesign-dsh` | **pass** | — |

Skipped: `omdsh-dev/DSH-better-sidebar` — the clone failed
(`server closed abruptly, missing close_notify`; the repository is ~816 MB). A
transient network failure, not a verdict, and it was scanned successfully in the
previous pass.

## What a failure means here

| check | meaning of a failure |
|---|---|
| `R3` | The declared `cordis.patch.yml` is malformed — it is neither a valid empty layer nor a non-empty patch with an `- insert:` structure and `id:` rows. |
| `R7` | The `files` allowlist does not cover the entry point or the patch file (which silently drops them from the tarball), or a package that *does* need a build points `main` at source. |
| `R8` | **Staleness, not breakage.** The peer range names a superseded release-candidate line, or is a single-arm prerelease range that will not admit the current host line. The package works; it has fallen behind. `SPEC.md` §5.4 makes this scope limit normative, and a failure here is not a claim that a plugin is broken. |

## Findings about the ecosystem catalogues

1. **Star-ranked topic catalogues are mostly noise.** In the original pass, 21 of
   60 candidates were skipped because they are not DSH plugins at all — the
   highest-starred entries included 20k–50k★ unrelated projects. Anyone ranking
   "the most popular DSH plugins" from a topic-derived catalogue needs a
   `dsh.bundle.patch` qualification gate first.
2. **`R2`/`R4` cannot be judged on an unbuilt clone** and must never be folded
   into a verdict without saying so. They read built artifacts, which most
   third-party repositories do not commit.
3. **A freshness check ages fast.** `R8` more than tripled in thirteen days
   without a line of code changing. That is an argument for re-running this scan
   on a schedule rather than treating any snapshot as a standing fact.

## Reproduce

```powershell
pwsh -File scripts/refresh-third-party-scan.ps1            # all candidates
pwsh -File scripts/refresh-third-party-scan.ps1 -Limit 3   # quick check
```

Or by hand, for a single target:

```bash
git clone --depth 1 https://github.com/<owner>/<repo> /tmp/target
npx --yes @perrylink/dsh-plugin-doctor@<pinned> --repo /tmp/target --no-smoke --only "R,K" --json out.json
```

Machine-readable form: `data/rk-scans.json` is the **2026-09-10** record and is
kept as-is, because it is the baseline this refresh is measured against.
