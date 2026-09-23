# dsh.directory submission record — 2026-09-23

44 plugin packages submitted to [dsh.directory](https://dsh.directory) through its
issue form, covering the whole PerryLink organisation. Issues **#276–#319** on
[`alexchenzl/dsh-plugin-directory`](https://github.com/alexchenzl/dsh-plugin-directory).

## Why this directory

It was a genuine gap, not a formality. Verified before submitting:

- The site's `sitemap.xml` carries **9,266** URLs and **zero** containing
  `PerryLink` — the entire organisation was absent, not just one plugin.
- The only `dsh-plugin-doctor` page there belongs to **`zoahdev`**, a different
  project of the same name.

Earlier research in `OUTREACH-DRAFTS.md` had listed dsh.directory as the
"cleanest real gap"; the submission confirms the scale of it.

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

Nothing further is required. The directory's automation re-reads each issue daily
for seven days: accepted ones close with a directory URL, unaccepted ones close
silently. If any package is rejected, the checklist in its `CONTRIBUTING.md` is
the diagnostic — most likely causes are a category string edited away from the
exact enum, or a structure check that a future commit changed.

To correct a listed record later, submit the same package again; a submission for
an already-listed package updates that listing instead of duplicating it.
