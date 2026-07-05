# Full layout spec and file-section schemas

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
│   └── 03-walkthrough.md              # OPTIONAL: one scenario threaded through the concepts
│
├── design/                            # the how + the record of building it — organized for BUILDING
│   ├── README.md
│   ├── 0000-template/                 # the design-entry template (copy to start a new entry)
│   │   └── README.md
│   ├── decisions/                     # ADRs — one per stack/tooling choice
│   │   └── 0000-template.md
│   ├── 0001-<slug>/                   # a design ENTRY (dir); README.md holds scope + design + build log + spec-feedback
│   │   └── README.md
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

Each entry is **self-contained**: its `README.md` follows one common format that holds both the
_how_ and the record of producing it — **Serves intent · Scope · Design · Build log · Spec-feedback
· Status** (schema in §3). This is what used to be split into a separate "plan": the scope, the
journal, and the intent-frictions now live in the entry beside the design. Each entry points back to
the intent it serves so the trace from purpose to build stays intact, but the **filing** follows the
build, not the concepts.

**Decisions are factored out.** Stack/tooling **ADRs** live once in **`design/decisions/`** — a
choice made once for the whole repo (language, runtime, test runner, key libraries). An entry
**links** the ADRs it rests on; an ADR does not describe a unit of work. (Distinguish the one-time
ADR from the evolving entry.)

**A record, not a mirror — and chronological.** File entries in the order the work happens, and
**supersede by appending, not overwriting**. When work is re-done later, the new entry says what it
replaces and links back; the old entry stays (its Status points forward), so _why it changed_
survives. Intent is the fresh tip; design is the lineage that got there — and the diff in `intent/`
across entries is the visible payoff of a build feeding back into the spec.

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
- **Reading order** (and the optional walkthrough, if present).

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
- **The rules that keep it honest** — Serves-intent; append/supersede, never overwrite;
  spec-feedback, not silent rewrites of `intent/`.

### `design/NNNN-<slug>/README.md` (template: `templates/design-entry.md`; foundation example: `design-foundation.md`)

Header line: `Layer: design — entry. The how + the record of building it. Status: …`

- **Serves intent** — pointer(s) to the intent slice(s) this entry realizes (may be several; design
  groups by build, so one entry can span multiple concepts/seams). **Required.**
- **Scope** — what is in, what is deferred and why, and the acceptance check (the exit test).
- **Design** — the concrete how: structures, formats, tools, algorithms, sequencing; links the ADRs
  in `decisions/` it rests on.
- **Build log** — the append-only journal; no "works" claim without the exact command that proves
  it.
- **Spec-feedback** — intent frictions (`SF-NNN`: slice, assumption, proposed revision), or "none".

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

## 6. Optional depth: the build record in `design/`, and `CONTRIBUTING.md`

These are **optional** additions for repos that are _where a system is built_, not only specified.
Add them when they fit; omit them for a pure spec repo.

### The build record lives in `design/` (there is no separate `plan/` leg)

When the repo is where the system is **made to run** as an experiment that feeds back into
`intent/`, the _act of building_ is captured **inside the design entry**, not in a separate leg. The
entry's common format already carries it:

- **Scope** — the entry's boundary: in / deferred (with why) / acceptance test.
- **Build log** — the append-only journal, one block per iteration: goal, what was done, what works
  now (**with the exact command that proves it**), decisions, next.
- **Spec-feedback** — intent frictions found while building.

Stack/tooling **ADRs** live in **`design/decisions/`**.

The **load-bearing discipline**: the build **does not silently rewrite `intent/`**. When building
reveals an intent problem, it is recorded in the entry's **Spec-feedback** with a **stable
identifier** (`SF-001`, `SF-002`, …) so a human can cite it precisely, the assumption made to keep
moving, and a concrete proposed revision — the spec change is left for human review. Because entries
are numbered and kept, the **diff in `intent/` across entries** is the visible result of the
experiment. Templates: `design-entry`, `design-decision`.

(Earlier versions of this structure used a separate `plan/` leg for scope/log/spec-feedback plus
ADRs; that **folds into `design/`** — the entry carries the build record, `design/decisions/`
carries the ADRs. Distinguish the one-time **ADR** from the evolving **entry**.)

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
