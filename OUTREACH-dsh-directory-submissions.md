# dsh.directory submission record — 2026-09-23

44 plugin packages submitted to [dsh.directory](https://dsh.directory) through its
issue form, covering the whole PerryLink organisation. Issues **#276–#319** on
[`alexchenzl/dsh-plugin-directory`](https://github.com/alexchenzl/dsh-plugin-directory).

## Correction: the organisation was NOT absent

An earlier version of this file, and of `OUTREACH-DRAFTS.md`, claimed the whole
organisation was missing from this directory because its `sitemap.xml` contained
zero occurrences of `PerryLink`. **That check was wrong — it was case-sensitive,
and the directory's URLs are lower-case.**

The organisation had **29 packages already accepted and live** before this wave:

```
https://dsh.directory/plugins/perrylink/dsh-auto-review
https://dsh.directory/plugins/perrylink/dsh-memento
… and 27 more, accepted as issues #88–#116
```

So of the 44 submissions, **29 were re-submissions of packages already listed and
15 were genuinely new**. Recorded rather than quietly dropped, because the wrong
conclusion is what caused the duplication: with a case-insensitive check the wave
would have been 15 issues, not 44.

**Re-submission is normal here, verified rather than assumed.** Of 300 submissions
scanned, 37 titles were submitted more than once, and `dsh-movein` is the clearest
precedent — accepted as #39, then submitted again and **accepted again** as #220.
Exactly one issue in the repository has ever been closed as `duplicate`. The
directory's own `CONTRIBUTING.md` states that submitting an already-listed package
again updates that record.

## The 15 new submissions were validated against the remote

Each was checked against the structural rules by reading its `package.json` and
patch file **from GitHub**, not from a local working tree — a local file can be
uncommitted, which would hide exactly the failure that matters:

| rule | result |
|---|---|
| `package.json` at the submitted directory | 15 / 15 |
| `dsh.bundle.patch` declared | 15 / 15 |
| the declared patch file exists there | 15 / 15 |
| not `private` | 15 / 15 |
| install command names the real package name | 15 / 15 |
| category is one of the 13 exact strings | 44 / 44 |

No problems found. They are waiting on the directory's own batch, which last ran
**2026-09-08**; 130 submissions are queued behind it, 44 of them ours.

## How the mechanism works

From the repository's `CONTRIBUTING.md` and issue form, read before submitting:

- **One package per issue.** A repository with several packages needs one issue
  each — hence 44 issues rather than one.
- **No feedback on rejection.** *"Unaccepted submissions receive no individual
  feedback: there is no rejection comment and no explanation of what failed."*
  Accepted ones get one reply with the directory URL and are closed. So the
  fields have to be right the first time; there is no debugging loop.
- Checks run **immediately, then once a day for seven days**, re-reading the
  issue's current values. Editing a field while the issue is open is allowed.
- Category must be one of 13 strings **copied exactly**; a free-form value is
  invalid. The stored category is derived from that string.
- Install command: one line from the plugin's own documentation, and **prefer
  npm** where both npm and git forms are documented.

Each submission body was written in the form's own serialisation, because
`gh issue create` does not run the form:

```
### Plugin package URL

<repo url>

### Primary category

<exact category string>

### One-line description

<one factual sentence>

### Install command

```shell
dsh plugin --profile web add <package>
```
```

The four headings are what the automation reads. All 44 were verified to carry
all four after posting.

## Eligibility, applied literally

Every submitted package satisfies the four structural rules the directory
checks: public repository; `package.json` directly inside the submitted
directory; `dsh.bundle.patch` declared (not only `dsh.client`); and the declared
patch file present inside that directory.

Two repositories were deliberately **excluded**:

| repo | why not |
|---|---|
| `audit-dsh-infinite-gen-2` | an audit staging repository, not a product |
| `dsh-personal-directive` | its README declares the project withdrawn from the DSH ecosystem — submitting it would contradict its own statement |

Three further repositories have no `dsh.bundle.patch` and are ineligible by
definition: `adp-list` (a third-party clone), `dsh-catalog`, and
`dsh-plugin-certification`.

## Batch behaviour: checked before doing it

44 issues from one account is a volume worth being careful about, so two things
were established first:

1. **Precedent exists.** User `GooDAnDReaDY` submitted three packages 15 seconds
   apart (#273/#274/#275), so batched submission is normal for this directory.
2. **A small first wave was verified before the rest.** Four packages spanning
   four categories (doctor, memento, wechat, github) were posted and inspected —
   label applied, all four headings present — and only then were the remaining 40
   submitted. Zero failures.

## Machine-readable form

`data/directory-submissions.json` holds the exact title, URL, category,
description and body of every submission, so a re-check can compare what was
sent against what the directory stored rather than relying on memory.

## What happens next

Nothing further is required from us. The directory's automation re-reads each
issue daily for seven days: accepted ones close with a directory URL, unaccepted
ones close silently. All 44 were still open and unreplied at the time of writing,
which is consistent with the queue rather than with rejection — 130 submissions
from all authors are waiting, and the last batch ran 2026-09-08.

If any package is rejected, the checklist in `CONTRIBUTING.md` is the diagnostic.
The two most likely causes are a category string edited away from the exact enum,
and a structure check that a later commit changed. Both were validated here
against the remote immediately before writing this, so a rejection would point at
something the checklist does not cover — which is itself worth knowing.

To correct a listed record later, submit the same package again; that updates the
existing record rather than duplicating it.
