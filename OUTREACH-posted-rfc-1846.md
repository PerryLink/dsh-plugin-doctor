One gap I would close before the contract freezes: **the three-value vocabulary has no way to say "not evaluated."**

`PASS` / `WARN` / `FAIL` all describe a judgment that was made. A check that could not run gets reported as `WARN`, which already means "evaluated, and suboptimal". A consumer — CI, a marketplace, an agent — cannot tell the two apart, and that difference is the one that matters.

There is a live example in this thread. Comment #2's demo output:

```json
{ "name": "entry", "status": "WARN", "detail": "entry lib/index.js not built yet" }
```

That `WARN` is not a judgment about the plugin. The entry was never inspected — it did not exist yet. Three states are being encoded into two.

I hit the same class of bug from the other direction and it cost real damage. My checker's `K` group discovered source files with a guard that required the package to have no `build` script before falling back to `lib/**`. Published packages keep their `scripts`, so for an installed package or an unpacked tarball the guard never fired: **zero files inspected → every check skipped → exit 0**. The CI gates of 35 repositories went green having checked nothing. The fix was not a better heuristic. It was refusing to let "did not run" be reported as "passed", and making a requested group that never really ran a distinct non-zero exit.

**Proposal.** Either

1. a fourth value (`SKIP` / `NOT_EVALUATED`), or
2. keep three values and make it additive: `{ name, status, detail, skipped: true }`

I would argue for (2) if you want to hold the vocabulary at three — it needs no consumer change and cannot be mistaken for a verdict.

**Testable today**, so this is not hypothetical. `@perrylink/dsh-plugin-doctor` 0.3.1 emits both views from one run:

- `--format check` → the `dsh-doctor/v1` envelope with the three-value contract (exit 0/1/2). A `skip` becomes `WARN` **plus `skipped: true`**.
- default → its own envelope: five statuses, and exit codes `3` infrastructure / `4` unsupported host / `5` unstable / `6` degraded.

The projection is required never to change whether a project passes, and specifically never to render a `skip` as `PASS`. Both properties are asserted in `tests/compat.mjs`, and §1.1 of the spec makes them normative: https://github.com/PerryLink/dsh-plugin-doctor/blob/main/SPEC.md

One related point while the shape is open: `exit 2` currently means "not a plugin", but a run that **evaluated nothing** — a mistyped group, everything skipped, a host that would not install — has to share that code. Those are different facts about the world and a CI consumer acts differently on each. If `skipped` lands, the exit contract probably wants a matching value.

Relevant to comment #5's artifact-failure pairs: an unevaluated check is the same failure mode one level up. A check that never ran cannot be evidence either way, and reporting it as `WARN` turns "we did not look" into "we looked and it is imperfect".
