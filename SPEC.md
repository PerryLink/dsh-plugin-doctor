# dsh-plugin-doctor — Verification Criteria Specification

| | |
|---|---|
| **Spec version** | `v1` (checkset `R0-R8+K1-K9+D0-D3,D9+CC1-CC5/1`) |
| **Author / Editor** | **PerryLink** — <https://github.com/PerryLink> |
| **Canonical source** | <https://github.com/PerryLink/dsh-plugin-doctor> |
| **Reference implementation** | `@perrylink/dsh-plugin-doctor` (see `package.json`) |
| **Status** | Authored specification. Single-maintainer; see [`GOVERNANCE.md`](GOVERNANCE.md). |
| **Normative text** | This file. When this document and the implementation disagree, that is a defect in one of them — not a licence to read the implementation as the spec. |

## 0. Purpose and scope

This document defines a set of **verification criteria** for plugins of DeepSeek
Harness (dsh). Each criterion has a stable ID, a stated requirement, a defined
verdict vocabulary, and the first-hand evidence it traces to.

What this specification is **not**:

- It is **not a certification**. It states nothing about whether a plugin is
  safe, useful, or well-engineered beyond the specific requirement of each check.
- It is **not a security audit**. It performs no provenance or supply-chain
  attestation.
- It does **not** prove business logic correct. `D3` proves only that the
  composition boots as far as a model request.

The criteria were authored by PerryLink, and versioned as a specification rather
than left as an emergent convention, so that a result can be cited as
`dsh-plugin-doctor SPEC v1 §K3` and keep its meaning over time.

## 1. Conformance and citation

- **Conforming implementation.** A tool conforms to this specification at
  version `v1` if, for each check in §4, it emits a result carrying the check's
  ID and one of the §2 verdicts, decided by the §4 requirement. Conformance does
  not require using the reference implementation, and does not require
  permission.
- **Citing a result.** A result should be cited with the spec version, the check
  ID, and the commit or version tested — e.g.
  *"dsh-plugin-doctor SPEC v1 §R1 passed on `<sha>`"*. A citation without a
  version is not falsifiable and should not be treated as evidence.
- **The canonical gate.** The set of checks a project gates its CI on is its own
  choice and must be stated by that project. The reference project's own gate is
  `R0, R1, R3, R5, R6, R7, R8, K1–K9` (16 checks), deliberately excluding `R2`
  and `R4`, which read **built** artifacts. A project that gates a different set
  has not thereby conformed to the same claim.

### 1.1 Interoperating with the ecosystem check contract

