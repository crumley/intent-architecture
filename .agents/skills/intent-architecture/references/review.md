# Reviewing intent: the review tool

This skill ships a local review page for the human side of the intent architecture: ruling on intent
feedback, settling open questions and undecided decisions, and judging a branch's change to the
intent before it merges. The agent prepares a **packet**, the human reviews it in the page, and the
agent carries out the **decisions** the page writes. The tool never calls a model; the packet and
the decisions files are the whole contract between agent and tool.

Use this when asked to "review the open intent feedback", "review the intent", "what needs my
decision", "review this branch / PR's intent changes", or when a pile of pending intent-feedback
items is worth working through.

## The tool

```sh
node <skill-dir>/scripts/review.mjs --help
```

`<skill-dir>` is the directory holding this skill's `SKILL.md`. The script is one file, needs Node
20 or later and nothing else, and is built from the skill's home repository (`tools/review/`) —
never edit it by hand. Commands: `scan` drafts a packet from a repository, `validate` checks a
packet or decisions file, `serve` runs the review page, `locate` re-finds the human's notes in the
current files, and `check-apply` confirms, before you edit anything, that the decisions answer the
packet and that every edit they land is still anchored in the tree as it is now. The full contract —
every field, which fields go with which mode, the item kinds, the id conventions, and how to migrate
a version 1 packet — is in [`review-contract.md`](review-contract.md), beside this file.

Write packets and decisions to a scratch directory **outside** the repository: a packet carries a
snapshot of the repository's files (a few megabytes for a mid-sized one) and is never committed.

## Producers: what to put in front of the human

A **producer** is a procedure for preparing a packet. This skill defines two; the tool and the
contract already accommodate the rest.

| Producer           | The question                                                       | Mode   | Status in this skill |
| ------------------ | ------------------------------------------------------------------ | ------ | -------------------- |
| Open items         | What outstanding feedback and open decisions do we need to settle? | main   | defined below        |
| Branch review      | What does this change do to the intent; is it ready to merge?      | branch | defined below        |
| Intent improvement | Where is the existing intent weak — vague, why-less, owned twice?  | main   | planned              |
| Intent extraction  | What intent lives only in the code, to be made explicit?           | main   | planned              |
| Drift audit        | Where does the code no longer match the intent?                    | main   | planned              |
| Contradictions     | Where does the intent, or the code, contradict itself?             | main   | planned              |

The planned producers would write items of kind `finding` (with a `category` such as `weak-intent`,
`hidden-intent`, `drift`, `contradiction`) whose evidence points at intent passages and code line
ranges; the human's `intent-here` and `mismatch` notes are their natural answers. Until their
procedures land, say so if asked for one, rather than improvising a different contract.

## 1. Prepare the packet

**Open items (main mode).** On an up-to-date checkout of the main line (or pass `--ref <main>` to
read a ref without checking it out):

```sh
node <skill-dir>/scripts/review.mjs scan --repo <repo> --out <scratch>/packet.json [--files repo|intent] [--no-inline] [--no-questions]
```

Intent feedback lives in each design entry's `intent-feedback.md`, with ids `IF-NNN`. A repository
not yet migrated to that vocabulary keeps `spec-feedback.md` and `SF-NNN`; the scanner reads both
and normalizes ids to `IF-NNN` (the source text keeps its own spelling, so quotes still match). When
you edit a Status line later, edit the file the item came from (its `source.path`) in that file's
own spelling — migrating a repository's vocabulary is its own change, not part of a review. Older
entries may record intent feedback **inline** in their README, under `## Intent feedback`, as
`- **IF-001** — …` bullets settled by a trailing `_Disposition:_` (or `_Adjudicated:_`); the scanner
reads those too (`category: "inline"`), and where no disposition says the status it infers one and
says how (`ledger[].inferred`).

This lists every pending and ruled-but-pending intent-feedback item, every cross-cutting open
question not marked `_Standing watch._`, and every ADR still `proposed`, with a ledger of every
intent-feedback item for the dashboard. `--files repo` (the default) snapshots every tracked text
file, so the human can read and annotate code; `--files intent` snapshots `intent/` only — smaller,
but then no design file can be quoted or shown as context. `--no-inline` keeps inline items in the
ledger but out of the queue. The scanner pre-fills each intent-feedback item's context with where it
is written and the entry that raised it, and drafts a placeholder `question` for every item —
`validate` advises until you replace each one.

