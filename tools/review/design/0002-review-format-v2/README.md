# 0002 — Review format v2: the question-first item

> Reshapes every item into one question answered in three stages — what, so what, now what — with
> the agent's advice last, and splits the files beside it into what the decision would edit and what
> is only context: packet version 2, the page that reads it, and the skill that writes it.
>
> **Status:** built — awaiting review · **Started:** 2026-11-08

The first real review of a mature repository with the v1 page
([0001](../0001-review-tool-v1/README.md)) was hard to orient in. An item opened on the agent's
recommendation before the reader knew what was being decided or why it mattered; the facts were
folded away beneath it; and the pane beside it showed whole intent files from the top, with nothing
saying why each was there or which part mattered. The reader met the conclusion first and had to
reconstruct the argument backwards — the ruling drifts toward the agent's framing exactly when the
[review loop](../../intent/01-concepts/00-review-loop.md) needs it to stay the human's.

This entry orders each item as an argument read top to bottom: the question; **what** (the facts, no
advocacy); **so what** (why it matters); **now what** (the choices, the recommendation last and
marked as advice). The side pane opens on the passage in question, marks and numbers every passage
to match the middle, shows each proposed edit in place, and sets context files apart with their
reason. The same run surfaced contract gaps — triage only in branch mode, no way to say an item is
already ruled, colliding edits, inline intent feedback the scanner could not see — which this entry
closes too.

## Serves intent

- [`00-review-loop.md`](../../intent/01-concepts/00-review-loop.md) — the item's shape (one
  question; what, so what, now what; advice last) and edits told apart from context, which this
  entry adds to the loop's Prepare step, are what the page renders and the contract carries.
- [`01-producers.md`](../../intent/01-concepts/01-producers.md) — "a question" and "facts apart from
  advice" become things every producer owes; the skill's open-items procedure is rewritten to write
  them, and triage now applies in either mode.
- [`00-agent-tool-contract.md`](../../intent/02-subsystems/00-agent-tool-contract.md) — the packet
  moves to version 2 under the versioning rule: a version 1 packet is refused, and the refusal says
  how to migrate; the decisions stay version 1, unchanged.
- [`00-vision.md`](../../intent/00-foundation/00-vision.md) — attention is the scarce resource: the
  routine folds to a line, the attention-worthy spans are unmistakable, and the reader is never made
  to hunt for the passage an item is about.

## Scope

- **In:**
  - **Packet version 2.** Every item has a required `question`; `what` (facts, ranInto, assumption),
    `soWhat` (stakes, relations), `nowWhat` (summary, edits, composed, consequences, recommendation)
    replace v1's `analysis` and `proposal`; `context` entries require a `why`; `ruled` marks an item
    already ruled; `members` lets one item stand for several; `attention` is valid in either mode.
    The decisions file is unchanged. The full reference ships with the skill:
    [`review-contract.md`](../../../../.agents/skills/intent-architecture/references/review-contract.md).
  - **Validation and advice.** `validate` refuses a v1 packet with the field-by-field migration, and
    prints advice on a valid packet: quotes or `before` text not verbatim (or ambiguous), questions
    still in the scanner's draft wording, one-sided recommendations, ruled Status lines without a
    `ruled` block, members missing from the ledger, colliding edits without a composed wording.
  - **The scanner.** Drafts a placeholder question per item; pre-fills an intent-feedback item's
    context with where it is written and the entry that raised it; parses a ruled Status into
    `ruled`; reads intent feedback written **inline** in entry READMEs (the older shape) into the
    ledger, with how each status was inferred, and offers the open ones as items (`--no-inline`
    keeps them ledger-only); skips cross-cutting questions marked `_Standing watch._`; `--files` is
    wired into the command line (it was documented but not accepted).
  - **The page.** The item view in stages, with routine items folding What and So what to a one-line
    preview; the ruled framing (accept reads "confirm"); collisions flagged on both items with the
    composed wording; the side pane in two labelled groups with passages marked, numbered, labelled,
    diffed in place, and navigable; a current / after-the-edits toggle; the queue ordered by
    attention in either mode; the side pane kept at narrow widths, with the item list as an overlay;
    the dashboard showing inline and inferred status; deep links that work while the page is open.
  - **The skill.** `review.md` rewritten around the four parts and fairness; the new contract
    reference; `structure.md` and its skeletons (and `template/`) agree that an intent-feedback item
    carries an explicit `**Status:** pending`, and define the standing-watch marker.
