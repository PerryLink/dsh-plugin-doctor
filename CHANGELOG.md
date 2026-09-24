# Changelog

## [0.4.4] - 2026-09-24

> Version note: the work below was prepared as `0.4.3`, and that version was **never
> published**. The `0.4.3` commit carried a `package.json` that did not parse, so the
> repair and this work shipped together as `0.4.4`. The tag and the package version now
> agree, which is what the release workflow's own guard checks.

### Fixed

- **`package.json` did not parse**, and the commit that broke it also shipped. Bumping the version through a PowerShell round trip (`Get-Content -Raw | Set-Content -Encoding utf8`) turned the CJK keywords into mojibake and dropped a character to a bare `?`, which is invalid JSON. The file is restored from the last good commit and edited with a UTF-8-preserving writer.
- **Six scratch scripts were committed into the release.** `git add -A` in a repository whose tooling writes scratch files into the root swept them in with the release. Removed, and the release used an explicit path list instead.
- **The CJK keywords had already been wrong since `7e6718f`** and were never verified. Checked by code point — `93BB 638D 6B22` rather than `63D2 4EF6` — and rebuilt from code points. Verified on the published artefact by fetching the registry document **as raw bytes**: the correct UTF-8 sequence appears three times and the double-encoded form zero times.
  - A note on that verification, because it nearly produced a false alarm: `Invoke-RestMethod` decoded the registry response as latin-1 and made correct UTF-8 look like mojibake. **The registry was never wrong; the reader was.** Byte-level checks are the only ones that settle an encoding question.

### Added

- **`R8` now detects open-top peer ranges** — a `>=` comparator with no upper bound. `>=0.1.0-rc.1` admits `0.5.0`, `1.0.0` and anything later, so a breaking host line is accepted by the range and the plugin loads against an API it never tested. That failure is silent, which is why it is worth naming.

  `^0.1.0-rc.1` does **not** have this problem: caret is semver sugar for `>=0.1.0-rc.1 <0.2.0`, so it is bounded even though the string contains no `<`. Measured across 22 third-party DSH repositories on 2026-09-24, the caret form is the prevailing convention — so the check separates a real defect from the ecosystem's normal practice instead of flagging every range without a literal `<`.

  Found by running the tool against those 22 repositories: `LuckVd/dsh-taskflow` has six open-top ranges, four of which name `0.0.1-rc.1` and were therefore **invisible to every earlier version** of this check.

- **`category: policy`** joins the vocabulary in `SPEC.md` §3.3. `warn` otherwise defaulted to `plugin-defect`, which contradicted `R8`'s own first line — a message reading "this is a policy staleness, not a plugin defect" filed under `plugin-defect` is a report that disagrees with itself. `R8` now reports `policy` for both its `fail` and its `warn`, matching §5.4 note 4, which already said `R5` and `R8` encode policy rather than correctness.

### Fixed

- **An `R8` failure no longer swallows its notes.** `>=0.1.0-rc.1` is both stale and open-top, and the failure branch returned early — so a repository would have seen only the cosmetic staleness and kept the range that admits a breaking host line. Both now appear, under an explicit "also, unrelated to staleness" heading.

### Verified

- The refined `R8` was run against **61 repositories** — the 43-repository family fleet plus the 22-repository third-party sample — before release. **No repository changed status except by gaining the new warning**, and the four third-party failures that exist are the same four as before the change. `dsh-ticktick` is the only family repository that warns, which is the intended outcome of the 0.3.2 refinement.

## [0.4.0] - 2026-09-24

### Added

- **`action.yml` — the gate is now a composite GitHub Action**, so a repository can adopt it with one step instead of copying a workflow file:

  ```yaml
  - uses: PerryLink/dsh-plugin-doctor@v0.4.0
    with:
      only: R,K
  ```

  Inputs: `report-dir`, `only`, `smoke`, `dsh`, `format`. Outputs: `verdict`, `exit-code`, `summary`, `failing`, `report-path`. No install step is needed — the tool has no runtime dependencies. Branding is set (`shield`, blue) for a Marketplace listing.

  The entry point resolves the tool through `GITHUB_ACTION_PATH`, not a relative path, because a composite action runs in the **caller's** workspace. That is the same class of mistake as a repository declaring a `bin` of the same name: the invocation, not the tool, decides which code runs.

