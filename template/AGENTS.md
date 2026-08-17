# AGENTS.md — working in this repository

This is the harness-neutral guide for any agent (or human) working here; **read it first**. The
system's full purpose is in
[`intent/00-foundation/00-vision.md`](intent/00-foundation/00-vision.md).

## The four legs

The repo stands on four parallel trees; **`intent` governs the other three** (see
[`README.md`](README.md)):

- [`intent/`](intent/) — the **durable what & why**: purpose, concepts, and constraints. Three
  groupings: [`00-foundation/`](intent/00-foundation/) (vision + principles + glossary),
  [`01-concepts/`](intent/01-concepts/) (the domain), [`02-subsystems/`](intent/02-subsystems/) (the
  swappable seams, each a contract). Start at [`intent/README.md`](intent/README.md).
- [`design/`](design/) — the **how**, and the **record of building it**: chronological **design
  entries** (each carrying its scope, the design, an append-only build log, and any intent
  spec-feedback) plus stack ADRs in [`design/decisions/`](design/decisions/). Entries are
  **superseded, not overwritten**. Organized for building, not a mirror of intent. Start at
  [`design/README.md`](design/README.md).
- [`src/`](src/) — the code. [`test/`](test/) — the tests.

`design` + `src` + `test` move together; `intent` sits above them.

## The discipline (every change here honors it)

1. **What/why vs. how.** Intent holds what must be true and why; design holds how we build it. A
   useful heuristic: _if we changed how we build it, would this statement still hold?_ If yes it is
   intent; if it only makes sense given a particular build it is design. A guide, not vocabulary
   policing — intent may name a tool when it genuinely clarifies.
2. **One home per idea.** Every concept has exactly one canonical slice; every other slice **links**
   rather than restating it. Each file's _Canonical home for_ section declares what it owns.
3. **Why, always.** Every concept and choice carries its reasoning. A statement without its _why_ is
   not done.
4. **The triangle.** Intent, design+code, and tests move together but not always atomically; when
   one diverges, reconcile it in a following step.
5. **Two audiences.** Everything serves a human (readable) and an agent (parseable).

## If you are here to…

- **Understand the system** — follow the reading order in [`intent/README.md`](intent/README.md):
  `00-foundation/` → `01-concepts/` → `02-subsystems/`.
- **Capture a requirement** — write the durable what & why into the relevant `intent/` slice; if it
  defers a decision to the build, note it inline (_Left to implementation_).
- **Plan or do the build** — open a **design entry** (`design/NNNN-<slug>/`, from the
  [template](design/0000-template/README.md)): name the intent it serves, set its scope, record the
  _how_, journal the build in its log, and record stack choices as ADRs in
  [`design/decisions/`](design/decisions/). A later entry supersedes (never overwrites) the one it
  replaces. The build authors `design/`, `src/`, `test/`; it does **not** silently rewrite `intent/`
  — friction goes to the entry's spec-feedback for human review. An accepted spec-feedback rides its
  **own small intent-edit PR**, never a build PR — the human's merge is the adjudication — while the
  build proceeds on the SF's stated assumption.

## Conventions

- Markdown with hard-wrapped prose (~100 columns), matching the surrounding files.
- **Numbered for reading order.** `00-`, `01-`, `02-` prefixes on dirs and files sort into the order
  to read them; unnumbered files (`README.md`, glossary, open-questions) are references read out of
  sequence. Renumber neighbors if you insert a step, and update references.
- Cross-reference by relative path; keep links live.
- **How we build here** — opinionated formatting/linting on every artifact, fast test feedback, and
  high assertion density — is in [`CONTRIBUTING.md`](CONTRIBUTING.md). Run `mise run fmt` as you
  write and `mise run check` before you push.
