# Outreach drafts — for PerryLink to review and post

Nothing here has been posted. Every draft is text to review, edit and publish
under your own account. Each one names the thread it targets and why it is worth
posting.

Last verified against the live threads: 2026-09-23.

---

## Draft 0 — the directory question is mostly already answered

**Status: research complete, three channels have live state.** Verified
2026-09-23 by checking each repository's real files and APIs, not by assuming
conventions.

### Already listed — no action needed

| Channel | Evidence |
|---|---|
| `awesome-dsh-plugin/awesome-dsh-plugin` (16.7k★, the canonical one) | `data/plugins/PerryLink__dsh-plugin-doctor.yml`, category `dev`, added 2026-09-20 via PR #5460. Its feed also reports `version 0.2.3` and `downloads 2538` |
| `Dominic789654/awesome-deepseek-harness` | present in **both** `README.md` and `README.zh-CN.md` |
| `hikariming/dshfind` | the badge API returns `dshfind: dsh-plugin-doctor — ★ 0` for this repo while a bogus one returns `not listed`, and the plugin page carries `PerryLink/dsh-plugin-doctor` 34 times. **However**, dshfind's search surface also carries *white-sand-grand's* different plugin under the same bare name, so a name-based lookup there lands on the wrong project. Verify by owner |
| `2BingLing/dsh-market` (dsh.market) | its 26 MB `plugins.json` contains `"id": "PerryLink/dsh-plugin-doctor"` |
| `deepseek1024.com` | listed, `Added 2026-09-13` — **but the page wrongly says "has not published an npm package"** while npm serves 0.3.1. No `/about` or `/submit` route exists; corrected by contact only |
| `dsh-market/dsh-market` (4.4k★) | **not a submission channel** — it is the app, not the catalog, and its README asks that plugin entries not be PR'd there |

### Genuine gaps — sites that do NOT list it