During 2026-08 the ecosystem's plugin checkers converged on one interface: a
three-value status vocabulary (`PASS`/`WARN`/`FAIL`), exit codes `0`/`1`/`2`, and
a flat `checks` array carrying `{name, status, detail}`. It is written up as
[RFC #1846](https://github.com/deepseek-ai/deepseek-harness/discussions/1846),
and the reference implementations named there follow it.

This specification is **not** that contract. It is richer in three ways that
matter, and a conforming implementation must not silently discard them:

| This specification | The three-value contract | Why the difference is kept |
|---|---|---|
| five statuses, including `skip` | three | `skip` means **not evaluated**. Collapsing it into `pass` is the false-green this specification exists to prevent. |
| exit codes `3`/`4`/`5`/`6` | `0`/`1`/`2` | `4` (unsupported host) and `6` (degraded) are *not* plugin defects. Reporting them as `1` blames the plugin for the environment. |
| per-check `id`, `groupId`, `category`, `coverage` | `name`/`status`/`detail` | §3.3 makes the ID the citable, frozen handle. |

An implementation MAY therefore expose a **contract view** in addition to its own
output, provided that:

1. the contract view never changes whether a project passes — the two views must
   agree on pass/fail for the same run;
2. a check that returned `skip` is never presented as `PASS` in the contract view
   (the reference implementation reports it as `WARN` and marks it
   `skipped: true`);
3. any distinction the contract cannot express is either carried in an extra
   field or flagged as approximated — never dropped in silence.

The reference implementation provides this as `--format check`, and
`tests/compat.mjs` asserts all three properties, including that the default view
is unchanged.

## 2. Verdict vocabulary (normative)

Five statuses exist. Their meanings are fixed and may not be interchanged.

| Status | Meaning | Counts as a failure? |
|---|---|---|
| `pass` | The requirement was evaluated and holds. | no |
| `warn` | The requirement was evaluated and looks violated, **but the check is heuristic** and may be wrong. Requires human review; never condemns a plugin by itself. | no |
| `fail` | The requirement was evaluated and is violated. | **yes** |
| `error` | The check itself could not complete (doctor-internal fault). | **yes** |
| `skip` | The requirement was **not evaluated** — it does not apply, or its input was absent. | no |

Two additional classifications are orthogonal to status:

- **`critical`** — currently only `R1`. A failing critical check means the plugin
  cannot activate at all. Distinct from a normal failure.
- **`category`** — `plugin-defect`, `not-applicable`, `environment`,
  `infrastructure`, `unsupported-host`, or `unstable`. **`environment`,
  `infrastructure`, `unsupported-host` and `unstable` are never plugin defects.**

**`skip` is not a pass** (§3.2). A group whose checks all returned `skip` was not
evaluated, and reporting it as green is the specific false-positive this
specification exists to prevent.

## 3. Group structure and evaluation semantics

### 3.1 Groups

| Group | ID | Checks | Requires |
|---|---|---|---|
| Static · package structure | `R` | R0–R8 | the committed tree |
| Static · Cordis contract scan | `K` | K1–K9 | the committed tree |
| Dynamic · sandbox smoke | `D` | D0–D3, D9 | network, `npm`, `pnpm` |
| Ecosystem · directory listings | `CC` | CC1–CC5 | a workspace holding the listed directories |

`R` and `K` are **offline-capable**. `D` is not. `CC` verifies third-party
directory listings and is meaningful only alongside those directories.

### 3.2 Degradation (normative)

A requested group in which **every** check returned `skip` has not been
evaluated. Such a run is **degraded** and must not report success:

- the run reports the degraded groups, and
- a non-zero, distinct exit code is required unless degradation is explicitly
  accepted by the caller.

A run in which zero checks executed at all, or in which a requested group name
matched nothing, must also not report success. *Rationale: a mangled group name
once turned the CI gates of 35 repositories green while checking nothing.*

### 3.3 Verdicts do not depend on colour or language

Check IDs are ASCII and **frozen**: `R0`–`R8`, `K1`–`K9`, `D0`–`D3`, `D9`,
`CC1`–`CC5`. A check's human-readable label may be translated; its ID may not
change meaning. Implementations must expose the ID independently of any
translated display string.

### 3.4 K coverage modes (normative disclosure)

The `K` group scans source files discovered by a defined strategy, and must
disclose which mode it used:

| Mode | When | Meaning |
|---|---|---|
| `src` | the repository ships `src/` (plus root-level scripts) | full intended coverage |
| `lib-fallback` | no `src/`; the directory holding `main`, else `lib/`, else `dist/` | real coverage **but not equivalent** — a bundle is harder to read heuristically and K3–K7 may under-report |
| `none` | neither found | `K` did not run → §3.2 degradation |

A `lib-fallback` result must never be presented as equivalent to `src`.

## 4. The criteria

Legend: **Verdicts** lists the statuses the check can return.
`(critical)` marks §2 criticality. Every criterion below is normative.

### 4.1 Group R — static · package structure

#### R0 — Base manifest fields
**Requirement.** `package.json` declares `name`, `version`, `license` (SPDX) and
`type`; the repository ships `README.md` and a `LICENSE` file.
**Verdicts.** `warn` (any field missing — listed) · `pass`.
**Note.** `warn`, not `fail`: these are publication-readiness fields, and npm
itself accepts packages lacking several of them.

#### R1 — Activation gate `dsh.bundle.patch` **(critical)**
**Requirement.** `package.json` declares `dsh.bundle.patch` as a non-empty
string.
**Verdicts.** `fail` · `pass`.
**Failure meaning.** The package installs as an ordinary dependency and the host
never adds it to `dsh.profile.bundles`. This is the **most silent failure mode**
in the ecosystem: the install succeeds, nothing errors, and the plugin simply
never activates. This is why `R1` is the only critical check.

#### R2 — Tarball integrity
**Requirement.** `npm pack --dry-run --json --ignore-scripts` succeeds, and the
resulting file list contains both the declared entry point and the declared patch
file, both non-empty; the tarball filename matches the package name and version.
**Verdicts.** `fail` · `pass` · `skip` (see the unbuilt-tree rule below).
**Requires.** A built tree. **Excluded from the canonical gate** (§1) — see
§5 for why.
**Unbuilt-tree rule.** When the entry resolves into a build-output directory
(`lib/`, `dist/`, `build/`, `out/`, `esm/`, `cjs/`), that file is absent, and
`files` is declared and *does* cover it, the check reports `skip` with category
`environment` rather than `fail`. An absent build output on a tree that was never
built is an environment fact, not a plugin defect. If `main` points into `src/`,
or the build output is missing from `files`, the check still **fails** — those
defects survive a build.

#### R3 — `cordis.patch.yml` structure (heuristic)
**Requirement.** The declared patch file exists; after comment lines are
removed it contains an `- insert:` structure and at least one `id:` line; every
`name:` equals the package name or is namespaced under it.
**Verdicts.** `skip` (no declared patch) · `fail` · `pass`.
**Why `id:` is required.** Row ids are how a patch line is located for whole-row
replacement upstream.
**Why `name:` must be the package name.** The row is resolved through the
profile's `node_modules`; a name that is not the package name will not resolve.
**Limit.** Heuristic. `D2` is the authoritative check for layer insertion.

#### R4 — Entry contract
**Requirement.** The entry file named by `main`/`exports` exists and exports
both `apply` and `name`; a declared `inject` array contains only string literals.
**Verdicts.** `fail` (entry missing) · `warn` (exports or `inject` shape
suspect) · `pass` · `skip` (unbuilt tree — same rule as R2).
**Requires.** A built tree. **Excluded from the canonical gate** (§1, §5).

#### R5 — Dependency policy
**Requirement.**
1. No bare `cordis` or bare `schemastery` in `dependencies`,
   `peerDependencies` or `devDependencies` — the rescoped
   `@deepseek-ai/*` names are required.
2. If source imports `@deepseek-ai/cordis`, it must be declared.
3. `@deepseek-ai/cordis` must be declared as `peerDependencies` **and**
   `devDependencies`, not as `dependencies`.
4. `@deepseek-ai/dsh` must not be a direct `dependencies` entry (the host
   provides it).

**Verdicts.** `fail` · `pass` · `skip` (no source files **and** no cordis
declaration — explicitly **not** a pass).
**Failure meaning.** A bare `cordis` dependency resolves to the unscoped v3
line, not the host's rescoped v4 instance — the plugin gets a different registry
than the host and its services do not connect.

#### R6 — Node engine declaration
**Requirement.** `engines.node` must be compatible with the official
`^22.19.0 || >=24.0.0`.
**Verdicts.** `fail` (declares Node 23 only — the official line excludes 23) ·
`warn` (absent, or an intersecting range needing human confirmation) · `pass`
(exact agreement).
**Note.** Advisory on npm-line hosts, whose packuments do not enforce
`engines`.

#### R7 — Prebuild and `files` allowlist
**Requirement.** `main` does not point into `src/` (npm publication must ship
built output); a `files` allowlist is declared and covers both the entry point
and the patch file.
**Verdicts.** `fail` · `pass`.
**Failure meaning.** A missing or incomplete `files` allowlist silently drops
the entry point or the patch file from the published tarball — the package
installs and never activates.

#### R8 — Stale peer ranges (dual-baseline lesson)
**Requirement.** No `@deepseek-ai/dsh*` or cordis peer range names a
superseded prerelease line (`0.1.0-rc.*`, `0.1.1-rc.*`, `0.1.2-alpha.*`,
`0.1.3-alpha.*`), and no such range is a **single-arm** prerelease-tuple range.
**Verdicts.** `skip` (no dsh-related peer) · `fail` · `pass`.
**Failure meaning (single-arm).** `>=0.1.2-rc.1 <0.2.0` without `||` admits only
the one prerelease it names and **rejects** `0.1.5-rc.1` — the plugin appears
compatible while being uninstallable on the current host line.

### 4.2 Group K — static · Cordis contract scan

All `K` checks return `skip` when no source files were discovered (§3.4), and
all are **heuristic** — `warn` never condemns a plugin by itself.

#### K1 — Service access vs `inject` declaration
**Requirement.** Every `ctx.<service>` access is either a Context intrinsic, or
declared in `inject`, or obtained through `ctx.get(name)`.
**Verdicts.** `skip` · `warn` · `pass`.
**Failure meaning.** A hard dependency accessed without `inject` throws
*"cannot get property … without inject"* at runtime.

#### K2 — Live-data serialization red line
**Requirement.** A Context must not be serialized, cloned or spread —
`JSON.stringify(ctx…)`, `structuredClone(ctx…)`, `{...ctx…}`.
**Verdicts.** `skip` · `fail` · `pass`.
**Failure meaning.** Context is a Proxy; serializing it loses `def`/use-site
tracking or trips proxy traps. Unlike its neighbours this check is a **hard
fail**, because the construct is unambiguous.

#### K3 — Timer and listener lifecycle
**Requirement.** A timer or global listener must be wrapped in `ctx.effect`
(equivalently `ctx.on`) or explicitly self-cleaned via the matching
`clearTimeout`/`clearInterval`/`unref`/`removeEventListener`.
**Verdicts.** `skip` · `warn` · `pass`.
**Failure meaning.** The resource is not reclaimed on unload → HMR leaks.

#### K4 — Schema containing a function
**Requirement.** A file that defines a `Schema` must not also introduce arrow
functions into it — function values cannot be validated or persisted.
**Verdicts.** `skip` · `warn` · `pass`.

#### K5 — `apply` return shape (v4 Effect contract)
**Requirement.** A legal effect return: a disposer function, `null`,
`undefined`, `Promise<disposer>`, or an (async) iterable. Anything else throws
`TypeError("Invalid effect")`. An `async apply` is legal **but** must return a
`Promise<disposer>`; until it settles the fiber stays `LOADING` and its services
are invisible to dependents.
**Verdicts.** `skip` · `warn` (async `apply` present — reminder of the
settle-before-visibility rule) · `pass`.

#### K6 — `inject` service names are known seams
**Requirement.** Each injected service name is a known host seam, is namespaced
(contains `.`), or is `provide`d by the plugin itself.
**Verdicts.** `skip` · `warn` · `pass`.
**Failure meaning.** An unknown name leaves the fiber permanently `PENDING` and
`apply` never runs.

#### K7 — v3 legacy APIs
**Requirement.** No use of APIs removed in Cordis v4: `ctx.using/scope/runtime/
lifecycle/collect/accept/decline/alias/off/fork`, `ctx.config` (→
`ctx.fiber.config`), `ctx.start()/stop()` (→
`fiber.await()/dispose()/update()`), and the v3 `inject: {required, optional}`
shape (→ `string[]` or `{name: interceptConfig}`, optional via `ctx.get`).
**Verdicts.** `skip` · `fail` (hard list) · `warn` (soft list: `reusable`/
`reactive` metadata, `using` metadata, v3 `Service` style, returning a
`{dispose}` object) · `pass`.

#### K8 — `Config` must be a Standard Schema validator
**Requirement.** `export const Config` must be a Schema, not a plain object
literal. A plain object exported as `Config` **does not work**.
**Verdicts.** `skip` · `fail` · `pass`.

#### K9 — Plugin `name` special case
**Requirement.** An object plugin must not set `name: 'apply'` — the framework
resets it to `undefined` (registry special case), destroying the diagnostic
name.
**Verdicts.** `skip` · `warn` · `pass`.

### 4.3 Group D — dynamic · sandbox smoke

Runs against a **sandbox environment**, never the developer's real one, and
never executes the tested package's install/prepare scripts.

#### D0 — Package tarball
**Requirement.** `npm pack --ignore-scripts` succeeds and the tarball is written
into the sandbox, not into the tested repository.
**Verdicts.** `fail` · `pass`.

#### D1 — Install smoke and bundles assertion
**Requirement.** The host installs from the tarball and
`dsh plugin --profile headless add <tarball>` (with `--ignore-scripts`) places
the package name into `dsh.profile.bundles`.
**Verdicts.** `skip` (D0 failed) · `fail` · `pass`.
**Not plugin defects:** a missing `pnpm`/`npm` (`infrastructure`); a host
version that will not install (`unsupported-host`); a pnpm `ignored-builds`
block (`environment`, reported as `skip` — see §5).

#### D2 — Layer verification (`--dump-config`, no boot)
**Requirement.** `dsh --profile headless --dump-config` emits the layer marker
`# == <package name>` — i.e. the patch entered the composition layer.
**Verdicts.** `skip` · `fail` · `pass`.

#### D3 — Keyless headless smoke (`MISSING_CREDENTIAL` criterion)
**Requirement.** Running the profile with no credentials must terminate with
**exit 1 and `dsh: MISSING_CREDENTIAL`** on stderr/stdout. That specific pair
proves the composition booted, the plugin's `apply` succeeded, and the request
reached the model layer.
**Verdicts.** `skip` · `fail` · `pass` (also `pass` on exit 0 — a credentialed
environment completed the run).
**Explicitly fatal:** `NO_ADAPTER`, `ERR_MODULE_NOT_FOUND`, `SyntaxError`,
`TypeError`, `ReferenceError`, `Cannot find module`.
**Limit.** Proves the composition boots to a model request. It does **not**
prove tool schemas are valid or business logic is correct.

#### D9 — Sandbox quarantine
**Requirement.** The sandbox is **quarantined, not deleted**; the run prints the
quarantine path, and removal is a separate, explicitly invoked step.
**Verdicts.** `pass` · `fail`.

### 4.4 Group CC — ecosystem · directory listings

Each `CC` check targets a specific third-party channel and returns `skip` when
that channel's data is not present in the workspace — never a failure.

#### CC1 — Certification registry (spec v1)
**Requirement.** If the repository appears in the certification registry, its
entry carries `grade`, `snapshot`, and `evidence` for all five dimensions
(`manifest`, `buildHygiene`, `supplyChain`, `releaseIntegrity`, `installSmoke`),
no `veto`, and `installSmoke ≠ install-fail`.
**Verdicts.** `skip` (registry absent, slug unresolvable, or not listed) ·
`warn` · `pass`.

#### CC2 — `adp-list` entry
**Requirement.** If listed: `url`, `name`, `category` present; `category` in the
23-value enum; `url` consistent with the repository; a single-line
`description.en`; and any `tarball` hosted as an `https` `.tgz` on a GitHub
Release.
**Verdicts.** `skip` · `fail` · `pass`.

#### CC3 — Market catalogue entry (`dsh-catalog`)
**Requirement.** If listed: `npm`, `repo`, `displayName`, `categories`,
`summary` present; `repo` consistent; `categories` a non-empty array; `summary`
≤ 1000 characters, containing no install-command text, and not truncated
(must end on a punctuation mark).
**Verdicts.** `skip` · `fail` · `pass`.

#### CC4 — `dshWorkshop` manifest
**Requirement.** If `dshWorkshop` is declared, `lifecycle.activation` must be
one of the five enumerated values.
**Verdicts.** `skip` · `fail` · `pass`.

#### CC5 — Family triple gate — **not an ecosystem standard**
**Requirement.** *(PerryLink-family policy, scoped deliberately.)* Apache-2.0
licence, five-language READMEs, and the three seam roles, as checked by the
`dsh-plugin-kit` verification CLI.
**Verdicts.** `skip` — reported as **not-applicable** — when run outside a
PerryLink workspace, i.e. when the kit CLI is absent · `fail` · `pass`.
**Scope limit (normative).** These three gates are **PerryLink-family standards,
not ecosystem standards**. They must not be applied to an unrelated third-party
repository, and a non-family project failing them has not necessarily done
anything wrong. An earlier implementation applied them anyway and reported every
outside repository as failing; §4.4 exists so that this cannot recur.

## 5. Known limits (normative disclosure)

An implementation conforming to this specification must not overstate results.
Specifically:

1. **`K` is heuristic.** K1, K3 and K4 both miss complex wrappers and raise
   false alarms. Every `warn` needs a human look and never condemns a plugin.
2. **`R2`/`R4` read built artifacts** and cannot be evaluated on an unbuilt
   source tree. Most third-party repositories do not commit `lib/`. Folding
   them into a verdict without disclosing this produces false failures — this
   happened, and `THIRD-PARTY-RK-SCAN.md` records the correction.
3. **`D3` proves boot, not correctness.** See §4.3/D3.
4. **`R5` and `R8` encode policy.** A legitimate project with different
   dependency or peer conventions can fail them without being defective.
5. **`R6` is advisory on npm-line hosts**, which do not enforce `engines`.
6. **A pnpm `ignored-builds` block is an environment recipe problem**, not a
   plugin defect. It is reported as `skip` with `category: environment`.
7. **`CC5` is family policy** (§4.4).
8. **Absence of a finding is not absence of a defect.** A `pass` means the
   stated requirement was met on the tested commit, and nothing more.

## 6. Change control

See [`GOVERNANCE.md`](GOVERNANCE.md). In short:

- A **major** spec version changes or removes the meaning of a check ID.
- A **minor** spec version adds checks or strengthens evidence without changing
  what an existing pass meant.
- A **patch** changes wording, evidence URLs or clarifications only.
- A check ID whose meaning changes is a **new ID**. IDs are frozen for the same
  reason the `R0 `/`K1 ` output prefixes are: downstream CI greps them.

## 7. Provenance of the criteria

Every criterion traces to first-hand sources rather than to convention. The
full research record, with URLs, is in [`SURVEY.md`](SURVEY.md):

- **Harness side** — the publish documentation, the CLI plugin activation gate,
  the headless bundle's `MISSING_CREDENTIAL` criterion, the release history, and
  the official loader-smoke pattern.
- **Cordis side** — the cordiverse/cordis v4 source (registry / fiber / reflect
  / events), the DSH cordis primer and tutorial documentation, and a v3 type
  declaration diff producing the 3.x→4.x removal list in K7.
- **Ecosystem side** — the certification registry spec v1, the `adp-list`
  entry schema, the `dsh-catalog` validator, the `omdsh` build-submission
  rules, and the `dsh-plugin-kit` verification gates.
- **Upstream discussion** — the official plugin-scaffold RFC
  ([discussion #1629](https://github.com/deepseek-ai/deepseek-harness/discussions/1629)),
  which this specification's treatment of the scaffold and activation contract
  follows, and this project's own proposal to the harness maintainers
  ([discussion #1814](https://github.com/deepseek-ai/deepseek-harness/discussions/1814)).

**Status relative to upstream.** This is an independent specification authored by
PerryLink. It has been *proposed* to the harness maintainers for adoption; it has
not been adopted, and nothing here should be described as the official check.
See [`OUTREACH.md`](OUTREACH.md) for the current state of that proposal.
