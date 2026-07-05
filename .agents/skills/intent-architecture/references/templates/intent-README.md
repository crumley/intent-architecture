# <System> Intent

The **design intent**: what the system is for, the concepts it models, and the constraints every
build must honor — each with its _why_, at a level above any one implementation.

Intent is **durable**. It is the one leg of the four (see [`../README.md`](../README.md)) that does
not move when a tool moves. It changes only when our understanding of the system changes. It is
organized for **understanding** — by concept and by seam.

## What/why vs. how — the dividing line

The boundary between this tree and [`../design/`](../design/):

> **Intent is the _what_ and the _why_. Design is the _how_.** Intent says what must be true and why
> it matters; design says how we build it.

A useful heuristic: _if we changed how we build it, would this sentence still hold?_ If yes, it
belongs here; if it only makes sense given a particular build, it belongs in `../design/`. This is a
**guide, not vocabulary policing** — intent may name a concrete tool when it genuinely clarifies (an
analogy, a fixed external dependency, a worked example). What matters is that the substance is the
what/why, not a build choice.

## Three groupings

| Group                              | Holds                                                                                     |
| ---------------------------------- | ----------------------------------------------------------------------------------------- |
| [`00-foundation/`](00-foundation/) | **Global** intent — vision and cross-cutting principles, plus shared vocabulary.          |
| [`01-concepts/`](01-concepts/)     | The **domain**: the nouns and processes, with their why.                                  |
| [`02-subsystems/`](02-subsystems/) | The **swappable machinery** (the seams): the constraints any design of each must satisfy. |

## The two governing rules

1. **What/why vs. how.** Keep this tree to the durable what & why; the how lives in `../design/`.
2. **One home per idea.** Every concept has exactly one canonical slice; every other slice **links**
   to it rather than restating it. (Each file's _Canonical home for_ section declares what it owns.)
   A genuinely two-sided contract states each side once, on its own side, and links.

## Reading order

Directories and files are **numbered in the order to read them** — `00-`, `01-`, `02-` … sort into
the path to follow. **Unnumbered** files are _references_, not steps: consult them as needed or read
them last.

1. [`00-foundation/00-vision.md`](00-foundation/00-vision.md) — why the system exists.
2. [`00-foundation/01-principles.md`](00-foundation/01-principles.md) — the invariants every slice
   honors.
3. [`01-concepts/`](01-concepts/) — the domain model, in order.
4. [`02-subsystems/`](02-subsystems/) — the machinery, in order, each a contract.
5. [`00-foundation/open-questions.md`](00-foundation/open-questions.md) — cross-cutting unresolved
   tensions. [`00-foundation/glossary.md`](00-foundation/glossary.md) maps every term to its home.

_(Optional: a walkthrough — one concrete scenario threaded through the concepts — can strengthen and
stress-test the intent and aid communication. Add `03-walkthrough.md` if it earns its keep; it is
not a required part of the structure.)_
