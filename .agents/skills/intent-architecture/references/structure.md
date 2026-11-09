# Full layout reference and file-section schemas

This is the complete reference for the intent-governed four-leg structure. `SKILL.md` gives the
overview and the workflow; this file gives the directory layout, what each file owns, and the
section schema for every file type. Ready-to-copy skeletons are in `templates/`.

---

## 1. The complete tree

```
repo/
├── AGENTS.md
├── README.md
│
├── intent/                            # the what & why — organized for UNDERSTANDING
│   ├── README.md
│   ├── 00-foundation/
│   │   ├── 00-vision.md
│   │   ├── 01-principles.md
│   │   ├── glossary.md                # unnumbered → reference, read out of order
│   │   └── open-questions.md          # unnumbered → reference
│   ├── 01-concepts/
│   │   ├── 00-<concept>.md
│   │   ├── 01-<concept>.md
│   │   └── …
│   ├── 02-subsystems/
│   │   ├── 00-<subsystem>.md
│   │   ├── 01-<subsystem>.md
│   │   └── …
│   └── 03-walkthrough.md              # RECOMMENDED, not required: one scenario threaded through the concepts
│
├── design/                            # the how + the record of building it — organized for BUILDING
│   ├── README.md
│   ├── 0000-template/                 # the design-entry template (copy to start a new entry)
│   │   ├── README.md
│   │   └── intent-feedback.md
│   ├── decisions/                     # ADRs — one per stack/tooling choice
│   │   └── 0000-template.md
│   ├── 0001-<slug>/                   # a design ENTRY (dir)
│   │   ├── README.md                  #   the design: context + serves-intent + scope + design
│   │   ├── intent-feedback.md           #   ONLY when the build raises an intent-feedback item — frictions + lifecycle
│   │   └── build-log.md               #   OPTIONAL journal — only when the build earns one
│   └── 0002-<slug>/ …                 # entries numbered in the order the work happens
│
├── src/
│   └── README.md                      # plus the actual code, laid out to mirror design
│
└── test/
    └── README.md                      # plus the actual tests
```

Numbering rule: `NN-` prefixes encode **reading order**. Unnumbered files are _references_ (read
when needed, sort last). When you insert a step, renumber neighbors and fix references.

---

## 2. What each directory means

### `intent/` — the governing leg (the what & why)

The durable purpose, concepts, and constraints, each with its _why_. It is the one leg that does not
move when a tool moves. It is organized for **understanding**: by concept and by seam.

The boundary against `design/` is the _what/why vs. how_ line: intent says what must be true and why
it matters; design says how it is built. The swap heuristic — _if we changed how we build it, would
this sentence still hold?_ — sorts most statements, but it is a guide, not a rule. **Intent may name
a concrete tool** when it genuinely clarifies (an analogy, a fixed external dependency, a worked
example); what matters is that the _substance_ is the what/why, not a build choice.

Three groupings:

| Group            | Holds                                                            |
| ---------------- | ---------------------------------------------------------------- |
| `00-foundation/` | **Global** intent: vision + cross-cutting principles + glossary. |
| `01-concepts/`   | The **domain**: the nouns and processes, with their why.         |
| `02-subsystems/` | The **swappable seams**: the contract each design must satisfy.  |

### `design/` — the how, and the record of building it

`design/` holds numbered **design entries** — one directory per unit of build work — plus a
**`decisions/`** folder of ADRs. It is organized for **building**, which happens over time in units
of related work. **It does not mirror `intent/`.** The way the build clusters (by milestone, by
component, by feature area, by phase) is usually very different from how the domain is explained,
and that is expected and correct.

Each entry is **self-contained**: a directory of up to three files, split by who reads them and when
(schema in §3). `README.md` holds the design in one common format — **Status · Context · Serves
intent · Scope · Design** — and is essentially frozen once accepted; `intent-feedback.md` holds the
**intent feedback** — frictions found while building, where the build pushes back on the intent;
each intent-feedback item is cited by its id (`IF-NNN`) — read on its own at adjudication time, and
exists only when there is at least one intent-feedback item; an optional `build-log.md` holds the
journal, only when the build earns one. This is what used to be split into a separate "plan": the
scope and the intent feedback live in the entry beside the design. Each entry points back to the
intent it serves so the trace from purpose to build stays intact, but the **filing** follows the
build, not the concepts.

