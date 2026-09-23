# For adopters

Everything needed to run this check on your own repository and say so publicly.
Nothing here requires permission, a token you do not already have, or contact
with anyone.

The criteria are specified in [`SPEC.md`](SPEC.md), authored by
**PerryLink** (<https://github.com/PerryLink>).

---

## Pick your path

| You want to… | Use | Needs |
|---|---|---|
| keep your repo correct, and show it with a badge | **[Path A](#path-a)** | nothing — self-serve |
| appear in a list audited by this project | **[Path B](#path-b)** | to be added to a registry by the maintainer |

**Start with Path A.** It is the whole standard and it cannot be broken by
anyone else's infrastructure.

---

## Path A

### 1. Add the gate

Copy [`plugin-doctor.yml`](plugin-doctor.yml) to `.github/workflows/plugin-doctor.yml`
in your repository. It is a complete, ready-to-use workflow — no edits needed
except, optionally, the pinned version.

It runs only static checks over your committed tree with `--no-smoke`. It does
**not** install dependencies, build, or boot anything, so it is fast and cannot
be broken by your build toolchain.

Two things in it matter more than they look:

- **The pin must be the scoped name at an exact version**
  (`@perrylink/dsh-plugin-doctor@<version>`). The bare npm name
  `dsh-plugin-doctor` is **a different project**; running it executes someone
  else's package and none of these checks run.
- **It does not read the exit code.** It greps `R0 ` / `K1 ` on stdout and
  inspects `results[].name` in the JSON. That shape is a frozen contract
  (`tests/contract.mjs` in the source repository asserts it), so the workflow
  keeps working across releases.

### 2. Add a badge

```markdown
[![dsh-doctor R+K](https://img.shields.io/github/actions/workflow/status/<owner>/<repo>/plugin-doctor.yml?branch=main&label=dsh-doctor%20R%2BK)](https://github.com/PerryLink/dsh-plugin-doctor/blob/main/SPEC.md)
```

Replace `<owner>/<repo>`, and `branch=` if your default branch is not `main`.

The badge makes **one** claim: *this repository runs the R+K criteria in its own
CI and that workflow is green on the default branch.* It is rendered by
shields.io from your workflow status. It is **not** a statement that this project
verified you, and it is not a certification.

### 3. Say what you conform to

If you want a precise statement, this one is supported by the badge above:

> Conforms to dsh-plugin-doctor SPEC v1 (`R0/R1/R3/R5/R6/R7/R8` + `K1–K9`),
> checked in CI. Criteria authored by PerryLink.

Please keep the criteria attributed to PerryLink and don't present them as your
own standard. That is a request, not a licence condition — see
[`GOVERNANCE.md`](GOVERNANCE.md).

---

## Path B

The project keeps an audited registry (`data/verified.json`) and issues its own
badge for repositories in it. This is a **centralized, single-operator service**:
it needs the maintainer's cross-repository token and CI.

To be considered, open a PR adding `{ "repo": "<owner>/<name>", "package": "..." }`
to `data/verified-repos.json`, together with the gate above. The entry is
re-audited by reading the GitHub API only — no third-party code is cloned or run.

Path B is currently **unavailable**: the audit token is unset, so every entry
reads `no-data`. Path A is unaffected. See the README's Verified section.

---

## Reading the result

| Status | What it means | What to do |
|---|---|---|
| `pass` | The stated requirement was met on the tested commit. | nothing |
| `warn` | The check is **heuristic** and thinks the requirement is violated. | look at it; it may be wrong |
| `fail` | The requirement is violated. | fix it |
| `skip` | The requirement **was not evaluated** — it does not apply, or input was missing. | nothing; it is not a pass |

`skip` is the one people misread. A check that returns `skip` did **not** pass —
it did not run. That distinction is the reason the gate exists.

**`warn` is not a verdict.** The `K` group is a heuristic static scan; it misses
complex wrappers and raises false alarms. Per `SPEC.md` §5, a warning needs a
human look and never condemns a plugin on its own.

### If you think a finding is wrong

That is a defect of this tool, not a fact about your repository. Open an issue at
[PerryLink/dsh-plugin-doctor/issues](https://github.com/PerryLink/dsh-plugin-doctor/issues)
with the reproduce command and your output. The row gets re-run and corrected
with the same prominence as the original.

---

## What this does not do

Stated up front, because overclaiming is how standards lose trust:

- **Not a certification.** No provenance, no supply-chain attestation, no
  statement that a plugin is safe.
- **Not a correctness proof.** `D3` shows the composition boots as far as a model
  request; it says nothing about your business logic. The static gate doesn't
  even run `D3`.
- **Not universal.** `R5` and `R8` encode PerryLink-family dependency and peer
  conventions, and `CC5` is family policy. An unrelated project can fail them
  without having done anything wrong. `SPEC.md` §4.4 and §5 scope each of these.
- **Not complete.** `R2` and `R4` read **built** artifacts and are excluded from
  the gate, because most repositories don't commit their build output. A green
  badge does not mean those passed.

## Requirements

- Node `^22.19.0 || >=24.0.0` (the gate workflow uses Node 22).
- The static gate needs no network, no install and no build.
- The `D` group (not used by the gate) needs network, `npm` and `pnpm`.