| Site | Reach | Mechanism | Note |
|---|---|---|---|
| **dsh.directory** | 4,616 plugin pages | issue form: `alexchenzl/dsh-plugin-directory/issues/new?template=plugin-submission.yml` | **CORRECTED — this was never a gap.** The earlier check searched the sitemap case-sensitively for `PerryLink` and got zero; the URLs are lower-case `perrylink`, and **29 packages were already accepted and live**. 44 submissions were then sent (#276–#319), of which **15 were genuinely new** and 29 were re-submissions. Full record: `OUTREACH-dsh-directory-submissions.md` |
| **dsh.works** (dshworks registry) | 13,756 entries | PR to `dshworks/awesome-dsh-plugins` → `data/plugins.json` | **35 other PerryLink repos are already in, and this one is not** — with open PR #107 in flight. Largest reach of any gap |
| `aust24lzy.github.io/dsh-plugin-hub` | 15,877 | own feed, auto-collected | feed is fresh (2026-09-23) and already carries 69 PerryLink rows |
| `ukinch605.github.io/awesome-dsh-hub` | — | own feed | 101 PerryLink rows present; this plugin absent |
| `kingselyjoe.github.io/awesome-dsh-list` | 1,008 | static HTML | data dated **2026-08-17**, which predates this repository's creation — stale, not editorial |

### Correction targets — listed, but the entry is wrong

- **deepseek1024.com** claims no npm package is published. It is: `0.3.1`, and
  the same page's own category/date fields are otherwise correct.
- **dsh.market** carries it with `"curated": false`. The vetted route is the issue
  form at `2BingLing/dsh-market/issues/new?template=submit_plugin.md`.
  Note the operator is `2BingLing/dsh-market`, **not** `dsh-market/dsh-market`.

### A method warning that cuts both ways

Grepping a repository for `PerryLink/dsh-plugin-doctor` gives false answers **in
both directions**, and this file has already been wrong once because of it:

- **False negative.** GitHub code search does not index large generated
  registries, so a zero result proves nothing. Repositories that DO list the
  plugin but are missed by `search/code` include `LivXue/dsh-plugin-shop` (877★),
  `Zhiyuan-Fan/Awesome-DeepSeek-Harness-Plugins` (568★),
  `Dominic789654/awesome-deepseek-harness`, `walkinglabs/…` and
  `2BingLing/dsh-market`.
- **False positive from the name collision.** Many catalogues list *a*
  `dsh-plugin-doctor` that is not this one — `lin-cheng-lab`, `zoahdev`,
  `white-sand-grand`, `Oo0520` and `Xrainsmile/DSH-Plugin-Doctor` all appear in
  real registries. On npm, both the unscoped `dsh-plugin-doctor` (Xrainsmile) and
  `dsh-doctor` exist and are different projects.

**And the decisive case: a repository can be a live aggregator that stores no
entry at all.** `dsh-market/dsh-market` (4.4k★) contains the string nowhere in
its own tree, which reads as "genuine gap" under any grep — and its README says:

> **This repo is the market app, not the catalog.** The plugin list comes from
> the curated awesome-dsh-plugin registry… Fetched live on every open from
> `awesome-dsh-plugin.com/plugins.json`.

That feed does contain the plugin (verified: two occurrences). So the app
displays it, and the grep was measuring the wrong thing. **Before recording
"absent", check whether the repository is a static catalogue or a live consumer
of one.** An earlier version of this file made exactly that mistake in the other
direction, calling `dsh-market/dsh-market` "not a submission channel" on the
strength of its README while getting the listing question right by accident.

### A hard gate worth knowing before approaching anyone

`PerryLink/dsh-plugin-doctor` has **0 stars**. `bruc3van/awesome-dsh-plugin`'s
CONTRIBUTING requires `stargazers_count > 10` for its **self-submission** lane, so
that lane is closed regardless of merit — the project is in that catalogue only
because a curator added it. Any submission route with a star or traction
threshold should be checked before writing the submission, not after.

### Confirmed listing catalogues (owner-verified, by reading the file)

`awesome-dsh-plugin/awesome-dsh-plugin` ·
`AdamPlatin123/dsh-plugin-radar` · `0xsline/awesome-deepseek-harness` ·
`LivXue/dsh-plugin-shop` · `Zhiyuan-Fan/Awesome-DeepSeek-Harness-Plugins` ·
`Dominic789654/awesome-deepseek-harness` ·
`walkinglabs/awesome-deepseek-harness-plugins` · `beancookie` ·
`bruc3van/awesome-dsh-plugin` · `diegosouzapw` · `imsai-sh` ·
`like-study1/Oh-My-DSH` · `YELEBAI/dsh-plugin-marketplace` ·
`2BingLing/dsh-market` · `unStone/dsh-xray` · `ysyyhhh/agent-ecosystem-observatory` ·
`ZeroPointRepo/awesome-dsh-plugins` · `helloHupc/dsh-plugin-hub` ·
`hikariming/dshfind` · `losebird/dsh-plugin-market` · `majiayu000/dsh-plugin-registry` ·
`wink-run/dsh-plugin-store` · `HaydenSmith1121/dsh-plugins` · `lwmxiaobei/dsh-plugins` ·
`billLiao/awesome-dsh-plugin` · `UntR/dsh-plugin-marketplace` ·
`hotpot-labs/awesome-dsh-industry-plugins` · `zhu1090093659/dsh-web`

That is a far wider footprint than this file previously recorded.

At least five repositories are called `dsh-plugin-doctor`: `lin-cheng-lab`,
`Oo0520`, `white-sand-grand`, `zoahdev` and PerryLink's. A name-based search or a
plausible-looking permalink therefore gives wrong answers **in both directions**:

- `dsh.works/p/dsh-plugin-doctor` returns **HTTP 200 with a matching title** and
  is `lin-cheng-lab`'s repository, not this one.
- The blog in the correction above reads as coverage of this project and is not.

Verify by owner, never by name. This is the same hazard the README's "Name
collisions" section warns about on the npm side.

### The binding constraint is stars, not more catalogues

A full sweep of 215 candidate catalogues reached a conclusion that should change
what gets worked on next: **the plugin is already in 33 of them, including every
high-star one that matters** — `awesome-dsh-plugin` (16.7k★),
`zhu1090093659/dsh-web` (7.9k★), `AdamPlatin123/dsh-plugin-radar` (1.5k★),
`0xsline` (1.1k★), `LivXue/dsh-plugin-shop` (877★), `Zhiyuan-Fan` (568★).

The gaps that remain are few, and the two most valuable have **no documented
submission route**: `dsh-market/dsh-market` (4.4k★ — no CONTRIBUTING or submission
doc among 259 files) and `pax-beehive/dsh-hub-cli` (448★ — CONTRIBUTING is
code-only). Absence of documentation is not proof a route is closed, but it is not
something to guess at either.

What actually gates further adoption is visible traction:

- `bruc3van/awesome-dsh-plugin` (360★) auto-rejects self-submission PRs below
  **`stargazers_count > 10`** — this repository has **0 stars**, so that lane is
  closed regardless of merit. It lists the plugin only because a curator added it.
- `Noob-stupid/dsh-plugin-gating-hub` indexes only the topic's **top 500 by stars**.
- npm search for `dsh-plugin-doctor` surfaces **Xrainsmile's** package, not this one.

**Star-building is therefore worth more right now than any additional catalogue
PR.** That is a different kind of work from what this file has been doing, and
better said plainly than buried under more submissions.

### Two method failures worth recording, because both bit this audit

1. **Code search gives false negatives.** It does not index large generated
   registries, and catalogues rewrite those files every 15–30 minutes. It missed
   at least eight genuine listings, confirmed by reading the files directly.
2. **Reused extraction directories give false positives.** A sweep that extracted
   several repositories into one reused directory let one repository's content
   leak into the next, producing false "lists it" results — and in one case it
   overturned a correct conclusion: `hikariming/dshfind` was reported as NOT
   listing this plugin. **It does.** Verified directly: the badge API returns
   `★ 0` for this repo (it returns `not listed` for an absent one, so the API
   discriminates), and the plugin page contains `PerryLink/dsh-plugin-doctor`
   **34 times** with **zero** occurrences of `white-sand-grand`, `zoahdev` or
   `lin-cheng-lab`.

   The lesson generalises: **a grep result is evidence about the grep, not about
   the catalogue.** Confirm a listing by reading the catalogue's own page or feed,
   and identify it by owner rather than by name.

### Could not verify

- **dshmarket.com** (a different operator from dsh.market) renders client-side
  from `awesome-dsh-plugin.com/plugins.json`, which does contain the plugin, so
  it is probably listed transitively — but the row itself was not observed.
  Do not claim it.
- **dsh.reshub.vip** — 26 PerryLink rows present and this one absent, but the
  site has no feed or docs and its `/plugins.json` is an SPA soft-404, so the
  listing mechanism is unknown.
- `dsh.directory` timed out once and then served 200 — flaky, not dead.

### Real remaining work — the GitHub collections

Beyond the sites above, a wider sweep found these catalogues with active
maintenance that do **not** carry the plugin. Treat each as a candidate, not a
confirmed gap: verify by reading the catalogue's own file at submission time,
because both grep directions mislead (see the method warning above).

| Catalogue | Stars | Note |
|---|---|---|
| `pax-beehive/dsh-hub-cli` | 448 | CLI for a hub; largest of this group |
| `Alex-Yanggg/awesome-DSH-plugin` | 98 | stale since 2026-08-15 |
| `Noob-stupid/dsh-plugin-gating-hub` | 88 | |
| `gityuanbao/DSH-Plugins` | 65 | stale |
| `vlln/plugin-registry` | 58 | |
| `AwesomeHou/dsh-plugin-marketplace` | 30 | |
| `alexchenzl/dsh-plugin-directory` | 27 | **submitted 2026-09-23** — 44 issues, #276–#319 |

1. **`dshworks/awesome-dsh-plugins` — PR #107 is open and mergeable** (CI green,
   `mergeable_state: clean` as of 2026-09-23). It needs a maintainer decision,
   not a rebase. Largest reach of any gap: 13,756 entries, and 35 sibling
   PerryLink repositories are already in while this one is not.