**Branch review (branch mode).** From the repository, against the branch's base:

```sh
node <skill-dir>/scripts/review.mjs scan --repo <repo> --base <base-ref> --head <branch> --out <scratch>/packet.json
```

This lists every changed intent file, every intent-feedback item the branch raises, re-statuses, or
rewrites, every changed ADR, and every changed design entry — each with its diff, measured from the
merge base.

The scan does the mechanical half. Then **edit the packet** (it is JSON; a small script that reads
the scan and writes the packet, checking every quote, is easier to rerun than hand edits) and write
the half only you can write. Each item asks the human **one question** and answers it in three
stages — **What**, **So what**, **Now what** — which the page shows in that order, with the ruling
at the foot. The full field list is in [`review-contract.md`](review-contract.md).

- **The question** (`question`, required). One line, asked of the human, naming the decision the
  item really puts to them — "Should the multiplexer seam say it carries hosting only, and leave
  messaging to the messaging seam?" — not "Review IF-002" and not the friction restated. It is the
  item's headline; `title` (the item's own heading) becomes the subtitle. The scanner's drafted
  question is a placeholder: replace it.
- **What — the facts** (`what.facts`, `evidence`, `what.ranInto`, `what.assumption`). What the
  intent says now, what the work ran into, and the assumption made to keep moving — **without
  advocacy**: no "should", no "rightly", no verdict. A reader who stops after What knows the
  situation, not your opinion.
  - `evidence`: each passage in question, with a `quote` copied **verbatim from the file, in the
    file's own line breaks and indentation** (a hard-wrapped bullet's continuation lines keep their
    two leading spaces) — the smallest passage that carries the point — or a `lines` range for code.
    The scanner fills a quote when it can match the item's own; **check that it is the minimal
    passage**, not a whole bullet when one clause is meant, and widen or narrow it. A quote that is
    not verbatim shows a warning on the page and in `validate`'s advice.
- **So what — why it matters** (`soWhat.stakes`, `soWhat.relations`). What breaks, or stays
  ambiguous, if nothing changes — concretely, in this repository. Then `relations`: other items it
  touches, each with a one-line note ("IF-006 edits the same sentence").
