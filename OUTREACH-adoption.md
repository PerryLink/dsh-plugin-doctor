# Adoption outreach — the one lever that changes the underlying fact

`OUTREACH.md` §C4 records the measurement: the project is in 33+ catalogues
including every high-star one, and has 1 star. Its shipped CI workflow has 12
adopters, **11 of them PerryLink's own**. External dependents: 0. npm downloads are
declining week over week.

Catalogue work is finished and it did not matter. **The only remaining lever is
independent authors actually running the gate.** The 0.4.x Action exists to remove
the friction: adoption is now one `uses:` line instead of copying a workflow file.

## Why this file is not a mailing list

Mass-messaging authors about your own tool is exactly what gets projects on
watchlists — `awesome-deepseekharness/awesome-deepseek-harness` already carries a
`PerryLink` entry, and `bruc3van/awesome-dsh-plugin` reviews a "Star 异常增长" alert
section first and hard-blocks self-promotion below 10 stars. The approach below is
deliberately the opposite: **offer a finding about their repository, and mention the
gate only as a way to keep the finding from recurring.** If there is no finding,
send nothing.

## The message that is defensible

For each candidate, run the gate yourself first, then write to them only if it
surfaces something real:

```powershell
npx --yes @perrylink/dsh-plugin-doctor@0.4.0 --repo <their checkout> --no-smoke --only "R,K"
```

Then:

> Hello — I ran a static check over `<repo>` and it flagged `<check id>: <one-line
> detail>`. That specific check exists because `<the failure it catches>`, which is
> easy to hit when `<the situation>`.
>
> Here is the fix: `<the smallest change>`.
>
> I maintain the checker, so judge the finding on its merits — if it is wrong, I
> would rather know, and the criteria are written down in
> [SPEC.md](https://github.com/PerryLink/dsh-plugin-doctor/blob/main/SPEC.md) so you
> can check the reasoning instead of trusting me. If it is useful and you want it to
> stay caught, it is one line in CI:
>
> ```yaml
> - uses: PerryLink/dsh-plugin-doctor@v0.4.2
>   with:
>     only: R,K
> ```

Three properties make this not-spam: it leads with a finding about **their** code,
it discloses who you are, and it invites them to check the criterion rather than
believe it.

## Candidates — real independent DSH plugin authors

Measured from the official "Show Your Plugins!" channel, which is where authors who
are actually shipping announce. All are independent of PerryLink. Ordered by
repository count as a rough proxy for how much DSH code they maintain.

| author | public repos | followers | note |
|---|---|---|---|
| `btsd321` | 64 | 2 | `dsh-remote-explorer` |
| `LuckVd` | 59 | 2 | `dsh-taskflow` |
| `tr1v3r` | 51 | 38 | `dsh-ltm` — most followed of this group |
| `zpzjzj` | 45 | 23 | `skill-up` |
| `XiaoBinGan` | 39 | 1 | `dsh-mermaid-fence` |
| `iscarson` | 31 | 8 | `dsh` Cloudflare zero-trust |
| `chenhz01` | 31 | 4 | verified community sample |
| `PolinniZhong` | 15 | 1 | `Knit` — explicitly asking for validation |
| `huajuan404` | 11 | 1 | `dsh-diagram` |
| `MichaelShii` | 7 | 0 | `dsh-plugin-teamflow`, two showcase posts |
| `bandianliancha` | 5 | 3 | Feishu workspace bridge |
| `33Wade333` | 3 | 2 | `data-model-builder` |

Start with three, not twelve. **`PolinniZhong` advertises "想找人验证有没有用"** — an
author explicitly asking for verification is the highest-value first contact in this
list, and helping them is a genuine contribution rather than outreach.

## What will not work, with the evidence

- **A cold "please use my tool" message.** 33+ listings produced 1 star; a DM will
  do worse.
- **Posting about it in the official repository more than once.** One substantive
  contribution is on the record in discussion #1846 and one announcement is in
  "Show Your Plugins!" (#7729). A third post would be promotion, not contribution.
- **Hacker News.** Measured: the DSH launch scored 747 points; a direct "Show HN"
  for a DSH directory scored 2.
- **Anything touching star counts.** `bruc3van`'s review pipeline screens for
  anomalous star growth before anything else and excludes on it.

## The honest bottom line

The project cannot adopt itself. Everything measurable that it could do alone —
33+ listings, 43 gated repositories with one byte-identical template, a published
npm package with provenance, an official showcase post, a working GitHub Action —
is done. **The remaining variable is other people's decisions, and this file is the
shortest defensible path to influencing them.**

If none of these twelve adopt it, that is the answer, and it is a real answer: the
standard is sound, published, implementable by anyone under Apache-2.0, and simply
not needed by this ecosystem yet. Recording that is more useful than another round
of promotion.
