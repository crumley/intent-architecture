# <System> Design

The **how**, and the **chronological record of building it**. Where [`../intent/`](../intent/) is
the **living tip** (what must be true and why), this tree is the **ledger**: each unit of build work
is a **design entry** — the scope it worked to, the design it produced, and the journal of producing
it — recorded in the order it happened and **superseded, not overwritten**, when a later entry
replaces an earlier one.

`design` moves together with [`../src/`](../src/) and [`../test/`](../test/) — the implementation
triangle, all governed by `intent`.

## Layout

- **`NNNN-<slug>/`** — the **design entries**, zero-padded, numbered in the order the work happens
  (`0001-…`, `0002-…`). Each entry is a directory and is **self-contained**: its `README.md`, in the
  common format below, holds both the _how_ (the design) and the record of building it (scope, build
  log, spec-feedback). Start a new entry by copying [`0000-template/`](0000-template/README.md).
- **`decisions/`** — the **Architecture Decision Records (ADRs)**: one per critical **stack /
  tooling** choice (language, runtime, test runner, key libraries — the one-time, cross-cutting
  decisions). Start from [`decisions/0000-template.md`](decisions/0000-template.md). An ADR records
  a choice made once for the whole repo; a design entry records a unit of build work and **links**
  the ADRs it rests on.

## The common entry format

Every entry's `README.md` (see the [template](0000-template/README.md)) carries the same sections:

- **Title + one-line summary + Status** — `proposed | in-progress | accepted | superseded by NNNN`.
- **Serves intent** — the intent slice(s) this entry realizes. **Required**: every entry opens by
  naming what it serves; if an entry cannot say which intent it realizes, it is not ready to build.
- **Scope** — what is in, what is deferred and why, and the acceptance check (the entry's exit
  test).
- **Design** — the _how_: the decisions (linking the relevant ADRs in [`decisions/`](decisions/)),
  the module layout, the key mechanisms.
- **Build log** — the **append-only** journal: goal, what was done, **what works now with the exact
  command that proves it**, decisions, next. No "works" claim without a command. This is the
  cold-start memory that lets work resume across sessions.
- **Spec-feedback** — intent frictions found while building, each with a stable id (`SF-NNN`), the
  slice it touches, the assumption made to keep moving, and a proposed revision — or "none this
  entry." An SF is `pending` until settled; its disposition —
  `adjudicated — <link to the intent
  change that settled it>` or `declined — <one-line why>` — is
  **appended** to it, never rewriting the original text, so what building surfaced stays on the
  record.

## The rules that keep it honest

1. **Serves intent.** If a statement would hold no matter how we build it, it is a constraint, not a
   design, and belongs up in [`../intent/`](../intent/) (most likely a seam contract). When an entry
   settles a decision the intent left open, it records the choice and its _why_ here.
2. **Append and supersede, never overwrite.** When a later entry re-does an earlier one's work, it
   says so explicitly and links back; the earlier entry's Status points forward. Both stay — the
   _why we changed_ is never lost. The same goes for ADRs.
3. **Spec-feedback, not silent rewrites.** `intent/` governs; building does **not** rewrite it to
   match the code. When building reveals an intent problem, the entry records it in its
   Spec-feedback section and proceeds on a stated assumption — the spec change is left for human
   review. Each accepted change is its **own small intent-edit change** (its own branch and PR,
   never bundled into a build PR): kept separate, the adjudication stays reviewable and atomic, and
   a build PR cannot smuggle intent changes past review. The human's **merge is the adjudication
   act** — auditable in history, not in chat; on merge, the SF gets its disposition appended. (One
   exception: appending to a slice's own _Open questions_, or noting the build _resolved_ one, is
   allowed and logged.)

**Why a ledger, not a mirror:** intent is organized for _understanding_ and always states the
current tip; design is organized for _building over time_. Keeping every entry — its scope, journal,
and frictions intact, in the order it happened — means the next build starts from what the last one
learned, and the diff in `intent/` between entries is the visible result: the intent, hardened by
the act of building the system.

## Open spec-feedback

The SFs still `pending` across entries — the queue lives here, in the repo, not in someone's head or
one session's memory. When an entry raises an SF, add a line (id, entry, one-line friction); when
the SF's disposition is appended in its entry, remove the line here.

None pending.