- **Now what — the choices** (`nowWhat`). `summary` (what the proposal does, and — when you narrowed
  or widened the filed proposal — how and why), `edits` (each proposed revision as an edit: `before`
  copied verbatim from the snapshot, `after` the revised text, an optional one-line `note`), then
  `ifAccepted` and `ifDeclined` (concrete consequences in this repository), then `recommendation`
  (`verdict` + one-line `why`). The page shows the recommendation **last, labelled as advice**.
  - **Every edit the decision makes is an edit.** Never promise one in prose ("the agent makes that
    consequential edit to the glossary"): the human rules on the wording they see, and an edit they
    never saw is one they never ruled on. If accepting also touches a glossary row, a canonical-home
    list, or a second slice, write each as its own entry in `edits`. `validate` advises on prose
    that reads like a promised edit.
  - **Anchor each edit at a boundary.** `before` runs to the end of the sentence, clause, or bullet
    it changes — never a truncated prefix — so an insertion lands where a reader would put it, not
    in the middle of a bullet. `validate` advises when a `before` cuts a word or an insertion
    follows a `before` that stops mid-sentence.
  - When the edit you show already narrows the filed proposal, recommend `accept` (accept means
    "make the edit as shown") and say in `summary` what you changed; keep the filed proposal in the
    item's own `sections`, which the page offers as "as written". Recommend `amend` only when you
    want the human to write the wording.
  - **Edits vs context.** `edits` are the files this decision would change; the page shows them
    whole, each passage marked and numbered. Everything else worth reading beside the item goes in
    `context` with a `why` ("0031 already builds attach and resume as separate verbs; this is where
    it says so") — the entry or ADR it comes from, the slice that owns a question, the code. Context
    is shown apart and labelled as not edited.
  - **Collisions.** When two items edit the same passage, give each its own edit against the current
    text, and on one of them add
    `composed: [{ with: [<other id>], edits: [<the wording if both are
    accepted>], note }]`. The
    page flags the collision on both items and shows the composed wording.
- **Fairness is the job.** State the strongest case for the option you do not recommend (in
  `ifAccepted` or `ifDeclined`); do not recommend accepting an intent-feedback item merely because
  the build already assumed it; say when a proposed revision is really design (how) rather than
  intent (what/why) and belongs in the entry instead. Facts in What carry no advocacy; the
  recommendation lives only in Now what.
- **Write identifiers, not descriptions.** The page links intent-feedback ids (`IF-005`,
  `0051 IF-001`, the older `SF-` spelling), design entries (`0031`), decisions (`ADR 0006`), and
  repository paths wherever they appear in the packet's text, with a peek on hover — so cite them.
- **Triage** (`attention`, either mode). `judgment` for intent changes, contested items, new
  constraints, anything where reasonable people differ; `routine` for wording fixes, bookkeeping,
  open questions with nothing to decide, branch build logs and evidence files. The queue shows
  judgment first and routine last; a routine item folds What and So what to a one-line preview, so
  write the first sentence of each to stand alone.
- **Already ruled** (`ruled`). An item whose Status reads
  `pending — ruled by <who> <date>, awaiting
  the intent edit: …` (or whose entry records the
  ruling in its text) gets `ruled: { by, on, ruling, where? }` — the scanner fills it from a Status
  line. The page frames it as confirming the wording (accept reads "confirm"), so ask accordingly:
  "Does this sentence land your 2026-11-06 ruling that …?" — and recommend the wording that lands
  the ruling, nothing more.
- **Carrying the last pass** (`decided`). When you bring back what the human left open, you may keep
  the items they already ruled on as context: copy each with
  `decided: { verdict, by, on, words?, pass }` from the earlier decisions file. They sit read-only
  at the foot of the queue, so the human reads the open items beside what they decided.

**By kind:**

- **Intent feedback** — What: the passage, the friction, the assumption. So what: what a design
  following the current text literally would do. Now what: the revision as an edit.
- **Open questions** — What: the question as tracked, who owns it, what has happened since. So what:
  what is blocked or keeps being re-deferred. Now what: a proposed answer as an edit to the owning
  slice, or — when there is none — `defer`, optionally with a ruling to record. A question that is
  really a **standing watch** (a check to repeat, not a question to settle) gets an edit that marks
  it `_Standing watch._`; accepted, the scanner stops offering it every pass.
- **Decisions (ADRs still proposed)** — What: what the ADR chooses, over what, and since when. So
  what: what stays unsettled while it is proposed (in-place amendment instead of superseding, a
  build starting on an unsettled choice), and any open premise. Now what: the Status edit, with the
  honest middle course (defer until a named check runs) in `ifDeclined`.
- **Branch changes** — What: what the change does (the diff is shown with it). So what: what it does
  to the intent. Now what: approve/amend/reject, with what each leads to.
- **Hand-added items** — any kind, with an id that says what it is (`group/<slug>`,
  `finding/<slug>`; see [`review-contract.md`](review-contract.md#ids)) and a real `source`: the
  file and line where the thing is written, since that is where its outcome is recorded.
- **Groups** — many small items of one shape (a backlog of inline intent feedback that already
  landed, three items from one entry that one ruling settles) read better as one item with `members`
  naming each ledger id, its own question, and one numbered passage or edit per member. A ruling on
  the group applies to every member; keep members that need different rulings apart.

**Framing.** `intro` (main mode): three to five lines on what this pass holds and your overall
recommendation, by attention. Drop items you are not asking about this iteration — a smaller packet
gets a better review. Set `reviewer` to the human's name when you know it. In branch mode,
`change.summary`: one paragraph — what the branch does to the intent, what needs the human, what is
routine, what (if anything) blocks the merge (pending intent-feedback items do not block a merge; an
intent edit inside a build branch does — it must ride its own change) — and `change.recommendation`:
`approve`, `request-changes`, or `comment`, with why.

Then check it — fix every error before serving, and work through the advice it prints (quotes not
verbatim, draft questions, one-sided recommendations, ruled items without their `ruled` block,
collisions without a composed wording):

```sh
node <skill-dir>/scripts/review.mjs validate --packet <scratch>/packet.json
```

A version 1 packet (from an older skill) is refused with the field-by-field mapping to version 2.

## 2. Run the review

```sh
node <skill-dir>/scripts/review.mjs serve --packet <scratch>/packet.json --out <scratch>/decisions.json --open
```

Run it as a long-running or background process and **wait for it to exit**; do not stop it. It
prints `review: open <url>` — give the human that exact URL (it carries an access token; `--open`
also opens it in their browser), say what the packet holds, and that their work autosaves.

The page opens on a **home page** that explains the review, what the human is asked to do (with
counts), how to work through it, and a legend of every ruling, mark, colour, note kind, and key
(also one `?` away from any view) — so you need not repeat that. Deep links land elsewhere:
`<url>#item=<id>`, `#file=<path>`, `#view=queue|files|dashboard|submit`. `--theme <id|file.json>`
starts in a theme; the human can also pick one in the page, or add their own
([`review-themes.md`](review-themes.md)).

Exit codes: `0` — the decisions file is written (whole) · `3` — the human abandoned the review (no
decisions; their draft is kept beside the decisions path and restores on the next `serve` of the
same `--out`) · `2` — bad arguments or an invalid packet · `1` — an unexpected failure.

## 3. Carry out the decisions

Read `<scratch>/decisions.json` (version 2; a version 1 file from an older page reads the same way,
without `accept-with-changes` and with a `note` possible beside any verdict). Before editing
anything, check that the decisions still fit the tree you are about to change:

```sh
node <skill-dir>/scripts/review.mjs check-apply --packet <scratch>/packet.json --decisions <scratch>/decisions.json --repo <repo>
```

It confirms the digest (the decisions answer this packet), says whether the repository has moved
since the snapshot, and re-checks that every edit a landing verdict needs — or the composed wording,
when both colliding items land — still has its `before` exactly once in the current files; notes are
re-located too. Exit `0`: apply. Exit `4`: something drifted — re-read the passage, and when the
change is more than mechanical, bring the item back next pass rather than guessing. `locate`
re-finds individual notes the same way.

**Order of work.** Open the **intent change first**: the Status lines you write next link to it.
Then the Status lines (design edits), then everything else the notes ask for.

**Verdicts on intent feedback** (and how the intent-feedback item's **Status** line reads afterwards
— never rewrite the intent-feedback item's original text):

| Verdict             | Do                                                                                                    | Status line                                                                                                     |
| ------------------- | ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| accept              | Make the edit exactly as shown, in an intent change. The `note`, if any, is guidance (below).         | `pending — ruled by <reviewer> <date>, awaiting the intent edit: <the ruling, one line> (<link to the change>)` |
| accept-with-changes | Rewrite the edit to the reviewer's `instructions`, then make it; say in the change how you read them. | as for accept; the ruling line ends "…, with the reviewer's changes: <one line>"                                |
| amend               | Make the intent edit in the reviewer's `wording`, verbatim.                                           | as for accept                                                                                                   |
| revise              | Land nothing. Rework the proposal or analysis as `request` says; it goes in the next packet.          | unchanged                                                                                                       |
| decline             | No intent edit.                                                                                       | `declined — <the reviewer's why>`                                                                               |
| defer               | With a `ruling`: record it. Without: nothing.                                                         | with a ruling: `pending — ruled by <reviewer> <date>, awaiting the intent edit: <ruling>`; else unchanged       |

- **An accept's note never rewrites what lands.** A note that is guidance (how to phrase the change
  description, a consequence for the design, a check to add) is honoured where it belongs. A note
  that would **change what the edit says** is not improvised into the wording: land nothing for that
  item, and bring it back next pass as a ruled item (`ruled`, the note as the ruling) with the
  wording that lands it, to confirm. The page tells the human this; to have you change the words
  without another look, they choose accept with changes.
- **Status line forms.** `<date>` is `YYYY-MM-DD`; `<reviewer>` is the decisions' `reviewer`.
  - A ruling **re-confirmed** in a later pass keeps its first date and adds the confirmation before
    "awaiting":
    `pending — ruled by <reviewer> <date> (<where>), confirmed <date> (<where>), awaiting the intent edit: <ruling> (<link>)`.
    The scanner reads whatever sits between the date and "awaiting" as where it was ruled.
  - An **inline** legacy item (a `- **IF-NNN** — …` bullet in an entry README) gets a trailing
    `_Status:_ pending — ruled by …` (or `_Status:_ declined — …`) at the end of its bullet; once
    its intent change merges, `_Disposition:_ adjudicated — …` as the older items have it. The
    scanner reads both.
  - **Settling.** When the intent change merges, the Status becomes
    `adjudicated — <link> (<reviewer>'s ruling: <one line>)` — the merge is the adjudication act, so
    the Status says adjudicated only after it. Name the reviewer; a repository whose history already
    writes a role ("owner's ruling") keeps its own convention. Nothing else owns this flip: after
    the merge, `scan --merged <#n,…>` (the changes you know merged — the tool asks no forge) offers
    each ruled item awaiting one of them as a routine settling item with the Status edit, or make
    the edit yourself in a small design change.
- **Intent edits ride their own change** — a branch and pull request that touches only `intent/`,
  never bundled into a build or design change. Group by coherent ruling (typically one change per
  design entry's accepted intent-feedback items).
- **Status lines are design edits.** They go where the entry lives: on its build branch while that
  is unmerged (confirm its pull request is still open before pushing), otherwise in a small design
  change.
- **Upkeep the accepted edit implies.** An edit that adds a constraint to a slice also adds it to
  that slice's `## Canonical home for` list, in the same change (when the packet did not already
  show that as an edit, say so in the change). A note on an accepted ADR that adds a consequence
  goes into the ADR's Consequences, in the same change as its Status.
- **Open questions:** accept/amend resolves the question in the slice that owns it (and marks it
  settled or removes it from the index, per the repository's convention) in an intent change — or,
  when the edit marks it `_Standing watch._`, makes that one edit; decline removes it with the why;
  defer leaves it.
- **Grouped items** (`members`): the verdict applies to each member — one Status line per member,
  and the edits in one change. A note on a member's own text is that member's.
- **Collisions:** when both colliding items land, land the `composed` wording, not either edit
  alone.
- **Proposed ADRs:** accept moves the ADR's Status to accepted; amend edits it to the reviewer's
  wording first; decline marks it rejected with the why (supersede, never delete).
- **Branch items** (`accept` reads as approve, `decline` as reject): approve needs nothing;
  approve-with-changes and amend change the branch as instructed or worded; reject reverts or
  reworks that change on the branch; revise reworks it for another look. The **overall verdict**:
  `approve` — report the branch ready (merging stays with the human); `request-changes` — make the
  fixes on the branch, then prepare a fresh branch packet; `comment` — relay the notes. Post
  anything to a forge only when the human or the repository's conventions ask for it.
- **The pass's `comment`** — the reviewer's word on the whole pass — goes into your report, and into
  the description of the intent change when it bears on what lands.

**Notes** — every one is acted on, never dropped:

| Kind          | Do                                                                                                                             |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `comment`     | Weigh it; act if it implies a change, else answer it in your report.                                                           |
| `question`    | Answer it — in your report, or as an item in the next packet when the answer needs a ruling.                                   |
| `suggestion`  | Apply the replacement text where it was made (intent file → an intent change; design → a design change; code → a code change). |
| `intent-here` | Add the stated intent to the slice that owns it, or strengthen that slice's passage; if the home is unclear, make it an item.  |
| `mismatch`    | Make it an item next pass with both options — change the code, or revise the intent — unless the note already says which.      |

A note made while an item was open carries `item`: read it with that item's ruling. A note on the
**agent's own text** (`target.kind: "field"` — the question, the facts, an edit's proposed wording)
is about your proposal, not the repository: apply a suggestion there to the wording you land (for an
accepted edit) or to the reworked item (for revise), and answer the rest in your report. Names the
human types in notes are theirs, typos included — when one does not match anything in the snapshot
(a tool, a person, a file), check before you carry it into intent.

Then report to the human: what changed, the links to every change opened, and what goes into the
next pass.

## 4. Iterate

The next packet holds what came back: items marked `revise` (reworked), accepts whose note would
change the wording (as ruled items, to confirm), items the human did not reach, and new items born
of notes — optionally with the items they already ruled on carried as `decided` context. Increment
`iteration`. Repeat until a pass comes back empty or the human stops — nothing is lost either way,
because every ruling not yet carried out is in a decisions file or still pending in the repository.
