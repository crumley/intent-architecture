# Review tool — Intent

The **design intent** of the review tool: what it is for, the loop it serves, and the constraints
every build of it must honor — each with its _why_, above any one implementation.

Intent is **durable**: it changes only when understanding of the tool changes, not when a library or
a key binding does. The what/why-vs-how line and the rules that govern this tree are the intent
architecture's own — see the skill this tool ships in,
[`../../../.agents/skills/intent-architecture/SKILL.md`](../../../.agents/skills/intent-architecture/SKILL.md).

## Three groupings

| Group                              | Holds                                                                   |
| ---------------------------------- | ----------------------------------------------------------------------- |
| [`00-foundation/`](00-foundation/) | **Global** intent — vision and cross-cutting principles, plus glossary. |
| [`01-concepts/`](01-concepts/)     | The **domain**: the review loop, its items, verdicts, and annotations.  |
| [`02-subsystems/`](02-subsystems/) | The **seams**: the agent ↔ tool contract any design must satisfy.       |

## Reading order

1. [`00-foundation/00-vision.md`](00-foundation/00-vision.md) — why the tool exists.
2. [`00-foundation/01-principles.md`](00-foundation/01-principles.md) — the invariants.
3. [`01-concepts/00-review-loop.md`](01-concepts/00-review-loop.md) — the loop it serves;
   [`01-concepts/01-producers.md`](01-concepts/01-producers.md) — the workflows that feed it.
4. [`02-subsystems/00-agent-tool-contract.md`](02-subsystems/00-agent-tool-contract.md) — the seam
   between the agent and the tool.
5. [`00-foundation/open-questions.md`](00-foundation/open-questions.md) and
   [`00-foundation/glossary.md`](00-foundation/glossary.md) — references.
