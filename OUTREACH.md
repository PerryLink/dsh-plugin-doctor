# Outreach notes

Working notes for getting the verification criteria adopted beyond this
repository. Everything here is either a checkable public fact or an action with
a named owner. No targets or outcomes are asserted that have not been verified.

Owner and author of the criteria: **PerryLink** — <https://github.com/PerryLink>.
The normative text is [`SPEC.md`](SPEC.md).

---

## 1. The premise is already satisfied

This is not a cold-start problem. The project is publicly visible in the
official harness repository, and an adoption proposal is already open. What
remains is **conversion**, not awareness.

| Channel | State | Where |
|---|---|---|
| Official proposal to adopt it as the official check | open (title states it is a proposal) | [discussion #1814](https://github.com/deepseek-ai/deepseek-harness/discussions/1814) |
| Official "show and tell" | posted, framed as the implementation of the official plugin-scaffold RFC | [discussion #1693](https://github.com/deepseek-ai/deepseek-harness/discussions/1693) |
| Related official RFC (plugin scaffold) | open | [discussion #1629](https://github.com/deepseek-ai/deepseek-harness/discussions/1629) |
| Community demand for an official market + standards | open, high-traffic | [discussion #1115](https://github.com/deepseek-ai/deepseek-harness/discussions/1115) |
| Community proposal for a repository-layout standard | open | [discussion #2269](https://github.com/deepseek-ai/deepseek-harness/discussions/2269) |
| Third-party write-up | published | [blog.yeyupiaoling.cn](https://blog.yeyupiaoling.cn/article/1788746484665?lang=zh-cn) |
| npm distribution | published, 12 versions | `@perrylink/dsh-plugin-doctor` |
| Public third-party result set | published | [`THIRD-PARTY-RK-SCAN.md`](THIRD-PARTY-RK-SCAN.md) |

> Every row above is a claim about the outside world and dates from this
> writing. **Confirm each one before acting on it** — discussions move, threads
> get answered, and repositories get renamed. In particular, confirm whether
> #1814 and #1693 are this project's own posts and what state they are in; that
> was not verifiable through an unauthenticated read (GitHub rate-limits it to
> 60 requests/hour, so a fetch failure here is not evidence a thread is gone).

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

### A. Fix the grey badges (unblocked, owner: PerryLink)
Create a fine-grained PAT with read access to the 37 declared repositories, store
it as the `DOCTOR_AUDIT_TOKEN` repository secret, then run the `verified badges`
workflow. Until this is done, do not present Path B as the default — Path A is
self-serve and cannot break.

### B. Post to the official standards threads (unblocked, owner: PerryLink)
The two threads where criteria are actually decided are
[#2269](https://github.com/deepseek-ai/deepseek-harness/discussions/2269) (a
repository-layout standard proposal) and
[#1814](https://github.com/deepseek-ai/deepseek-harness/discussions/1814) (this
project's own proposal). A useful reply on #2269 is not "use my tool" but a
concrete contribution to *their* document:

> On the layout question: the criteria I maintain treat `dsh.bundle.patch` as
> the single activation switch, and its absence is the most silent failure mode
> in the ecosystem — the install succeeds, nothing errors, and the plugin never
> loads. If the standard is going to state one mandatory field, that is the one
> I would state, and it is checkable offline by anyone.
> Normative text: `SPEC.md` §4.1/R1.

### C. Reply to the competing checker (unblocked, owner: PerryLink)
On `bowenliang123/dsh-plugin-checker`, offer interoperability rather than
competition: the Action can consume `SPEC.md` check IDs, and this project will
not claim an independent implementation is invalid. Linking the spec gives that
author a reason to cite it — which is how a specification acquires users.

### D. Directory submissions (needs verification first)
`awesome-dsh-plugins` has several forks/owners (`kejixiaoliang`,
`dshworks`, `awesome-dsh-plugin`), and `dshfind` / `dsh.market` / `dsh.directory`
each have their own submission rules. **Read each contributing guide before
submitting**; a rejected submission is worse than none. Verified so far:
`awesome-dsh-plugin` publishes a `contributing.md` describing a review process.

### E. External-repo outreach, reframed (needs a decision)
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

### F. Fence the family policy out of the ecosystem claim (unblocked)
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
