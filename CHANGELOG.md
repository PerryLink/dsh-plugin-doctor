# Changelog

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