### Fixed

- **The Action's `verdict` output emitted `[object Object]`.** `report.verdict` is an object (`{worst, ok, criticalFail}`), not a string, so a consumer would have stored a literal `[object Object]` as though it were a verdict. It now emits the readable `worst` value.
- **The summary assumed the `doctor` report shape**, so `--format check` — the ecosystem three-value contract — reported `gated=0`. Both shapes are now read: `.results` (lowercase status) and `.checks` (uppercase), normalised to one summary that names the format it read.

### Notes

- `action.yml` and `.github/actions/` are included in the published tarball, so the Action works from the npm package as well as from a git ref. Verified with `npm pack`: 23 files.
- **`verdict` is the *worst* status across the gated checks**, so a run with no failures reports `skip` rather than `pass` when any check was skipped. That is the tool's long-standing exit-code contract, now stated here because an Action output makes it visible to consumers who never read the exit code.

> **The Action's outputs were broken in the 0.4.0 release, and 0.4.0 is what npm serves.**
> `v0.4.1` and `v0.4.2` exist as git tags but were **never published to npm**: each was
> cut to test the fix and each was blocked by the smoke test until the output mapping
> was right. They are not listed as releases because they did not ship.
>
> The defect: a composite action's outputs must be mapped **explicitly** with
> `value: ${{ steps.<id>.outputs.<name> }}`. Declaring the names alone is not enough —
> the runner records `"outputs": {}` and every `steps.<id>.outputs.*` reference
> resolves to the empty string. The action ran correctly, printed its summary and
> wrote `GITHUB_OUTPUT` successfully; consumers still received nothing.
>
> It was found only by invoking the released Action from a real workflow. The local
> harness sets `GITHUB_OUTPUT` and reads the file back, so it reported five correct
> outputs while the runner reported none — a reminder that a test which supplies the
> environment it is testing cannot detect a missing environment.
>
> **Consumers should use `@v0.4.2` or later.** `@v0.4.0` runs and gates correctly, but
> its outputs are empty.

## [0.3.2] - 2026-09-23

### Fixed

- **`R8` turned a deliberate host choice into a red CI run.** The check flagged any single-arm prerelease-tuple range, on the correct reasoning that `>=0.1.2-rc.1 <0.2.0` without `||` silently rejects `0.1.5-rc.1`. But it could not distinguish that trap from a range naming a *current* line, and the second case is a choice about which host to support rather than a defect. The consequence was measured, not theorised: `dsh-ticktick`, whose peers are `>=0.1.7-alpha.1 <0.2.0`, **passed R8 on 0.1.6 and failed it on 0.3.1** — over a rule added after its ranges were written — so raising the family pin would have turned its gate red.
  - A range naming a **superseded** line (`0.1.0-rc.*`, `0.1.1-rc.*`, `0.1.2-alpha.*`, `0.1.3-alpha.*`) still **fails**. That is the trap the OR form exists to fix.
  - A **single-arm** range now reports `warn`, naming the real consequence — it excludes whatever line is `latest`, so the plugin will not install against the stable host — without condemning the package. `warn` does not fail a gate, so `dsh-ticktick` exits 0 again.
  - `SPEC.md` §4.1/R8 records the distinction, and `tests/contract.mjs` pins both directions: a superseded line must still fail, and a current-line arm must warn without producing a gated failure.

## [0.3.1] - 2026-09-23

Published via **npm Trusted Publishing (OIDC)** — no token involved. The
`NPM_TOKEN` secret had expired, which had blocked this work for several rounds,
so the release path was switched to a credential that cannot expire. See the
token rotation checklist, section 7.

### Fixed

- **`GOVERNANCE.md` and `CITATION.cff` were missing from the npm tarball.** Both
  were added to the repository in 0.3.0 but never added to `package.json`'s
  `files` list, so neither reached any adopter — and `CITATION.cff` is pointless
  unless it ships with the artifact it describes, because its whole purpose is to
  produce a correct author line for anyone citing the tool. Found by packing the
  published 0.3.0 tarball and listing it, not by reading the manifest.
