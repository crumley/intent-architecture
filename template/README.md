# <System name>

> **Getting started (delete this block when done).** This repo was started from the
> [intent-architecture template](https://github.com/crumley/intent-architecture). To make it yours:
>
> 1. Name the system: replace `<System name>` here and in the per-leg READMEs.
> 2. `mise install && mise run check` — the Markdown gate (format + links) is green before you write
>    a line (optionally `direnv allow` to put the pinned toolchain on PATH).
> 3. Write the vision in [`intent/00-foundation/00-vision.md`](intent/00-foundation/00-vision.md),
>    then the principles; grow concepts and subsystems from there — or point an agent with the
>    intent-architecture skill at the repo and let it mine what you already have.
> 4. When you start building, open your first design entry (copy
>    [`design/0000-template/`](design/0000-template/README.md)), pick the language toolchain there,
>    and wire it into the gate (see [`CONTRIBUTING.md`](CONTRIBUTING.md)).

<One paragraph: what this system is and the problem it solves. Full purpose:
[`intent/00-foundation/00-vision.md`](intent/00-foundation/00-vision.md).>

## The four legs

The repo stands on four parallel trees. **`intent` governs the other three.**

| Leg                  | What it is                                                                                                                                                        | Rate of change                                                       |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| [`intent/`](intent/) | The durable **what & why** — purpose, concepts, and constraints.                                                                                                  | Changes **only** when our understanding of the system changes. Rare. |
| [`design/`](design/) | The **how**, and the **record of building it** — chronological design entries (scope + design + build log + spec-feedback) and stack ADRs in `design/decisions/`. | Appends as the build proceeds; old entries are kept.                 |
| [`src/`](src/)       | The code that implements the design.                                                                                                                              | Moves with `design`.                                                 |
| [`test/`](test/)     | The tests that hold the code to the design and the intent.                                                                                                        | Moves with `design`.                                                 |

`design` + `src` + `test` are a triangle that moves together; `intent` sits above them. A change
that has to touch `intent` means we **learned something about the system itself**, not that a tool
moved.

Plus [`AGENTS.md`](AGENTS.md) — harness-neutral guidance for any agent (or human) working in this
repo. **Read it first.**

## How to use it

- **To understand the system:** read [`AGENTS.md`](AGENTS.md), then follow the reading order in
  [`intent/README.md`](intent/README.md).
- **To build the system:** read the intent, then [`design/README.md`](design/README.md) — open a
  design entry, set its scope, journal the build in its log, and trace every entry back to the
  intent it serves.
- **To change the design:** keep the _what/why_ in `intent/` and the _how_ in `design/`; keep one
  home per idea; preserve every _why_; reconcile the triangle when it diverges.

How we build — the pinned toolchain, the single check gate, and the test ethos — is in
[`CONTRIBUTING.md`](CONTRIBUTING.md). Short version: `mise run fmt` as you write, `mise run check`
before you push.
