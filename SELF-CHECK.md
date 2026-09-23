# Self-check — does the standard pass its own gate?

A verification standard that exempts itself from its own criteria is not a
standard. This file records the tool's own result against [`SPEC.md`](SPEC.md),
so the claim can be checked rather than asserted.

## Result (2026-09-23, version 0.2.3, commit `87bb7ac`)

```
node doctor.mjs --repo . --no-smoke --only "R,K"
```

| | |
|---|---|
| **Verdict** | `SKIP` (worst status) — **no `fail`, no `error`** |
| Exit code | `0` — §3.2: no group was degraded, every requested group really ran |
| Counts | `pass=15  skip=2  warn=1` |
| `coverage.K` | `mode=src`, `filesInspected=2` (full intended coverage, not `lib-fallback`) |
| `checksetVersion` | `R0-R8+K1-K9+D0-D3,D9+CC1-CC5/1` |
| `degraded` | *(empty)* |

### The two skips are correct, not silent passes

| Check | Why it skipped |
|---|---|
| `R5` dependency policy | This package declares no `@deepseek-ai/cordis` dependency and has no `src/` to import it — it is a zero-dependency CLI, not a Cordis plugin. §4.1/R5 makes this an explicit `skip`, never a `pass`. |
| `R8` stale peer ranges | It declares no `@deepseek-ai/dsh*` or cordis peer at all. §4.1/R8 `skip`. |

Neither skip touches a gated check's meaning: `R5` and `R8` are two of the
sixteen gated checks, and both returned "not evaluated" rather than "passed",
which is exactly the distinction §2 and §3.2 exist to preserve.

### The one warning is a known, expected false positive

`K1` reports `ctx.sandboxRoots` (2 sites) and `ctx.coverage` (1 site) as services
accessed without `inject`. They are not services. `doctor.mjs` constructs a plain
context object and passes it to each check function; `sandboxRoots` and
`coverage` are mutable fields on that object, not host seams.

This is the `K1` heuristic behaving as documented in §5.1: it reports at `warn`,
which "never condemns a plugin by itself" and requires a human look. The
alternative — adding `inject: ['sandboxRoots', 'coverage']` to silence it —
would be worse: those are not real seams, and §4.2/K6 would then be told a false
thing about them. **The warning is left visible on purpose.**

## What this does and does not prove

- **Proves**: on this commit, no gated static criterion of `SPEC.md` fails for
  this repository, and the `K` group ran in full `src` mode rather than
  degrading.
- **Does not prove**: that the criteria are complete, that the tool is correct,
  or that `D` (sandbox smoke) passes. This run used `--no-smoke`, so `D0`–`D3`
  and `D9` were not evaluated at all — §4.3 requires network and `pnpm`.

To reproduce, run the command above from the repository root. To include the
dynamic group, drop `--no-smoke` and ensure `npm`, `pnpm` and network access are
available.

> `R2` and `R4` are reported but excluded from the gate, per §1: they read built
> artifacts. Both pass here.
