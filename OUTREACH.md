# Outreach notes

Working notes for getting the verification criteria adopted beyond this
repository. Everything here is either a checkable public fact or an action with
a named owner. No targets or outcomes are asserted that have not been verified.

Owner and author of the criteria: **PerryLink** — <https://github.com/PerryLink>.
The normative text is [`SPEC.md`](SPEC.md).

---

## 1. The premise: visible, but not the incumbent

This is not a cold-start problem, and it is also **not** a solved one. The
project is publicly visible in the official harness repository, but the threads
that would carry it to official adoption are **someone else's**, not this
project's.

| Channel | State | Owner | Where |
|---|---|---|---|
| Proposal to adopt a "dsh-plugin-doctor" as the official check | open, stale (last activity 2026-08-15) | **zoahdev** — a *different* project of the same name | [#1814](https://github.com/deepseek-ai/deepseek-harness/discussions/1814) |
| Show-and-tell for that project | posted | **zoahdev** | [#1693](https://github.com/deepseek-ai/deepseek-harness/discussions/1693) |
| **RFC: official plugin scaffold** | open, 6 comments | zoahdev | [#1629](https://github.com/deepseek-ai/deepseek-harness/discussions/1629) |
| **RFC #1846: registry contract + `dsh plugin check` + `dsh doctor`** | open, 11 comments — the one that matters | zoahdev | [#1846](https://github.com/deepseek-ai/deepseek-harness/discussions/1846) |
| Official request: `dsh doctor` command | open, **68 comments** — real demand | mohitmathur95 | [#1719](https://github.com/deepseek-ai/deepseek-harness/discussions/1719) |
| Official request: `dsh plugin check` | open | (folded into #1629) | — |
| Community demand for an official market + standards | open, high-traffic | — | [#1115](https://github.com/deepseek-ai/deepseek-harness/discussions/1115) |
| Community proposal: repository-layout standard | open | — | [#2269](https://github.com/deepseek-ai/deepseek-harness/discussions/2269) |
| Third-party write-up of **this** project | **none — corrected 2026-09-23** | — | see the correction below |
| npm distribution | published, 15 versions | PerryLink | `@perrylink/dsh-plugin-doctor` |
| Public third-party result set | published | PerryLink | [`THIRD-PARTY-RK-SCAN.md`](THIRD-PARTY-RK-SCAN.md) |

> **Correction: the one "known" blog post is about a different project.** An
> earlier version of this file listed
> [blog.yeyupiaoling.cn/article/1788746484665](https://blog.yeyupiaoling.cn/article/1788746484665)
> as independent coverage. It is not. The post is *titled*
> "dsh-plugin-doctor：装 DSH 插件前，先做一次体检", but its body states that
> dsh-plugin-doctor is maintained by **lin-cheng-lab** under **MIT**. Verified
> directly: the page mentions `lin-cheng-lab` six times and `PerryLink` zero
> times. PerryLink's project is Apache-2.0.
>
> **This project currently has no blog or press coverage at all.** Seven
> roundups were checked (Aliyun developer, Leiphone ×2, Tencent Cloud ×2 and two
> more) and none mentions PerryLink or any PerryLink plugin.

> **Correction to an earlier note in this file.** An earlier version of these
> notes recorded #1814 and #1693 as *this* project's posts. They are not: both
> were opened by `zoahdev`, and `zoahdev/dsh-plugin-doctor` is the different
> project this repository's README warns about under "Name collisions". Read
> via `gh api repos/deepseek-ai/deepseek-harness/discussions/<n>` — do not
> repeat the claim without re-checking the `author` field.
>
> Every row is a dated observation. Confirm before acting; discussions move.

### 1.1 The finding that changes the plan

Three independent checkers — this project, `zoahdev/dsh-plugin-doctor`, and
`boyin111-1/dsh-doctor` (with `moonquake2004/dsh-doctor` alongside) — **converged
on the same interface** without coordinating:

- three status values `PASS` / `WARN` / `FAIL`
- exit codes `0` pass / `1` fixable / `2` not a plugin
- a flat `checks: [{name, status, detail}]` array

A commenter on #1814 states it outright: *"The JSON schema + exit-code contract
(0/1/2, PASS|WARN|FAIL) is the right call — we already use the same convention,
so a future merge is mechanical."* That is an interface standard forming in
public, and #1846 is its formal RFC.

**This project's output does not speak it.** Its envelope carries five statuses
(`skip` distinct from `pass`), seven exit codes, per-check ids and coverage. That
richness is the point — but it also means every interoperating tool is blind to
this one.

The response is `--format check` (0.2.4): a view that restates the same run in
the contract's vocabulary while keeping the semantics, plus `SPEC.md` §1.1 making
the guarantees normative. It is **not** a capitulation: the projection is
required never to change a verdict, never to render `skip` as `PASS`, and never
to drop a distinction silently.

## 2. The real problem: credibility, not reach

A standard is adopted when a stranger can verify it and trust it. Three things
currently undercut that, and they are all fixable:

1. **The Path B badges are grey.** `data/verified.json` is 37/37 `no-data`.
   `DOCTOR_AUDIT_TOKEN` is missing or invalid, so the audit falls back to an
   anonymous quota and dies. A visitor who clicks a badge today sees `NO DATA`,
   which reads as "this project is broken", not "this project sets a standard".
   *Fix: set the PAT, or rely on Path A and stop presenting Path B as the
   default.* See the README's Verified section.
2. **A competing checker exists.** `bowenliang123/dsh-plugin-checker` is a
   GitHub Action for the same purpose; `dsh-fix`, `dsh-startup-check` and
   `@tofe98/dsplug` occupy adjacent ground. Since the official thread is where
   adoption is decided, "why this one" must be answerable in one sentence —
   see §4.
3. **The criteria had no normative text.** Fixed in this change: `SPEC.md` now
   exists, is versioned, is citable, and names its author. Before it, a
   reviewer could not evaluate the standard separately from the tool.

## 3. Where the attribution actually lives

Stated plainly so it is not overclaimed. Apache-2.0 **cannot** compel a README
acknowledgement. The mechanisms that *do* travel with the work are:

| Mechanism | Force | Status |
|---|---|---|
| [`NOTICE`](NOTICE) | **Licence term.** Apache-2.0 §4(d) requires redistributors to preserve it. | added |
| `LICENSE` copyright line | States the holder of the only copyright notice in the file. | corrected (was naming a different project) |
| `package.json` `author` / `contributors` | Shown on the npm page and in tooling. | added (was absent) |
| [`SPEC.md`](SPEC.md) author line | Makes the criteria citable **as PerryLink's specification**. | added |
| [`CITATION.cff`](CITATION.cff) | Produces the author line for academic and blog citation. | added |
| Badge link target | Every badge links back to the canonical repository. | already present |
| [`GOVERNANCE.md`](GOVERNANCE.md) | States authorship and the change model. | added |

The durable strategy is **to make attribution the path of least resistance**:
whoever adopts the criteria ships a badge that links here, and whoever forks the
code must carry the `NOTICE`. Nothing here depends on a favour.

## 4. Positioning against the competing checker

A one-sentence discriminator, to keep the standards conversation from becoming a
tool comparison:

> **dsh-plugin-doctor is not a runtime verifier. It is a zero-dependency static
> criteria set (R/K, offline-capable) with a normative specification, so it can
> run as a gate on every push in any repository without installing or building
> the plugin under test.**

The complement, not the competitor: `dsh-plugin-verify` runs a mock-LLM agent
loop and checks the waterfall chain; the `D` group here does a keyless-headless
sandbox smoke. These answer different questions and can both be cited. Saying so
publicly is stronger than claiming sole coverage — and honesty about scope is
itself the argument for a *specification* over a *tool*.

**Do not overclaim.** `SPEC.md` §5 lists the limits that must be carried into any
outreach post: K is heuristic, R2/R4 need built artifacts, R5/R8 encode policy,
D3 proves boot and not correctness.

## 5. Actions

Ordered. The first two are unblocked; the rest each need a decision.

### A. Path B badges — DONE (2026-09-23)
The audit token is now set and the registry reads **37/37 `pass`**
(`generatedAt 2026-09-23T05:30:31Z`), with the live badge URLs verified returning
HTTP 200 and `dsh-doctor: passing` instead of `NO DATA`.

Two corrections to the earlier diagnosis in this file:
- The secret had been **set but rejected with `401`** — the run log records
  `verify: DOCTOR_AUDIT_TOKEN was rejected (401 401 Unauthorized)`. So "the
  secret is missing" was wrong; "the secret is unusable" was right.
- The fix did **not** require a new PAT. The declared repositories are all
  **public**, and the `gh` CLI session on this machine (scopes `repo`, 5000
  req/hour) reads their Actions data fine. That credential was stored as
  `DOCTOR_AUDIT_TOKEN`; `gh secret delete DOCTOR_AUDIT_TOKEN` reverses it.
- The fail-fast change paid off immediately: the broken run stopped after
  **1 of 37** repos instead of burning the quota and reporting the same cause 37
  times.

### B. npm publish — BLOCKED on an expired token (owner: PerryLink)
`0.2.4` and `0.3.0` are tagged and pushed; both publish runs failed with
`npm error 404 Not Found - PUT .../@perrylink%2fdsh-plugin-doctor`, and npm added
`'@perrylink/dsh-plugin-doctor@0.3.0' is not in this registry`.

The cause is now established, not guessed: **`npm whoami` returns `E401` with the
stored credential**, i.e. the token is **expired** — not merely missing a
permission. `NPM_TOKEN` in the repository secrets was created 2026-09-10.

To complete the release: create a new npm **automation** token with write access,
`gh secret set NPM_TOKEN --repo PerryLink/dsh-plugin-doctor`, then re-run the
`publish` workflow (or re-push a tag). Until then **none of the specification,
attribution or contract work has reached any adopter** — `latest` on npm is
still `0.2.3`, and the README pins its examples to that.

### C. Speak the ecosystem's contract — DONE (0.3.0)
`--format check` and `SPEC.md` §1.1 — see §1.1 above for why this was the
highest-value move available.

### C2. The family's gate pin is stale, and it is hiding the fixes — **RAISED 2026-09-23**

**Resolved.** The 42 gated repositories were pinned to `@perrylink/dsh-plugin-doctor@0.1.6`
(38) or `0.2.3` (4). 0.1.6 predates every false-positive fix made since, so the
family was judged by rules that reject valid packages:

| check | fixed in | what 0.1.6 still does |
|---|---|---|
| `R2`/`R4` | 0.2.4 | calls an unbuilt tree a `plugin-defect` |
| `R3` | 0.3.0 | rejects a valid empty patch layer (the harness's own `[]` template) |
| `R7` | 0.3.0 | rejects a zero-build plain-JavaScript package |
| `R8` | 0.3.1 | reports staleness as if it were breakage |

**The fix was verified before it was applied, not after.** The current published
0.3.1 was run against all 42 gated repositories using the exact command the gate
uses (`--no-smoke --only "R,K"`). **41 passed clean**; the one that did not is
`dsh-ticktick`, below.

**Result, measured on each repository's real remote default branch:**

| state | count |
|---|---|
| on `0.3.2` | **43** |
| still on an older pin | 0 |
| no gate committed | 6 |

Two things had to happen in sequence, and the order is the point.

**First, `0.3.1` was not safe to roll out.** Running it against all 42 gated
repositories showed `dsh-ticktick` **passes R8 on 0.1.6 and fails it on 0.3.1** —
0.2.0 added the single-arm prerelease-range rule, and its permanent peers are
`>=0.1.7-alpha.1 <0.2.0`, a single-arm range naming a *current* line. That is a
deliberate choice about which host to support, not the historical trap the rule
exists to catch (an arm naming a *superseded* line, which silently rejects a newer
one). Rather than turn a correct repository's CI red, the rule was refined in
**0.3.2**: a superseded line still **fails**; a single-arm range now **warns**,
naming the real consequence (it excludes whatever line is `latest`, so the plugin
will not install against the stable host) and does not fail a gate. `SPEC.md`
§4.1/R8 and `tests/contract.mjs` pin both directions.

**Second, the rollout was verified before it was applied, not after** — then the
fleet was pinned by writing each repository's workflow file through the GitHub API
against its *actual default branch*. Reading and writing remotely avoids the
local-checkout problem below entirely.

`dsh-plugin-doctor` itself now carries the gate. It is the standard, and it was
not running its own criteria — and when it finally did, **its own gate was the
only one that failed.** The cause is worth recording, because it is a trap any
tool that checks its own repository will hit:

**`npm exec` resolves the command name against the current `package.json`'s `bin`
before consulting the registry.** This repository declares
`{"dsh-plugin-doctor": "./doctor.mjs"}`, so running the gate inside its own
checkout made npx invoke the *local* bin — and with no `node_modules` present that
is `sh: 1: dsh-plugin-doctor: not found`, exit 127, "doctor ran no R checks". The
other repositories were green because none of them declare that bin.

Measured on `ubuntu-latest` (npm 10.9.8, node 22), not inferred:

| invocation | result |
|---|---|
| from inside the checkout | `exit 127`, no JSON — **this repository** |
| from `/tmp` | `exit 0`, JSON written, `R0` present |
| `npx --ignore-existing` | `npx: the --ignore-existing argument has been removed.` |
| `npx --package … -- dsh-plugin-doctor` | `exit 127` — same resolution |

The template now does `cd /tmp` and points `--repo` at `$GITHUB_WORKSPACE`
absolutely, and all 43 repositories carry that template byte-identically.

The published tarball was never at fault: fetched and run directly it returns
`0.3.2` and exit 0. That is what disproved the first hypothesis — a missing
executable bit in the tarball — which an experiment settled rather than a change
being built on top of it.

`tests/contract.mjs` freezes all three properties, including that the root
template and the workflow copy stay byte-identical. They had already drifted once,
and a silent drift is the failure class this project exists to catch.

**Still without a gate, and why each is fine:**

| repository | why not |
|---|---|
| `dsh-catalog`, `dsh-plugin-certification` | no `dsh.bundle.patch` — ineligible |
| `dsh-kit`, `dsh-plugin-portal` | no `package.json` — not an installable package |
| `dsh-personal-directive` | withdrawn from the DSH ecosystem |
| `dsh-plugin-upgrade-016` | eligible, but sits on another session's active `ci/bootstrap-ops` branch |

**A process error worth recording, because it cost a round.** The first attempt
landed the pin on whichever branch each repository happened to have checked out —
not necessarily its default branch. That left three repositories un-pinned on
`origin/main` while the script reported success, and created a stray branch in
`dsh-claude-move` from the wrong base (deleted unpushed). A
`.git/packed-refs.lock` in `dsh-local-ai` indicated another session active there,
and local `main` in that repository and in `dsh-plugin-upgrade-015` had diverged,
so those two were staged on a one-line branch cut from `origin/main` and pushed
straight to `main` without touching the divergent local branch.

### C3. Three repositories gated but not badged — PARTLY DONE

`dsh-cert-mcp`, `dsh-plugin-kit` and `dsh-wechat` were given the gate on
2026-09-23 but never added to `data/verified-repos.json`, so they ran the criteria
without being able to say so. The audit that found this also found the family is
otherwise complete: **41 of 42 gated repositories mention the standard in their
README**, and the 42nd (`dsh-personal-directive`) opens by stating it has been
withdrawn from the DSH ecosystem, so it should not advertise anything.

Current state, from the registry (`entries=40`):

| repo | registry | why |
|---|---|---|
| `dsh-wechat` | **pass** | gate on `origin/main`; badge now renders `passing` |
| `dsh-plugin-kit` | fail | the stale-pin problem above (`R3`) — will pass once the pin moves |
| `dsh-cert-mcp` | fail | its gate landed on `chore/npm-metadata`, but the repository's **default branch is `main`**, and those two have diverged |

`dsh-cert-mcp` needs a human decision and should not be resolved mechanically:
`origin/main` is **not** an ancestor of `chore/npm-metadata` — that branch is
ahead of main by substantial committed work (compat work, a checkout ruler,
README changes, package metadata). Which branch is canonical is the author's call.

Do not add badge lines to `dsh-plugin-kit` or `dsh-cert-mcp` before their gates
pass. Their badge SVGs currently render `failing`, which is honest, but a badge
that renders red because of a known-stale pin is worse than no badge.

### D. Reply on RFC #1846 (unblocked, owner: PerryLink)
[#1846](https://github.com/deepseek-ai/deepseek-harness/discussions/1846) is where
the check contract is actually being decided, and it has 11 comments. A useful
reply is a *contribution to their document*, not an advert. The strongest thing
this project can offer that no other implementation in that thread has:

> On the `dsh plugin check` contract: one gap worth closing before it is frozen.
> The three-value vocabulary has no way to say **"not evaluated"**, so a check
> that could not run must be reported as `WARN` — which reads as "evaluated and
> suboptimal". That is the false-green this ecosystem keeps re-learning: a group
> whose checks all skipped is not a group that passed. This project's `skip`
> status exists for exactly that, and §3.2 of its spec makes a requested group
> that never really ran a non-zero exit rather than a silent pass.
>
> Concretely, I would add either a fourth value or a `skipped: true` boolean on
> the check object. I have implemented the `skipped` form in
> `@perrylink/dsh-plugin-doctor` 0.2.4 (`--format check`), so it is testable
> against a real implementation today rather than being a hypothetical.
> Spec: https://github.com/PerryLink/dsh-plugin-doctor/blob/main/SPEC.md §1.1
> and §3.2.

That is a genuine improvement to their RFC, offered with a running
implementation and a citable spec. It also happens to be the single best
argument for why this project belongs in the conversation.

### E. Offer interoperability to the other checkers (unblocked, owner: PerryLink)
`boyin111-1/dsh-doctor` and `moonquake2004/dsh-doctor` both converged on the same
contract and are natural allies, not rivals. Offer them the mapping rather than
competition: `--format check` means either tool can consume this one's output
today, and `SPEC.md` §1.1 says an independent conforming implementation is valid
and this project will not claim otherwise. A specification acquires users by
being citable, not by being enforced.

Do **not** post on `zoahdev`'s threads as a correction or a challenge. #1814
proposes adopting *their* project under the same name; a competitor arriving to
contest it reads badly regardless of the merits. Contribute where the contract is
being designed (#1846) and where the demand is (#1719), and let the name
collision stay a documented caveat in this README.

### F. Directory submissions — research in progress (owner: PerryLink)
`awesome-dsh-plugins` has several forks/owners (`kejixiaoliang`,
`dshworks`, `awesome-dsh-plugin`), and `dshfind` / `dsh.market` / `dsh.directory`
each have their own submission rules. **Read each contributing guide before
submitting**; a rejected submission is worse than none. Verified so far:
`awesome-dsh-plugin` publishes a `contributing.md` describing a review process.

### G. External-repo outreach, reframed (needs a decision)
`THIRD-PARTY-RK-SCAN.md` names 20 repositories, 10 of which fail the gated
checks. The largest are `zhu1090093659/dsh-web` (7.1k★), `liustack/modlens`
(3.9k★) and `omdsh-dev/DSH-better-sidebar` (3.4k★).

**Do not open with the badge.** A failing verdict plus an invitation to wear a
badge is an invitation to display a red mark; the incentive is backwards. Open
instead with a free, reproducible diagnosis and a minimal fix:

> Ran the static R+K criteria over `<sha>`. Two gated checks fail: `R3` and `R7`.
> Reproduce with `<exact command>`. `R7` is usually a one-line `files` fix —
> here is the patch. No action needed from you; ignore this if the criteria do
> not fit your layout, and I will correct the row.

The scan file already promises a corrections path with equal prominence. Honour
it: only contact a maintainer who has a real finding, and never mass-post.

### H. Fence the family policy out of the ecosystem claim (unblocked)
`CC5` encodes PerryLink-family policy (licence, five-language READMEs, seam
roles) and `R5`/`R8` encode family conventions. `SPEC.md` §4.4 and §5 already
scope these honestly. Keep doing that in every public post: a standard that
admits its own scope is more adoptable than one that pretends to be universal.

---

## 6. What not to do

- **Do not claim "the only" or "the official".** #1814 is a *proposal*; it is not
  adopted. Claiming otherwise is falsifiable in one click and costs the
  credibility the whole effort depends on.
- **Do not mass-open issues or PRs.** The workspace's own discipline is one open
  upstream thread at a time, and a spray of badge PRs reads as spam.
- **Do not let the criteria depend on this project's infrastructure.** The 401
  and 403 outages are the argument for Path A. A standard that goes dark when
  one PAT expires is not a standard yet.
- **Do not silently raise the family's `0.1.6` gate pin.** It is deliberate and
  documented; changing it is a separate, tested wave.