2. **`kejixiaoliang/awesome-dsh-plugins`** — open PR #98 conflicts with a
   star-sync bot that recommits every ~3 hours.
3. **`awesome-deepseekharness/awesome-deepseek-harness`** — PR #103 was closed
   because `.github/curator-policy.yml` puts `PerryLink` on a `watchlist`
   (one running PR at a time) with a 4-strike `self_promo` auto-close. That is
   author-level policy, not a plugin-quality objection.
4. **`bruc3van/awesome-dsh-plugin`** — already lists the plugin via curation, but
   its **self-submission lane is closed** to this repository: CONTRIBUTING
   requires `stargazers_count > 10` and the repo has 0. Do not spend an approach
   on it.

### Dead ends — do not spend effort

- `JoFe2/awesome-dsh-plugin` and `rob-x-ai/awesome-dsh-plugin` are forks of the
  canonical repository; the first has been frozen since 2026-08-21.
- `zoahdev/dsh-subscribe` has no PR path — its `registry.json` is a nightly
  mirror of the awesome-dsh-plugin feed, uncommitted since 2026-08-18.
- `dsh1024.com` does not respond at all (HTTP 000). The `dsh1024` CLI in the
  family READMEs points at `deepseek1024.com`, which is live.
- `kejixiaoliang`, `bruc3van` and `walkinglabs` publish GitHub repos only —
  their `*.github.io` sites return 404, so they are not website targets.

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
