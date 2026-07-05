# <System name>

<One paragraph: what this system is and the problem it solves. Full purpose:
[`intent/00-foundation/00-vision.md`](intent/00-foundation/00-vision.md).>

## The four legs

The repo stands on four parallel trees. **`intent` governs the other three.**

| Leg                  | What it is                                                                                                                                                        | Rate of change                                                       |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| [`intent/`](intent/) | The durable **what & why** — purpose, concepts, and constraints.                                                                                                  | Changes **only** when our understanding of the system changes. Rare. |
| [`design/`](design/) | The **how**, and the **record of building it** — chronological design entries (scope + design + build log + spec-feedback) and stack ADRs in `design/decisions/`. | As the build proceeds and better designs are learned.                |
| [`src/`](src/)       | The code that implements the design.                                                                                                                              | Moves with `design`.                                                 |
| [`test/`](test/)     | The tests that hold the code to the design and the intent.                                                                                                        | Moves with `design`.                                                 |

`design` + `src` + `test` are a triangle that moves together; `intent` sits above them. A change
that has to touch `intent` means we **learned something about the system itself**, not that a tool
moved.

Plus [`AGENTS.md`](AGENTS.md) — harness-neutral guidance for any agent (or human) working in this
repo. **Read it first.**

## How to use it

Read [`AGENTS.md`](AGENTS.md), then the reading order in [`intent/README.md`](intent/README.md).