- **A successful publish reported as a red run.** `softprops/action-gh-release`
  needs a tag, and on a `workflow_dispatch` run the ref is a branch, so the step
  failed after npm had already published — and no GitHub Release was created. The
  workflow now derives the tag from `package.json` and passes it explicitly, so
  the step works on both the tag-push and manual-dispatch paths.

### Added

- **`workflow_dispatch` on the publish workflow**, so a release can be retried
  after a credential fix without inventing a version. The tag-matches-version
  check is skipped for non-tag refs, where it is meaningless.

### Changed

- **The third-party scan is refreshed, and the refresh is re-runnable.** `THIRD-PARTY-RK-SCAN.md` was a 2026-09-10 snapshot from 0.2.0. A published result set that keeps asserting superseded verdicts is the documentation-that-lies failure this project exists to catch, so `scripts/refresh-third-party-scan.ps1` re-clones each candidate read-only, re-applies the qualification gate, re-runs the gate, and records the verdict — never installing, building or booting third-party code. Result: **19 qualified, 6 pass, 13 fail** (was 10/10). Comparing repository by repository, the `R3`/`R7` corrections changed **no** repository's verdict; the movement is entirely `R8`, which went from 3 to 9 without a line of code changing, because the ecosystem's peer lines moved on. That is an argument for re-running this on a schedule rather than treating a snapshot as standing fact.
- **`R8` now says what it means.** A peer pinned to a superseded release-candidate line is a package that *works* and has fallen behind this family's release train — staleness, not breakage. The verdict stays `fail` (the exit code is a frozen contract 42 downstream gates read) but the message now states the narrower meaning first, and `SPEC.md` §5.4 makes that scope limit normative. Without it, a third-party maintainer reading the output would reasonably conclude their plugin is broken.
- **Gate coverage 38 → 42 repositories.** `dsh-wechat`, `dsh-personal-directive`, `dsh-cert-mcp` and `dsh-plugin-kit` now ship `.github/workflows/plugin-doctor.yml`. Each was dry-run first and passes its own gate (exit 0, 16 gated checks, `R0 `/`K1 ` self-check green). `dsh-plugin-upgrade-016` is gate-eligible but was left alone: it sits on an active `ci/bootstrap-ops` branch. A regression sweep over 49 family repositories confirmed the R3/R7 changes turned **no** previously-passing repository red.
- **`R3` and `R7` stopped rejecting valid packages** (landed in the 0.3.0 build but first shipped to npm here — see the 0.3.0 entry for the detail).

## [0.3.0] - 2026-09-23

This is the release that actually ships the specification and the attribution.
Through 0.2.3 the published tarball contained neither `SPEC.md` nor `NOTICE` nor
the gate template, so `npx @perrylink/dsh-plugin-doctor` gave every adopter a
build in which the criteria had no author and no normative text.

It is a **minor** bump rather than 0.2.4 because it adds a CLI surface
(`--format`) and because `v0.2.4` was already tagged and published to the
repository while pointing at a commit that predates these documentation fixes —
moving a pushed tag would have been worse than bumping. `0.2.4` was never
released to npm; see its entry below for the failure record.

Everything in the 0.2.4 entry below is included here, plus the `--format check`
contract view and the documentation corrections.

## [0.2.4] - 2026-09-23 — repository tag only, never published to npm

This release is the one that finally **ships the specification and the
attribution**: through 0.2.3 the published tarball contained neither `SPEC.md`
nor `NOTICE` nor the gate template, so `npx @perrylink/dsh-plugin-doctor` gave
every adopter a build in which the criteria had no author and no normative text.

> **Not on npm.** The `v0.2.4` tag was pushed and the `publish` workflow ran,
> but the npm publish step failed with `npm error 404 Not Found - PUT
> https://registry.npmjs.org/@perrylink%2fdsh-plugin-doctor`. The `NPM_TOKEN`
> secret is present but not usable (invalid, expired, or lacking this package), so
> `latest` on npm is still **0.2.3**. The workflow correctly refused to report
> success. Its contents are superseded by **0.3.0**.

### Added

