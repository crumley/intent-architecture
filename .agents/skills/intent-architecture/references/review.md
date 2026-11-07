# Reviewing intent: the review tool

This skill ships a local review page for the human side of the intent architecture: ruling on
spec-feedback, settling open questions and undecided decisions, and judging a branch's change to the
intent before it merges. The agent prepares a **packet**, the human reviews it in the page, and the
agent carries out the **decisions** the page writes. The tool never calls a model; the packet and
the decisions files are the whole contract between agent and tool.

Use this when asked to "review the open spec feedback", "review the intent", "what needs my
decision", "review this branch / PR's intent changes", or when a pile of pending SFs is worth
working through.

## The tool

```sh
node <skill-dir>/scripts/review.mjs --help
```

`<skill-dir>` is the directory holding this skill's `SKILL.md`. The script is one file, needs Node
20 or later and nothing else, and is built from the skill's home repository (`tools/review/`) —
never edit it by hand. Commands: `scan` drafts a packet from a repository, `validate` checks a
packet or decisions file, `serve` runs the review page, `locate` re-finds the human's notes in the
current files. The full contract (every field, every rule) is in the tool's design entry:
<https://github.com/crumley/intent-architecture/blob/main/tools/review/design/0001-review-tool-v1/README.md>.

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
node <skill-dir>/scripts/review.mjs scan --repo <repo> --out <scratch>/packet.json
```

This lists every pending and ruled-but-pending SF, every cross-cutting open question, and every ADR
still `proposed`, with the whole repository snapshotted and a ledger of every SF for the dashboard.

**Branch review (branch mode).** From the repository, against the branch's base:

```sh
node <skill-dir>/scripts/review.mjs scan --repo <repo> --base <base-ref> --head <branch> --out <scratch>/packet.json
```

This lists every changed intent file, every SF the branch raises, re-statuses, or rewrites, every
changed ADR, and every changed design entry — each with its diff, measured from the merge base.

The scan does the mechanical half. Then **edit the packet** (it is JSON) and write the half only you
can write. For every item you keep:

- **Evidence, exact.** Each `evidence` entry should carry a `quote` copied verbatim from the file
  (the smallest passage that carries the point) or a `lines` range for code. The scanner fills a
  quote when it can match the SF's own; check it, and add code locations where the item touches
  code. A quote that is not verbatim shows a warning on the page.
- **The proposal as an edit.** Turn the SF's proposed revision into `proposal.edits`: `before`
  copied verbatim from the file, `after` the revised text. Edits are against the snapshot; when two
  items edit the same passage, give each its own edit and say in `relations` how they compose.
- **The analysis, fair.** `summary` (what the item is really about, two or three sentences),
  `ifAccepted` and `ifDeclined` (concrete consequences in this repository), `relations` (other items
  it touches), and `recommendation` (`verdict` + one-line `why`). Fairness is the job: state the
  strongest case for the option you do not recommend; do not recommend accepting an SF merely
  because the build already assumed it; say when a proposed revision is really design (how) rather
  than intent (what/why) and belongs in the entry instead; for an SF already ruled, recommend the
  wording that lands the recorded ruling. Recommend `amend` when the direction is right but the
  proposal over-reaches.
- **Triage (branch mode).** Set `attention`: `judgment` for intent changes, SFs raised or
  re-statused, ADRs that choose a dependency or touch intent, anything contested; `routine` for
  entry bodies already reviewed, build logs, evidence files, mechanical edits. The page shows
  judgment first.
- **The overall read (branch mode).** `change.summary`: one paragraph — what the branch does to the
  intent, what needs the human, what is routine, what (if anything) blocks the merge. Pending SFs do
  not block a merge (the build proceeds on their assumptions); an intent edit inside a build branch
  does (it must ride its own change). `change.recommendation`: `approve`, `request-changes`, or
  `comment`, with why.
- **Framing (main mode).** `intro`: three to five lines on what this pass holds and your overall
  recommendation. Drop items you are not asking about this iteration — a smaller packet gets a
  better review. Set `reviewer` to the human's name when you know it.

Then check it — fix every error before serving:

```sh
node <skill-dir>/scripts/review.mjs validate --packet <scratch>/packet.json
```

## 2. Run the review

```sh
node <skill-dir>/scripts/review.mjs serve --packet <scratch>/packet.json --out <scratch>/decisions.json --open
```

Run it as a long-running or background process and **wait for it to exit**; do not stop it. It
prints `review: open <url>` — give the human that exact URL (it carries an access token; `--open`
also opens it in their browser), say what the packet holds, and that their work autosaves. Deep
links work: `<url>#item=<id>`, `#file=<path>`, `#view=submit`.

