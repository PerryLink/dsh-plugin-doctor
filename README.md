# dsh-plugin-doctor

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![npm version](https://img.shields.io/npm/v/%40perrylink%2Fdsh-plugin-doctor)](https://www.npmjs.com/package/@perrylink/dsh-plugin-doctor)
[![npm downloads](https://img.shields.io/npm/dm/%40perrylink%2Fdsh-plugin-doctor)](https://www.npmjs.com/package/@perrylink/dsh-plugin-doctor)
[![Node](https://img.shields.io/badge/node-%5E22.19%20%7C%7C%20%3E%3D24-brightgreen.svg)](#)
[![CI](https://img.shields.io/github/actions/workflow/status/PerryLink/dsh-plugin-doctor/ci.yml?branch=main&label=CI)](https://github.com/PerryLink/dsh-plugin-doctor/actions)
[![dshfind](https://dshfind.com/api/badge/PerryLink/dsh-plugin-doctor?metric=downloads)](https://dshfind.com/plugins/PerryLink/dsh-plugin-doctor?ref=badge)
[![OpenSSF Scorecard](https://api.securityscorecards.dev/projects/github.com/PerryLink/dsh-plugin-doctor/badge)](https://api.securityscorecards.dev/projects/github.com/PerryLink/dsh-plugin-doctor)

[English](README.md) · [简体中文](README-zh.md) · [Español](README-es.md) · [Português](README-pt.md) · [हिन्दी](README-hi.md)

An all-in-one "integrity + runtime health" checker for dsh plugins. Zero dependencies (it uses
only what Node ≥22 ships), and one run covers four layers at once:
**static package-structure checks (R) → Cordis contract scan (K) → dynamic sandbox smoke (D) → ecosystem directory-listing validation (CC)**.
Every criterion traces back to three first-hand research tracks dated 2026-09-07: the deepseek-harness
docs and source, the cordiverse/cordis source contracts, and an inventory of every distribution
channel in the workspace (full text in `SURVEY.md`).

## Installation (DSH bundle)

`dsh-plugin-doctor` declares `dsh.bundle.patch` → `cordis.patch.yml` in package.json, so it can also be installed as a DeepSeek Harness bundle:

```powershell
# git channel (latest main)
dsh plugin --profile web add "github:PerryLink/dsh-plugin-doctor#main"

# npm channel (released version; always use the scoped full name -- the bare name dsh-plugin-doctor is a different project)
dsh plugin --profile web add @perrylink/dsh-plugin-doctor
```

The inserted line loads this package under the standard Cordis plugin contract: the host half is a plain ESM module exporting `apply(ctx)` (declaring `inject` for the services it needs). The package ships no browser UI, so there is no `dsh.client` declaration.

```js
// bundle entry (host half) -- the export contract the patch line loads
export function apply(ctx) {
  // registers the /doctor command and the plugin_doctor read-only check tool
}
```

Uninstall: `dsh plugin --profile web remove @perrylink/dsh-plugin-doctor` (or delete that line from the profile patch). The CLI usage below is unaffected.

## Usage

```powershell
node doctor.mjs --repo <插件仓路径>            # 全量（含动态冒烟，需网络 + pnpm）
node doctor.mjs --repo <路径> --no-smoke       # 仅静态 + 清单
node doctor.mjs --repo <路径> --dsh 0.1.7-alpha.1 # 冒烟宿主版本（默认 npm latest 已发布线）
node doctor.mjs --repo <路径> --only R,K       # 只跑静态两层（推荐用 ASCII 别名）
node doctor.mjs --repo <路径> --json report.json
node doctor.mjs --repo <路径> --json -         # JSON 写 stdout（此时抑制人类可读报告）
node doctor.mjs --repo <路径> --format check --json -   # 生态三值契约视图（PASS/WARN/FAIL + 0/1/2）
node doctor.mjs --repo <路径> --workspace <工作区根>   # 指定兄弟仓所在工作区（CC 组核对用）
node doctor.mjs --repo <路径> --allow-degraded # 显式接受「整组未真跑」（默认 exit 6）
node doctor.mjs --purge <隔离目录>              # 清理本工具产生的隔离目录（仅 doctor-quarantine-*）
```

### Target shapes and coverage (new in 0.2.0)

`--repo` may be a **source tree** or an **installed package directory / unpacked tarball artifact** (the latter is common at `node_modules/<pkg>`). The criteria change with the shape:

| Shape | K group (Cordis contract) | Notes |
|---|---|---|
| Source tree with `src/` | scans `src/**` plus root-level JS (`mode: src`) | complete |
| **No `src/`, `main` points at `lib/`** | **fallback scan of `lib/**` (`mode: lib-fallback`)** | fixed in 0.2.0: the old implementation keyed on "no build script", but published packages **keep** their build script → the fallback never fired, all nine K checks were skipped, and it still exited 0 (false green) |
| Neither `src/` nor `lib/` | all nine skipped (`mode: none`) | **the whole group never really ran → exit code 6**, no more false green |

Coverage is written to `coverage.K` in the JSON (`{filesInspected, mode}`) and summarised in `groups.K`.

### `--only` groups and ASCII aliases

| Alias | Full group name | Contents |
|---|---|---|
| `R` | static · package structure | R0–R8 |
| `K` | static · Cordis contract scan | K1–K9 |
| `D` | dynamic · sandbox smoke | D0–D3, D9 |
| `CC` | ecosystem · directory listings | CC1–CC5 |

Aliases are case-insensitive, and the Chinese full names still work. **Use the aliases in workflows**: if an editor or script round-trips a Chinese group name through the wrong encoding, `--only` matches no group at all.

### Exit-code contract

| Code | Meaning | Introduced |
|---|---|---|
| `0` | no fail/error (warn/skip allowed), and every requested group really ran | 0.1.x |
| `1` | fail/error present (a plugin defect) | 0.1.x |
| `2` | usage error, unknown group, **unknown option** | 0.1.x |
| `3` | infrastructure error (missing npm/pnpm and the like) | **0.2.0** |
| `4` | unsupported host version (the host itself failed to install; **not** a plugin verdict) | **0.2.0** |
| `5` | unstable result (a step timed out or was killed by a signal) | **0.2.0** |
| `6` | **degraded**: a requested group never really ran (e.g. no source files to scan) | **0.2.0** |

**Guarding against silent passes** (two layers):

1. If even one group name in `--only` fails to match → immediately `2`. Versions 0.1.4 and earlier would "check nothing + exit 0" when a group name was mangled, which once turned the CI gates of 35 repos into false green (measured 2026-09-09: `checks_run=0`, `exit=0`).
2. From 0.2.0: **a requested group whose checks all skipped → `6`**. The old implementation only covered "not a single check ran", not "it ran but everything skipped" — the latter let "K group with zero coverage" count as a pass. To accept that explicitly, use `--allow-degraded` (exit code drops to 0, but `degraded` stays non-empty in the JSON).

> ⚠️ The existing gates in 41 family repos **do not read the exit code** (their workflows use `set +e` / `out="$(…)"` / `set -e`) and only parse the `R0 ` / `K1 ` prefixes on stdout and `results[].name` in the JSON. So 0.2.0's new exit codes **change nothing for those pipelines**; they serve interactive use and future integrators.

- The smoke run keeps its temporary `DSH_HOME`/`DSH_AGENTS_HOME` inside a self-made `%TEMP%` sandbox (prefix `doctor-`, which **does not overlap** the host-protected `%TEMP%\dsh-*` template) and never touches the real `~/.dsh` (red line 3).
- `dsh plugin add` is always passed `--ignore-scripts`: the tested package's install/prepare scripts never execute on the host. A pnpm ignored-builds block is classified as `environment` (it counts neither as a pass nor as a plugin defect).
- Every step's subprocess stdout/stderr is written to `%TEMP%\doctor-run-*\logs\`; at the end the run **quarantines instead of deleting** (renames to `%TEMP%\doctor-quarantine-*`), prints that path in the report tail, and leaves removal to `--purge` after a human confirms (red line 4, the three-stage rule).
- Absolute paths seen at runtime are placeholder-ised to `<path>` before they reach the JSON or the rendered text, so a report can be committed into someone else's repo without tripping its path-leak gate.

## Name collisions (important)

This repository is **`@perrylink/dsh-plugin-doctor`**, and it is **not the same project** as other same-named tools in the ecosystem:

- The bare npm name `dsh-plugin-doctor` belongs to **Xrainsmile/DSH-Plugin-Doctor** (a different project, 0.1.1). So **never run `npx dsh-plugin-doctor`** — that executes someone else's package; always use the scoped full name `@perrylink/dsh-plugin-doctor@<exact version>`.
- Ten GitHub repos carry `dsh-plugin-doctor` in their name (eight of them **exactly** that name), including `zoahdev/dsh-plugin-doctor` (GitHub-only, never published to npm).
- `dsh-testkit`'s README links `dsh-plugin-doctor` to the zoahdev repo; that has nothing to do with this one.

In one line: **zero-dependency, offline-capable (`--only R,K`), and it turns the Cordis v4 contracts (K1–K9) and five ecosystem directory listings (CC1–CC5) into a CI gate whose verdict is readable from the exit code.** (No "the only" style claim — merely that nothing comparable appeared within the set of tools actually surveyed.)

**Inline one-liner.** `--format check` emits the ecosystem's three-value contract
(`PASS`/`WARN`/`FAIL`, exit `0`/`1`/`2`, flat `checks[]`) instead of this
project's enriched envelope, so another checker or Action can consume the result
directly. It is a *view*: it never changes whether a project passes, and a `skip`
is never rendered as `PASS` (it becomes `WARN` with `skipped: true`). The full
semantics stay in a `doctor` side field. See `SPEC.md` §1.1 — those three
properties are normative and `tests/compat.mjs` asserts them.

## Check catalog

| Group | Checks | What the criteria cover |
|---|---|---|
| static · package structure | R0–R8 | base fields; **the activation gate `dsh.bundle.patch` (critical)**; `npm pack --dry-run` tarball contains the entry and the patch; cordis.patch.yml structure; entry `name`/`apply` exports; rescoped dependency policy (bare `cordis` forbidden); engines aligned to `^22.19.0 \|\| >=24.0.0`; prebuild + files allowlist; leftover old-rc peers (the 2026-09-05 dual-baseline lesson) |
| static · Cordis contract | K1–K9 | service access vs `inject` declaration; the ctx live-data serialization red line; timers/listeners not wrapped in `ctx.effect`; Schema containing a function; `apply` return shape (the v4 Effect contract); `inject` service-name seam; **v3 legacy APIs (the 3.x→4.x removal list)**; Config must be a Standard Schema; the `name==='apply'` special case |
| dynamic · sandbox smoke | D0–D3, D9 | `npm pack` → `dsh plugin --profile headless add <tarball>` → assert `dsh.profile.bundles` contains the package name → `--dump-config` layer marker → keyless headless run expected to **exit 1 + `dsh: MISSING_CREDENTIAL`** (= the composition booted as far as a model request; NO_ADAPTER/ERR_MODULE_NOT_FOUND/SyntaxError/TypeError are excluded) → sandbox cleanup |
| ecosystem · directory listings | CC1–CC5 | the certification registry spec v1 five-dimension evidence; adp-list yml fields/enums/descriptions; dsh-catalog entry constraints (install commands forbidden, truncation heuristics); the omdsh `dshWorkshop` activation five values; the dsh-plugin-kit three gates (license / five-language README / the three seam roles, preferring the kit's official CLI) |

## Verified 徽章

There are **two badge paths**, and they make different claims. Pick the one whose
claim you can actually back. **[`FOR-ADOPTERS.md`](FOR-ADOPTERS.md) is the
step-by-step version of this section** — the exact file to copy, the exact badge
markdown, what each verdict means, and what this check does *not* prove.

### Path A — self-serve gate badge (no permission needed, no author involvement)

This badge makes **one narrow, checkable claim**: *the repository runs
dsh-plugin-doctor's static R+K gate in its own CI, and that workflow is green on
the repository's default branch.* It is rendered by shields.io directly from your
own workflow's status, so it needs no registry entry, no pull request, no token
from anyone, and it cannot be broken by this project's infrastructure:

```markdown
[![dsh-doctor R+K](https://img.shields.io/github/actions/workflow/status/<owner>/<repo>/plugin-doctor.yml?branch=main&label=dsh-doctor%20R%2BK)](https://github.com/PerryLink/dsh-plugin-doctor/blob/main/SPEC.md)
```

Replace `<owner>/<repo>` (and `branch=` if your default branch is not `main`).
The link target is `SPEC.md` — the criteria you are claiming to meet, and an
explicit statement of who authored them.

**Use Path A.** It is the whole standard, self-serve, and it is what this
specification is designed for. It requires nothing of this project.

Two honest caveats about Path A: the badge reflects *your* workflow, so it is
only as trustworthy as your CI configuration — it is not verified by anyone
else; and it is served by shields.io, which learns your repository name.

### Path B — author-issued audited badge

Wearing this badge means exactly one auditable thing: **the repo runs dsh-plugin-doctor's static R+K gate (16 checks: R0/R1/R3/R5/R6/R7/R8 + K1–K9) in its own CI, and that gate is green on the current HEAD of the default branch**, *as re-checked by this project's auditor*. It is **not** a certification badge: no Scorecard, no provenance, no install smoke. R2 (tarball integrity) and R4 (entry contract) read the built `lib/`, and building most family repos needs `HARNESS_COMMIT` + `gen-aliases` to pass — those two are covered by each repo's own `ci.yml` (build-drift gate + pack smoke) and are deliberately outside this gate.

```markdown
[![dsh-doctor](https://raw.githubusercontent.com/PerryLink/dsh-plugin-doctor/main/badges/PerryLink__dsh-github.svg)](https://github.com/PerryLink/dsh-plugin-doctor#verified-徽章)
[![DSH Market](https://raw.githubusercontent.com/2BingLing/dsh-market/master/assets/readme/badge-listed-en.svg)](https://dsh.market/)
```

**Path B is a centralized, single-operator service and should be treated as
such.** It needs a fine-grained PAT with cross-repository read access, stored as
the `DOCTOR_AUDIT_TOKEN` repository secret. The workflow-scoped `GITHUB_TOKEN`
**cannot** substitute for it: it carries no cross-repository read permission, so
GitHub treats it as an anonymous caller limited to 60 requests/hour, while a full
audit of the declared repos needs 200+. Without the PAT, every badge renders grey
`NO DATA` — the failure looks like a broken badge program rather than a missing
secret. This has happened (once as `401`, then as `403 rate limit exceeded`), and
it is the reason Path A exists and is recommended. `scripts/verify.mjs` now stops
at the first such response, exits `3`, and writes a registry whose reasons name
the real cause instead of emitting the same rate-limit line for every repo.
- The registry `data/verified.json` is the single source of truth for Path B, refreshed by `.github/workflows/verified.yml` daily and on every relevant push. A refresh only reads the GitHub API: it parses each repo's HEAD `plugin-doctor.yml` gate configuration (which must pin `@perrylink/dsh-plugin-doctor@<version>`, use a working `--only` argument, and self-verify that R0/K1 actually ran), then checks the conclusion of that HEAD's `plugin-doctor` workflow run. **This repo's CI never clones, installs or executes any third-party code.**
- Badge appearance: the visual language follows the two newer badges in the ecosystem (`dsh.directory`'s monospace-uppercase + letter-spacing + mark + gradient, and `awesome-dsh-plugin`'s seal block) — **a silver/platinum metallic left segment, a shield tick mark, and ink-blue monospace uppercase**, with the right segment a **solid GitHub-convention status colour** (green/orange/red/grey) carrying a monospace uppercase status word, and the status additionally expressed by a **path-drawn icon** (✓ / ! / ✕ / –) so it stays readable with colour-vision deficiency. 5px corner radius + 1px stroke; **the stroke is required** — without it the silver left segment disappears against a white README background.
- Four states (value text uses the shields / GitHub Actions conventional words): `passing` (green: the HEAD run succeeded) / `warning` (orange: HEAD has not run yet, a run is still queued, or a gate precondition is missing) / `failing` (red: the HEAD run failed, or the gate configuration does not hold — including a "fake gate" whose `--only` argument is doubly mis-encoded) / `no data` (grey: the API query failed). The badge is **dynamic**: once it stops passing it turns red. The precise R+K scope lives in this section and in the registry's `meaning` field, not in the badge text (the badge links back here).
- To join Path B: open a PR against `data/verified-repos.json` adding `{ "repo": "<owner>/<name>", "package": "<npm package name>" }`, and add `plugin-doctor.yml` to your own repo; the entry must pass the audit above. **Path A needs none of this.**
- **The gate file is shipped, not scraped.** Copy [`plugin-doctor.yml`](plugin-doctor.yml) — the canonical, ready-to-use workflow — to `.github/workflows/plugin-doctor.yml` in your repository and adjust the pin. It is also inside the npm tarball, so `npx @perrylink/dsh-plugin-doctor` users can read the shipped copy instead of reconstructing the step from this README. Group names use the **ASCII aliases `R,K`** (supported since 0.1.5, keeping file and command line pure ASCII), and the tail self-verifies that R0/K1 really ran.

> Why the gate installs and builds nothing, and why this repo does not run the badge itself: the static R/K checks read only the committed tree (no dependencies needed), whereas `npm run build` fails in an environment without the harness aliases, and its prebuild wipes the committed `lib/`, manufacturing a false red. Concentrating third-party dependency installs into this repo's CI, on the other hand, would be a supply-chain risk. So the gate runs inside each repo's own CI against the committed tree, and this repo only audits and issues the Path B badge.

## Where the criteria come from (full text and URLs in SURVEY.md)

- **harness side**: `docs/user/develop/basic/publish.md`, `apps/cli/src/plugin.ts` (the activation gate is the only switch),
  `packages/bundle/headless/README.md` (the MISSING_CREDENTIAL criterion), Releases (the 0.1.2-rc.1 / 0.1.3-alpha.1 changes),
  `@deepseek-ai/dsh-loader-smoke` (the official "temporary DSH_HOME + expected exit code" pattern).
- **Cordis side**: the cordiverse/cordis v4 source (registry/fiber/reflect/events.ts) + the DSH cordis-primer/tutorial docs +
  the v3 `@cordisjs/core@3.10.2` d.ts diff (the 3.x→4.x blacklist).
- **Ecosystem side**: the dsh-plugin-certification spec v1, adp-list `entries.mjs`/`check-submission.mjs`,
  dsh-catalog `validate.mjs`/`deploy.yml` live smoke, omdsh build-submission, dsh-plugin-kit `verify/*`.

## Known limits (stated honestly)

- The K group is a **heuristic static scan**: K1/K3/K4 miss complex wrappers and can also raise false alarms — every warn-level finding needs a human look and never condemns a plugin automatically.
- D3 only proves that "the composition boots as far as a model request"; it **does not prove the tool schemas are valid or the business logic correct** (that needs a keyed e2e run or a mock LLM).
- A pnpm `ignored-builds` block is an environment-recipe problem: when D1 hits it, the check degrades to warn and prints the compat.yml allowBuilds recipe, matching the certification spec v1's environment-blocked line, and it never counts as a plugin defect.
- npm-line hosts (0.1.2-rc.1) have no engines/peerDependencies enforcement in their packument, so R6 is advisory there.
- A measured trap in this environment: a `$` anchor (without the `m` flag) does not match the position before a lone trailing `\r`, so parsing CRLF text must split on `/\r?\n/` (already handled internally — do not regress it).

## Repository layout

```
doctor.mjs               CLI entry (group orchestration, exit codes, JSON report)
lib/framework.mjs        check registration/run/verdict/rendering (zero dependencies)
lib/util.mjs             temporary sandbox + subprocess execution (stdout/stderr to disk, avoiding pipe-capture limits)
lib/checks-package.mjs   static · package structure R0–R8
lib/checks-cordis.mjs    static · Cordis contract K1–K9
lib/checks-smoke.mjs     dynamic · sandbox smoke D0–D3, D9
lib/checks-collections.mjs  ecosystem · directory listings CC1–CC5
tests/selftest.mjs       14 real-CLI self-tests (the 7 existing exit-code-contract cases byte-identical, plus 7 new degraded/usage-guard cases)
tests/contract.mjs       31 contract tests (freezing the 5 observables the existing 37-repo CI depends on)
tests/spec-drift.mjs     guard tying SPEC.md to the implementation (check IDs, gate set, the single critical check, authorship)
tests/spec-id-token.mjs  shared parser for SPEC §1 ID lists, including `K1–K9` range expansion
tests/spec-drift-meta.mjs  tests the drift guard itself, so it cannot pass vacuously
tests/compat.mjs         25 tests for `--format check`: the two views must agree on pass/fail,
                         and a `skip` must never be rendered as a `PASS`
scripts/verify.mjs       verified registry and badge refresh (reads the GitHub API to audit each repo's gate)
scripts/badge.mjs        verified SVG rendering
data/verified-repos.json verified declaring repos
data/verified.json       verified registry (CI-generated)
badges/                  verified badges (CI-generated)
THIRD-PARTY-RK-SCAN.md   third-party plugin static R+K scan result set (public report)
data/rk-scans.json       machine-readable form of that scan
SURVEY.md                the full-channel detection methodology plus every criterion's source
SPEC.md                  the normative verification criteria (authored by PerryLink)
GOVERNANCE.md            authorship, spec versioning, and what attribution is asked vs required
NOTICE                   Apache-2.0 attribution notice (must travel with redistributions)
CITATION.cff             citation metadata (for citing the tool or the criteria)
plugin-doctor.yml        the canonical CI gate, shipped ready to copy into your repo
FOR-ADOPTERS.md          the adopter's landing page: gate, badge, verdicts, limits
SELF-CHECK.md            this tool's own result against its own criteria
OUTREACH.md              adoption notes: channel states, positioning, actions
```

## Status

Official repository: GitHub `PerryLink/dsh-plugin-doctor` (Apache-2.0), npm `@perrylink/dsh-plugin-doctor`.
**Current version 0.3.2**, published to npm. Releases go out through **npm Trusted
Publishing (OIDC)** — no long-lived token — after the `NPM_TOKEN` secret expired
and blocked the 0.2.4 and 0.3.0 attempts. See `CHANGELOG.md`. CI usage
(**please use the ASCII aliases**):

```powershell
npx --yes @perrylink/dsh-plugin-doctor@0.3.2 --repo . --no-smoke --only "R,K"
```

**42 plugin repos** already ship `.github/workflows/plugin-doctor.yml` (a read-only static gate over the committed tree → `--only "R,K"` plus the R0/K1 self-verification). 39 of them were moved from `@0.1.6` to a current pin on 2026-09-23, after the change was verified against all 42 repositories first; `dsh-ticktick` waits on the `R8` refinement in 0.3.2, and the rest have no gate committed yet. New adopters should pin the **newest published** version — currently 0.3.2.

> Every 0.2.0 change is **additive** (new fields / new options / new exit codes); the criteria for the existing 37 repos are unchanged, verified against the 37-repo baseline with **diffs = 0**.

### Authorship of the criteria

The verification criteria — not only the tool that implements them — were
authored by **PerryLink** (<https://github.com/PerryLink>). Their normative text
is [`SPEC.md`](SPEC.md), and this repository is the canonical source for both the
specification and the reference implementation. See [`GOVERNANCE.md`](GOVERNANCE.md)
for how the criteria change and for what attribution is requested (versus
required by Apache-2.0 §4(d) via [`NOTICE`](NOTICE)).

Adopting the gate needs no permission. If you adopt it, please keep the criteria
attributed to PerryLink and do not present them as your own standard.


### Public result sets

- [`THIRD-PARTY-RK-SCAN.md`](https://github.com/PerryLink/dsh-plugin-doctor/blob/main/THIRD-PARTY-RK-SCAN.md) — the first static R+K scan of **third-party** (non-PerryLink) dsh plugins: 60 candidates → 20 plugins that really declare `dsh.bundle.patch` → under the 16-check gate, **10 passed / 10 failed**. Method: read-only clones, **zero execution** of third-party code, R2/R4 listed separately and not gated; it includes the reproduction commands, a correction to this scan's own methodology, and a **correction channel for any repo named in it**. Machine-readable form: `data/rk-scans.json`.
  **It is not a certification, not a rating, and says nothing about a plugin's security**: a pass means only that "the 16 static checks reported no failure on that commit".

## PerryLink DSH Plugin Family

This project is one of the **45 DeepSeek Harness plugins** maintained by [PerryLink](https://github.com/PerryLink). If this one helps you, the others likely will too:

| Plugin | One-liner |
|---|---|
| **[dsh-auto-review](https://github.com/PerryLink/dsh-auto-review)** | Second-model auto-review on the approval chain, fail-closed by default | |
| **[dsh-autotier](https://github.com/PerryLink/dsh-autotier)** | Automatic strong/cheap model-tier routing with deterministic risk guards and a `/tier` command | |
| **[dsh-background-agents](https://github.com/PerryLink/dsh-background-agents)** | Durable background child agents with a Web UI sidebar, messaging and interrupt | |
| **[dsh-budget](https://github.com/PerryLink/dsh-budget)** | Cost governance for DeepSeek Harness: budgets, carbon, and latency in one panel. | |
| **[dsh-catalog](https://github.com/PerryLink/dsh-catalog)** | DSH Desktop Market standard catalog source for the PerryLink family | |
| **[dsh-cert-mcp](https://github.com/PerryLink/dsh-cert-mcp)** | Read-only MCP server exposing the certification registry: grades, snapshots and five-dimension evidence | |
| **[dsh-checkpoint-rewind](https://github.com/PerryLink/dsh-checkpoint-rewind)** | Claude Code /rewind-equivalent: snapshots, session forks, one-shot restore | |
| **[dsh-claude-move](https://github.com/PerryLink/dsh-claude-move)** | Migrate Claude Code sessions, memory, skills and CLAUDE.md into DSH | |
| **[dsh-click](https://github.com/PerryLink/dsh-click)** | Cross-platform native desktop control for DeepSeek Harness — Windows first. | |
| **[dsh-composer-history](https://github.com/PerryLink/dsh-composer-history)** | Terminal-style input history for the web composer: arrows, Ctrl+R search | |
| **[dsh-data-quality](https://github.com/PerryLink/dsh-data-quality)** | Dataset quality checks and citation cross-checks (the optional numeric bridge consumed here) | |
| **[dsh-defend](https://github.com/PerryLink/dsh-defend)** | Prompt-injection, jailbreak, and secret-leak defense for DeepSeek Harness. | |
| **[dsh-doublecheck](https://github.com/PerryLink/dsh-doublecheck)** | Engineering-discipline guard: requirements grill, test gates, adversary review | |
| **[dsh-draw](https://github.com/PerryLink/dsh-draw)** | Unified static-image generation routing for DeepSeek Harness. | |
| **[dsh-fast](https://github.com/PerryLink/dsh-fast)** | Read-only performance diagnostics for DeepSeek Harness. | |
| **[dsh-fund-research](https://github.com/PerryLink/dsh-fund-research)** | Deterministic research reports for Chinese public mutual funds | |
| **[dsh-github](https://github.com/PerryLink/dsh-github)** | GitHub PR/issues integration for DSH, every write gated by approval | |
| **[dsh-industry-research](https://github.com/PerryLink/dsh-industry-research)** | Industry research orchestration that seals its deliverables through this plugin's `ctx.researchReport.assemble` | |
| **[dsh-laya](https://github.com/PerryLink/dsh-laya)** | Laya typed decisions (`noul`/`choice`/`score`) as a first-class Cordis service and model-visible tools | |
| **[dsh-library](https://github.com/PerryLink/dsh-library)** | Local document knowledge base for DeepSeek Harness. | |
| **[dsh-local-ai](https://github.com/PerryLink/dsh-local-ai)** | Local-model (Ollama) integration for DeepSeek Harness. | |
| **[dsh-lsp-actions](https://github.com/PerryLink/dsh-lsp-actions)** | LSP diagnostics, formatting, completion, code actions and rename over language servers | |
| **[dsh-mask](https://github.com/PerryLink/dsh-mask)** | PII masking middleware: anonymize at the model boundary, restore at the display layer | |
| **[dsh-mcp-panel](https://github.com/PerryLink/dsh-mcp-panel)** | Read-only MCP runtime panel: /mcp command + Settings tab with status, tools and errors | |
| **[dsh-memento](https://github.com/PerryLink/dsh-memento)** | Approval-gated cross-session memory: ctx.memory seam + SQLite + memory tool | |
| **[dsh-observe](https://github.com/PerryLink/dsh-observe)** | OpenTelemetry and Langfuse observability exporter for DeepSeek Harness. | |
| **[dsh-output-styles](https://github.com/PerryLink/dsh-output-styles)** | Claude Code outputStyles-equivalent runtime style switching | |
| **[dsh-permission-rules](https://github.com/PerryLink/dsh-permission-rules)** | Claude Code-style declarative allow/deny/ask permission rules with audit | |
| **[dsh-plugin-certification](https://github.com/PerryLink/dsh-plugin-certification)** | Community certification registry with repro-checkable grades and badges | |
| **[dsh-plugin-doctor](https://github.com/PerryLink/dsh-plugin-doctor)** | Zero-dependency static + sandbox smoke detector for DSH plugins | |
| **[dsh-plugin-guide](https://github.com/PerryLink/dsh-plugin-guide)** | Plugin-development knowledge base as an on-demand agent skill | |
| **[dsh-plugin-kit](https://github.com/PerryLink/dsh-plugin-kit)** | Shared zero-runtime-dependency toolkit for the PerryLink DSH plugins | |
| **[dsh-plugin-upgrade](https://github.com/PerryLink/dsh-plugin-upgrade)** | One-package, one-corridor-index plugin upgrade skill: routes a repository to the matching closed corridor card | |
| **[dsh-plugin-upgrade-015](https://github.com/PerryLink/dsh-plugin-upgrade-015)** | Merged `0.1.3-alpha.1` → `0.1.5-rc.1` upgrade corridor card plus a zero-dependency seam scanner | |
| **[dsh-reach](https://github.com/PerryLink/dsh-reach)** | Multi-channel approval/question bridge: WeChat/Telegram/Feishu, session console | |
| **[dsh-research-report](https://github.com/PerryLink/dsh-research-report)** | Verifiable research-report engine: content-addressed evidence ledger and sealed versions | |
| **[dsh-score](https://github.com/PerryLink/dsh-score)** | Multi-dimensional quality scoring for DeepSeek Harness plugins. | |
| **[dsh-session-pin](https://github.com/PerryLink/dsh-session-pin)** | Pin sessions in the Web sidebar with durable ordering | |
| **[dsh-session-sync](https://github.com/PerryLink/dsh-session-sync)** | Cross-device session sync for DeepSeek Harness — a dedicated git mirror of your session store. | |
| **[dsh-skill-pack-security](https://github.com/PerryLink/dsh-skill-pack-security)** | Security-audit skill pack: secret scan, dependency and supply-chain review | |
| **[dsh-talk](https://github.com/PerryLink/dsh-talk)** | Voice-first session loop for DeepSeek Harness: talk to it, hear it answer. | |
| **[dsh-team-rooms](https://github.com/PerryLink/dsh-team-rooms)** | Cross-session team rooms: shared message bus, task board and timeline | |
| **[dsh-test-drive](https://github.com/PerryLink/dsh-test-drive)** | Isolated install-and-smoke test drives for DeepSeek Harness plugins. | |
| **[dsh-ticktick](https://github.com/PerryLink/dsh-ticktick)** | TickTick/Dida365 task bridge: session-header panel + 11 tools | |
| **[dsh-translate](https://github.com/PerryLink/dsh-translate)** | Vendor parameter translation and deterministic JSON repair for DeepSeek Harness. | |

