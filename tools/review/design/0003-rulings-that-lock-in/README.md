# 0003 — Rulings that lock in, notes anywhere

> Makes a ruling an explicit, visible act — six verdicts, each with one box and a line on what the
> agent does next, recorded with Enter as a chip the queue reflects — lets a note anchor to any text
> the page renders, the agent's own included, and adds what applying decisions to a real repository
> showed the skill lacked: decisions version 2, `check-apply`, and settling merged rulings.
>
> **Status:** built — awaiting review · **Started:** 2026-11-08

The first full pass with the question-first page ([0002](../0002-review-format-v2/README.md)) — 21
items on a mature repository, 13 ruled and 8 left open on purpose — read well and ruled badly. A
reviewer who agreed with a proposal but wanted its wording changed, without writing the words, had
no verdict for it: amend asks for the words, and revise lands nothing, so the ruling went in as
revise, its box opening with an acceptance. Revise showed two boxes with no guidance on which to
use. Nothing said a ruling had been recorded. Choosing a verdict grew the dock under the cursor, so
the next click missed. Pressing `c` on most of the agent's text said only "select text", because
only files and an item's own sections took notes. The passage numbers, the headings, and the
question shared one colour in the default dark themes; hovering a number gave a path; the
consequences appeared twice; and the inline word diff was hard to read for prose.

Applying those 13 rulings to the repository then showed what the skill's apply instructions left
open: an accept whose note changed the substance, a Status line squeezed to fit the parser, no
convention for an inline item's Status, no owner for the later flip to adjudicated, edits promised
in prose that the reviewer never saw, a `before` cut mid-bullet, and no check that the tree still
matched the snapshot. This entry closes both sets.

## Serves intent

- [`00-review-loop.md`](../../intent/01-concepts/00-review-loop.md) — the six verdicts and their one
  piece of words each (an intent change this entry carries, in its own commit), and notes on the
  agent's own text.
