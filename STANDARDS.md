# Standards mapping — DSH-ENTRY / DSH-FLOW / DSH-BOOST

> **Non-official.** This project is not affiliated with, endorsed by, or certified
> by DeepSeek. The three tracks below are the PerryLink-authored DSH standards
> (the private `PerryLink/dsh-standards` draft; public teaching copy: [dsh-plugin-guide/guide/standards.md](https://github.com/PerryLink/dsh-plugin-guide/blob/main/guide/standards.md)):
> they are **not** an official DeepSeek standard, not a certification, not a
> security audit, and not a ranking. The canonical machine-readable definition is
> `spec/levels.json` in that private project
> (`schema: "dsh-levels/1"`).

`dsh-plugin-doctor` answers exactly one of the three DSH questions: **can this
package be recognized and run as a DSH plugin?** The JSON envelope carries a
`standards` field that states which track the run actually evidences — and,
just as importantly, which it does not.

## Three questions, not three grades

| Track | Question | What doctor does |
|---|---|---|
| **DSH-ENTRY** | Can an existing plugin be recognized, installed, and booted? | **evidenced** by R / K / D, with X as supporting evidence |
| **DSH-FLOW** | Can a user install, configure, use, recover, upgrade, and uninstall it? | **not measured** — `manual`, checklist `J1-J8` |
| **DSH-BOOST** | Does it use Cordis primitives measurably better? | **not measured** — `not-measured`, evidence `LEV-1..LEV-8` |

They are three different questions, not a ladder. `DSH-BOOST` is a practice
library, not a higher grade; `DSH-FLOW` is not "better ENTRY". Certification
grades **A–D** (`dsh-plugin-certification`) are **orthogonal**: a grade is
quality/evidence depth, a track is adoption depth. Doctor never combines them,
never emits a score, and never turns a grade into a level.

## Crosswalk: doctor groups → ENTRY

| Doctor group | Checks | What it contributes to ENTRY | Strength |
|---|---|---|---|
| **R** static · package structure | R0–R8 | manifest, entry and `dsh.bundle.patch` shape (G0/G1), peer/dependency eligibility (G2), artifact loadability | static |
| **K** static · Cordis contract scan | K1–K14 | Cordis contract heuristics that predict boot/activation problems (G1/G3-adjacent) | static, heuristic |
| **D** dynamic · sandbox smoke | D0–D3, D9 | real `npm pack` → `dsh plugin add` → `--dump-config` → keyless headless boot (G0/G1/G3) | runtime |
| **X** host contract | X1–X5 | peer corridor with the host's own evaluator, `inject` service surface, patch-row locatability (G2/G3-adjacent) | static, supplementary |
| **CC** ecosystem · listings | CC1–CC5 | nothing — listings are not package compatibility | — |

X is **supplementary**. The canonical crosswalk lists doctor's ENTRY evidence as
`["R", "K", "D", "X"]`, but the `entry.status` projection is derived from R/K/D
alone, so a `--only X` run cannot silently promote a static run to `runtime`.
CC is never ENTRY evidence.

## ENTRY status rules

`entry.status` is one of `runtime`, `static`, `failed`, `not-run`:

| Status | Decided when |
|---|---|
| `failed` | any R/K/D check returned `fail` or `error`, or a critical check failed |
| `runtime` | R and K each ran at least one check, **and** D0–D3 all ran, with no `fail`/`error` |
| `static` | R and K each ran at least one check with no `fail`/`error`, but the D0–D3 runtime chain is incomplete |
| `not-run` | no ENTRY level can be established (e.g. every R/K/D check was skipped) |

Non-negotiable consequences:

- **A skip is never a pass.** A fully skipped group is not green; D1 skipping
  because `pnpm` is missing skips D2/D3 behind it, and the run is `static`, not
  `runtime`.
- **`static` is not a pass.** It means "recognizable from static evidence", not
  "runs". It covers the canonical `recognized`/`static` evidence states.
- **`not-run` is not a pass.** No evidence, no level.
- Individual R/K skips (for example R2/R4 on an unbuilt tree) stay visible in
  `evidence.*.skippedChecks`; they are disclosed, never counted as passes.
- Canonical evidence state `blocked` has no separate value in this projection. A
  D-group failure categorized `environment`, `infrastructure`, `unsupported-host`,
  `unstable` or `doctor-internal` still yields `failed` (the rule above), but is
  also listed in `evidence.*.notAttributable` and called out in `note`: it is a
  non-plugin block, not a plugin defect.

## What `runtime` here does and does not mean

Doctor's `runtime` means its own D0–D3 sandbox chain ran: tarball → install into
an isolated `DSH_HOME` → layer marker in `--dump-config` → keyless headless boot
reaching the model request (`MISSING_CREDENTIAL`). That is strong evidence, but
it is **not** a claim that the canonical ENTRY gates G0–G5 all passed:

- **G3** is approximated: D3 proves the composition boots to a model request, not
  that every target row is `ACTIVE` or `disabled`.
- **G4** (client shape: `dsh.client`, `exports["./client"]`, package-root row) is
  **not measured**.
- **G5** (freshness anchors: runtime version/commit/artifact mtime) is **not
  measured** in the canonical form; the report carries `startedAt`,
  `hostDshVersion` and `durationMs`, but not commit/mtime anchors.
- G2 is covered when X1 can read a host install; the report discloses when X
  falls back to the shipped host-surface snapshot.

## FLOW and BOOST are gaps, not failures

`levels.flow` is always:

```json
{ "status": "manual", "checklist": "J1-J8", "note": "doctor does not run user journeys" }
```

Doctor has no journey runner. R/K results are static package evidence, not
journey evidence; J1–J8 need the standards project's journey harness or a manual
run. A `manual` status says "not measured", never "passed".

`levels.boost` is always:

```json
{ "status": "not-measured", "evidence": "LEV-1..LEV-8", "note": "doctor does not benchmark" }
```

Doctor runs no LEV benchmark and collects no evidence cards. `not-measured`
never implies a BOOST claim, positive or negative.

## The field in the JSON envelope

The `standards` field is **additive**. It does not change stdout, exit codes,
`verdict`, the `results` array, or `--format check`:

```json
"standards": {
  "schema": "dsh-levels/1",
  "nonOfficial": true,
  "levels": {
    "entry": {
      "status": "static",
      "evidence": {
        "R": { "status": "skip", "ran": 7, "skipped": 2, "total": 9, "failed": [], "notAttributable": [], "skippedChecks": ["R2", "R4"], "criticalFailed": [] },
        "K": { "status": "pass", "ran": 2, "skipped": 0, "total": 2, "failed": [], "notAttributable": [], "skippedChecks": [], "criticalFailed": [] },
        "D": { "status": "not-run", "ran": 0, "skipped": 0, "total": 0, "failed": [], "notAttributable": [], "skippedChecks": [], "criticalFailed": [] }
      },
      "note": "R and K ran with no fail/error, but the runtime chain is incomplete (the D group was not part of this run). static is not a pass and must not be cited as runtime."
    },
    "flow": { "status": "manual", "checklist": "J1-J8", "note": "doctor does not run user journeys" },
    "boost": { "status": "not-measured", "evidence": "LEV-1..LEV-8", "note": "doctor does not benchmark" }
  }
}
```

(The example is abridged: each evidence entry also carries a `counts` object with
the five doctor statuses.)

## Files

- `lib/standards.mjs` — the pure projection (no imports, no fs, no clock, no process).
- `data/standards.json` — machine-readable group/check → ENTRY-gate map plus the FLOW/BOOST gaps.
- `tests/standards.mjs` — unit tests for every rule above, including skip-is-not-pass.
- `SPEC.md` §3.5 — the spec-level note that this field is additive.

## Canonical references

- Repository: private `PerryLink/dsh-standards` (draft; ask the maintainer)
- Public teaching copy: <https://github.com/PerryLink/dsh-plugin-guide/blob/main/guide/standards.md>
- Machine-readable schema: `spec/levels.json` (`dsh-levels/1`) in the private project
- ENTRY: `31-DSH-ENTRY入门规范.md` · FLOW: `32-DSH-FLOW顺畅规范.md` · BOOST: `33-DSH-BOOST加速实践.md`
- Three-track model: `34-三层分级模型-GB-GBT-GBZ类比.md`