Exit codes: `0` — the decisions file is written (whole) · `3` — the human abandoned the review (no
decisions; their draft is kept beside the decisions path and restores on the next `serve` of the
same `--out`) · `2` — bad arguments or an invalid packet · `1` — an unexpected failure.

## 3. Carry out the decisions

Read `<scratch>/decisions.json`. Its `packet.digest` is `sha256:` of the packet file's bytes —
confirm it answers the packet you served. Before editing anything a note points at, run
`locate --decisions … --repo <repo> --packet …` to find where each quote sits now.

**Verdicts on spec-feedback** (and how the SF's **Status** line reads afterwards — never rewrite the
SF's original text):

| Verdict | Do                                                                             | Status line                                                                                                     |
| ------- | ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| accept  | Make the proposed intent edit in an intent change.                             | `pending — ruled by <reviewer> <date>, awaiting the intent edit: <the ruling, one line> (<link to the change>)` |
| amend   | Make the intent edit in the reviewer's `wording`.                              | as for accept                                                                                                   |
| decline | No intent edit.                                                                | `declined — <the reviewer's why>`                                                                               |
| defer   | With a `ruling`: record it. Without: nothing.                                  | with a ruling: `pending — ruled by <reviewer> <date>, awaiting the intent edit: <ruling>`; else unchanged       |
| revise  | Rework the proposal or analysis as `request` says; it goes in the next packet. | unchanged                                                                                                       |

When the intent change merges, the Status becomes
`adjudicated — <link> (<reviewer>'s ruling: <one
line>)` — the merge is the adjudication act, so the
Status says adjudicated only after it.

- **Intent edits ride their own change** — a branch and pull request that touches only `intent/`,
  never bundled into a build or design change. Group by coherent ruling (typically one change per
  design entry's accepted SFs). A `note` on a verdict is the human talking to you: honour it.
- **Status lines are design edits.** They go where the entry lives: on its build branch while that
  is unmerged (confirm its pull request is still open before pushing), otherwise in a small design
  change.
- **Open questions:** accept/amend resolves the question in the slice that owns it (and marks it
  settled or removes it from the index, per the repository's convention) in an intent change;
  decline removes it with the why; defer leaves it.
- **Proposed ADRs:** accept moves the ADR's Status to accepted; amend edits it to the reviewer's
  wording first; decline marks it rejected with the why (supersede, never delete).
- **Branch items** (`accept` reads as approve, `decline` as reject): approve needs nothing; amend
  applies the reviewer's wording on the branch; reject reverts or reworks that change on the branch;
  revise reworks it for another look. The **overall verdict**: `approve` — report the branch ready
  (merging stays with the human); `request-changes` — make the fixes on the branch, then prepare a
  fresh branch packet; `comment` — relay the notes. Post anything to a forge only when the human or
  the repository's conventions ask for it.

**Notes** — every one is acted on, never dropped:

| Kind          | Do                                                                                                                             |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `comment`     | Weigh it; act if it implies a change, else answer it in your report.                                                           |
| `question`    | Answer it — in your report, or as an item in the next packet when the answer needs a ruling.                                   |
| `suggestion`  | Apply the replacement text where it was made (intent file → an intent change; design → a design change; code → a code change). |
| `intent-here` | Add the stated intent to the slice that owns it, or strengthen that slice's passage; if the home is unclear, make it an item.  |
| `mismatch`    | Make it an item next pass with both options — change the code, or revise the intent — unless the note already says which.      |

A note made while an item was open carries `item`: read it with that item's ruling.

Then report to the human: what changed, the links to every change opened, and what goes into the
next pass.

## 4. Iterate

The next packet holds what came back: items marked `revise` (reworked), items the human did not
reach, and new items born of notes. Increment `iteration`. Repeat until a pass comes back empty or
the human stops — nothing is lost either way, because every ruling not yet carried out is in a
decisions file or still pending in the repository.
