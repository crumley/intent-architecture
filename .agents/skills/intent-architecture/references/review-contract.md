# The review contract: packet (version 2) and decisions (version 1)

The whole interface between an agent and the review tool is two JSON files: the **packet** the agent
writes and `serve` reads, and the **decisions** the page writes when the human submits. This is the
field-by-field reference, readable without the skill's home repository. How to fill the fields well
— the question to ask, what belongs in each stage, fairness — is in [`review.md`](review.md).

Every field not listed is ignored, so an addition an older reader may skip does not bump a version;
a change to a listed field's meaning does. The tool refuses a version it does not know rather than
guessing. `validate --packet` names every error by its JSON path and then prints **advice**: things
a valid packet still lacks or gets subtly wrong (a quote that is not verbatim, a question still in
the scanner's draft wording, two items editing one passage with no composed wording). Advice is not
an error; fix it anyway.

## The packet

```ts
type Packet = {
  kind: 'intent-review-packet';
  version: 2;
  mode: 'main' | 'branch'; // the repository as it stands, or a branch against its base
  producer?: string; // the lens that prepared it: "open-items", "branch-review", …
  title: string;
  createdAt: string; // ISO 8601
  iteration?: number; // 1 for a first pass; each later pass increments it
  repo: { name: string; root?: string; ref?: string }; // ref: what the snapshot is of
  change?: Change; // branch mode only — required there, refused in main mode
  reviewer?: string; // pre-fills the reviewer's name
  intro?: string; // Markdown: what this pass holds and the overall recommendation
  items: Item[];
  files: { path: string; text: string }[]; // the snapshot: repository-relative paths
  omitted?: { path: string; reason: string }[]; // tracked files left out (binary, too large)
  ledger?: LedgerRow[]; // every intent-feedback item in the repository, for the dashboard
};

type Change = {
  base: { ref: string; sha: string }; // the merge base
  head: { ref: string; sha: string };
  summary?: string; // what the branch does, what needs the human, what blocks the merge
  recommendation?: { verdict: 'approve' | 'request-changes' | 'comment'; why: string };
};
```

The packet is **self-contained**: every path an item points at (`evidence`, `context`, every edit)
must be in `files`, and the page reads nothing else.

### An item

Each item asks the human one question and answers it in three stages. The page shows them in this
order, top to bottom; the ruling sits in a dock at the foot.

```ts
type Item = {
  id: string; // stable; see "Ids" below
  kind: string; // open vocabulary; see "Kinds" below
  category?: string; // a producer's own sub-kind: "inline", "group", "drift", …
  question: string; // REQUIRED — the headline: one line, a question to the human
  title: string; // the item's own name (an intent-feedback item's heading): the subtitle
  status?: 'pending' | 'ruled' | 'adjudicated' | 'declined'; // required for kind "if"
  statusLine?: string; // the Status as written in the repository
  attention?: 'judgment' | 'routine'; // either mode; the queue orders by it
  ruled?: { by: string; on: string; ruling: string; where?: string }; // already ruled: confirm the wording
  members?: string[]; // a grouped item: the ledger ids it stands for
  source: { path: string; line: number }; // where the item is written
  evidence: Ref[]; // the passages in question — quoted under What
  context?: ContextRef[]; // related files, shown apart, NOT edited — each says why
  sections: { key: string; label: string; text: string }[]; // the item as written (annotatable)
  what?: { facts: string; ranInto?: string; assumption?: string };
  soWhat?: { stakes: string; relations?: { item: string; note: string }[] };
  nowWhat?: {
    summary?: string;
    edits?: Edit[]; // the files this decision would edit
    composed?: { with: string[]; edits: Edit[]; note?: string }[];
    ifAccepted?: string;
    ifDeclined?: string;
    recommendation?: { verdict: Verdict; why: string }; // shown LAST, labelled as advice
  };
  changes?: FileChange[]; // branch mode only
  baseStatusLine?: string; // branch mode only: the Status at the base, when the branch changed it
};

type Ref = {
  path: string; // in files[]
  section?: string; // the heading it sits under, for the reader
  quote?: string; // verbatim, in the file's own line breaks and indentation
  lines?: { start: number; end: number }; // 1-based, for code or when a quote will not do
  note?: string; // one line: why this passage
};
type ContextRef = Ref & { why: string }; // REQUIRED: why the file is shown
type Edit = { path: string; before: string; after: string; note?: string }; // before: verbatim
type Verdict = 'accept' | 'amend' | 'decline' | 'defer' | 'revise';
type FileChange = {
  path: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  oldPath?: string;
  patch: string; // a unified diff, base...head
};
type LedgerRow = {
  id: string;
  entry: string; // the design entry directory
  title: string;
  status: 'pending' | 'ruled' | 'adjudicated' | 'declined';
  slices: string[]; // intent files it cites
  source: { path: string; line: number };
  statusLine?: string;
  form?: 'file' | 'inline'; // an intent-feedback file, or inline in an entry README
  inferred?: string; // set when no Status line says the status: how it was inferred
};
```

**Text fields are Markdown** (`intro`, `what.*`, `soWhat.stakes`, `nowWhat.summary`, `ifAccepted`,
`ifDeclined`). In them, and in `question`, `title`, and every `note`/`why`, the page **links
identifiers**: intent-feedback ids (`IF-005`, `0051 IF-001`, the legacy `SF-005`), design entries
(`0031`), decisions (`ADR 0006`), and repository paths — cite them rather than describing them.

### The three stages, field by field

| Stage        | Fields                                                                               | What belongs there                                                                                                                   |
| ------------ | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| The question | `question` (+ `title` as subtitle, `ruled`, `members`)                               | One line, asked of the human, naming the actual decision.                                                                            |
| **What**     | `what.facts`, `evidence`, `what.ranInto`, `what.assumption`                          | The facts, without advocacy: what the intent says now (the passages, quoted), what the work ran into, the assumption made meanwhile. |
| **So what**  | `soWhat.stakes`, `soWhat.relations`                                                  | Why it matters: what breaks or stays ambiguous if nothing changes; which other items it touches.                                     |
| **Now what** | `nowWhat.summary`, `edits`, `composed`, `ifAccepted`, `ifDeclined`, `recommendation` | The choices: the proposal and its edits, what each choice leads to, then — last, labelled as advice — the recommendation.            |

`what.facts` and `soWhat.stakes` are required when their stage is present. An item with none of the
three (a scanner skeleton) still renders, under a note that the analysis is missing.

### Edits and context: the two kinds of file

The page's right-hand pane shows two groups, kept visibly apart:

- **Files this decision would edit** — every path in `nowWhat.edits`. Each is shown whole, with
  every passage in question marked and numbered (1, 2, …), and each edit's proposed wording shown in
  place. With no edit, the files holding the `evidence` take this place, as the intent in question;
  in a branch review, the changed files do.
- **Related, for context — not edited** — every `context` file, each with its `why`, and any
  `evidence` file no edit touches (its `note` is the reason shown). A `quote` or `lines` on a
  context ref marks the span that matters there.

**Numbering.** Edits are numbered first, in `edits` order; then each `evidence` passage that no edit
already covers. An evidence quote that overlaps an edit shares that edit's number, so "passage 2"
means the same text in What, in Now what, and in the pane. Context passages are not numbered.

**Collisions.** When two items' edits rewrite overlapping text of one file, the page flags it on
both items. Declare what to land if both are accepted with `composed` on either item:
`{ with: [<the other item's id>], edits: [<the wording for both>], note? }` — each `before` still
verbatim from the snapshot. `validate` advises when overlapping edits have no composed wording.

### Kinds

The vocabulary is open: the page renders the known kinds with their own labels and any other kind
generically, so a new producer needs no schema change.

| Kind            | Is                                                                   | Notes                                                       |
| --------------- | -------------------------------------------------------------------- | ----------------------------------------------------------- |
| `if`            | an intent-feedback item (`sf`, the legacy spelling, is accepted)     | `status` required. On a ruled item, accept reads "confirm". |
| `question`      | an open question                                                     | Status `pending`.                                           |
| `decision`      | an ADR still `proposed` (main), or a changed ADR (branch)            | In branch mode accept/decline read approve/reject.          |
| `intent-change` | a changed intent file on a branch                                    | Branch mode; carries `changes`.                             |
| `design-entry`  | a changed design entry on a branch                                   | Branch mode; carries `changes`.                             |
| `finding`       | something a producer noticed (`category`: `drift`, `hidden-intent`…) | Evidence may point at code by `lines`.                      |

### Ids

Ids are stable strings, unique in the packet. The scanner writes: `<entry-dir>/IF-NNN` for intent
feedback (in a file or inline), `OQ/<slug>` for a cross-cutting open question,
`design/decisions/<file>` for an ADR, `intent-change/<path>` and `design/<entry-dir>` on a branch.
An item the agent adds by hand uses a prefix that says what it is: `group/<slug>` for an item that
stands for several (its `members` name them, as the ledger does), `finding/<slug>` for a finding,
`OQ/<slug>` for a per-slice open question pulled in by hand. A hand-added item still needs a real
`source` — the file and line where the thing it is about is written — because the agent's executor
writes the outcome there.

### Which fields go with which mode

| Field                               | main    | branch   |
| ----------------------------------- | ------- | -------- |
| `change`                            | refused | required |
| `items[].changes`, `baseStatusLine` | refused | allowed  |
| `attention`                         | allowed | allowed  |
| everything else                     | allowed | allowed  |

## The decisions (version 1, unchanged)

```ts
type Decisions = {
  kind: 'intent-review-decisions';
  version: 1;
  packet: { title: string; createdAt: string; mode: 'main' | 'branch'; iteration?: number; digest: string }; // sha256:<hex> of the packet file
  reviewer: string;
  submittedAt: string;
  comment?: string;
  overall?: { verdict: 'approve' | 'request-changes' | 'comment'; note?: string }; // required in branch mode
  verdicts: (
    | { item: string; verdict: 'accept'; note?: string }
    | { item: string; verdict: 'amend'; wording: string; note?: string }
    | { item: string; verdict: 'decline'; why: string; note?: string }
    | { item: string; verdict: 'defer'; ruling?: string; note?: string }
    | { item: string; verdict: 'revise'; request: string; note?: string }
  )[]; // only items ruled on; an absent item is unreviewed
  annotations: {
    id: string;
    target: { kind: 'file'; path: string } | { kind: 'item'; item: string; section: string };
    item?: string; // the item open when a file note was made
    selector: { exact: string; prefix: string; suffix: string };
    at?: { start: number; end: number; line: number }; // a hint into the snapshot
    kind: 'comment' | 'question' | 'suggestion' | 'intent-here' | 'mismatch';
    comment: string; // may be empty only for a suggestion
    suggestion?: string; // a suggestion's replacement for `exact`
    createdAt: string;
  }[];
};
```

A verdict on a **grouped** item applies to every member: carry it out member by member. The draft
(`<out>.draft.json`) has the decisions' shape with `kind: 'intent-review-draft'` and no
`submittedAt`.

## Migrating a version 1 packet

`validate` and `serve` refuse a version 1 packet and print this mapping:

| Version 1                                             | Version 2                                                 |
| ----------------------------------------------------- | --------------------------------------------------------- |
| —                                                     | `question` (new, required)                                |
| `analysis.summary`                                    | `what.facts` — the facts only; advocacy moves to Now what |
| the friction and the assumption, in plain words       | `what.ranInto`, `what.assumption`                         |
| —                                                     | `soWhat.stakes` (new, required with `soWhat`)             |
| `analysis.relations`                                  | `soWhat.relations`                                        |
| `proposal.summary`, `proposal.edits`                  | `nowWhat.summary`, `nowWhat.edits`                        |
| `analysis.ifAccepted`, `ifDeclined`, `recommendation` | `nowWhat.ifAccepted`, `ifDeclined`, `recommendation`      |
| `context[].note`                                      | `context[].why` (required)                                |
| a ruled item's Status line only                       | plus `ruled: { by, on, ruling, where? }`                  |
| `attention` in branch mode only                       | `attention` in either mode                                |