- **Deferred:**
  - **A ruling per member of a group.** A group takes one verdict for all its members. Safe to defer
    because the skill tells the agent to keep apart members that need different rulings, and an
    amend or a note can carve one out; the executor still writes one Status line per member.
  - **An automatic v1 → v2 migration.** `validate` explains the mapping instead. Safe because a
    packet lives for one pass and is regenerated by the agent; nothing long-lived is stranded.
  - **Notes on the after-the-edits text.** That view is read-only. Safe because a note anchors to
    the snapshot the agent can locate; a suggestion on the current text covers "change the new
    wording".
  - **Composing colliding edits automatically.** The agent writes the composed wording. Safe because
    the tool flags every collision and `validate` advises until one is declared.
  - **A visual regression suite.** The renderings were checked by headless screenshots (below), not
    by an automated test. Safe because layout logic that can be tested — numbering, grouping,
    collisions, ranges — is pure and tested; what remains is appearance.
  - **Per-slice open questions in `scan`, and every v1 deferral** — unchanged from
    [0001](../0001-review-tool-v1/README.md).
- **Acceptance:**
  1. `mise run check` in `tools/review/` is green: Biome, `tsc`, every test, and the bundle drift
     check; `mise run check` and `mise run template-check` at the root stay green.
  2. A v1 packet is refused by `validate` and `serve` with the migration mapping (a test).
  3. The passage model numbers edits first, shares a number between an edit and the evidence that
     quotes it, sorts files into edit and related groups with reasons, and names colliding items (a
     test).
  4. `scan` of a repository with inline intent feedback puts every inline item in the ledger with
     its status and how it was inferred, offers the open ones, reads `_Disposition:_` and
     `_Adjudicated:_`, and leaves out questions marked `_Standing watch._` (a test).
  5. The real open-items packet for a mature repository, rewritten in version 2 by the skill's
     procedure, validates with no advice, and renders — a routine item, a judgment item, and a ruled
     item — calmly in light and dark themes at 1440 and 1000 px wide (headless screenshots).

## Design

### Decisions

- Toolchain and packaging: unchanged — [0001](../decisions/0001-typescript-bun-toolchain.md),
  [0002](../decisions/0002-single-file-node-bundle.md).
- **Version the packet and the decisions apart.** The packet goes to version 2; the decisions stay
  at version 1. _Alternative:_ bump both together. _Attractive_ because one number is simpler to
  state. _Lost_ because nothing in the decisions changed, and every agent's executor would have to
  accept a "new" version that means exactly the old one. _Cost:_ two constants, named for their
  documents.
- **Fixed stages, not free sections.** What, so what, and now what are named fields with named
  parts. _Alternative:_ an ordered list of titled sections the agent fills as it likes. _Attractive_
  for flexibility. _Lost_ because the order is the point — facts before stakes before choices, the
  advice last — and a free list lets a producer put its recommendation first again. _Cost:_ a
  producer whose items do not fit the shape writes `facts` and leaves the optional parts empty.
- **A recommendation for the edit as shown.** When the agent narrows a filed proposal, its edit is
  the narrowed one and it recommends accept, explaining the change in the summary; the filed text
  stays in the item's own sections. _Alternative:_ show the filed edit and recommend amend. _Lost_
  because amend asks the human to write wording the agent already wrote, and accept would then mean
  the filed text nobody recommends. _Cost:_ the reader must open "as written" to see the original —
  the summary says when it differs.
- **The scanner drafts a question.** _Alternative:_ leave it empty, so a skeleton fails validation
  until the agent writes one. _Attractive_ as a forcing function. _Lost_ because a skeleton must
  still serve and test, and the draft is recognisable: `validate` advises until it is replaced.
  _Cost:_ a careless agent can ship a generic question — visibly generic, and flagged.
- **Collisions are found, not only declared.** The page and `validate` compute overlapping edits
  from the snapshot; `composed` declares what to land when both are accepted. _Alternative:_ rely on
  `relations` to say so. _Lost_ because the first real packet buried its composed wording in a
  relation's note, where the page could not show it at the passage. _Cost:_ an edit whose `before`
  is not in the snapshot cannot be checked for collisions.
- **Groups stand for members.** `members` lets one item carry many small ones of one shape.
  _Alternative:_ one item per ledger row. _Lost_ on a 33-item legacy backlog where nine needed only
  bookkeeping. _Cost:_ one verdict per group (Deferred, above).