An entry is a **standalone document with a single authorial voice**: it argues its motivation from
the system — intent slices, prior entries, observed failures — never from who asked for it. No
owner, brief, directive, agent, or session appears in it, and it quotes no one; whoever commissioned
the work is delivery metadata and lives with the delivery (the branch, the pull request), not in the
ledger. And **each fact has one home** within the entry: the summary previews, Scope bounds, Design
explains — other sections link rather than restate.

**Decisions are factored out.** Stack/tooling **ADRs** live once in **`design/decisions/`** — a
choice made once for the whole repo (language, runtime, test runner, key libraries). An entry
**links** the ADRs it rests on; an ADR does not describe a unit of work. (Distinguish the one-time
ADR from the evolving entry.)

**A record, not a mirror — and chronological.** File entries in the order the work happens, and
**supersede by appending, not overwriting**. When work is re-done later, the new entry says what it
replaces and links back; the old entry stays (its Status points forward), so _why it changed_
survives. A cancelled or abandoned entry likewise keeps its number and its record — a gap in the
sequence is honest history, and renumbering would falsify the lineage. Intent is the fresh tip;
design is the lineage that got there — and the diff in `intent/` across entries is the visible
payoff of a build feeding back into the intent.

**Plural techniques converge through use.** When an entry realizes a mechanism the intent
deliberately left open, it may build **more than one technique behind the same contract** — a
universal baseline plus context-specific alternates. The entry names the candidates and the
baseline, states how they will be compared in real use, and records the convergence — one technique
kept, or an explicit technique→situation rule — with its _why_, in that entry or the one that
supersedes it; an abandoned technique is superseded, not erased. **Why:** choosing a technique on
paper is weak evidence — running candidates against reality is the cheapest honest comparison — and
a contract that has held two live techniques at once is a seam proven to be a seam.

A **foundation entry** is **recommended as the typical first step** — the global architecture and
dev flow (language/runtime, repo/module layout, the toolchain and its check gate) that later entries
build on. Recommended, not mandatory; a small effort may skip it.

> **No top-level "blanks register."** Decisions or constraints deliberately left to implementation
> are called out **inline** in the relevant intent slice (a short _Left to implementation_ note),
> where the reader already has the context. Don't aggregate them into a separate global document.

### `src/` and `test/`

`src/` implements `design/` under `intent/`; its module layout mirrors the design (and that layout
is itself a recorded design decision in the foundation entry). `test/` holds two kinds: **design
tests** (the code does what _this_ design says — move with code) and **intent tests** (the durable
constraints hold regardless of how it is built — should survive a design change). All three legs
reconcile back to `intent` when they diverge.

---

## 3. File-section schemas

Stable headings matter — they serve the agent audience and make the corpus navigable. Use these.

### Root `README.md`

- One-paragraph statement of what the system is (link to `intent/00-foundation/00-vision.md`).
- **The four legs** table (intent / design / src / test, what each is, rate of change).
- The "intent governs the other three; the lower three are a triangle" framing.
- Pointer to `AGENTS.md` ("read first") and the reading order in `intent/README.md`.

### Root `AGENTS.md`

- Harness-neutral; "read first."
- **The four legs** (brief) and that `intent` governs them.
- **The discipline** — the rules, restated tightly (lead with what/why vs. how).
- **If you are here to…** — task-oriented entry points (understand the system → reading order; fill
  a slice → write durable what/why in `intent/`, the build in `design/`).
- **Conventions** — markdown style, numbering, relative links.

### `intent/README.md`

- What the intent tree is and that it is durable (the what & why).
- **The what/why-vs-how line** stated as a blockquote, with the swap heuristic and the caveat that
  it is a guide, not vocabulary policing.
- **The three groupings** table.
- **The two governing rules** (what/why vs. how; one home per idea).
- **Standing watches** — the checks that never settle (boundary drift both ways; slice granularity),
  kept as practice rather than open questions.
- **Reading order** (and the recommended walkthrough, if present — a concrete scenario is intent
  text a builder can rule against, and a gap shows up as a step the walkthrough cannot narrate).

### `intent/00-foundation/00-vision.md`

Header line: `Layer: intent · foundation (global). The what & why.`

- **Purpose** — what the system is, the problem, the boundaries; the _why_ every slice serves.
- **(Sections)** — the organizing lens / prime directive if there is one; the setting; baseline
  assumptions; non-goals.