- **`--format check` — a view that speaks the ecosystem's plugin-check contract.** Three independent DSH checkers (this one, `zoahdev/dsh-plugin-doctor`, `boyin111-1/dsh-doctor`, `moonquake2004/dsh-doctor`) converged during 2026-08 on a three-value status vocabulary (`PASS`/`WARN`/`FAIL`), exit codes `0`/`1`/`2`, and a flat `checks` array — written up as [RFC #1846](https://github.com/deepseek-ai/deepseek-harness/discussions/1846). This project's envelope is deliberately richer (five statuses, seven exit codes, per-check ids and coverage), so no interoperating tool could read it. `--format check` restates the same run in the contract's vocabulary without changing it: the two views must agree on pass/fail, a `skip` is never rendered as `PASS` (it becomes `WARN` plus `skipped: true`), and anything the contract cannot express is carried in a `doctor` side field or flagged `approximated`. `SPEC.md` §1.1 makes these three properties normative. The default view is untouched, so the 38 downstream gates are unaffected. `tests/compat.mjs` asserts 25 of these properties, including that `--format check` and the default view never disagree.
- **`SPEC.md` — the criteria now exist as a versioned, citable specification.** Until now the 28 checks were defined only by the Chinese label string passed to `doctor.add()` in `lib/*.mjs`, with the ID derived from that display string by regex; a third party could not write "conforms to dsh-plugin-doctor SPEC v1 §K3" and have it resolve to anything, and `README.md`'s catalog was a five-row group table. `SPEC.md` gives every check a stable ID, its normative requirement, its verdict vocabulary, what a failure means, its scope limits, and change control — so a result can be cited and stay meaningful. Authored by PerryLink, who is named as such.
- **`NOTICE` + `CITATION.cff` + `GOVERNANCE.md` — attribution that travels with the artifact.** Apache-2.0 §4(d) requires a redistributor to preserve a `NOTICE` file; with no `NOTICE` present there was nothing to preserve, so attribution could not survive a fork. `GOVERNANCE.md` records who authored the criteria, how spec versions change, and separates what is *asked* (keep the criteria attributed to PerryLink) from what is *required* (the licence term).
- **`plugin-doctor.yml` at the repository root — the gate is shipped, not scraped.** The canonical workflow lived only in `reports/`, which `.gitignore` excludes and `package.json` `files[]` omitted, so every adopter had to reconstruct the 15-line step from a README code block. It is now a tracked, published file inside the npm tarball.
- **A self-serve badge path (README "Path A").** The existing badge is a centralized, single-operator service: an adopter must open a PR, the author must merge, and the author's CI must render the SVG with a PAT. That is a single point of failure, and it has failed — `data/verified.json` currently holds 37/37 `no-data` entries reading `repo lookup failed: 401 Unauthorized`, so every issued badge renders grey. Path A uses shields.io against the adopter's own workflow and needs no registry entry, no PR, and no token from anyone.
- `author` and `contributors` in `package.json` (both were absent, so the npm page named no author).
- **A guard that keeps `SPEC.md` from drifting away from the code.** A specification is a second source of truth, and one that disagrees with the implementation is worse than no specification: a third party citing `SPEC v1 §K3` must get what the code actually does. `tests/spec-drift.mjs` parses `SPEC.md` and asserts, against a real run, that §4 declares exactly the registered check IDs (28, both directions), that the §1 gate set matches the actually-gated set item by item, and that §2's single `critical` claim is the only one flagged in code. `tests/spec-drift-meta.mjs` then tests the guard itself — including that a declaration missing `K9` does *not* compare equal — so it cannot pass vacuously.

### Fixed

- **R2/R4 blamed the plugin for an unbuilt tree.** Both checks read *built*
  artifacts, and on a source tree that ships no build output — most third-party
  repositories, and every clone that has not been built — the entry is absent by
  construction. They reported that as `plugin-defect`, which is the tool telling
  a maintainer their plugin is broken when they had simply not run
  `npm run build`. A sweep of 15 family repositories found 4 mislabelled this
  way. Both now report `skip` with category `environment` when the entry resolves
  into a build-output directory, is absent, and is *correctly* covered by `files`.
  The condition is deliberately narrow: if `main` points into `src/`, or the
  build output is missing from `files`, the check still **fails**, because those
  defects survive a build. `tests/contract.mjs` now pins both directions (an
  unbuilt tree is not a defect; a real `files` defect is still a defect).
