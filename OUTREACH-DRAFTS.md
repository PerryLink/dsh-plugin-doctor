# Outreach drafts — for PerryLink to review and post

Nothing here has been posted. Every draft is text to review, edit and publish
under your own account. Each one names the thread it targets and why it is worth
posting.

Last verified against the live threads: 2026-09-23.

---

## Draft 1 — reply on RFC #1846

**Target:** <https://github.com/deepseek-ai/deepseek-harness/discussions/1846>
**Why this thread:** it is where the plugin-check contract is actually being
decided (11 comments, last activity 2026-08-18). It invites maintainer feedback
and explicitly says *"the cheapest moment to change is now"*.
**Why this reply is worth posting:** across all 11 comments, **nobody has raised
that the three-value vocabulary cannot express "not evaluated."** That is the one
gap where this project has both the argument and a running implementation.

Post as-is, or trim. The tone is deliberately "contribution", not "advert".

---

I'd like to raise one gap in the check contract before it is frozen, because it
is the failure mode this ecosystem has already been bitten by more than once.

**The three-value vocabulary (`PASS`/`WARN`/`FAIL`) has no way to say "not
evaluated".** So a check that *could not run* has to be reported as `WARN`, and
`WARN` already means something else: "evaluated, and suboptimal". A consumer —
CI, a marketplace, an agent — cannot tell the two apart, and the difference is
exactly the one that matters.

A concrete example from this thread. In the demo output in comment #2:

```json
{ "name": "entry", "status": "WARN", "detail": "entry lib/index.js not built yet" }
```

That `WARN` is not a judgment about the plugin. The entry was never inspected —
it did not exist yet. It reads as "evaluated and imperfect" when the truth is
"not evaluated". Three states are being encoded into two.

This is not hypothetical in this ecosystem. My own tool shipped this bug class
twice: the `K` group scanned `lib/**` only when `package.json` had no build
script, so published tarballs (which keep their build script) produced **zero
files inspected → every check skipped → exit 0**, and the CI gates of 35
repositories went green having checked nothing. The fix was not a better
heuristic; it was refusing to let "did not run" be reported as "passed", and
making a requested group that never really ran a **non-zero exit**.

**Proposal.** Either

1. add a fourth value (`SKIP` / `NOT_EVALUATED`), or
2. keep three values and add a boolean on the check object:
   `{ name, status, detail, skipped: true }`

I would argue for (2) if you want to hold the vocabulary at three — it is
additive, needs no consumer change, and is impossible to mistake for a verdict.

**Running implementation, so this is testable rather than hypothetical.**
`@perrylink/dsh-plugin-doctor` 0.3.0 emits both views from one run:

```
--format check   -> dsh-doctor/v1: { ok, contract, checks:[{name,status,detail,...}] }
                    exit 0 pass / 1 fixable / 2 not-a-plugin
(default)        -> this tool's own envelope: five statuses, exit codes
                    3 infrastructure / 4 unsupported host / 5 unstable / 6 degraded
```

In the contract view a `skip` becomes `WARN` **plus `skipped: true`**, and the
default view still exits `6` for a degraded run. The projection is required never
to change whether a project passes — asserted in `tests/compat.mjs`, alongside
the property that a `skip` is never rendered as `PASS`.

- Spec (the three properties are normative in §1.1): https://github.com/PerryLink/dsh-plugin-doctor/blob/main/SPEC.md
- Degradation rule: §3.2 of the same document.

One related suggestion while the shape is open: `exit 2` is described as "not a
plugin", but a run that **evaluated nothing** (mis-typed group, everything
skipped, host that would not install) currently has to share that code. Those are
different facts about the world, and a CI consumer acts differently on each. If
the vocabulary gains `skipped`, the exit contract probably wants a matching
value.

---

### Notes before posting

- The claim "35 repositories went green having checked nothing" is from this
  project's own changelog (`CHANGELOG.md`, 0.1.5 and 0.2.0 entries), measured
  2026-09-09. It is a self-report about this tool, not about anyone else's.
- The `entry: WARN` example is quoted verbatim from comment #2 of that thread.
  Re-check it has not been edited before quoting.
- I have **not** posted this. Posting under your account is your call.

---

## Draft 2 — interoperating with the other checkers

**Target:** an issue or discussion on `boyin111-1/dsh-doctor` and/or
`moonquake2004/dsh-doctor`.
**Why:** both converged on the same contract and are allies, not rivals. A
specification gains users by being citable.

---

Hi — I maintain `@perrylink/dsh-plugin-doctor`, one of the independent checkers
that converged on the same `PASS`/`WARN`/`FAIL` + exit `0`/`1`/`2` + flat
`checks[]` contract.

Rather than compete on the same ground, I've added `--format check`, which emits
that contract directly (`dsh-doctor/v1`, exit `0`/`1`/`2`), so either of our tools
can consume the other's output today. One thing worth comparing notes on: in the
contract view I map a check that did **not** run to `WARN` **plus
`skipped: true`**, because three values cannot express "not evaluated" and
`WARN` already means "evaluated and suboptimal".

The criteria themselves are specified, with stable per-check IDs, at
<https://github.com/PerryLink/dsh-plugin-doctor/blob/main/SPEC.md> — citable as
`SPEC v1 §K3`. `§1.1` states that an independent conforming implementation is
valid and this project will not claim otherwise. If any of it is useful to you,
take it; if a check ID disagrees with what your implementation does, that is
worth an issue against my spec.

---

### Notes before posting

- Do **not** post this on `zoahdev`'s threads. #1814 proposes adopting *their*
  project under the same name; arriving as a competitor reads badly regardless of
  the merits. Offer interoperability where the work is complementary.
- Keep it to one thread per maintainer, and only if they have shown interest in
  the contract. A cold "let's interoperate" message is spam.

---

## Draft 3 — external repositories with real findings

**Target:** maintainers of the repositories named in
[`THIRD-PARTY-RK-SCAN.md`](THIRD-PARTY-RK-SCAN.md) that have gated failures.
**Why the framing matters:** opening with a badge invitation is backwards — a
failing verdict plus an offer to wear a badge is an offer to display a red mark.
Open with a free, reproducible diagnosis instead.

**Do not mass-post.** One repository at a time, only where there is a real
finding, and only after re-running the scan on current HEAD (the published scan
is dated 2026-09-10 and those repositories have moved).

Template — fill the `<…>` from a fresh run:

---

Hi — I ran a static check over `<repo>` at `<sha>` and found `<n>` gated
failures. Flagging in case it is useful; no action needed from you, and ignore
this if the criteria do not fit your layout.

```
<exact reproduce command>
```

Result: `<check id>` — `<one-line meaning>`.

`<If the fix is small, state it here, e.g.:>`
`R7 is usually one line: add "lib/" to the files array in package.json. Here is`
`the patch: <link or inline diff>`

The criteria are specified at
<https://github.com/PerryLink/dsh-plugin-doctor/blob/main/SPEC.md> — `<check id>`
is §`<section>`. If the finding is wrong — a stale clone, a layout this heuristic
mis-reads — open an issue at
<https://github.com/PerryLink/dsh-plugin-doctor/issues> with your output and I
will re-run it and correct the row with the same prominence as the original.

---

### Notes before posting

- The corrections promise is already published in `THIRD-PARTY-RK-SCAN.md`.
  Honour it exactly; it is the price of having named those repositories publicly.
- Never open with the badge. Offer to help them go green first; the badge is
  their idea to have, not yours to sell.
- `THIRD-PARTY-RK-SCAN.md` is dated. Re-run before citing any row.
