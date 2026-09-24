# Third-party DSH plugin verification — first public scan, 2026-09-24

The criteria had only ever been applied to the author's own fleet. This is the first
time they were run against repositories belonging to other people, and it is the only
artefact so far that is useful to someone who does not already use the tool.

## What was scanned

Twelve independent authors who announce plugins in the official **"Show Your
Plugins!"** discussion channel — taken from the channel's own recent posts, so these
are people actually shipping. All are unaffiliated with PerryLink. Twenty-two of their
repositories matched as DSH plugins; **18 produced a report**, four could not be
scanned (no `package.json`, or a repository that is not a plugin package).

Method: shallow clone into a **fresh directory per repository** (a reused directory
lets one repository's files leak into the next and silently corrupts the verdict),
then the published static gate:

```powershell
npx --yes @perrylink/dsh-plugin-doctor@0.4.4 --repo <checkout> --no-smoke --only "R,K"
```

## Result

**14 of 18 clean. Four had findings:**

| repository | stars | failed checks |
|---|---|---|
| `tr1v3r/dsh-jev` | 0 | `R1`, `R7` |
| `chenhz01/dsh-sample-plugin` | 0 | `R1`, `R5`, `R7` |
| `LuckVd/dsh-taskflow` | 0 | `R8` |
| `tr1v3r/dsh-ltm` | 0 | `R8` |

Worth stating plainly: **every repository with meaningful stars passed clean** —
`PolinniZhong/dsh-personal-center` (120★), `dsh-omi-voice` (74★),
`dsh-session-workbench` (51★), `MichaelShii/dsh-plugin-teamflow` (8★). The criteria did
not turn out to be a stick that every real project fails.

### `R1` — the finding that matters most

`tr1v3r/dsh-jev`'s `package.json` declares **no `dsh.bundle.patch`**. The check's own
message names the consequence: the package installs as an ordinary dependency and the
host never adds it to `dsh.profile.bundles` — *the quietest possible failure mode*. The
plugin appears installed and does nothing.

This is a genuine, actionable, non-promotional finding about someone else's
repository. It is exactly the shape of first contact `OUTREACH-adoption.md`
recommends: lead with the finding, disclose who is writing, invite them to check the
criterion.

### `R8` — two repositories, and the reason this scan was worth running

`LuckVd/dsh-taskflow` has **six open-top peer ranges** — `>=4.0.2` on cordis and five
`>=0.1.0-rc.1`-style ranges on dsh packages. `tr1v3r/dsh-ltm` has two superseded lines
(`>=0.1.0-rc.6 <0.2.0`).

Four of the six open-top ranges name `0.0.1-rc.1`, which matched **neither** the
superseded-line list **nor** the single-arm pattern, so **every version of the check
before 0.4.4 was blind to them.** An open-top range has no upper bound: `0.5.0` and
`1.0.0` are accepted, and the plugin loads against a host API it never tested.

That is the return on scanning other people's code: the defect in the *criteria* was
found by the criteria being used, and it was not visible from inside the author's own
fleet, where every range already follows the convention.

Note the distinction the check now draws, measured across these 22 repositories:
`^0.1.0-rc.1` is **bounded** — caret is semver sugar for `>=0.1.0-rc.1 <0.2.0` — and
the caret form is what most of these repositories use. Only bare `>=` is open-top.
Flagging every range without a literal `<` would have accused the ecosystem's normal
practice.

## What this does not establish

- **A clean result is not an endorsement.** The static groups `R` and `K` read package
  structure and the cordis contract; they do not install, build, or run the plugin. The
  `D` sandbox group was skipped (`--no-smoke`) because it needs network and pnpm.
- **`warn` is not a defect.** Several repositories carry ordinary warnings (a missing
  `LICENSE`, no `engines.node`) that the gate reports without failing.
- **No repository was modified, and no one was contacted.** This is a read-only record.
  Contacting an author is a decision for the maintainer, not a side effect of a scan.

## Why this is the adoption lever and not another listing

`OUTREACH.md` §C4 measures the position: 33+ catalogue placements produced 1 star, and
the shipped gate has 12 adopters, 11 of them the author's own. A 34th listing changes
nothing. A finding about someone's actual repository, that they can verify against a
published specification and fix in one line, is the only thing here that a stranger has
a reason to act on.