- **Two self-test sandboxes violated the host's protected temp namespace.**
  `tests/selftest.mjs` created `%TEMP%\dsh-doctor-selftest-*` and
  `%TEMP%\dsh-doctor-dash-*`. The host reserves the `%TEMP%\dsh-*` template, and
  the tool's own comment in `lib/util.mjs` records that the `doctor-` prefix was
  chosen precisely to avoid it — but the tests did not follow it, leaking two
  directories per run and never cleaning them up. Caught by the existing
  "no new `%TEMP%\dsh-doctor-*` directories" assertion. Both now use the
  `doctor-` prefix.
- **The Path B audit failed as one opaque line, 37 times.** With no usable `DOCTOR_AUDIT_TOKEN` the script fell back to the workflow-scoped `GITHUB_TOKEN`, which holds no cross-repository read permission and is therefore treated as an anonymous caller (60 requests/hour) — a full audit needs 200+. Every entry came back `no-data` with the identical `403 rate limit exceeded`, and an earlier run reported `401 Unauthorized`; both are configuration faults that read as a broken badge program. `scripts/verify.mjs` now stops at the first `401`/rate-limited `403`, exits `3`, and writes an all-grey registry whose reasons name the actual cause. The `GITHUB_TOKEN` fallback is gone: it could never have worked. `--allow-anonymous` (or `DOCTOR_ALLOW_ANONYMOUS=1`) keeps the local, partial-audit convenience but warns first.
- **`LICENSE` credited the wrong project.** The appendix copyright line read `Copyright 2026 dsh-memento contributors` — a different PerryLink plugin, inherited when the file was copied from a sibling repository. The Apache-2.0 text itself carries no other copyright line, so the only copyright statement in the licence named a project that is not this one. It now reads `Copyright 2026 PerryLink`. The same wrong line was present in 15 sibling repositories and has been corrected there too, each a verified one-line diff.

### Changed

- `README` version drift corrected: the body said "Current version 0.2.0" and pinned the gate example to `0.1.6` while `package.json` and npm were both `0.2.3`. New adopters are now told to pin the current version; the family's existing `0.1.6` pin is left untouched and explained.
- The README's inline gate YAML was replaced by a pointer to the shipped `plugin-doctor.yml`.

## [0.2.2] - 2026-09-12

### Fixed

- Add the missing `dsh-plugin` keyword. This was the only published `@perrylink/*` package without it, so `keywords:dsh-plugin` on the npm registry (41 of 42 packages matched) and the topic-driven directories that key off the same convention could not reach it by that route.

## [0.2.1] - 2026-09-12

### Fixed

- Widen the stale-peer-range detector beyond the single `>=0.1.0-rc.N <0.2.0` shape it was written for, and stop claiming the `--dsh` default is "npm 已发布 latest" (npm `@deepseek-ai/dsh` latest is `0.1.5-rc.1`). The default itself is unchanged: 38 downstream CI gates rely on it as a peer-floor smoke.

## 0.2.0

- **Silent-pass fixes (the load-bearing change)** — three ways this tool could return a green result without having actually decided anything are now closed:
  - The K group's source-file discovery required `!pkg.scripts.build` before falling back to `lib/**`. Published packages keep their `scripts`, so an installed-package directory or an unpacked tarball produced **zero files inspected → K1–K9 all skipped → exit 0**. The fallback no longer checks for a build script, and `main` is now `./`-stripped (family repos with `main: "./index.mjs"` never triggered the old fallback).
  - `R5` returned `pass` when there was no `src/` to scan ("a pure-JS repo may have no cordis runtime dependency"). It now returns `skip` — and it is one of the 16 gated checks.
  - A requested group whose checks all skipped is reported as **degraded** and exits **6** (use `--allow-degraded` to accept it explicitly). Previously only "zero checks executed" was caught.
