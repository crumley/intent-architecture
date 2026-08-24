# <System> Design

The **how**, and the **chronological record of building it**. Where [`../intent/`](../intent/) is
the **living tip** (what must be true and why), this tree is the **ledger**: each unit of build work
is a **design entry** — the scope it worked to, the design it produced, and the frictions found
producing it — recorded in the order it happened and **superseded, not overwritten**, when a later
entry replaces an earlier one.

`design` moves together with [`../src/`](../src/) and [`../test/`](../test/) — the implementation
triangle, all governed by `intent`.

## Layout

- **`NNNN-<slug>/`** — the **design entries**, zero-padded, numbered in the order the work happens
  (`0001-…`, `0002-…`). Each entry is a directory of up to three files, split by who reads them and
  when:
  - **`README.md`** — the design: summary, context, the intent served, scope, and the _how_.
    Essentially frozen once the entry is accepted; later touches are status changes and supersession
    pointers, not rewrites.
  - **`spec-feedback.md`** — the intent frictions found while building, with their lifecycle. This
    file is the adjudication surface: it is read on its own, after the build, without the rest of
    the entry.
  - **`build-log.md`** — **optional**: the journal, created only when the build spans sessions or
    when building forces a discovery worth keeping. An entry without one is normal — the commits and
    the pull request are its build record.

  Start a new entry by copying [`0000-template/`](0000-template/README.md).
- **`decisions/`** — the **Architecture Decision Records (ADRs)**: one per critical **stack /
  tooling** choice (language, runtime, test runner, key libraries — the one-time, cross-cutting
  decisions). Start from [`decisions/0000-template.md`](decisions/0000-template.md). An ADR records
  a choice made once for the whole repo; a design entry records a unit of build work and **links**
  the ADRs it rests on.

## The entry format

**`README.md`** (see the [template](0000-template/README.md)) carries:

- **Title + summary + Status** — the summary is **one or two sentences**, a hard cap. Status:
  `proposed | in-progress | built — awaiting review | accepted | superseded by NNNN`.
- **Context** — one to three short paragraphs between the status line and the first section: the
  problem as the system experiences it, what this entry proposes, and why now — linking the prior
  entries that make the work possible or necessary. This is the entry justifying itself to a future
  reader on its own terms.
- **Serves intent** — **Required.** One bullet per intent slice this entry realizes: the link and
  one sentence on how. Link to intent's words rather than quoting them — a quote silently goes stale
  the moment intent is edited, often by this very entry's spec-feedback. If an entry cannot say
  which intent it realizes, it is not ready to build.
- **Scope** — what is in (each fact stated here once), what is deferred — each deferral with the
  reason it is acceptable, in prose ("safe to defer because …"): what was weighed, and why nothing
  rots, breaks, or is silently lost in the gap — and the acceptance check as a **numbered list of
  executable checks** (the entry's exit test).
- **Design** — the _how_: the decisions (linking the relevant ADRs in [`decisions/`](decisions/);
  entry-local decisions each in the full shape — the alternative considered, what made it
  attractive, the reason it lost, and the cost of the choice made), the module **boundaries**
  established and why (not a file inventory — the commits carry that), the key mechanisms.

**`spec-feedback.md`** — intent frictions found while building, each with a stable id (`SF-NNN`),
the slice it touches, the assumption made to keep moving, and a proposed revision — or "none this
entry." An SF is `pending` until settled; once settled, its disposition is **appended** to it —
`adjudicated` with a link to the intent change that settled it, or `declined` with a one-line why —
never rewriting the original text, so what building surfaced stays on the record.

**`build-log.md`** (optional) — one block per iteration, newest at the bottom, holding only what the
commits cannot: what building **forced or revealed** (a failing test that changed the design, a
measured number, a defect found in review), the exact commands that prove what works, and what is
next. It is not a changelog — what was done lives in the commits, the files touched in the diff, the
assertions in the test suite. The acceptance checks in Scope are the entry's "works" claims, and the
pull request that delivers the entry carries their run.

## The rules that keep it honest

1. **Serves intent.** If a statement would hold no matter how we build it, it is a constraint, not a
   design, and belongs up in [`../intent/`](../intent/) (most likely a seam contract). When an entry
   settles a decision the intent left open, it records the choice and its _why_ here.
2. **Append and supersede, never overwrite.** When a later entry re-does an earlier one's work, it
   says so explicitly and links back; the earlier entry's Status points forward. Supersession may be
   **partial**: when only one affordance of an earlier entry is replaced, both entries say so
   precisely ("NNNN is not superseded as a whole; this one affordance is, here"). Both stay — the
   _why we changed_ is never lost. The same goes for ADRs. A cancelled or abandoned entry keeps its
   number and its record: a gap in the sequence is honest history; renumbering would falsify the
   lineage.
3. **Spec-feedback, not silent rewrites.** `intent/` governs; building does **not** rewrite it to
   match the code. When building reveals an intent problem, the entry records it in its
   `spec-feedback.md` and proceeds on a stated assumption — the spec change is left for human
   review. Each accepted change is its **own small intent-edit change** (its own branch and PR,
   never bundled into a build PR): kept separate, the adjudication stays reviewable and atomic, and
   a build PR cannot smuggle intent changes past review. The human's **merge is the adjudication
   act** — auditable in history, not in chat; on merge, the SF gets its disposition appended. (One
   exception: appending to a slice's own _Open questions_, or noting the build _resolved_ one, is
   allowed and logged.)
4. **Plural techniques converge through use.** When an entry realizes a mechanism the intent
   deliberately left open, it may build **more than one technique behind the same contract** — a
   universal baseline plus context-specific alternates. The entry names the candidates and the
   baseline, states how they will be compared in real use, and records the convergence — one
   technique kept, or an explicit technique→situation rule — with its _why_, in this entry or the
   one that supersedes it. An abandoned technique is superseded, not erased. Choosing a technique on
   paper is weak evidence; running candidates against reality is the cheapest honest comparison —
   and a contract that has held two live techniques at once is a seam proven to be a seam.
5. **A standalone document, one authorial voice.** An entry reads as if its one author decided to
   build this. It argues its motivation from the system — intent slices, prior entries, observed
   failures — never from who asked for it: no owner, brief, directive, agent, or session appears in
   it, and it quotes no one. Whoever or whatever commissioned the work is delivery metadata and
   lives with the delivery (the branch, the pull request), not in the ledger. The one exception is a
   spec-feedback **disposition**, which records that a human settled the SF — adjudication is a
   recorded act, not narrative.
6. **Each fact has one home.** Within an entry, a claim is stated in full exactly once — the summary
   previews, Scope bounds, Design explains — and every other section links or mentions rather than
   restates. (The repo-wide one-home rule, applied inside the entry.)

**Why a ledger, not a mirror:** intent is organized for _understanding_ and always states the
current tip; design is organized for _building over time_. Keeping every entry — its scope, design,
and frictions intact, in the order it happened — means the next build starts from what the last one
learned, and the diff in `intent/` between entries is the visible result: the intent, hardened by
the act of building the system.

## Open spec-feedback

The SFs still `pending` across entries — the queue lives here, in the repo, not in someone's head or
one session's memory. When an entry raises an SF, add a line (id, entry, one-line friction); when
the SF's disposition is appended in its entry, remove the line here.

None pending.