- **Canonical home for** — declares what this file owns (e.g. the prime directive).
- **Open questions.**

### `intent/00-foundation/01-principles.md`

Header line: `Layer: intent · foundation (global). The what & why.`

- **Purpose** — invariants that apply everywhere and outrank local convenience; each carries its
  _why_; slices honor, do not restate them.
- **Principles** — a numbered list, each `Principle — why`.
- **Canonical home for** — cross-cutting policies that recur.
- **Open questions.**

### `intent/00-foundation/glossary.md`

- One table: **Term | One-line meaning | Defining slice.** Points each term to the slice that owns
  it. Never a second definition — it indexes, it does not own.

### `intent/00-foundation/open-questions.md`

- Only **cross-cutting** tensions (span multiple slices).
- Only questions to settle. A check to repeat is not an open question: it belongs in
  `intent/README.md`'s _Standing watches_. A tree that still marks one `_Standing watch._` here
  reads correctly, and review tooling still skips it.
- An **index of per-slice open questions** (pointers into each slice's own _Open questions_).

### `intent/01-concepts/NN-<concept>.md` (template: `templates/intent-concept.md`)

Header line: `Layer: intent · concept. The what & why.`

- **Purpose** — what this concept is and why it exists.
- **(Sections)** — the substance, each statement carrying its _why_.
- **Canonical home for** — exactly what this file owns; everything else links here.
- **Left to implementation** _(optional)_ — decisions/constraints this slice deliberately defers to
  design.
- **Open questions.**

### `intent/02-subsystems/NN-<subsystem>.md` (template: `templates/intent-subsystem.md`)

Header line: `Layer: intent · subsystem (seam). The contract; design plans the how.`

- **Responsibility** — what this seam is accountable for.
- **Constraints any design must honor** — the contract, as a list, each with its _why_.
- **What this is NOT** — explicitly out of scope; guards against the contract absorbing a build job.
- **Canonical home for** — the contract (and any constraint-level strategy it owns).
- **Left to implementation** _(optional)_ — decisions/constraints deferred to design.
- **Open questions.**

### `design/README.md`

- What design is: **the how + the chronological record of building it**; organized for building,
  **not** a mirror of intent.
- **The common entry format** (the entry sections) and the **`decisions/`** folder of ADRs.
- **The rules that keep it honest** — Serves-intent; append/supersede, never overwrite (a cancelled
  entry keeps its number and record — a gap in the sequence is honest history); intent feedback, not
  silent rewrites of `intent/` (including how adjudication happens: each accepted change its own
  small intent-edit PR, the human's merge as the adjudication act); plural techniques converge
  through use.
- **Finding open intent feedback** — how to list the intent-feedback items still `pending` across
  entries (a grep over `design/*/`), and why this README keeps no hand-maintained index of them: it
  would be a second copy of state the entries already hold, and a cache nothing derives is a cache
  that drifts.

### `design/NNNN-<slug>/` (templates: `templates/design-entry.md` + `design-entry-intent-feedback.md`; foundation example: `design-foundation.md`)

**`README.md`** — opening banner: a **one-or-two-sentence** statement of what the entry builds and
why (a hard cap), then
`**Status:** proposed | in-progress | built — awaiting review | accepted | superseded by
NNNN-<slug>/ · **Started:** YYYY-MM-DD`.

- **Context** — one to three short paragraphs between the status line and the first section: the
  problem as the system experiences it, what this entry proposes, and why now, linking the prior
  entries that make the work possible or necessary.
- **Serves intent** — pointer(s) to the intent slice(s) this entry realizes (may be several; design
  groups by build, so one entry can span multiple concepts/seams), each with **one sentence** on
  how. **Required.** Link to intent's words rather than quoting them — a quote goes stale the moment
  intent is edited, often by this very entry's intent feedback.
- **Scope** — what is in (each fact stated once), what is deferred — each deferral with the reason
  it is acceptable, in prose ("safe to defer because …") — and the acceptance check as a numbered
  list of executable checks (the exit test).
- **Design** — the concrete how: structures, formats, tools, algorithms, sequencing; links the ADRs
  in `decisions/` it rests on. Entry-local decisions each carry the full shape: the alternative
  considered, what made it attractive, the reason it lost, and the cost of the choice made. Layout
  records the module **boundaries** established and why, not a file inventory — the commits carry
  that.

**`intent-feedback.md`** — intent frictions (`IF-NNN`: slice, friction, assumption, proposed
revision). **Created only when the build raises an intent-feedback item** — an entry with no
frictions has no intent-feedback file, and its absence is the record that none were raised. Written
to be read on its own at adjudication time, without the README. An intent-feedback item carries an
explicit `**Status:** pending` line until settled; once settled, that line records its disposition —
`adjudicated` with a link to the intent change that settled it, or `declined` with a one-line why —
never rewriting the original text.

**`build-log.md`** — **optional**: created only when the build spans sessions or when building
forces a discovery worth keeping (a failing test that changed the design, a measured number, a
defect found in review). One block per iteration: what building forced or revealed, the exact
commands that prove what works, what is next. Not a changelog — what was done lives in the commits,
the files touched in the diff, the assertions in the test suite. Absent means the commits and the
pull request are the whole build record.

### `design/decisions/NNNN-<slug>.md` (template: `templates/design-decision.md`)

- **Context · Options considered (honest tradeoffs, not just the winner) · Decision · Why ·
  Consequences.** One per stack/tooling choice (language, runtime, test runner, key libraries); a
  design entry links the ADRs it rests on.

### `src/README.md` and `test/README.md`

- `src/`: implements design under intent; layout mirrors design (a recorded design decision).
- `test/`: design tests (move with code) vs. intent tests (survive a design change), with examples.

---

## 4. The header-line convention

Every slice file opens with a one-line banner naming its **layer** and status, e.g.:

> **Layer:** intent · concept. The what & why. **Status:** draft.

This is a fast, parseable signal of which leg the file belongs to. It is the per-file echo of the
what/why-vs-how split — not a claim that the file avoids every tool name, only a statement of which
job it is doing.

---

## 5. The two-sided-contract pattern

A subsystem seam often has two sides (e.g. a producer and a consumer of the contract). State each
side **once, on its own side**, and link — do not restate the contract on both sides. This is the
one-home rule applied to contracts.

---

## 6. Optional depth: the build record, the delivery shape, and `CONTRIBUTING.md`

These are **optional** additions for repos that are _where a system is built_, not only specified.
Add them when they fit; omit them for an intent-only repo.

### The build record lives in `design/` (there is no separate `plan/` leg)

When the repo is where the system is **made to run** as an experiment that feeds back into
`intent/`, the _act of building_ is captured **inside the design entry**, not in a separate leg. The
entry's format already carries it:

- **Scope** — the entry's boundary: in / deferred (each in prose, "safe to defer because …") /
  acceptance as a numbered list of executable checks. The acceptance checks are the entry's "works"
  claims, and the pull request that delivers the entry carries their run — no "works" claim without
  the exact command that proves it.
- **`intent-feedback.md`** — intent frictions found while building; created only when there is one.
- **`build-log.md`** — the optional journal, only when the build spans sessions or forces a
  discovery worth keeping (§3).

Stack/tooling **ADRs** live in **`design/decisions/`**.

The **load-bearing discipline**: the build **does not silently rewrite `intent/`**. When building
reveals an intent problem, it is recorded in the entry's **`intent-feedback.md`** with a **stable
identifier** (`IF-001`, `IF-002`, …) so a human can cite it precisely, the assumption made to keep
moving, and a concrete proposed revision — the intent change is left for human review. Because
entries are numbered and kept, the **diff in `intent/` across entries** is the visible result of the
experiment. Templates: `design-entry`, `design-entry-intent-feedback`, `design-decision`.

**Ids are always written with their number.** An intent-feedback item is cited by its id —
`IF-005 asks…` — and otherwise named in full ("an intent-feedback item", "intent feedback"); the
prefix never stands alone as a noun. Dictation and text-to-speech turn the bare prefix and a number
into "if 5", a case-insensitive search for "if" matches nearly every line, and capitals alone cannot
mark it at the start of a sentence.

**The intent-feedback lifecycle.** Raising an intent-feedback item is half the loop; the disposition
closes it. An intent-feedback item is `pending` from the moment it is raised, and **says so**: its
`**Status:** pending` line is written with it, because the queue is found by grepping for that line
and an item without one is invisible to the grep (tools that read the entries can only infer it).
Once settled, the Status line **records the disposition**, never rewriting the item's original text:
`adjudicated — <link to the intent PR/commit/entry that settled it>` or `declined — <one-line why>`;
a ruling made but not yet landed reads
`pending — ruled by <who> <date>, awaiting the intent edit: <the ruling>` (a ruling confirmed again
later adds `, confirmed <date>` before "awaiting"). An older entry that records intent feedback
**inline** in its README ends each bullet with `_Disposition:_ <status> — …` instead (a ruling not
yet landed: a trailing `_Status:_ pending — ruled by …`); the second grep pattern below, and the
review tool, read that shape too. **Why:** without a recorded disposition, the open intent-feedback
queue lives in someone's head or one agent's session memory — exactly the unrecorded state this
structure exists to eliminate. Because the disposition lives in the entry, the queue is derived,
never kept: the design README documents a grep over the entries rather than an index of pending
intent-feedback items (a hand-kept index is a second copy of state the entries already hold, and it
drifts):

```sh
grep -rn -e '\*\*Status:\*\* *`\?pending' -e '`pending`\.' design/*/
```

The first pattern finds an `intent-feedback.md` **Status:** line; the second, an inline disposition
at the end of an intent-feedback bullet. The glob is `design/*/`, not `design/*/intent-feedback.md`,
so the inline shape is found wherever an entry keeps it.

**How adjudication happens.** The friction is discussed with the owner, and each decision becomes
its **own small intent-edit change** — its own branch and PR, **never bundled into a build PR**.
Small separate PRs keep each adjudication reviewable and atomic; never bundling keeps a build PR
from smuggling intent changes past review. The human's **merge is the adjudication act** — the
decision is auditable in history rather than in chat. The build does not wait: it proceeds on the
item's stated assumption, and on merge the item gets its disposition backlink.

(Earlier versions of this structure used a separate `plan/` leg for scope/log/intent feedback plus
ADRs; that **folds into `design/`** — the entry carries the build record, `design/decisions/`
carries the ADRs. Distinguish the one-time **ADR** from the evolving **entry**.)

### Migrating a repo from spec feedback

Earlier versions of this structure called intent feedback **spec feedback**: the file was
`spec-feedback.md` and the ids `SF-NNN`. The name was ambiguous — the structure has no spec separate
from the intent, and "the spec" always meant the intent — so it is now **intent feedback**,
`intent-feedback.md`, `IF-NNN`. To migrate a repo that uses the old spelling:

1. **Rename the files** with `git mv`, so history follows them: each `design/*/spec-feedback.md`
   becomes `design/*/intent-feedback.md`, and the entry template's copy in `design/0000-template/`
   with them.
2. **Rewrite the current documents**: `SF-NNN` becomes `IF-NNN` (same number), and the vocabulary
   moves with it — "spec feedback" / "spec-feedback" becomes "intent feedback" / "intent-feedback",
   "an SF" / "SFs" becomes "an intent-feedback item" / "intent-feedback items" (the id prefix never
   stands alone as a noun; cite a specific item by its id, `IF-012`), and any other "spec" that
   means the intent becomes "intent". Current documents are everything that states the present:
   `intent/`, the design entries and their READMEs, `AGENTS.md`, `CONTRIBUTING.md`, the per-leg
   READMEs, and code comments.
3. **Leave dated history alone**: build logs, journals, archived captures, and git history (commit
   messages, PR titles and bodies) keep the spelling they were written in. Rewriting them would
   falsify the record, and they stay citable as written.
4. **Fix the links** that named `spec-feedback.md`, and run the repo's link check.
5. **Record the legacy spelling once**, in the repo's `design/README.md`, so old commits and PRs
   remain citable — for example: "`SF-NNN` is the legacy spelling of `IF-NNN`: intent feedback was
   once called spec feedback (`spec-feedback.md`). Dated history keeps the old spelling; `SF-012` in
   an old commit or PR means `IF-012` in the same entry."

Tools and agents **accept the legacy spelling when reading** — an `SF-NNN` id, a `spec-feedback.md`
file, or an "SF" in a dated record means the same item as its `IF-NNN` form — and **write only the
new one**.

### Upgrading a repo: standing watches

Earlier versions of this structure seeded the boundary-drift check as an open question marked
`_Standing watch._`. A check to repeat is practice, not a question to settle, so it now lives in
`intent/README.md`'s _Standing watches_. To upgrade a repo on the older shape:

1. **Add the Standing watches section** to `intent/README.md`, after _The two governing rules_ —
   boundary drift in both directions, and slice granularity, each with its _why_ (copy the section
   from `templates/intent-README.md`; a repo-specific example of a crossing, in a parenthetical, is
   welcome where one is apt).
2. **Move every standing-watch open question into it** — anything marked `_Standing watch._`, and
   any open question that is really a check to repeat (boundary drift, slice granularity) — and
   remove it from `open-questions.md` and from any slice's _Open questions_. Merge it into the
   matching watch rather than duplicating one; a watch the repo has that the generic two do not
   cover becomes a third bullet.
3. **Fix the links** that pointed at the moved item, and run the repo's link check.

### The delivery shape for agent-built entries

When design entries are built by agents and gated by a human, give the delivery a fixed shape —
optional like the rest of this section, scaled to fit:

- **Entry ↔ branch ↔ PR, one to one.** Each entry is built on its own branch and delivered by its
  own PR; the PR body distills the entry — scope, evidence, intent feedback raised — and links back
  to it. One unit of review per unit of work. While the PR awaits the human, the entry's Status
  reads `built — awaiting review`.
- **The entry stays standalone.** The commission — who asked, and in what words — is delivery
  metadata: it may inform the PR body, but the entry never restates or attributes it (the
  single-voice rule, §2). Adjudication rules against `intent/`, not against anyone's phrasing.
- **Independent verification before the PR opens.** The orchestrating agent verifies the build
  itself — its own run of the gate, its own smoke test, a read of the entry — rather than relaying
  the builder's report. Gated acts (merge, close) stay with the human.
- **The concurrency protocol.** Two PRs each green alone can make the main line red when both merge
  — **file-disjoint is not meaning-disjoint**. So: when entries are built concurrently, each PR's
  body **names its shared surfaces**; the second of any concurrently built pair merges only after a
  rebase and a combined gate run; and after any merge of concurrent work, verify the main line's
  gate.
- **Numbers reserved at commission.** Entry numbers are assigned when the work is commissioned, not
  when it lands, so parallel builds don't collide on "next number in sequence". When a collision or
  renumbering does happen, it is recorded as **one line** in the entry's context — never a journal
  iteration — and a reserved number that never lands stays an honest gap in the sequence.
- **Delivered means reachable.** A forge reporting a PR "merged" is not proof the work reached the
  main line: a stacked PR merged into a stale base after the base's own PR has merged strands the
  work while the forge honestly says "merged". Before an entry's Status moves to accepted or
  delivered, verify the merge commit is reachable from the main line
  (`git merge-base --is-ancestor <merge-commit> <main>`), and retarget stacked PRs to the main line
  before merging.

### `CONTRIBUTING.md` — how we build here

The engineering qualities every contribution honors, enforced by tooling wherever possible:

- **Opinionated, automated formatting and linting on _every_ artifact** — docs and code. Push each
  check into tooling and CI so a contributor (human or agent) gets fast, automated feedback that an
  artifact is in the right form; languages that don't enforce formatting out of the box get an
  opinionated formatter + strong linter wired in deliberately.
- **Fast iteration** — a tight write→fail-fast→fix→pass loop for unit and integration tests, stated
  as a quality of the setup independent of the framework.
- **High-assertion-density, table-driven tests** — lead with the cases (the _what_), push fixtures
  and boilerplate to the bottom (the _how_); a table of `(input → expected)` rows is dense and cheap
  to extend.
- **Pinned counts as composition tripwires** — a test that pins a count or an enumeration forces
  concurrent changes to the same meaning to collide loudly at the combined gate instead of merging
  silently; updating the pin is a deliberate act, not a chore.

Distinct from `AGENTS.md` (the four-leg discipline) and `intent/` (what the system is). Template:
`CONTRIBUTING`.

### A reusable modeling pattern: fixed vocabulary vs. evolvable instantiation

When a domain has a set the system ships opinions about, ask whether the **vocabulary** is closed
while the **instantiation** stays open. A closed vocabulary (fixed, finite, principled) with an
open, evolvable instantiation on top of it is a recurring, powerful shape: it keeps the system
enforceable and deterministic where it must be (an exhaustive redaction, a routing table keyed on
the closed set) while the instances the user actually works with stay free to grow. Name both sides
in intent, and record _why_ the vocabulary is closed — tie it to a principle. If you can't find the
tie, that is a signal the boundary is drawn wrong.