- **New exit codes**: `3` infrastructure, `4` unsupported host (a host install failure is no longer reported as a plugin defect), `5` unstable, `6` degraded. `0/1/2` are unchanged, and the family gate never reads the exit code, so nothing downstream changes.
- **New options**: `--workspace/-w`, `--allow-degraded`, `--json -`, `--purge`, `-v/--version`. **Unknown options are now a usage error (exit 2)** — previously an unrecognised long option had its value assigned to `--repo`, silently retargeting the check.
- **JSON envelope v2** (`schemaVersion: "2"`): adds `doctorVersion`, `checksetVersion`, `target`, `env`, `coverage`, `groups`, `degraded`, `verdict`, `quarantine`, and per-result `id`/`groupId`/`category`. **`name` keeps its `R0 `/`K1 ` prefix — that prefix is a frozen contract** (the family workflow greps for `R0 ` and `K1 ` on the rendered output and splits `results[].name` on `/^R[24] /`).
- **Sandbox discipline**: `dsh plugin add` now passes `--ignore-scripts` (the target's install/prepare scripts never run on the host); pnpm's ignored-builds block is classified `environment` instead of being counted as a plugin result; `npm pack` writes into the sandbox (8 family repos had accumulated 17 stray `.tgz` files); the sandbox prefix is now `doctor-` so it no longer collides with the host's protected `%TEMP%\dsh-*` template; the sandbox is **quarantined, never deleted** (three-stage delete discipline) with `--purge` as the explicit third stage.
- **Report hygiene**: run-time absolute paths are replaced with `<path>` in both the JSON and the rendered text, so a report can be committed into someone else's repository without tripping their path-leak gate.
- **CC group semantics**: `CC5`'s three gates (Apache-2.0 / five-language READMEs / seam markers) are PerryLink-family standards, not ecosystem standards. Outside a family workspace it now reports `not-applicable` instead of failing any third-party repository (and instead of letting the whole CC group look like an environment failure).
- **Regression proof**: a 37-repo before/after baseline over the whole family (`--only R,K --no-smoke`) shows **zero item-level changes**; `tests/contract.mjs` freezes the five observables the family CI depends on; `tests/selftest.mjs` grows from 7 to 14 cases with the original 7 unchanged.
- **Release-path hardening (this repository's own CI)** — the same silent-pass class, closed one level up: `ci.yml` now runs `tests/contract.mjs` on every push instead of only inside the publish workflow, where a break would already have been shipped; and `publish.yml` no longer exits `0` when `NPM_TOKEN` is absent — a release that published nothing used to look green. A post-publish step now asserts the version is actually visible on the registry before the GitHub Release is created. (This supersedes the "skips cleanly when `NPM_TOKEN` is absent" wording in 0.1.5.)
- **Public result set**: `THIRD-PARTY-RK-SCAN.md` + `data/rk-scans.json` — the first static R+K scan of **third-party** (non-PerryLink) DSH plugins: 60 candidates → 20 that actually declare `dsh.bundle.patch` → **10 passing / 10 failing** under the 16 gated checks, with the method, this scan's own methodology error, and a corrections path for named maintainers. No third-party code was executed.

## 0.1.7

- **Gate form migration (family CI)**: the 36 plugin repos' `plugin-doctor.yml` no longer carries the `\u`-escaped `DOCTOR_ONLY` environment variable; the gate now runs `npx --yes @perrylink/dsh-plugin-doctor@0.1.6 --repo . --no-smoke --only "R,K"` directly, so the whole step is plain ASCII and self-explanatory. The R0/K1 self-check and the JSON gate (R2/R4 reported but gated by each repo's `ci.yml`) are unchanged. Rolled out canary-first (`gated 16 checks; build-dependent: R2=pass R4=pass`), then all 36 repos: 36/36 green, registry `gate=ascii-alias + self-check`, `doctorPinned=0.1.6`.
- **Registry discipline**: `scripts/verify.mjs` now labels the detected gate form (`ascii-alias` / `ascii-escaped` / `chinese-names`, each optionally `+ self-check`) instead of collapsing both ASCII forms into one label, and it fails the workflow loudly when *every* declared repo comes back `no-data` (expired `DOCTOR_AUDIT_TOKEN` or exhausted rate limit) while still committing the honest grey registry.
- **Docs**: README gate snippet, "状态" line and the family repo count now match the shipped gate. Published so the npm page matches the repository; the installed CLI surface is identical to 0.1.6.

## 0.1.6

- **Docs/design sync (no CLI behavior change)**: the README's verified-badge section now documents the final shipped badge design (monospace UPPERCASE + letter-spacing + shield-check mark + 5px corners; platinum/silver left panel with deep-navy label text; one solid GitHub-conventional state block on the right) and describes the family gate as reading the committed tree (no install/build; R2/R4 gated by each repo's own `ci.yml`). The "状态" section and CI snippet now pin 0.1.6. Published so the npm page matches the repository; `scripts/` and `badges/` are not in the npm `files` list, so the installed CLI surface is identical to 0.1.5.