- [`01-principles.md`](../../intent/00-foundation/01-principles.md) — principle 8 (anything can be
  annotated, now including the agent's text, and a selection that cannot take a note says why),
  principle 6 (a ruling's recording is visible and tied to the draft), principle 9 (readable first:
  passages in their own colour, a diff mode for prose, a dock that does not move), and principle 10
  (every mark explains itself; a legend from anywhere).
- [`00-agent-tool-contract.md`](../../intent/02-subsystems/00-agent-tool-contract.md) — decisions
  version 2 under the versioning rule (version 1 still read), annotations anchored to agent text by
  a named field, and validation at the edge before an agent applies anything.

## Scope

- **In:**
  - **Decisions version 2.** Verdicts `accept` (optional note), `accept-with-changes`
    (instructions), `amend` (wording), `revise` (request), `decline` (why), `defer` (optional
    ruling) — exactly one words field each; annotation targets gain `field` (item + field path);
    version 1 decisions and drafts are still read. Reference:
    [`review-contract.md`](../../../../.agents/skills/intent-architecture/references/review-contract.md).
  - **Decided items.** A packet item may carry `decided` — ruled in an earlier pass, shown read-only
    as context, refused if ruled again.
  - **The ruling dock.** One box per verdict with its label, placeholder, and what happens next;
    Enter or Record locks it in as a chip (Edit, Clear) whose save state follows the draft; the
    queue marks recorded, open, and unfinished; Next records first. The verdict row is the dock's
    last row and never moves.
  - **Notes anywhere.** Every agent-written field in the middle and the pane, every file, the
    proposed wording in the pane, and the after-the-edits view; a selection that cannot be anchored
    says why.
  - **Diff modes.** Inline, or before and after as two blocks; a key, a header control, and a toggle
    by the edits; remembered in `prefs.json`; applied wherever an edit renders.
  - **Passages.** A theme token, `accent-passage`, in every built-in; markers explain themselves on
    hover in the middle, the pane, and the tabs; evidence outlines dotted, edits solid.
  - **A legend** on the home page and in a `?` overlay from any view. Consequences once, under Now
    what.
  - **Applying.** `check-apply`; `scan --merged`; a tolerant ruled-Status parser; `validate` advice
    on edits promised in prose and on `before` cut mid-sentence or mid-word; the skill's apply
    procedure rewritten around them (order of work, Status forms, settling, upkeep, accepts with
    notes).
- **Deferred:**
  - **Flagging unknown names in notes** (a tool's name mistyped in a note). Safe to defer because
    the skill tells the agent to check a name that matches nothing in the snapshot before carrying
    it into intent; the page check is a convenience on top.
  - **Notes on packet-level text** (the home page's intro, a branch's summary). Safe to defer
    because that text frames the pass and carries no proposal; a comment on the pass goes in the
    decisions' `comment`.
  - **Asking a forge what merged.** `scan --merged` takes the agent's word. Safe because the tool
    must stay forge- and harness-neutral, and the agent that opened the change knows its state.
  - **A ruling per member of a group, automatic composition, a visual regression suite, and the
    rename to Markup** — unchanged from [0002](../0002-review-format-v2/README.md).
- **Acceptance:**
  1. `mise run check` in `tools/review/` is green (Biome, `tsc`, every test, bundle drift);
     `mise run check` and `mise run template-check` at the root stay green.
  2. Decisions version 2 refuses an accept-with-changes without instructions, a second words field,
     a field path naming no text, and a verdict on a decided item; version 1 decisions still
     validate under version 1's rules; a version 1 draft's note joins its verdict's box (tests).
  3. A selection in a diff maps to the file (current wording) or the edit's field (proposed
     wording), skips deleted words, and refuses a selection across two sources (tests of the
     composite model).
  4. `check-apply` reports a moved tree with anchored edits as ready and a missing `before` or a
     foreign digest as drift; `scan --merged` turns a ruled item awaiting a merged change into a
     settling edit (tests).
  5. The pass-3 packet for the same repository (8 open items, 13 decided) validates with no advice
     and renders in light and dark themes at 1440 and 1000 px: a passage tooltip, the legend
     overlay, both diff modes, an open and a recorded ruling, and notes on agent text (headless
     screenshots).

## Design

### Decisions

- Toolchain and packaging: unchanged — [0001](../decisions/0001-typescript-bun-toolchain.md),
  [0002](../decisions/0002-single-file-node-bundle.md).
- **A sixth verdict, not a second box.** Accept with changes is its own verdict. _Alternative:_ keep
  five and add a "note" beside each, as version 1 did. _Attractive_ because nothing in the contract
  moves. _Lost_ because the first real pass showed exactly that shape failing: two boxes on revise
  with no guidance, and an acceptance filed under a verdict that lands nothing. The agent must never
  infer the verdict from the words. _Cost:_ decisions version 2, and six buttons.
- **One box per verdict.** _Alternative:_ a words field plus an optional note on every verdict.
  _Lost_ for the same reason — two boxes ask the reviewer to choose where a thought goes, and the
  agent to reconcile them. _Cost:_ an amend cannot carry a remark beside its wording; a note on the
  passage does that.
- **An accept's note is guidance.** A note that would change what lands comes back as a ruled item
  to confirm. _Alternative:_ land the edit with the note's change and flag it. _Attractive_ because
  nothing waits a pass. _Lost_ because the reviewer would rule on wording they never saw; accept
  with changes now exists for "change it, I trust you". _Cost:_ such an item waits one pass.
- **Version 1 decisions stay readable.** _Alternative:_ refuse them, as packets refuse version 1.
  _Lost_ because decisions are what an agent applies after the pass, sometimes days later, with
  whatever tool is installed; a refusal there strands a human's rulings. Packets live for one pass
  and are regenerated. _Cost:_ the validator keeps version 1's verdict rules.
- **Notes on agent text anchor by field path,** `{ kind: 'field', item, field }`. _Alternative:_
  extend the `item` target's `section` to agent fields. _Lost_ because sections are the item as
  written in the repository — what the executor edits — while fields are the agent's proposal; the
  agent acts on each differently. _Cost:_ a third target kind.
- **Consequences once, under Now what.** _Alternative:_ keep the dock's copy, compacted. _Lost_
  because the dock's job is the ruling; the verdict tooltips quote each consequence's first sentence
  and the dock links to the full text. _Cost:_ on a long item the full consequences are a scroll (or
  one click) away.
- **Diffs default to before and after.** _Alternative:_ default to inline, as before. _Lost_ because
  the reviewer found inline hard to read for prose; inline stays one key away and is remembered.
  _Cost:_ a before/after diff takes more height.
- **Decided items in the packet, not a side list.** _Alternative:_ a packet-level list of earlier
  rulings. _Lost_ because the passages, collisions, and links that make an earlier ruling useful
  context all come from the item. _Cost:_ a large packet stays large until the earlier rulings land.

### Layout

- `src/fields.ts` (new) — field paths: parse, resolve to text, label. Shared by the validator,
  `locate`, `check-apply`, and the page, so a path means one thing everywhere.
- `src/ui/composite.ts` (new, pure) — composite text: what a diff or the after-the-edits view
  renders, each piece remembering its source, so a selection maps back to one target or says why
  not.
- `src/apply.ts` (new, pure) — the check-apply report; the command line supplies files and the head.
- The seam from
  [0002](../0002-review-format-v2/README.md#the-seam-a-general-review-surface-and-its-intent-specific-producers)
  holds: the verdicts, field targets, composite text, diff modes, and the dock are core; settling
  merged rulings and the Status vocabulary are the intent producer's (`scan.ts`).

### Mechanisms

- **A ruling's states.** None; open (its form is up); recorded (chosen, with every word it needs,
  closed); unfinished (chosen, missing its required words — kept in the draft, not submittable).
  Only "open" is page-local; the rest follow from the verdict, so a reload shows the same state.
  Leaving an item closes its form: a complete ruling is recorded, an incomplete one unfinished.
- **Words survive a change of mind.** Switching verdicts carries the typed words into the new
  verdict's box when it is empty, and keeps each box's words for the sitting, so nothing typed is
  lost by trying another verdict.
- **The dock.** A column: the form (or chip, or hint) on top in a scrolling area, then a one-line
  head (title, state, Next), then the verdict row. It sits at the foot of the item column, sticky,
  so it grows upward; the verdict row's position is fixed by the column's bottom edge.
- **Selection to anchor.** The innermost annotatable host owns a selection; a boundary inside a
  rendered span is that span's offset plus the position in it, and a boundary between nodes is the
  next offset-carrying span of the same host. A composite host maps the rendered range to one source
  through its pieces. Diffs keep each side's raw text in the DOM and render a hard-wrap break as the
  space it is (`white-space: normal`, paragraph and list breaks as block spans), so offsets are
  never rewritten. The aligned diff compares whitespace as equal unless a side has a paragraph
  break, so a reflowed sentence is "same".
- **Settling.** `scan --merged <refs>` matches each ruled Status's links (`#n`, a pull or merge
  request URL, a Markdown link) against the refs, finds the Status text in the file by its words,
  and proposes `adjudicated — <link> (<reviewer>'s ruling: <the ruling>)`.
