# Governance and authorship

## Who authored this

**PerryLink** ([@PerryLink](https://github.com/PerryLink)) is the author and
maintainer of both:

- the **tool** — `@perrylink/dsh-plugin-doctor`, and
- the **verification criteria** it implements — the check catalog
  `R0-R8` / `K1-K9` / `D0-D3,D9` / `CC1-CC5`, whose normative text is
  [`SPEC.md`](SPEC.md).

The criteria are not an emergent community convention that this project merely
happens to implement. They were authored, and are versioned and changed, as a
specification — with `SPEC.md` as the normative text and this repository as the
canonical source.

## The two layers, and why the distinction matters

| Layer | What it is | Who controls it |
|---|---|---|
| **Specification** (`SPEC.md`) | The normative definition of each check: its ID, the requirement it states, what a failure means, and the evidence it traces to. | PerryLink, via spec versions. |
| **Reference implementation** (`doctor.mjs` + `lib/`) | One executable realization of the specification. | PerryLink, via releases. |

A third party may implement the specification independently, and may say so:
*"conforms to dsh-plugin-doctor SPEC v1"*. A conforming implementation does not
require permission, and this project will not claim that an independent
implementation is invalid merely because it is independent.

What the specification version buys you is **stability**: within a spec major
version, a check ID keeps its meaning, and a result may be cited as
`SPEC v1 §K3` and stay meaningful.

## How the criteria change

- **Spec major version** (`v1` → `v2`): a check ID is removed, or its meaning
  changes such that a previously passing project may now fail. Documented in
  `SPEC.md` and `CHANGELOG.md`.
- **Spec minor version**: checks are added, or a check's evidence is
  strengthened without changing what a pass already meant.
- **Patch**: wording, evidence URLs and clarifications only.

Check IDs are a **frozen contract** for the same reason the `R0 ` / `K1 `
output prefixes are (`lib/framework.mjs`): downstream CI greps them. An ID that
changes meaning is a new ID.

## Attribution expectations for adopters

Adopting the gate costs nothing and needs no permission. It is asked, not
required, that a conforming project:

1. keeps the criteria attributed to PerryLink and links back to
   <https://github.com/PerryLink/dsh-plugin-doctor>, and
2. does not present the criteria as its own standard.

Redistributing this software (or a derivative) is governed by Apache-2.0
section 4(d), which **requires** a readable copy of [`NOTICE`](NOTICE) to be
included. That is the one attribution obligation here that is a licence term
rather than a request.

## Scope limits, stated honestly

`CC5` encodes **PerryLink-family policy** (Apache-2.0 licence, five-language
READMEs, three seam roles), not ecosystem-wide correctness. Outside a PerryLink
workspace it reports `not-applicable` rather than failing a third-party
repository. Likewise `R5` (rescoped dependency policy) and `R8` (dual-baseline
peer ranges) encode family policy. An unrelated project that fails `R5` or `R8`
has not necessarily done anything wrong — read the check's own row in `SPEC.md`
before treating a failure as a defect.

## Governance model, stated plainly

This is currently a **single-maintainer specification**: PerryLink decides what
the criteria are. There is no committee, and the project will not describe
itself as if there were one. If the specification is ever handed to a working
group or a foundation, this file records that transfer — until then, the
authorship above is the accurate statement.