## 0.1.5

- **Group aliases (encoding-safe)**: `--only` now accepts the ASCII aliases `R`, `K`, `D`, `CC` (case-insensitive) in addition to the Chinese group names. Chinese group names had silently rotted into double-encoded mojibake in 35 repos' `plugin-doctor.yml`, which made `--only` match nothing.
- **Refuse to pass silently**: an `--only` value that matches no registered group, or a run in which zero checks execute, now exits **2** with the available groups instead of the previous "0 checks, exit 0" false green. This is the root-cause guard for the mojibake class of bug.
- **`tests/selftest.mjs`**: seven real CLI cases (good fixture, alias case-insensitivity, single group, Chinese full name, unknown group, mojibake group, broken fixture) run in a `%TEMP%` sandbox; wired into `npm test`, `ci.yml` and `publish.yml`.
- **Verified badge program**: `data/verified-repos.json` (declared repos), `scripts/verify.mjs` (audits each repo's own `plugin-doctor` CI gate through the GitHub API — no cloning, no installing, no executing third-party code), `scripts/badge.mjs` (SVG renderer), `data/verified.json` (registry, generated by CI), `badges/<owner>__<repo>.svg`, and `.github/workflows/verified.yml` (daily + on push). Badge meaning: `dsh-doctor passing|warning|failing|no data` — the repo's own static R+K gate is green on the current default-branch HEAD. The gate covers 16 checks (R0/R1/R3/R5/R6/R7/R8 + K1–K9) on the committed tree; R2/R4 read built artifacts and are gated by each repo's own `ci.yml`. Not a certification badge: no Scorecard, provenance or install smoke.
- **Badge visual design (2026-09-09)**: modern grammar borrowed from the ecosystem's newer badges (dsh.directory: monospace UPPERCASE + letter-spacing + mark + gradient; awesome-dsh-plugin: seal block) — platinum/silver left panel with a shield-check mark and deep-navy monospace label (五行 金行主导 = 白/银/铂金, 水行 = 墨蓝), one solid GitHub-conventional state block on the right (green/amber/red/grey) with the state word plus a path-drawn glyph (check / exclamation / cross / dash), 5px corners, 1px border. Chosen by vision-model review of rendered candidates: gold as a pass color reads as a warning, a borderless platinum panel vanishes on white, and a thin state bar or tiny dot is unreadable at 20px — the solid state block won. Per-state gradient ids keep several badges safe to inline in one document.
- **Gate hardening after the 2026-09-09 sweep**: the family `plugin-doctor.yml` no longer runs install/build. A naive `npm run build` fails without the pinned harness aliases (`HARNESS_COMMIT` + `gen-aliases`) and its prebuild wiped the committed `lib/`, which produced 17 false-red gates. The gate now reads the committed tree only and reports R2/R4 without gating on them.
- **Repo infrastructure**: `ci.yml` (node 22/24: syntax check, self-test, `npm pack --dry-run`), `scorecard.yml` (OpenSSF Scorecard with `publish_results`), `publish.yml` (tag-triggered npm publish with provenance; skips cleanly when `NPM_TOKEN` is absent), README badge row.

## 0.1.4

- K1 no longer flags local type-parameter `ctx` declarations; K3 detects variable-level cleanup and checks the preceding line (three false positives removed; `dsh-github` K group is 9/9 PASS).

## 0.1.3

- R3 strips YAML comment lines before the heuristic scan; R5 treats a pure-JS repo with no cordis dependency as passing.

## 0.1.2

- `verdict.ok` follows the documented exit-code contract: `warn`/`skip` do not fail the run.

## 0.1.1

- Fix duplicated shebang in the entry file (ESM SyntaxError on first publish).

## 0.1.0

- First release: four layers — static package structure (R0–R8), cordis contract scan (K1–K9), keyless-headless sandbox smoke (D0–D3, D9), ecosystem listing checks (CC1–CC5). Zero dependencies, Node ≥22 built-ins only.