- **The side pane survives narrow screens; the list yields.** At 1180 px and below the item list
  becomes an overlay (an "Items" button and `j`/`k` still reach it) and the pane stays.
  _Alternative:_ v1's choice, hiding the pane. _Lost_ because the pane now carries the passages the
  item is about. _Cost:_ the list is a click away on a laptop screen.

### The seam: a general review surface, and its intent-specific producers

The tool is heading toward a general surface for a human and an agent to review a change together —
an agent's own uncommitted or committed work, a pull request, a pass over intent — with the intent
architecture as one producer among several. This entry keeps the line between the two visible
without moving anything:

- **Core (generic):** the packet and decisions shape — the item as a question with what, so what,
  and now what; refs, edits, composed edits, context with reasons; verdicts, notes, anchors — the
  server, the page shell, the passage model (`ui/passages.ts`), diff rendering, themes. Nothing in
  the item's stages is specific to intent feedback: `ranInto` and `assumption` are labelled "what
  the build ran into" only for intent-feedback items, and read "what prompted it" for any other
  kind, so a code-change item reads naturally.
- **Intent-specific (the producer):** `scan.ts` (intent-feedback files and inline items, open
  questions, proposed ADRs, the ledger), the intent-feedback status vocabulary and the `ruled`
  parsing, the identifier linking of `IF-NNN`/entries/ADRs (`ui/xref.ts`), the kind labels and the
  home page's "what you are asked to do", and the dashboard.

Where an intent assumption remains in a core type — `status` is the intent-feedback status, and the
`ledger` is intent feedback's — it is optional, so another producer omits it. Extracting the core is
not this entry's work.

### Typography and rhythm

The page holds a lot; it must read at a steady cadence. Later work keeps these:

- **Type scale, one step each:** question 23.5 px / 1.28, weight 650, heading colour — stage heading
  19 px / 1.3 — lead (Now what's summary) 16.5 px — body 15.5 px / 1.68 — subhead 14 px, weight 650
  — small 13.5 px — meta 12.5 px — label 11 px, uppercase, 0.08–0.1 em tracking.
- **Spacing tokens:** 4 · 8 · 12 · 16 · 24 · 32 · 44 px (`--sp-1`…`--sp-7`). Head to first stage 32;
  between stages 24 plus a hairline rule; a stage's heading to its body 12; blocks inside a stage
  24; a subhead to its text 8.
- **Measure:** prose in the middle column at 68ch (`--measure`); the grid gives the middle column
  room for it at 1440 px (list 264 px, pane 37%).
- **Stage marks:** a small uppercase label in the accent colour (WHAT, SO WHAT, NOW WHAT) beside a
  plain heading ("The facts", "Why it matters", "Your choices") — the label for scanning, the
  heading for reading.
- **Callouts, calm:** quoted passages on the sunken surface with a margin rule; the ruled note and
  collisions in the defer tint with a margin rule; consequences as two bordered cards with a
  coloured dot; the advice in a dashed, unfilled box so it reads as an aside.
- **Colour for meaning only:** the passages in question carry the theme's focus tint and rule;
  edited text green, removed red; context passages a faint link tint; the ruling dock keeps the
  verdict colours. Everything else is ink, muted ink, and lines.
- **Passages in the side pane:** the passage's blocks get a 3 px margin rule; a label above names
  its number, what it is, and any other item editing it; an edit's wording sits below in a raised
  box. The tint is kept light because the rule already carries a long passage.

### Mechanisms

- **The passage model.** `ui/passages.ts` is pure: from an item, the snapshot, and the other items
  it computes each passage's range, number, role (edit, evidence, context), and colliding items, and
  the side pane's files in two groups with their reasons. The middle and the side pane read the same
  model, so a number means the same text in both; references in the middle land on the passage they
  overlap and flash it.
- **Decorating a rendered file.** The pane renders the file as before (prose that keeps its offsets,
  or code), then marks each passage's blocks and inserts its label and diff around them. The
  inserted elements carry the passage's source offsets and are not selectable, so a selection that
  brushes them still maps to source text and notes anchor as before.
- **The after-the-edits view** applies the item's edits to the file text and renders the result, the
  new text marked, with no annotation target.
- **Inline intent feedback.** Under an entry README's `## Intent feedback` heading, each
  `- **IF-NNN** — …` bullet (with its indented continuation) is split at its italic or bold labels
  (Friction, Assumption…, Proposed revision, Disposition, Status, Adjudicated, Declined); the lead
  is the Slice. The status is the disposition's, else a trailing `` `pending`. ``, else a Resolution
  paragraph (inferred adjudicated), else pending (inferred) — and the ledger says which.
